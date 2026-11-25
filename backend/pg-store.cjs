'use strict';

const { randomBytes, randomUUID, pbkdf2, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const validation = require('../shared/validation.js');

const deriveKey = promisify(pbkdf2);
const ITERATIONS = 100000;
const DEMO_ID = 'parentech-demo';

function shanghaiDay() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function rowToAccount(row) {
  return {
    id: row.id,
    profile: {
      id: row.id,
      name: row.name,
      phone: row.phone,
      dob: row.dob || '',
      civilStatus: row.civil_status || '',
      role: row.role,
      age: validation.ageFromDOB(row.dob || '', shanghaiDay()),
      photo: row.photo || ''
    }
  };
}

function emptyOrganizerData() {
  return { tasks: [], groceries: [], purchases: [], settings: { theme: 'light', notifications: false }, profileViews: [] };
}

async function maybeUploadBlobPhoto(userId, photoValue, previousUrl) {
  if (!photoValue || !photoValue.startsWith('data:image/')) return photoValue || '';
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || typeof globalThis.fetch !== 'function') {
    // Free single-database mode: store validated <= 2 MB data URL directly in Postgres.
    return photoValue;
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(photoValue);
  if (!match) return photoValue;
  const contentType = match[1];
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const blobPath = `avatars/${userId}-${hash}.${ext}`;

  const res = await globalThis.fetch(`https://blob.vercel-storage.com/${blobPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
      'x-api-version': '7',
      'x-content-type': contentType
    },
    body: buffer
  });
  if (!res.ok) {
    throw new Error('Could not upload profile photo to storage.');
  }
  const payload = await res.json();
  if (previousUrl && /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(previousUrl) && previousUrl !== payload.url) {
    globalThis.fetch(`https://blob.vercel-storage.com/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-api-version': '7' },
      body: JSON.stringify({ urls: [previousUrl] })
    }).catch(() => {});
  }
  return payload.url || photoValue;
}

