'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const validation = require('../shared/validation.js');
const { createPostgresAccountStore } = require('../backend/pg-store.cjs');
const { createAccountStore, ApiError } = require('../backend/accounts.cjs');
const { createServer } = require('../backend/server.cjs');

test('validateProfilePhoto accepts Vercel Blob CDN URLs and rejects untrusted URLs', () => {
  assert.equal(validation.validateProfilePhoto('https://xyz123.public.blob.vercel-storage.com/avatars/user-1.png'), '');
  assert.notEqual(validation.validateProfilePhoto('https://evil.example.com/avatar.png'), '');
  assert.notEqual(validation.validateProfilePhoto('https://xyz123.public.blob.vercel-storage.com/bad url.png'), '');
});

test('createPostgresAccountStore initializes schema, signs up, avoids duplicates, and syncs organizer state', async () => {
  const accounts = new Map();
  const organizer = new Map();
  const queries = [];

  const mockPool = {
    async query(sql, params = []) {
      queries.push(sql.trim());
      if (/CREATE TABLE IF NOT EXISTS/i.test(sql)) return { rows: [] };
      if (/INSERT INTO pt_accounts/i.test(sql)) {
        const [id, phone, name, dob, civil_status, role, photo, salt, hash, iterations] = params;
        if ([...accounts.values()].some(a => a.phone === phone)) {
          const err = new Error('duplicate key');
          err.code = '23505';
          throw err;
        }
        const row = { id, phone, name, dob, civil_status, role, photo, salt, hash, iterations };
        accounts.set(id, row);
        return { rows: [row] };
      }
      if (/SELECT[\s\S]*FROM pt_accounts WHERE phone = \$1/i.test(sql)) {
        const match = [...accounts.values()].find(a => a.phone === params[0]);
        return { rows: match ? [match] : [] };
      }
      if (/SELECT[\s\S]*FROM pt_accounts WHERE id = \$1/i.test(sql)) {
        const match = accounts.get(params[0]);
        return { rows: match ? [match] : [] };
      }
      if (/UPDATE pt_accounts/i.test(sql)) {
        const [id, phone, name, dob, civil_status, role, photo] = params;
        const current = accounts.get(id);
        const updated = { ...current, phone, name, dob, civil_status, role, photo };
        accounts.set(id, updated);
        return { rows: [updated] };
      }
      if (/SELECT data FROM pt_organizer_state/i.test(sql)) {
        const data = organizer.get(params[0]);
        return { rows: data ? [{ data }] : [] };
      }
      if (/INSERT INTO pt_organizer_state/i.test(sql)) {
        organizer.set(params[0], JSON.parse(params[1]));
        return { rows: [] };
      }
      throw new Error('Unhandled SQL: ' + sql);
    }
  };

  const store = createPostgresAccountStore({
    databaseUrl: 'postgres://local/test',
    pool: mockPool,
    ApiError,
    shared: {
      profileValues: input => validation.assert('profile', input),
      legacyProfileValues: input => validation.assert('profile', input),
      accountValues: input => input,
      collision: () => new ApiError(409, 'PHONE_EXISTS', 'Phone exists', { phone: 'Phone exists' }),
      unauthorized: found => new ApiError(401, found ? 'WRONG_PASSWORD' : 'PHONE_NOT_REGISTERED', 'Auth error'),
      missingAccount: () => new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Not found'),
      requireId: id => { if (!validation.isValidId(id)) throw new Error('Bad id'); }
    }
  });

  assert.equal(store.isCloud, true);
  const created = await store.signup({
    name: 'Cloud Parent',
    phone: '09171234567',
    dob: '1993-05-10',
    civilStatus: 'Married',
    role: 'Mom',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
    photo: ''
  });
  assert.equal(created.phone, '+639171234567');

  await assert.rejects(store.signup({
    name: 'Duplicate Parent',
    phone: '+639171234567',
    role: 'Dad',
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1'
  }), err => err.code === 'PHONE_EXISTS');

  const loggedIn = await store.login({ phone: '9171234567', password: 'StrongPassword1' });
  assert.equal(loggedIn.id, created.id);

  const saved = await store.saveOrganizerData(created.id, {
    tasks: [{ id: 't1', title: 'Buy milk' }],
    groceries: [{ id: 'g1', name: 'Milk', quantity: 2 }],
    purchases: [],
    settings: { theme: 'dark', notifications: true },
    profileViews: ['2026-11-26']
  });
  assert.equal(saved.groceries[0].name, 'Milk');
  assert.equal((await store.getOrganizerData(created.id)).settings.theme, 'dark');
  assert.ok(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS pt_accounts')));
  assert.ok(queries.some(q => q.includes('CREATE TABLE IF NOT EXISTS pt_organizer_state')));
});

test('stateless HMAC session cookie survives server restart when SESSION_SECRET is configured', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parentech-vercel-'));
  const accountFilePath = path.join(dir, 'accounts.json');
  const sessionSecret = 'unit-test-persistent-vercel-secret-32chars';

  let server = await createServer({ accountFilePath, sessionSecret });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let port = server.address().port;
  let base = `http://127.0.0.1:${port}`;

  try {
    const signupRes = await fetch(`${base}/api/accounts/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({
        name: 'Stateless Parent',
        phone: '9175551234',
        role: 'Mom',
        password: 'Password123',
        confirmPassword: 'Password123'
      })
    });
    assert.equal(signupRes.status, 201);
    const cookie = signupRes.headers.get('set-cookie').split(';')[0];
    assert.match(cookie, /^pt_session=[^;]+\.[^;]+$/);

    await new Promise(r => server.close(r));
    server = await createServer({ accountFilePath, sessionSecret });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
    base = `http://127.0.0.1:${port}`;

    const sessionRes = await fetch(`${base}/api/accounts/session`, { headers: { Cookie: cookie } });
    assert.equal(sessionRes.status, 200);
    const data = await sessionRes.json();
    assert.equal(data.user.name, 'Stateless Parent');
  } finally {
    await new Promise(r => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
