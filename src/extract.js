'use strict';

/**
 * Pulls scammer identifiers out of a conversation AND provides PII auto-redaction
 * so trending scam alerts and civic reports never leak personal data on Radar.
 */

const LIMIT = 10;

const PATTERNS = Object.freeze({
  upi: /\b[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}\b(?!\.[a-z])/gi,
  phone: /(?<![\d])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\d])/g,
  url: /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|rb\.gy|cutt\.ly)\/[^\s<>"')]+/gi,
  account: /(?<![\d])\d{9,18}(?![\d])/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  amount: /(?:₹|rs\.?|inr)\s?\d[\d,]*(?:\.\d{1,2})?/gi,
  email: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
  aadhaar: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
});

const SHORTENERS = /^(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|rb\.gy|cutt\.ly|is\.gd|t\.co)\//i;
const CHAT_INVITES = /^(?:https?:\/\/)?(?:t\.me|telegram\.me|chat\.whatsapp\.com|wa\.me)\//i;
const APK = /\.apk(?:$|[?#])/i;

function unique(text, pattern, normalise = (s) => s) {
  const out = new Set();
  for (const m of text.matchAll(pattern)) {
    out.add(normalise(m[0]));
    if (out.size >= LIMIT) break;
  }
  return [...out];
}

const digitsOnly = (s) => s.replace(/\D/g, '');

function extractIndicators(text) {
  const input = typeof text === 'string' ? text : '';
  const phones = unique(input, PATTERNS.phone, (s) => digitsOnly(s).slice(-10));
  const phoneSet = new Set(phones);
  const accounts = unique(input, PATTERNS.account).filter((a) => !phoneSet.has(a.slice(-10)) || a.length > 12);
  const urls = unique(input, PATTERNS.url, (s) => s.replace(/[.,;:!?]+$/, ''));

  const flags = [];
  for (const u of urls) {
    if (SHORTENERS.test(u)) flags.push({ value: u, reason: 'Shortened link hides the real website' });
    else if (CHAT_INVITES.test(u)) flags.push({ value: u, reason: 'Invite to a private Telegram/WhatsApp group' });
    if (APK.test(u)) flags.push({ value: u, reason: 'Direct app download (.apk) — can take over your phone' });
  }

  return {
    upiIds: unique(input, PATTERNS.upi, (s) => s.toLowerCase()),
    phones,
    urls,
    accounts,
    ifsc: unique(input, PATTERNS.ifsc),
    amounts: unique(input, PATTERNS.amount),
    flags,
  };
}

/**
 * Redact personal identifiers (names, phone numbers, UPI IDs, bank accounts, Aadhaar, emails)
 * with [REDACTED] tags for the Radar retention feed.
 * @param {string} text
 */
function redactPII(text) {
  const raw = typeof text === 'string' ? text : '';
  if (!raw) return { redacted: '', count: 0, tags: [] };
  let count = 0;
  const tags = new Set();
  const mark = (tag) => {
    count += 1;
    tags.add(tag);
    return tag;
  };

  let out = raw
    .replace(PATTERNS.email, () => mark('[EMAIL_REDACTED]'))
    .replace(PATTERNS.upi, () => mark('[UPI_REDACTED]'))
    .replace(PATTERNS.aadhaar, () => mark('[ID_REDACTED]'))
    .replace(PATTERNS.phone, () => mark('[PHONE_REDACTED]'))
    .replace(PATTERNS.account, () => mark('[ACCOUNT_REDACTED]'))
    .replace(PATTERNS.ifsc, () => mark('[IFSC_REDACTED]'))
    .replace(/\b(?:Mr|Mrs|Ms|Sri|Smt|Dr|Inspector|Officer)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, () => mark('[NAME_REDACTED]'))
    .replace(/\b(?:Dear|Hi|Hello)\s+([A-Z][a-z]{2,20})\b/g, (m, name) => {
      if (['Customer', 'User', 'Sir', 'Madam', 'Friend'].includes(name)) return m;
      return m.replace(name, mark('[NAME_REDACTED]'));
    });

  return { redacted: out, count, tags: [...tags] };
}

module.exports = { extractIndicators, redactPII };
