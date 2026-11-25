'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, randomUUID, pbkdf2, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const validation = require('../shared/validation.js');
const deriveKey = promisify(pbkdf2);
const queues = new Map();
const ITERATIONS = 100000;
const DEMO_ID = 'parentech-demo';

class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = { ...fields };
  }
}

function enqueue(filePath, work) {
  const previous = queues.get(filePath) || Promise.resolve();
  const operation = previous.catch(() => {}).then(work);
  queues.set(filePath, operation);
  const cleanup = () => { if (queues.get(filePath) === operation) queues.delete(filePath); };
  operation.then(cleanup, cleanup);
  return operation;
}
function publicProfile(account) { return { id: account.id, ...account.profile, age: validation.ageFromDOB(account.profile.dob, shanghaiDay()) }; }
function shanghaiDay() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function profileValues(input) {
  const values = validation.assert('profile', input, { today: shanghaiDay() });
  return { name: values.name, phone: values.phone, dob: values.dob, civilStatus: values.civilStatus, role: values.role, age: values.age, photo: values.photo };
}
function legacyProfileValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > validation.LIMITS.name || /[\u0000-\u001f\u007f-\u009f]/.test(input.name)) throw new Error('Invalid stored profile name.');
  // Earlier versions allowed digits and punctuation in names. Those names are
  // ordinary escaped text; apply new name rules only when the user edits them.
  const values = profileValues({ ...input, name: 'Legacy Parent' });
  return { ...values, name: input.name.trim() };
}
function credentialsValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.salt !== 'string' || !/^[a-f0-9]{32}$/i.test(input.salt) || typeof input.hash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.hash) || !Number.isInteger(input.iterations) || input.iterations < ITERATIONS || input.iterations > 1000000) throw new Error('Invalid account credentials.');
  return { salt: input.salt.toLowerCase(), hash: input.hash.toLowerCase(), iterations: input.iterations };
}
function accountValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !validation.isValidId(input.id) || input.id === DEMO_ID) throw new Error('Invalid account record.');
  return { id: input.id, profile: legacyProfileValues(input.profile), credentials: credentialsValues(input.credentials) };
}
function databaseValues(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1 || !Array.isArray(input.accounts)) throw new Error('Unsupported account database format.');
  const accounts = input.accounts.map(accountValues);
  const phones = new Set(), ids = new Set();
  for (const account of accounts) {
    if (phones.has(account.profile.phone) || ids.has(account.id)) throw new Error('Duplicate account identity in database.');
    phones.add(account.profile.phone); ids.add(account.id);
  }
  return { version: 1, accounts };
}
function collision() {
  const message = 'An account with this phone number already exists. Please log in.';
  return new ApiError(409, 'PHONE_EXISTS', message, { phone: message });
}
function unauthorized(found) {
  const message = found ? 'The password is incorrect. Please try again.' : 'No account is registered with this phone number. Please sign up.';
  return new ApiError(401, found ? 'WRONG_PASSWORD' : 'PHONE_NOT_REGISTERED', message, { [found ? 'password' : 'phone']: message });
}
function missingAccount() { return new ApiError(404, 'ACCOUNT_NOT_FOUND', 'This account could not be found.'); }
function requireId(id) {
  if (!validation.isValidId(id)) throw new validation.ValidationError({ id: 'Choose a valid account identifier.' });
}

