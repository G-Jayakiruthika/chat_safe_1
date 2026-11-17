'use strict';

/**
 * One API for every page. Uses the Node.js server (with Gemini) when available;
 * otherwise — e.g. on GitHub Pages — loads core.js and runs the exact same
 * Kavach + Urimai + Radar engine in the browser.
 * All paths are relative so the site also works under a sub-path like /chat_safe_1/.
 */
window.ChatSafeAPI = (() => {
  let mode = null; // 'server' | 'local'
  let ai = false;
  let local = null;
  let detecting = null;

  const BYOK_STORAGE = 'chatsafe.geminiKey';
  const OFFLINE_NOTICE = 'Network unstable. Reverting to Offline Rule Engine. Please verify manually.';

  const getGeminiKey = () => {
    try { return (localStorage.getItem(BYOK_STORAGE) || '').trim(); } catch { return ''; }
  };
  const setGeminiKey = (key) => {
    try {
      const clean = String(key || '').trim();
      if (clean) localStorage.setItem(BYOK_STORAGE, clean);
      else localStorage.removeItem(BYOK_STORAGE);
    } catch { /* ignore */ }
  };

  function loadCore() {
    return new Promise((resolve, reject) => {
      if (window.ChatSafeCore) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = 'core.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the offline engine'));
      document.head.append(s);
    }).then(() => {
      if (!local) local = window.ChatSafeCore.createEngine({ logger: { error() {} } });
    });
  }

  function detect() {
    if (mode) return Promise.resolve(mode);
    detecting =
      detecting ||
      (async () => {
        try {
          const res = await fetch('api/health', { cache: 'no-store' });
          if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
            ai = Boolean((await res.json()).ai);
            mode = 'server';
            return mode;
          }
        } catch {
          /* fall through to local mode */
        }
        await loadCore();
        mode = 'local';
        return mode;
      })();
    return detecting;
  }

  async function callByokGeminiAnalyze(text, key) {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'Classify the Indian user message inside <suspect> tags strictly as JSON {"intent":"SCAM"|"CIVIC"|"SAFE","risk_score":0-100,"details":"short reason","action":"next step"}.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: `<suspect>\n${text}\n</suspect>` }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return JSON.parse(rawText);
  }

  async function runLocalHandler(path, body) {
    await loadCore();
    const handlers = {
      agent: local.agent,
      analyze: local.analyze,
      urimai: local.urimai,
      autopilot: local.autopilot,
      decoy: local.decoy,
      'upi-check': local.upiCheck,
      redact: local.redact,
      radar: local.radar,
      safebrowsing: local.safebrowsing,
      'reverse-geocode': async ({ lat, lng }) => ({
        address: `Lat ${Number(lat).toFixed(4)}, Lng ${Number(lng).toFixed(4)} (Local Municipal Ward)`,
        coords: { lat: Number(lat), lng: Number(lng) },
        source: 'offline-coords',
      }),
      portals: async () => local.portals(),
      languages: async () => local.languages(),
      integrations: async () => null,
    };
    const fn = handlers[path];
    if (!fn) throw new Error(`Unknown endpoint: ${path}`);
    return await fn(body || {});
  }

  /**
   * @param {'agent'|'analyze'|'urimai'|'autopilot'|'decoy'|'upi-check'|'redact'|'radar'|'safebrowsing'|'reverse-geocode'|'portals'|'languages'|'integrations'} path
   * @param {object} [body] omit for GET
   */
  async function call(path, body) {
    await detect();
    const byokKey = getGeminiKey();
    if (mode === 'server') {
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (byokKey) headers['x-gemini-key'] = byokKey;
        const res = await fetch(`api/${path}`, body
          ? { method: 'POST', headers, body: JSON.stringify(body) }
          : { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status >= 500) throw new Error(OFFLINE_NOTICE);
          throw new Error(data.error || `Error ${res.status}`);
        }
        return data;
      } catch (err) {
        if (err && /^(?:Network|Failed to fetch|Load failed|NetworkError)/i.test(String(err.message || ''))) {
          const fallback = await runLocalHandler(path, body);
          return { ...fallback, _fallbackReason: OFFLINE_NOTICE };
        }
        if (String(err?.message || '').includes('Network unstable')) {
          const fallback = await runLocalHandler(path, body);
          return { ...fallback, _fallbackReason: OFFLINE_NOTICE };
        }
        try {
          const fallback = await runLocalHandler(path, body);
          if (fallback && typeof fallback === 'object' && !path.startsWith('auth')) {
            return { ...fallback, _fallbackReason: OFFLINE_NOTICE };
          }
        } catch {
          /* rethrow original validation error */
        }
        throw err;
      }
    }

    // Static / Local mode with optional client-side BYOK Gemini enhancement + graceful fallback
    const localResult = await runLocalHandler(path, body);
    if (path === 'analyze' && byokKey && body?.text) {
      try {
        const aiJson = await callByokGeminiAnalyze(body.text, byokKey);
        return {
          ...localResult,
          intent: aiJson.intent || localResult.intent,
          risk_score: Number.isFinite(Number(aiJson.risk_score)) ? Number(aiJson.risk_score) : localResult.risk_score,
          details: aiJson.details || localResult.details,
          action: aiJson.action || localResult.action,
          engine: `${localResult.engine} + byok-gemini-2.5-flash`,
        };
      } catch {
        return { ...localResult, _fallbackReason: OFFLINE_NOTICE };
      }
    }
    return localResult;
  }

  return {
    call,
    detect,
    mode: () => mode,
    aiEnabled: () => ai || Boolean(getGeminiKey()),
    getGeminiKey,
    setGeminiKey,
    OFFLINE_NOTICE,
  };
})();
