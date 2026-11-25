'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../shared/validation.js');
const parent = { name: 'Alex Morgan', phone: '0917 123 4567', dob: '2000-02-29', civilStatus: 'Single', role: 'Mom' };
const signup = { ...parent, password: ' GoodPass123 ', confirmPassword: ' GoodPass123 ' };
const task = { title: 'Dental appointment', description: '', date: '2026-11-24', time: '09:00', category: 'personal' };

test('supports diverse names, normalizes spacing and computes age from an actual date', () => {
  const cases = ['王明', 'Nguyễn Thị Ánh', 'O’Connor', 'Jean-Luc Picard', 'D. María', 'Søren', 'سارة', 'Madonna'];
  for (const name of cases) assert.equal(validation.check('profile', { ...parent, name }, { today: '2026-11-24' }).valid, true, name);
  const normalized = validation.assert('profile', { ...parent, name: '  Jose\u0301   O’Connor  ' }, { today: '2026-02-28' });
  assert.equal(normalized.name, 'José O’Connor');
  assert.equal(normalized.age, 25);
  assert.equal(validation.assert('profile', parent, { today: '2026-03-01' }).age, 26);
  assert.equal(validation.assert('profile', { ...parent, dob: '2026-11-24' }, { today: '2026-11-24' }).age, 0);
  for (const name of ['', '   ', 'Parent123', '<b>Parent</b>', 'A\nB', 'A\u0000B', '---']) assert.equal(validation.check('profile', { ...parent, name }).valid, false, JSON.stringify(name));
  assert.equal(validation.check('profile', { ...parent, name: 'A'.repeat(80) }).valid, true);
  assert.equal(validation.check('profile', { ...parent, name: 'A'.repeat(81) }).valid, false);
});

test('validates strict leap-year dates without banning past tasks', () => {
  for (const value of ['1900-01-01', '2000-02-29', '2024-02-29', '9999-12-31']) assert.equal(validation.isValidDate(value), true, value);
  for (const value of ['1899-12-31', '1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-1-01', '2026-01-01T00:00:00', '0000-01-01']) assert.equal(validation.isValidDate(value), false, value);
  assert.equal(validation.check('profile', { ...parent, dob: '2026-11-25' }, { today: '2026-11-24' }).valid, false);
  assert.equal(validation.check('task', { ...task, date: '1900-01-01' }).valid, true);
  assert.equal(validation.ageFromDOB('2099-01-01', '2026-11-24'), null);
});

test('increments age on the birthday and uses the existing leap-day boundary', () => {
  assert.equal(validation.ageFromDOB('2000-11-24', '2026-11-23'), 25);
  assert.equal(validation.ageFromDOB('2000-11-24', '2026-11-24'), 26);
  assert.equal(validation.ageFromDOB('2000-11-24', '2026-11-25'), 26);
  assert.equal(validation.ageFromDOB('2000-02-29', '2024-02-28'), 23);
  assert.equal(validation.ageFromDOB('2000-02-29', '2024-02-29'), 24);
  assert.equal(validation.ageFromDOB('2000-02-29', '2026-02-28'), 25);
  assert.equal(validation.ageFromDOB('2000-02-29', '2026-03-01'), 26);
});

test('normalizes Philippine phone forms and rejects letters, controls and unbounded raw input', () => {
  for (const phone of ['+639171234567', '639171234567', '09171234567', '9171234567', '+63 (917) 123-4567', '0917.123.4567']) assert.equal(validation.normalizePhone(phone), '+639171234567');
  for (const phone of ['abc09171234567', '0917123456', '+64171234567', '+639171234567\n', 'x'.repeat(41), ' '.repeat(40) + '09171234567', 9171234567]) assert.equal(validation.check('login', { phone, password: 'x' }).valid, false, String(phone));
});

test('preserves password spaces and applies strength only at sign-up', () => {
  const values = validation.assert('signup', signup);
  assert.equal(values.password, ' GoodPass123 ');
  assert.equal(values.confirmPassword, ' GoodPass123 ');
  assert.equal(validation.check('login', { phone: parent.phone, password: 'x' }).valid, true);
  assert.equal(validation.check('login', { phone: parent.phone, password: ' ' }).valid, true);
  assert.equal(validation.check('signup', { ...signup, password: 'Password1', confirmPassword: 'Password2' }).errors.confirmPassword, 'Your passwords do not match.');
  for (const password of ['short1A', 'lowercase1', 'UPPERCASE', '', 'A123456\n', 'A1' + 'x'.repeat(127)]) assert.equal(validation.check('signup', { ...signup, password, confirmPassword: password }).valid, false, JSON.stringify(password));
  assert.equal(validation.check('signup', { ...signup, password: 'A1' + 'x'.repeat(126), confirmPassword: 'A1' + 'x'.repeat(126) }).valid, true);
  assert.equal(validation.check('signup', { ...signup, password: 'Äbcdefg1', confirmPassword: 'Äbcdefg1' }).valid, true);
});

