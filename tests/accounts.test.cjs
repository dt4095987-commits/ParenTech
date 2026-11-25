'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pbkdf2Sync } = require('node:crypto');
const { createAccountStore, ApiError } = require('../backend/accounts.cjs');
const validation = require('../shared/validation.js');
const baseDirectory = path.resolve(__dirname, '..', 'tmp', 'accounts-tests');
const signup = { name: 'Test Parent', phone: '0917 123 4567', dob: '1990-04-20', civilStatus: 'Single', role: 'Solo Parent', password: ' GoodPass123 ', confirmPassword: ' GoodPass123 ' };

async function fixture(t) {
  await fs.mkdir(baseDirectory, { recursive: true });
  const directory = await fs.mkdtemp(path.join(baseDirectory, 'case-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (!resolved.startsWith(baseDirectory + path.sep)) throw new Error('Test cleanup target is outside its intended directory.');
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const filePath = path.join(directory, 'data', 'accounts.json');
  const store = createAccountStore({ filePath });
  await store.init();
  return { store, filePath, directory };
}
function legacy(id, phone, password = 'LegacyPass123') {
  const salt = '12'.repeat(16);
  return { id, profile: { name: 'Legacy Parent', phone, dob: '1985-05-15', civilStatus: 'Married', role: 'Dad' }, credentials: { salt, hash: pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex'), iterations: 100000 } };
}

test('creates a private JSON account database and persists authentication across fresh stores', async t => {
  const { store, filePath } = await fixture(t);
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), { version: 1, accounts: [] });
  const profile = await store.signup({ ...signup, admin: true, credentials: { password: 'injected' } });
  assert.equal(profile.name, 'Test Parent');
  assert.equal(profile.phone, '+639171234567');
  assert.deepEqual(Object.keys(profile).sort(), ['age', 'civilStatus', 'dob', 'id', 'name', 'phone', 'photo', 'role']);
  const raw = await fs.readFile(filePath, 'utf8');
  assert.ok(!raw.includes(signup.password));
  assert.ok(!raw.includes('injected'));
  const saved = JSON.parse(raw).accounts[0];
  assert.equal(saved.credentials.salt.length, 32);
  assert.equal(saved.credentials.hash.length, 64);
  assert.equal(saved.credentials.iterations, 100000);
  const reopened = createAccountStore({ filePath });
  await reopened.init();
  assert.deepEqual(await reopened.login({ phone: '9171234567', password: signup.password }), profile);
  assert.deepEqual(await reopened.getProfile(profile.id), profile);
});

test('uses independent salts and distinguishes unregistered phones from incorrect passwords', async t => {
  const { store, filePath } = await fixture(t);
  await store.signup(signup);
  await store.signup({ ...signup, phone: '0918 123 4567' });
  const accounts = JSON.parse(await fs.readFile(filePath, 'utf8')).accounts;
  assert.notEqual(accounts[0].credentials.salt, accounts[1].credentials.salt);
  assert.notEqual(accounts[0].credentials.hash, accounts[1].credentials.hash);
  for (const input of [{ phone: signup.phone, password: 'WrongPass1' }, { phone: '0919 123 4567', password: signup.password }]) {
    const found = input.phone === signup.phone;
    await assert.rejects(store.login(input), error => error instanceof ApiError && error.status === 401 && error.code === (found ? 'WRONG_PASSWORD' : 'PHONE_NOT_REGISTERED') && Boolean(error.fields[found ? 'password' : 'phone']));
  }
});

test('serializes concurrent signups and canonical phone collisions across store factories', async t => {
  const { store, filePath } = await fixture(t);
  const other = createAccountStore({ filePath });
  const results = await Promise.allSettled([store.signup(signup), other.signup({ ...signup, phone: '+639171234567' }), store.signup({ ...signup, phone: '0918 123 4567' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  const rejected = results.find(result => result.status === 'rejected').reason;
  assert.equal(rejected.status, 409);
  assert.ok(rejected.fields.phone);
  const saved = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.equal(saved.accounts.length, 2);
  assert.equal(new Set(saved.accounts.map(account => account.profile.phone)).size, 2);
});

test('rejects invalid writes without changing the JSON file', async t => {
  const { store, filePath } = await fixture(t);
  const profile = await store.signup(signup);
  const before = await fs.readFile(filePath, 'utf8');
  for (const input of [{ ...signup, name: 'Parent123' }, { ...signup, password: 'weak', confirmPassword: 'weak' }, { ...signup, dob: '2099-01-01' }]) await assert.rejects(store.signup(input), error => error instanceof validation.ValidationError);
  await assert.rejects(store.updateProfile(profile.id, { ...signup, role: 'Admin' }), error => error instanceof validation.ValidationError);
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
});

test('updates profiles without changing credential hashes and keeps collisions atomic', async t => {
  const { store, filePath } = await fixture(t);
  const first = await store.signup(signup);
  await store.signup({ ...signup, phone: '0918 123 4567' });
  const credentials = JSON.parse(await fs.readFile(filePath, 'utf8')).accounts[0].credentials;
  const updated = await store.updateProfile(first.id, { ...signup, name: 'Renamed Parent', phone: '+639191234567', id: 'injected', password: 'DoNotChange123' });
  assert.equal(updated.id, first.id);
  assert.equal(updated.name, 'Renamed Parent');
  assert.equal(updated.phone, '+639191234567');
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')).accounts[0].credentials, credentials);
  assert.deepEqual(await createAccountStore({ filePath }).login({ phone: updated.phone, password: signup.password }), updated);
  const before = await fs.readFile(filePath, 'utf8');
  await assert.rejects(store.updateProfile(first.id, { ...signup, phone: '0918 123 4567' }), error => error.status === 409 && Boolean(error.fields.phone));
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
  await assert.rejects(store.getProfile('does-not-exist'), error => error.status === 404);
});

test('re-reads current JSON inside queued writes and preserves valid external changes', async t => {
  const { store, filePath } = await fixture(t);
  const profile = await store.signup(signup);
  const external = JSON.parse(await fs.readFile(filePath, 'utf8'));
  external.accounts[0].profile.name = 'Changed outside the server';
  await fs.writeFile(filePath, JSON.stringify(external));
  await store.signup({ ...signup, phone: '0918 123 4567' });
  assert.equal((await store.getProfile(profile.id)).name, 'Changed outside the server');
  assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).accounts.length, 2);
  const temporaryFiles = (await fs.readdir(path.dirname(filePath))).filter(name => name.endsWith('.tmp'));
  assert.deepEqual(temporaryFiles, []);
});

test('a failed atomic replacement preserves existing accounts and does not poison later writes', async t => {
  const { store, filePath } = await fixture(t);
  await store.signup(signup);
  const before = await fs.readFile(filePath, 'utf8');
  const originalRename = fs.rename;
  const replacement = t.mock.method(fs, 'rename', async (source, destination) => {
    if (destination === filePath) throw Object.assign(new Error('Destination is locked.'), { code: 'EPERM' });
    return originalRename(source, destination);
  });
  await assert.rejects(store.signup({ ...signup, phone: '0918 123 4567' }), error => error.code === 'ACCOUNT_STORE_WRITE_FAILED');
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
  assert.deepEqual((await fs.readdir(path.dirname(filePath))).filter(name => name.endsWith('.tmp')), []);
  replacement.mock.restore();
  await store.signup({ ...signup, phone: '0918 123 4567' });
  assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).accounts.length, 2);
});

test('preserves corrupt JSON and invalid schemas instead of resetting or overwriting them', async t => {
  const { store, filePath } = await fixture(t);
  const invalidFiles = ['{ broken JSON', JSON.stringify({ version: 2, accounts: [] }), JSON.stringify({ version: 1, accounts: [{ id: 'invalid', profile: {}, credentials: {} }] })];
  for (const raw of invalidFiles) {
    await fs.writeFile(filePath, raw);
    await assert.rejects(store.init(), error => error.code === 'ACCOUNT_STORE_CORRUPT');
    await assert.rejects(store.signup(signup), error => error.code === 'ACCOUNT_STORE_CORRUPT');
    assert.equal(await fs.readFile(filePath, 'utf8'), raw);
  }
});

test('rejects duplicate identities and invalid credential bounds already in the file', async t => {
  const { store, filePath } = await fixture(t);
  const first = legacy('legacy-one', '+639171234567');
  const invalid = [
    { version: 1, accounts: [first, { ...legacy('legacy-two', '+639181234567'), id: first.id }] },
    { version: 1, accounts: [first, legacy('legacy-two', '0917 123 4567')] },
    { version: 1, accounts: [{ ...first, credentials: { ...first.credentials, iterations: 99999 } }] },
    { version: 1, accounts: [{ ...first, credentials: { ...first.credentials, hash: 'bad' } }] }
  ];
  for (const database of invalid) {
    const raw = JSON.stringify(database);
    await fs.writeFile(filePath, raw);
    await assert.rejects(store.init(), error => error.code === 'ACCOUNT_STORE_CORRUPT');
    assert.equal(await fs.readFile(filePath, 'utf8'), raw);
  }
});

test('imports compatible legacy hashes, avoids identity hijacking and returns no existing private profiles', async t => {
  const { store, filePath } = await fixture(t);
  const existing = await store.signup(signup);
  const collisionRecord = legacy(existing.id, '+639181234567');
  const samePhone = { ...legacy('different-legacy-id', existing.phone, 'AttackerPass123'), profile: { ...legacy('unused', existing.phone).profile, name: 'Should not replace account' } };
  const imported = await store.importLegacy([collisionRecord, samePhone, { id: 'parentech-demo', credentials: null }]);
  assert.equal(imported.imported.length, 1);
  assert.equal(imported.imported[0].legacyId, existing.id);
  assert.notEqual(imported.imported[0].profile.id, existing.id);
  const skipped = imported.skipped.find(item => item.reason === 'phone_exists');
  assert.deepEqual(skipped, { legacyId: 'different-legacy-id', phone: existing.phone, reason: 'phone_exists' });
  assert.equal(skipped.profile, undefined);
  assert.equal((await store.getProfile(existing.id)).name, signup.name);
  assert.equal((await store.login({ phone: collisionRecord.profile.phone, password: 'LegacyPass123' })).id, imported.imported[0].profile.id);
  await assert.rejects(store.login({ phone: existing.phone, password: 'AttackerPass123' }), error => error.status === 401);
  assert.equal((await store.login({ phone: existing.phone, password: signup.password })).id, existing.id);
  assert.equal(JSON.parse(await fs.readFile(filePath, 'utf8')).accounts.length, 2);
});

test('validates an entire migration before writing and bounds the import batch', async t => {
  const { store, filePath } = await fixture(t);
  const before = await fs.readFile(filePath, 'utf8');
  await assert.rejects(store.importLegacy([legacy('valid-legacy', '+639171234567'), { id: 'bad' }]), error => error instanceof validation.ValidationError && Boolean(error.fields.records));
  await assert.rejects(store.importLegacy(new Array(101).fill({})), error => error instanceof validation.ValidationError);
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
  assert.deepEqual(await store.importLegacy([]), { imported: [], skipped: [] });
});

test('imports and reopens legacy names without applying the newer name policy retroactively', async t => {
  const { store, filePath } = await fixture(t);
  const record = legacy('older-name-policy', '+639171234567');
  record.profile.name = 'Parent123';
  const result = await store.importLegacy([record]);
  assert.equal(result.imported[0].profile.name, 'Parent123');
  const reopened = createAccountStore({ filePath });
  await reopened.init();
  assert.equal((await reopened.login({ phone: record.profile.phone, password: 'LegacyPass123' })).name, 'Parent123');
  assert.equal((await reopened.getProfile(record.id)).name, 'Parent123');
  const before = await fs.readFile(filePath, 'utf8');
  await assert.rejects(reopened.updateProfile(record.id, record.profile), error => error instanceof validation.ValidationError && Boolean(error.fields.name));
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
  assert.equal((await reopened.updateProfile(record.id, { ...record.profile, name: 'Parent Name' })).name, 'Parent Name');
});

test('legacy structural name validation still rejects absent, empty, oversized or control-containing names', async t => {
  const { store, filePath } = await fixture(t);
  const before = await fs.readFile(filePath, 'utf8');
  for (const name of [undefined, null, 123, '', '   ', 'A'.repeat(81), '\nParent123', 'Parent\u0000Name']) {
    const record = legacy('bad-legacy-name', '+639171234567');
    record.profile.name = name;
    await assert.rejects(store.importLegacy([record]), error => error instanceof validation.ValidationError && Boolean(error.fields.records));
    assert.equal(await fs.readFile(filePath, 'utf8'), before);
  }
});

test('uses the Asia/Shanghai calendar day for birth dates independently of the server timezone', async t => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'UTC';
  t.after(() => { if (previousTimezone === undefined) delete process.env.TZ; else process.env.TZ = previousTimezone; });
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-23T17:00:00Z') });
  assert.equal(validation.localDay(), '2026-11-23');
  const { store, filePath } = await fixture(t);
  const profile = await store.signup({ ...signup, dob: '2026-11-24' });
  assert.equal(profile.dob, '2026-11-24');
  await createAccountStore({ filePath }).init();
  assert.equal((await store.getProfile(profile.id)).dob, '2026-11-24');
  await assert.rejects(store.signup({ ...signup, phone: '0918 123 4567', dob: '2026-11-25' }), error => error instanceof validation.ValidationError && Boolean(error.fields.dob));
});

test('optional personal information and bounded photo updates persist across account-store restarts', async t => {
  const { store, filePath } = await fixture(t);
  const profile = await store.signup({ name: 'Alex', phone: '0917 123 4567', role: 'Mom', password: signup.password, confirmPassword: signup.password });
  assert.equal(profile.dob, ''); assert.equal(profile.civilStatus, ''); assert.equal(profile.age, null); assert.equal(profile.photo, '');
  const photo = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
  await store.updateProfile(profile.id, { photo, age: 27 });
  const reopened = createAccountStore({ filePath }); await reopened.init();
  const updated = await reopened.login({ phone: profile.phone, password: signup.password });
  assert.equal(updated.photo, photo); assert.equal(updated.age, null); assert.equal(updated.name, 'Alex');
  const before = await fs.readFile(filePath, 'utf8');
  await assert.rejects(reopened.updateProfile(profile.id, { photo: 'data:image/svg+xml;base64,PHN2Zy8+' }), error => error instanceof validation.ValidationError && Boolean(error.fields.photo));
  assert.equal(await fs.readFile(filePath, 'utf8'), before);
  assert.equal((await reopened.updateProfile(profile.id, { age: '', photo: '' })).age, null);
});

test('reads current Shanghai birthday age without rewriting saved snapshots and preserves partial profile fields', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-23T15:59:00Z') });
  const { store, filePath } = await fixture(t);
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const profile = await store.signup({ ...signup, dob: '2000-11-24', age: 99, photo });
  assert.equal(profile.age, 25);
  const saved = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const credentials = saved.accounts[0].credentials;
  saved.accounts[0].profile.age = 'stale manual age';
  const snapshot = JSON.stringify(saved);
  await fs.writeFile(filePath, snapshot);
  t.mock.timers.setTime(new Date('2026-11-23T16:00:00Z').getTime());
  const reopened = createAccountStore({ filePath });
  await reopened.init();
  assert.equal((await reopened.getProfile(profile.id)).age, 26);
  assert.equal((await reopened.login({ phone: profile.phone, password: signup.password })).age, 26);
  assert.equal(await fs.readFile(filePath, 'utf8'), snapshot, 'Reads preserve the on-disk age snapshot');
  const ageOnly = await reopened.updateProfile(profile.id, { age: 5 });
  assert.equal(ageOnly.age, 26); assert.equal(ageOnly.dob, '2000-11-24'); assert.equal(ageOnly.photo, photo);
  const renamed = await reopened.updateProfile(profile.id, { name: 'Birthday Parent' });
  assert.equal(renamed.age, 26); assert.equal(renamed.dob, '2000-11-24'); assert.equal(renamed.photo, photo);
  const changedDOB = await reopened.updateProfile(profile.id, { dob: '2001-11-24', age: null });
  assert.equal(changedDOB.age, 25); assert.equal(changedDOB.name, 'Birthday Parent'); assert.equal(changedDOB.photo, photo);
  const clearedDOB = await reopened.updateProfile(profile.id, { dob: '', age: 27 });
  assert.equal(clearedDOB.age, null); assert.equal(clearedDOB.photo, photo);
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')).accounts[0].credentials, credentials);
});

test('legacy manual ages without a date of birth remain unknown through import and reopen', async t => {
  const { store, filePath } = await fixture(t);
  const record = legacy('missing-legacy-dob', '+639171234567');
  delete record.profile.dob;
  record.profile.age = 27;
  record.profile.photo = 'data:image/png;base64,iVBORw0KGgo=';
  const imported = await store.importLegacy([record]);
  assert.equal(imported.imported[0].profile.age, null);
  const snapshot = await fs.readFile(filePath, 'utf8');
  const reopened = createAccountStore({ filePath });
  await reopened.init();
  const profile = await reopened.getProfile(record.id);
  assert.equal(profile.age, null); assert.equal(profile.dob, ''); assert.equal(profile.photo, record.profile.photo);
  assert.equal(await fs.readFile(filePath, 'utf8'), snapshot);
});
