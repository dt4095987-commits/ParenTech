'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const validationSource = fs.readFileSync(path.resolve(__dirname, '../shared/validation.js'), 'utf8');
const domainSource = fs.readFileSync(path.resolve(__dirname, '../frontend/domain.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const profile = { name: 'Server Parent', phone: '+639191234567', dob: '1990-04-20', civilStatus: 'Single', role: 'Mom', age: require('../shared/validation.js').ageFromDOB('1990-04-20'), photo: '' };
const user = { id: 'server-user', ...profile };
const signup = { ...profile, password: 'GoodPass123', confirmPassword: 'GoodPass123' };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return payload; } });

function browser({ saved, respond, protocol = 'http:', extras = {} } = {}) {
  const values = new Map(saved ? [['parentech.v1', typeof saved === 'string' ? saved : JSON.stringify(saved)]] : []);
  const requests = [];
  const sandbox = {
    crypto: webcrypto, TextEncoder, location: { protocol },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    async fetch(url, options) {
      const request = { url, ...plain(options), body: options.body ? JSON.parse(options.body) : undefined };
      if (options.signal) request.signal = options.signal;
      requests.push(request);
      return respond ? respond(request, requests) : response({ user: null });
    }
  };
  Object.assign(sandbox, extras);
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(validationSource, context, { filename: 'validation.js' });
  vm.runInContext(domainSource, context, { filename: 'domain.js' });
  return { store: sandbox.PTStore, requests, values, saved: () => JSON.parse(values.get('parentech.v1')) };
}

function legacyDatabase({ credentials = true } = {}) {
  const data = {
    tasks: [{ id: 'old-task', title: 'Keep this plan', description: '', date: '2026-12-01', time: '09:00', category: 'personal', completed: false }],
    groceries: [{ id: 'old-grocery', name: 'Milk' }],
    purchases: [{ id: 'old-purchase', name: 'Eggs', purchasedAt: '2026-11-24T08:00:00.000Z' }],
    reports: [{ id: 'old-report', category: 'Other', description: 'Keep these details', createdAt: '2026-11-24T08:00:00.000Z' }],
    settings: { theme: 'dark', notifications: false }
  };
  const record = { profile: { id: 'legacy-user', ...profile }, credentials: credentials ? { salt: 'a'.repeat(32), hash: 'b'.repeat(64), iterations: 100000 } : null, data };
  const demo = { profile: { id: 'parentech-demo', ...profile, name: 'Demo Parent', phone: '+639171234567' }, credentials: null, data: { tasks: [], groceries: [], purchases: [], reports: [], settings: { theme: 'light', notifications: false } } };
  return { version: 1, sessionId: 'legacy-user', accounts: { 'legacy-user': record, 'parentech-demo': demo }, defaultSettings: { theme: 'light', notifications: false } };
}

test('migrates only legacy account fields, strips hashes after confirmation, and never authenticates from import', async () => {
  const app = browser({ saved: legacyDatabase(), respond: request => request.url.endsWith('/import') ? response({ imported: 1, skipped: 0 }) : response({ user: null }) });
  assert.equal(app.store.isRemote, true);
  assert.equal(app.store.getState().user, null, 'A local session id must not authenticate before init');
  await app.store.init();
  assert.equal(app.requests.length, 2);
  const transfer = app.requests[0];
  assert.equal(transfer.url, '/api/accounts/import');
  assert.equal(transfer.method, 'POST');
  assert.equal(transfer.credentials, 'same-origin');
  assert.equal(transfer.headers['Content-Type'], 'application/json');
  assert.equal(transfer.body.accounts.length, 1);
  assert.deepEqual(Object.keys(transfer.body.accounts[0]).sort(), ['credentials', 'id', 'profile']);
  assert.ok(!JSON.stringify(transfer.body).includes('Keep this plan'));
  assert.ok(!JSON.stringify(transfer.body).includes('old-grocery'));
  assert.ok(!JSON.stringify(transfer.body).includes('parentech-demo'));
  assert.equal(app.store.getState().user, null);
  const saved = app.saved();
  assert.equal(saved.serverMigrationComplete, true);
  assert.equal(saved.accounts['legacy-user'].credentials, null);
  assert.equal(saved.accounts['legacy-user'].data.tasks[0].title, 'Keep this plan');
  assert.ok(saved.accounts['parentech-demo']);
  await app.store.init();
  assert.equal(app.requests.filter(request => request.url.endsWith('/import')).length, 1);
  assert.match(app.store.getStorageStatus().message, /local JSON file/);
});