test('returns field errors and whitelisted values, resisting tampered enums and mass assignment', () => {
  const values = validation.assert('signup', { ...signup, admin: true, credentials: { hash: 'forged' }, tasks: ['forged'], id: 'forged' });
  assert.deepEqual(Object.keys(values).sort(), ['age', 'civilStatus', 'confirmPassword', 'dob', 'name', 'password', 'phone', 'photo', 'role']);
  assert.equal(values.admin, undefined);
  for (const input of [null, [], 'text', 123]) assert.equal(validation.check('signup', input).valid, false);
  assert.equal(validation.check('profile', { ...parent, civilStatus: 'Unknown', role: 'Admin' }).valid, false);
  const invalid = validation.check('task', { ...task, category: 'constructor', time: '24:00' });
  assert.deepEqual(Object.keys(invalid.errors), ['time', 'category']);
  assert.throws(() => validation.assert('task', { ...task, title: ' ' }), error => error instanceof validation.ValidationError && error.code === 'VALIDATION_ERROR' && Boolean(error.fields.title));
  assert.deepEqual(validation.assert('settings', { theme: 'dark', notifications: false, admin: true }), { theme: 'dark', notifications: false });
  for (const input of [{ notifications: 'true' }, { notifications: 1 }, { notifications: null }, { theme: 'purple' }, { admin: true }]) assert.equal(validation.check('settings', input).valid, false);
});

test('validates task boundaries, required time, optional IDs and multiline descriptions', () => {
  assert.equal(validation.check('task', { ...task, title: 'x'.repeat(120), description: 'x'.repeat(500), id: '550e8400-e29b-41d4-a716-446655440000' }).valid, true);
  for (const input of [{ title: 'x'.repeat(121) }, { description: 'x'.repeat(501) }, { time: '' }, { time: '9:00' }, { time: '09:60' }, { id: '' }, { id: 'quote" onclick="alert(1)' }, { id: '__proto__' }]) assert.equal(validation.check('task', { ...task, ...input }).valid, false, JSON.stringify(input));
  assert.equal(validation.check('task', { ...task, description: 'Line one\nLine two\twith details' }).valid, true);
  assert.equal(validation.check('task', { ...task, description: 'Invalid\u0007bell' }).valid, false);
  const values = validation.assert('task', { ...task, title: ' <script>literal task</script> ', completed: true, createdAt: 'forged' });
  assert.equal(values.title, '<script>literal task</script>');
  assert.equal(values.completed, undefined);
  assert.equal(values.createdAt, undefined);
});

test('normalizes grocery names, allows quantities and literal markup, and checks duplicate context', () => {
  assert.deepEqual(validation.assert('grocery', { name: '  2\ttrays   of\n eggs  ' }), { groceryName: '2 trays of eggs', quantity: 1 });
  assert.equal(validation.assert('grocery', { groceryName: '1/2 kg 苹果 – fresh' }).groceryName, '1/2 kg 苹果 – fresh');
  assert.equal(validation.assert('grocery', { groceryName: '<script>literal label</script>' }).groceryName, '<script>literal label</script>');
  assert.equal(validation.check('grocery', { groceryName: 'x'.repeat(100) }).valid, true);
  for (const groceryName of ['', '   ', 'x'.repeat(101), 'Milk\u0000']) assert.equal(validation.check('grocery', { groceryName }).valid, false);
  const context = { groceries: [{ id: 'one', name: ' Café   Milk ' }] };
  assert.equal(validation.check('grocery', { groceryName: 'Cafe\u0301 milk' }, context).valid, false);
  assert.equal(validation.check('grocery', { groceryName: 'CAFÉ MILK' }, { ...context, excludeId: 'one' }).valid, true);
  assert.equal(validation.check('grocery', { groceryName: 'Milk' }, { groceries: ['milk'] }).valid, false);
});

