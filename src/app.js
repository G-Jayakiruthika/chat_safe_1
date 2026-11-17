'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { createEngine, InputError, MAX_TEXT_CHARS } = require('./engine');
const { createGeminiClient } = require('./gemini');
const { createIntegrations } = require('./integrations');
const { createLru } = require('./lru');
const { DbError } = require('./db');
const { buildCore } = require('../tools/build-core');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 16 * 1024;
const MAX_WEBHOOK_BYTES = 256 * 1024;
const RATE_LIMIT = { windowMs: 60_000, max: 40 };

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
});

const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://generativelanguage.googleapis.com https://maps.googleapis.com https://safebrowsing.googleapis.com; " +
    "media-src 'self' blob: data:; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; " +
    "frame-ancestors 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createRateLimiter({ windowMs, max }, now = Date.now) {
  const hits = new Map();
  return (key) => {
    const t = now();
    const entry = hits.get(key);
    if (!entry || t - entry.start >= windowMs) {
      hits.set(key, { start: t, count: 1 });
      if (hits.size > 10_000) hits.clear();
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME['.json'],
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function sendText(res, status, text) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        reject(new HttpError(413, 'Request too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function readJson(req, limit = MAX_BODY_BYTES) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  const raw = await readRaw(req, limit);
  try {
    const parsed = JSON.parse(raw.toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

const SESSION_COOKIE = 'cs_session';

function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

function sessionCookie(token, expires, secure) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expires).toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function createApp(deps = {}) {
  const engine = createEngine({ gemini: deps.gemini, logger: deps.logger });
  const env = deps.env || process.env;
  const db = deps.db || null;
  const allow = createRateLimiter(deps.rateLimit || RATE_LIMIT);
  const coreBundle = buildCore();
  const seenEvents = createLru(500);
  const integrations = createIntegrations({
    engine,
    env,
    fetchImpl: deps.fetchImpl,
    logger: deps.logger,
    seen: seenEvents,
  });

  function serveStatic(pathname, res) {
    if (pathname === '/core.js') {
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': MIME['.js'],
        'Content-Length': Buffer.byteLength(coreBundle),
        'Cache-Control': 'no-cache',
      });
      res.end(coreBundle);
      return;
    }
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(PUBLIC_DIR, rel);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': data.length,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      });
      res.end(data);
    });
  }

  return async function handle(req, res) {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, { ok: true, ai: engine.aiEnabled(), accounts: Boolean(db), urimai: true, maxChars: MAX_TEXT_CHARS });
      return;
    }
    if (pathname === '/api/languages' && method === 'GET') {
      sendJson(res, 200, engine.languages());
      return;
    }
    if (pathname === '/api/integrations' && method === 'GET') {
      sendJson(res, 200, integrations.status());
      return;
    }
    if (pathname === '/api/radar' && method === 'GET') {
      sendJson(res, 200, await engine.radar({ city: url.searchParams.get('city') || 'All' }));
      return;
    }
    if (pathname === '/api/portals' && method === 'GET') {
      sendJson(res, 200, engine.portals());
      return;
    }

    if (pathname === '/webhooks/telegram' && method === 'POST') {
      const raw = await readRaw(req, MAX_WEBHOOK_BYTES);
      const r = await integrations.handleTelegram(req.headers, raw);
      sendJson(res, r.status, r.body);
      return;
    }
    if (pathname === '/webhooks/meta') {
      if (method === 'GET') {
        const r = integrations.verifyMetaChallenge(url.searchParams);
        sendText(res, r.status, r.text);
        return;
      }
      if (method === 'POST') {
        const raw = await readRaw(req, MAX_WEBHOOK_BYTES);
        const r = await integrations.handleMeta(req.headers, raw);
        sendJson(res, r.status, r.body);
        return;
      }
    }

  async function safeBrowsingRoute(body) {
    const base = await engine.safebrowsing(body);
    const key = env.SAFE_BROWSING_API_KEY || '';
    const fetchImpl = deps.fetchImpl || globalThis.fetch;
    if (!key || !base.urls.length || typeof fetchImpl !== 'function') return base;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const apiRes = await fetchImpl(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          client: { clientId: 'chatsafe-urimai', clientVersion: '3.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: base.urls.map((url) => ({ url })),
          },
        }),
      });
      if (!apiRes.ok) return { ...base, apiStatus: apiRes.status };
      const data = await apiRes.json();
      const apiMatches = Array.isArray(data.matches)
        ? data.matches.map((m) => ({ threatType: m.threatType || 'THREAT', url: m.threat?.url || '' }))
        : [];
      const matches = [...apiMatches, ...base.matches];
      return { safe: matches.length === 0, source: 'google-safebrowsing', urls: base.urls, matches, flags: base.flags };
    } catch {
      return { ...base, fallback: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async function reverseGeocodeRoute(body) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new InputError(400, 'Valid numeric "lat" and "lng" are required');
    }
    const coordsLabel = `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`;
    const key = env.GOOGLE_MAPS_API_KEY || '';
    const fetchImpl = deps.fetchImpl || globalThis.fetch;
    if (!key || typeof fetchImpl !== 'function') {
      return { address: `${coordsLabel} (Local Municipal Ward)`, coords: { lat, lng }, source: 'offline-coords' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const apiRes = await fetchImpl(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(key)}`,
        { signal: ctrl.signal },
      );
      if (!apiRes.ok) return { address: `${coordsLabel} (Local Municipal Ward)`, coords: { lat, lng }, source: 'offline-coords' };
      const data = await apiRes.json();
      const formatted = data?.results?.[0]?.formatted_address;
      return {
        address: formatted || `${coordsLabel} (Local Municipal Ward)`,
        coords: { lat, lng },
        source: formatted ? 'google-maps' : 'offline-coords',
      };
    } catch {
      return { address: `${coordsLabel} (Local Municipal Ward)`, coords: { lat, lng }, source: 'offline-coords' };
    } finally {
      clearTimeout(timer);
    }
  }

  const postRoutes = {
    '/api/analyze': (body, req) => {
      const userKey = typeof req?.headers?.['x-gemini-key'] === 'string' ? req.headers['x-gemini-key'].trim() : '';
      if (userKey && !engine.aiEnabled()) {
        const byokEngine = createEngine({
          gemini: createGeminiClient({ apiKey: userKey, model: env.GEMINI_MODEL, fetchImpl: deps.fetchImpl }),
          logger: deps.logger,
        });
        return byokEngine.analyze(body);
      }
      return engine.analyze(body);
    },
    '/api/urimai': engine.urimai,
    '/api/agent': engine.agent,
    '/api/autopilot': engine.autopilot,
    '/api/decoy': engine.decoy,
    '/api/upi-check': engine.upiCheck,
    '/api/redact': engine.redact,
    '/api/radar': engine.radar,
    '/api/safebrowsing': safeBrowsingRoute,
    '/api/reverse-geocode': reverseGeocodeRoute,
  };

    if (pathname.startsWith('/api/auth/')) {
      if (!db) {
        sendJson(res, 501, { error: 'Accounts are not enabled on this server' });
        return;
      }
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
      const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
      const token = readCookie(req.headers.cookie, SESSION_COOKIE);
      try {
        if (pathname === '/api/auth/signup' && method === 'POST') {
          if (!allow(`auth:${ip}`)) throw new HttpError(429, 'Too many requests — wait a minute');
          const { name, email, password } = await readJson(req);
          const user = db.signup({ name, email, password });
          const session = db.createSession(user.id);
          res.setHeader('Set-Cookie', sessionCookie(session.token, session.expires, secure));
          sendJson(res, 201, { user });
          return;
        }
        if (pathname === '/api/auth/login' && method === 'POST') {
          if (!allow(`auth:${ip}`)) throw new HttpError(429, 'Too many requests — wait a minute');
          const { email, password } = await readJson(req);
          const user = db.login({ email, password });
          const session = db.createSession(user.id);
          res.setHeader('Set-Cookie', sessionCookie(session.token, session.expires, secure));
          sendJson(res, 200, { user });
          return;
        }
        if (pathname === '/api/auth/logout' && method === 'POST') {
          db.deleteSession(token);
          res.setHeader('Set-Cookie', sessionCookie('', 0, secure));
          sendJson(res, 200, { ok: true });
          return;
        }
        if (pathname === '/api/auth/me' && method === 'GET') {
          const user = db.userFromSession(token);
          if (!user) {
            sendJson(res, 401, { error: 'Not signed in' });
            return;
          }
          sendJson(res, 200, { user });
          return;
        }
        if (pathname === '/api/auth/progress' && method === 'PUT') {
          const user = db.userFromSession(token);
          if (!user) {
            sendJson(res, 401, { error: 'Not signed in' });
            return;
          }
          const body = await readJson(req);
          sendJson(res, 200, { user: db.updateProgress(user.id, body) });
          return;
        }
        sendJson(res, 404, { error: 'Not found' });
        return;
      } catch (err) {
        if (err instanceof DbError || err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message });
          return;
        }
        throw err;
      }
    }

    if (postRoutes[pathname]) {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
      if (!allow(ip)) {
        sendJson(res, 429, { error: 'Too many requests — please wait a minute' });
        return;
      }
      try {
        const body = await readJson(req);
        const result = await postRoutes[pathname](body, req);
        sendJson(res, 200, result);
      } catch (err) {
        if (err instanceof InputError || err instanceof HttpError) {
          sendJson(res, err.status, { error: err.message });
          return;
        }
        deps.logger?.error?.('[server]', err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
      return;
    }

    if (method === 'GET' || method === 'HEAD') {
      serveStatic(pathname, res);
      return;
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  };
}

function createServer(deps = {}) {
  const handler = createApp(deps);
  return http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      deps.logger?.error?.('[unhandled]', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    });
  });
}

module.exports = { createApp, createServer, SECURITY_HEADERS };
