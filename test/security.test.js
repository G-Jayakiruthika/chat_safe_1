'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const { createApp } = require('../src/app');
const { createDb, hashPassword, verifyPassword, encryptText, decryptText, deriveAesKey } = require('../src/db');

function runReq(handler, { method = 'GET', url = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const raw = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const req = new Readable({
      read() {
        if (raw) this.push(raw);
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:8080', ...headers };
    if (body !== null && !req.headers['content-type']) req.headers['content-type'] = 'application/json';
    req.socket = { remoteAddress: '127.0.0.1', encrypted: true };

    const resHeaders = {};
    const chunks = [];
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
      writeHead(code, hdrs = {}) {
        res.statusCode = code;
        res.headersSent = true;
        for (const [k, v] of Object.entries(hdrs)) resHeaders[k.toLowerCase()] = v;
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-json */ }
        resolve({ status: res.statusCode, headers: resHeaders, text, json });
      },
    };
    handler(req, res).catch(reject);
  });
}

test('Argon2id hashing verifies in constant time & AES-256-GCM encrypts PII', () => {
  const { salt, hash } = hashPassword('StrongPass#2026');
  assert.ok(hash.startsWith('argon2id$'));
  assert.equal(verifyPassword('StrongPass#2026', salt, hash), true);
  assert.equal(verifyPassword('wrongpass', salt, hash), false);

  const key = deriveAesKey('super-secret-data-encryption-key-32b');
  const cipher = encryptText('Ward 12, Coimbatore', key);
  assert.ok(cipher.startsWith('enc:v1:'));
  assert.notEqual(cipher, 'Ward 12, Coimbatore');
  assert.equal(decryptText(cipher, key), 'Ward 12, Coimbatore');
});

