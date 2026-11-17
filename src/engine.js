'use strict';

/**
 * Unified Chat_Safe × Urimai Engine:
 *   - Kavach Scam X-Ray & 1930 Complaint Drafter
 *   - Urimai Civic Grievance Classifier & Bilingual Action Kit Builder
 *   - Speed-Dial '9' Voice Agent with automatic Kavach / Urimai handoff
 *   - PII Auto-Redactor & City Radar Feed
 *   - Autopilot, Paati Decoy, Pay-Check (@valid UPI)
 */

const { analyzeRules, classifyIntent, combineScores, levelFor } = require('./rules');
const { extractIndicators, redactPII } = require('./extract');
const { checkUpi } = require('./upiCheck');
const { localized, VERDICT, STEPS, decoyFallback, agentFallback, buildComplaint } = require('./content');
const { LANGUAGES, safeLang, detectLanguage } = require('./languages');
const { createLru } = require('./lru');
const { buildPlan } = require('./autopilot');
const { buildUrimaiKit, STATE_PORTALS } = require('./urimai');
const { getRadarFeed } = require('./radarData');

const MAX_TEXT_CHARS = 4000;
const MAX_BATCH = 20;
const CACHE_SIZE = 200;

class InputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireText(value) {
  if (typeof value !== 'string' || !value.trim()) throw new InputError(400, 'Field "text" is required');
  if (value.length > MAX_TEXT_CHARS) throw new InputError(413, `Text must be under ${MAX_TEXT_CHARS} characters`);
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim();
}

const resolveLang = (lang, text) => (lang === 'auto' ? detectLanguage(text) : safeLang(lang));
const OFFLINE_GEMINI = Object.freeze({ enabled: false, model: 'offline' });

