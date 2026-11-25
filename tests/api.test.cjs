'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { randomBytes, randomUUID, pbkdf2Sync } = require('node:crypto');

const signup = { name: 'Integration Parent', phone: '0919 123 4567', dob: '1991-07-10', civilStatus: 'Single', role: 'Solo Parent', password: 'FamilyPlan123', confirmPassword: 'FamilyPlan123' };
const publicProfile = values => ({ name: values.name, phone: values.phone, dob: values.dob, civilStatus: values.civilStatus, role: values.role });
function assertPublic(user) {
  assert.ok(user && typeof user.id === 'string');
  assert.doesNotMatch(JSON.stringify(user), /"(?:password|confirmPassword|credentials|salt|hash|iterations)"\s*:/);
}
function legacyAccount(profile, password) {
  const salt = randomBytes(16).toString('hex');
  return { id: randomUUID(), profile, credentials: { salt, hash: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'), iterations: 100000 } };
}
async function close(server) {
  if (!server?.listening) return;
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function rawGet(base, route) {
  const address = new URL(base);
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: address.hostname, port: address.port, path: route }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
  });
}
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'parentech-api-'));
  const accountFilePath = path.join(directory, 'accounts.json');
  const servers = [];
  const api = { directory, accountFilePath, server: null, base: '' };
  t.after(async () => {
    await Promise.all(servers.map(close));
    const resolved = path.resolve(directory), tempRoot = path.resolve(os.tmpdir());
    assert.ok(resolved.startsWith(tempRoot + path.sep) && path.basename(resolved).startsWith('parentech-api-'), 'Cleanup stays within this test temporary directory');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  api.start = async () => {
    const { createServer } = require('../backend/server.cjs');
    assert.equal(typeof createServer, 'function', 'The server exposes an isolated factory');
    const server = await createServer({ accountFilePath });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
    });
    servers.push(server); api.server = server; api.base = `http://127.0.0.1:${server.address().port}`;
  };
  api.client = () => {
    let cookie = '', expectedAccountId = '';
    return {
      get cookie() { return cookie; },
      async request(method, route, data, options = {}) {
        const headers = { Origin: api.base, ...(data !== undefined || options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(method === 'PATCH' && route === '/api/accounts/profile' ? { 'X-PT-Account': expectedAccountId } : {}), ...options.headers };
        const response = await fetch(api.base + route, { method, headers, body: options.body ?? (data === undefined ? undefined : JSON.stringify(data)), redirect: 'manual' });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) cookie = setCookie.split(';')[0];
        const text = await response.text();
        let body; try { body = JSON.parse(text); } catch { body = text; }
        if (body && body.user && typeof body.user.id === 'string') expectedAccountId = body.user.id;
        return { status: response.status, headers: response.headers, data: body, text };
      }
    };
  };
  api.file = async () => JSON.parse(await fs.readFile(accountFilePath, 'utf8'));
  api.snapshot = async () => { try { return await fs.readFile(accountFilePath, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
  await api.start();
  return api;
}

test('HTTP signup persists salted credentials, uses a private session cookie, and survives a server restart', async t => {
  const api = await fixture(t), client = api.client();
  const response = await client.request('POST', '/api/accounts/signup', signup);
  assert.equal(response.status, 201); assertPublic(response.data.user);
  assert.equal(response.data.user.phone, '+639191234567');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^pt_session=[a-f0-9]{64};/i);
  for (const flag of [/HttpOnly/i, /SameSite=Strict/i, /Path=\//i, /Max-Age=604800/i]) assert.match(cookie, flag);
  const file = await api.file(); assert.equal(file.version, 1); assert.equal(file.accounts.length, 1);
  const saved = file.accounts[0];
  assert.match(saved.credentials.salt, /^[a-f0-9]{32}$/i); assert.match(saved.credentials.hash, /^[a-f0-9]{64}$/i);
  assert.equal(saved.credentials.iterations, 100000); assert.ok(!(await api.snapshot()).includes(signup.password));
  const session = await client.request('GET', '/api/accounts/session'); assert.equal(session.data.user.id, response.data.user.id); assertPublic(session.data.user);
  await close(api.server); await api.start();
  assert.equal((await client.request('GET', '/api/accounts/session')).data.user, null, 'Restart invalidates the in-memory session');
  const login = await client.request('POST', '/api/accounts/login', { phone: '+639191234567', password: signup.password });
  assert.equal(login.status, 200); assert.equal(login.data.user.id, response.data.user.id); assertPublic(login.data.user);
  assert.deepEqual((await api.file()).accounts[0].credentials, saved.credentials);
});

test('HTTP validation and duplicate phone conflicts preserve account data; profile updates require a session', async t => {
  const api = await fixture(t), client = api.client();
  const before = await api.snapshot();
  const invalid = await client.request('POST', '/api/accounts/signup', { ...signup, name: 'Parent123', phone: 'abc123', dob: '2099-01-01', password: 'weak', confirmPassword: 'Different' });
  assert.equal(invalid.status, 422); assert.equal(invalid.data.code, 'VALIDATION_ERROR');
  for (const field of ['name', 'phone', 'dob', 'password', 'confirmPassword']) assert.ok(invalid.data.fields[field]);
  assert.equal(await api.snapshot(), before);
  const created = await client.request('POST', '/api/accounts/signup', signup); assert.equal(created.status, 201);
  const snapshot = await api.snapshot();
  const duplicate = await api.client().request('POST', '/api/accounts/signup', { ...signup, name: 'Different Parent', phone: '+63 (919) 123-4567' });
  assert.equal(duplicate.status, 409); assert.ok(duplicate.data.fields.phone); assert.equal(await api.snapshot(), snapshot);
  const wrong = await api.client().request('POST', '/api/accounts/login', { phone: signup.phone, password: 'WrongPassword123' });
  assert.equal(wrong.status, 401); assert.match(wrong.data.message, /incorrect|invalid/i); assert.ok(wrong.data.fields.password);
  const anonymous = await api.client().request('PATCH', '/api/accounts/profile', { name: 'Changed Parent' }); assert.equal(anonymous.status, 401);
  const other = { ...signup, name: 'Other Parent', phone: '0918 123 4567' };
  assert.equal((await api.client().request('POST', '/api/accounts/signup', other)).status, 201);
  const update = await client.request('PATCH', '/api/accounts/profile', { ...publicProfile(created.data.user), id: 'untrusted-id', name: 'Updated Parent', role: 'Dad' });
  assert.equal(update.status, 200); assert.equal(update.data.user.id, created.data.user.id); assert.equal(update.data.user.name, 'Updated Parent'); assert.equal(update.data.user.role, 'Dad'); assertPublic(update.data.user);
  const updatedSnapshot = await api.snapshot();
  const collision = await client.request('PATCH', '/api/accounts/profile', { ...update.data.user, phone: other.phone });
  assert.equal(collision.status, 409); assert.ok(collision.data.fields.phone); assert.equal(await api.snapshot(), updatedSnapshot);
  const logout = await client.request('POST', '/api/accounts/logout', {}); assert.equal(logout.status, 200); assert.equal(logout.data.user, null);
  assert.equal((await client.request('GET', '/api/accounts/session')).data.user, null);
});

test('legacy hash import creates accounts without signing in or overwriting an existing phone', async t => {
  const api = await fixture(t), original = api.client(), importer = api.client();
  await original.request('POST', '/api/accounts/signup', signup);
  const legacy = legacyAccount({ ...publicProfile(signup), name: 'Legacy Parent', phone: '+639181234567' }, 'LegacySecret123');
  const collision = legacyAccount({ ...publicProfile(signup), name: 'Spoofed Parent', phone: '+639191234567' }, 'AttackerSecret123');
  const response = await importer.request('POST', '/api/accounts/import', { accounts: [legacy, collision] });
  assert.equal(response.status, 200); assert.equal(response.data.imported, 1); assert.equal(response.data.skipped, 1);
  assert.ok(!response.text.includes(signup.name)); assert.ok(!response.text.includes('Spoofed Parent')); assert.doesNotMatch(response.text, /"credentials"|"hash"|"salt"/);
  assert.equal((await importer.request('GET', '/api/accounts/session')).data.user, null);
  const importedLogin = await importer.request('POST', '/api/accounts/login', { phone: '0918 123 4567', password: 'LegacySecret123' });
  assert.equal(importedLogin.status, 200); assert.equal(importedLogin.data.user.name, 'Legacy Parent'); assertPublic(importedLogin.data.user);
  const preserved = await api.client().request('POST', '/api/accounts/login', { phone: signup.phone, password: signup.password }); assert.equal(preserved.status, 200); assert.equal(preserved.data.user.name, signup.name);
  assert.equal((await api.client().request('POST', '/api/accounts/login', { phone: signup.phone, password: 'AttackerSecret123' })).status, 401);
  assert.equal((await api.file()).accounts.length, 2);
  const snapshot = await api.snapshot();
  const oversizedBatch = await api.client().request('POST', '/api/accounts/import', { accounts: Array.from({ length: 101 }, () => legacy) });
  assert.equal(oversizedBatch.status, 422); assert.ok(oversizedBatch.data.fields.records);
  assert.equal(await api.snapshot(), snapshot);
});

test('the HTTP boundary rejects malformed, foreign-origin and oversized writes and keeps private files unavailable', async t => {
  const api = await fixture(t), client = api.client();
  const snapshot = await api.snapshot();
  assert.equal((await client.request('POST', '/api/accounts/signup', undefined, { body: '{' })).status, 400);
  assert.equal((await client.request('POST', '/api/accounts/signup', undefined, { body: 'text', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await client.request('POST', '/api/accounts/signup', signup, { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await client.request('POST', '/api/accounts/signup', undefined, { body: JSON.stringify({ name: 'x'.repeat(3 * 1024 * 1024) }) })).status, 413);
  assert.equal(await api.snapshot(), snapshot);
  for (const route of ['/data/accounts.json', '/backend/data/accounts.json', '/backend/accounts.cjs', '/backend/server.cjs', '/shared/private.json', '/Password.pdf', '/.git/config']) assert.equal((await client.request('GET', route)).status, 404, route);
  const index = await client.request('GET', '/'); assert.equal(index.status, 200); assert.match(index.text, /ParenTech/);
});

test('simultaneous HTTP signup for the same normalized phone produces one account and one conflict', async t => {
  const api = await fixture(t);
  const responses = await Promise.all([
    api.client().request('POST', '/api/accounts/signup', signup),
    api.client().request('POST', '/api/accounts/signup', { ...signup, phone: '+639191234567' })
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal((await api.file()).accounts.length, 1);
});

test('the new frontend, legacy frontend and shared modules stay available through explicit public URLs', async t => {
  const api = await fixture(t), client = api.client();
  const urls = ['/index.html', '/domain.js', '/validation.js', '/shared/validation.js'];
  for (const [folder, prefix, extensions] of [
    ['pages', '/pages/', /\.html$/i], ['assets/css', '/assets/css/', /\.css$/i],
    ['assets/js', '/assets/js/', /\.js$/i], ['assets/img', '/assets/img/', /\.(png|jpe?g|webp|gif|avif|ico|svg)$/i],
    ['assets/fonts', '/assets/fonts/', /\.(ttf|otf|woff2?)$/i]
  ]) {
    let entries;
    try { entries = await fs.readdir(path.resolve(__dirname, '../frontend', folder), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    urls.push(...entries.filter(entry => entry.isFile() && !entry.name.startsWith('.') && extensions.test(entry.name)).map(entry => prefix + encodeURIComponent(entry.name)));
  }
  for (const url of urls) assert.equal((await client.request('GET', url)).status, 200, url);
  const index = await client.request('GET', '/');
  assert.equal(index.text, await fs.readFile(path.resolve(__dirname, '../frontend/index.html'), 'utf8'));
  assert.match(index.text, /assets\/css\/style\.css/);
  const domain = await client.request('GET', '/domain.js');
  assert.equal(domain.text, await fs.readFile(path.resolve(__dirname, '../frontend/assets/js/domain.js'), 'utf8'));
  const image = await client.request('GET', '/assets/img/avatar.jpg');
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  const head = await client.request('HEAD', '/pages/home.html');
  assert.equal(head.status, 200); assert.equal(head.text, ''); assert.match(head.headers.get('content-type'), /text\/html/);
  const validator = await client.request('GET', '/validation.js');
  assert.match(validator.text, /PTValidation/); assert.match(validator.headers.get('content-type'), /javascript/);
  assert.equal((await client.request('GET', '/shared/validation.js')).text, validator.text);
  const legacy = ['/legacy/index.html', '/legacy/app.js', '/legacy/domain.js', '/legacy/styles.css', '/legacy/layout.css', '/legacy/mobile-spacing.css', '/legacy/validation.css', '/legacy/validation.js'];
  const assets = await fs.readdir(path.resolve(__dirname, '../archive/legacy-frontend/assets'), { withFileTypes: true });
  legacy.push(...assets.filter(entry => entry.isFile()).map(entry => '/legacy/assets/' + encodeURIComponent(entry.name)));
  for (const url of legacy) assert.equal((await client.request('GET', url)).status, 200, url);
  const legacyIndex = await client.request('GET', '/legacy/index.html');
  assert.equal(legacyIndex.text, await fs.readFile(path.resolve(__dirname, '../archive/legacy-frontend/index.html'), 'utf8'));
  for (const root of ['/legacy', '/legacy/']) {
    const redirect = await client.request('GET', root);
    assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/legacy/index.html');
  }
  assert.equal((await client.request('POST', '/index.html', {})).status, 404);
});

test('public routing blocks traversal and private workspace files while CSP allows only the required stylesheet services', async t => {
  const api = await fixture(t), client = api.client();
  const snapshot = await api.snapshot();
  for (const url of [
    '/frontend/index.html', '/ParentechWeb/index.html', '/backend/data/accounts.json', '/backend/server.cjs',
    '/data/accounts.json', '/shared/private.json', '/Password.pdf', '/.git/config', '/package.json',
    '/README.md', '/assets/js/accounts.json', '/assets/css/secret.txt', '/assets/img/Password.pdf',
    '/pages/../index.html', '/pages/%2e%2e/index.html', '/pages/%2e%2e%2findex.html',
    '/assets/js/..%2f..%2f..%2fbackend/data/accounts.json', '/assets/js/%5c..%5cbackend%5cserver.cjs',
    '/legacy/../backend/data/accounts.json', '/legacy/%2e%2e%2fbackend/data/accounts.json',
    '/index.html%00', '/%252e%252e/backend/data/accounts.json'
  ]) assert.equal(await rawGet(api.base, url), 404, url);
  assert.equal(await rawGet(api.base, '/%zz'), 400);
  const csp = (await client.request('GET', '/')).headers.get('content-security-policy');
  assert.equal(csp.match(/(?:^|;\s*)script-src\s+([^;]+)/)[1], "'self'");
  assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com\/css2/);
  assert.match(csp, /style-src[^;]*https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/css\/all\.min\.css/);
  assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /font-src[^;]*https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/webfonts\//);
  assert.equal(await api.snapshot(), snapshot, 'Static route checks leave the isolated account store unchanged');
});

test('HTTP optional profile fields and validated image updates survive restart without changing credentials', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-24T04:00:00Z') });
  const api = await fixture(t), client = api.client();
  const minimal = { name: 'Alex', phone: '0919 123 4567', role: 'Dad', password: signup.password, confirmPassword: signup.password };
  const created = await client.request('POST', '/api/accounts/signup', minimal);
  assert.equal(created.status, 201); assert.equal(created.data.user.dob, ''); assert.equal(created.data.user.civilStatus, ''); assert.equal(created.data.user.age, null);
  const credentials = (await api.file()).accounts[0].credentials;
  const bytes = Buffer.alloc(2 * 1024 * 1024); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  const photo = 'data:image/png;base64,' + bytes.toString('base64');
  const changed = await client.request('PATCH', '/api/accounts/profile', { photo, age: '27' });
  assert.equal(changed.status, 200); assert.equal(changed.data.user.photo, photo); assert.equal(changed.data.user.age, null); assertPublic(changed.data.user);
  const ageOnly = await client.request('PATCH', '/api/accounts/profile', { age: 28 });
  assert.equal(ageOnly.status, 200); assert.equal(ageOnly.data.user.photo, photo); assert.equal(ageOnly.data.user.age, null);
  const birthDate = await client.request('PATCH', '/api/accounts/profile', { dob: '2000-11-24', age: 99 });
  assert.equal(birthDate.status, 200); assert.equal(birthDate.data.user.age, 26); assert.equal(birthDate.data.user.photo, photo);
  const derived = await client.request('PATCH', '/api/accounts/profile', { age: '' });
  assert.equal(derived.status, 200); assert.equal(derived.data.user.age, 26); assert.equal(derived.data.user.dob, '2000-11-24');
  assert.deepEqual((await api.file()).accounts[0].credentials, credentials);
  const before = await api.snapshot();
  const invalid = await client.request('PATCH', '/api/accounts/profile', { photo: 'data:image/svg+xml;base64,PHN2Zy8+' });
  assert.equal(invalid.status, 422); assert.ok(invalid.data.fields.photo); assert.equal(await api.snapshot(), before);
  await close(api.server); await api.start();
  const restored = await api.client().request('POST', '/api/accounts/login', { phone: minimal.phone, password: minimal.password });
  assert.equal(restored.status, 200); assert.equal(restored.data.user.photo, photo); assert.equal(restored.data.user.age, 26);
  const missing = await api.client().request('POST', '/api/accounts/login', { phone: '0918 123 4567', password: minimal.password });
  assert.equal(missing.status, 401); assert.equal(missing.data.code, 'PHONE_NOT_REGISTERED'); assert.ok(missing.data.fields.phone);
});

test('profile PATCH is bound to the displayed account and cannot modify another cookie account', async t => {
  const api = await fixture(t), first = api.client(), second = api.client();
  const a = await first.request('POST', '/api/accounts/signup', signup);
  const b = await second.request('POST', '/api/accounts/signup', { ...signup, name: 'Another Parent', phone: '0918 123 4567' });
  const before = await api.snapshot();
  for (const edits of [{ name: 'Incorrect cross-tab update' }, { photo: 'data:image/png;base64,iVBORw0KGgo=' }]) {
    const result = await first.request('PATCH', '/api/accounts/profile', edits, { headers: { Cookie: second.cookie } });
    assert.equal(result.status, 409); assert.equal(result.data.code, 'SESSION_CHANGED'); assert.ok(result.data.fields._form);
    assert.equal(await api.snapshot(), before);
  }
  const missingHeader = await fetch(api.base + '/api/accounts/profile', { method: 'PATCH', headers: { Cookie: first.cookie, Origin: api.base, 'Content-Type': 'application/json' }, body: JSON.stringify({ age: 40 }) });
  assert.equal(missingHeader.status, 400); assert.equal((await missingHeader.json()).code, 'ACCOUNT_ID_REQUIRED');
  assert.equal(await api.snapshot(), before);
  const correct = await first.request('PATCH', '/api/accounts/profile', { age: 40 });
  assert.equal(correct.status, 200); assert.equal(correct.data.user.id, a.data.user.id);
  assert.equal(correct.data.user.age, a.data.user.age); assert.equal(correct.data.user.dob, a.data.user.dob);
  const untouched = await second.request('GET', '/api/accounts/session');
  assert.equal(untouched.data.user.id, b.data.user.id); assert.equal(untouched.data.user.name, 'Another Parent');
});
