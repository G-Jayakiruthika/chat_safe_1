'use strict';

/**
 * Chat-app connectors. Users forward a suspicious message to the Chat_Safe bot in
 * Telegram, WhatsApp Business, Instagram or Facebook Messenger and get the verdict back
 * in their own language.
 *
 * Every webhook is authenticated before anything is processed:
 *  - Telegram: the `X-Telegram-Bot-Api-Secret-Token` header must match TELEGRAM_WEBHOOK_SECRET.
 *  - Meta (WhatsApp / Instagram / Messenger): `X-Hub-Signature-256` must be a valid
 *    HMAC-SHA256 of the raw body using META_APP_SECRET.
 * Webhooks are acknowledged immediately; the reply is sent asynchronously.
 */

const crypto = require('node:crypto');
const { createLru } = require('./lru');

const SEND_TIMEOUT_MS = 10_000;
const LEVEL_EMOJI = Object.freeze({ safe: '🟢', suspicious: '🟡', high: '🟠', critical: '🔴' });
const MAX_LEN = Object.freeze({ telegram: 4000, whatsapp: 4000, instagram: 950, messenger: 1900 });

const WELCOME = [
  '🛡️ Hi, I am Kavach from Chat_Safe.',
  'Forward or paste any suspicious message, call script or payment request here and I will check it for scams.',
  'You can write in English or any Indian language. Lost money? Call 1930 immediately.',
].join('\n');

/** Constant-time string comparison that tolerates different lengths. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verify Meta's X-Hub-Signature-256 header.
 * @param {Buffer} rawBody
 * @param {string|undefined} header
 * @param {string} secret
 */
