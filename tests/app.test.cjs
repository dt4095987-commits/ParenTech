'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file === 'validation.js' ? 'shared' : path.join('archive', 'legacy-frontend'), file), 'utf8');

// Run the shipped renderers and delegated form handlers with small real element
// objects. This checks input behavior and accessibility attributes, not layout.
async function startApp(savedData, { demo = false, beforeApp, systemDark = false, initialHash = '' } = {}) {
  const documentListeners = new Map(), windowListeners = new Map();
  const storage = new Map(savedData ? [['parentech.v1', savedData]] : []);
  const errors = [], forms = [];
  const timers = new Map(), intervals = [], themeListeners = [];
  let timerId = 0, splashTimer = true;
  const themeMedia = { matches: systemDark, addEventListener: (type, callback) => themeListeners.push(callback) };
  let document, elementNumber = 0;

  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.innerHTML = ''; this.textContent = '';
      this.dataset = {}; this.attributes = new Map(); this.children = [];
      this.hidden = false; this.isConnected = true; this.disabled = false;
      this.value = ''; this.type = ''; this.name = ''; this.id = '';
      this.selectionStart = 0; this.selectionEnd = 0; this.selectionDirection = 'none';
      this.checked = false; this.offsetParent = {}; this.parentElement = null;
      const classes = new Set();
      Object.defineProperty(this, 'className', {
        get: () => [...classes].join(' '),
        set: value => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); }
      });
      this.classList = {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, forced) {
          const next = forced === undefined ? !classes.has(name) : forced;
          if (next) classes.add(name); else classes.delete(name);
          return next;
        }
      };
    }
    get childElementCount() { return this.innerHTML.trim() ? 1 : this.children.length; }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'hidden') this.hidden = true;
      if (['id', 'name', 'type'].includes(name)) this[name] = String(value);
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    getAttribute(name) {
      if (this.attributes.has(name)) return this.attributes.get(name);
      if (['id', 'name', 'type'].includes(name)) return this[name] || null;
      if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] ?? null;
      return null;
    }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'hidden') this.hidden = false; }
    append(...elements) { elements.forEach(element => { element.parentElement = this; element.isConnected = true; this.children.push(element); }); }
    appendChild(element) { this.append(element); return element; }
    insertAdjacentElement(position, element) {
      if (position === 'beforeend') this.append(element);
      else if (position === 'afterend') this.after(element);
      else throw new Error(`Unsupported insertion: ${position}`);
      return element;
    }
    after(element) {
      if (!this.parentElement) return;
      const siblings = this.parentElement.children;
      element.parentElement = this.parentElement;
      siblings.splice(siblings.indexOf(this) + 1, 0, element);
    }
    remove() {
      this.isConnected = false;
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
    focus() { document.activeElement = this; }
    click() { this.clicked = true; }
    getContext() { return { drawImage: img => { this.imageSource = img.src; } }; }
    toDataURL() { return this.imageSource; }
    setSelectionRange(start, end, direction = 'none') {
      this.selectionStart = Math.max(0, Math.min(start, this.value.length));
      this.selectionEnd = Math.max(this.selectionStart, Math.min(end, this.value.length));
      this.selectionDirection = direction;
    }
    setRangeText(replacement, start = this.selectionStart, end = this.selectionEnd, mode = 'preserve') {
      const oldStart = this.selectionStart, oldEnd = this.selectionEnd;
      replacement = String(replacement);
      this.value = this.value.slice(0, start) + replacement + this.value.slice(end);
      const next = start + replacement.length, delta = replacement.length - (end - start);
      if (mode === 'end') this.setSelectionRange(next, next);
      else if (mode === 'start') this.setSelectionRange(start, start);
      else if (mode === 'select') this.setSelectionRange(start, next);
      else this.setSelectionRange(oldStart > end ? oldStart + delta : oldStart > start ? start : oldStart, oldEnd > end ? oldEnd + delta : oldEnd > start ? next : oldEnd);
    }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        if (!part) return false;
        const not = [...part.matchAll(/:not\(([^)]+)\)/g)];
        if (not.some(match => this.matches(match[1]))) return false;
        part = part.replace(/:not\([^)]+\)/g, '');
        const tag = part.match(/^[a-zA-Z]+/);
        if (tag && this.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
        if ([...part.matchAll(/\.([\w-]+)/g)].some(match => !this.classList.contains(match[1]))) return false;
        const id = part.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
        return [...part.matchAll(/\[([^\]=\s]+)(?:\s*=\s*['"]?([^'"\]]*)['"]?)?\]/g)].every(match => {
          const actual = this.getAttribute(match[1]);
          return match[2] === undefined ? actual !== null : actual === match[2];
        });
      });
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    querySelectorAll(selector) { return this.descendants().filter(child => child.isConnected && child.matches(selector)); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  }

  const nodes = new Map(['app', 'modal-root', 'toast-stack', 'search-results', 'global-search', 'report-counter', 'upload-label', 'signup-password-strength', 'password-strength-text', 'profile-photo'].map(id => {
    const element = new Element(); element.id = id; return [id, element];
  }));
  nodes.get('global-search').tagName = 'INPUT';
  nodes.get('profile-photo').tagName = 'INPUT';
  document = {
    body: new Element('body'), activeElement: null, title: '',
    getElementById: id => nodes.get(id) ?? forms.flatMap(form => [form.parentElement, ...form.parentElement.descendants()]).find(node => node.id === id && node.isConnected) ?? null,
    createElement: tag => new Element(tag),
    querySelector: selector => forms.flatMap(form => [form, ...form.descendants()]).find(node => node.isConnected && node.matches(selector)) ?? null,
    querySelectorAll: selector => forms.flatMap(form => [form, ...form.descendants()]).filter(node => node.isConnected && node.matches(selector)),
    addEventListener: (type, callback) => addListener(documentListeners, type, callback)
  };
  function addListener(map, type, callback) { if (!map.has(type)) map.set(type, []); map.get(type).push(callback); }
  let hash = initialHash;
  const location = { search: demo ? '?demo=1' : '' };
  Object.defineProperty(location, 'hash', { get: () => hash, set: value => { hash = value && !String(value).startsWith('#') ? '#' + value : String(value); } });
  class FormData {
    constructor(form) {
      this.entries = Object.entries(form.elements).filter(([name, field]) => name !== 'namedItem' && !field.disabled && (!['checkbox', 'radio'].includes(field.type) || field.checked)).map(([name, field]) => [name, field.type === 'file' ? field.files[0] : field.value]);
    }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    get(name) { return this.entries.find(entry => entry[0] === name)?.[1] ?? null; }
  }
  const sandbox = {
    document, location, FormData, URLSearchParams, crypto: webcrypto, TextEncoder,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    console: { error: error => errors.push(error) },
    setTimeout: (callback, delay) => { const id = ++timerId; if (splashTimer && delay === 2000) { splashTimer = false; Promise.resolve().then(callback); } else timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => { intervals.push({ callback, delay }); return intervals.length; },
    FileReader: class { readAsDataURL(file) { this.result=file.data; Promise.resolve().then(()=>this.onload()); } },
    Image: class { constructor() { this.naturalWidth=800;this.naturalHeight=600; } set src(value) { this.source=value;Promise.resolve().then(()=>this.onload()); } get src() { return this.source; } },
    requestAnimationFrame: callback => callback(), matchMedia: query => query.includes('prefers-color-scheme') ? themeMedia : ({ matches: false }), scrollTo: () => {},
    addEventListener: (type, callback) => addListener(windowListeners, type, callback)
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(read('validation.js'), context, { filename: 'validation.js' });
  vm.runInContext(read('domain.js'), context, { filename: 'domain.js' });
  if (beforeApp) sandbox.PTStore = beforeApp(sandbox.PTStore);
  vm.runInContext(read('app.js'), context, { filename: 'app.js' });
  // Let the async session initialization complete before inspecting the UI.
  await new Promise(resolve => setImmediate(resolve));
  async function emit(listeners, type, event) { for (const callback of listeners.get(type) || []) await callback(event); }
  async function click(data) {
    const element = new Element('button'); element.dataset = data;
    const previousHash = location.hash;
    await emit(documentListeners, 'click', { target: element });
    if (location.hash !== previousHash) await emit(windowListeners, 'hashchange', {});
    return element;
  }
  async function navigate(route) { location.hash = route; await emit(windowListeners, 'hashchange', {}); }
  function createForm(kind, values, extraElements = {}, validationKind) {
    const form = new Element('form'); form.dataset.form = kind; form.elements = {};
    const host = new Element(); host.className = kind === 'grocery' ? 'grocery-form-group' : 'test-form-host'; host.append(form);
    const modalKind = nodes.get('modal-root').innerHTML.match(/data-validation="([^"]*)"/)?.[1];
    if(kind==='modal')form.dataset.itemId=nodes.get('modal-root').innerHTML.match(/data-item-id="([^"]*)"/)?.[1];
    form.dataset.validation = validationKind ?? (kind === 'modal' ? modalKind || '' : kind);
    const error = new Element('p'); error.className = 'form-error'; error.hidden = true;
    const button = new Element('button'); button.type = 'submit';
    for (const [name, value] of Object.entries({ ...values, ...extraElements })) {
      const field = new Element(name === 'description' ? 'textarea' : ['role', 'civilStatus', 'category'].includes(name) ? 'select' : 'input');
      field.name = name; field.id = `test-${name}-${++elementNumber}`;
      field.type = name.toLowerCase().includes('password') ? 'password' : name === 'phone' ? 'tel' : name === 'screenshot' ? 'file' : name === 'dob' || name === 'date' ? 'date' : name === 'time' ? 'time' : 'text';
      field.value = typeof value === 'object' ? value.value || '' : value ?? '';
      if (name === 'phone') {
        const compact = String(field.value).normalize('NFKC').replace(/[\s().-]/g, '');
        if (/^\+639\d{9}$/.test(compact)) field.value = compact.slice(3);
        else if (/^639\d{9}$/.test(compact)) field.value = compact.slice(2);
        else if (/^09\d{9}$/.test(compact)) field.value = compact.slice(1);
        field.dataset.phonePrefix = '+63';
        field.dataset.maxlength = '10';
      }
      field.setSelectionRange(field.value.length, field.value.length);
      if (value && typeof value === 'object') Object.assign(field, value);
      if (name === 'screenshot') field.files ||= [];
      if (name === 'notifications') { field.type = 'checkbox'; field.checked = !!value.checked; }
      field.form = form;
      const container = new Element(name === 'category' && form.dataset.validation === 'task' ? 'fieldset' : 'div');
      container.className = container.tagName === 'FIELDSET' ? 'category-fieldset' : 'field'; container.dataset.field = name;
      const control = new Element(); control.className = name.toLowerCase().includes('password') ? 'password-field' : 'field-control';
      if (name === 'phone') {
        control.classList.add('phone-control');
        const prefix = new Element('span'); prefix.className = 'phone-prefix'; prefix.textContent = '+63'; prefix.setAttribute('aria-hidden', 'true'); control.append(prefix);
      }
      if (kind === 'grocery') form.append(field);
      else { control.append(field); container.append(control); form.append(container); }
      form.elements[name] = field;
    }
    if (kind === 'report' && !form.elements.screenshot) {
      const field = new Element('input'); field.type = 'file'; field.name = 'screenshot'; field.files = []; field.form = form;
      const container = new Element(); container.className = 'field'; container.append(field); form.append(container); form.elements.screenshot = field;
    }
    form.elements.namedItem = name => form.elements[name] ?? null;
    Object.defineProperty(form.elements, Symbol.iterator, { value: function* () { for (const [name, field] of Object.entries(this)) if (name !== 'namedItem') yield field; } });
    form.append(error, button); forms.push(form);
    return { form, fields: form.elements, error, button };
  }
  async function dispatchSubmit(form) { await emit(documentListeners, 'submit', { target: form, preventDefault() {} }); }
  async function submit(kind, values, extraElements, validationKind) { const result = createForm(kind, values, extraElements, validationKind); await dispatchSubmit(result.form); return result; }
  async function input(form, name, value, options = {}) {
    const field = form.elements[name]; field.value = value;
    field.setSelectionRange(options.selectionStart ?? value.length, options.selectionEnd ?? options.selectionStart ?? value.length);
    await emit(documentListeners, 'input', { target: field, isComposing: false, ...options });
  }
  async function beforeInput(form, name, data, inputType = 'insertText', options = {}) {
    const event = { target: form.elements[name], data, inputType, isComposing: false, cancelable: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...options };
    await emit(documentListeners, 'beforeinput', event);
    return event;
  }
  async function edit(form, name, data, inputType = 'insertText', options = {}) {
    const field = form.elements[name], event = await beforeInput(form, name, data, inputType, options);
    if (!event.defaultPrevented && inputType.startsWith('insert')) field.setRangeText(data || '', field.selectionStart, field.selectionEnd, 'end');
    else if (!event.defaultPrevented && inputType.startsWith('delete')) {
      const start = field.selectionStart, end = field.selectionEnd;
      field.setRangeText('', start === end && inputType === 'deleteContentBackward' ? Math.max(0, start - 1) : start, start === end && inputType === 'deleteContentForward' ? Math.min(field.value.length, end + 1) : end, 'end');
    }
    if (!event.defaultPrevented && !inputType.startsWith('history')) await emit(documentListeners, 'input', { target: field, inputType, isComposing: !!options.isComposing });
    return event;
  }
  async function paste(form, name, text) {
    const event = { target: form.elements[name], clipboardData: { getData: () => text }, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    await emit(documentListeners, 'paste', event);
    return event;
  }
  async function composition(form, name, type) { await emit(documentListeners, type, { target: form.elements[name], data: '' }); }
  async function blur(form, name) { const field = form.elements[name]; await emit(documentListeners, 'focusout', { target: field }); await emit(documentListeners, 'blur', { target: field }); }
  return {
    store: sandbox.PTStore, nodes, document, errors, storage, context, timers, intervals, location,
    html: () => nodes.get('app').innerHTML, modal: () => nodes.get('modal-root').innerHTML,
    click, navigate, submit, createForm, dispatchSubmit, input, blur, beforeInput, edit, paste, composition,
    keydown: (key, target = nodes.get('global-search')) => emit(documentListeners, 'keydown', { key, target, preventDefault() {} }),
    focusSearch: () => emit(documentListeners, 'focusin', { target: nodes.get('global-search') }),
    changePhoto: file => { const target=nodes.get('profile-photo');target.files=[file];return emit(documentListeners,'change',{target}); },
    setSystemDark: async dark => { themeMedia.matches=dark;for(const callback of themeListeners)await callback(); },
    checkVisibility: async () => { document.visibilityState='visible';await emit(documentListeners,'visibilitychange',{}); },
    search: query => { const field = nodes.get('global-search'); field.value = query; return emit(documentListeners, 'input', { target: field }); }
  };
}