test('failed migration rejects init, preserves legacy records and hashes, and can be retried', async () => {
  let failed = true;
  const original = JSON.stringify(legacyDatabase());
  const app = browser({ saved: original, respond: request => {
    if (request.url.endsWith('/import')) {
      if (failed) throw new Error('connection refused');
      return response({ imported: 1, skipped: 0 });
    }
    return response({ user: null });
  } });
  await assert.rejects(app.store.init(), error => error.code === 'SERVER_UNAVAILABLE');
  assert.equal(app.values.get('parentech.v1'), original);
  assert.equal(app.store.getState().user, null);
  assert.match(app.store.getStorageStatus().migrationWarning, /could not be transferred/);
  assert.equal(app.requests.length, 1, 'Failed import must not restore a session from cached metadata');
  failed = false;
  await app.store.init();
  assert.equal(app.saved().serverMigrationComplete, true);
  assert.equal(app.saved().accounts['legacy-user'].credentials, null);
});

test('malformed migration acknowledgements do not remove browser credentials', async () => {
  const original = JSON.stringify(legacyDatabase());
  const app = browser({ saved: original, respond: () => response({ imported: 0, skipped: 0 }) });
  await assert.rejects(app.store.init(), error => error.code === 'INVALID_SERVER_RESPONSE');
  assert.equal(app.values.get('parentech.v1'), original);
  assert.equal(app.saved().accounts['legacy-user'].credentials.hash, 'b'.repeat(64));
});

test('pending legacy records still transfer when an earlier completion marker is present', async () => {
  const saved = legacyDatabase(); saved.serverMigrationComplete = true;
  const app = browser({ saved, respond: request => request.url.endsWith('/import') ? response({ imported: 1, skipped: 0 }) : response({ user: null }) });
  await app.store.init();
  assert.equal(app.requests.filter(request => request.url.endsWith('/import')).length, 1);
  assert.equal(app.saved().accounts['legacy-user'].credentials, null);
  assert.equal(app.saved().serverMigrationComplete, true);
});

test('concurrent storage updates survive migration and only acknowledged credential versions are removed', async () => {
  let finishTransfer;
  const transfer = new Promise(resolve => { finishTransfer = resolve; });
  let first = true;
  const app = browser({ saved: legacyDatabase(), respond: request => {
    if (!request.url.endsWith('/import')) return response({ user: null });
    if (first) { first = false; return transfer; }
    return response({ imported: request.body.accounts.length, skipped: 0 });
  } });
  const pending = app.store.init();
  const updated = app.saved();
  updated.accounts['legacy-user'].data.tasks.push({ id: 'concurrent-task', title: 'Added in another tab', date: '2026-12-02', time: '10:00', category: 'family', completed: false });
  updated.accounts['new-legacy'] = {
    ...plain(updated.accounts['legacy-user']),
    profile: { id: 'new-legacy', ...profile, phone: '+639181234567', name: 'Another Parent' },
    credentials: { salt: 'c'.repeat(32), hash: 'd'.repeat(64), iterations: 100000 }
  };
  app.values.set('parentech.v1', JSON.stringify(updated));
  app.store.reloadFromStorage();
  finishTransfer(response({ imported: 1, skipped: 0 }));
  await pending;
  assert.equal(app.saved().accounts['legacy-user'].credentials, null);
  assert.equal(app.saved().accounts['legacy-user'].data.tasks.at(-1).title, 'Added in another tab');
  assert.equal(app.saved().accounts['new-legacy'].credentials.hash, 'd'.repeat(64));
  assert.equal(app.saved().serverMigrationComplete, false);
  await app.store.init();
  assert.deepEqual(app.requests.filter(request => request.url.endsWith('/import')).at(-1).body.accounts.map(account => account.id), ['new-legacy']);
  assert.equal(app.saved().accounts['new-legacy'].credentials, null);
  assert.equal(app.saved().serverMigrationComplete, true);
});

