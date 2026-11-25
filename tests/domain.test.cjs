'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const domainPath = path.resolve(__dirname, '../frontend/assets/js/domain.js');

function fresh(initial, disabled = false) {
  const values = new Map(initial ? [['parentech.v1', initial]] : []);
  global.localStorage = disabled ? {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); }
  } : {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); }
  };
  delete require.cache[domainPath];
  return { store: require(domainPath), values };
}
const profile = {
  name: 'Test Parent', phone: '0917 123 4567', dob: '1990-04-20', civilStatus: 'Single', role: 'Solo Parent', password: 'GoodPass123', confirmPassword: 'GoodPass123'
};

test('validates registration and stores salted hashes without plaintext passwords', async () => {
  const { store, values } = fresh();
  await assert.rejects(store.signup({ ...profile, password: 'short', confirmPassword: 'short' }), hasField('password'));
  await assert.rejects(store.signup({ ...profile, confirmPassword: 'WrongPass123' }), /do not match/);
  await assert.rejects(store.signup({ ...profile, phone: '123' }), /Philippine/);
  await assert.rejects(store.signup({ ...profile, dob: '2099-01-01' }), hasField('dob'));
  await assert.rejects(store.signup({ ...profile, dob: '2001-02-30' }), hasField('dob'));
  const result = await store.signup(profile);
  assert.equal(result.user.phone, '+639171234567');
  assert.equal(result.user.name, 'Test Parent');
  assert.equal(result.tasks.length, 0);
  assert.ok(!values.get('parentech.v1').includes('GoodPass123'));
  const saved = JSON.parse(values.get('parentech.v1'));
  const credentials = saved.accounts[result.user.id].credentials;
  assert.equal(credentials.hash.length, 64);
  assert.equal(credentials.salt.length, 32);
  assert.equal(credentials.iterations, 100000);
  await assert.rejects(store.signup(profile), /already exists/);
  store.logout();
  await assert.rejects(store.login({ phone: profile.phone, password: 'badpassword' }), /incorrect/);
  const loggedIn = await store.login({ phone: '9171234567', password: profile.password });
  assert.equal(loggedIn.user.id, result.user.id);
});

test('isolates accounts, demo data, and persisted sessions', async () => {
  const { store, values } = fresh();
  const first = await store.signup(profile);
  store.addGrocery('Account A apples', 7);
  store.logout();
  const second = await store.signup({ ...profile, name: 'Another Parent', phone: '0918 123 4567' });
  assert.notEqual(first.user.id, second.user.id);
  assert.equal(second.groceries.length, 0);
  store.addGrocery('Account B bananas', 2);
  assert.throws(() => store.updateProfile({ phone: profile.phone }), /another account/);
  store.demo();
  assert.equal(store.getState().user.name, 'Alex Morgan');
  assert.equal(store.getState().groceries.length, 3);
  assert.equal(store.getState().tasks.length, 3);
  store.addGrocery('Demo carrots', 4);
  store.logout();
  await store.login({ phone: profile.phone, password: profile.password });
  assert.deepEqual(store.getState().groceries.map(item => item.name), ['Account A apples']);
  assert.equal(store.getState().groceries[0].quantity, 7);
  const persisted = values.get('parentech.v1');
  const restored = fresh(persisted).store;
  assert.equal(restored.getState().user.id, first.user.id);
  assert.equal(restored.getState().groceries[0].name, 'Account A apples');
  assert.equal(restored.getState().groceries[0].quantity, 7);
  restored.demo();
  assert.equal(restored.getState().groceries.length, 4);
  assert.deepEqual(restored.getState().groceries.map(item => item.quantity), [1, 1, 1, 4]);
  await restored.login({ phone: '0918 123 4567', password: profile.password });
  assert.deepEqual(restored.getState().groceries.map(item => [item.name, item.quantity]), [['Account B bananas', 2]]);
});

