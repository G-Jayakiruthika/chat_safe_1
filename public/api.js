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
      local = window.ChatSafeCore.createEngine({ logger: { error() {} } });
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

  /**
   * @param {'agent'|'analyze'|'urimai'|'autopilot'|'decoy'|'upi-check'|'redact'|'radar'|'portals'|'languages'|'integrations'} path
   * @param {object} [body] omit for GET
   */
  async function call(path, body) {
    await detect();
    if (mode === 'server') {
      const res = await fetch(`api/${path}`, body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return data;
    }
    const handlers = {
      agent: local.agent,
      analyze: local.analyze,
      urimai: local.urimai,
      autopilot: local.autopilot,
      decoy: local.decoy,
      'upi-check': local.upiCheck,
      redact: local.redact,
      radar: local.radar,
      portals: async () => local.portals(),
      languages: async () => local.languages(),
      integrations: async () => null,
    };
    try {
      return await handlers[path](body || {});
    } catch (err) {
      throw new Error(err.message || 'Something went wrong');
    }
  }

  return { call, detect, mode: () => mode, aiEnabled: () => ai };
})();