test('ISO Privacy consent enforcement, CSRF defense, SQL injection resistance, Reset tokens, Export & Erasure', async () => {
  let clock = 1_700_000_000_000;
  let issuedReset = null;
  const db = createDb({ path: ':memory:', now: () => clock, encryptionKey: 'test-aes-key-32-bytes-minimum-ok' });
  const handler = createApp({
    db,
    env: { ADMIN_API_KEY: 'admin-secret-999', ALLOWED_ORIGIN: 'https://app.chatsafe.in' },
    onResetToken: (r) => { issuedReset = r; },
    logger: { error() {} },
  });

  // 1. Signup without Privacy/Age consent must fail 400
  const noConsent = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/signup',
    body: { name: 'Meena', email: 'meena@example.in', password: 'Password#123', consent: false, ageConsent: true },
  });
  assert.equal(noConsent.status, 400);

  // 2. Bot honeypot rejected cleanly
  const botTry = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/signup',
    body: { name: 'Bot', email: 'bot@example.in', password: 'Password#123', consent: true, ageConsent: true, website: 'http://spam.xyz' },
  });
  assert.equal(botTry.status, 400);

  // 3. Disallowed CORS Origin blocked on POST
  const badCors = await runReq(handler, {
    method: 'POST',
    url: '/api/analyze',
    headers: { origin: 'https://evil.attacker.example' },
    body: { text: 'hello' },
  });
  assert.equal(badCors.status, 403);

  // 4. Valid signup returns session + CSRF cookies
  const signed = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/signup',
    headers: { origin: 'https://app.chatsafe.in' },
    body: {
      name: 'Meena Sundaram',
      email: "meena@example.in",
      city: 'Ward 12, Coimbatore',
      password: 'Password#123',
      consent: true,
      ageConsent: true,
      marketingOptIn: true,
    },
  });
  assert.equal(signed.status, 201);
  assert.equal(signed.headers['access-control-allow-origin'], 'https://app.chatsafe.in');
  const setCookies = Array.isArray(signed.headers['set-cookie']) ? signed.headers['set-cookie'] : [signed.headers['set-cookie']];
  const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
  const csrf = signed.json.csrfToken;
  assert.ok(csrf);

  // 5. SQL injection attempt in login safely returns 401 and does not drop table
  const sqli = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: "' OR 1=1; DROP TABLE users;--", password: 'Password#123' },
  });
  assert.equal(sqli.status, 401);
  assert.equal(db.userCount, 1);

  // 6. State-changing PUT /api/privacy/profile rejects missing CSRF header (403) and accepts valid CSRF (200)
  const csrfFail = await runReq(handler, {
    method: 'PUT',
    url: '/api/privacy/profile',
    headers: { cookie: cookieHeader },
    body: { city: 'Ward 4, Madurai' },
  });
  assert.equal(csrfFail.status, 403);

  const csrfOk = await runReq(handler, {
    method: 'PUT',
    url: '/api/privacy/profile',
    headers: { cookie: cookieHeader, 'x-csrf-token': csrf },
    body: { city: 'Ward 4, Madurai', marketingOptIn: false },
  });
  assert.equal(csrfOk.status, 200);
  assert.equal(csrfOk.json.user.city, 'Ward 4, Madurai');
  assert.equal(csrfOk.json.user.marketingOptIn, false);

  // 7. Data export returns ISO JSON without password hash/salt
  const exported = await runReq(handler, {
    method: 'GET',
    url: '/api/privacy/export',
    headers: { cookie: cookieHeader },
  });
  assert.equal(exported.status, 200);
  assert.equal(exported.json.account.email, 'meena@example.in');
  assert.equal(exported.json.account.hash, undefined);
  assert.equal(exported.json.account.salt, undefined);

  // 8. Expiring 15-min password reset flow & session revocation
  const reqReset = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/request-reset',
    body: { email: 'meena@example.in' },
  });
  assert.equal(reqReset.status, 200);
  assert.ok(issuedReset?.token);

  clock += 16 * 60 * 1000; // advance 16 minutes -> expired!
  const expiredReset = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/reset-password',
    body: { token: issuedReset.token, newPassword: 'NewPassword#456' },
  });
  assert.equal(expiredReset.status, 400);

  // Fresh reset within 15 minutes succeeds and revokes old session
  await runReq(handler, { method: 'POST', url: '/api/auth/request-reset', body: { email: 'meena@example.in' } });
  const freshReset = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/reset-password',
    body: { token: issuedReset.token, newPassword: 'NewPassword#456' },
  });
  assert.equal(freshReset.status, 200);

  const oldSessionCheck = await runReq(handler, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: cookieHeader },
  });
  assert.equal(oldSessionCheck.status, 401);

  // Login with new password + Right to Erasure DELETE /api/auth/account
  const reLogin = await runReq(handler, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'meena@example.in', password: 'NewPassword#456' },
  });
  assert.equal(reLogin.status, 200);
  const newCookies = reLogin.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  const delRes = await runReq(handler, {
    method: 'DELETE',
    url: '/api/auth/account',
    headers: { cookie: newCookies, 'x-csrf-token': reLogin.json.csrfToken },
  });
  assert.equal(delRes.status, 200);
  assert.equal(db.userCount, 0);

  // 9. Admin route locked without Bearer ADMIN_API_KEY & dotfile/.env blocked
  const adminDenied = await runReq(handler, { method: 'GET', url: '/api/admin/audit' });
  assert.equal(adminDenied.status, 403);
  const adminAllowed = await runReq(handler, {
    method: 'GET',
    url: '/api/admin/audit',
    headers: { authorization: 'Bearer admin-secret-999' },
  });
  assert.equal(adminAllowed.status, 200);
  assert.ok(adminAllowed.json.events.length >= 1);

  const exposedEnv = await runReq(handler, { method: 'GET', url: '/.env' });
  assert.equal(exposedEnv.status, 403);

  db.close();
});

test('Database & API handle concurrent load spike cleanly without crashes', async () => {
  const db = createDb({ path: ':memory:' });
  const handler = createApp({
    db,
    env: { MAX_CONCURRENT_REQUESTS: '25' },
    rateLimit: { windowMs: 60_000, max: 500 },
    logger: { error() {} },
  });

  // 40 parallel health/radar/analyze requests must all resolve cleanly (200 or controlled 503 backpressure)
  const batch = Array.from({ length: 40 }, (_, i) =>
    runReq(handler, {
      method: 'POST',
      url: '/api/analyze',
      body: { text: `Check scam alert message #${i} asking for OTP`, lang: 'en' },
    }),
  );
  const results = await Promise.all(batch);
  assert.equal(results.length, 40);
  for (const r of results) {
    assert.ok(r.status === 200 || r.status === 503);
  }
  db.close();
});