function createAccountStore(options = {}) {
  const useCloud = Boolean(options.databaseUrl || (!options.filePath && process.env.DATABASE_URL));
  if (useCloud) {
    const { createPostgresAccountStore } = require('./pg-store.cjs');
    return createPostgresAccountStore({
      ...options,
      ApiError,
      shared: { profileValues, legacyProfileValues, accountValues, collision, unauthorized, missingAccount, requireId }
    });
  }
  const requestedPath = options.filePath || path.join(__dirname, 'data', 'accounts.json');
  if (typeof requestedPath !== 'string' || !requestedPath.trim()) throw new TypeError('An account database file path is required.');
  const filePath = path.resolve(requestedPath);

  async function readDatabase() {
    let raw;
    try { raw = await fs.readFile(filePath, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') throw error;
      throw new ApiError(500, 'ACCOUNT_STORE_READ_FAILED', 'The account database could not be read.');
    }
    try { return databaseValues(JSON.parse(raw)); }
    catch (_) { throw new ApiError(500, 'ACCOUNT_STORE_CORRUPT', 'The account database is invalid. Its contents have been preserved; repair the file before continuing.'); }
  }

  async function atomicWrite(database, createOnly = false) {
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(database, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
      if (createOnly) {
        // An exclusive hard link publishes the complete initial file without
        // replacing a database another process may have created meanwhile.
        try {
          await fs.link(temporaryPath, filePath);
        } catch (linkError) {
          if (linkError.code === 'EEXIST') return false;
          await fs.writeFile(filePath, JSON.stringify(database, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
        }
      } else {
        await fs.rename(temporaryPath, filePath);
      }
    } catch (error) {
      if (createOnly && error.code === 'EEXIST') return false;
      throw new ApiError(500, 'ACCOUNT_STORE_WRITE_FAILED', 'The account database could not be saved. Existing data has been preserved.');
    } finally {
      await fs.unlink(temporaryPath).catch(() => {});
    }
    return true;
  }

  async function init() {
    return enqueue(filePath, async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      try { await readDatabase(); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await atomicWrite({ version: 1, accounts: [] }, true);
        await readDatabase();
      }
    });
  }

  async function readReady() {
    try { return await readDatabase(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await init();
      return readDatabase();
    }
  }

  async function signup(input) {
    const values = validation.assert('signup', input, { today: shanghaiDay() });
    const profile = { name: values.name, phone: values.phone, dob: values.dob, civilStatus: values.civilStatus, role: values.role, age: values.age, photo: values.photo };
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(values.password, Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256')).toString('hex');
    await init();
    return enqueue(filePath, async () => {
      const database = await readDatabase();
      if (database.accounts.some(account => account.profile.phone === profile.phone)) throw collision();
      const account = { id: randomUUID(), profile, credentials: { salt, hash, iterations: ITERATIONS } };
      database.accounts.push(account);
      await atomicWrite(database);
      return publicProfile(account);
    });
  }

  async function login(input) {
    const values = validation.assert('login', input);
    const database = await readReady();
    const account = database.accounts.find(account => account.profile.phone === values.phone);
    // A dummy derivation also runs when the phone is absent, keeping the failure
    // path comparable without revealing whether a phone has registered.
    const credentials = account ? account.credentials : { salt: '00'.repeat(16), hash: '00'.repeat(32), iterations: ITERATIONS };
    const candidate = await deriveKey(values.password, Buffer.from(credentials.salt, 'hex'), credentials.iterations, 32, 'sha256');
    const matches = timingSafeEqual(candidate, Buffer.from(credentials.hash, 'hex'));
    if (!account || !matches) throw unauthorized(Boolean(account));
    return publicProfile(account);
  }

  async function updateProfile(userId, input) {
    requireId(userId);
    await init();
    return enqueue(filePath, async () => {
      const database = await readDatabase();
      const account = database.accounts.find(account => account.id === userId);
      if (!account) throw missingAccount();
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new validation.ValidationError({ _form: 'Please provide your profile details.' });
      const merged = { ...account.profile, ...input };
      // A photo-only or other partial update preserves previously valid names.
      // An explicitly edited name is checked using the current registration rules.
      const profile = Object.prototype.hasOwnProperty.call(input, 'name') ? profileValues(merged) : legacyProfileValues(merged);
      if (database.accounts.some(other => other.id !== userId && other.profile.phone === profile.phone)) throw collision();
      account.profile = profile;
      await atomicWrite(database);
      return publicProfile(account);
    });
  }

  async function getProfile(userId) {
    requireId(userId);
    const database = await readReady();
    const account = database.accounts.find(account => account.id === userId);
    if (!account) throw missingAccount();
    return publicProfile(account);
  }

  async function importLegacy(records) {
    if (!Array.isArray(records) || records.length > 100) throw new validation.ValidationError({ records: 'Provide an array of at most 100 local accounts to import.' });
    const prepared = [], skipped = [];
    records.forEach((record, index) => {
      if (record && record.id === DEMO_ID) { skipped.push({ legacyId: DEMO_ID, reason: 'demo' }); return; }
      try { prepared.push(accountValues(record)); }
      catch (_) { throw new validation.ValidationError({ records: `Local account ${index + 1} has invalid profile or credential data.` }); }
    });
    await init();
    return enqueue(filePath, async () => {
      const database = await readDatabase();
      const imported = [];
      for (const record of prepared) {
        const legacyId = record.id;
        if (database.accounts.some(account => account.profile.phone === record.profile.phone)) {
          skipped.push({ legacyId, phone: record.profile.phone, reason: 'phone_exists' });
          continue;
        }
        const id = database.accounts.some(account => account.id === legacyId) ? randomUUID() : legacyId;
        const account = { ...record, id };
        database.accounts.push(account);
        imported.push({ legacyId, profile: publicProfile(account) });
      }
      if (imported.length) await atomicWrite(database);
      return { imported, skipped };
    });
  }

  return Object.freeze({ init, signup, login, updateProfile, getProfile, importLegacy });
}

module.exports = { createAccountStore, ApiError };