test('handles task editing, completion, notifications and deletion', () => {
  const { store } = fresh();
  store.demo();
  const initial = store.getState().tasks.length;
  store.saveTask({ title: ' Dentist ', description: ' Bring forms ', date: '2026-12-01', time: '08:30', category: 'personal' });
  const task = store.getState().tasks.at(-1);
  assert.equal(task.title, 'Dentist');
  assert.equal(task.description, 'Bring forms');
  assert.equal(task.completed, false);
  assert.equal(store.getState().tasks.length, initial + 1);
  store.markNotified(task.id);
  assert.ok(store.getState().tasks.at(-1).notifiedAt);
  store.toggleTask(task.id);
  assert.ok(store.getState().tasks.at(-1).completedAt);
  store.saveTask({ ...task, title: 'Dental appointment', time: '09:00' });
  const updated = store.getState().tasks.at(-1);
  assert.equal(updated.completed, true);
  assert.equal(updated.notifiedAt, null);
  assert.equal(updated.title, 'Dental appointment');
  assert.throws(() => store.saveTask({ ...task, date: '2026-02-30' }), hasField('date'));
  assert.throws(() => store.saveTask({ ...task, time: '25:10' }), hasField('time'));
  assert.throws(() => store.saveTask({ ...task, category: 'other' }), /category/);
  store.deleteTask(task.id);
  assert.equal(store.getState().tasks.length, initial);
  assert.throws(() => store.toggleTask(task.id), /not be found/);
  const state = store.getState();
  state.tasks[0].title = 'mutated externally';
  assert.notEqual(store.getState().tasks[0].title, 'mutated externally');
});

test('tracks grocery purchases, recommends restored items, and prevents duplicates', () => {
  const { store } = fresh();
  store.demo();
  store.addGrocery('  Apples  ', '12');
  const item = store.getState().groceries.at(-1);
  assert.equal(item.name, 'Apples');
  assert.equal(item.quantity, 12);
  assert.throws(() => store.addGrocery('apples'), /already on/);
  store.editGrocery(item.id, 'Green apples');
  assert.equal(store.getState().groceries.at(-1).quantity, 12);
  store.editGrocery(item.id, 'Green apples', '5');
  store.purchaseGrocery(item.id);
  assert.equal(store.getState().groceries.length, 3);
  const purchase = store.getState().purchases[0];
  assert.equal(purchase.name, 'Green apples');
  assert.equal(purchase.quantity, 5);
  assert.ok(!Number.isNaN(Date.parse(purchase.purchasedAt)));
  store.restorePurchase(purchase.id);
  assert.equal(store.getState().groceries.at(-1).name, 'Green apples');
  assert.equal(store.getState().groceries.at(-1).quantity, 5);
  assert.notEqual(store.getState().groceries.at(-1).id, item.id);
  assert.equal(store.getState().purchases.length, 1);
  store.deleteGrocery(store.getState().groceries.at(-1).id);
  assert.equal(store.getState().groceries.length, 3);
  assert.throws(() => store.addGrocery('   '), /enter/);
});

test('persists grocery quantities through edits, purchases, and re-adding history', () => {
  let current = fresh();
  current.store.demo();
  current.store.addGrocery('Rice', 9999);
  const groceryId = current.store.getState().groceries.at(-1).id;
  current = fresh(current.values.get('parentech.v1'));
  assert.equal(current.store.getState().groceries.at(-1).quantity, 9999);
  current.store.editGrocery(groceryId, 'Brown rice', '3');
  current = fresh(current.values.get('parentech.v1'));
  assert.deepEqual(current.store.getState().groceries.at(-1), { id: groceryId, name: 'Brown rice', quantity: 3 });
  current.store.purchaseGrocery(groceryId);
  current = fresh(current.values.get('parentech.v1'));
  const purchase = current.store.getState().purchases[0];
  assert.equal(purchase.quantity, 3);
  assert.equal(current.store.getState().groceries.some(item => item.id === groceryId), false);
  current.store.restorePurchase(purchase.id);
  current = fresh(current.values.get('parentech.v1'));
  assert.equal(current.store.getState().groceries.at(-1).quantity, 3);
  assert.deepEqual(current.store.getState().purchases[0], purchase);
  current.store.addGrocery('Salt');
  assert.equal(current.store.getState().groceries.at(-1).quantity, 1);
});