test('defaults omitted grocery quantities and normalizes whole numbers within the supported range', () => {
  assert.equal(validation.LIMITS.groceryQuantity, 9999);
  assert.deepEqual(validation.assert('grocery', { name: 'Milk' }), { groceryName: 'Milk', quantity: 1 });
  assert.deepEqual(validation.assert('grocery', { groceryName: 'Milk', quantity: undefined }), { groceryName: 'Milk', quantity: 1 });
  for (const [quantity, expected] of [[1, 1], [9999, 9999], ['1', 1], ['23', 23], ['9999', 9999], [' 2 ', 2]]) {
    const values = validation.assert('grocery', { name: ' Milk ', quantity, purchasedAt: 'forged', id: 'forged' });
    assert.deepEqual(values, { groceryName: 'Milk', quantity: expected });
    assert.equal(Number.isInteger(values.quantity), true);
  }
});

test('rejects explicit invalid grocery quantities with a quantity field error', () => {
  const rejected = ['', '   ', 0, '0', -1, '-1', 1.5, '1.5', '1.0', '1e2', '1E2', 'two', '2 eggs', true, false, null, {}, [], [2], Infinity, NaN, 10000, '10000'];
  for (const quantity of rejected) {
    const result = validation.check('grocery', { name: 'Milk', quantity });
    assert.equal(result.valid, false, String(quantity));
    assert.deepEqual(Object.keys(result.errors), ['quantity'], String(quantity));
    assert.throws(() => validation.assert('grocery', { name: 'Milk', quantity }), error => error instanceof validation.ValidationError && error.code === 'VALIDATION_ERROR' && typeof error.fields.quantity === 'string');
  }
  const result = validation.check('grocery', { name: ' ', quantity: 0 });
  assert.equal(typeof result.errors.groceryName, 'string');
  assert.equal(typeof result.errors.quantity, 'string');
});

test('keeps duplicate grocery names invalid when quantities differ', () => {
  const context = { groceries: [{ id: 'one', name: 'Milk', quantity: 2 }] };
  const duplicate = validation.check('grocery', { name: ' milk ', quantity: 3 }, context);
  assert.equal(duplicate.valid, false);
  assert.equal(typeof duplicate.errors.groceryName, 'string');
  assert.deepEqual(validation.assert('grocery', { name: ' milk ', quantity: 3 }, { ...context, excludeId: 'one' }), { groceryName: 'milk', quantity: 3 });
});

