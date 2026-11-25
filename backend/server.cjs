const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createAccountStore, ApiError } = require('./accounts.cjs');
const { ValidationError, isValidId } = require('../shared/validation.js');

const frontendRoot = path.join(__dirname, '..', 'frontend');
const sharedValidationPath = path.join(__dirname, '..', 'shared', 'validation.js');
const port = Number(process.env.PORT) || 5173;
const allowed = new Set(['/index.html', '/app.js', '/domain.js', '/styles.css', '/assets/logo.png', '/assets/wordmark.png', '/assets/reference-background.png', '/assets/login-surface.png', '/assets/pattaya.ttf', '/assets/public-sans.ttf', '/assets/public-sans-bold.ttf', '/assets/inter-light.ttf', '/assets/inter.ttf', '/assets/inter-medium.ttf', '/assets/inter-semibold.ttf']);
allowed.add('/assets/font-faces.css');
allowed.add('/layout.css');
allowed.add('/mobile-spacing.css');
allowed.add('/validation.js');
allowed.add('/shared/validation.js');
allowed.add('/validation.css');
for (const entry of fs.readdirSync(path.join(frontendRoot, 'assets'), { withFileTypes: true })) {
  if (entry.isFile() && /\.(png|jpe?g|webp|gif|avif|ico|svg|ttf|woff2?|css)$/i.test(entry.name)) allowed.add('/assets/' + entry.name);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf' };
const BODY_LIMIT = 3 * 1024 * 1024;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function sendJSON(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function sessionToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('pt_session='));
  const value = cookie ? cookie.slice('pt_session='.length) : '';
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
function clearCookie(res) { res.setHeader('Set-Cookie', 'pt_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); }
function requireLocalRequest(req) {
  const host = req.headers.host || '';
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) throw new ApiError(403, 'LOCAL_ONLY', 'This server is available on localhost only.');
  if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Use the app on this local server to make account changes.');
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

async function createServer(options = {}) {
  const accounts = createAccountStore({ filePath: options.accountFilePath || path.join(__dirname, 'data', 'accounts.json') });
  await accounts.init();
  const sessions = new Map();
  function issueSession(req, res, userId) {
    sessions.delete(sessionToken(req));
    const now = Date.now();
    for (const [token, value] of sessions) if (value.expires <= now) sessions.delete(token);
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId, expires: now + SESSION_MS });
    res.setHeader('Set-Cookie', `pt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
  }
  async function currentUser(req, res) {
    const token = sessionToken(req), session = sessions.get(token);
    if (!session || session.expires <= Date.now()) {
      sessions.delete(token);
      if (token) clearCookie(res);
      return null;
    }
    try { return await accounts.getProfile(session.userId); }
    catch (error) {
      if (error.code !== 'ACCOUNT_NOT_FOUND') throw error;
      sessions.delete(token); clearCookie(res); return null;
    }
  }
  async function handleAPI(req, res, requestPath) {
    requireLocalRequest(req);
    const methods = {
      '/api/accounts/signup': 'POST', '/api/accounts/login': 'POST',
      '/api/accounts/session': 'GET', '/api/accounts/logout': 'POST',
      '/api/accounts/profile': 'PATCH', '/api/accounts/import': 'POST'
    };
    if (!methods[requestPath]) throw new ApiError(404, 'NOT_FOUND', 'This account endpoint does not exist.');
    if (req.method !== methods[requestPath]) {
      res.setHeader('Allow', methods[requestPath]);
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'This request method is not supported.');
    }
    if (requestPath === '/api/accounts/session') { sendJSON(res, 200, { user: await currentUser(req, res) }); return; }
    if (requestPath === '/api/accounts/logout') {
      req.resume(); sessions.delete(sessionToken(req)); clearCookie(res); sendJSON(res, 200, { user: null }); return;
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
    sendJSON(res, requestPath === '/api/accounts/signup' ? 201 : 200, { user });
  }
  async function handle(req, res) {
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if (requestPath.startsWith('/api/')) { await handleAPI(req, res, requestPath); return; }
  if (requestPath === '/') requestPath = '/index.html';
  if (!['GET', 'HEAD'].includes(req.method) || !allowed.has(requestPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found'); return;
  }
  const filePath = requestPath === '/validation.js' || requestPath === '/shared/validation.js'
    ? sharedValidationPath : path.join(frontendRoot, requestPath);
  fs.readFile(filePath, (error, data) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(requestPath)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
  }
  return http.createServer((req, res) => {
    handle(req, res).catch(error => {
      if (res.writableEnded) return;
      const status = error instanceof ValidationError ? 422 : error instanceof ApiError ? error.status : 500;
      const code = error.code || 'ACCOUNT_REQUEST_FAILED';
      const message = status >= 500 && !(error instanceof ApiError) ? 'The local account request could not be completed. Please try again.' : error.message;
      if (status >= 500) console.error('Account storage error:', error.message);
      sendJSON(res, status, { code, message, fields: error.fields || {} });
    });
  });
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
module.exports = { createServer };
