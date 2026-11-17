'use strict';

/**
 * Accounts and streaks, stored in SQLite through Node's own `node:sqlite` module —
 * so the project still has zero npm dependencies.
 *
 * Passwords are hashed with PBKDF2-HMAC-SHA256 (600,000 rounds, per OWASP guidance)
 * and a per-user random salt. The plain password is never written anywhere.
 *
 * On Google Cloud Run the container filesystem is ephemeral, so point DB_PATH at a
 * mounted volume (or move to Cloud SQL) if the data must outlive a restart. With no
 * DB_PATH set the database lives in memory, which is right for tests and demos.
 */

const crypto = require('node:crypto');

const PBKDF2_ROUNDS = 600_000;
const KEY_LEN = 32;
const SESSION_DAYS = 30;
const MAX_LOGIN_FAILURES = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

class DbError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** @param {string} password @param {string} [salt] */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ROUNDS, KEY_LEN, 'sha256').toString('hex');
  return { salt, hash };
}

/** Constant-time compare so a wrong password cannot be timed. */
function verifyPassword(password, salt, expected) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * @param {{path?: string, now?: () => number}} [opts]
 */
function createDb({ path: dbPath = process.env.DB_PATH || ':memory:', now = Date.now } = {}) {
  // Required lazily so a Node build without node:sqlite fails loudly but only on use.
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      salt       TEXT NOT NULL,
      hash       TEXT NOT NULL,
      lang       TEXT NOT NULL DEFAULT 'en',
      created    INTEGER NOT NULL,
      streak     INTEGER NOT NULL DEFAULT 0,
      best       INTEGER NOT NULL DEFAULT 0,
      last_day   TEXT,
      learned    TEXT NOT NULL DEFAULT '',
      scans      INTEGER NOT NULL DEFAULT 0,
      failures   INTEGER NOT NULL DEFAULT 0,
      locked     INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token   TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  const q = {
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    insert: db.prepare('INSERT INTO users (email, name, salt, hash, lang, created) VALUES (?, ?, ?, ?, ?, ?)'),
    newSession: db.prepare('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token = ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    sweep: db.prepare('DELETE FROM sessions WHERE expires < ?'),
    setFailure: db.prepare('UPDATE users SET failures = ?, locked = ? WHERE id = ?'),
    setProgress: db.prepare('UPDATE users SET streak = ?, best = ?, last_day = ?, learned = ?, scans = ? WHERE id = ?'),
    setLang: db.prepare('UPDATE users SET lang = ? WHERE id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM users'),
  };

  /** Public shape of a user — never includes the salt or hash. */
  const publicUser = (u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    lang: u.lang,
    streak: u.streak,
    best: u.best,
    lastDay: u.last_day,
    learned: u.learned ? u.learned.split(',').filter(Boolean) : [],
    scans: u.scans,
    created: u.created,
  });

  function validate(email, password, name) {
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
      throw new DbError(400, 'Enter a valid email address');
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      throw new DbError(400, 'Password must be at least 8 characters');
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 60) {
      throw new DbError(400, 'Enter your name');
    }
  }

  function startSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expires = now() + SESSION_DAYS * 86_400_000;
    q.sweep.run(now());
    q.newSession.run(token, userId, expires);
    return { token, expires };
  }

  return {
    signup({ email, password, name, lang = 'en' }) {
      validate(email, password, name);
      const clean = email.trim().toLowerCase();
      if (q.byEmail.get(clean)) throw new DbError(409, 'An account with that email already exists');
      const { salt, hash } = hashPassword(password);
      const info = q.insert.run(clean, name.trim(), salt, hash, lang, now());
      const user = q.byId.get(info.lastInsertRowid);
      return { user: publicUser(user), session: startSession(user.id) };
    },

    login({ email, password }) {
      const clean = String(email || '').trim().toLowerCase();
      const user = q.byEmail.get(clean);
      // Same message and similar work either way, so accounts can't be enumerated.
      if (!user) {
        hashPassword(String(password || ''), 'decoy-salt');
        throw new DbError(401, 'Email or password is incorrect');
      }
      if (user.locked > now()) throw new DbError(429, 'Too many attempts. Try again in a few minutes.');
      if (!verifyPassword(String(password || ''), user.salt, user.hash)) {
        const failures = user.failures + 1;
        q.setFailure.run(failures, failures >= MAX_LOGIN_FAILURES ? now() + LOCKOUT_MS : 0, user.id);
        throw new DbError(401, 'Email or password is incorrect');
      }
      q.setFailure.run(0, 0, user.id);
      return { user: publicUser(user), session: startSession(user.id) };
    },

    /** @param {string} token @returns {object|null} */
    userForToken(token) {
      if (!token) return null;
      const s = q.session.get(token);
      if (!s) return null;
      if (s.expires < now()) {
        q.dropSession.run(token);
        return null;
      }
      const user = q.byId.get(s.user_id);
      return user ? publicUser(user) : null;
    },

    logout(token) {
      if (token) q.dropSession.run(token);
    },

    /**
     * Record a visit: extends the streak when it is the next day, resets it after a
     * gap, and leaves it alone on repeat visits the same day.
     * @param {number} userId
     * @param {{learned?: string[], scanned?: boolean}} [progress]
     */
    checkIn(userId, progress = {}) {
      const user = q.byId.get(userId);
      if (!user) throw new DbError(404, 'No such user');
      const day = today(now());
      let streak = user.streak;
      if (user.last_day !== day) {
        const gap = user.last_day ? daysBetween(user.last_day, day) : null;
        streak = gap === 1 ? user.streak + 1 : 1;
      }
      const learned = new Set((user.learned || '').split(',').filter(Boolean));
      for (const id of progress.learned || []) learned.add(id);
      const scans = user.scans + (progress.scanned ? 1 : 0);
      q.setProgress.run(streak, Math.max(streak, user.best), day, [...learned].join(','), scans, userId);
      return publicUser(q.byId.get(userId));
    },

    setLanguage(userId, lang) {
      q.setLang.run(lang, userId);
      return publicUser(q.byId.get(userId));
    },

    get userCount() {
      return q.count.get().n;
    },
    close() {
      db.close();
    },
  };
}

module.exports = { createDb, DbError, hashPassword, verifyPassword, today, daysBetween };