test('a changed credential version is retained even when a cookie session maps the same legacy profile', async () => {
  let finishTransfer;
  const transfer = new Promise(resolve => { finishTransfer = resolve; });
  let first = true;
  const app = browser({ saved: legacyDatabase(), respond: request => {
    if (!request.url.endsWith('/import')) return response({ user });
    if (first) { first = false; return transfer; }
    return response({ imported: 0, skipped: request.body.accounts.length });
  } });
  const pending = app.store.init();
  const changed = app.saved();
  changed.accounts['legacy-user'].credentials.hash = 'e'.repeat(64);
  app.values.set('parentech.v1', JSON.stringify(changed));
  app.store.reloadFromStorage();
  finishTransfer(response({ imported: 1, skipped: 0 }));
  await pending;
  assert.equal(app.store.getState().user.id, user.id);
  assert.equal(app.saved().accounts['legacy-user'].credentials.hash, 'e'.repeat(64));
  assert.equal(app.saved().serverMigrationComplete, false);
  await app.store.init();
  assert.equal(app.requests.filter(request => request.url.endsWith('/import')).at(-1).body.accounts[0].credentials.hash, 'e'.repeat(64));
  assert.equal(app.saved().accounts['legacy-user'].credentials, null);
  assert.equal(app.saved().serverMigrationComplete, true);
});

test('cookie sessions and subsequent login remap server ids while retaining organizer data', async () => {
  const app = browser({ saved: legacyDatabase(), respond: request => {
    if (request.url.endsWith('/import')) return response({ imported: 0, skipped: 1 });
    if (request.url.endsWith('/logout')) return response({ user: null });
    return response({ user });
  } });
  await app.store.init();
  assert.equal(app.store.getState().user.id, user.id);
  assert.equal(app.store.getState().tasks[0].id, 'old-task');
  assert.equal(app.store.getState().groceries[0].name, 'Milk');
  assert.equal(app.store.getState().settings.theme, 'dark');
  app.store.addGrocery('Bread');
  const before = plain(app.store.getState());
  await app.store.logout();
  assert.equal(app.store.getState().user, null);
  await app.store.login({ phone: '0919 123 4567', password: 'GoodPass123' });
  assert.deepEqual(plain(app.store.getState().groceries), before.groceries);
  const loginRequest = app.requests.find(request => request.url.endsWith('/login'));
  assert.deepEqual(loginRequest.body, { phone: profile.phone, password: 'GoodPass123' });
  const saved = app.saved();
  assert.equal(saved.accounts[user.id].credentials, null);
  assert.equal(saved.accounts['legacy-user'].credentials, null);
  assert.equal(saved.accounts['legacy-user'].serverId, user.id);
  app.store.deleteTask('old-task');
  await app.store.logout();
  await app.store.login({ phone: profile.phone, password: signup.password });
  assert.equal(app.store.getState().tasks.length, 0, 'An already remapped legacy snapshot must not resurrect deleted tasks');
});

test('signup and profile updates send whitelisted normalized values and cache no password', async () => {
  const app = browser({ respond: request => request.url.endsWith('/session') ? response({ user: null }) : request.url.endsWith('/profile') ? response({ user: { ...user, ...request.body } }) : response({ user }) });
  await app.store.init();
  await app.store.signup({ ...signup, phone: '0919 123 4567', name: '  Server   Parent ', unrelated: 'never-send' });
  const signupRequest = app.requests.find(request => request.url.endsWith('/signup'));
  assert.deepEqual(signupRequest.body, signup);
  assert.ok(!app.values.get('parentech.v1').includes(signup.password));
  app.store.addGrocery('Apples');
  await app.store.updateProfile({ name: 'Updated Parent', age: 40, password: 'never-send' });
  const update = app.requests.find(request => request.url.endsWith('/profile'));
  assert.equal(update.method, 'PATCH');
  assert.deepEqual(update.body, { name: 'Updated Parent', age: 40 });
  assert.equal(update.headers['X-PT-Account'], user.id);
  assert.equal(app.store.getState().user.name, 'Updated Parent');
  assert.equal(app.store.getState().groceries[0].name, 'Apples');
});