test('rejects invalid quantities atomically when creating or editing a grocery', () => {
  const { store, values } = fresh();
  store.demo();
  store.addGrocery('Apples', 8);
  const item = store.getState().groceries.at(-1);
  for (const quantity of ['', ' ', 0, '0', -1, '-2', 1.5, '1.5', '1e2', 'abc', 10000, '10000', null, true, {}, [], Infinity, NaN]) {
    const before = store.getState(), saved = values.get('parentech.v1');
    assert.throws(() => store.addGrocery('Carrots', quantity), hasField('quantity'));
    assert.throws(() => store.editGrocery(item.id, 'Green apples', quantity), hasField('quantity'));
    assert.deepEqual(store.getState(), before);
    assert.equal(values.get('parentech.v1'), saved);
  }
  const before = store.getState(), saved = values.get('parentech.v1');
  assert.throws(() => store.editGrocery(item.id, ' ', 2), hasField('groceryName'));
  assert.throws(() => store.editGrocery(item.id, 'Milk', 2), hasField('groceryName'));
  assert.deepEqual(store.getState(), before);
  assert.equal(values.get('parentech.v1'), saved);
  store.editGrocery(item.id, 'Green apples', undefined);
  assert.equal(store.getState().groceries.at(-1).quantity, 8);
});

