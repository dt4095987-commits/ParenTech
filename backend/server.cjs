const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHmac, timingSafeEqual } = require('node:crypto');
const { createAccountStore, ApiError } = require('./accounts.cjs');
const { ValidationError, isValidId } = require('../shared/validation.js');

const frontendRoot = path.join(__dirname, '..', 'frontend');
const legacyRoot = path.join(__dirname, '..', 'archive', 'legacy-frontend');
const sharedValidationPath = path.join(__dirname, '..', 'shared', 'validation.js');
const port = Number(process.env.PORT) || 5173;
const imageExtensions = /\.(png|jpe?g|webp|gif|avif|ico|svg)$/i;
const fontExtensions = /\.(ttf|otf|woff2?)$/i;

function publicFiles() {
  const routes = new Map();
  function add(route, filePath) {
    try { if (fs.lstatSync(filePath).isFile()) routes.set(route, filePath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  function directory(root, folder, prefix, extensions) {
    const directoryPath = path.join(root, folder);
    try {
      // Only regular files in these named public folders become routes.
      // Symlinked folders, nested paths, hidden files and other extensions stay private.
      if (!fs.lstatSync(directoryPath).isDirectory()) return;
      for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        if (entry.isFile() && !entry.name.startsWith('.') && extensions.test(entry.name)) {
          add(prefix + entry.name, path.join(directoryPath, entry.name));
        }
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  add('/index.html', path.join(frontendRoot, 'index.html'));
  directory(frontendRoot, 'pages', '/pages/', /\.html$/i);
  directory(frontendRoot, 'assets/css', '/assets/css/', /\.css$/i);
  directory(frontendRoot, 'assets/js', '/assets/js/', /\.js$/i);
  directory(frontendRoot, 'assets/img', '/assets/img/', imageExtensions);
  directory(frontendRoot, 'assets/fonts', '/assets/fonts/', fontExtensions);
  add('/domain.js', path.join(frontendRoot, 'assets', 'js', 'domain.js'));
  add('/validation.js', sharedValidationPath);
  add('/shared/validation.js', sharedValidationPath);
  for (const name of ['index.html', 'app.js', 'domain.js', 'styles.css', 'layout.css', 'mobile-spacing.css', 'validation.css']) {
    add('/legacy/' + name, path.join(legacyRoot, name));
  }
  add('/legacy/validation.js', sharedValidationPath);
  directory(legacyRoot, 'assets', '/legacy/assets/', /\.(png|jpe?g|webp|gif|avif|ico|svg|ttf|otf|woff2?|css)$/i);
  return routes;
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2'
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.googleapis.com/css2 https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/; img-src 'self' https://*.public.blob.vercel-storage.com data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
const BODY_LIMIT = 3 * 1024 * 1024;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function sendJSON(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function isSecureRequest(req) {
  return Boolean(process.env.VERCEL) || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}
function sessionToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('pt_session='));
  return cookie ? cookie.slice('pt_session='.length) : '';
}
function clearCookie(req, res) {
  res.setHeader('Set-Cookie', `pt_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isSecureRequest(req) ? '; Secure' : ''}`);
}
function allowedHost(host) {
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return true;
  const hostname = host.split(':')[0].toLowerCase();
  const configured = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.ALLOWED_HOSTS || '').split(',')
  ].map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (configured.includes(hostname) || configured.includes(host.toLowerCase())) return true;
  if (process.env.VERCEL && /^[a-z0-9-]+\.vercel\.app$/i.test(hostname)) return true;
  return false;
}
function requireLocalRequest(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host || !allowedHost(host)) throw new ApiError(403, 'LOCAL_ONLY', 'This server is available on localhost or its configured deployment host only.');
  const origin = req.headers.origin;
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Use the app on this host to make account changes.');
  }
}
function readJSON(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    req.resume();
    return Promise.reject(new ApiError(415, 'JSON_REQUIRED', 'Send account details as application/json.'));
  }
  if (Number(req.headers['content-length']) > BODY_LIMIT) {
    req.resume();
    return Promise.reject(new ApiError(413, 'BODY_TOO_LARGE', 'The account request is too large.'));
  }
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [], settled = false;
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > BODY_LIMIT) { settled = true; chunks = []; reject(new ApiError(413, 'BODY_TOO_LARGE', 'The account request is too large.')); }
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'INVALID_JSON', 'The account request contains invalid JSON.')); }
    });
    req.on('error', () => { if (!settled) { settled = true; reject(new ApiError(400, 'REQUEST_FAILED', 'The account request could not be read.')); } });
  });
}