test('maps server field errors and preserves local state on rejected account operations', async () => {
  const app = browser({ respond: request => {
    if (request.url.endsWith('/session')) return response({ user: null });
    return response({ code: 'ACCOUNT_EXISTS', message: 'That phone is already registered.', fields: { phone: 'That phone is already registered.' } }, 409);
  } });
  await app.store.init();
  const before = app.values.get('parentech.v1');
  await assert.rejects(app.store.signup(signup), error => error.code === 'ACCOUNT_EXISTS' && error.fields.phone === 'That phone is already registered.');
  assert.equal(app.store.getState().user, null);
  assert.equal(app.values.get('parentech.v1'), before);
  const count = app.requests.length;
  await assert.rejects(app.store.signup({ ...signup, password: 'short' }), error => error.code === 'VALIDATION_ERROR' && typeof error.fields.password === 'string');
  assert.equal(app.requests.length, count, 'Invalid client input must not reach the server');
});

test('a logged-out server cannot be overridden by cached profiles or cross-tab local session ids', async () => {
  const db = legacyDatabase({ credentials: false });
  db.serverMigrationComplete = true;
  const app = browser({ saved: db });
  await app.store.init();
  assert.equal(app.store.getState().user, null);
  const changed = app.saved(); changed.sessionId = 'legacy-user';
  app.values.set('parentech.v1', JSON.stringify(changed));
  app.store.reloadFromStorage();
  assert.equal(app.store.getState().user, null);
  assert.throws(() => app.store.addGrocery('Unauthorized change'), /log in/);
  assert.equal(app.requests.length, 1);
});

test('file pages require the server for real accounts; demo profile changes stay local', async () => {
  const file = browser({ protocol: 'file:' });
  await file.store.init();
  await assert.rejects(file.store.signup(signup), error => error.code === 'SERVER_REQUIRED');
  await assert.rejects(file.store.login({ phone: profile.phone, password: signup.password }), error => error.code === 'SERVER_REQUIRED');
  assert.equal(file.requests.length, 0);
  file.store.demo();
  file.store.updateProfile({ name: 'Demo Parent' });
  assert.equal(file.store.getState().user.name, 'Demo Parent');
  const app = browser({ respond: request => request.url.endsWith('/logout') ? response({ user: null }) : response({ user }) });
  await app.store.init();
  app.store.demo();
  const count = app.requests.length;
  app.store.updateProfile({ name: 'Demo Parent', phone: '0918 765 4321' });
  assert.equal(app.requests.length, count, 'Editing a demo must not modify the cookie account');
  await app.store.logout();
  assert.equal(app.requests.at(-1).url, '/api/accounts/logout');
  assert.equal(app.store.getState().user, null);
});

test('server profiles accept optional fields and photo-only patches retain organizer records', async () => {
  let optional = { id: 'optional-user', name: 'Alex', phone: '+639191234567', role: 'Mom', dob: '', civilStatus: '', age: null, photo: '' };
  const app = browser({ respond: request => {
    if (request.url.endsWith('/session')) return response({ user: null });
    if (request.url.endsWith('/profile')) optional = { ...optional, ...request.body };
    return response({ user: optional });
  } });
  await app.store.init();
  await app.store.signup({ name: 'Alex', phone: '0919 123 4567', role: 'Mom', password: 'GoodPass123', confirmPassword: 'GoodPass123' });
  assert.equal(app.store.getState().user.age, null); assert.equal(app.store.getState().user.dob, '');
  app.store.addGrocery('Milk'); app.store.recordProfileView('2026-11-24'); app.store.updateSettings({ theme: 'system' });
  const photo = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
  await app.store.updateProfilePhoto(photo);
  const patch = app.requests.find(request => request.url.endsWith('/profile'));
  assert.deepEqual(patch.body, { photo });
  assert.equal(patch.headers['X-PT-Account'], optional.id);
  assert.equal(app.store.getState().user.photo, photo); assert.equal(app.store.getState().groceries[0].name, 'Milk');
  assert.equal(app.store.getProfileStreak('2026-11-24'), 1); assert.equal(app.store.getState().settings.theme, 'system');
  const reopened = browser({ saved: app.values.get('parentech.v1'), respond: () => response({ user: optional }) });
  await reopened.store.init();
  assert.equal(reopened.store.getState().user.photo, photo); assert.equal(reopened.store.getProfileStreak('2026-11-24'), 1);
  assert.equal(reopened.store.getState().settings.theme, 'system');
});