test('loads legacy and malformed grocery quantities as one without losing records', () => {
  const initial = fresh();
  initial.store.demo();
  const database = JSON.parse(initial.values.get('parentech.v1'));
  const storedQuantities = [undefined, 9999, '3', null, '', 0, -2, 1.5, '1e2', 'invalid', 10000, {}, []];
  const expected = [1, 9999, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  const data = database.accounts['parentech-demo'].data;
  data.groceries = storedQuantities.map((quantity, index) => ({ id: `grocery-${index}`, name: `Food ${index}`, quantity }));
  data.purchases = storedQuantities.map((quantity, index) => ({ id: `purchase-${index}`, name: `Purchased food ${index}`, quantity, purchasedAt: '2026-11-24T01:00:00Z' }));
  const restored = fresh(JSON.stringify(database));
  assert.deepEqual(restored.store.getState().groceries.map(item => item.quantity), expected);
  assert.deepEqual(restored.store.getState().purchases.map(item => item.quantity), expected);
  assert.deepEqual(restored.store.getState().groceries.map(item => item.id), data.groceries.map(item => item.id));
  assert.deepEqual(restored.store.getState().purchases.map(item => item.id), data.purchases.map(item => item.id));
  restored.store.restorePurchase('purchase-0');
  assert.equal(restored.store.getState().groceries.at(-1).quantity, 1);
  const migrated = JSON.parse(restored.values.get('parentech.v1')).accounts['parentech-demo'].data;
  assert.deepEqual(migrated.purchases.map(item => item.quantity), expected);
  migrated.groceries[0].quantity = 6;
  migrated.purchases[0].quantity = 4;
  database.accounts['parentech-demo'].data = migrated;
  restored.values.set('parentech.v1', JSON.stringify(database));
  const refreshed = restored.store.reloadFromStorage();
  assert.equal(refreshed.groceries[0].quantity, 6);
  assert.equal(refreshed.purchases[0].quantity, 4);
});

test('validates settings and profile changes while problem reports are confirmation-only', () => {
  const { store } = fresh();
  store.demo();
  store.updateSettings({ theme: 'dark', notifications: true });
  assert.deepEqual(store.getState().settings, { theme: 'dark', notifications: true });
  assert.throws(() => store.updateSettings({ theme: 'unknown' }), /light, dark, or system/);
  store.updateProfile({ name: 'New Name', phone: '+63 919 123 4567' });
  assert.equal(store.getState().user.name, 'New Name');
  assert.equal(store.getState().user.phone, '+639191234567');
  assert.throws(() => store.saveReport({ category: 'Bug / Crash', description: 'Task did not save.', email: 'invalid' }), /email/);
  store.saveReport({ category: 'Bug / Crash', description: 'Task did not save.', email: 'parent@example.com', screenshotName: 'screenshot.png' });
  assert.equal(store.getState().reports.length, 0);
  assert.throws(() => store.saveReport({ category: 'Bug / Crash', description: 'x'.repeat(501) }), /500/);
  store.logout();
  assert.equal(store.getState().user, null);
  assert.equal(store.getState().settings.theme, 'dark');
  assert.throws(() => store.addGrocery('Milk'), /log in/);
});

function hasField(field) {
  return error => error && error.name === 'ValidationError' && error.code === 'VALIDATION_ERROR' && typeof error.fields?.[field] === 'string';
}

test('rejects direct invalid writes before changing state or persisted data', async () => {
  const { store, values } = fresh();
  store.demo();
  const task = store.getState().tasks[0];
  const invalidWrites = [
    [() => store.saveTask({ title: 'No time', date: '2026-12-01', category: 'personal' }), 'time'],
    [() => store.saveTask({ ...task, title: 'Hidden\u0000character' }), 'title'],
    [() => store.saveTask({ ...task, description: 'Hidden\u0000character' }), 'description'],
    [() => store.saveTask({ ...task, id: '' }), 'id'],
    [() => store.saveTask({ ...task, id: 'bad" onclick="alert(1)' }), 'id'],
    [() => store.saveTask({ ...task, id: 'missing-task' }), 'id'],
    [() => store.updateProfile({ name: 'Parent\u0000Name' }), 'name'],
    [() => store.updateProfile(null), '_form'],
    [() => store.addGrocery('Milk\u0000hidden'), 'groceryName'],
    [() => store.saveReport({ category: 'Forged category', description: 'A detailed problem.' }), 'category'],
    [() => store.saveReport({ category: 'Other', description: '   ' }), 'description'],
    [() => store.saveReport({ category: 'Other', description: 'A detailed\u0000problem.' }), 'description'],
    [() => store.saveReport({ category: 'Other', description: 'A detailed problem.', email: 'a'.repeat(139) + '@example.com' }), 'email'],
    [() => store.saveReport({ category: 'Other', description: 'A detailed problem.', screenshotName: '../private.png' }), 'screenshotName'],
    [() => store.updateSettings({ theme: 'dark', notifications: 'false' }), 'notifications'],
    [() => store.updateSettings({ theme: 'invalid', notifications: true }), 'theme'],
    [() => store.toggleTask('bad"id'), 'id'],
    [() => store.deleteTask('missing-task'), 'id'],
    [() => store.editGrocery('missing-grocery', 'Fresh food'), 'id'],
    [() => store.purchaseGrocery('__proto__'), 'id'],
    [() => store.restorePurchase('missing-purchase'), 'id']
  ];
  for (const [write, field] of invalidWrites) {
    const beforeState = store.getState(), beforeSaved = values.get('parentech.v1');
    assert.throws(write, hasField(field), `Expected validation for ${field}`);
    assert.deepEqual(store.getState(), beforeState, `Rejected ${field} changed state`);
    assert.equal(values.get('parentech.v1'), beforeSaved, `Rejected ${field} changed persisted data`);
  }
  const before = values.get('parentech.v1');
  await assert.rejects(store.signup({ ...profile, name: 'Parent\u0000Name' }), hasField('name'));
  await assert.rejects(store.login({ phone: profile.phone, password: 'bad\u0000pass' }), hasField('password'));
  assert.equal(values.get('parentech.v1'), before);
});

test('keeps settings validation atomic for signed-in and signed-out callers', () => {
  const { store, values } = fresh();
  store.demo();
  store.updateSettings({ theme: 'light', notifications: false });
  for (const forged of ['false', 1, null, {}, []]) {
    const before = values.get('parentech.v1');
    assert.throws(() => store.updateSettings({ theme: 'dark', notifications: forged }), hasField('notifications'));
    assert.deepEqual(store.getState().settings, { theme: 'light', notifications: false });
    assert.equal(values.get('parentech.v1'), before);
  }
  store.logout();
  const before = values.get('parentech.v1');
  assert.throws(() => store.updateSettings({ theme: 'dark', notifications: 'true' }), hasField('notifications'));
  assert.equal(store.getState().settings.theme, 'light');
  assert.equal(values.get('parentech.v1'), before);
});

test('canonicalizes groceries and detects duplicates on create, edit, and restore', () => {
  const { store } = fresh();
  store.demo();
  store.addGrocery('  Café   beans  ');
  const item = store.getState().groceries.at(-1);
  assert.equal(item.name, 'Café beans');
  assert.throws(() => store.addGrocery('CAFE\u0301 beans'), hasField('groceryName'));
  store.editGrocery(item.id, '  Cafe\u0301   beans  ');
  assert.equal(store.getState().groceries.at(-1).name, 'Café beans');
  store.editGrocery(item.id, 'Café beans');
  const milk = store.getState().groceries.find(grocery => grocery.name === 'Milk');
  const beforeEdit = store.getState();
  assert.throws(() => store.editGrocery(milk.id, ' café   BEANS '), hasField('groceryName'));
  assert.deepEqual(store.getState(), beforeEdit);
  store.purchaseGrocery(item.id);
  const purchase = store.getState().purchases[0];
  store.addGrocery('Café beans');
  const beforeRestore = store.getState();
  assert.throws(() => store.restorePurchase(purchase.id), hasField('groceryName'));
  assert.deepEqual(store.getState(), beforeRestore);
});

test('enforces 128-character passwords and preserves existing salted credentials on rejection', async () => {
  const { store, values } = fresh();
  const accepted = 'Aa1' + 'x'.repeat(125);
  const account = await store.signup({ ...profile, password: accepted, confirmPassword: accepted });
  const saved = values.get('parentech.v1');
  const credentials = JSON.parse(saved).accounts[account.user.id].credentials;
  assert.equal(credentials.hash.length, 64);
  assert.ok(!saved.includes(accepted));
  store.logout();
  await store.login({ phone: profile.phone, password: accepted });
  const before = values.get('parentech.v1');
  const rejected = accepted + 'x';
  await assert.rejects(store.signup({ ...profile, phone: '0918 765 4321', password: rejected, confirmPassword: rejected }), hasField('password'));
  await assert.rejects(store.login({ phone: profile.phone, password: rejected }), hasField('password'));
  await assert.rejects(store.login({ phone: profile.phone, password: '' }), hasField('password'));
  assert.equal(values.get('parentech.v1'), before);
  assert.deepEqual(JSON.parse(before).accounts[account.user.id].credentials, credentials);
});

test('maps phone collisions to the phone field without applying partial profile changes', async () => {
  const { store, values } = fresh();
  await store.signup(profile);
  await store.signup({ ...profile, phone: '0918 123 4567', name: 'Another Parent' });
  const before = values.get('parentech.v1');
  await assert.rejects(store.signup(profile), hasField('phone'));
  assert.throws(() => store.updateProfile({ name: 'Changed Name', phone: profile.phone }), hasField('phone'));
  assert.equal(values.get('parentech.v1'), before);
  assert.equal(store.getState().user.name, 'Another Parent');
});

test('keeps existing accounts and reports readable without applying new write rules retroactively', async () => {
  const { store, values } = fresh();
  const account = await store.signup(profile);
  const saved = JSON.parse(values.get('parentech.v1'));
  const record = saved.accounts[account.user.id];
  const legacyPassword = 'olderpassword';
  const salt = Uint8Array.from(record.credentials.salt.match(/.{2}/g), byte => parseInt(byte, 16));
  const key = await global.crypto.subtle.importKey('raw', new TextEncoder().encode(legacyPassword), 'PBKDF2', false, ['deriveBits']);
  const bytes = await global.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: record.credentials.iterations }, key, 256);
  record.credentials.hash = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  record.profile.name = 'Legacy Parent 123';
  record.data.reports.push({ id: 'legacy-report', category: 'Tasks', description: 'Issue', email: '', screenshotName: '', createdAt: new Date().toISOString() });
  saved.sessionId = null;
  const restored = fresh(JSON.stringify(saved)).store;
  await restored.login({ phone: profile.phone, password: legacyPassword });
  assert.equal(restored.getState().user.name, 'Legacy Parent 123');
  assert.equal(restored.getState().reports[0].description, 'Issue');
  assert.equal(restored.getState().reports[0].category, 'Tasks');
  assert.throws(() => restored.saveReport({ category: 'Tasks', description: 'Issue' }), hasField('category'));
});