const profile = { name: 'Integration Parent', phone: '0919 123 4567', dob: '1991-07-10', civilStatus: 'Single', role: 'Solo Parent', password: 'FamilyPlan123', confirmPassword: 'FamilyPlan123' };
const task = { title: 'Dental appointment', description: '', date: '2026-12-05', time: '09:30', category: 'personal' };
const fieldError = (result, name) => result.form.parentElement.querySelector(`[data-error-for="${name}"]`)?.textContent || '';

test('original screens render and the demo remains accessible only through its query', async () => {
  const app = await startApp(); assert.deepEqual(app.errors, []);
  assert.match(app.html(), /data-form="login"/); assert.match(app.html(), />LOGIN<\/button>/); assert.match(app.html(), /assets\/wordmark\.png/);
  const loginForm = app.html().match(/<form[^>]*>/)[0];
  assert.match(loginForm, /novalidate/);
  const phoneInput = app.html().match(/<input[^>]*name="phone"[^>]*>/)[0];
  assert.match(app.html(), /class="phone-prefix"[^>]*>\+63<\/span>/);
  assert.match(phoneInput, /data-phone-prefix="\+63"/); assert.doesNotMatch(phoneInput, /placeholder="\+63"/);
  assert.doesNotMatch(app.html(), /auth-story|demo-link|data-action="demo"|Less to remember/);
  await app.click({ action: 'auth-switch' }); assert.match(app.html(), /data-form="signup"/); assert.match(app.html(), /Civil Partnership|Solo Parent/);
  const demo = await startApp(undefined, { demo: true });
  assert.equal(demo.store.getState().user.name, 'Alex Morgan'); assert.equal((demo.html().match(/class="nav-link /g) || []).length, 4);
  assert.match(demo.html(), /Hello, Mom!/); assert.doesNotMatch(demo.html(), /welcome-banner|progress-ring|sidebar-help/);
});

test('main and support navigation, calendar dates and purchase history remain usable', async () => {
  const app = await startApp(undefined, { demo: true });
  for (const [route, title] of Object.entries({ tasks: 'Tasks & Reminders', calendar: 'ParenTech Calendar', grocery: 'Grocery List', profile: 'Notifications Settings', help: 'How can we help you?', faq: 'Frequently Asked Questions', report: 'Report a Problem', privacy: 'Privacy & policy' })) {
    await app.navigate(route); assert.ok(app.html().includes(title), `Missing ${route}`);
  }
  await app.navigate('calendar'); await app.click({ action: 'calendar-mode' }); assert.match(app.html(), /full-calendars/);
  await app.click({ action: 'calendar-day', date: '2026-12-04' }); assert.match(app.modal(), /December 4, 2026|ADD EVENT/);
  await app.navigate('grocery'); await app.click({ action: 'grocery-history' }); assert.match(app.html(), /Grocery History/);
  assert.deepEqual(app.errors, []);
});

test('invalid signup highlights every affected field, focuses the first, and preserves hint associations', async () => {
  const app = await startApp(); await app.click({ action: 'auth-switch' });
  const result = app.createForm('signup', { ...profile, name: 'Parent123', phone: '123', dob: '2099-01-01', civilStatus: '', role: '', password: 'weak', confirmPassword: 'Different' });
  result.fields.name.setAttribute('aria-describedby', 'name-hint');
  await app.blur(result.form, 'phone');
  assert.equal(result.fields.phone.getAttribute('aria-invalid'), 'true');
  assert.notEqual(result.fields.name.getAttribute('aria-invalid'), 'true', 'Blur only highlights the field just visited');
  await app.dispatchSubmit(result.form);
  assert.equal(app.store.getState().user, null); assert.equal(result.error.hidden, false);
  assert.match(result.error.textContent, /highlighted|check/i);
  for (const name of ['name', 'phone', 'dob', 'role', 'password', 'confirmPassword']) {
    assert.equal(result.fields[name].getAttribute('aria-invalid'), 'true', name);
    assert.ok(fieldError(result, name), `Missing message for ${name}`);
  }
  assert.equal(app.document.activeElement, result.fields.name);
  assert.ok(result.fields.name.getAttribute('aria-describedby').split(/\s+/).includes('name-hint'));
  const errorId = result.form.querySelector('[data-error-for="name"]').id;
  assert.ok(result.fields.name.getAttribute('aria-describedby').split(/\s+/).includes(errorId));
  await app.input(result.form, 'name', profile.name);
  assert.notEqual(result.fields.name.getAttribute('aria-invalid'), 'true');
  assert.equal(fieldError(result, 'name'), '');
  assert.equal(result.fields.name.getAttribute('aria-describedby'), 'name-hint');
  await app.blur(result.form, 'name'); assert.notEqual(result.fields.name.getAttribute('aria-invalid'), 'true');
  result.fields.name.value='Parent123'; await app.blur(result.form, 'name');
  assert.equal(result.fields.name.getAttribute('aria-invalid'), 'true');
  assert.equal(result.button.disabled, false);
});

test('signup confirmation and login failures stay in the form; successful accounts retain their plans', async () => {
  const app = await startApp(); await app.click({ action: 'auth-switch' });
  const mismatch = await app.submit('signup', { ...profile, confirmPassword: 'Different123' });
  assert.equal(mismatch.fields.confirmPassword.getAttribute('aria-invalid'), 'true');
  assert.match(fieldError(mismatch, 'confirmPassword'), /match/i);
  const registration = await app.submit('signup', profile); assert.equal(app.store.getState().user.name, profile.name);
  assert.equal(registration.fields.phone.value, '9191234567'); assert.equal(app.store.getState().user.phone, '+639191234567');
  await app.navigate('profile'); await app.click({ action: 'logout' });
  assert.ok(app.store.getState().user); await app.submit('modal', {}); assert.equal(app.store.getState().user, null);
  const invalid = await app.submit('login', { phone: profile.phone, password: 'short' });
  assert.equal(invalid.error.hidden, false); assert.match(invalid.error.textContent, /incorrect/i);
  assert.equal(invalid.button.disabled, false); assert.notEqual(invalid.form.getAttribute('aria-busy'), 'true');
  assert.equal(invalid.form.classList.contains('is-submitting'), false);
  assert.doesNotMatch(fieldError(invalid, 'password'), /uppercase|8 characters/i);
  await app.submit('login', { phone: profile.phone, password: profile.password }); assert.equal(app.store.getState().user.name, profile.name);
});

test('grocery validation blocks empty and duplicate items before mutation; purchase and re-add still work', async () => {
  const app = await startApp(undefined, { demo: true }); await app.navigate('grocery');
  const count = app.store.getState().groceries.length;
  const empty = await app.submit('grocery', { groceryName: '  ' });
  assert.equal(app.store.getState().groceries.length, count); assert.equal(empty.fields.groceryName.getAttribute('aria-invalid'), 'true');
  assert.equal(app.document.activeElement, empty.fields.groceryName);
  const groceryError = empty.form.parentElement.querySelector('[data-error-for="groceryName"]');
  assert.equal(groceryError.parentElement, empty.form.parentElement, 'The grocery error belongs below the pill bar');
  await app.input(empty.form, 'groceryName', 'Fresh pears');
  assert.equal(groceryError.hidden, true); assert.notEqual(empty.fields.groceryName.getAttribute('aria-invalid'), 'true');
  await app.submit('grocery', { groceryName: 'Fresh apples' });
  const duplicate = await app.submit('grocery', { groceryName: 'fresh apples' });
  assert.match(fieldError(duplicate, 'groceryName'), /already|list/i);
  const item = app.store.getState().groceries.find(item => item.name === 'Fresh apples'); assert.ok(item);
  await app.click({ action: 'purchase-grocery', id: item.id });
  const purchase = app.store.getState().purchases.find(item => item.name === 'Fresh apples'); assert.ok(purchase);
  await app.click({ action: 'restore-purchase', id: purchase.id }); assert.ok(app.store.getState().groceries.some(item => item.name === 'Fresh apples'));
});

test('grocery quantities validate and persist through editing, purchase history, re-add and reload',async()=>{
  const app=await startApp(undefined,{demo:true});await app.navigate('grocery');
  assert.match(app.html(),/name="quantity"[^>]*value="1"/);
  const before=app.store.getState().groceries.length;
  for(const quantity of ['', '0','-1','1.5','1e2','many','10000']) {
    const invalid=await app.submit('grocery',{groceryName:'Oranges',quantity});
    assert.ok(fieldError(invalid,'quantity'),`Missing error for ${quantity}`);
    assert.equal(app.store.getState().groceries.length,before);
  }
  await app.submit('grocery',{groceryName:'Oranges',quantity:'3'});
  const item=app.store.getState().groceries.at(-1);
  assert.equal(item.quantity,3);assert.match(app.html(),/Qty: 3/);
  await app.click({action:'edit-grocery',id:item.id});
  assert.match(app.modal(),/name="quantity"[^>]*value="3"/);
  const invalid=await app.submit('modal',{groceryName:'Renamed oranges',quantity:'0'},{},'grocery');
  assert.ok(fieldError(invalid,'quantity'));assert.equal(app.store.getState().groceries.at(-1).name,'Oranges');
  await app.submit('modal',{groceryName:'Oranges',quantity:'5'},{},'grocery');
  assert.equal(app.store.getState().groceries.at(-1).quantity,5);
  await app.click({action:'purchase-grocery',id:item.id});
  const purchase=app.store.getState().purchases[0];assert.equal(purchase.quantity,5);
  assert.match(app.html(),/purchase-quantity">×5/);
  await app.click({action:'grocery-history'});assert.match(app.html(),/purchase-quantity">×5/);
  await app.click({action:'restore-purchase',id:purchase.id});
  const restored=app.store.getState().groceries.find(item=>item.name==='Oranges');assert.equal(restored.quantity,5);
  const reopened=await startApp(app.storage.get('parentech.v1'));assert.equal(reopened.store.getState().groceries.find(item=>item.name==='Oranges').quantity,5);
});

test('quantity typing and paste block nonnumeric and overflowing values',async()=>{
  const app=await startApp(undefined,{demo:true});await app.navigate('grocery');
  const {form,fields}=app.createForm('grocery',{groceryName:'Oranges',quantity:'1'});
  fields.quantity.setSelectionRange(0,1);
  for(const text of ['x','-1','1.5','1e2'])assert.equal((await app.edit(form,'quantity',text)).defaultPrevented,true);
  assert.equal(fields.quantity.value,'1');
  await app.paste(form,'quantity','3');assert.equal(fields.quantity.value,'3');
  fields.quantity.setSelectionRange(0,1);await app.paste(form,'quantity','1.5');assert.equal(fields.quantity.value,'3');assert.ok(fieldError({form},'quantity'));
  fields.quantity.setSelectionRange(0,1);await app.paste(form,'quantity','10000');assert.equal(fields.quantity.value,'3');
  fields.quantity.value='9999';fields.quantity.setSelectionRange(4,4);assert.equal((await app.edit(form,'quantity','9')).defaultPrevented,true);
});

test('task validation requires time and category, preserves state, and keeps escaped rendering and confirmation', async () => {
  const app = await startApp(undefined, { demo: true }); await app.navigate('tasks'); await app.click({ action: 'new-task' });
  const before = app.store.getState().tasks.length;
  const invalid = await app.submit('modal', { ...task, title: '', time: '', category: '' }, {}, 'task');
  for (const name of ['title', 'time', 'category']) assert.ok(fieldError(invalid, name), `Missing ${name} error`);
  assert.equal(app.document.activeElement, invalid.fields.title); assert.equal(app.store.getState().tasks.length, before);
  assert.ok(app.modal()); assert.equal(app.nodes.get('app').inert, true);
  const title = '<img src=x onerror="alert(1)">';
  await app.submit('modal', { ...task, title, description: '<script>alert(2)</script>' }, {}, 'task');
  assert.equal(app.modal(), ''); assert.match(app.html(), /&lt;img src=x/); assert.ok(!app.html().includes(title));
  const created = app.store.getState().tasks.find(item => item.title === title); assert.ok(created);
  await app.click({ action: 'toggle-task', id: created.id }); assert.equal(app.store.getState().tasks.find(item => item.id === created.id).completed, true);
  await app.click({ action: 'delete-task', id: created.id }); assert.ok(app.store.getState().tasks.some(item => item.id === created.id));
  await app.submit('modal', {}); assert.ok(!app.store.getState().tasks.some(item => item.id === created.id));
});

test('profile changes reject invalid dates and enum values without changing the saved account', async () => {
  const app = await startApp(undefined, { demo: true }); await app.navigate('profile'); await app.click({ action: 'edit-profile' });
  const original = app.store.getState().user;
  const displayedPhone = app.modal().match(/<input[^>]*name="phone"[^>]*>/)[0];
  assert.ok(displayedPhone.includes(`value="${original.phone.slice(3)}"`)); assert.match(displayedPhone, /data-phone-prefix="\+63"/);
  const invalid = await app.submit('modal', { ...original, dob: '2026-02-30', civilStatus: 'Unknown', role: 'Child' }, {}, 'profile');
  for (const name of ['dob', 'civilStatus', 'role']) assert.ok(fieldError(invalid, name));
  assert.equal(app.store.getState().user.dob, original.dob); assert.equal(app.store.getState().user.role, original.role);
});

test('reports validate text, email and screenshot metadata, then confirm without storage', async () => {
  const app = await startApp(undefined, { demo: true }); await app.navigate('report');
  const invalid = await app.submit('report', { category: '', description: '  ', email: 'not-an-email' });
  for (const name of ['category', 'description', 'email']) assert.ok(fieldError(invalid, name));
  assert.equal(app.store.getState().reports.length, 0);
  const report = { category: 'Other', description: 'Calendar did not show the plan I just saved.', email: '' };
  for (const file of [ { name: 'screen.jpg', type: 'image/png', size: 1024 }, { name: 'screen.png', type: 'image/png', size: 0 }, { name: 'screen.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 } ]) {
    const result = await app.submit('report', report, { screenshot: { files: [file] } });
    assert.ok(fieldError(result, 'screenshot')); assert.equal(app.store.getState().reports.length, 0);
  }
  const saved=app.storage.get('parentech.v1');
  await app.submit('report', report, { screenshot: { files: [{ name: 'screen.png', type: 'image/png', size: 1024 }] } });
  assert.equal(app.store.getState().reports.length, 0);assert.equal(app.storage.get('parentech.v1'),saved);
  assert.match(app.modal(),/Report submitted/);assert.match(app.modal(),/not saved or sent/);
});

test('a pending form submission cannot create duplicate accounts or lose its busy state', async () => {
  let release, calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const app = await startApp(undefined, { beforeApp: store => ({ ...store, signup: async values => { calls++; await gate; return store.signup(values); } }) });
  await app.click({ action: 'auth-switch' });
  const result = app.createForm('signup', profile);
  const first = app.dispatchSubmit(result.form);
  await Promise.resolve();
  assert.equal(calls, 1); assert.equal(result.button.disabled, true);
  assert.equal(result.form.getAttribute('aria-busy'), 'true'); assert.equal(result.form.classList.contains('is-submitting'), true);
  await app.dispatchSubmit(result.form); assert.equal(calls, 1);
  release(); await first;
  assert.equal(app.store.getState().user.name, profile.name);
  assert.equal(result.button.disabled, false); assert.notEqual(result.form.getAttribute('aria-busy'), 'true');
  assert.equal(result.form.classList.contains('is-submitting'), false);
});

test('chosen themes persist and reports remain confirmation-only after reopening', async () => {
  const app = await startApp(undefined, { demo: true }); await app.click({ action: 'theme' });
  await app.submit('modal',{theme:'dark'},{},'settings');
  await app.navigate('report'); await app.submit('report', { category: 'Other', description: 'The calendar plan was difficult to find.', email: '' });
  const restarted = await startApp(app.storage.get('parentech.v1'));
  assert.equal(restarted.document.body.dataset.theme, 'dark'); assert.equal(restarted.store.getState().reports.length, 0);
  await restarted.search('vitamins'); assert.equal(restarted.nodes.get('search-results').hidden, false); assert.match(restarted.nodes.get('search-results').innerHTML, /Take daily vitamins/);
  assert.deepEqual(restarted.errors, []);
});

test('national phone typing keeps the fixed prefix intact and blocks nondigits or overflow', async () => {
  const app = await startApp();
  const { form, fields } = app.createForm('login', { phone: '', password: '' });
  const prefix = fields.phone.closest('.phone-control').querySelector('.phone-prefix');
  assert.equal(fields.phone.value, ''); assert.equal(fields.phone.selectionStart, 0); assert.equal(prefix.textContent, '+63');
  await app.dispatchSubmit(form);
  assert.equal(fields.phone.getAttribute('aria-invalid'), 'true'); assert.equal(app.store.getState().user, null);
  for (const character of ['a', ' ', '٩', '+']) {
    const event = await app.edit(form, 'phone', character);
    assert.equal(event.defaultPrevented, true, `Unexpected phone character ${character}`);
    assert.equal(fields.phone.value, '');
  }
  await app.edit(form, 'phone', '9'); await app.edit(form, 'phone', '17');
  assert.equal(fields.phone.value, '917');
  fields.phone.setSelectionRange(0, 0);
  assert.equal((await app.edit(form, 'phone', '+')).defaultPrevented, true);
  fields.phone.setSelectionRange(2, 2);
  assert.equal((await app.edit(form, 'phone', '+')).defaultPrevented, true);
  fields.phone.value = '9171234567'; fields.phone.setSelectionRange(10, 10);
  assert.equal((await app.edit(form, 'phone', '8')).defaultPrevented, true);
  assert.equal(fields.phone.value, '9171234567');
  fields.phone.setSelectionRange(0, 0);
  await app.edit(form, 'phone', null, 'deleteContentBackward');
  assert.equal(fields.phone.value, '9171234567'); assert.equal(fields.phone.selectionStart, 0); assert.equal(prefix.textContent, '+63');
  fields.phone.setSelectionRange(3, 3);
  assert.equal((await app.edit(form, 'phone', null, 'deleteContentBackward')).defaultPrevented, false);
  assert.equal(fields.phone.value, '911234567'); assert.equal(fields.phone.selectionStart, 2);
  assert.equal((await app.beforeInput(form, 'phone', null, 'historyUndo')).defaultPrevented, false);
  assert.equal((await app.beforeInput(form, 'phone', null, 'deleteByCut')).defaultPrevented, false);
});

test('full phone paste displays national digits and partial replacement preserves its caret', async () => {
  const app = await startApp(); const { form, fields } = app.createForm('login', { phone: '', password: '' });
  assert.equal((await app.paste(form, 'phone', '+63 (917) 123-4567')).defaultPrevented, true);
  assert.equal(fields.phone.value, '9171234567'); assert.equal(fields.phone.selectionStart, 10);
  for (const text of ['639171234567', '0917 123 4567', '9171234567']) {
    fields.phone.setSelectionRange(0, fields.phone.value.length); await app.paste(form, 'phone', text);
    assert.equal(fields.phone.value, '9171234567'); assert.equal(fields.phone.selectionStart, 10);
  }
  fields.phone.value = '9170000000'; fields.phone.setSelectionRange(3, 10);
  await app.paste(form, 'phone', '123-4567');
  assert.equal(fields.phone.value, '9171234567'); assert.equal(fields.phone.selectionStart, 10); assert.equal(fields.phone.selectionEnd, 10);
  fields.phone.setSelectionRange(0, fields.phone.value.length);
  await app.paste(form, 'phone', 'abc0917letters1234567');
  assert.equal(fields.phone.value, '9171234567');
  fields.phone.setSelectionRange(0, fields.phone.value.length);
  await app.paste(form, 'phone', '＋６３（９１７）１２３－４５６７');
  assert.equal(fields.phone.value, '9171234567');
  fields.phone.setSelectionRange(0, fields.phone.value.length);
  await app.paste(form, 'phone', '+63917123456789');
  assert.equal(fields.phone.value, '9171234567', 'An overlong paste must not turn into a different truncated number');
  assert.ok(form.parentElement.querySelector('[data-error-for="phone"]')?.textContent);
});

test('phone fallback and composition cleanup preserve caret and leave other inputs unchanged', async () => {
  const app = await startApp(); const { form, fields } = app.createForm('signup', profile);
  await app.input(form, 'phone', 'asdasdasd'); assert.equal(fields.phone.value, ''); assert.equal(fields.phone.selectionStart, 0);
  await app.input(form, 'phone', '+63a917b1234567', { selectionStart: 8 });
  assert.equal(fields.phone.value, '9171234567'); assert.equal(fields.phone.selectionStart, 3);
  await app.input(form, 'phone', '+6+391++7123a4567'); assert.equal(fields.phone.value, '9171234567');
  await app.input(form, 'phone', '09171234567'); assert.equal(fields.phone.value, '9171234567');
  await app.input(form, 'phone', '12345678901234567890');
  assert.equal(fields.phone.value, '12345678901234567890', 'Uncancellable autofill must not silently truncate the number');
  await app.dispatchSubmit(form);
  assert.equal(app.store.getState().user, null); assert.equal(fields.phone.getAttribute('aria-invalid'), 'true');
  fields.phone.value = ''; fields.phone.setSelectionRange(0, 0);
  await app.composition(form, 'phone', 'compositionstart');
  assert.equal((await app.beforeInput(form, 'phone', '中', 'insertCompositionText', { isComposing: true })).defaultPrevented, false);
  await app.input(form, 'phone', '９中１７', { isComposing: true }); assert.equal(fields.phone.value, '９中１７');
  await app.composition(form, 'phone', 'compositionend'); assert.equal(fields.phone.value, '917'); assert.equal(fields.phone.selectionStart, 3);
  assert.equal((await app.beforeInput(form, 'name', 'a')).defaultPrevented, false);
  await app.input(form, 'name', 'Alex Morgan'); assert.equal(fields.name.value, 'Alex Morgan');
  await app.input(form, 'password', 'Pass+Word999'); assert.equal(fields.password.value, 'Pass+Word999');
  const grocery = app.createForm('grocery', { groceryName: '' });
  assert.equal((await app.beforeInput(grocery.form, 'groceryName', 'a')).defaultPrevented, false);
  await app.input(grocery.form, 'groceryName', '2 Tray of Eggs'); assert.equal(grocery.fields.groceryName.value, '2 Tray of Eggs');
});

test('bootstrap checks the server session before showing a cached profile', async () => {
  let release, initCalls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const app = await startApp(undefined, { beforeApp: store => {
    store.demo();
    return { ...store, isRemote: true, init: async () => { initCalls++; await gate; store.logout(); return store.getState(); } };
  } });
  assert.equal(initCalls, 1);
  assert.doesNotMatch(app.html(), /Hello, Mom!/, 'A cached profile must wait for the server session check');
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.match(app.html(), /data-form="login"/);
});

function relativeDay(offset=0) {
  const date=new Date();date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

test('dashboard omits Quick Access and new tasks default to today and current time', async () => {
  const app=await startApp(undefined,{demo:true});
  assert.doesNotMatch(app.html(),/Quick Access|quick-access/);assert.match(app.html(),/mobile-bottom-nav/);assert.match(app.html(),/bottom-nav-add/);
  for(const category of ['personal','family','household','pill']) {
    const before=new Date().toTimeString().slice(0,5);
    await app.click({action:'new-task'});
    const markup=app.modal();
    assert.match(markup,/name="category" value="personal" checked/);
    assert.ok(markup.includes(`value="${relativeDay()}"`));
    assert.ok([before,new Date().toTimeString().slice(0,5)].some(time=>markup.includes(`value="${time}"`)));
    await app.submit('modal',{title:`New ${category}`,description:'',date:relativeDay(),time:before,category},{},'task');
    assert.equal(app.store.getState().tasks.at(-1).category,category);
  }
  await app.click({action:'today-tasks'});
  assert.match(app.html(),/filter-tab active[^>]*data-action="task-filter" data-filter="today"/);
});

test('optional signup details and live password feedback work without weakening required fields',async()=>{
  const app=await startApp();await app.click({action:'auth-switch'});
  for(const field of ['dob','civilStatus']) {
    const input=app.html().match(new RegExp(`<(?:input|select)[^>]*name="${field}"[^>]*>`))[0];
    assert.doesNotMatch(input,/required|readonly/);
  }
  assert.match(app.html().match(/<input[^>]*name="age"[^>]*>/)[0],/readonly/);
  const result=app.createForm('signup',{name:profile.name,phone:profile.phone,role:profile.role,password:'',confirmPassword:'',dob:'',civilStatus:'',age:''});
  await app.input(result.form,'password','weak');
  assert.equal(app.nodes.get('signup-password-strength').dataset.strength,'weak');
  assert.match(app.nodes.get('password-strength-text').textContent,/uppercase|number/);
  await app.input(result.form,'password','GoodPass123');
  assert.equal(app.nodes.get('signup-password-strength').dataset.strength,'good');
  await app.input(result.form,'password','VeryStrong123!');
  assert.equal(app.nodes.get('signup-password-strength').dataset.strength,'strong');
  await app.input(result.form,'confirmPassword','VeryStrong123!');await app.dispatchSubmit(result.form);
  assert.equal(app.store.getState().user.age,null);
  await app.navigate('profile');assert.match(app.html(),/Age: N\/A/);
  await app.click({action:'personal-information'});assert.match(app.modal(),/Date of birth:<\/strong> Not specified/);
  assert.match(app.modal(),/Civil status:<\/strong> Not specified/);
  await app.click({action:'edit-profile'});
  const now=new Date(),birthDate=`${now.getFullYear()-35}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const edit=app.createForm('modal',{...app.store.getState().user,age:{value:'',readOnly:true}},{},'profile');
  await app.input(edit.form,'dob',birthDate);assert.equal(String(edit.fields.age.value),'35');
  await app.dispatchSubmit(edit.form);
  assert.equal(app.store.getState().user.age,35);assert.match(app.html(),/Age: 35/);
});

test('Home greets the selected role and each status card opens only that category',async()=>{
  const app=await startApp(undefined,{demo:true});
  const titles={personal:'Personal Tasks',family:'Family Tasks',household:'Household Tasks',pill:'Pill Reminders'};
  for(const category of Object.keys(titles))app.store.saveTask({title:`Only ${category} task`,date:relativeDay(),time:'10:00',category});
  await app.navigate('home');assert.match(app.html(),/Hello, Mom!/);
  app.store.updateProfile({role:'Dad'});await app.navigate('home');assert.match(app.html(),/Hello, Dad!/);
  for(const category of Object.keys(titles)) {
    await app.click({action:'filter-category',category});
    assert.equal(app.location.hash,`#tasks?category=${category}`);
    assert.ok(app.html().includes(`<h1>${titles[category]}</h1>`));
    assert.ok(app.html().includes(`Only ${category} task`));
    for(const other of Object.keys(titles).filter(other=>other!==category))assert.ok(!app.html().includes(`Only ${other} task`));
    await app.click({action:'new-task'});assert.match(app.modal(),new RegExp(`name="category" value="${category}" checked`));
    await app.click({action:'close-modal'});await app.click({route:'home'});
  }
  await app.click({action:'filter-category',category:'family'});
  const restored=await startApp(app.storage.get('parentech.v1'),{initialHash:'#tasks?category=family'});
  assert.match(restored.html(),/<h1>Family Tasks<\/h1>/);assert.match(restored.html(),/Only family task/);assert.doesNotMatch(restored.html(),/Only personal task/);
  await restored.click({action:'task-filter',filter:'pill'});assert.equal(restored.location.hash,'#tasks?category=pill');
  assert.match(restored.html(),/<h1>Pill Reminders<\/h1>/);
});

test('empty category views let users create a task in that category immediately',async()=>{
  const app=await startApp();await app.submit('signup',profile);
  await app.click({action:'filter-category',category:'household'});
  assert.match(app.html(),/No household tasks yet/);assert.match(app.html(),/data-action="new-task"[^>]*data-category="household"/);
  await app.click({action:'new-task'});assert.match(app.modal(),/name="category" value="household" checked/);
  await app.submit('modal',{title:'Wash dishes',date:relativeDay(),time:'12:00',category:'household'},{},'task');
  assert.match(app.html(),/Wash dishes/);assert.match(app.html(),/<h1>Household Tasks<\/h1>/);
});

test('recommended and entered searches select pending task dates and exclude completed tasks and groceries',async()=>{
  const app=await startApp(undefined,{demo:true});
  app.store.saveTask({title:'Search target completed',description:'',date:relativeDay(-2),time:'08:00',category:'personal'});
  app.store.toggleTask(app.store.getState().tasks.at(-1).id);
  app.store.saveTask({title:'Search target pending',description:'',date:relativeDay(3),time:'08:00',category:'pill'});
  app.store.addGrocery('Search target grocery');await app.navigate('home');
  await app.focusSearch();assert.match(app.nodes.get('search-results').innerHTML,/Recommended Searches/);
  await app.search('Search target');
  const results=app.nodes.get('search-results').innerHTML;
  assert.match(results,/Search target pending/);assert.doesNotMatch(results,/completed|grocery|edit-task/);
  await app.keydown('Enter');
  assert.equal(app.location.hash,'#calendar');
  // Browsers dispatch hashchange asynchronously; exercise that route transition.
  await app.navigate('calendar');
  assert.match(app.html(),new RegExp(`data-date="${relativeDay(3)}" aria-label="[^"]*" aria-pressed="true"`));
  assert.equal(app.modal(),'');
  await app.click({action:'search-task',date:relativeDay(3)});
  assert.match(app.html(),/Search target pending/);
});

test('calendar groups use today, all date taps open a day sheet and the full calendar scrolls twelve months',async()=>{
  const app=await startApp(undefined,{demo:true});
  for(const [offset,title] of [[0,'Today grouped event'],[1,'Tomorrow grouped event'],[10,'Later grouped event']])app.store.saveTask({title,date:relativeDay(offset),time:'10:00',category:'family'});
  await app.navigate('calendar');await app.click({action:'calendar-day',date:relativeDay(-4)});
  assert.match(app.modal(),/ADD EVENT/);assert.match(app.modal(),/No tasks or reminders/);
  assert.match(app.html(),/calendar-event-date">Today<\/p>/);assert.match(app.html(),/calendar-event-date">Tomorrow<\/p>/);
  assert.match(app.html(),/Later grouped event/);
  await app.click({action:'close-modal'});await app.click({action:'calendar-mode'});
  assert.equal((app.html().match(/class="calendar-card"/g)||[]).length,12);
  assert.match(app.html(),/month-scroll-list/);
  await app.click({action:'calendar-day',date:relativeDay(0)});
  const target=app.store.getState().tasks.find(t=>t.title==='Today grouped event');
  await app.click({action:'toggle-task',id:target.id});
  assert.ok(app.store.getState().tasks.find(t=>t.id===target.id).completed);assert.match(app.modal(),/Today grouped event/);
  await app.click({action:'new-task',date:relativeDay(0)});
  assert.ok(app.modal().includes(`value="${relativeDay(0)}"`));
});

test('System Default follows appearance changes and preserves the selected preference',async()=>{
  const app=await startApp(undefined,{demo:true,systemDark:true});
  await app.click({action:'theme'});assert.match(app.modal(),/System Default/);
  await app.submit('modal',{theme:'system'},{},'settings');
  assert.equal(app.store.getState().settings.theme,'system');assert.equal(app.document.body.dataset.theme,'dark');
  await app.setSystemDark(false);assert.equal(app.document.body.dataset.theme,'light');
  const restored=await startApp(app.storage.get('parentech.v1'),{systemDark:true});
  assert.equal(restored.store.getState().settings.theme,'system');assert.equal(restored.document.body.dataset.theme,'dark');
});

test('profile photos require a preview and confirmation before changing the account avatar',async()=>{
  const app=await startApp(undefined,{demo:true});await app.navigate('profile');
  const bytes=fs.readFileSync(path.resolve(__dirname,'../archive/legacy-frontend/assets/logo.png'));
  const photo=`data:image/png;base64,${bytes.toString('base64')}`;
  const file={name:'profile.png',type:'image/png',size:bytes.length,data:photo};
  await app.click({action:'choose-photo'});assert.equal(app.nodes.get('profile-photo').clicked,true);
  await app.changePhoto(file);assert.match(app.modal(),/Use this profile photo/);assert.match(app.modal(),/Preview of your new profile photo/);
  assert.equal(app.store.getState().user.photo,'');
  await app.click({action:'close-modal'});assert.equal(app.store.getState().user.photo,'');
  await app.changePhoto(file);await app.submit('modal',{});
  assert.equal(app.store.getState().user.photo,photo);assert.equal((app.html().match(/src="data:image\/png;base64/g)||[]).length,2);
  await app.click({action:'edit-profile'});
  const user=app.store.getState().user;
  await app.submit('modal',{name:'Updated Parent',phone:user.phone,dob:user.dob,age:String(user.age),civilStatus:user.civilStatus,role:user.role},{},'profile');
  assert.equal(app.store.getState().user.name,'Updated Parent');assert.equal(app.store.getState().user.photo,photo,'Editing profile fields must keep the confirmed photo');
  const restored=await startApp(app.storage.get('parentech.v1'));assert.equal(restored.store.getState().user.photo,photo);
});

test('a delayed profile save preserves a newer task dialog and its draft',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const app=await startApp(undefined,{demo:true,beforeApp:store=>({...store,updateProfile:async data=>{await gate;return store.updateProfile(data);}})});
  await app.navigate('profile');await app.click({action:'edit-profile'});
  const user=app.store.getState().user;
  const form=app.createForm('modal',{name:'Updated Parent',phone:user.phone,dob:user.dob,age:String(user.age),civilStatus:user.civilStatus,role:user.role},{},'profile');
  const pending=app.dispatchSubmit(form.form);await Promise.resolve();
  await app.click({action:'close-modal'});await app.click({action:'new-task',category:'family'});
  const draft=app.modal();release();await pending;
  assert.equal(app.store.getState().user.name,'Updated Parent');assert.equal(app.modal(),draft);
  assert.equal(app.nodes.get('app').inert,true);
});

test('a delayed photo read does not replace a task dialog opened afterward',async()=>{
  const app=await startApp(undefined,{demo:true});await app.navigate('profile');
  const bytes=fs.readFileSync(path.resolve(__dirname,'../archive/legacy-frontend/assets/logo.png'));
  const file={name:'profile.png',type:'image/png',size:bytes.length,data:`data:image/png;base64,${bytes.toString('base64')}`};
  let release;const gate=new Promise(resolve=>{release=resolve;});
  app.context.FileReader=class {readAsDataURL(file) {this.result=file.data;gate.then(()=>this.onload());}};
  const reading=app.changePhoto(file);await Promise.resolve();
  await app.click({action:'new-task',category:'family'});const draft=app.modal();
  release();await reading;
  assert.equal(app.modal(),draft);assert.equal(app.store.getState().user.photo,'');
});

test('reminders catch overdue items once, schedule the next time and cancel completed alerts',async()=>{
  let notifications=0,futureId;
  const future=new Date(Date.now()+5*60*1000);
  const app=await startApp(undefined,{beforeApp:store=>{
    store.demo();for(const task of store.getState().tasks)store.toggleTask(task.id);
    store.saveTask({title:'Missed reminder',date:relativeDay(-1),time:'12:00',category:'pill'});
    const date=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`;
    store.saveTask({title:'Next reminder',date,time:future.toTimeString().slice(0,5),category:'personal'});futureId=store.getState().tasks.at(-1).id;
    store.updateSettings({notifications:true});
    return {...store,markNotified:id=>{notifications++;return store.markNotified(id);}};
  }});
  assert.equal(notifications,1);await app.checkVisibility();await app.navigate('home');assert.equal(notifications,1);
  assert.ok([...app.timers.values()].some(timer=>timer.delay>239000&&timer.delay<=300000),'The next due item has its own alarm');
  assert.equal(app.intervals[0].delay,15*60*1000);
  await app.click({action:'toggle-task',id:futureId});
  assert.ok(![...app.timers.values()].some(timer=>timer.delay>239000&&timer.delay<=300000));
});