async function createAppHandler(options = {}) {
  const routes = publicFiles();
  const accounts = createAccountStore({
    filePath: options.accountFilePath || (!process.env.DATABASE_URL ? path.join(__dirname, 'data', 'accounts.json') : undefined),
    databaseUrl: options.databaseUrl
  });
  await accounts.init();
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET || (process.env.VERCEL ? randomBytes(32).toString('hex') : '');
  const sessions = sessionSecret ? null : new Map();

  function signSession(userId, exp) {
    const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
    const sig = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }
  function verifySignedSession(token) {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', sessionSecret).update(payload).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!data || !isValidId(data.uid) || !Number.isFinite(data.exp) || data.exp <= Date.now()) return null;
      return data;
    } catch {
      return null;
    }
  }
  function issueSession(req, res, userId) {
    let token;
    if (sessionSecret) {
      token = signSession(userId, Date.now() + SESSION_MS);
    } else {
      const existing = sessionToken(req);
      if (/^[a-f0-9]{64}$/.test(existing)) sessions.delete(existing);
      const now = Date.now();
      for (const [key, value] of sessions) if (value.expires <= now) sessions.delete(key);
      if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
      token = randomBytes(32).toString('hex');
      sessions.set(token, { userId, expires: now + SESSION_MS });
    }
    res.setHeader('Set-Cookie', `pt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${isSecureRequest(req) ? '; Secure' : ''}`);
  }
  async function currentUser(req, res) {
    const raw = sessionToken(req);
    let userId = null;
    if (sessionSecret) {
      const signed = verifySignedSession(raw);
      userId = signed ? signed.uid : null;
    } else if (/^[a-f0-9]{64}$/.test(raw)) {
      const entry = sessions.get(raw);
      if (entry && entry.expires > Date.now()) userId = entry.userId;
      else sessions.delete(raw);
    }
    if (!userId) {
      if (raw) clearCookie(req, res);
      return null;
    }
    try { return await accounts.getProfile(userId); }
    catch (error) {
      if (error.code !== 'ACCOUNT_NOT_FOUND') throw error;
      if (sessions) sessions.delete(raw);
      clearCookie(req, res); return null;
    }
  }
  async function sessionEnvelope(user) {
    if (!user) return { user: null };
    if (accounts.isCloud && typeof accounts.getOrganizerData === 'function') {
      return { user, organizerSync: true, organizerData: await accounts.getOrganizerData(user.id) };
    }
    return { user };
  }
  async function handleAPI(req, res, requestPath) {
    requireLocalRequest(req);
    const methods = {
      '/api/accounts/signup': 'POST', '/api/accounts/login': 'POST',
      '/api/accounts/session': 'GET', '/api/accounts/logout': 'POST',
      '/api/accounts/profile': 'PATCH', '/api/accounts/import': 'POST',
      '/api/organizer/state': 'PUT'
    };
    if (requestPath === '/api/organizer/state' && req.method === 'GET') {
      const user = await currentUser(req, res);
      if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Please log in to load your organizer data.');
      if (!accounts.isCloud || typeof accounts.getOrganizerData !== 'function') {
        sendJSON(res, 200, { organizerSync: false, data: null });
        return;
      }
      sendJSON(res, 200, { organizerSync: true, data: await accounts.getOrganizerData(user.id) });
      return;
    }
    if (!methods[requestPath]) throw new ApiError(404, 'NOT_FOUND', 'This API endpoint does not exist.');
    if (req.method !== methods[requestPath]) {
      res.setHeader('Allow', requestPath === '/api/organizer/state' ? 'GET, PUT' : methods[requestPath]);
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'This request method is not supported.');
    }
    if (requestPath === '/api/accounts/session') {
      sendJSON(res, 200, await sessionEnvelope(await currentUser(req, res)));
      return;
    }
    if (requestPath === '/api/accounts/logout') {
      req.resume(); if (sessions) sessions.delete(sessionToken(req)); clearCookie(req, res); sendJSON(res, 200, { user: null }); return;
    }
    if (requestPath === '/api/organizer/state') {
      const user = await currentUser(req, res);
      if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Please log in to sync your organizer data.');
      const expectedId = req.headers['x-pt-account'];
      if (!isValidId(expectedId) || expectedId !== user.id) {
        throw new ApiError(409, 'SESSION_CHANGED', 'Your signed-in account has changed. Refresh your account and try again.');
      }
      const body = await readJSON(req);
      if (!accounts.isCloud || typeof accounts.saveOrganizerData !== 'function') {
        sendJSON(res, 200, { organizerSync: false, saved: false });
        return;
      }
      const saved = await accounts.saveOrganizerData(user.id, body);
      sendJSON(res, 200, { organizerSync: true, data: saved });
      return;
    }
    if (requestPath === '/api/accounts/profile') {
      const user = await currentUser(req, res);
      if (!user) throw new ApiError(401, 'AUTH_REQUIRED', 'Please log in to update your profile.', { _form: 'Please log in to update your profile.' });
      const expectedId = req.headers['x-pt-account'];
      if (!isValidId(expectedId)) throw new ApiError(400, 'ACCOUNT_ID_REQUIRED', 'Refresh your account before updating your profile.', { _form: 'Refresh your account before updating your profile.' });
      if (expectedId !== user.id) throw new ApiError(409, 'SESSION_CHANGED', 'Your signed-in account has changed. Refresh your account and try again.', { _form: 'Your signed-in account has changed. Refresh your account and try again.' });
      const body = await readJSON(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError({ _form: 'Please provide your profile details.' });
      const updated = await accounts.updateProfile(user.id, body);
      sendJSON(res, 200, { user: updated }); return;
    }
    const body = await readJSON(req);
    if (requestPath === '/api/accounts/import') {
      const result = await accounts.importLegacy(body && body.accounts);
      sendJSON(res, 200, { imported: result.imported.length, skipped: result.skipped.length }); return;
    }
    const user = requestPath === '/api/accounts/signup' ? await accounts.signup(body) : await accounts.login(body);
    issueSession(req, res, user.id);
    sendJSON(res, requestPath === '/api/accounts/signup' ? 201 : 200, await sessionEnvelope(user));
  }
  async function handle(req, res) {
  let requestPath;
  try { requestPath = decodeURIComponent(req.url.split(/[?#]/, 1)[0]); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (!requestPath.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(requestPath) || requestPath.split('/').some(part => part === '.' || part === '..')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return;
  }
  if (requestPath.startsWith('/api/')) { await handleAPI(req, res, requestPath); return; }
  if (requestPath === '/') requestPath = '/index.html';
  if (['GET', 'HEAD'].includes(req.method) && ['/legacy', '/legacy/'].includes(requestPath)) {
    res.writeHead(302, { Location: '/legacy/index.html' }); res.end(); return;
  }
  if (!['GET', 'HEAD'].includes(req.method) || !routes.has(requestPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found'); return;
  }
  const filePath = routes.get(requestPath);
  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(requestPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': CSP
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
  }
  return (req, res) => {
    handle(req, res).catch(error => {
      if (res.writableEnded) return;
      const status = error instanceof ValidationError ? 422 : error instanceof ApiError ? error.status : 500;
      const code = error.code || 'ACCOUNT_REQUEST_FAILED';
      const message = status >= 500 && !(error instanceof ApiError) ? 'The account request could not be completed. Please try again.' : error.message;
      if (status >= 500) console.error('Account storage error:', error.message);
      sendJSON(res, status, { code, message, fields: error.fields || {} });
    });
  };
}
async function createServer(options = {}) {
  const listener = await createAppHandler(options);
  return http.createServer(listener);
}

if (require.main === module) {
  createServer().then(server => {
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Choose another port with the PORT environment variable.` : error.message);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`ParenTech is ready at http://localhost:${port}`));
  }).catch(error => { console.error('ParenTech could not start:', error.message); process.exitCode = 1; });
}
module.exports = { createServer, createAppHandler };