test('calculates age and remains usable with corrupted or unavailable storage', () => {
  const { store } = fresh('bad json');
  assert.equal(store.getState().user, null);
  const today = new Date();
  const birthThisMonth = `${today.getFullYear() - 20}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  assert.equal(store.getAge(birthThisMonth), 20);
  assert.equal(store.getAge('2001-02-30'), null);
  assert.equal(store.getAge('2099-01-01'), null);
  const savedDemo = fresh();
  savedDemo.store.demo();
  const corruptData = JSON.parse(savedDemo.values.get('parentech.v1'));
  corruptData.accounts['parentech-demo'].data.tasks.push(null, { title: 'Missing required fields' });
  corruptData.accounts['parentech-demo'].data.groceries.push(null);
  const repaired = fresh(JSON.stringify(corruptData)).store;
  assert.equal(repaired.getState().tasks.length, 3);
  assert.equal(repaired.getState().groceries.length, 3);
  const unavailable = fresh(null, true).store;
  unavailable.demo();
  unavailable.addGrocery('Saved for session');
  assert.equal(unavailable.getState().groceries.length, 4);
  assert.equal(unavailable.getStorageStatus().persistent, false);
});

test('reloads external browser changes and rejects IDs unsafe for HTML attributes', () => {
  const { store, values } = fresh();
  store.demo();
  store.saveTask({ title: 'x'.repeat(120), description: '', date: '2026-12-01', time: '09:00', category: 'personal' });
  assert.throws(() => store.saveTask({ title: 'x'.repeat(121), date: '2026-12-01', time: '09:00', category: 'personal' }), /120/);
  const changed = JSON.parse(values.get('parentech.v1'));
  const data = changed.accounts['parentech-demo'].data;
  data.groceries[0].name = 'Milk changed in another tab';
  data.tasks.push({ ...data.tasks[0], id: 'quote" onclick="alert(1)' });
  data.groceries.push({ id: '<script>', name: 'Unsafe ID' });
  data.purchases.push({ id: 'quote"', name: 'Unsafe purchase', purchasedAt: new Date().toISOString() });
  data.reports.push({ id: 'quote"', category: 'Other', description: 'Unsafe report ID' });
  values.set('parentech.v1', JSON.stringify(changed));
  assert.equal(store.getState().groceries[0].name, 'Milk');
  const refreshed = store.reloadFromStorage();
  assert.equal(refreshed.groceries[0].name, 'Milk changed in another tab');
  assert.equal(refreshed.tasks.length, 4);
  assert.equal(refreshed.groceries.length, 3);
  assert.equal(refreshed.purchases.length, 0);
  assert.equal(refreshed.reports.length, 0);
  values.delete('parentech.v1');
  assert.equal(store.reloadFromStorage().user, null);
  const memoryOnly = fresh(null, true).store;
  memoryOnly.demo();
  memoryOnly.addGrocery('Session stays usable');
  assert.equal(memoryOnly.reloadFromStorage().groceries.length, 4);
});

test('optional profile information, derived ages, photos and system theme persist per account', async () => {
  const { store, values } = fresh();
  const state = await store.signup({ name: 'Alex', phone: '0917 123 4567', role: 'Mom', password: profile.password, confirmPassword: profile.password });
  assert.equal(state.user.dob, ''); assert.equal(state.user.civilStatus, ''); assert.equal(state.user.age, null);
  store.updateProfile({ age: '27' });
  const photo = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
  store.updateProfilePhoto(photo); store.updateSettings({ theme: 'system' });
  const restored = fresh(values.get('parentech.v1')).store;
  assert.equal(restored.getState().user.age, null); assert.equal(restored.getState().user.photo, photo); assert.equal(restored.getState().settings.theme, 'system');
  const before = restored.getState();
  assert.throws(() => restored.updateProfilePhoto('data:image/svg+xml;base64,PHN2Zy8+'), hasField('photo'));
  assert.deepEqual(restored.getState(), before);
  restored.updateProfile({ age: '', dob: '', civilStatus: '' });
  assert.equal(restored.getState().user.age, null);
});

test('refreshes DOB age on birthdays and ignores saved ages without losing profiles or organizer records', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 23, 23, 59) });
  const { store, values } = fresh();
  store.demo();
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  store.updateProfile({ name: 'Birthday Parent', dob: '2000-11-24', age: 99, photo });
  store.addGrocery('Rice', 8);
  store.purchaseGrocery(store.getState().groceries.at(-1).id);
  const before = store.getState(), saved = values.get('parentech.v1');
  assert.equal(before.user.age, 25);
  t.mock.timers.setTime(new Date(2026, 10, 24).getTime());
  const birthday = store.getState();
  assert.equal(birthday.user.age, 26);
  assert.equal(values.get('parentech.v1'), saved, 'Reading a birthday age does not rewrite storage');
  assert.deepEqual({ ...birthday, user: { ...birthday.user, age: 25 } }, before);
  const database = JSON.parse(saved);
  database.accounts['parentech-demo'].profile.age = 'stale manual age';
  const restored = fresh(JSON.stringify(database));
  assert.equal(restored.store.getState().user.age, 26);
  assert.equal(restored.store.getState().user.name, 'Birthday Parent');
  assert.equal(restored.store.getState().user.photo, photo);
  assert.deepEqual(restored.store.getState().purchases, before.purchases);
  assert.equal(restored.store.updateProfile({ age: 5 }).user.age, 26);
  assert.equal(restored.store.updateProfile({ dob: '2001-11-24' }).user.age, 25);
  assert.equal(restored.store.getState().user.photo, photo);
  database.accounts['parentech-demo'].profile.dob = '';
  const missingDOB = fresh(JSON.stringify(database));
  assert.equal(missingDOB.store.getState().user.age, null);
  assert.equal(missingDOB.store.getState().user.photo, photo);
  assert.deepEqual(missingDOB.store.getState().purchases, before.purchases);
});

test('profile streak counts view dates and grocery statistics count purchase days rather than items', async () => {
  const { store, values } = fresh();
  store.demo();
  store.recordProfileView('2026-11-22'); store.recordProfileView('2026-11-23'); store.recordProfileView('2026-11-24'); store.recordProfileView('2026-11-24');
  assert.equal(store.getState().profileViews.length, 3);
  assert.equal(store.getProfileStreak('2026-11-24'), 3);
  assert.equal(store.getProfileStreak('2026-11-25'), 3);
  assert.equal(store.getProfileStreak('2026-11-26'), 0);
  store.toggleTask(store.getState().tasks[0].id);
  assert.equal(store.getProfileStreak('2026-11-24'), 3);
  const database = JSON.parse(values.get('parentech.v1'));
  database.accounts['parentech-demo'].data.purchases = [
    { id: 'one', name: 'Milk', purchasedAt: '2026-11-24T01:00:00Z' },
    { id: 'two', name: 'Eggs', purchasedAt: '2026-11-24T05:00:00Z' },
    { id: 'three', name: 'Bread', purchasedAt: '2026-11-25T10:00:00Z' }
  ];
  const restored = fresh(JSON.stringify(database)).store;
  assert.equal(restored.getProfileStreak('2026-11-24'), 3);
  assert.equal(restored.getGroceryDayCount(), 2);
  await restored.signup({ ...profile, phone: '0918 123 4567' });
  assert.equal(restored.getProfileStreak('2026-11-24'), 0); assert.equal(restored.getGroceryDayCount(), 0);
});

test('new reports confirm without saving while earlier report records remain untouched', () => {
  const { store, values } = fresh(); store.demo();
  const database = JSON.parse(values.get('parentech.v1'));
  database.accounts['parentech-demo'].data.reports = [{ id: 'earlier-report', category: 'Tasks', description: 'Earlier details.' }];
  const restored = fresh(JSON.stringify(database));
  const before = restored.values.get('parentech.v1');
  restored.store.saveReport({ category: 'UI Issue', description: 'x' });
  assert.equal(restored.store.getState().reports.length, 1);
  assert.equal(restored.store.getState().reports[0].description, 'Earlier details.');
  assert.equal(restored.values.get('parentech.v1'), before);
});