function createPostgresAccountStore(options = {}) {
  const { ApiError, shared } = options;
  const connectionString = options.databaseUrl || process.env.DATABASE_URL;
  if (!connectionString || typeof connectionString !== 'string') {
    throw new TypeError('A Postgres DATABASE_URL is required for cloud storage.');
  }

  let pool = options.pool || null;
  let schemaPromise = null;

  function getPool() {
    if (pool) return pool;
    const { Pool } = require('pg');
    const isLocal = /localhost|127\.0\.0\.1/i.test(connectionString) && !/sslmode=require/i.test(connectionString);
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 10000,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    return pool;
  }

  async function init() {
    if (schemaPromise) return schemaPromise;
    schemaPromise = (async () => {
      const db = getPool();
      await db.query(`
        CREATE TABLE IF NOT EXISTS pt_accounts (
          id TEXT PRIMARY KEY,
          phone TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          dob TEXT NOT NULL DEFAULT '',
          civil_status TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL,
          photo TEXT NOT NULL DEFAULT '',
          salt TEXT NOT NULL,
          hash TEXT NOT NULL,
          iterations INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS pt_organizer_state (
          user_id TEXT PRIMARY KEY REFERENCES pt_accounts(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
    return schemaPromise;
  }

  async function signup(input) {
    const values = validation.assert('signup', input, { today: shanghaiDay() });
    const id = randomUUID();
    const photo = await maybeUploadBlobPhoto(id, values.photo, '');
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(values.password, Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256')).toString('hex');
    await init();
    const db = getPool();
    try {
      const result = await db.query(
        `INSERT INTO pt_accounts (id, phone, name, dob, civil_status, role, photo, salt, hash, iterations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, phone, name, dob, civil_status, role, photo`,
        [id, values.phone, values.name, values.dob || '', values.civilStatus || '', values.role, photo, salt, hash, ITERATIONS]
      );
      return rowToAccount(result.rows[0]).profile;
    } catch (error) {
      if (error && error.code === '23505') throw shared.collision();
      throw error;
    }
  }

  async function login(input) {
    const values = validation.assert('login', input);
    await init();
    const db = getPool();
    const result = await db.query(
      `SELECT id, phone, name, dob, civil_status, role, photo, salt, hash, iterations
       FROM pt_accounts WHERE phone = $1 LIMIT 1`,
      [values.phone]
    );
    const row = result.rows[0] || null;
    const creds = row ? { salt: row.salt, hash: row.hash, iterations: row.iterations } : { salt: '00'.repeat(16), hash: '00'.repeat(32), iterations: ITERATIONS };
    const candidate = await deriveKey(values.password, Buffer.from(creds.salt, 'hex'), creds.iterations, 32, 'sha256');
    const matches = timingSafeEqual(candidate, Buffer.from(creds.hash, 'hex'));
    if (!row || !matches) throw shared.unauthorized(Boolean(row));
    return rowToAccount(row).profile;
  }

  async function getProfile(userId) {
    shared.requireId(userId);
    await init();
    const db = getPool();
    const result = await db.query(
      `SELECT id, phone, name, dob, civil_status, role, photo FROM pt_accounts WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!result.rows.length) throw shared.missingAccount();
    return rowToAccount(result.rows[0]).profile;
  }

  async function updateProfile(userId, input) {
    shared.requireId(userId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new validation.ValidationError({ _form: 'Please provide your profile details.' });
    }
    await init();
    const db = getPool();
    const existing = await db.query(
      `SELECT id, phone, name, dob, civil_status, role, photo FROM pt_accounts WHERE id = $1 LIMIT 1`,
      [userId]
    );
    if (!existing.rows.length) throw shared.missingAccount();
    const current = rowToAccount(existing.rows[0]).profile;
    const merged = { ...current, ...input };
    const profile = Object.prototype.hasOwnProperty.call(input, 'name')
      ? shared.profileValues(merged)
      : shared.legacyProfileValues(merged);

    let nextPhoto = profile.photo || '';
    if (Object.prototype.hasOwnProperty.call(input, 'photo') && nextPhoto && nextPhoto !== current.photo) {
      try {
        nextPhoto = await maybeUploadBlobPhoto(userId, nextPhoto, current.photo);
      } catch (_) {
        throw new ApiError(502, 'PHOTO_STORAGE_FAILED', 'Profile photo could not be uploaded. Please try again.');
      }
    }

    try {
      const updated = await db.query(
        `UPDATE pt_accounts
         SET phone = $2, name = $3, dob = $4, civil_status = $5, role = $6, photo = $7, updated_at = NOW()
         WHERE id = $1
         RETURNING id, phone, name, dob, civil_status, role, photo`,
        [userId, profile.phone, profile.name, profile.dob || '', profile.civilStatus || '', profile.role, nextPhoto]
      );
      return rowToAccount(updated.rows[0]).profile;
    } catch (error) {
      if (error && error.code === '23505') throw shared.collision();
      throw error;
    }
  }

  async function importLegacy(records) {
    if (!Array.isArray(records) || records.length > 100) {
      throw new validation.ValidationError({ records: 'Provide an array of at most 100 local accounts to import.' });
    }
    const prepared = [], skipped = [];
    records.forEach((record, index) => {
      if (record && record.id === DEMO_ID) { skipped.push({ legacyId: DEMO_ID, reason: 'demo' }); return; }
      try { prepared.push(shared.accountValues(record)); }
      catch (_) { throw new validation.ValidationError({ records: `Local account ${index + 1} has invalid profile or credential data.` }); }
    });
    await init();
    const db = getPool();
    const imported = [];
    for (const record of prepared) {
      const legacyId = record.id;
      const checkPhone = await db.query(`SELECT 1 FROM pt_accounts WHERE phone = $1 LIMIT 1`, [record.profile.phone]);
      if (checkPhone.rows.length) {
        skipped.push({ legacyId, phone: record.profile.phone, reason: 'phone_exists' });
        continue;
      }
      const checkId = await db.query(`SELECT 1 FROM pt_accounts WHERE id = $1 LIMIT 1`, [legacyId]);
      const id = checkId.rows.length ? randomUUID() : legacyId;
      const photo = await maybeUploadBlobPhoto(id, record.profile.photo, '').catch(() => record.profile.photo || '');
      try {
        const res = await db.query(
          `INSERT INTO pt_accounts (id, phone, name, dob, civil_status, role, photo, salt, hash, iterations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, phone, name, dob, civil_status, role, photo`,
          [id, record.profile.phone, record.profile.name, record.profile.dob || '', record.profile.civilStatus || '', record.profile.role, photo, record.credentials.salt, record.credentials.hash, record.credentials.iterations]
        );
        imported.push({ legacyId, profile: rowToAccount(res.rows[0]).profile });
      } catch (error) {
        if (error && error.code === '23505') {
          skipped.push({ legacyId, phone: record.profile.phone, reason: 'phone_exists' });
        } else {
          throw error;
        }
      }
    }
    return { imported, skipped };
  }

  async function getOrganizerData(userId) {
    shared.requireId(userId);
    await init();
    const db = getPool();
    const res = await db.query(`SELECT data FROM pt_organizer_state WHERE user_id = $1 LIMIT 1`, [userId]);
    if (!res.rows.length || !res.rows[0].data || typeof res.rows[0].data !== 'object') {
      return emptyOrganizerData();
    }
    const raw = res.rows[0].data;
    return {
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      groceries: Array.isArray(raw.groceries) ? raw.groceries : [],
      purchases: Array.isArray(raw.purchases) ? raw.purchases : [],
      settings: raw.settings && typeof raw.settings === 'object' ? { theme: raw.settings.theme || 'light', notifications: Boolean(raw.settings.notifications) } : { theme: 'light', notifications: false },
      profileViews: Array.isArray(raw.profileViews) ? raw.profileViews : []
    };
  }

  async function saveOrganizerData(userId, input) {
    shared.requireId(userId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new validation.ValidationError({ _form: 'Provide valid organizer data.' });
    }
    const sanitized = {
      tasks: Array.isArray(input.tasks) ? input.tasks.slice(0, 1000) : [],
      groceries: Array.isArray(input.groceries) ? input.groceries.slice(0, 1000) : [],
      purchases: Array.isArray(input.purchases) ? input.purchases.slice(0, 1000) : [],
      settings: input.settings && typeof input.settings === 'object'
        ? { theme: ['light', 'dark', 'system'].includes(input.settings.theme) ? input.settings.theme : 'light', notifications: Boolean(input.settings.notifications) }
        : { theme: 'light', notifications: false },
      profileViews: Array.isArray(input.profileViews) ? input.profileViews.slice(0, 1000) : []
    };
    await init();
    const db = getPool();
    await db.query(
      `INSERT INTO pt_organizer_state (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify(sanitized)]
    );
    return sanitized;
  }

  return Object.freeze({
    isCloud: true,
    init,
    signup,
    login,
    updateProfile,
    getProfile,
    importLegacy,
    getOrganizerData,
    saveOrganizerData
  });
}

module.exports = { createPostgresAccountStore };