test('validates report category, nonblank description, bounded email and filename metadata', () => {
  const report = { category: 'Bug / Crash', description: 'Task did not save.', email: ' Parent+plans@EXAMPLE.COM ', screenshotName: ' screenshot.png ' };
  assert.deepEqual(validation.assert('report', report), { category: 'Bug / Crash', description: 'Task did not save.', email: 'Parent+plans@example.com', screenshotName: 'screenshot.png' });
  assert.equal(validation.check('report', { category: 'Other', description: 'x'.repeat(10) }).valid, true);
  assert.equal(validation.check('report', { category: 'Other', description: 'x'.repeat(500) }).valid, true);
  for (const input of [{ category: 'Fake category' }, { description: '  ' }, { description: 'x'.repeat(501) }, { email: 'user\r\n@example.com' }, { email: 'user@localhost' }, { email: 'user..name@example.com' }, { email: 'user@-bad.example' }, { email: 'x'.repeat(65) + '@example.com' }, { email: 'user@exam ple.com' }, { screenshotName: '../screenshot.png' }, { screenshotName: 'C:\\screenshot.png' }, { screenshotName: '\nscreenshot.png' }, { screenshotName: 'screenshot.png\r' }, { screenshotName: 'x'.repeat(256) }]) assert.equal(validation.check('report', { ...report, ...input }).valid, false, JSON.stringify(input));
  const email150 = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(21)}`;
  assert.equal(email150.length, 150);
  assert.equal(validation.check('report', { ...report, email: email150 }).valid, true);
  assert.equal(validation.check('report', { ...report, email: email150 + 'c' }).valid, false);
});

test('checks screenshot MIME, extension, exact 10 MB boundary and valid file metadata', () => {
  for (const file of [{ name: 'image.PNG', type: 'image/png', size: 1 }, { name: 'image.jpeg', type: 'image/jpeg', size: 10 * 1024 * 1024 }, { name: 'image.webp', type: 'image/webp', size: 100 }]) assert.equal(validation.validateScreenshot(file), '');
  assert.equal(validation.validateScreenshot(undefined), '');
  for (const file of [{ name: 'image.png', type: 'image/jpeg', size: 1 }, { name: 'image.gif', type: 'image/gif', size: 1 }, { name: '../image.png', type: 'image/png', size: 1 }, { name: 'image.png', type: 'image/png', size: 0 }, { name: 'image.png', type: 'image/png', size: -1 }, { name: 'image.png', type: 'image/png', size: 1.5 }, { name: 'image.png', type: 'image/png', size: '10' }, { name: 'image.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 }, {}, [], 'file']) assert.notEqual(validation.validateScreenshot(file), '', JSON.stringify(file));
});

test('rejects raw filename controls before trimming both report and file metadata', () => {
  for (const name of ['\nimage.png', 'image.png\r', '\timage.png', 'image\u0000.png']) {
    assert.match(validation.validateScreenshot({ name, type: 'image/png', size: 1 }), /control characters/);
    const report = validation.check('report', { category: 'Other', description: 'A useful report.', screenshotName: name });
    assert.equal(report.valid, false);
    assert.match(report.errors.screenshotName, /control characters/);
  }
  assert.equal(validation.validateScreenshot({ name: ' image.png ', type: 'image/png', size: 1 }), '');
  assert.equal(validation.assert('report', { category: 'Other', description: 'A useful report.', screenshotName: ' image.png ' }).screenshotName, 'image.png');
});

test('allows optional personal information, system theme and the documented report categories', () => {
  const minimal = { name: 'Alex', phone: '+639171234567', role: 'Mom', password: 'FamilyPlan123', confirmPassword: 'FamilyPlan123' };
  const values = validation.assert('signup', minimal);
  assert.equal(values.dob, ''); assert.equal(values.civilStatus, ''); assert.equal(values.age, null); assert.equal(values.photo, '');
  assert.deepEqual(validation.assert('settings', { theme: 'system' }), { theme: 'system' });
  assert.deepEqual(validation.REPORT_CATEGORIES, ['Bug / Crash', 'Feature Request', 'UI Issue', 'Account Issue', 'Other']);
  for (const category of validation.REPORT_CATEGORIES) assert.equal(validation.check('report', { category, description: 'x' }).valid, true);
  assert.equal(validation.check('report', { category: 'Tasks & reminders', description: 'A valid description.' }).valid, false);
});

test('derives profile and signup age exclusively from DOB and ignores submitted age', () => {
  const context = { today: '2026-11-24' };
  for (const age of [undefined, null, '', 0, 150, -1, 151, 1.5, '27', '20 years', true, {}, []]) {
    assert.equal(validation.assert('profile', { ...parent, age }, context).age, 26);
    assert.equal(validation.assert('signup', { ...signup, age }, context).age, 26);
    for (const dob of [undefined, null, '']) assert.equal(validation.assert('profile', { ...parent, dob, age }, context).age, null);
  }
  for (const dob of ['2001-02-30', '2026-11-25']) {
    const result = validation.check('profile', { ...parent, dob, age: 26 }, context);
    assert.equal(result.valid, false);
    assert.equal(typeof result.errors.dob, 'string');
    assert.equal(result.values.age, null);
  }
});

test('validates profile photo data URLs, decoded size, allowed MIME and matching signatures', () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const photo = 'data:image/png;base64,' + png.toString('base64');
  assert.equal(validation.validateProfilePhoto(photo), '');
  assert.equal(validation.assert('profile', { ...parent, photo }).photo, photo);
  assert.equal(validation.validateProfilePhoto('data:image/jpeg;base64,' + Buffer.from([255, 216, 255]).toString('base64')), '');
  assert.equal(validation.validateProfilePhoto('data:image/webp;base64,' + Buffer.from('RIFF1234WEBP').toString('base64')), '');
  for (const value of ['https://example.com/photo.png', 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64'), 'data:image/jpeg;base64,' + png.toString('base64'), 'data:image/png;base64,invalid?', {}, 'data:image/png;base64,AAAA=']) assert.notEqual(validation.validateProfilePhoto(value), '');
  const exact = Buffer.alloc(validation.LIMITS.profilePhotoBytes); png.copy(exact);
  assert.equal(validation.validateProfilePhoto('data:image/png;base64,' + exact.toString('base64')), '');
  const over = Buffer.alloc(validation.LIMITS.profilePhotoBytes + 1); png.copy(over);
  assert.match(validation.validateProfilePhoto('data:image/png;base64,' + over.toString('base64')), /2 MB/);
});