test('partial profile edits preserve newer server age and photo values that were not edited', async () => {
  let serverUser = { ...user };
  const app = browser({ respond: request => {
    if (request.url.endsWith('/profile')) serverUser = { ...serverUser, ...request.body };
    return response({ user: serverUser });
  } });
  await app.store.init();
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  serverUser = { ...serverUser, age: 45, photo };
  await app.store.updateProfile({ name: 'Edited Name' });
  const patch = app.requests.find(request => request.url.endsWith('/profile'));
  assert.deepEqual(patch.body, { name: 'Edited Name' }); assert.equal(patch.headers['X-PT-Account'], user.id);
  assert.equal(app.store.getState().user.photo, photo); assert.equal(app.store.getState().user.age, 45);
});

test('late profile and photo responses cannot restore a logged-out session or cross-account data', async () => {
  for (const kind of ['profile', 'photo']) {
    let complete;
    const app = browser({ respond: request => {
      if (request.url.endsWith('/profile')) return new Promise(resolve => { complete = resolve; });
      if (request.url.endsWith('/logout')) return response({ user: null });
      return response({ user });
    } });
    await app.store.init(); app.store.addGrocery('Keep account A groceries');
    const pending = kind === 'photo' ? app.store.updateProfilePhoto('data:image/png;base64,iVBORw0KGgo=') : app.store.updateProfile({ name: 'Pending Name' });
    assert.equal(app.requests.at(-1).headers['X-PT-Account'], user.id);
    await app.store.logout();
    const before = app.values.get('parentech.v1');
    complete(response({ user: { ...user, name: 'Pending Name', photo: 'data:image/png;base64,iVBORw0KGgo=' } }));
    await assert.rejects(pending, error => error.code === 'SESSION_CHANGED');
    assert.equal(app.store.getState().user, null); assert.equal(app.values.get('parentech.v1'), before);
    assert.equal(app.saved().accounts[user.id].data.groceries[0].name, 'Keep account A groceries');
  }
});

test('profile responses are discarded after another login or logout-and-relogin to the same account', async () => {
  for (const sameAccount of [false, true]) {
    const nextUser = sameAccount ? { ...user } : { ...user, id: 'account-b', name: 'Account B', phone: '+639181234567' };
    let complete;
    const app = browser({ respond: request => {
      if (request.url.endsWith('/profile')) return new Promise(resolve => { complete = resolve; });
      if (request.url.endsWith('/logout')) return response({ user: null });
      if (request.url.endsWith('/login')) return response({ user: nextUser });
      return response({ user });
    } });
    await app.store.init(); app.store.addGrocery('A groceries');
    const pending = app.store.updateProfile({ age: 50 });
    await app.store.logout(); await app.store.login({ phone: nextUser.phone, password: signup.password });
    const before = app.values.get('parentech.v1');
    complete(response({ user: { ...user, age: 50 } }));
    await assert.rejects(pending, error => error.code === 'SESSION_CHANGED');
    assert.equal(app.store.getState().user.id, nextUser.id); assert.equal(app.values.get('parentech.v1'), before);
    assert.equal(app.saved().accounts[user.id].data.groceries[0].name, 'A groceries');
  }
});