function verifyMetaSignature(rawBody, header, secret) {
  if (!secret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return safeEqual(header, expected);
}

/**
 * Turn an engine result into a chat message.
 * @param {{mode: string, reply: string, analysis?: any}} result
 * @param {keyof typeof MAX_LEN} channel
 */
function formatReply(result, channel = 'telegram') {
  let text;
  if (result.mode === 'scan' && result.analysis) {
    const a = result.analysis;
    const flags = a.redFlags.slice(0, 3).map((f) => `⚠️ ${f}`);
    const steps = a.nextSteps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`);
    const upi = a.upiChecks.filter((u) => u.verdict === 'not-validated').map((u) => `❌ ${u.input}: ${u.message}`);
    text = [
      `${LEVEL_EMOJI[a.level] || '🛡️'} Chat_Safe risk: ${a.score}/100 (${a.level.toUpperCase()})`,
      a.verdict,
      `Type: ${a.scamType}`,
      '',
      ...flags,
      ...upi,
      '',
      ...steps,
      '',
      '📞 Lost money? Call 1930 now · https://cybercrime.gov.in',
    ].join('\n');
  } else {
    text = `${result.reply}\n\n— Kavach · Chat_Safe`;
  }
  const max = MAX_LEN[channel] || 1000;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   runAgent: (text: string) => Promise<any>,
 *   fetchImpl?: typeof fetch,
 *   logger?: Pick<Console, 'error'>,
 * }} deps
 */
function createIntegrations({ env = {}, runAgent, fetchImpl = globalThis.fetch, logger = console }) {
  const graph = env.GRAPH_API_VERSION || 'v21.0';
  const seen = createLru(500); // de-duplicate retried webhook deliveries

  const cfg = {
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
    whatsapp: Boolean(env.META_APP_SECRET && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    instagram: Boolean(env.META_APP_SECRET && env.INSTAGRAM_TOKEN),
    messenger: Boolean(env.META_APP_SECRET && env.MESSENGER_PAGE_TOKEN),
  };

  async function post(url, body, token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      if (!res.ok) throw new Error(`send failed: HTTP ${res.status}`);
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  const send = {
    telegram: (chatId, text) =>
      post(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    whatsapp: (to, text) =>
      post(
        `https://graph.facebook.com/${graph}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } },
        env.WHATSAPP_TOKEN,
      ),
    instagram: (to, text) =>
      post(
        `https://graph.instagram.com/${graph}/${env.INSTAGRAM_ACCOUNT_ID || 'me'}/messages`,
        { recipient: { id: to }, message: { text } },
        env.INSTAGRAM_TOKEN,
      ),
    messenger: (to, text) =>
      post(
        `https://graph.facebook.com/${graph}/me/messages`,
        { recipient: { id: to }, messaging_type: 'RESPONSE', message: { text } },
        env.MESSENGER_PAGE_TOKEN,
      ),
  };

  /** Run the agent on one incoming message and reply on the same channel. */
  async function respond(channel, to, text, messageId) {
    if (messageId) {
      if (seen.has(messageId)) return 'duplicate';
      seen.set(messageId, true);
    }
    let reply;
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) reply = 'Please send the suspicious message as text. Screenshots and voice notes are coming soon.';
    else if (/^\/(start|help)\b/i.test(trimmed)) reply = WELCOME;
    else reply = formatReply(await runAgent(trimmed.slice(0, 4000)), channel);
    await send[channel](to, reply);
    return 'sent';
  }

  /** Run a task in the background and log (never throw) on failure. */
  const background = (promise) =>
    promise.catch((err) => logger.error('[integrations]', err instanceof Error ? err.message : err));

  /**
   * POST /webhooks/telegram
   * @param {Record<string, string|string[]|undefined>} headers
   * @param {any} update parsed JSON body
   */
  function handleTelegram(headers, update) {
    if (!cfg.telegram) return { status: 404, body: { error: 'Telegram is not configured' } };
    if (!safeEqual(headers['x-telegram-bot-api-secret-token'] || '', env.TELEGRAM_WEBHOOK_SECRET)) {
      return { status: 401, body: { error: 'Bad secret token' } };
    }
    const msg = update?.message || update?.edited_message;
    let task = Promise.resolve('ignored');
    if (msg?.chat?.id !== undefined) {
      task = background(respond('telegram', msg.chat.id, msg.text || msg.caption, `tg:${update.update_id}`));
    }
    return { status: 200, body: { ok: true }, task };
  }

  /**
   * GET /webhooks/meta — subscription handshake.
   * @param {URLSearchParams} query
   */
  function handleMetaVerify(query) {
    const ok =
      query.get('hub.mode') === 'subscribe' &&
      Boolean(env.META_VERIFY_TOKEN) &&
      safeEqual(query.get('hub.verify_token') || '', env.META_VERIFY_TOKEN);
    return ok ? { status: 200, text: query.get('hub.challenge') || '' } : { status: 403, body: { error: 'Verification failed' } };
  }

  /**
   * POST /webhooks/meta — WhatsApp Business, Instagram and Messenger events.
   * @param {Record<string, string|string[]|undefined>} headers
   * @param {Buffer} rawBody
   */
  function handleMetaEvent(headers, rawBody) {
    if (!verifyMetaSignature(rawBody, /** @type {string} */ (headers['x-hub-signature-256']), env.META_APP_SECRET)) {
      return { status: 401, body: { error: 'Bad signature' } };
    }
    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { status: 400, body: { error: 'Invalid JSON' } };
    }

    const jobs = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    if (payload.object === 'whatsapp_business_account' && cfg.whatsapp) {
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          for (const m of change.value?.messages || []) {
            jobs.push(respond('whatsapp', m.from, m.type === 'text' ? m.text?.body : '', `wa:${m.id}`));
          }
        }
      }
    } else if (payload.object === 'instagram' || payload.object === 'page') {
      const channel = payload.object === 'instagram' ? 'instagram' : 'messenger';
      if (cfg[channel]) {
        for (const entry of entries) {
          for (const ev of entry.messaging || []) {
            if (!ev.message || ev.message.is_echo) continue; // never answer our own replies
            jobs.push(respond(channel, ev.sender?.id, ev.message.text, `${channel}:${ev.message.mid}`));
          }
        }
      }
    }
    return { status: 200, body: { ok: true }, task: background(Promise.all(jobs)) };
  }

  /** Public status for the Connect page (never exposes secrets). */
  function status() {
    return {
      telegram: { enabled: cfg.telegram, link: env.TELEGRAM_BOT_USERNAME ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}` : null },
      whatsapp: {
        enabled: cfg.whatsapp,
        link: env.WHATSAPP_DISPLAY_NUMBER ? `https://wa.me/${String(env.WHATSAPP_DISPLAY_NUMBER).replace(/\D/g, '')}` : null,
      },
      instagram: { enabled: cfg.instagram, link: env.INSTAGRAM_USERNAME ? `https://ig.me/m/${env.INSTAGRAM_USERNAME}` : null },
      messenger: { enabled: cfg.messenger, link: env.MESSENGER_PAGE_USERNAME ? `https://m.me/${env.MESSENGER_PAGE_USERNAME}` : null },
    };
  }

  return { handleTelegram, handleMetaVerify, handleMetaEvent, status, formatReply };
}

module.exports = { createIntegrations, verifyMetaSignature, formatReply, safeEqual };
