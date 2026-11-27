'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const rootPath = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(rootPath, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const validation = require('../shared/validation.js');
const parent = { id: 'web-parent', name: 'Web Parent', phone: '+639191234567', dob: '', civilStatus: '', role: 'Dad', age: null, photo: '' };
const validSignup = { name: 'New Parent', phone: '9191234567', dob: '', civilStatus: '', role: 'Solo Parent', age: '', password: 'FamilyPlan123', confirmPassword: 'FamilyPlan123' };
const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, async json() { return value; } });

// This deliberately small DOM executes the actual pages and browser scripts.
// It models the selectors, form controls and bubbling events used by this app;
// it does not model CSS layout, browser notifications or image decoding.
function makeDOM(html) {
  const pending = [], failures = [];
  let document;
  const decode = text => String(text).replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ' })[value]);
  const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class Event {
    constructor(type, options = {}) { this.type = type; this.bubbles = options.bubbles ?? true; this.cancelable = true; this.defaultPrevented = false; Object.assign(this, options); }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
  }
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.dataset = {}; this.listeners = new Map();
      this.parentElement = null; this.style = {}; this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; this._text = ''; this._html = '';
      this.selectionStart = 0; this.selectionEnd = 0; this.files = []; this.inert = false;
      const classes = new Set();
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); } });
      this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name), toggle: (name, forced) => { const next = forced ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); return next; } };
    }
    get id() { return this.attributes.get('id') || ''; }
    set id(value) { this.attributes.set('id', String(value)); }
    get name() { return this.attributes.get('name') || ''; }
    set name(value) { this.attributes.set('name', String(value)); }
    get type() { return this.attributes.get('type') || (this.tagName === 'BUTTON' ? 'submit' : ''); }
    set type(value) { this.attributes.set('type', String(value)); }
    get isConnected() { for (let node = this; node; node = node.parentElement) if (node === document) return true; return false; }
    get nextElementSibling() { const siblings = this.parentElement?.children || []; return siblings[siblings.indexOf(this) + 1] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this._html = String(value); this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
    get innerHTML() { return this._html; }
    set innerHTML(value) { this._html = String(value); this._text = ''; this.children.forEach(child => { child.parentElement = null; }); this.children = []; parse(this._html, this); }
    get elements() { const fields = this.querySelectorAll('input, select, textarea, button'); fields.namedItem = name => fields.find(field => field.name === name) || null; fields.forEach(field => { if (field.name) fields[field.name] = field; }); return fields; }
    setAttribute(name, value) {
      value = String(value); this.attributes.set(name, value);
      if (name === 'class') this.className = value;
      if (name === 'value') this.value = value;
      if (name === 'hidden') this.hidden = true;
      if (name === 'disabled') this.disabled = true;
      if (name === 'checked') this.checked = true;
      if (name.startsWith('data-')) this.dataset[dataKey(name)] = value;
    }
    getAttribute(name) { if (name === 'class') return this.className; if (name === 'hidden') return this.hidden ? '' : null; if (name === 'disabled') return this.disabled ? '' : null; if (name.startsWith('data-')) return this.dataset[dataKey(name)] ?? null; return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'hidden') this.hidden = false; if (name === 'disabled') this.disabled = false; if (name.startsWith('data-')) delete this.dataset[dataKey(name)]; }
    append(...nodes) { nodes.forEach(node => { if (typeof node === 'string') this._text += node; else { node.parentElement = this; this.children.push(node); } }); }
    appendChild(node) { this.append(node); return node; }
    prepend(node) { node.parentElement = this; this.children.unshift(node); }
    after(node) { const siblings = this.parentElement?.children; if (!siblings) return; node.parentElement = this.parentElement; siblings.splice(siblings.indexOf(this) + 1, 0, node); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    contains(node) { return node === this || this.descendants().includes(node); }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    reset() { this.querySelectorAll('input, textarea, select').forEach(field => { field.value = field.getAttribute('value') || ''; }); }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener)); }
    dispatchEvent(event) {
      event.target ||= this;
      for (let node = this; node; node = event.bubbles && !event.stopped ? node.parentElement : null) {
        event.currentTarget = node;
        for (const listener of node.listeners.get(event.type) || []) {
          try { const result = listener.call(node, event); if (result?.then) pending.push(Promise.resolve(result).catch(error => failures.push(error))); }
          catch (error) { failures.push(error); }
        }
      }
      return !event.defaultPrevented;
    }
    click() { this.dispatchEvent(new Event('click')); }
    matches(selector) { return splitSelectors(selector).some(part => matchesChain(this, part)); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) { return this.descendants().filter(node => node.matches(selector)); }
  }
  function splitSelectors(selector) { return selector.split(/,(?![^\[]*\])/).map(part => part.trim()).filter(Boolean); }
  function matchesSimple(node, selector) {
    const exclusions = [...selector.matchAll(/:not\(([^)]+)\)/g)];
    if (exclusions.some(match => matchesSimple(node, match[1]))) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    if (selector.includes(':checked') && !node.checked) return false;
    selector = selector.replace(/:checked/g, '');
    const tag = selector.match(/^[a-zA-Z][\w-]*/);
    if (tag && node.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
    const id = selector.match(/#([\w-]+)/); if (id && node.id !== id[1]) return false;
    if ([...selector.matchAll(/\.([\w-]+)/g)].some(match => !node.classList.contains(match[1]))) return false;
    return [...selector.matchAll(/\[([^\]=\s]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)].every(match => {
      const value = node.getAttribute(match[1]); const expected = match[2] ?? match[3] ?? match[4];
      return expected === undefined ? value !== null : value === expected;
    });
  }
  function matchesChain(node, selector) {
    const parts = selector.split(/\s+(?![^\[]*\])(?![^\(]*\))/);
    if (!matchesSimple(node, parts.pop())) return false;
    for (let part = parts.pop(); part; part = parts.pop()) {
      node = node.parentElement;
      while (node && !matchesSimple(node, part)) node = node.parentElement;
      if (!node) return false;
    }
    return true;
  }
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  function parse(source, host) {
    const stack = [host];
    for (const token of source.match(/<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('<!')) continue;
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (!token.startsWith('<')) { stack.at(-1)._text += decode(token); continue; }
      const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
      const element = new Element(tag);
      for (const match of token.slice(tag.length + 1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) element.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
      stack.at(-1).append(element);
      if (!voidTags.has(tag.toLowerCase()) && !token.endsWith('/>')) stack.push(element);
    }
    for (const select of host.querySelectorAll('select')) select.value = select.querySelector('option[selected]')?.getAttribute('value') ?? select.querySelector('option')?.getAttribute('value') ?? '';
    for (const textarea of host.querySelectorAll('textarea')) textarea.value = textarea.textContent.trim();
  }
  document = new Element('document'); parse(html, document);
  document.documentElement = document.querySelector('html'); document.body = document.querySelector('body'); document.activeElement = document.body;
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.descendants().find(node => node.id === id) || null;
  document.readyState = 'loading'; document.visibilityState = 'visible';
  async function drain() {
    for (let round = 0; round < 4; round++) { await Promise.all(pending.splice(0)); await new Promise(resolve => setImmediate(resolve)); }
    if (failures.length) throw failures.shift();
  }
  async function fire(target, type, options = {}) { assert.ok(target, `Missing target for ${type}`); target.dispatchEvent(new Event(type, options)); await drain(); }
  return { document, Event, Element, fire, drain };
}

async function browser(page, { user = null, saved, respond, search = '' } = {}) {
  const file = page === 'index.html' ? 'frontend/index.html' : `frontend/pages/${page}`;
  const dom = makeDOM(read(file));
  const storage = new Map(saved ? [['parentech.v1', typeof saved === 'string' ? saved : JSON.stringify(saved)]] : []);
  const requests = [], timers = new Map(), errors = [];
  let currentUser = user ? plain(user) : null, timerId = 0;
  const windowListeners = new Map();
  const location = { protocol: 'http:', pathname: page === 'index.html' ? '/index.html' : '/pages/' + page, search, hash: '', href: 'http://localhost:5173/' + (page === 'index.html' ? '' : 'pages/') + page + search, assign(value) { this.href = value; }, replace(value) { this.href = value; } };
  const sandbox = {
    ...dom, location, crypto: webcrypto, TextEncoder, URL, URLSearchParams, AbortController,
    history: { replaceState(_state, _title, url) { const parsed = new URL(String(url), location.href); location.href = parsed.href; location.pathname = parsed.pathname; location.search = parsed.search; location.hash = parsed.hash; } },
    console: { error: (...values) => errors.push(values), warn() {}, log() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearInterval: id => timers.delete(id),
    requestAnimationFrame: callback => callback(), matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {},
    addEventListener(type, listener) { if (!windowListeners.has(type)) windowListeners.set(type, []); windowListeners.get(type).push(listener); },
    FileReader: class { readAsDataURL(file) { this.result = file.data; queueMicrotask(() => this.onload()); } },
    Image: class { constructor() { this.naturalWidth = 1; this.naturalHeight = 1; } set src(value) { this.source = value; queueMicrotask(() => this.onload()); } get src() { return this.source; } },
    async fetch(url, options = {}) {
      const request = { url, ...options, body: options.body ? JSON.parse(options.body) : undefined }; requests.push(request);
      const intercepted = await respond?.(request, requests); if (intercepted) return intercepted;
      if (url.endsWith('/session')) return reply({ user: currentUser });
      if (url.endsWith('/logout')) { currentUser = null; return reply({ user: null }); }
      if (url.endsWith('/signup')) { currentUser = { id: 'new-web-parent', ...validation.assert('signup', request.body) }; delete currentUser.password; delete currentUser.confirmPassword; currentUser.age = validation.ageFromDOB(currentUser.dob); currentUser.photo = ''; return reply({ user: currentUser }, 201); }
      if (url.endsWith('/login')) { currentUser = plain(parent); return reply({ user: currentUser }); }
      if (url.endsWith('/profile')) { currentUser = { ...currentUser, ...request.body }; currentUser.age = validation.ageFromDOB(currentUser.dob); return reply({ user: currentUser }); }
      throw new Error('Unexpected API request: ' + url);
    }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  for (const name of ['shared/validation.js', 'frontend/assets/js/domain.js', 'frontend/assets/js/auth.js', 'frontend/assets/js/main.js']) vm.runInContext(read(name), context, { filename: name });
  await dom.fire(dom.document, 'DOMContentLoaded', { bubbles: false });
  assert.deepEqual(errors, [], 'Page bootstrap completes without script errors');
  const byId = id => dom.document.getElementById(id);
  const setForm = (id, values) => { const form = byId(id); assert.ok(form, id); for (const [name, value] of Object.entries(values)) { const field = form.querySelector(`[name="${name}"]`); assert.ok(field, `${id}.${name}`); field.value = value; field.setSelectionRange(String(value).length, String(value).length); } return form; };
  return { ...dom, byId, setForm, requests, storage, errors, timers, location, store: sandbox.PTStore, app: sandbox.ParenTechApp, auth: sandbox.PTWebAuth };
}

test('new pages load shared validation, account client, auth and main in order without inline JavaScript or staged credentials', () => {
  const files = ['index.html', ...fs.readdirSync(path.join(rootPath, 'frontend/pages')).filter(name => name.endsWith('.html')).map(name => 'pages/' + name)];
  for (const file of files) {
    const html = read('frontend/' + file);
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, file);
    assert.doesNotMatch(html, /\s+on[a-z]+\s*=/i, file);
    const scripts = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => new URL(match[1], 'http://localhost/' + file).pathname);
    assert.deepEqual(scripts, ['/shared/validation.js', '/domain.js', '/assets/js/auth.js', '/assets/js/main.js'], file);
    assert.doesNotMatch(html, /type=["']password["'][^>]*value=["'][^"']+/i, file);
  }
  assert.doesNotMatch(read('frontend/assets/js/main.js'), /Ronaliza|parentech_(?:tasks|groceries|pills|user)/);
});

test('new app waits for the remote session and gates organizer pages without trusting a cached user', async () => {
  const stale = { version: 1, sessionId: parent.id, accounts: { [parent.id]: { profile: parent, credentials: null, data: { tasks: [], groceries: [], purchases: [], settings: { theme: 'light', notifications: false } } } }, defaultSettings: { theme: 'light', notifications: false }, serverMigrationComplete: true };
  const signedOut = await browser('home.html', { saved: stale });
  assert.equal(signedOut.store.getState().user, null);
  assert.match(signedOut.location.href, /(?:^|\/)index\.html$/);
  assert.equal(signedOut.requests.filter(request => request.url.endsWith('/session')).length, 1);
  const signedIn = await browser('index.html', { user: parent });
  assert.match(signedIn.location.href, /pages\/home\.html$/);
  assert.equal(signedIn.requests.filter(request => request.url.endsWith('/session')).length, 1);
});

test('signup validation blocks API writes and valid signup sends normalized account details', async () => {
  const web = await browser('signup.html');
  const form = web.setForm('signupForm', { ...validSignup, name: 'Parent123', phone: '123', password: 'weak', confirmPassword: 'different' });
  await web.fire(form, 'submit');
  assert.equal(web.requests.filter(request => request.url.endsWith('/signup')).length, 0);
  for (const name of ['name', 'phone', 'password', 'confirmPassword']) assert.equal(form.querySelector(`[name="${name}"]`).getAttribute('aria-invalid'), 'true', name);
  web.setForm('signupForm', validSignup); await web.fire(form, 'submit');
  const request = web.requests.find(request => request.url.endsWith('/signup'));
  assert.ok(request); assert.equal(request.method, 'POST'); assert.equal(request.credentials, 'same-origin');
  assert.equal(request.headers['Content-Type'], 'application/json'); assert.equal(request.body.phone, '+639191234567'); assert.equal(request.body.role, 'Solo Parent');
  assert.equal(request.body.dob, ''); assert.equal(request.body.civilStatus, '');
  assert.equal(web.store.getState().user.name, 'New Parent'); assert.equal(web.location.href, 'home.html');
  assert.equal(web.byId('signupSubmitBtn').disabled, false);
  assert.ok(!web.storage.get('parentech.v1').includes(validSignup.password), 'Signup does not cache plaintext credentials');
});

test('failed login remains signed out and renders the server field error', async () => {
  const web = await browser('index.html', { respond: request => request.url.endsWith('/login') ? reply({ code: 'INVALID_CREDENTIALS', message: 'The password is incorrect.', fields: { password: 'The password is incorrect.' } }, 401) : null });
  const originalURL = web.location.href;
  const form = web.setForm('loginForm', { phone: '9191234567', password: 'WrongPassword123' }); await web.fire(form, 'submit');
  assert.equal(web.store.getState().user, null); assert.equal(web.location.href, originalURL);
  assert.match(form.querySelector('[data-error-field="password"]').textContent, /incorrect/);
  assert.equal(form.querySelector('[name="password"]').getAttribute('aria-invalid'), 'true');
  assert.equal(web.byId('loginSubmitBtn').disabled, false); assert.equal(form.getAttribute('aria-busy'), 'false');
});

test('profile edits render the signed-in user and send a PATCH bound to that account', async () => {
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const web = await browser('profile.html', { user: { ...parent, photo } });
  assert.equal(web.byId('profileUserName').textContent, parent.name); assert.equal(web.byId('profileUserPhone').textContent, parent.phone);
  await web.fire(web.byId('editProfileBtn'), 'click');
  const form = web.setForm('editProfileForm', { name: 'Updated Parent', phone: '9191234567', dob: '2000-11-24', civilStatus: 'Single', role: 'Mom' });
  await web.fire(form, 'submit');
  const request = web.requests.find(request => request.url.endsWith('/profile'));
  assert.ok(request); assert.equal(request.method, 'PATCH'); assert.equal(request.headers['X-PT-Account'], parent.id);
  assert.equal(request.body.phone, parent.phone); assert.equal(request.body.name, 'Updated Parent');
  assert.ok(!Object.hasOwn(request.body, 'age')); assert.ok(!Object.hasOwn(request.body, 'photo'));
  assert.equal(web.byId('profileUserName').textContent, 'Updated Parent'); assert.equal(web.store.getState().user.id, parent.id);
  assert.equal(web.store.getState().user.photo, photo, 'A profile-details edit preserves the existing photo');
  assert.equal(web.byId('editProfileModal').classList.contains('active'), false);
});

test('logout requires confirmation and ends the server session before returning to login', async () => {
  const web = await browser('home.html', { user: parent });
  await web.fire(web.document.querySelector('[data-action="logout"]'), 'click');
  assert.equal(web.byId('logoutConfirmModal').classList.contains('active'), true);
  assert.equal(web.requests.filter(request => request.url.endsWith('/logout')).length, 0);
  await web.fire(web.document.querySelector('[data-action="confirm-logout"]'), 'click');
  assert.equal(web.requests.filter(request => request.url.endsWith('/logout')).length, 1);
  assert.equal(web.store.getState().user, null); assert.match(web.location.href, /index\.html$/);
});

test('task forms use the selected category and current date, and completion updates the shared account store', async () => {
  const web = await browser('tasks.html', { user: parent });
  await web.fire(web.document.querySelector('[data-filter="family"]'), 'click');
  await web.fire(web.byId('fabAddTaskBtn'), 'click');
  assert.equal(web.byId('newTaskModal').classList.contains('active'), true);
  assert.equal(web.document.querySelector('.cat-picker-item.active').dataset.category, 'family');
  assert.equal(web.byId('modalTaskDate').value, validation.localDay());
  assert.match(web.byId('modalTaskTime').value, /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/);
  web.byId('aiSmartTaskPrompt').value = 'MLBB event dec 12, 2026, 4pm, pill reminder';
  await web.fire(web.byId('aiSmartFillBtn'), 'click');
  assert.equal(web.byId('modalTaskTitle').value, 'MLBB event');
  assert.equal(web.byId('modalTaskDate').value, '2026-12-12');
  assert.equal(web.byId('modalTaskTime').value, '4:00 PM');
  assert.equal(web.document.querySelector('.cat-picker-item.active').dataset.category, 'pill');
  web.byId('aiSmartTaskPrompt').value = 'MLBB, event dec 12, 2026 at 4pm';
  await web.fire(web.byId('aiSmartFillBtn'), 'click');
  assert.equal(web.byId('modalTaskTitle').value, 'MLBB, event');
  assert.equal(web.byId('modalTaskDate').value, '2026-12-12');
  assert.equal(web.byId('modalTaskTime').value, '4:00 PM');
  assert.equal(web.document.querySelector('.cat-picker-item.active').dataset.category, 'pill');
  web.byId('aiSmartTaskPrompt').value = 'School program 15 Jan 2027 9am';
  await web.fire(web.byId('aiSmartFillBtn'), 'click');
  assert.equal(web.byId('modalTaskDate').value, '2027-01-15');
  assert.equal(web.byId('modalTaskTime').value, '9:00 AM');
  web.byId('timePickerInput').value = '15:59';
  await web.fire(web.byId('confirmTimePickerBtn'), 'click');
  assert.equal(web.byId('modalTaskTime').value, '3:59 PM');
  web.byId('modalTaskDate').value = validation.localDay();
  web.byId('modalTaskTitle').value = 'Prepare family dinner'; web.byId('modalTaskDesc').value = 'Vegetables and rice';
  await web.fire(web.byId('newTaskForm'), 'submit');
  let tasks = plain(web.store.getState().tasks);
  assert.equal(tasks.length, 1); assert.equal(tasks[0].category, 'family'); assert.equal(tasks[0].date, validation.localDay());
  assert.equal(tasks[0].description, 'Vegetables and rice'); assert.equal(tasks[0].completed, false);
  await web.fire(web.byId('tasksListContainer').querySelector(`[data-action="toggle-task"][data-id="${tasks[0].id}"]`), 'click');
  tasks = plain(web.store.getState().tasks); assert.equal(tasks[0].completed, true);
  const saved = JSON.parse(web.storage.get('parentech.v1'));
  assert.equal(saved.accounts[parent.id].data.tasks[0].completed, true);
  assert.equal(web.location.search, '?category=family');
  const reopened = await browser('tasks.html', { user: parent, saved, search: web.location.search });
  assert.equal(reopened.app.currentTaskFilter, 'family');
  assert.equal(reopened.document.querySelector('.task-filter-pill.active').dataset.filter, 'family');
  assert.match(reopened.byId('tasksListContainer').textContent, /Prepare family dinner/);
});

test('medication reminders are shared pill-category tasks with current date and preserved dosage', async () => {
  const web = await browser('pills.html', { user: parent });
  await web.fire(web.document.querySelector('[data-action="new-pill"]'), 'click');
  assert.equal(web.byId('addPillModal').classList.contains('active'), true);
  assert.equal(web.byId('pillDateInput').value, validation.localDay()); assert.match(web.byId('pillTimeInput').value, /^\d{2}:\d{2}$/);
  const form = web.setForm('addPillForm', { title: 'Calcium', description: '500 mg', time: '09:00', date: validation.localDay() });
  await web.fire(form, 'submit');
  const task = web.store.getState().tasks[0];
  assert.ok(task); assert.equal(task.category, 'pill'); assert.equal(task.title, 'Calcium'); assert.equal(task.description, '500 mg');
  await web.fire(web.byId('pillsListContainer').querySelector(`[data-action="toggle-task"][data-id="${task.id}"]`), 'click');
  assert.equal(web.store.getState().tasks[0].completed, true);
});

test('grocery quantity validation and purchase/re-add preserve the account item quantity and history', async () => {
  const web = await browser('grocery.html', { user: parent });
  const form = web.setForm('addGroceryForm', { groceryName: 'Eggs', quantity: '1.5' }); await web.fire(form, 'submit');
  assert.equal(web.store.getState().groceries.length, 0, 'Fractional quantities must not create groceries');
  web.setForm('addGroceryForm', { groceryName: 'Eggs', quantity: '3' }); await web.fire(form, 'submit');
  const grocery = web.store.getState().groceries[0]; assert.ok(grocery); assert.equal(grocery.quantity, 3);
  await web.fire(web.byId('groceryListContainer').querySelector(`[data-action="purchase-grocery"][data-id="${grocery.id}"]`), 'click');
  let state = web.store.getState(); assert.equal(state.groceries.length, 0); assert.equal(state.purchases.length, 1); assert.equal(state.purchases[0].quantity, 3);
  await web.fire(web.byId('groceryRecentlyPurchased').querySelector(`[data-action="restore-purchase"][data-id="${state.purchases[0].id}"]`), 'click');
  state = web.store.getState(); assert.equal(state.groceries.length, 1); assert.equal(state.groceries[0].name, 'Eggs'); assert.equal(state.groceries[0].quantity, 3);
  assert.equal(state.purchases.length, 1, 'Re-adding keeps the purchase history');
  assert.ok(![...web.storage.keys()].some(key => /^parentech_(tasks|groceries|pills|user)$/.test(key)), 'The new UI uses the established per-account storage');
});

test('calendar selection sets the new event date and generated day controls complete the stored event', async () => {
  const web = await browser('calendar.html', { user: parent });
  assert.equal(web.app.selectedCalendarDate, validation.localDay());
  const nextDay = new Date(); nextDay.setDate(nextDay.getDate() + 1);
  const date = validation.localDay(nextDay);
  await web.fire(web.byId('calendarDaysGrid').querySelector(`[data-action="calendar-select"][data-date="${date}"]`), 'click');
  assert.equal(web.app.selectedCalendarDate, date);
  await web.fire(web.document.querySelector('.calendar-events-side [data-action="new-task"]'), 'click');
  assert.equal(web.byId('modalTaskDate').value, date);
  web.byId('modalTaskTitle').value = 'School visit'; web.byId('modalTaskDesc').value = 'Meet the teacher'; web.byId('modalTaskTime').value = '09:00';
  await web.fire(web.byId('newTaskForm'), 'submit');
  const task = web.store.getState().tasks[0]; assert.ok(task); assert.equal(task.date, date);
  assert.match(web.byId('calendarTasksForDayList').textContent, /School visit/);
  assert.equal(web.byId('calendarDaysGrid').querySelector(`[data-date="${date}"]`).classList.contains('has-event'), true);
  await web.fire(web.byId('calendarTasksForDayList').querySelector(`[data-action="toggle-task"][data-id="${task.id}"]`), 'click');
  assert.equal(web.store.getState().tasks[0].completed, true);
  assert.equal(web.byId('calendarDaysGrid').querySelector(`[data-date="${date}"]`).classList.contains('has-event'), false);
  assert.doesNotMatch(web.byId('calendarUpcomingEventsList').textContent, /School visit/);
  await web.fire(web.byId('calendarViewAllBtn'), 'click');
  assert.equal(web.byId('fullCalendarSection').style.display, 'block');
  assert.equal(web.byId('fullCalendarMonths').querySelectorAll('.calendar-month-card').length, 12);
  const month = web.app.calendarMonth.getMonth();
  await web.fire(web.document.querySelector('[data-action="calendar-next"]'), 'click');
  assert.equal(web.app.calendarMonth.getMonth(), (month + 1) % 12);
});

test('changing the cookie account gives the new UI separate organizer records and preserves the first account plans', async () => {
  const first = await browser('grocery.html', { user: parent });
  first.setForm('addGroceryForm', { groceryName: 'First account milk', quantity: '2' }); await first.fire(first.byId('addGroceryForm'), 'submit');
  const saved = JSON.parse(first.storage.get('parentech.v1'));
  const other = { ...parent, id: 'other-web-parent', name: 'Other Parent', phone: '+639181234567' };
  const second = await browser('grocery.html', { user: other, saved });
  assert.equal(second.store.getState().user.id, other.id); assert.equal(second.store.getState().groceries.length, 0);
  assert.doesNotMatch(second.byId('groceryListContainer').textContent, /First account milk/);
  second.setForm('addGroceryForm', { groceryName: 'Other account bread', quantity: '4' }); await second.fire(second.byId('addGroceryForm'), 'submit');
  const result = JSON.parse(second.storage.get('parentech.v1'));
  assert.equal(result.accounts[parent.id].data.groceries[0].name, 'First account milk');
  assert.equal(result.accounts[parent.id].data.groceries[0].quantity, 2);
  assert.equal(result.accounts[other.id].data.groceries[0].name, 'Other account bread');
  assert.equal(result.accounts[other.id].data.groceries[0].quantity, 4);
});

test('a profile draft owned by a previous account is closed before any PATCH can reach the new account', async () => {
  const other = { ...parent, id: 'new-cookie-parent', name: 'Other Parent', phone: '+639181234567' };
  let cookieUser = parent;
  const web = await browser('profile.html', { user: parent, respond: request => {
    if (request.url.endsWith('/session') || request.url.endsWith('/login')) return reply({ user: cookieUser });
    return null;
  } });
  await web.fire(web.byId('editProfileBtn'), 'click');
  const form = web.setForm('editProfileForm', { name: 'Draft From First Parent' });
  assert.equal(form.dataset.ownerAccountId, parent.id);
  cookieUser = other;
  await web.store.login({ phone: other.phone, password: 'FamilyPlan123' });
  await web.fire(form, 'submit');
  assert.equal(web.requests.filter(request => request.url.endsWith('/profile')).length, 0, 'Owner checks run before issuing a profile request');
  assert.equal(web.store.getState().user.id, other.id); assert.equal(web.byId('profileUserName').textContent, other.name);
  assert.equal(web.byId('editProfileModal').classList.contains('active'), false);
  await web.fire(web.byId('editProfileBtn'), 'click');
  assert.equal(form.dataset.ownerAccountId, other.id); assert.equal(web.byId('editFullName').value, other.name);
});

test('a rejected profile PATCH refreshes the changed server session and never applies the old draft to its new owner', async () => {
  const other = { ...parent, id: 'changed-cookie-parent', name: 'Changed Parent', phone: '+639181234567' };
  let cookieUser = parent;
  const web = await browser('profile.html', { user: parent, respond: request => {
    if (request.url.endsWith('/session')) return reply({ user: cookieUser });
    if (request.url.endsWith('/profile')) return reply({ code: 'SESSION_CHANGED', message: 'Your account changed.', fields: { _form: 'Your account changed.' } }, 409);
    return null;
  } });
  await web.fire(web.byId('editProfileBtn'), 'click');
  const form = web.setForm('editProfileForm', { name: 'Old Account Draft' });
  cookieUser = other;
  await web.fire(form, 'submit');
  const patches = web.requests.filter(request => request.url.endsWith('/profile'));
  assert.equal(patches.length, 1); assert.equal(patches[0].headers['X-PT-Account'], parent.id);
  assert.equal(web.store.getState().user.id, other.id); assert.equal(web.store.getState().user.name, other.name);
  assert.equal(web.byId('profileUserName').textContent, other.name); assert.equal(web.byId('editProfileModal').classList.contains('active'), false);
  assert.equal(web.byId('profileSubmitBtn').disabled, false);
});

test('photo selection requires confirmation and preserves the exact image through the API, cache and reopened profile', async () => {
  const data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cDKsAAAAASUVORK5CYII=';
  let savedProfile = plain(parent);
  const respond = request => {
    if (request.url.endsWith('/session')) return reply({ user: savedProfile });
    if (request.url.endsWith('/profile')) { savedProfile = { ...savedProfile, ...request.body }; return reply({ user: savedProfile }); }
    return null;
  };
  const web = await browser('profile.html', { user: parent, respond });
  const input = web.byId('profilePhotoInput'); input.files = [{ name: 'family.png', type: 'image/png', size: Buffer.from(data.split(',')[1], 'base64').length, data }];
  await web.fire(input, 'change');
  assert.equal(web.byId('profilePhotoPreviewModal').classList.contains('active'), true); assert.equal(web.byId('profilePhotoPreview').src, data);
  assert.equal(web.requests.filter(request => request.url.endsWith('/profile')).length, 0, 'Choosing a photo only opens its preview');
  assert.equal(web.store.getState().user.photo, '');
  await web.fire(web.byId('confirmProfilePhotoBtn'), 'click');
  const request = web.requests.find(request => request.url.endsWith('/profile'));
  assert.ok(request); assert.equal(request.method, 'PATCH'); assert.equal(request.headers['X-PT-Account'], parent.id);
  assert.deepEqual(Object.keys(request.body), ['photo']); assert.equal(request.body.photo, data);
  assert.equal(web.store.getState().user.photo, data); assert.equal(web.byId('profilePhotoPreviewModal').classList.contains('active'), false);
  const saved = JSON.parse(web.storage.get('parentech.v1')); assert.equal(saved.accounts[parent.id].profile.photo, data);
  const reopened = await browser('profile.html', { user: savedProfile, saved, respond });
  assert.equal(reopened.store.getState().user.photo, data); assert.equal(reopened.document.querySelector('[data-profile-photo]').src, data);
});

test('report validation preserves the draft and valid confirmation saves or sends no report or screenshot', async () => {
  const web = await browser('report-problem.html', { user: parent });
  const form = web.byId('reportProblemForm'), before = web.storage.get('parentech.v1'), requestsBefore = web.requests.length;
  web.byId('reportCategory').value = 'UI Issue'; web.byId('reportProblemDesc').value = ''; web.byId('reportEmail').value = 'invalid-address';
  await web.fire(form, 'submit');
  assert.equal(web.byId('reportProblemDesc').getAttribute('aria-invalid'), 'true'); assert.equal(web.byId('reportEmail').getAttribute('aria-invalid'), 'true');
  assert.equal(web.storage.get('parentech.v1'), before);
  web.byId('reportProblemDesc').value = 'The calendar button is hard to see.'; web.byId('reportEmail').value = 'parent@example.com';
  await web.fire(web.byId('reportProblemDesc'), 'input'); assert.equal(web.byId('reportCharCount').textContent, '35/500');
  web.byId('reportScreenshot').files = [{ name: 'screen.png', type: 'image/png', size: 128 }];
  await web.fire(form, 'submit');
  assert.match(web.byId('prototypeToast').textContent, /Report confirmed/);
  assert.equal(web.byId('reportProblemDesc').value, ''); assert.equal(web.byId('reportCharCount').textContent, '0/500');
  assert.equal(web.storage.get('parentech.v1'), before); assert.equal(web.requests.length, requestsBefore);
  assert.equal(web.store.getState().reports.length, 0);
});

test('Home keyboard cards use the current role and help topics open the corresponding FAQ', async () => {
  const home = await browser('home.html', { user: { ...parent, role: 'Solo Parent' } });
  assert.equal(home.byId('dashGreetingName').textContent, 'Solo Parent');
  const household = home.document.querySelector('[data-action="open-category"][data-category="household"]');
  assert.equal(household.getAttribute('role'), 'link'); assert.equal(household.getAttribute('tabindex'), '0');
  await home.fire(household, 'keydown', { key: 'Enter' });
  assert.equal(home.location.href, 'tasks.html?category=household');
  const help = await browser('help.html', { user: parent });
  await help.fire(help.document.querySelector('[data-topic="troubleshooting"]'), 'keydown', { key: ' ' });
  assert.equal(help.location.href, 'faqs.html?topic=troubleshooting');
  const faq = await browser('faqs.html', { user: parent, search: '?topic=troubleshooting' });
  assert.equal(faq.byId('troubleshooting').classList.contains('open'), true);
  assert.equal(faq.document.activeElement, faq.byId('troubleshooting').querySelector('.faq-question-btn'));
});

test('Universal Topbar AI Copilot adds groceries, tasks, multi-dose pills, and answers schedule questions', async () => {
  const web = await browser('home.html', { user: parent });
  const search = web.byId('topbarSearchInput');
  assert.ok(search);
  assert.ok(web.byId('aiCopilotTriggerBtn'));
  assert.ok(web.byId('mobileCopilotBtn'));
  const dd = web.byId('aiCopilotDropdown');
  assert.equal(dd.hidden, true);

  await web.fire(search, 'focus');
  assert.equal(dd.hidden, false);
  assert.match(dd.textContent, /Add milk and eggs to grocery/);

  // 1. Grocery command
  search.value = 'Add milk and 2 eggs to grocery';
  await web.fire(search, 'input');
  assert.ok(web.byId('aiCopilotRunActionBtn'));
  await web.fire(search, 'keydown', { key: 'Enter' });
  let state = web.store.getState();
  assert.equal(state.groceries.length, 2);
  assert.equal(state.groceries.find(g => g.name === 'Milk').quantity, 1);
  assert.equal(state.groceries.find(g => g.name === 'Eggs').quantity, 2);

  // 2. Natural reminder command
  search.value = 'Remind me to call grandma at 4pm';
  await web.fire(search, 'input');
  await web.fire(search, 'keydown', { key: 'Enter' });
  state = web.store.getState();
  const callTask = state.tasks.find(t => /call grandma/i.test(t.title));
  assert.ok(callTask);
  assert.equal(callTask.category, 'family');
  assert.equal(callTask.time, '16:00');

  // 3. Multi-dose pill scheduling command
  search.value = 'Amoxicillin 500mg 3x daily';
  await web.fire(search, 'input');
  await web.fire(search, 'keydown', { key: 'Enter' });
  state = web.store.getState();
  const pills = state.tasks.filter(t => t.category === 'pill' && /Amoxicillin/i.test(t.title));
  assert.equal(pills.length, 3);
  assert.deepEqual(plain(pills.map(p => p.time)), ['08:00', '13:00', '19:00']);

  // 4. Conversational Q&A
  search.value = 'What are my tasks for today?';
  await web.fire(search, 'input');
  assert.match(dd.textContent, /4 today tasks/);
  assert.match(dd.textContent, /Call grandma/);
  await web.fire(search, 'keydown', { key: 'Enter' });
  assert.equal(dd.hidden, false);
});