test('same-user session refresh does not invalidate a pending profile or photo save', async () => {
  for (const photoOnly of [false, true]) {
    let complete;
    const app = browser({ respond: request => request.url.endsWith('/profile') ? new Promise(resolve => { complete = resolve; }) : response({ user }) });
    await app.store.init(); app.store.addGrocery('Keep these groceries');
    const pending = photoOnly ? app.store.updateProfilePhoto('data:image/png;base64,iVBORw0KGgo=') : app.store.updateProfile({ age: 40 });
    await app.store.init();
    complete(response({ user: { ...user, age: 40, photo: photoOnly ? 'data:image/png;base64,iVBORw0KGgo=' : '' } }));
    await pending;
    assert.equal(app.store.getState().user.age, 40); assert.equal(app.store.getState().groceries[0].name, 'Keep these groceries');
  }
});

test('stale session snapshots cannot override completed logout, another login or explicit demo mode', async () => {
  for (const change of ['logout', 'login', 'demo']) {
    let sessionCount = 0, complete;
    const nextUser = { ...user, id: 'account-b', name: 'Account B', phone: '+639181234567' };
    const app = browser({ respond: request => {
      if (request.url.endsWith('/session')) { sessionCount++; return sessionCount === 1 ? response({ user }) : new Promise(resolve => { complete = resolve; }); }
      if (request.url.endsWith('/logout')) return response({ user: null });
      return response({ user: nextUser });
    } });
    await app.store.init(); app.store.addGrocery('Account A plans');
    const pending = app.store.init(); await new Promise(resolve => setImmediate(resolve));
    if (change === 'logout') await app.store.logout();
    else if (change === 'login') await app.store.login({ phone: nextUser.phone, password: signup.password });
    else app.store.demo();
    const before = app.values.get('parentech.v1');
    complete(response({ user })); await pending;
    const activeId = change === 'logout' ? null : change === 'demo' ? 'parentech-demo' : nextUser.id;
    assert.equal(app.store.getState().user?.id || null, activeId); assert.equal(app.values.get('parentech.v1'), before);
    assert.equal(app.saved().accounts[user.id].data.groceries[0].name, 'Account A plans');
  }
});

test('older login, signup and logout completions cannot override a newer login intent', async () => {
  for (const path of ['login', 'signup', 'logout']) {
    let complete;
    const nextUser = { ...user, id: 'account-b', name: 'Account B', phone: '+639181234567' };
    const app = browser({ respond: request => {
      if (request.url.endsWith('/session')) return response({ user });
      if (request.url.endsWith('/' + path) && (path !== 'login' || request.body.phone === user.phone)) return new Promise(resolve => { complete = resolve; });
      return response({ user: nextUser });
    } });
    await app.store.init(); app.store.addGrocery('Keep A data');
    const older = path === 'signup' ? app.store.signup(signup) : path === 'logout' ? app.store.logout() : app.store.login({ phone: user.phone, password: signup.password });
    const rejected = assert.rejects(older, error => error.code === 'SESSION_CHANGED');
    await app.store.login({ phone: nextUser.phone, password: signup.password });
    const before = app.values.get('parentech.v1');
    complete(response({ user: path === 'logout' ? null : user })); await rejected;
    assert.equal(app.store.getState().user.id, nextUser.id); assert.equal(app.values.get('parentech.v1'), before);
    assert.equal(app.saved().accounts[user.id].data.groceries[0].name, 'Keep A data');
  }
});

test('optional browser abort of a superseded auth request maps to SESSION_CHANGED', async () => {
  const nextUser = { ...user, id: 'account-b', name: 'Account B', phone: '+639181234567' };
  const app = browser({ extras: { AbortController }, respond: request => {
    if (request.url.endsWith('/session')) return response({ user: null });
    if (request.body.phone === user.phone) return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true }));
    return response({ user: nextUser });
  } });
  await app.store.init();
  const older = app.store.login({ phone: user.phone, password: signup.password });
  const rejected = assert.rejects(older, error => error.code === 'SESSION_CHANGED');
  await app.store.login({ phone: nextUser.phone, password: signup.password }); await rejected;
  assert.equal(app.store.getState().user.id, nextUser.id);
});