function createEngine({ gemini = OFFLINE_GEMINI, logger = console } = {}) {
  const cache = createLru(CACHE_SIZE);

  /**
   * Smart Scan & Routing: classifies input as SCAM (Kavach) or CIVIC (Urimai).
   */
  async function analyze(body) {
    const text = requireText(body.text);
    const lang = resolveLang(body.lang, text);
    const forceMode = body.forceMode || null;
    const key = `${lang}\u0000${forceMode || ''}\u0000${text}`;
    const cached = cache.get(key);
    if (cached) return { ...cached, cached: true };

    const indicators = extractIndicators(text);
    const upiChecks = indicators.upiIds.map(checkUpi);
    const riskyUpi = upiChecks.filter((u) => u.verdict === 'not-validated').length;
    const intentCheck = classifyIntent(text, {
      suspiciousIndicators: indicators.flags.length + (riskyUpi > 0 ? 1 : 0),
    });

    // If civic issue detected (or forced) and not overridden as scam
    if ((forceMode === 'CIVIC' || (forceMode !== 'SCAM' && intentCheck.intent === 'CIVIC'))) {
      let aiDraft = null;
      if (gemini.enabled && gemini.draftUrimai) {
        try {
          aiDraft = await gemini.draftUrimai(text, lang, body.location);
        } catch (err) {
          logger.error('[gemini urimai]', err instanceof Error ? err.message : err);
        }
      }
      const urimaiKit = buildUrimaiKit({
        text,
        lang,
        location: body.location,
        state: body.state,
        reporter: body.reporter,
        department: intentCheck.department,
        aiDraft,
      });
      const civicResult = {
        intent: 'CIVIC',
        risk_score: 0,
        score: 0,
        level: 'civic',
        lang,
        verdict: `Civic Grievance Detected — Routed to Urimai Engine (${urimaiKit.department})`,
        scamType: urimaiKit.department,
        details: urimaiKit.summary,
        action: urimaiKit.offlineInstructions,
        categoryIds: [intentCheck.civicCategory || 'civic_general'],
        explanation: urimaiKit.handoffReply,
        redFlags: [],
        nextSteps: [
          urimaiKit.offlineInstructions,
          `Digital-First Bypass: Copy text and submit via ${urimaiKit.digitalBypass.portalName}.`,
          'Or send the Local Proxy link to a neighbor via WhatsApp for photo + print.',
        ],
        engine: aiDraft ? `urimai + ${gemini.model}` : 'urimai (offline)',
        rules: intentCheck.scam,
        indicators,
        upiChecks,
        complaint: '',
        urimaiKit,
      };
      cache.set(key, civicResult);
      return civicResult;
    }

    const rules = intentCheck.scam;
    let ai = null;
    let aiError = null;
    if (gemini.enabled) {
      try {
        ai = await gemini.analyze(text, lang);
      } catch (err) {
        aiError = 'AI engine unavailable — showing offline result';
        logger.error('[gemini]', err instanceof Error ? err.message : err);
      }
    }

    // If Gemini detected CIVIC on nuanced text where offline rules missed it
    if (ai?.intent === 'CIVIC' && rules.score < 25) {
      const urimaiKit = buildUrimaiKit({ text, lang, location: body.location, state: body.state, reporter: body.reporter });
      const civicRes = {
        intent: 'CIVIC',
        risk_score: 0,
        score: 0,
        level: 'civic',
        lang,
        verdict: `Civic Grievance Detected — Routed to Urimai Engine (${urimaiKit.department})`,
        scamType: urimaiKit.department,
        details: urimaiKit.summary,
        action: urimaiKit.offlineInstructions,
        categoryIds: ['civic_general'],
        explanation: ai.explanation || urimaiKit.handoffReply,
        redFlags: [],
        nextSteps: [urimaiKit.offlineInstructions],
        engine: `urimai + ${gemini.model}`,
        rules,
        indicators,
        upiChecks,
        complaint: '',
        urimaiKit,
      };
      cache.set(key, civicRes);
      return civicRes;
    }

    const score = combineScores(rules.score, ai?.score);
    const level = levelFor(score);
    const scamType = ai?.scamType || rules.scamType;
    const verdict = localized(VERDICT, lang)[level];
    const nextSteps = ai?.nextSteps?.length ? ai.nextSteps : localized(STEPS, lang);
    const result = {
      intent: score >= 25 ? 'SCAM' : 'SAFE',
      risk_score: score,
      score,
      level,
      lang,
      verdict,
      scamType,
      details: ai?.explanation || verdict,
      action: nextSteps[0] || '',
      categoryIds: rules.categories.map((c) => c.id),
      explanation: ai?.explanation || '',
      redFlags: ai?.redFlags?.length ? ai.redFlags : [...rules.tactics, ...rules.categories].map((r) => r.label),
      nextSteps,
      engine: ai ? `rules + ${gemini.model}` : 'rules (offline)',
      aiError,
      rules,
      indicators,
      upiChecks,
      complaint: score >= 30 ? buildComplaint({ text, score, scamType, indicators }) : '',
      urimaiKit: null,
    };
    cache.set(key, result);
    return result;
  }

  /**
   * Direct Urimai Kit endpoint (used by Family Hub & Civic Scanner).
   */
  async function urimai(body) {
    const text = requireText(body.text);
    const lang = resolveLang(body.lang, text);
    let aiDraft = null;
    if (gemini.enabled && gemini.draftUrimai) {
      try {
        aiDraft = await gemini.draftUrimai(text, lang, body.location);
      } catch (err) {
        logger.error('[gemini urimai]', err instanceof Error ? err.message : err);
      }
    }
    return buildUrimaiKit({
      text,
      lang,
      location: body.location,
      state: body.state,
      reporter: body.reporter,
      department: body.department,
      aiDraft,
    });
  }

  /**
   * Voice agent (Web Mic + Speed-Dial '9' IVR):
   *   - Detects CIVIC -> triggers Urimai Engine + dispatches Urimai Action Kit to Family Hub
   *   - Detects SCAM  -> triggers Kavach Red Alert + SOS to Family Hub
   *   - Otherwise     -> answers safety/civic question in chosen language
   */
  async function agent(body) {
    const text = requireText(body.text);
    const lang = resolveLang(body.lang, text);
    const turn = Number.isInteger(body.turn) ? body.turn : 0;
    const intent = classifyIntent(text);

    if (intent.intent === 'CIVIC') {
      const analysis = await analyze({
        text,
        lang,
        location: body.location,
        state: body.state,
        reporter: body.reporter || 'Appa (Speed-Dial 9 Keypad Phone)',
        forceMode: 'CIVIC',
      });
      return {
        mode: 'urimai',
        intent: 'CIVIC',
        mood: 'civic',
        lang,
        reply: analysis.urimaiKit.handoffReply,
        urimaiKit: analysis.urimaiKit,
        analysis,
      };
    }

    if (intent.scam.score >= 25) {
      const analysis = await analyze({ text, lang, forceMode: 'SCAM' });
      const tactic = analysis.redFlags[0] ? ` ${analysis.redFlags[0]}.` : '';
      return {
        mode: 'scan',
        intent: 'SCAM',
        mood: analysis.level,
        lang,
        reply: `${analysis.verdict}${tactic} ${analysis.nextSteps[0] || ''}`.trim(),
        analysis,
      };
    }

    let reply = null;
    if (gemini.enabled) {
      try {
        reply = await gemini.agentReply(text, lang);
      } catch (err) {
        logger.error('[gemini agent]', err instanceof Error ? err.message : err);
      }
    }
    return {
      mode: 'chat',
      intent: 'GENERAL',
      mood: 'safe',
      lang,
      reply: reply || agentFallback(lang, turn, text),
      engine: reply ? gemini.model : 'offline script',
    };
  }

  async function decoy(body) {
    const text = requireText(body.text);
    const lang = resolveLang(body.lang, text);
    const turn = Number.isInteger(body.turn) ? body.turn : 0;
    let reply = null;
    if (gemini.enabled) {
      try {
        reply = await gemini.decoyReply(text, lang);
      } catch (err) {
        logger.error('[gemini decoy]', err instanceof Error ? err.message : err);
      }
    }
    return { reply: reply || decoyFallback(lang, turn), engine: reply ? gemini.model : 'offline script' };
  }

  async function autopilot(body) {
    const raw = Array.isArray(body.messages) ? body.messages : [body.text];
    const messages = raw.filter((m) => typeof m === 'string' && m.trim()).slice(0, MAX_BATCH);
    if (!messages.length) throw new InputError(400, 'Field "messages" is required');

    const items = [];
    for (const text of messages) {
      const a = await analyze({ text, lang: body.lang, forceMode: 'SCAM' });
      items.push({
        text: text.length > 240 ? `${text.slice(0, 240)}…` : text,
        score: a.score, level: a.level, scamType: a.scamType, verdict: a.verdict,
        categoryIds: a.categoryIds, analysis: a,
      });
    }
    items.sort((x, y) => y.score - x.score);
    const worst = items[0];
    const plan = buildPlan(worst.analysis, {
      lang: body.lang, connected: body.connected, autoActions: body.autoActions,
    });
    const counts = {};
    for (const i of items) counts[i.level] = (counts[i.level] || 0) + 1;
    return {
      scanned: items.length,
      counts,
      lang: worst.analysis.lang,
      worst: { text: worst.text, score: worst.score, level: worst.level, scamType: worst.scamType, verdict: worst.verdict },
      items: items.map(({ analysis, ...rest }) => rest),
      plan,
    };
  }

  async function upiCheck(body) {
    if (typeof body.upi !== 'string' || body.upi.length > 300) throw new InputError(400, 'Field "upi" is required');
    return checkUpi(body.upi);
  }

  async function redact(body) {
    const text = requireText(body.text);
    return redactPII(text);
  }

  async function radar(body = {}) {
    return getRadarFeed(body.city || 'All');
  }

  /**
   * URL threat heuristic checker used offline / as fallback for /api/safebrowsing.
   */
  async function safebrowsing(body = {}) {
    const rawList = Array.isArray(body.urls) ? body.urls : [];
    const textInput = typeof body.text === 'string' ? body.text : '';
    const single = typeof body.url === 'string' ? body.url.trim() : '';
    const extracted = textInput ? extractIndicators(textInput).urls : [];
    const urls = [...new Set([...rawList, ...(single ? [single] : []), ...extracted].filter(Boolean))].slice(0, 10);
    const flags = extractIndicators(urls.join(' ')).flags;
    const suspiciousHosts = /(?:bit\.ly|tinyurl\.com|rb\.gy|cutt\.ly|inida-|sbi-kyc|hdfc-kyc|\.apk(?:$|[/?#])|\.top(?:$|[/?#])|\.xyz(?:$|[/?#]))/i;
    const heuristicMatches = urls
      .filter((u) => suspiciousHosts.test(u) || flags.some((f) => f.value === u))
      .map((u) => ({ threatType: 'SOCIAL_ENGINEERING_HEURISTIC', url: u }));
    return {
      safe: heuristicMatches.length === 0,
      source: 'offline-heuristics',
      urls,
      matches: heuristicMatches,
      flags,
    };
  }

  return {
    analyze,
    urimai,
    agent,
    autopilot,
    decoy,
    upiCheck,
    redact,
    radar,
    safebrowsing,
    portals: () => STATE_PORTALS,
    languages: () => ({ languages: LANGUAGES }),
    aiEnabled: () => Boolean(gemini.enabled),
  };
}

module.exports = { createEngine, InputError, MAX_TEXT_CHARS };
