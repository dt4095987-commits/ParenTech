(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PTStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';

  const validation = typeof module === 'object' && module.exports ? (function () {
    try { return require('../../../shared/validation.js'); }
    catch (_) { return require('../shared/validation.js'); }
  })() : root.PTValidation;
  if (!validation || typeof validation.assert !== 'function') throw new Error('Load validation.js before domain.js.');

  const STORAGE_KEY = 'parentech.v1';
  const CATEGORIES = ['personal', 'family', 'household', 'pill'];
  const ROLES = ['Mom', 'Dad', 'Solo Parent'];
  const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced', 'Separated', 'Civil Partnership'];
  const DEFAULT_SETTINGS = { theme: 'light', notifications: false };
  const DEMO_ID = 'parentech-demo';
  const browserProtocol = root.location && root.location.protocol;
  const remote = typeof root.fetch === 'function' && ['http:', 'https:'].includes(browserProtocol);
  const fileMode = browserProtocol === 'file:';
  let authenticatedUser = null, demoActive = false, initPromise = null, migrationWarning = '', authVersion = 0;
  let authController = null;
  let storage = null;
  let persistent = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function emptyData() {
    return { tasks: [], groceries: [], purchases: [], settings: { ...DEFAULT_SETTINGS }, reports: [], profileViews: [] };
  }
  function emptyDatabase() {
    return { version: 1, accounts: {}, sessionId: null, defaultSettings: { ...DEFAULT_SETTINGS }, serverMigrationComplete: false };
  }
  function uid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function localDate(date = new Date()) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return year >= 1900 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  function validId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
  }
  function timestamp(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
  }
  function storedGroceryQuantity(value) {
    try { return validation.normalizeGroceryQuantity(value); }
    catch (_) { return 1; }
  }
  function invalid(field, message) { throw new validation.ValidationError({ [field]: message }); }
  function assertId(id, label = 'item') {
    if (!validation.isValidId(id)) invalid('id', 'Choose a valid ' + label + '.');
    return id;
  }
  function profileValues(values) {
    const { name, phone, dob, civilStatus, role } = values;
    return { name, phone, dob: dob || '', civilStatus: civilStatus || '', role, age: getAge(dob), photo: values.photo || '' };
  }
  function storedProfileValues(value, id) {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 80 || /[\u0000-\u001f\u007f-\u009f]/.test(value.name)) return null;
    const result = validation.check('profile', { ...value, name: 'Stored Parent' });
    if (!result.valid) return null;
    return { id, ...profileValues(result.values), name: value.name.trim() };
  }
  function getAge(dob) {
    return validation.ageFromDOB(dob, localDate());
  }
  function loadDatabase() {
    let parsed;
    try {
      storage = root.localStorage || null;
      if (!storage) return emptyDatabase();
      const raw = storage.getItem(STORAGE_KEY);
      persistent = true;
      if (!raw) return emptyDatabase();
      parsed = JSON.parse(raw);
    } catch (_) {
      // A denied storage read or malformed data must not prevent using the app.
      if (!storage) persistent = false;
      return emptyDatabase();
    }
    if (!parsed || parsed.version !== 1 || !parsed.accounts || typeof parsed.accounts !== 'object' || Array.isArray(parsed.accounts)) return emptyDatabase();
    const database = emptyDatabase();
    Object.keys(parsed.accounts).forEach(id => {
      if (!validId(id)) return;
      const account = parsed.accounts[id];
      if (!account || !account.profile || account.profile.id !== id || !account.data || !Array.isArray(account.data.tasks) || !Array.isArray(account.data.groceries) || !Array.isArray(account.data.purchases)) return;
      const profile = storedProfileValues(account.profile, id);
      if (!profile) return;
      if (account.credentials && (!/^[a-f0-9]{32}$/.test(account.credentials.salt) || !/^[a-f0-9]{64}$/.test(account.credentials.hash))) return;
      const data = { tasks: account.data.tasks, groceries: account.data.groceries, purchases: account.data.purchases, settings: account.data.settings || { ...DEFAULT_SETTINGS }, reports: account.data.reports || [], profileViews: account.data.profileViews || [] };
      data.tasks = data.tasks.filter(item => item && validId(item.id) && typeof item.title === 'string' && item.title.trim() && item.title.length <= 120 && validDate(item.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) && CATEGORIES.includes(item.category)).map(item => ({ id: item.id, title: item.title, description: typeof item.description === 'string' ? item.description.slice(0, 500) : '', date: item.date, time: item.time, category: item.category, completed: Boolean(item.completed), notifiedAt: timestamp(item.notifiedAt), createdAt: timestamp(item.createdAt), completedAt: timestamp(item.completedAt) }));
      data.groceries = data.groceries.filter(item => item && validId(item.id) && typeof item.name === 'string' && item.name.trim() && item.name.length <= 100).map(item => ({ id: item.id, name: item.name, quantity: storedGroceryQuantity(item.quantity) }));
      data.purchases = data.purchases.filter(item => item && validId(item.id) && typeof item.name === 'string' && item.name.trim() && item.name.length <= 100 && timestamp(item.purchasedAt)).map(item => ({ id: item.id, name: item.name, quantity: storedGroceryQuantity(item.quantity), purchasedAt: item.purchasedAt }));
      data.settings = { theme: data.settings.theme, notifications: data.settings.notifications };
      data.settings.theme = ['light', 'dark', 'system'].includes(data.settings.theme) ? data.settings.theme : 'light';
      data.settings.notifications = Boolean(data.settings.notifications);
      data.reports = Array.isArray(data.reports) ? data.reports.filter(item => item && validId(item.id) && typeof item.description === 'string').map(item => ({ id: item.id, category: typeof item.category === 'string' ? item.category.slice(0, 60) : 'Other', description: item.description.slice(0, 500), email: typeof item.email === 'string' ? item.email.slice(0, 254) : '', screenshotName: typeof item.screenshotName === 'string' ? item.screenshotName.slice(0, 255) : '', createdAt: timestamp(item.createdAt) })) : [];
      data.profileViews = Array.isArray(data.profileViews) ? [...new Set(data.profileViews.filter(validDate))] : [];
      const credentials = account.credentials ? { salt: account.credentials.salt, hash: account.credentials.hash, iterations: Number.isInteger(account.credentials.iterations) && account.credentials.iterations >= 100000 && account.credentials.iterations <= 1000000 ? account.credentials.iterations : 100000 } : null;
      database.accounts[id] = { profile, credentials, data };
      if (validId(account.serverId)) database.accounts[id].serverId = account.serverId;
    });
    database.sessionId = Object.prototype.hasOwnProperty.call(database.accounts, parsed.sessionId) ? parsed.sessionId : null;
    database.defaultSettings.theme = parsed.defaultSettings && ['light', 'dark', 'system'].includes(parsed.defaultSettings.theme) ? parsed.defaultSettings.theme : 'light';
    database.serverMigrationComplete = parsed.serverMigrationComplete === true;
    return database;
  }
  let db = loadDatabase();
  // A cached browser profile is not proof of a server session.
  if (remote || fileMode) db.sessionId = null;
  function persist() {
    if (!storage) { persistent = false; return; }
    try { storage.setItem(STORAGE_KEY, JSON.stringify(db)); persistent = true; }
    catch (_) { persistent = false; }
  }
  function account() {
    const current = db.sessionId && db.accounts[db.sessionId];
    if (!current || (remote && !demoActive && authenticatedUser?.id !== db.sessionId)) invalid('_form', 'Please log in to continue.');
    return current;
  }
  function getState() {
    const activeId = remote && !demoActive ? authenticatedUser?.id : db.sessionId;
    const current = activeId && db.accounts[activeId];
    if (!current) return { user: null, ...emptyData(), settings: clone(db.defaultSettings) };
    return clone({ user: { ...current.profile, age: getAge(current.profile.dob) }, ...current.data });
  }
  function finish() { persist(); return getState(); }
  function requireServer() {
    const error = new Error('Start ParenTech with npm start and open http://localhost:5173 to use saved accounts.');
    error.code = 'SERVER_REQUIRED';
    throw error;
  }
  async function request(path, method = 'GET', body, expectedAccountId, signal) {
    let response;
    try {
      const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
      if (signal) options.signal = signal;
      if (expectedAccountId) options.headers['X-PT-Account'] = expectedAccountId;
      if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
      response = await root.fetch('/api/accounts/' + path, options);
    } catch (failure) {
      if (signal?.aborted || failure?.name === 'AbortError') throw changedSession();
      const error = new Error('Cannot reach the local account server. Start ParenTech with npm start and try again.');
      error.code = 'SERVER_UNAVAILABLE';
      throw error;
    }
    let payload;
    try { payload = await response.json(); }
    catch (_) { if (signal?.aborted) throw changedSession(); const error = new Error('The account server returned an unreadable response.'); error.code = 'INVALID_SERVER_RESPONSE'; throw error; }
    if (!response.ok) {
      const fields = payload && payload.fields && typeof payload.fields === 'object' && !Array.isArray(payload.fields) ? payload.fields : null;
      const error = fields && Object.keys(fields).length ? new validation.ValidationError(fields) : new Error(payload?.message || 'The account request failed.');
      if (payload && typeof payload.code === 'string') error.code = payload.code;
      else error.code = 'HTTP_' + response.status;
      if (payload && typeof payload.message === 'string') error.message = payload.message;
      throw error;
    }
    return payload;
  }
  function publicProfile(user) {
    const profile = user && validId(user.id) && user.id !== DEMO_ID ? storedProfileValues(user, user.id) : null;
    if (!profile) {
      const error = new Error('The account server returned an invalid account profile.'); error.code = 'INVALID_SERVER_RESPONSE'; throw error;
    }
    return profile;
  }
  function mergeData(primary, additional) {
    const result = clone(primary || emptyData());
    for (const key of ['tasks', 'groceries', 'purchases', 'reports']) {
      const ids = new Set(result[key].map(item => item.id));
      for (const item of additional[key]) if (!ids.has(item.id)) { result[key].push(clone(item)); ids.add(item.id); }
    }
    result.profileViews = [...new Set([...(result.profileViews || []), ...(additional.profileViews || [])])];
    return result;
  }
  function cacheServerUser(value, sessionChange = true) {
    const user = publicProfile(value);
    const previous = db.accounts[user.id];
    const matches = Object.values(db.accounts).filter(item => item.profile.id !== DEMO_ID && item.profile.id !== user.id && (item.profile.phone === user.phone || item.serverId === user.id));
    let data = previous ? clone(previous.data) : matches.length ? clone(matches[0].data) : emptyData();
    if (!previous && !matches.length) data.settings.theme = db.defaultSettings.theme;
    for (const match of matches) if (!previous || match.serverId !== user.id) data = mergeData(data, match.data);
    // Keep legacy profiles and organizer records; the server id becomes the active data key.
    for (const match of matches) match.serverId = user.id;
    db.accounts[user.id] = { profile: user, credentials: previous?.credentials || null, data };
    if (sessionChange) authVersion++;
    authenticatedUser = user; demoActive = false; db.sessionId = user.id;
    return finish();
  }
  async function migrateLegacyAccounts() {
    const records = Object.values(db.accounts).filter(item => item.profile.id !== DEMO_ID && item.credentials).map(item => ({ id: item.profile.id, profile: profileValues(item.profile), credentials: { ...item.credentials } }));
    for (let offset = 0; offset < records.length; offset += 100) {
      const accounts = records.slice(offset, offset + 100);
      const result = await request('import', 'POST', { accounts });
      if (!Number.isInteger(result?.imported) || !Number.isInteger(result?.skipped) || result.imported < 0 || result.skipped < 0 || result.imported + result.skipped !== accounts.length) {
        const error = new Error('The account server did not confirm the legacy account transfer.'); error.code = 'INVALID_SERVER_RESPONSE'; throw error;
      }
    }
    // Storage events may have replaced db while the transfer was in flight.
    // Remove only the credential versions that the server acknowledged.
    for (const record of records) {
      const current = db.accounts[record.id];
      if (current && current.profile.phone === record.profile.phone && current.credentials && ['salt', 'hash', 'iterations'].every(key => current.credentials[key] === record.credentials[key])) current.credentials = null;
    }
    db.serverMigrationComplete = !Object.values(db.accounts).some(item => item.profile.id !== DEMO_ID && item.credentials);
    migrationWarning = ''; persist();
  }
  async function init() {
    if (!remote) return getState();
    if (initPromise) return initPromise;
    const version = authVersion;
    initPromise = (async () => {
      try { await migrateLegacyAccounts(); }
      catch (error) { migrationWarning = 'Existing browser accounts could not be transferred: ' + error.message; throw error; }
      if (version !== authVersion) return getState();
      const result = await request('session');
      if (version !== authVersion) return getState();
      if (result?.user === null) { if (authenticatedUser || demoActive || db.sessionId !== null) authVersion++; authenticatedUser = null; demoActive = false; db.sessionId = null; return finish(); }
      return cacheServerUser(result?.user, demoActive || authenticatedUser?.id !== result?.user?.id);
    })();
    try { return await initPromise; } finally { initPromise = null; }
  }
  function phoneTaken(phone, excludingId) {
    return Object.values(db.accounts).some(a => a.profile.id !== DEMO_ID && a.profile.id !== excludingId && a.profile.phone === phone);
  }
  function cryptoApi() {
    if (!root.crypto || !root.crypto.subtle || !root.crypto.getRandomValues) throw new Error('Secure account storage is unavailable in this browser. Open the app at localhost or use the demo.');
    return root.crypto;
  }
  function hex(bytes) { return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join(''); }
  function fromHex(value) { return Uint8Array.from(value.match(/.{2}/g) || [], byte => parseInt(byte, 16)); }
  async function passwordHash(password, salt, iterations = 100000) {
    const crypto = cryptoApi();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(salt), iterations }, key, 256);
    return hex(new Uint8Array(bytes));
  }
  async function signup(input) {
    const values = validation.assert('signup', input);
    if (fileMode) requireServer();
    if (remote) {
      return authenticate('signup', { ...profileValues(values), password: values.password, confirmPassword: values.confirmPassword });
    }
    const profile = profileValues(values), password = values.password;
    if (phoneTaken(profile.phone)) invalid('phone', 'An account with this phone number already exists. Please log in.');
    const salt = hex(cryptoApi().getRandomValues(new Uint8Array(16)));
    const hash = await passwordHash(password, salt);
    if (phoneTaken(profile.phone)) invalid('phone', 'An account with this phone number already exists. Please log in.');
    const id = uid();
    db.accounts[id] = { profile: { id, ...profile }, credentials: { salt, hash, iterations: 100000 }, data: emptyData() };
    db.accounts[id].data.settings.theme = db.defaultSettings.theme;
    db.sessionId = id;
    return finish();
  }
  async function login(input) {
    const { phone, password } = validation.assert('login', input);
    if (fileMode) requireServer();
    if (remote) return authenticate('login', { phone, password });
    const target = Object.values(db.accounts).find(a => a.profile.id !== DEMO_ID && a.profile.phone === phone);
    if (!target) invalid('phone', 'No account is registered with this phone number. Please sign up.');
    if (!target.credentials) requireServer();
    const hash = await passwordHash(password, target.credentials.salt, target.credentials.iterations || 100000);
    if (hash !== target.credentials.hash) invalid('password', 'The password is incorrect. Please try again.');
    db.sessionId = target.profile.id;
    return finish();
  }
  function demo() {
    authVersion++;
    if (!db.accounts[DEMO_ID]) {
      const today = localDate();
      const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = localDate(tomorrowDate);
      const demoData = emptyData();
      demoData.settings.theme = db.defaultSettings.theme;
      demoData.tasks = [
        { id: uid(), title: 'Plan this week’s meals', description: 'A little planning makes busy evenings easier.', date: today, time: '17:00', category: 'household', completed: false, notifiedAt: null, createdAt: new Date().toISOString(), completedAt: null },
        { id: uid(), title: 'Family walk', description: 'Some fresh air and time together.', date: today, time: '18:00', category: 'family', completed: false, notifiedAt: null, createdAt: new Date().toISOString(), completedAt: null },
        { id: uid(), title: 'Take daily vitamins', description: 'Follow the instructions on your supplement.', date: tomorrow, time: '08:00', category: 'pill', completed: false, notifiedAt: null, createdAt: new Date().toISOString(), completedAt: null }
      ];
      demoData.groceries = ['Milk', 'Bananas', 'Eggs'].map(name => ({ id: uid(), name, quantity: 1 }));
      db.accounts[DEMO_ID] = { profile: { id: DEMO_ID, name: 'Alex Morgan', phone: '+639171234567', dob: '1994-06-15', civilStatus: 'Married', role: 'Mom', age: getAge('1994-06-15'), photo: '' }, credentials: null, data: demoData };
    }
    db.sessionId = DEMO_ID;
    demoActive = true;
    return finish();
  }
  function logout() {
    if (remote) {
      const intent = beginAuthIntent();
      return request('logout', 'POST', {}, undefined, intent.controller?.signal).then(result => {
        if (intent.version !== authVersion) throw changedSession();
        if (result?.user !== null) { const error = new Error('The account server did not confirm logout.'); error.code = 'INVALID_SERVER_RESPONSE'; throw error; }
        return clearSession();
      }).finally(() => finishAuthIntent(intent));
    }
    return clearSession();
  }
  function clearSession() {
    authVersion++;
    const current = db.sessionId && db.accounts[db.sessionId];
    if (current) db.defaultSettings.theme = current.data.settings.theme;
    db.sessionId = null;
    authenticatedUser = null; demoActive = false;
    return finish();
  }
  function updateProfile(input) {
    const current = account();
    if (!input || typeof input !== 'object' || Array.isArray(input)) validation.assert('profile', input);
    const profile = profileValues(validation.assert('profile', { ...current.profile, ...input }));
    if (fileMode && current.profile.id !== DEMO_ID) requireServer();
    if (remote && current.profile.id !== DEMO_ID) {
      const edits = {};
      for (const field of ['name', 'phone', 'dob', 'civilStatus', 'role', 'photo']) if (Object.prototype.hasOwnProperty.call(input, field)) edits[field] = profile[field];
      return updateServerProfile(current.profile.id, edits);
    }
    if (phoneTaken(profile.phone, current.profile.id)) invalid('phone', 'That phone number is already used by another account.');
    current.profile = { id: current.profile.id, ...profile };
    return finish();
  }
  function saveTask(input) {
    const current = account();
    const values = validation.assert('task', input);
    const { title, description, date, time, category, id } = values;
    const index = id ? current.data.tasks.findIndex(task => task.id === id) : -1;
    if (id && index < 0) invalid('id', 'This task could not be found.');
    const previous = index >= 0 ? current.data.tasks[index] : null;
    const unchangedTime = previous && previous.date === date && previous.time === time;
    const task = { id: previous ? previous.id : uid(), title, description, date, time, category, completed: previous ? previous.completed : false, notifiedAt: unchangedTime ? previous.notifiedAt : null, createdAt: previous ? previous.createdAt : new Date().toISOString(), completedAt: previous ? previous.completedAt : null };
    if (index >= 0) current.data.tasks[index] = task;
    else current.data.tasks.push(task);
    return finish();
  }
  function findTask(id) {
    assertId(id, 'task');
    const task = account().data.tasks.find(item => item.id === id);
    if (!task) invalid('id', 'This task could not be found.');
    return task;
  }
  function toggleTask(id) { const task = findTask(id); task.completed = !task.completed; task.completedAt = task.completed ? new Date().toISOString() : null; return finish(); }
  function deleteTask(id) { findTask(id); const current = account(); current.data.tasks = current.data.tasks.filter(task => task.id !== id); return finish(); }
  function markNotified(id) { findTask(id).notifiedAt = new Date().toISOString(); return finish(); }
  function groceryValues(value, quantity, excludingId) {
    const current = account();
    const values = validation.assert('grocery', { groceryName: value, quantity }, { groceries: current.data.groceries, excludeId: excludingId });
    return { name: values.groceryName, quantity: values.quantity };
  }
  function findGrocery(id) {
    assertId(id, 'grocery item');
    const item = account().data.groceries.find(item => item.id === id);
    if (!item) invalid('id', 'This grocery item could not be found.');
    return item;
  }
  function addGrocery(value, quantity = 1) { const values = groceryValues(value, quantity); account().data.groceries.push({ id: uid(), ...values }); return finish(); }
  function editGrocery(id, value, quantity) {
    const item = findGrocery(id);
    const values = groceryValues(value, quantity === undefined ? item.quantity : quantity, id);
    Object.assign(item, values);
    return finish();
  }
  function deleteGrocery(id) { findGrocery(id); const current = account(); current.data.groceries = current.data.groceries.filter(item => item.id !== id); return finish(); }
  function purchaseGrocery(id) {
    const current = account();
    const item = findGrocery(id);
    current.data.purchases.unshift({ id: uid(), name: item.name, quantity: item.quantity, purchasedAt: new Date().toISOString() });
    current.data.groceries = current.data.groceries.filter(item => item.id !== id);
    return finish();
  }
  function restorePurchase(id) {
    assertId(id, 'purchased item');
    const item = account().data.purchases.find(item => item.id === id);
    if (!item) invalid('id', 'This purchased item could not be found.');
    return addGrocery(item.name, item.quantity);
  }
  function updateSettings(input) {
    const values = validation.assert('settings', input);
    const settings = db.sessionId ? account().data.settings : db.defaultSettings;
    if (Object.prototype.hasOwnProperty.call(values, 'theme')) {
      settings.theme = values.theme;
      db.defaultSettings.theme = values.theme;
    }
    if (Object.prototype.hasOwnProperty.call(values, 'notifications')) settings.notifications = values.notifications;
    return finish();
  }
  function saveReport(input) {
    validation.assert('report', input);
    account();
    return getState();
  }
  function updateProfilePhoto(photo) {
    const error = validation.validateProfilePhoto(photo);
    if (error) invalid('photo', error);
    const current = account();
    if (remote && !demoActive) return updateServerProfile(current.profile.id, { photo: photo || '' });
    current.profile.photo = photo || '';
    return finish();
  }
  function changedSession() {
    const error = new validation.ValidationError({ _form: 'Your signed-in account has changed. Refresh your account and try again.' });
    error.code = 'SESSION_CHANGED';
    return error;
  }
  function beginAuthIntent() {
    authVersion++;
    if (authController) authController.abort();
    const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    authController = controller;
    return { version: authVersion, controller };
  }
  function finishAuthIntent(intent) { if (authController === intent.controller) authController = null; }
  async function authenticate(path, values) {
    const intent = beginAuthIntent();
    try {
      const result = await request(path, 'POST', values, undefined, intent.controller?.signal);
      if (intent.version !== authVersion) throw changedSession();
      return cacheServerUser(result?.user);
    } finally { finishAuthIntent(intent); }
  }
  function updateServerProfile(expectedId, edits) {
    const version = authVersion;
    return request('profile', 'PATCH', edits, expectedId).then(result => {
      if (version !== authVersion || demoActive || authenticatedUser?.id !== expectedId || db.sessionId !== expectedId || result?.user?.id !== expectedId) throw changedSession();
      return cacheServerUser(result.user, false);
    });
  }
  function recordProfileView(date = localDate()) {
    if (!validDate(date)) invalid('date', 'Choose a valid profile view date.');
    const data = account().data;
    if (!data.profileViews.includes(date)) { data.profileViews.push(date); return finish(); }
    return getState();
  }
  function getProfileStreak(date = localDate()) {
    if (!validDate(date)) return 0;
    const days = new Set(account().data.profileViews);
    const current = new Date(`${date}T12:00:00`);
    if (!days.has(localDate(current))) current.setDate(current.getDate() - 1);
    let count = 0;
    while (days.has(localDate(current))) { count++; current.setDate(current.getDate() - 1); }
    return count;
  }
  function getGroceryDayCount() {
    return new Set(account().data.purchases.map(item => localDate(new Date(item.purchasedAt)))).size;
  }
  function getStorageStatus() {
    const accountMode = remote ? 'server' : fileMode ? 'file' : 'offline';
    const message = remote ? 'Accounts are saved in the local JSON file. ' + (persistent ? 'Organizer data is saved in this browser.' : 'Organizer changes last for this session only.') : fileMode ? 'Start the local server to use saved accounts. Organizer data stays in this browser.' : persistent ? 'Your changes are saved in this browser.' : 'Browser storage is unavailable. Changes will last for this session only.';
    return { persistent, accountMode, message, migrationWarning };
  }
  function reloadFromStorage() {
    if (!storage || !persistent) return getState();
    try { storage.getItem(STORAGE_KEY); }
    catch (_) { persistent = false; return getState(); }
    db = loadDatabase();
    if (remote) {
      db.sessionId = demoActive && db.accounts[DEMO_ID] ? DEMO_ID : authenticatedUser && db.accounts[authenticatedUser.id] ? authenticatedUser.id : null;
    } else if (fileMode && !demoActive) db.sessionId = null;
    return getState();
  }

  return Object.freeze({ isRemote: remote, init, getState, signup, login, demo, logout, updateProfile, updateProfilePhoto, recordProfileView, getProfileStreak, getGroceryDayCount, saveTask, toggleTask, deleteTask, addGrocery, editGrocery, purchaseGrocery, restorePurchase, deleteGrocery, updateSettings, saveReport, markNotified, getAge, getStorageStatus, reloadFromStorage });
});
