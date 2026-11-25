(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PTValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const LIMITS = Object.freeze({ name: 80, password: 128, taskTitle: 120, description: 500, grocery: 100, email: 150, screenshotBytes: 10 * 1024 * 1024, profilePhotoBytes: 2 * 1024 * 1024, age: 150 });
  const CATEGORIES = Object.freeze(['personal', 'family', 'household', 'pill']);
  const ROLES = Object.freeze(['Mom', 'Dad', 'Solo Parent']);
  const CIVIL_STATUSES = Object.freeze(['Single', 'Married', 'Widowed', 'Divorced', 'Separated', 'Civil Partnership']);
  const REPORT_CATEGORIES = Object.freeze(['Bug / Crash', 'Feature Request', 'UI Issue', 'Account Issue', 'Other']);
  const OWN = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/;
  const NON_TEXT_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

  class ValidationError extends Error {
    constructor(fields) {
      const errors = fields && typeof fields === 'object' ? { ...fields } : { _form: 'Please check your input.' };
      super(Object.values(errors)[0] || 'Please check your input.');
      this.name = 'ValidationError';
      this.code = 'VALIDATION_ERROR';
      this.fields = errors;
    }
  }

  function localDay(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }
  function ageFromDOB(dob, today = localDay()) {
    if (!isValidDate(dob) || !isValidDate(today) || dob > today) return null;
    const [birthYear, birthMonth, birthDay] = dob.split('-').map(Number);
    const [year, month, day] = today.split('-').map(Number);
    return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
  }
  function isValidId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
  }
  function normalizePhone(value) {
    const message = 'Enter a valid Philippine mobile number, such as 0917 123 4567.';
    if (typeof value !== 'string' || value.length > 40 || CONTROLS.test(value) || !/^[+\d\s().-]+$/.test(value)) throw new ValidationError({ phone: message });
    let phone = value.replace(/[\s().-]/g, '');
    if (/^09\d{9}$/.test(phone)) phone = '+63' + phone.slice(1);
    else if (/^9\d{9}$/.test(phone)) phone = '+63' + phone;
    else if (/^639\d{9}$/.test(phone)) phone = '+' + phone;
    if (!/^\+639\d{9}$/.test(phone)) throw new ValidationError({ phone: message });
    return phone;
  }
  function normalizeGroceryName(value) {
    if (typeof value !== 'string' || NON_TEXT_CONTROLS.test(value)) throw new ValidationError({ groceryName: 'Enter a grocery item without control characters.' });
    const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!name) throw new ValidationError({ groceryName: 'Please enter a grocery item.' });
    if (name.length > LIMITS.grocery) throw new ValidationError({ groceryName: `Grocery items must be ${LIMITS.grocery} characters or fewer.` });
    return name;
  }
  function filenameError(value) {
    if (typeof value !== 'string' || !value.trim()) return 'Choose a file with a valid filename.';
    if (CONTROLS.test(value)) return 'Screenshot filenames must not contain paths or control characters.';
    const name = value.normalize('NFC').trim();
    if (name.length > 255) return 'Screenshot filenames must be 255 characters or fewer.';
    if (CONTROLS.test(name) || /[/\\]/.test(name) || /^[A-Za-z]:/.test(name) || name === '.' || name === '..') return 'Screenshot filenames must not contain paths or control characters.';
    return '';
  }
  function validateScreenshot(file) {
    if (file === undefined || file === null) return '';
    if (typeof file !== 'object' || Array.isArray(file)) return 'Choose a valid screenshot file.';
    const nameError = filenameError(file.name);
    if (nameError) return nameError;
    if (!Number.isInteger(file.size) || file.size <= 0) return 'Choose a screenshot that is not empty.';
    if (file.size > LIMITS.screenshotBytes) return 'Screenshots must be 10 MB or smaller.';
    const extension = file.name.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    const expectedType = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }[extension];
    if (!expectedType || typeof file.type !== 'string' || file.type.toLowerCase() !== expectedType) return 'Choose a PNG, JPG, or WebP image with a matching file type.';
    return '';
  }
  function validateProfilePhoto(value) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') return 'Choose a valid profile photo.';
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) return 'Choose a PNG, JPG, or WebP profile photo.';
    const base64 = match[2], padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const size = base64.length / 4 * 3 - padding;
    if (size > LIMITS.profilePhotoBytes) return 'Profile photos must be 2 MB or smaller.';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = [];
    let buffer = 0, bits = 0;
    for (const character of base64.slice(0, 24)) {
      if (character === '=') break;
      buffer = (buffer << 6) | alphabet.indexOf(character); bits += 6;
      if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
    }
    const isPNG = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    const isJPEG = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const isWebP = [82, 73, 70, 70].every((byte, index) => bytes[index] === byte) && [87, 69, 66, 80].every((byte, index) => bytes[index + 8] === byte);
    if (!(match[1] === 'image/png' && isPNG || match[1] === 'image/jpeg' && isJPEG || match[1] === 'image/webp' && isWebP)) return 'The profile photo contents do not match its image type.';
    return '';
  }
  function emailIsValid(email) {
    if (!/^[\x21-\x7e]+$/.test(email)) return false;
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (!local || local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    const labels = domain.split('.');
    if (labels.length < 2 || labels.some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return false;
    return /^(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{2,59})$/i.test(labels.at(-1));
  }

  function check(kind, input, context = {}) {
    const values = {}, errors = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, values, errors: { _form: 'Please provide an object containing your input.' } };
    if (!context || typeof context !== 'object' || Array.isArray(context)) context = {};
    function fail(field, message) { if (!OWN(errors, field)) errors[field] = message; }
    function string(field, { required = true, max = 500, multiline = false, collapse = false, label = field } = {}) {
      const raw = input[field];
      if (raw === undefined && !required) { values[field] = ''; return ''; }
      if (typeof raw !== 'string') { fail(field, `Enter ${label} as text.`); values[field] = ''; return ''; }
      if ((multiline ? NON_TEXT_CONTROLS : CONTROLS).test(raw)) fail(field, `${label[0].toUpperCase() + label.slice(1)} must not contain control characters.`);
      let value = raw.normalize('NFC').trim();
      if (collapse) value = value.replace(/\s+/gu, ' ');
      values[field] = value;
      if (required && !value) fail(field, `Please enter ${label}.`);
      if (value.length > max) fail(field, `${label[0].toUpperCase() + label.slice(1)} must be ${max} characters or fewer.`);
      return value;
    }
    function enumField(field, allowed, label) {
      if (!allowed.includes(input[field])) { fail(field, `Choose ${label}.`); return; }
      values[field] = input[field];
    }
    function phoneField() {
      try { values.phone = normalizePhone(input.phone); }
      catch (error) { fail('phone', error.message); }
    }
    function profileFields() {
      const name = string('name', { max: LIMITS.name, collapse: true, label: 'your full name' });
      if (name && (!/^[\p{L}\p{M}\p{Pd} .'\u2018\u2019]+$/u.test(name) || !/\p{L}/u.test(name))) fail('name', 'Use letters, spaces, apostrophes, hyphens, and periods for your name.');
      phoneField();
      const today = isValidDate(context.today) ? context.today : localDay();
      if (input.dob === undefined || input.dob === null || input.dob === '') values.dob = '';
      else if (!isValidDate(input.dob)) fail('dob', 'Choose a valid date of birth.');
      else if (input.dob > today) fail('dob', 'Date of birth must not be in the future.');
      else values.dob = input.dob;
      if (input.age === undefined) values.age = values.dob ? ageFromDOB(values.dob, today) : null;
      else if (input.age === null || input.age === '') values.age = null;
      else {
        const age = typeof input.age === 'string' && /^\d{1,3}$/.test(input.age.trim()) ? Number(input.age.trim()) : input.age;
        if (!Number.isInteger(age) || age < 0 || age > LIMITS.age) fail('age', 'Enter an age from 0 to 150, or leave it blank.');
        else values.age = age;
      }
      if (input.civilStatus === undefined || input.civilStatus === null || input.civilStatus === '') values.civilStatus = '';
      else enumField('civilStatus', CIVIL_STATUSES, 'a civil status');
      enumField('role', ROLES, 'Mom, Dad, or Solo Parent as your role');
      const photoError = validateProfilePhoto(input.photo);
      if (photoError) fail('photo', photoError);
      else values.photo = input.photo || '';
    }
    function passwordField(signup) {
      const password = input.password;
      if (typeof password !== 'string' || password.length === 0) { fail('password', 'Please enter your password.'); return; }
      values.password = password;
      if (CONTROLS.test(password)) fail('password', 'Passwords must not contain control characters.');
      if (password.length > LIMITS.password) fail('password', `Password must be ${LIMITS.password} characters or fewer.`);
      if (signup && (password.length < 8 || !/\p{Lu}/u.test(password) || !/\p{Nd}/u.test(password))) fail('password', 'Use 8+ characters with an uppercase letter and a number.');
    }
    switch (kind) {
      case 'signup':
        profileFields(); passwordField(true);
        if (typeof input.confirmPassword !== 'string' || !input.confirmPassword) fail('confirmPassword', 'Please confirm your password.');
        else {
          values.confirmPassword = input.confirmPassword;
          if (input.confirmPassword !== input.password) fail('confirmPassword', 'Your passwords do not match.');
          if (CONTROLS.test(input.confirmPassword)) fail('confirmPassword', 'Passwords must not contain control characters.');
          if (input.confirmPassword.length > LIMITS.password) fail('confirmPassword', `Password must be ${LIMITS.password} characters or fewer.`);
        }
        break;
      case 'login': phoneField(); passwordField(false); break;
      case 'profile': profileFields(); break;
      case 'task':
        if (OWN(input, 'id')) {
          if (!isValidId(input.id)) fail('id', 'Choose a valid task identifier.');
          else values.id = input.id;
        }
        string('title', { max: LIMITS.taskTitle, label: 'a task title' });
        string('description', { required: false, max: LIMITS.description, multiline: true, label: 'task description' });
        if (!isValidDate(input.date)) fail('date', 'Choose a valid task date.'); else values.date = input.date;
        if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) fail('time', 'Choose a valid task time.'); else values.time = input.time;
        enumField('category', CATEGORIES, 'a task category');
        break;
      case 'grocery': {
        const raw = OWN(input, 'groceryName') ? input.groceryName : input.name;
        try {
          const name = normalizeGroceryName(raw);
          values.groceryName = name;
          const canonical = name.toLowerCase();
          const groceries = Array.isArray(context.groceries) ? context.groceries : [];
          const duplicate = groceries.some(item => {
            if (item && typeof item === 'object' && item.id === context.excludeId && context.excludeId !== undefined) return false;
            const existingName = typeof item === 'string' ? item : item && item.name;
            return typeof existingName === 'string' && existingName.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase() === canonical;
          });
          if (duplicate) fail('groceryName', 'That item is already on your grocery list.');
        } catch (error) { fail('groceryName', error.message); }
        break;
      }
      case 'report': {
        enumField('category', REPORT_CATEGORIES, 'an issue category');
        const description = string('description', { max: LIMITS.description, multiline: true, label: 'a description of the problem' });
        const email = string('email', { required: false, max: LIMITS.email, label: 'an email address' });
        if (email && !emailIsValid(email)) fail('email', 'Enter a valid email address, or leave it blank.');
        else if (email) { const [local, domain] = email.split('@'); values.email = `${local}@${domain.toLowerCase()}`; }
        if (input.screenshotName === undefined || input.screenshotName === '') values.screenshotName = '';
        else {
          const error = filenameError(input.screenshotName);
          if (error) fail('screenshotName', error);
          else values.screenshotName = input.screenshotName.normalize('NFC').trim();
        }
        break;
      }
      case 'settings':
        if (OWN(input, 'theme')) enumField('theme', ['light', 'dark', 'system'], 'light, dark, or system mode');
        if (OWN(input, 'notifications')) {
          if (typeof input.notifications !== 'boolean') fail('notifications', 'Choose true or false for notification alerts.');
          else values.notifications = input.notifications;
        }
        if (!OWN(input, 'theme') && !OWN(input, 'notifications')) fail('_form', 'Choose a preference to update.');
        break;
      default: fail('_form', 'Choose a valid input type.');
    }
    return { valid: Object.keys(errors).length === 0, values, errors };
  }
  function assert(kind, input, context) {
    const result = check(kind, input, context);
    if (!result.valid) throw new ValidationError(result.errors);
    return result.values;
  }
  return Object.freeze({ LIMITS, CATEGORIES, ROLES, CIVIL_STATUSES, REPORT_CATEGORIES, ValidationError, check, assert, localDay, isValidDate, isValidId, ageFromDOB, normalizePhone, normalizeGroceryName, validateScreenshot, validateProfilePhoto });
});
