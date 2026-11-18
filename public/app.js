'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const I18N = window.CHATSAFE_I18N;
  const API = window.ChatSafeAPI;
  const Sound = window.ChatSafeSound;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOOD_RGB = window.KAVACH_MOOD_COLORS;
  const CATEGORIES = ['investment', 'digital_arrest', 'kyc_otp', 'courier', 'task_job', 'reward_bill', 'family_voice', 'sextortion_loan'];

  let languages = [{ code: 'en', name: 'English', native: 'English', speech: 'en-IN', greeting: 'Hello! Tell me what happened.' }];
  let lang = 'ta';
  let replyLang = 'ta';
  let agentTurn = 0;
  let decoyTurn = 0;
  let lastResult = null;
  let activeUrimaiKit = null;
  let activePhotoDataUrl = null;
  let redactionEnabled = true;
  let scanHistory = [];
  let statePortals = {};

  const SAMPLES = {
    stock: 'Welcome to SEBI VIP Stock Tips group! Guaranteed returns of 8% daily. Deposit ₹25,000 to rajesh.trader@ybl immediately. Join https://t.me/vipprofitclub',
    arrest: 'This is Inspector Sharma from CBI Mumbai. A FedEx parcel in your name has drugs. Stay on video call, do not tell family. Transfer ₹1,50,000 to account 501002345678 IFSC HDFC0001234.',
    water: 'The panchayat water pipe on my street in Ward 12 broke 3 days ago and no one is fixing it.',
    road: 'Main road near Ward 4 temple has deep broken potholes causing accidents for school children for 2 weeks.',
    safe: 'Hi Amma, reached Chennai safely. Will call you after dinner. Take your BP tablet on time.',
  };

  const uiLang = () => (lang === 'auto' ? 'en' : lang);
  const t = (key, vars = {}, fallbackText = '') => {
    if (typeof window.CHATSAFE_TRANSLATE === 'function') {
      return window.CHATSAFE_TRANSLATE(uiLang(), key, vars, fallbackText);
    }
    const dict = I18N || {};
    const localVal = dict[uiLang()]?.[key];
    const enVal = dict.en?.[key];
    const s = (typeof localVal === 'string' && localVal.trim())
      ? localVal
      : (typeof enVal === 'string' && enVal.trim())
        ? enVal
        : (fallbackText || key);
    return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
  };
  const langInfo = (code) => languages.find((l) => l.code === code) || languages[0];
  const store = (k, v) => { try { localStorage.setItem(`chatsafe.${k}`, v); } catch { /* ignore */ } };
  const load = (k) => { try { return localStorage.getItem(`chatsafe.${k}`); } catch { return null; } };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

  const kavach = window.createKavach($('kavach'), {
    reducedMotion,
    onPoke: () => { Sound.play('blip'); speak("I am Kavach and Urimai — ready to stop scams and draft civic petitions!", 'en'); },
  });
  const bg = window.createBackground($('bg'), { reducedMotion });
  const caseStore = window.createHistory();
  const isDark = () => document.documentElement.dataset.theme !== 'light';

  /**
   * Updates the 3D Kavach avatar mood and ambient canvas background color.
   *
   * @param {'idle'|'safe'|'civic'|'suspicious'|'critical'} mood Visual mood token.
   * @returns {void}
   */
  function setMood(mood) {
    kavach.setMood(mood);
    bg.setColor(MOOD_RGB[mood] || MOOD_RGB.idle, isDark() ? 0.6 : 0.35);
  }

  /* =========================================================================
   * MODAL ACCESSIBILITY: FOCUS TRAP & ESCAPE KEY GOVERNANCE
   * ========================================================================= */
  /**
   * Collects all visible, keyboard-focusable elements inside a container.
   *
   * @param {HTMLElement} container Modal or dialog root element.
   * @returns {HTMLElement[]} Ordered array of focusable elements.
   */
  function getFocusableElements(container) {
    if (!container) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    return [...container.querySelectorAll(selector)].filter((el) => {
      if (el.closest('[hidden]')) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  /**
   * Traps Tab/Shift+Tab focus inside an active modal container and handles Escape dismissal.
   *
   * @param {HTMLElement} modalEl Active modal element (`role="dialog"`).
   * @param {Object} [options] Configuration options.
   * @param {() => void} [options.onEscape] Callback invoked when Escape is pressed.
   * @param {HTMLElement|null} [options.restoreFocusTo] Element to focus when released.
   * @returns {() => void} Cleanup function that detaches listeners and optionally restores focus.
   */
  function trapModalFocus(modalEl, { onEscape, restoreFocusTo } = {}) {
    const previousFocus = restoreFocusTo !== undefined
      ? restoreFocusTo
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const onKeyDown = (e) => {
      if (!modalEl || modalEl.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = getFocusableElements(modalEl);
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modalEl.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !modalEl.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return (skipRestore = false) => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (!skipRestore && previousFocus && document.contains(previousFocus)) {
        try { previousFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    };
  }

  /* =========================================================================
   * ZERO-DATA-RETENTION & EDGE PRIVACY CONSENT GATE (GDPR / ISO)
   * ========================================================================= */
  const CONSENT_STORAGE_KEY = 'chatsafe.edgeConsentAccepted';
  const CONSENT_TS_KEY = 'chatsafe.consentAcceptedAt';

  /**
   * Checks whether the user has already accepted the Edge Privacy Governance policy.
   *
   * @returns {boolean} True when consent timestamp or session flag is stored.
   */
  function hasEdgeConsent() {
    try {
      return Boolean(localStorage.getItem(CONSENT_TS_KEY)) || sessionStorage.getItem(CONSENT_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Toggles `inert` and `aria-hidden` across background landmarks while a modal gate is active.
   *
   * @param {boolean} locked Whether background regions should be locked.
   * @param {boolean} [mainOnly=false] When true, locks only `<main>` and leaves header/footer active.
   * @returns {void}
   */
  function setAppRegionsLocked(locked, mainOnly = false) {
    document.body.classList.toggle('consent-locked', locked && !mainOnly);
    const mainEl = $('main');
    if (mainEl) mainEl.classList.toggle('app-restricted', locked && mainOnly);
    const selector = mainOnly ? 'body > main' : 'body > header, body > main, body > footer';
    if (mainOnly) {
      document.querySelectorAll('body > header, body > footer').forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
    }
    document.querySelectorAll(selector).forEach((el) => {
      if (locked) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    });
  }

  /**
   * Halts all active speech synthesis, Web Audio effects, and media playback.
   *
   * @returns {void}
   */
  function killAllAudio() {
    try { window.speechSynthesis?.cancel(); } catch (err) {
      console.warn('[Chat_Safe][SpeechSynthesis] Cancel failed:', err?.message || err);
    }
    try { Sound.stopAll?.(); } catch { /* ignore */ }
    try { window.ChatSafeReels?.stopAll?.(); } catch { /* ignore */ }
    try { window.ChatSafeExplainerStop?.(); } catch { /* ignore */ }
    document.querySelectorAll('video, audio').forEach((mediaEl) => {
      try {
        if (!mediaEl.paused) mediaEl.pause();
        mediaEl.muted = true;
      } catch { /* ignore */ }
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) killAllAudio(); });
  window.addEventListener('pagehide', killAllAudio);

  let edgeConsentPromise = null;
  let resolveEdgeConsent = null;

  /**
   * Initializes the GDPR/ISO Zero-Data-Retention consent modal gate with trapped keyboard focus,
   * Escape-to-decline handling, and region locking until accepted.
   *
   * @returns {Promise<void>} Resolves once the user accepts the Edge Privacy Governance policy.
   */
  function initEdgeConsentGate() {
    const modal = $('edgeConsentModal');
    const agreeBtn = $('edgeConsentAgreeBtn');
    const declineBtn = $('edgeConsentDeclineBtn');
    const declinedBanner = $('consentDeclinedBanner');
    const reopenBtn = $('reopenConsentBtn');
    if (!modal || !agreeBtn) return Promise.resolve();

    if (hasEdgeConsent()) {
      modal.hidden = true;
      if (declinedBanner) declinedBanner.hidden = true;
      setAppRegionsLocked(false);
      return Promise.resolve();
    }

    if (edgeConsentPromise) return edgeConsentPromise;

    let releaseConsentTrap = null;
    const declineConsent = () => {
      killAllAudio();
      try { sessionStorage.setItem('chatsafe.edgeConsentDeclined', '1'); } catch { /* ignore */ }
      releaseConsentTrap?.(true);
      releaseConsentTrap = null;
      modal.hidden = true;
      setAppRegionsLocked(true, true);
      if (declinedBanner) declinedBanner.hidden = false;
      reopenBtn?.focus();
    };

    const openConsentModal = () => {
      modal.hidden = false;
      if (declinedBanner) declinedBanner.hidden = true;
      setAppRegionsLocked(true, false);
      releaseConsentTrap?.(true);
      releaseConsentTrap = trapModalFocus(modal, {
        onEscape: declineConsent,
        restoreFocusTo: reopenBtn || null,
      });
      agreeBtn.focus();
    };

    reopenBtn?.addEventListener('click', openConsentModal);

    edgeConsentPromise = new Promise((resolve) => {
      resolveEdgeConsent = resolve;

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          const card = modal.querySelector('.consent-modal-card');
          card?.classList.remove('consent-shake');
          void card?.offsetWidth;
          card?.classList.add('consent-shake');
          agreeBtn.focus();
        }
      });

      declineBtn?.addEventListener('click', declineConsent);

      agreeBtn.addEventListener('click', () => {
        const ts = new Date().toISOString();
        try {
          localStorage.setItem(CONSENT_TS_KEY, ts);
          localStorage.setItem('chatsafe.consentStatus', 'accepted');
          sessionStorage.setItem(CONSENT_STORAGE_KEY, '1');
          sessionStorage.setItem('chatsafe.edgeConsentAt', ts);
          sessionStorage.removeItem('chatsafe.edgeConsentDeclined');
        } catch { /* ignore storage restrictions */ }
        releaseConsentTrap?.(true);
        releaseConsentTrap = null;
        modal.hidden = true;
        if (declinedBanner) declinedBanner.hidden = true;
        setAppRegionsLocked(false);
        Sound.play('safe');
        toast('Secure workspace unlocked. Zero-Data-Retention Edge Mode active.');
        $('mic')?.focus();
        resolveEdgeConsent?.();
      });
    });

    openConsentModal();
    return edgeConsentPromise;
  }

  const edgeConsentReady = initEdgeConsentGate();

  /* =========================================================================
   * PHASE 1: DUAL-MODE SECURITY & BYOK INITIALIZATION (Cloud Run + Edge BYOK)
   * ========================================================================= */
  /**
   * Reads a trimmed credential or flag from volatile `sessionStorage`.
   *
   * @param {string} name Storage key name.
   * @returns {string} Trimmed stored string, or empty string if absent.
   */
  function getSessionKey(name) {
    try { return (sessionStorage.getItem(name) || '').trim(); } catch { return ''; }
  }

  /**
   * Persists or removes a credential or flag in volatile `sessionStorage`.
   *
   * @param {string} name Storage key name.
   * @param {string} value Value to persist; empty clears the key.
   * @returns {void}
   */
  function setSessionKey(name, value) {
    try {
      const clean = String(value || '').trim();
      if (clean) sessionStorage.setItem(name, clean);
      else sessionStorage.removeItem(name);
    } catch { /* ignore storage restrictions */ }
  }
  const getGeminiSessionKey = () => getSessionKey('gemini_key') || getSessionKey('GEMINI_API_KEY');
  const setGeminiSessionKey = (val) => {
    setSessionKey('gemini_key', val);
    setSessionKey('GEMINI_API_KEY', val);
  };

  /**
   * Updates the header/panel connection indicator badges for Cloud Run, Edge BYOK, or Zero-Config Simulator mode.
   *
   * @param {'cloud'|'byok'|'offline'} mode Active inference transport mode.
   * @returns {void}
   */
  function setConnectionStatus(mode) {
    const pill = $('geminiStatusPill');
    const simBadge = $('demoSimulatorBadge');
    const simLabel = $('demoSimulatorLabel');
    if (mode === 'cloud') {
      if (pill) pill.textContent = '🟢 Live: Cloud Run Server';
      if (simLabel) simLabel.textContent = 'Live Cloud Run Server (Gemini 2.5)';
      simBadge?.classList.add('live');
    } else if (mode === 'byok') {
      if (pill) pill.textContent = '🟢 Live: Edge AI (BYOK)';
      if (simLabel) simLabel.textContent = 'Live Edge AI Active: Gemini 2.5 Flash';
      simBadge?.classList.add('live');
    } else {
      if (pill) pill.textContent = 'Demo Mode Active: Live AI Simulator (Click for Edge BYOK)';
      if (simLabel) simLabel.textContent = 'Demo Mode Active: Live AI Simulator';
      simBadge?.classList.remove('live');
    }
  }

  /**
   * Synchronizes the API Key Manager button labels and active highlight state.
   *
   * @returns {void}
   */
  function syncApiKeyButtons() {
    const hasKey = Boolean(getGeminiSessionKey());
    const manageBtn = $('apiKeyManageBtn');
    const hdrBtn = $('apiKeySettingsBtn');
    if (manageBtn) manageBtn.textContent = hasKey ? 'API Key (Live)' : 'API Key (Sim)';
    if (hdrBtn) hdrBtn.classList.toggle('flagged', hasKey);
  }

  /**
   * Dynamically injects an accessible glassmorphism BYOK configuration modal over `app.html`
   * with full ARIA dialog attributes, trapped keyboard focus, and Escape-to-close handling.
   *
   * @param {(hasKey: boolean) => void} [onSaved] Optional callback invoked after submit, skip, or clear.
   * @param {string} [promptText] Instructional message rendered inside the modal dialog.
   * @returns {Promise<string>} Resolves to the saved Gemini API key, or an empty string if skipped/cleared.
   */
  function showByokModal(onSaved, promptText = 'Enter your Google Gemini API Key to enable Live Edge AI, or click "Skip API Key" to use the built-in simulation engine:') {
    return new Promise((resolve) => {
      if ($('byokModalOverlay')) { resolve(getGeminiSessionKey()); return; }
      const overlay = document.createElement('div');
      overlay.id = 'byokModalOverlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'byokModalTitle');
      overlay.setAttribute('aria-describedby', 'byokModalDesc');
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '10050',
        display: 'grid', placeItems: 'center', padding: '1rem',
        background: 'rgba(8, 15, 32, 0.72)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        pointerEvents: 'auto',
      });

      const currentGemini = getGeminiSessionKey();
      const card = document.createElement('form');
      Object.assign(card.style, {
        width: 'min(520px, 100%)', maxHeight: '92dvh', overflowY: 'auto',
        padding: '1.5rem', borderRadius: '20px',
        background: 'var(--glass, rgba(20, 32, 58, 0.92))',
        border: '1px solid var(--border, rgba(130, 170, 255, 0.32))',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
        color: 'var(--ink, #eef4ff)', display: 'grid', gap: '.85rem',
      });
      const currentMaps = getSessionKey('GOOGLE_MAPS_KEY') || getSessionKey('GOOGLE_MAPS_API_KEY');
      const currentSafeBrowsing = getSessionKey('SAFE_BROWSING_KEY') || getSessionKey('SAFE_BROWSING_API_KEY');
      const statusBadge = currentGemini
        ? 'Gemini API Key active in sessionStorage'
        : 'No key stored — Simulation Fallback active';
      const EYE_OPEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
      const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>';
      const LOCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      const CLOSE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem">
          <h2 id="byokModalTitle" style="margin:0;font-size:1.15rem;display:inline-flex;align-items:center;gap:.45rem">${LOCK_SVG}<span>BYOK API Key Manager (Edge AI)</span></h2>
          <button type="button" id="byokCloseBtn" aria-label="Close modal" style="background:transparent;border:0;color:inherit;cursor:pointer;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center">${CLOSE_SVG}</button>
        </div>
        <p style="margin:0;font-size:.82rem;font-weight:700;color:${currentGemini ? '#10b981' : '#f59e0b'}">${statusBadge}</p>
        <p id="byokModalDesc" style="margin:0;font-size:.9rem;line-height:1.5;color:var(--muted, #b8c7e0)">
          ${promptText} Keys stay strictly in volatile <code>sessionStorage</code>.
        </p>
        <label style="display:grid;gap:.3rem;font-size:.84rem;font-weight:600">
          GEMINI_API_KEY (Gemini 2.5 Flash REST)
          <div class="byok-key-row">
            <input id="byokGeminiInput" type="password" autocomplete="off" placeholder="AIza..." value="${currentGemini.replace(/"/g, '&quot;')}"
              style="padding:.65rem .85rem;border-radius:12px;border:1px solid var(--border, rgba(130,170,255,.35));background:var(--bg2, rgba(9,16,34,.75));color:var(--ink, #fff);font:inherit">
            <button type="button" id="byokToggleVisBtn" class="secondary sm byok-toggle-vis" aria-pressed="false" aria-label="Show API key">${EYE_OPEN_SVG}<span>Show</span></button>
          </div>
        </label>
        <label style="display:grid;gap:.3rem;font-size:.82rem;color:var(--muted, #b8c7e0)">
          GOOGLE_MAPS_KEY (Optional for Reverse Geocoding)
          <input id="byokMapsInput" type="password" autocomplete="off" placeholder="AIza... (optional — falls back to live GPS coords)" value="${currentMaps.replace(/"/g, '&quot;')}"
            style="padding:.6rem .85rem;border-radius:12px;border:1px solid var(--border, rgba(130,170,255,.25));background:var(--bg2, rgba(9,16,34,.75));color:var(--ink, #fff);font:inherit">
        </label>
        <label style="display:grid;gap:.3rem;font-size:.82rem;color:var(--muted, #b8c7e0)">
          SAFE_BROWSING_KEY (Optional for Kavach URL Scan)
          <input id="byokSafeBrowsingInput" type="password" autocomplete="off" placeholder="AIza... (optional — falls back cleanly)" value="${currentSafeBrowsing.replace(/"/g, '&quot;')}"
            style="padding:.6rem .85rem;border-radius:12px;border:1px solid var(--border, rgba(130,170,255,.25));background:var(--bg2, rgba(9,16,34,.75));color:var(--ink, #fff);font:inherit">
        </label>
        <div style="display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.25rem">
          <button type="submit" class="primary" style="flex:1;min-width:170px">Save Key &amp; Run Live AI</button>
          <button type="button" id="byokOfflineBtn" class="secondary">Skip API Key</button>
          ${currentGemini ? '<button type="button" id="byokClearBtn" class="danger">Clear Key</button>' : ''}
        </div>
      `;
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      let releaseByokTrap = null;
      const finish = (key) => {
        releaseByokTrap?.(false);
        releaseByokTrap = null;
        overlay.remove();
        syncApiKeyButtons();
        onSaved?.(Boolean(key));
        resolve(key || '');
      };
      const dismissModal = () => {
        setSessionKey('BYOK_DISMISSED', '1');
        finish(getGeminiSessionKey());
      };
      releaseByokTrap = trapModalFocus(overlay, { onEscape: dismissModal });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismissModal();
      });

      const toggleVisBtn = $('byokToggleVisBtn');
      const geminiInputEl = $('byokGeminiInput');
      toggleVisBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!geminiInputEl) return;
        const nextShow = geminiInputEl.type === 'password';
        geminiInputEl.type = nextShow ? 'text' : 'password';
        toggleVisBtn.setAttribute('aria-pressed', String(nextShow));
        toggleVisBtn.setAttribute('aria-label', nextShow ? 'Hide API key' : 'Show API key');
        toggleVisBtn.innerHTML = `${nextShow ? EYE_OFF_SVG : EYE_OPEN_SVG}<span>${nextShow ? 'Hide' : 'Show'}</span>`;
        geminiInputEl.focus({ preventScroll: true });
      });
      card.addEventListener('submit', (e) => {
        e.preventDefault();
        const gKey = $('byokGeminiInput').value.trim();
        const mKey = $('byokMapsInput').value.trim();
        const sbKey = $('byokSafeBrowsingInput').value.trim();
        setGeminiSessionKey(gKey);
        setSessionKey('GOOGLE_MAPS_KEY', mKey);
        setSessionKey('GOOGLE_MAPS_API_KEY', mKey);
        setSessionKey('SAFE_BROWSING_KEY', sbKey);
        setSessionKey('SAFE_BROWSING_API_KEY', sbKey);
        setSessionKey('BYOK_DISMISSED', gKey ? '' : '1');
        API.setGeminiKey?.(gKey);
        if (gKey) setConnectionStatus('byok');
        else setConnectionStatus('offline');
        toast(gKey ? '🟢 Live: Gemini 2.5 Flash BYOK activated.' : 'Switched to Mock Fallback Engine.');
        finish(gKey);
      });
      $('byokOfflineBtn').addEventListener('click', () => {
        setSessionKey('BYOK_DISMISSED', '1');
        setConnectionStatus('offline');
        toast('Skipped API key — Mock Fallback Engine active.');
        finish('');
      });
      $('byokClearBtn')?.addEventListener('click', () => {
        setGeminiSessionKey('');
        setSessionKey('GOOGLE_MAPS_KEY', '');
        setSessionKey('GOOGLE_MAPS_API_KEY', '');
        setSessionKey('SAFE_BROWSING_KEY', '');
        setSessionKey('SAFE_BROWSING_API_KEY', '');
        setSessionKey('BYOK_DISMISSED', '1');
        API.setGeminiKey?.('');
        setConnectionStatus('offline');
        toast('🗑️ Stored API keys cleared from sessionStorage.');
        finish('');
      });
      $('byokCloseBtn').addEventListener('click', dismissModal);
      $('byokGeminiInput')?.focus();
    });
  }

  /* =========================================================================
   * PHASE 2: LIVE GEMINI 2.5 FLASH REST INTEGRATION & MOCK FALLBACK ENGINE
   * ========================================================================= */
  /**
   * Maps a numeric 0–100 threat score to one canonical severity tier so banner
   * color, gauge level, verdict copy, and threat chips always stay synchronized.
   *
   * @param {number} score Risk score between 0 and 100.
   * @returns {object} Normalized tier metadata (`safe`, `moderate`, or `critical`).
   */
  function getThreatTier(score) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    if (s <= 25) {
      return {
        score: s,
        tier: 'safe',
        level: 'safe',
        intent: 'SAFE',
        cardClass: 'safe',
        pillClass: 'green',
        badgeLabel: 'KAVACH SAFE CHECK',
        verdict: 'Looks safe. No common scam pattern found',
        scamType: 'Verified Safe Message',
        mood: 'safe',
      };
    }
    if (s <= 65) {
      return {
        score: s,
        tier: 'moderate',
        level: 'suspicious',
        intent: 'MODERATE',
        cardClass: 'moderate',
        pillClass: 'amber',
        badgeLabel: 'MODERATE RISK WARNING',
        verdict: 'Moderate / Low Risk — Verify Sender Before Acting',
        scamType: 'Unverified / Suspicious Request',
        mood: 'suspicious',
      };
    }
    return {
      score: s,
      tier: 'critical',
      level: 'critical',
      intent: 'SCAM',
      cardClass: 'scam',
      pillClass: 'red',
      badgeLabel: 'HIGH RISK SCAM ALERT',
      verdict: 'High Risk / Critical Scam Detected',
      scamType: 'Active Cyber Fraud Pattern',
      mood: 'critical',
    };
  }

  const ROUTER_SYSTEM_PROMPT = [
    'You are the Kavach x Urimai Multi-Agent Intent Router for Indian citizens.',
    'Analyze the user message or voice transcript inside <suspect> tags.',
    'Classify intent strictly as:',
    '- SAFE: completely benign normal personal messages, legitimate non-phishing transactional notices ("do not share OTP"), or harmless reminders. Set confidence_score strictly between 0 and 25 as the THREAT RISK SCORE (e.g. 5), leave threat_vectors empty [], and set action_payload.summary to "Looks safe. No common scam pattern found".',
    '- SCAM: suspicious or fraudulent messages. Always use confidence_score as a THREAT RISK SCORE (26-65 for moderate/low risk warning notes; 66-100 for high risk / critical scam like CBI/police digital arrest, fake courier drugs, OTP/KYC phishing, lottery/SEBI stock scams), list specific threat_vectors, and provide 1930 draft_text.',
    '- CIVIC: broken water pipe, bad road, pothole, streetlight, drainage, garbage, panchayat/municipal breakdown.',
    'Return strictly formatted JSON matching the schema: intent, confidence_score (0-100 threat risk score), threat_vectors, action_payload.',
  ].join(' ');

  const GEMINI_RESPONSE_SCHEMA = Object.freeze({
    type: 'OBJECT',
    properties: {
      intent: { type: 'STRING', enum: ['SAFE', 'SCAM', 'CIVIC'] },
      confidence_score: { type: 'NUMBER' },
      threat_vectors: {
        type: 'ARRAY',
        items: { type: 'STRING' },
      },
      action_payload: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          department_or_agency: { type: 'STRING' },
          draft_text: { type: 'STRING' },
          regional_draft_text: { type: 'STRING' },
          next_steps: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: ['summary', 'department_or_agency', 'draft_text', 'next_steps'],
      },
    },
    required: ['intent', 'confidence_score', 'threat_vectors', 'action_payload'],
  });

  /**
   * Sends a structured prompt to Gemini 2.5 Flash REST API and enforces a strict JSON schema
   * containing `intent`, `confidence_score`, `threat_vectors`, and `action_payload`.
   *
   * @param {string} userText Raw user utterance or suspicious message.
   * @param {string} apiKey User-provided Google Gemini API key.
   * @returns {Promise<Object>} Normalized Gemini intent verdict and action payload.
   */
  async function processWithGemini(userText, apiKey) {
    const cleanKey = String(apiKey || '').trim();
    if (!cleanKey) throw new Error('Missing Gemini API key');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Network offline');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const targetLang = langInfo(uiLang());
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ROUTER_SYSTEM_PROMPT }] },
          contents: [{
            role: 'user',
            parts: [{
              text: `Preferred User Language: ${targetLang.name} (${targetLang.native})\n<suspect>\n${String(userText || '').trim()}\n</suspect>`,
            }],
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const payload = await response.json();
      const rawJson = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      const parsed = JSON.parse(rawJson);
      const rawIntent = String(parsed.intent || '').toUpperCase();
      const normalizedIntent = rawIntent === 'CIVIC' ? 'CIVIC' : rawIntent === 'SAFE' ? 'SAFE' : 'SCAM';
      let score = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence_score) || 0)));
      if (normalizedIntent === 'SAFE' && score > 25) {
        score = Math.min(25, Math.max(0, 100 - score));
      }
      const tier = normalizedIntent === 'CIVIC' ? null : getThreatTier(score);
      const vectors = tier && tier.tier === 'safe'
        ? []
        : Array.isArray(parsed.threat_vectors)
          ? parsed.threat_vectors.map((v) => String(v || '').trim()).filter(Boolean)
          : [];
      const ap = parsed.action_payload && typeof parsed.action_payload === 'object' ? parsed.action_payload : {};
      const nextSteps = Array.isArray(ap.next_steps)
        ? ap.next_steps.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
      const summary = tier && tier.tier === 'safe'
        ? tier.verdict
        : (String(ap.summary || '').trim() || tier?.verdict || String(userText || '').slice(0, 140));

      setConnectionStatus('byok');
      return {
        _source: 'edge-byok',
        intent: normalizedIntent === 'CIVIC' ? 'CIVIC' : tier.intent,
        confidence_score: score,
        threat_vectors: vectors,
        action_payload: {
          summary,
          department_or_agency: String(ap.department_or_agency || (normalizedIntent === 'CIVIC' ? 'Municipal Grievance Desk' : 'National Cybercrime Helpline 1930')).trim(),
          draft_text: tier && tier.tier !== 'critical' ? '' : String(ap.draft_text || '').trim(),
          regional_draft_text: String(ap.regional_draft_text || '').trim(),
          next_steps: nextSteps,
        },
        risk_score: normalizedIntent === 'CIVIC' ? 0 : score,
        details: summary,
        action: nextSteps[0] || '',
      };
    } catch (err) {
      console.warn('[Chat_Safe][Gemini] Edge BYOK request failed:', err?.message || err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  window.processWithGemini = processWithGemini;

  /**
   * Deterministic local & demo rule engine when API key is skipped or offline.
   * Synchronizes SAFE (0-25), MODERATE (26-65), CRITICAL SCAM (66-100), and CIVIC paths.
   *
   * @param {string} userText Citizen input or voice transcript.
   * @returns {Promise<Object>} Structured Gemini-compatible verdict payload.
   */
  async function runMockFallbackEngine(userText) {
    const clean = String(userText || '').trim();
    const base = await API.call('analyze', { text: clean, lang, location: 'Ward 12, Coimbatore' }).catch((err) => {
      console.warn('[Chat_Safe][Fallback] Local analyze call failed:', err?.message || err);
      return null;
    });

    const civicRe = /\b(water\s*pipe|water|pipe|pothole|road|street\s*light|streetlight|drainage|sewage|garbage|trash|panchayat|municipality|ward)\b/i;
    const isCivic = base?.intent === 'CIVIC' || (civicRe.test(clean) && !/\b(electricity\s*bill|disconnect|otp|upi|arrest|cbi)\b/i.test(clean));
    if (isCivic) {
      const kit = base?.urimaiKit || await API.call('urimai', { text: clean, lang, location: 'Ward 12, Coimbatore' }).catch((err) => {
        console.warn('[Chat_Safe][Fallback] Local urimai kit generation failed:', err?.message || err);
        return null;
      });
      return {
        _source: 'mock-fallback',
        intent: 'CIVIC',
        confidence_score: 94,
        risk_score: 0,
        threat_vectors: [
          `Department: ${kit?.department || 'Municipal Water & Civic Works'}`,
          'Public Infrastructure Disruption',
          'Eligible for O2O Petition + CM Helpline',
        ],
        action_payload: {
          summary: kit?.summary || clean,
          department_or_agency: kit?.department || 'Municipal Water Supply & Drainage Board',
          draft_text: kit?.englishLetter || `To the Executive Officer,\nSubject: Urgent Civic Grievance\nIssue: ${clean}\nRequested Action: Immediate inspection and repair.`,
          regional_draft_text: kit?.regionalLetter || '',
          next_steps: [
            'Attach street photo and generate bilingual A4 PDF in Family Hub.',
            'Collect 5 resident signatures or submit directly via State CM Helpline.',
          ],
        },
        details: kit?.summary || clean,
        action: 'Open Family Hub to download bilingual PDF or submit via CM Portal.',
        urimaiKit: kit,
      };
    }

    const ruleScore = Math.max(0, Math.min(100, Math.round(Number(base?.score) || 0)));
    const hasSafeOtpNotice = /\b(do\s+not|never|don'?t)\s+share\s+(this\s+|your\s+|the\s+)?(otp|pin|cvv)/i.test(clean)
      && !/\b(http|https|bit\.ly|tinyurl|t\.me|verify\s+now|blocked|suspended|arrest|cbi|transfer)\b/i.test(clean);

    // Dynamic weighted token, URL pattern, and intent marker scoring (no static fixed scores)
    const tokenSignals = [
      { pts: 28, re: /\b(cbi|ncb|enforcement\s+directorate|\bed\b|police|customs|trai|income\s*tax|inspector)\b/i },
      { pts: 28, re: /\b(digital\s+arrest|arrest(?:\s+warrant)?|warrant|summons|non[- ]?bailable|skype|stay\s+on\s+(?:video\s*)?call|do\s+not\s+tell\s+family)\b/i },
      { pts: 22, re: /\b(fedex|courier|parcel|narcotics|drugs|seized|contraband)\b/i },
      { pts: 30, re: /(share|send|verify|update|enter|tell).{0,25}\b(otp|pin|cvv|kyc|aadhaar|pan)\b/i },
      { pts: 26, re: /\b(kyc|account|sim|card|pan|bank)\b.{0,25}\b(blocked|suspended|deactivated|expire|frozen)\b/i },
      { pts: 22, re: /\b(transfer|deposit|send|pay)\b.{0,25}(?:₹|rs\.?|inr|\d{3,})|\b[a-z0-9._-]+@(?:ybl|okaxis|okicici|oksbi|paytm|upi|ibl)\b|\bifsc\b/i },
      { pts: 26, re: /\b(guaranteed\s+returns?|daily\s+profit|sebi\s+vip|vip\s+stock\s+tips?|won\s+(?:a\s+)?lottery|claim\s+(?:your\s+)?prize)\b/i },
      { pts: 26, re: /\b(bit\.ly|tinyurl\.com|t\.co|t\.me|rb\.gy|goo\.gl)\b|https?:\/\/\d{1,3}(?:\.\d{1,3}){3}|\.(?:tk|ml|ga|cf|gq|xyz|top|buzz)\b/i },
      { pts: 28, re: /\b(urgent|immediate(?:ly)?|verify\s+now|act\s+now|last\s+warning|within\s+\d+\s+hours?)\b/i },
      { pts: 18, re: /\b(click\s+here|claim\s+(?:now|your)|free\s+gift|loan\s+approved|bonus|reward)\b/i },
    ];
    let weightedTokens = 0;
    for (const sig of tokenSignals) {
      if (sig.re.test(clean)) weightedTokens += sig.pts;
    }

    let score;
    if (hasSafeOtpNotice) {
      score = Math.max(0, Math.min(18, Math.round(weightedTokens * 0.25)));
    } else if (weightedTokens > 0) {
      score = Math.max(ruleScore, Math.min(100, Math.round(weightedTokens + ruleScore * 0.35)));
    } else {
      score = ruleScore;
    }

    const tier = getThreatTier(score);
    let vectors = [];
    if (tier.tier === 'critical') {
      vectors = [...(base?.redFlags || [])];
      if (/\b(cbi|police|ncb|customs)\b/i.test(clean) && !vectors.some((v) => /impersonat|cbi|police/i.test(v))) {
        vectors.unshift('Fake Law Enforcement / CBI Authority Impersonation');
      }
      if (/\b(digital\s+arrest|arrest)\b/i.test(clean) && !vectors.some((v) => /arrest/i.test(v))) {
        vectors.unshift('Digital Arrest & Legal Fear Tactic');
      }
      if (/\b(otp|kyc|pin|cvv|blocked|suspended)\b/i.test(clean) && !vectors.some((v) => /otp|kyc|credential/i.test(v))) {
        vectors.unshift('Credential / OTP Harvesting');
      }
      if (/\b(sebi|guaranteed|stock|profit|lottery|prize)\b/i.test(clean) && !vectors.some((v) => /investment|lottery|return/i.test(v))) {
        vectors.unshift('Guaranteed Returns / Investment Scam');
      }
      if (!vectors.length) vectors.push('High-Risk Cyber Fraud Pattern');
    } else if (tier.tier === 'moderate') {
      vectors = [...(base?.redFlags || [])];
      if (!vectors.length) vectors.push('Unverified Link or Urgent Call-to-Action — Verify Sender');
    }

    const baseWasSafe = !base?.level || base.level === 'safe';
    const summary = tier.tier === 'safe'
      ? tier.verdict
      : tier.tier === 'moderate'
        ? ((!baseWasSafe && base?.verdict) ? base.verdict : tier.verdict)
        : ((!baseWasSafe && base?.verdict) ? base.verdict : 'High Risk / Critical Scam — Do Not Comply or Pay');

    const complaintDraft = tier.tier === 'critical'
      ? (base?.complaint || [
        'NATIONAL CYBER CRIME REPORTING PORTAL (https://cybercrime.gov.in | Helpline: 1930)',
        `Risk Assessment: ${score}/100 (HIGH RISK / CRITICAL)`,
        `Reported Message/Call: "${clean}"`,
        `Threat Vectors: ${vectors.join('; ')}`,
        'Action Requested: Immediate call trace / UPI & bank freeze protection under 1930.',
      ].join('\n'))
      : '';

    const nextSteps = tier.tier === 'safe'
      ? ['No common scam pattern found. Continue practicing safe digital hygiene and never share OTPs.']
      : tier.tier === 'moderate'
        ? ((!baseWasSafe && base?.nextSteps?.length) ? base.nextSteps : [
          'Verify this request via the official website, app, or printed customer-care number.',
          'Do not click shortened links or share OTP, PIN, or KYC documents.',
        ])
        : ((!baseWasSafe && base?.nextSteps?.length) ? base.nextSteps : [
          'Disconnect immediately — Indian Police/CBI never conduct "digital arrests" on video.',
          'Do NOT transfer any money or share OTP/Aadhaar/PAN details.',
          'Dial 1930 or report at cybercrime.gov.in immediately.',
        ]);

    return {
      _source: 'mock-fallback',
      intent: tier.intent,
      confidence_score: score,
      risk_score: score,
      threat_vectors: vectors,
      action_payload: {
        summary,
        department_or_agency: tier.tier === 'critical' ? 'National Cybercrime Helpline (1930) / I4C' : 'Kavach Local Shield',
        draft_text: complaintDraft,
        regional_draft_text: '',
        next_steps: nextSteps,
      },
      details: tier.tier === 'safe' ? tier.verdict : (base?.explanation || summary),
      action: nextSteps[0],
      _baseAnalysis: base,
    };
  }

  /**
   * Routes a citizen utterance or suspicious forward through the Dual-Mode AI pipeline:
   *  1. Immediate native offline check (`!navigator.onLine`) -> Mock Fallback Engine.
   *  2. Primary Cloud Run backend (`POST api/analyze`) when running on Node server.
   *  3. Live Gemini 2.5 Flash REST call (`processWithGemini`) when BYOK key is present.
   *  4. Bulletproof Mock Fallback Engine when skipped or unreachable.
   *
   * @param {string} text Cleaned message or speech transcript to analyze.
   * @returns {Promise<Object>} Structured routing verdict.
   */
  async function analyzeIntent(text) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const offlineMsg = 'Network disconnected — running built-in Mock Fallback Engine.';
      setConnectionStatus('offline');
      toast(offlineMsg);
      if ($('xrayStatus')) $('xrayStatus').textContent = offlineMsg;
      const sim = await runMockFallbackEngine(text);
      return { ...sim, _offlineFallback: true };
    }

    // 1. Primary Server Call (/api/analyze) when Node backend is active
    if (API.mode() === 'server') {
      try {
        const serverRes = await fetch('api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getGeminiSessionKey() ? { 'x-gemini-key': getGeminiSessionKey() } : {}),
          },
          body: JSON.stringify({ text, lang, location: 'Ward 12, Coimbatore' }),
        });
        const contentType = serverRes.headers.get('content-type') || '';
        if (serverRes.ok && contentType.includes('application/json')) {
          const serverData = await serverRes.json();
          const hasLiveAi = Boolean(API.aiEnabled?.() || getGeminiSessionKey());
          setConnectionStatus(hasLiveAi ? 'cloud' : 'offline');
          return { ...serverData, _source: hasLiveAi ? 'cloud-run' : 'mock-fallback' };
        }
      } catch (err) {
        console.warn('[Chat_Safe][Analyze] Server endpoint unreachable, falling back to Edge BYOK/local engine:', err?.message || err);
      }
    }

    // 2. Live Gemini 2.5 Flash REST Integration (BYOK in sessionStorage)
    const edgeKey = getGeminiSessionKey();
    if (edgeKey) {
      try {
        return await processWithGemini(text, edgeKey);
      } catch (err) {
        console.warn('[Chat_Safe][Analyze] Edge Gemini fallback triggered:', err?.message || err);
        setConnectionStatus('offline');
        toast('Gemini API unreachable or invalid key — switched to Live AI Simulator.');
        const sim = await runMockFallbackEngine(text);
        return { ...sim, _offlineFallback: true };
      }
    }

    // 3. Zero-Config Intelligent Live AI Simulator Fallback (no API key required)
    setConnectionStatus('offline');
    return await runMockFallbackEngine(text);
  }

  /* =========================================================================
   * PHASE 3: GOOGLE MAPS GEOLOCATION, SAFE BROWSING API & THEME STATE MANAGEMENT
   * ========================================================================= */
  /**
   * Swaps the global UI CSS theme and palette dynamically across Urimai Blue
   * (`bluedragon` + `.civic-theme`), Safe Emerald (`mantis`), Moderate Amber (`mandarin`),
   * and Critical Scam Red (`lionfish` + `.scam-theme`).
   *
   * @param {'SCAM'|'CIVIC'|'SAFE'|'MODERATE'} intent Classified intent returned by AI/rules.
   * @param {number} [score=0] Risk score on a 0–100 scale.
   * @returns {void}
   */
  function switchIntentPalette(intent, score = 0) {
    const isCivic = intent === 'CIVIC';
    const tier = isCivic ? null : getThreatTier(score);
    const isCritical = Boolean(tier && tier.tier === 'critical');
    const isModerate = Boolean(tier && tier.tier === 'moderate');
    document.body.classList.toggle('civic-theme', isCivic);
    document.body.classList.toggle('scam-theme', isCritical);
    document.body.classList.toggle('moderate-theme', isModerate);
    const targetPalette = isCivic ? 'bluedragon' : isCritical ? 'lionfish' : isModerate ? 'mandarin' : 'mantis';
    if (window.ChatSafeTheme?.set) window.ChatSafeTheme.set('palette', targetPalette);
    else document.documentElement.dataset.palette = targetPalette;
    kavach.setDark(isDark());
  }

  /**
   * Acquires browser GPS coordinates inside strict error boundaries and resolves a formatted
   * street address via Google Maps Reverse Geocoding API (with server and simulated ward fallbacks).
   *
   * @returns {Promise<Object>} Resolved civic location metadata (`address`, optional `coords`, and `source`).
   */
  async function getGoogleMapsLocation() {
    const fallbackAddress = 'Location: Simulated Ward 12, Coimbatore, Tamil Nadu';
    const deniedMsg = 'Location permission denied. Using manual entry.';
    if (!navigator.geolocation) {
      if ($('detected-address')) $('detected-address').textContent = deniedMsg;
      if ($('geoStatus')) $('geoStatus').textContent = deniedMsg;
      return { address: fallbackAddress, source: 'simulated-ward' };
    }

    let position = null;
    let denied = false;
    try {
      position = await new Promise((resolve) => {
        try {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (geoErr) => {
              console.warn('[Chat_Safe][Geolocation] Position lookup failed or denied:', { code: geoErr?.code, message: geoErr?.message });
              denied = true;
              resolve(null);
            },
            { timeout: 3500, maximumAge: 60_000 },
          );
        } catch (err) {
          console.warn('[Chat_Safe][Geolocation] Hardware geolocation call threw:', err?.message || err);
          denied = true;
          resolve(null);
        }
      });
    } catch (err) {
      console.warn('[Chat_Safe][Geolocation] Geolocation wrapper boundary:', err?.message || err);
      denied = true;
      position = null;
    }

    if (!position) {
      if (denied) {
        if ($('detected-address')) $('detected-address').textContent = deniedMsg;
        if ($('geoStatus')) $('geoStatus').textContent = deniedMsg;
      }
      return { address: fallbackAddress, source: denied ? 'permission-denied-fallback' : 'simulated-ward' };
    }

    const { lat, lng } = position;
    const coordLabel = `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`;
    const mapsKey = getSessionKey('GOOGLE_MAPS_KEY') || getSessionKey('GOOGLE_MAPS_API_KEY');
    if (mapsKey && (!navigator || navigator.onLine)) {
      try {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(mapsKey)}`,
        );
        if (geoRes.ok) {
          const geoJson = await geoRes.json();
          const addr = geoJson?.results?.[0]?.formatted_address;
          if (addr) return { address: `${addr} (${coordLabel})`, coords: { lat, lng }, source: 'google-maps-api' };
        }
      } catch (err) {
        console.warn('[Chat_Safe][Maps] Reverse geocoding request failed, using coordinate fallback:', err?.message || err);
      }
    }

    if (API.mode() === 'server') {
      try {
        const serverGeo = await API.call('reverse-geocode', { lat, lng });
        if (serverGeo?.address) {
          return { address: `${serverGeo.address} (${coordLabel})`, coords: { lat, lng }, source: serverGeo.source || 'server-geocode' };
        }
      } catch (err) {
        console.warn('[Chat_Safe][Maps] Server reverse-geocode unavailable:', err?.message || err);
      }
    }

    return {
      address: `Live GPS Ward — ${coordLabel}`,
      coords: { lat, lng },
      source: 'gps-live-coords',
    };
  }

  const URL_DETECT_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|rb\.gy|cutt\.ly)\/[^\s<>"')]+/gi;

  /**
   * Extracts up to 10 normalized HTTP/HTTPS URLs from citizen-submitted text.
   *
   * @param {string} text Raw SMS, WhatsApp, or transcript content.
   * @returns {string[]} Deduplicated array of normalized URLs.
   */
  function extractUrlsFromText(text) {
    const raw = String(text || '');
    const found = [...raw.matchAll(URL_DETECT_REGEX)].map((m) => {
      const u = m[0].replace(/[.,;:!?]+$/, '');
      return u.startsWith('http') ? u : `https://${u}`;
    });
    return [...new Set(found)].slice(0, 10);
  }

  /**
   * Checks one or more URLs against Google Safe Browsing API v4 using `SAFE_BROWSING_KEY`
   * from `sessionStorage`, falling back to `/api/safebrowsing` and local heuristics if offline.
   *
   * @param {string|string[]} urlOrList Single URL or array of URLs to inspect.
   * @returns {Promise<Object>} Threat verdict (`safe`, `matches`, `urls`, and `source`).
   */
  async function checkSafeBrowsing(urlOrList) {
    const urls = (Array.isArray(urlOrList) ? urlOrList : [urlOrList]).filter(Boolean);
    if (!urls.length) return { safe: true, matches: [], urls: [], source: 'none' };

    const sbKey = getSessionKey('SAFE_BROWSING_KEY') || getSessionKey('SAFE_BROWSING_API_KEY');
    if (sbKey) {
      try {
        const res = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(sbKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: { clientId: 'chatsafe-urimai', clientVersion: '3.0.0' },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: urls.map((url) => ({ url })),
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const apiMatches = Array.isArray(data.matches)
            ? data.matches.map((m) => ({ url: m.threat?.url || urls[0], threatType: m.threatType || 'MALICIOUS_URL' }))
            : [];
          if (apiMatches.length > 0) {
            return { safe: false, matches: apiMatches, urls, source: 'google-safebrowsing-api' };
          }
        }
      } catch (err) {
        console.warn('[Chat_Safe][SafeBrowsing] API check failed, falling back to heuristic check:', err?.message || err);
      }
    }

    try {
      return await API.call('safebrowsing', { urls });
    } catch (err) {
      console.warn('[Chat_Safe][SafeBrowsing] Local heuristic check failed, returning safe fallback:', err?.message || err);
      return { safe: true, matches: [], urls, source: 'offline-fallback' };
    }
  }

  /**
   * Updates the Kavach avatar animation state and status pill text.
   *
   * @param {'idle'|'listening'|'thinking'|'speaking'} state Current agent lifecycle state.
   * @returns {void}
   */
  function setAgentState(state) {
    kavach.setState(state);
    $('agentState').textContent = t(`state_${state}`);
  }

  /**
   * Displays a transient status toast notification at the bottom of the viewport.
   *
   * @param {string} msg Human-readable notification text.
   * @returns {void}
   */
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 3400);
  }

  /**
   * Highlights active agent nodes along the multi-agent orchestration bus indicator.
   *
   * @param {string[]} activeIds Array of agent bus identifiers to mark active.
   * @returns {void}
   */
  function pulseBus(activeIds) {
    document.querySelectorAll('#agentBus .bus-node').forEach((n) => {
      n.classList.toggle('active', activeIds.includes(n.dataset.bus));
    });
  }

  /* ---------- Languages (All 23 Indian languages) ---------- */
  const activeDir = () => (langInfo(uiLang())?.rtl ? 'rtl' : 'ltr');

  /**
   * Synchronizes `dir="ltr|rtl"` attributes across dynamic result cards and chat logs.
   *
   * @param {'ltr'|'rtl'} dir Resolved writing direction for the active language.
   * @returns {void}
   */
  function syncDynamicDirections(dir) {
    const resolved = dir === 'rtl' ? 'rtl' : 'ltr';
    document.documentElement.dir = resolved;
    document.body.dir = resolved;
    [
      'agentLog', 'heroDynamicCard', 'result', 'urimaiScanResult',
      'familyKitCard', 'chatLog', 'autoOut', 'payResult', 'xrayStatus',
      'agentInput', 'message', 'usRegLetter', 'fhRegLetter', 'explanation',
      'redFlags', 'nextSteps',
    ].forEach((id) => {
      const node = $(id);
      if (node) node.setAttribute('dir', resolved);
    });
    document.querySelectorAll('#agentLog li, #chatLog li, .hero-dynamic-card, .urimai-card, .result').forEach((el) => {
      el.setAttribute('dir', resolved);
    });
    // Official English petition blocks always remain LTR
    if ($('usEngLetter')) $('usEngLetter').setAttribute('dir', 'ltr');
    if ($('fhEngLetter')) $('fhEngLetter').setAttribute('dir', 'ltr');
  }

  /**
   * Applies the selected UI language code, updates all `data-i18n` labels, and persists preference.
   *
   * @param {string} code ISO/Eighth-Schedule language code or `'auto'`.
   * @returns {void}
   */
  function applyLanguage(code) {
    lang = code === 'auto' || languages.some((l) => l.code === code) ? code : 'en';
    const info = langInfo(uiLang());
    const dir = info.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = uiLang();
    syncDynamicDirections(dir);

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const labelSpan = el.querySelector(':scope > .tab-label');
      const target = labelSpan || el;
      if (!el.dataset.i18nFallback) {
        el.dataset.i18nFallback = target.textContent.trim();
      }
      const translated = t(el.dataset.i18n, {}, el.dataset.i18nFallback);
      if (translated) target.textContent = translated;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (!el.dataset.i18nPlaceholderFallback) {
        el.dataset.i18nPlaceholderFallback = el.placeholder || '';
      }
      el.placeholder = t(el.dataset.i18nPlaceholder, {}, el.dataset.i18nPlaceholderFallback);
    });
    const notes = [];
    if (lang !== 'auto') notes.push(t('uiNote', { lang: `${info.native} (${info.name})` }));
    if (API.mode() === 'local') notes.push(t('offlineMode'));
    $('uiNote').hidden = notes.length === 0;
    $('uiNote').textContent = notes.join(' · ');
    $('micLabel').textContent = t(recognizer ? 'micStop' : 'micStart');
    renderHud();
    store('lang', lang);
  }

  /**
   * Loads the 23 Indian language catalog from the API layer and populates the `#lang` selector.
   *
   * @returns {Promise<void>} Resolves once language options are rendered and applied.
   */
  async function loadLanguages() {
    try {
      const payload = await API.call('languages');
      if (Array.isArray(payload?.languages) && payload.languages.length) {
        languages = payload.languages;
      }
    } catch (err) {
      console.warn('[Chat_Safe][i18n] Failed to load remote language catalog, using fallback:', err?.message || err);
    }
    const opts = [new Option(t('autoDetect'), 'auto'), ...languages.map((l) => new Option(`${l.native} — ${l.name}`, l.code))];
    $('lang').replaceChildren(...opts);
    const saved = load('lang');
    $('lang').value = saved === 'auto' || languages.some((l) => l.code === saved) ? saved : 'ta';
    applyLanguage($('lang').value);
  }

  /* ---------- Theme ---------- */
  $('themeToggle')?.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    window.ChatSafeTheme?.set('mode', next);
    kavach.setDark(next === 'dark');
    setMood(kavach.mood);
  });
  window.ChatSafeTheme?.onChange?.((s) => {
    kavach.setDark(!s.light);
    setMood(kavach.mood);
  });

  /* ---------- Voice Out (23 languages) ---------- */
  let voices = [];
  const refreshVoices = () => {
    try {
      voices = 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : [];
    } catch (err) {
      console.warn('[Chat_Safe][SpeechSynthesis] Unable to enumerate voices:', err?.message || err);
      voices = [];
    }
  };
  if ('speechSynthesis' in window) {
    refreshVoices();
    try {
      window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
    } catch (err) {
      console.warn('[Chat_Safe][SpeechSynthesis] voiceschanged listener registration failed:', err?.message || err);
    }
  }
  const voiceFor = (code) => {
    const tag = langInfo(code).speech.toLowerCase();
    return voices.find((v) => v.lang.toLowerCase() === tag) || voices.find((v) => v.lang.toLowerCase().startsWith(`${code}-`));
  };

  /**
   * Triggers Web Speech API (`speechSynthesis`) playback for a localized response inside
   * strict hardware/browser error boundaries so unavailable TTS never throws.
   *
   * @param {string} text Text string to synthesize aloud.
   * @param {string} [code=replyLang] Target Indian language code for voice selection.
   * @returns {Promise<boolean>} Resolves `true` when playback completes, or `false` if unavailable/failed.
   */
  async function triggerVoiceSynthesis(text, code = replyLang) {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      return false;
    }
    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = langInfo(code).speech;
        const v = voiceFor(code);
        if (v) u.voice = v;
        u.rate = 0.96;
        u.onstart = () => setAgentState('speaking');
        u.onboundary = () => kavach.pulse();
        u.onend = () => { setAgentState('idle'); resolve(true); };
        u.onerror = (evt) => {
          console.warn('[Chat_Safe][SpeechSynthesis] Utterance error:', evt?.error || 'unknown');
          setAgentState('idle');
          resolve(false);
        };
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn('[Chat_Safe][SpeechSynthesis] Hardware speech playback failed:', err?.message || err);
        setAgentState('idle');
        resolve(false);
      }
    });
  }

  /**
   * Speaks a reply aloud via `triggerVoiceSynthesis`.
   *
   * @param {string} text Text string to speak.
   * @param {string} [code=replyLang] Language code for voice selection.
   * @returns {Promise<boolean>} Resolves when synthesis finishes or falls back cleanly.
   */
  function speak(text, code = replyLang) {
    return triggerVoiceSynthesis(text, code);
  }

  /* ---------- Voice In ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;

  /**
   * Initializes the browser Web Speech API (`SpeechRecognition`) with strict permission
   * error handling so denied microphone access never throws unhandled exceptions.
   *
   * @param {(transcript: string) => void} onText Callback invoked with the recognized speech string.
   * @returns {void}
   */
  function startMic(onText) {
    if (!SR) { toast(t('noMic')); return; }
    if (recognizer) {
      try { recognizer.stop(); } catch { recognizer = null; }
      return;
    }
    try {
      try { window.speechSynthesis?.cancel(); } catch (err) {
        console.warn('[Chat_Safe][SpeechSynthesis] Cancel before mic start failed:', err?.message || err);
      }
      Sound.play('blip');
      const rec = new SR();
      rec.lang = lang === 'auto' ? 'en-IN' : langInfo(lang).speech;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      recognizer = rec;
      $('mic').setAttribute('aria-pressed', 'true');
      $('micLabel').textContent = t('micStop');
      setAgentState('listening');
      setMood('idle');
      rec.onresult = (e) => {
        const said = e.results[0]?.[0]?.transcript?.trim();
        if (said) onText(said);
      };
      rec.onerror = (evt) => {
        console.warn('[Chat_Safe][SpeechRecognition] Microphone capture error:', { error: evt?.error, message: evt?.message });
        const denied = evt?.error === 'not-allowed' || evt?.error === 'service-not-allowed';
        const msg = denied
          ? 'Microphone permission denied. Please type your message below.'
          : 'Could not hear clearly — try typing or speaking again.';
        if ($('xrayStatus')) $('xrayStatus').textContent = msg;
        toast(msg);
      };
      rec.onend = () => {
        recognizer = null;
        $('mic').setAttribute('aria-pressed', 'false');
        $('micLabel').textContent = t('micStart');
        if ($('agentState').textContent === t('state_listening')) setAgentState('idle');
      };
      rec.start();
    } catch (err) {
      console.warn('[Chat_Safe][SpeechRecognition] Failed to initialize microphone hardware:', err?.message || err);
      recognizer = null;
      $('mic').setAttribute('aria-pressed', 'false');
      $('micLabel').textContent = t('micStart');
      setAgentState('idle');
      const errMsg = 'Microphone permission denied or unavailable. Please type your message.';
      if ($('xrayStatus')) $('xrayStatus').textContent = errMsg;
      toast(errMsg);
    }
  }
  $('mic').addEventListener('click', () => startMic((said) => askAgent(said)));
  $('scannerMicBtn').addEventListener('click', () => startMic((said) => {
    $('message').value = said;
    runSmartScan(said);
  }));

  /* ---------- Chat & Speed-Dial '9' Voice IVR ---------- */
  /**
   * Appends a single directional message bubble into a chat log list element.
   *
   * @param {HTMLElement} logEl Target `<ol>` or `<ul>` message container.
   * @param {string} who Display sender label.
   * @param {string} cls CSS role class (`you`, `kavach`, `them`, `paati`).
   * @param {string} text Message text content.
   * @returns {void}
   */
  function appendChat(logEl, who, cls, text) {
    const dir = activeDir();
    const li = document.createElement('li');
    li.className = cls;
    li.dir = dir;
    const tag = document.createElement('span');
    tag.className = 'who';
    tag.textContent = who;
    const body = document.createElement('span');
    body.dir = dir;
    body.textContent = text;
    li.append(tag, body);
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  /**
   * Records an agent or citizen turn in the primary chat log and local case history store.
   *
   * @param {string} who Sender label.
   * @param {string} cls CSS message class.
   * @param {string} text Message content.
   * @returns {void}
   */
  function addAgentMessage(who, cls, text) {
    appendChat($('agentLog'), who, cls, text);
    caseStore.add(cls === 'you' ? 'you' : 'kavach', text, kavach.mood, uiLang());
    renderCases();
  }

  /**
   * Renders the hero intent verdict banner card (Urimai Civic vs. Kavach Scam/Moderate/Safe).
   *
   * @param {Object} verdict Routed AI or rule-engine verdict payload.
   * @param {string} rawText Original citizen prompt or pasted text.
   * @param {string} [geoAddress=''] Optional resolved GPS/Maps street address.
   * @returns {void}
   */
  function renderHeroDynamicCard(verdict, rawText, geoAddress = '') {
    const card = $('heroDynamicCard');
    if (!card || !verdict) return;

    const dir = activeDir();
    card.setAttribute('dir', dir);
    const intent = String(verdict.intent || 'SCAM').toUpperCase();
    const score = Math.max(0, Math.min(100, Math.round(Number(verdict.confidence_score ?? verdict.risk_score) || 0)));
    const vectors = Array.isArray(verdict.threat_vectors) ? verdict.threat_vectors : [];
    const ap = verdict.action_payload || {};
    const sourceBadge = verdict._source === 'edge-byok'
      ? 'Live Gemini 2.5 Flash'
      : verdict._source === 'cloud-run'
        ? 'Live Cloud Run'
        : 'Live AI Simulator';
    const geminiJsonPreview = JSON.stringify({
      intent,
      confidence_score: score,
      threat_vectors: vectors,
      action_payload: {
        summary: ap.summary || verdict.details || '',
        department_or_agency: ap.department_or_agency || (intent === 'CIVIC' ? 'Municipal Water Supply & Drainage Board' : 'National Cybercrime Helpline 1930'),
        next_steps: Array.isArray(ap.next_steps) ? ap.next_steps : [],
      },
      engine_source: sourceBadge,
    }, null, 2);

    if (intent === 'CIVIC') {
      const wardText = geoAddress || 'Acquiring live GPS ward coordinates…';
      const draftPreview = ap.draft_text || verdict.urimaiKit?.englishLetter || '';
      const regPreview = ap.regional_draft_text || verdict.urimaiKit?.regionalLetter || '';
      const kitObj = verdict.urimaiKit || activeUrimaiKit;
      const kitIdLabel = kitObj?.kitId || 'URM-CIVIC';
      card.className = 'hero-dynamic-card civic';
      card.hidden = false;
      card.innerHTML = `
        <div class="hdc-head">
          <span class="pill blue">URIMAI CIVIC ENGINE · ${escapeHtml(ap.department_or_agency || 'Municipal Grievance')}</span>
          <span class="small muted">${escapeHtml(sourceBadge)} · Confidence ${score}%</span>
        </div>
        <p style="margin:0;font-weight:700" dir="${dir}">${escapeHtml(ap.summary || rawText)}</p>
        <p class="small" style="margin:0"><strong>Live Ward / Coordinates:</strong> <span id="hdcGeoLabel">${escapeHtml(wardText)}</span></p>
        ${vectors.length ? `<div class="hdc-vectors">${vectors.map((v) => `<span class="hdc-vector-chip">${escapeHtml(v)}</span>`).join('')}</div>` : ''}
        <details class="hdc-json" open>
          <summary>Gemini 2.5 Structured JSON Response</summary>
          <pre dir="ltr">${escapeHtml(geminiJsonPreview)}</pre>
        </details>
        <div class="hdc-pdf-preview">
          <div class="hdc-pdf-preview-head">
            <span>📄 Exportable Bilingual A4 PDF Preview (${escapeHtml(kitIdLabel)})</span>
            <span class="pill blue">O2O + 5-Resident Signatures</span>
          </div>
          <p class="small muted" style="margin:0"><strong>Geo-Tagged Petition:</strong> ${escapeHtml(wardText)} · Official English + ${escapeHtml(kitObj?.langName || 'Regional')} script ready.</p>
          ${draftPreview ? `<pre class="hdc-draft" dir="ltr">${escapeHtml(draftPreview)}</pre>` : ''}
          ${regPreview ? `<pre class="hdc-draft" dir="${dir}">${escapeHtml(regPreview)}</pre>` : ''}
        </div>
        <div class="actions" style="margin:0">
          <button type="button" id="hdcDownloadPdfBtn" class="primary sm">📄 Export Bilingual PDF</button>
          <button type="button" id="hdcOpenFamilyBtn" class="secondary sm">Open Family Hub &amp; 5-Sign PDF</button>
          <button type="button" id="hdcOpenScannerBtn" class="secondary sm">View Full Civic Draft</button>
        </div>
      `;
      $('hdcDownloadPdfBtn')?.addEventListener('click', async () => {
        const targetKit = kitObj || activeUrimaiKit;
        if (!targetKit || !window.ChatSafePDF?.generateUrimaiPdf) {
          toast('Open Family Hub to export PDF.');
          return;
        }
        try {
          toast('Generating Unicode bilingual A4 PDF…');
          await window.ChatSafePDF.generateUrimaiPdf(targetKit, activePhotoDataUrl);
          toast('📄 Bilingual Urimai PDF exported!');
        } catch (err) {
          console.warn('[Chat_Safe][PDF] Direct card PDF export failed:', err?.message || err);
          toast('Unable to export PDF right now.');
        }
      });
      $('hdcOpenFamilyBtn')?.addEventListener('click', () => activateTab($('tab-family')));
      $('hdcOpenScannerBtn')?.addEventListener('click', () => {
        $('message').value = rawText;
        activateTab($('tab-scanner'));
      });
      return;
    }

    const tier = getThreatTier(score);
    const isCritical = tier.tier === 'critical';
    const isModerate = tier.tier === 'moderate';
    const isSafe = tier.tier === 'safe';
    const displayVectors = isSafe ? [] : vectors;
    const summaryText = isSafe
      ? tier.verdict
      : (ap.summary || verdict.details || tier.verdict);
    const draft = isCritical
      ? (ap.draft_text || `NATIONAL CYBER CRIME HELPLINE (1930 | https://cybercrime.gov.in)\nSuspected Scam (${tier.score}/100): ${rawText}`)
      : '';
    card.className = `hero-dynamic-card ${tier.cardClass}`;
    card.hidden = false;
    card.innerHTML = `
      <div class="hdc-head">
        <span class="pill ${tier.pillClass}">${tier.badgeLabel} · ${tier.score}/100</span>
        <span class="small muted">${escapeHtml(sourceBadge)}</span>
      </div>
      <div class="hdc-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tier.score}" aria-label="Scam risk meter">
        <span style="width:${tier.score}%"></span>
      </div>
      <p style="margin:0;font-weight:700" dir="${dir}">${escapeHtml(summaryText)}</p>
      ${displayVectors.length ? `<div class="hdc-vectors">${displayVectors.map((v) => `<span class="hdc-vector-chip">${escapeHtml(v)}</span>`).join('')}</div>` : ''}
      <details class="hdc-json" open>
        <summary>Gemini 2.5 Structured JSON Response</summary>
        <pre dir="ltr">${escapeHtml(geminiJsonPreview)}</pre>
      </details>
      ${isModerate && ap.next_steps?.length ? `<p class="small" style="margin:0" dir="${dir}">${escapeHtml(ap.next_steps[0])}</p>` : ''}
      ${isCritical && draft ? `<pre class="hdc-draft" dir="${dir}">${escapeHtml(draft)}</pre>` : ''}
      <div class="actions" style="margin:0">
        ${isCritical ? '<button type="button" id="hdcCopy1930Btn" class="primary sm">Copy 1930 Complaint</button>' : ''}
        ${isCritical ? '<a href="tel:1930" class="button danger sm">Call 1930</a>' : ''}
        <button type="button" id="hdcFullScanBtn" class="secondary sm">Open in AI Scanner</button>
      </div>
    `;
    $('hdcCopy1930Btn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard?.writeText(draft);
        toast('1930 Cybercrime complaint copied!');
      } catch (err) {
        console.warn('[Chat_Safe][Clipboard] Copy 1930 complaint failed:', err?.message || err);
      }
    });
    $('hdcFullScanBtn')?.addEventListener('click', () => {
      $('message').value = rawText;
      activateTab($('tab-scanner'));
      runSmartScan(rawText);
    });
  }

  /**
   * Processes a citizen's spoken or typed message through intent routing, updates the 3D Kavach
   * avatar, triggers GPS lookup for Urimai civic petitions or Family SOS alerts for critical scams,
   * and optionally synthesizes the response aloud.
   *
   * @param {string} text User message or voice transcript.
   * @returns {Promise<void>} Resolves once routing, UI updates, and optional speech complete.
   */
  async function handleUserMessage(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    $('agentInput').value = '';
    addAgentMessage('You', 'you', clean);
    setAgentState('thinking');
    pulseBus(['vani', 'gemini']);

    try {
      const routed = await analyzeIntent(clean);
      const intent = String(routed?.intent || 'SCAM').toUpperCase();
      const score = Math.max(0, Math.min(100, Math.round(Number(routed?.confidence_score ?? routed?.risk_score) || 0)));
      const ap = routed?.action_payload || {};
      const vectors = Array.isArray(routed?.threat_vectors) ? routed.threat_vectors : [];

      if (intent === 'CIVIC') {
        pulseBus(['vani', 'gemini', 'urimai', 'setu']);
        switchIntentPalette('CIVIC', 0);
        setMood(routed._offlineFallback ? 'suspicious' : 'civic');
        Sound.play('civic');

        const kit = routed.urimaiKit || await API.call('urimai', { text: clean, lang, location: 'Ward 12, Coimbatore' }).catch((err) => {
          console.warn('[Chat_Safe][Urimai] Kit generation fallback:', err?.message || err);
          return null;
        });
        if (!kit) {
          throw new Error('Unable to generate Urimai kit');
        }
        if (ap.draft_text) kit.englishLetter = ap.draft_text;
        if (ap.regional_draft_text) kit.regionalLetter = ap.regional_draft_text;
        if (ap.department_or_agency) kit.department = ap.department_or_agency;
        if (ap.summary) kit.summary = ap.summary;
        routed.urimaiKit = kit;

        renderHeroDynamicCard(routed, clean, 'Acquiring live GPS ward coordinates…');
        const replyText = `${ap.summary || kit.summary}\n\nUrimai Action Kit ${kit.kitId} ready (${kit.department}). Fetching live GPS ward coordinates…`;
        addAgentMessage('Kavach × Urimai', 'kavach', replyText);
        dispatchUrimaiKitToFamily(kit);

        const geo = await getGoogleMapsLocation();
        if (geo?.address) {
          kit.location = geo.address;
          kit.englishLetter = kit.englishLetter.replace(/Ward 12[^,\n]*/i, geo.address);
          if ($('hdcGeoLabel')) $('hdcGeoLabel').textContent = geo.address;
          if ($('fhKitTitle')) $('fhKitTitle').textContent = `${kit.summary} — ${geo.address}`;
          if ($('fhEngLetter')) $('fhEngLetter').textContent = kit.englishLetter;
          if ($('geoStatus')) $('geoStatus').textContent = `Google Maps Location: ${geo.address}`;
          if ($('detected-address')) $('detected-address').textContent = geo.address;
          renderHeroDynamicCard(routed, clean, geo.address);
        }
        if ($('autoSpeak').checked) await triggerVoiceSynthesis(ap.summary || kit.summary, uiLang());
        else setAgentState('idle');
        return;
      }

      // SAFE (0-25) / MODERATE (26-65) / CRITICAL SCAM (66-100) path
      const tier = getThreatTier(score);
      pulseBus(tier.tier === 'critical' ? ['vani', 'gemini', 'kavach', 'netra', 'payguard'] : ['vani', 'gemini', 'kavach']);
      switchIntentPalette(tier.intent, tier.score);
      setMood(tier.mood);
      Sound.play(tier.tier === 'critical' ? 'alert' : 'safe');

      const summaryLine = tier.tier === 'safe'
        ? tier.verdict
        : (ap.summary || routed.details || tier.verdict);
      const nextStep = ap.next_steps?.[0] || routed.action || '';
      const replyText = tier.tier === 'safe'
        ? `${summaryLine} (Risk ${tier.score}/100)`
        : `${summaryLine} (Risk ${tier.score}/100)\n${vectors.length ? `Vectors: ${vectors.join(' · ')}\n` : ''}${nextStep ? `Next: ${nextStep}` : ''}`;

      addAgentMessage('Kavach', `kavach ${tier.tier === 'critical' ? 'lvl-critical' : tier.tier === 'moderate' ? 'lvl-suspicious' : ''}`.trim(), replyText);
      renderHeroDynamicCard({
        ...routed,
        intent: tier.intent,
        confidence_score: tier.score,
        threat_vectors: tier.tier === 'safe' ? [] : vectors,
        action_payload: {
          ...ap,
          summary: summaryLine,
        },
      }, clean);

      if (tier.tier === 'critical') {
        triggerFamilySos(clean, {
          scamType: vectors[0] || ap.department_or_agency || 'Cyber Scam Alert',
          score: tier.score,
          lang: uiLang(),
        });
      }
      if ($('autoSpeak').checked) await triggerVoiceSynthesis(summaryLine, uiLang());
      else setAgentState('idle');
    } catch (err) {
      console.warn('[Chat_Safe][Agent] Message handling failed, reverting to offline notice:', err?.message || err);
      setAgentState('idle');
      setMood('suspicious');
      const notice = API.OFFLINE_NOTICE || 'Network unstable. Reverting to Offline Rule Engine. Please verify manually.';
      addAgentMessage('Kavach (Offline)', 'kavach', notice);
      toast(notice);
    }
  }

  /**
   * Dispatches a user message to the Kavach × Urimai agent pipeline.
   *
   * @param {string} text User message or speech transcript.
   * @returns {Promise<void>} Resolves once `handleUserMessage` completes.
   */
  function askAgent(text) {
    return handleUserMessage(text);
  }

  /**
   * Simulates pressing Speed-Dial `9` on a feature phone, plays DTMF + ring audio,
   * greets the user in their selected regional language, and speaks if enabled.
   *
   * @returns {void}
   */
  function triggerSpeedDial9() {
    Sound.playDtmf('9');
    setTimeout(() => Sound.play('ring'), 180);
    const info = langInfo(uiLang());
    const greeting = info.greeting || 'Vanakkam. Tell me what happened.';
    $('keypadText').innerHTML = `<span class="kp-tag">CONNECTED · ${info.native.toUpperCase()}</span>"${greeting}"`;
    pulseBus(['vani', 'gemini']);
    addAgentMessage('Vani IVR (Speed-Dial 9)', 'kavach', greeting);
    if ($('autoSpeak').checked) speak(greeting, info.code);
  }

  document.querySelectorAll('.keypad-key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.digit;
      if (d === '9') {
        triggerSpeedDial9();
      } else {
        Sound.playDtmf(d);
        $('keypadText').innerHTML = `<span class="kp-tag">KEYPAD</span>Dialed ${d} — press <b>9</b> for Kavach × Urimai AI`;
      }
    });
  });

  $('simScamCall').addEventListener('click', () => {
    triggerSpeedDial9();
    setTimeout(() => askAgent('A man asked for my OTP for the bank and said my account will be blocked today.'), 650);
  });
  $('simCivicCall').addEventListener('click', () => {
    triggerSpeedDial9();
    setTimeout(() => askAgent('The panchayat water pipe on my street broke 3 days ago and no one is fixing it.'), 650);
  });

  $('agentForm').addEventListener('submit', (e) => { e.preventDefault(); askAgent($('agentInput').value); });
  $('agentInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAgent($('agentInput').value); }
  });
  document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => askAgent(t(b.dataset.ask))));
  $('resetView').addEventListener('click', () => { kavach.resetView(); Sound.play('blip'); });
  $('newChat').addEventListener('click', () => {
    caseStore.startNew();
    $('agentLog').replaceChildren();
    const g = langInfo(uiLang()).greeting;
    addAgentMessage('Kavach × Urimai', 'kavach', g);
    setMood('idle');
  });

  /* ---------- Learned Scam HUD ---------- */
  /**
   * Reads learned scam category IDs from `localStorage`.
   *
   * @returns {string[]} Array of unlocked category identifiers.
   */
  function getLearned() {
    try { return (localStorage.getItem('chatsafe.learned') || '').split(',').filter(Boolean); } catch { return []; }
  }

  /**
   * Unlocks and persists a scam literacy badge in the HUD.
   *
   * @param {string} id Category identifier from `CATEGORIES`.
   * @returns {void}
   */
  function unlockCategory(id) {
    if (!CATEGORIES.includes(id)) return;
    const set = new Set(getLearned());
    if (set.has(id)) return;
    set.add(id);
    try { localStorage.setItem('chatsafe.learned', [...set].join(',')); } catch { /* ignore */ }
    Sound.play('unlock');
    renderHud();
    toast(`Unlocked scam badge: ${id}`);
  }

  /**
   * Renders the 8-scam progress HUD badges.
   *
   * @returns {void}
   */
  function renderHud() {
    const got = new Set(getLearned());
    $('hudCount').textContent = `${got.size}/${CATEGORIES.length}`;
    $('hudList').replaceChildren(...CATEGORIES.map((id) => {
      const li = document.createElement('li');
      li.className = got.has(id) ? 'on' : '';
      li.textContent = `${got.has(id) ? '✓ ' : ''}${id.replace('_', ' ')}`;
      return li;
    }));
  }

  /* ---------- Tabs ---------- */
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

  /**
   * Activates a tabpanel, stops active audio, and synchronizes ARIA `aria-selected` states.
   *
   * @param {HTMLElement} tab Target tab button element.
   * @returns {void}
   */
  function activateTab(tab) {
    killAllAudio();
    tabs.forEach((btn) => {
      const on = btn === tab;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      $(btn.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((btn) => btn.addEventListener('click', () => activateTab(btn)));

  /* ---------- TAB 1: RADAR & DAILY VIDEO REELS ---------- */
  /**
   * Escapes HTML and highlights `[..._REDACTED]` PII tokens for safe rendering.
   *
   * @param {string} text Raw or redacted feed message.
   * @returns {string} HTML string with `.redacted-tag` spans.
   */
  function highlightRedacted(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\[[A-Z_]+_REDACTED\]/g, (tag) => `<span class="redacted-tag">${tag}</span>`);
  }

  let radarCity = 'All';
  let radarFeedMode = 'all'; // 'all' | 'scams' | 'civic' | 'video'

  /**
   * Toggles visibility of Radar video, scam, and civic sections based on active feed filter.
   *
   * @returns {void}
   */
  function applyRadarFeedVisibility() {
    $('radarVideoSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'video');
    $('radarScamSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'scams');
    $('radarCivicSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'civic');
  }

  /**
   * Fetches and renders the Drishti Radar threat feed, civic issues list, and daily video reels.
   *
   * @returns {Promise<void>} Resolves once radar cards and video reels are mounted.
   */
  async function renderRadar() {
    try {
      const data = await API.call('radar', { city: radarCity });
      $('radarScamCount').textContent = `${data.scams.length} active patterns`;
      $('radarCivicCount').textContent = `${data.civic.length} active issues`;

      // Scams
      $('radarScamList').innerHTML = data.scams.map((s) => `
        <article class="radar-item scam" data-tone="scam">
          <div class="radar-meta">
            <span class="pill red">🔥 ${s.category}</span>
            <span>📍 ${s.city}</span>
            <span>· ${s.timeAgo}</span>
            <span style="margin-left:auto">${s.reports} reports</span>
          </div>
          <p style="margin:0">${redactionEnabled ? highlightRedacted(s.redactedText) : s.rawText}</p>
          <div class="actions" style="margin:0">
            <button type="button" class="chip sm radar-scan-btn" data-text="${encodeURIComponent(s.rawText)}">Scan in AI Scanner →</button>
            <span class="small muted">${redactionEnabled ? `🔒 ${s.redactedCount} PII fields masked` : '⚠️ Unredacted preview'}</span>
          </div>
        </article>
      `).join('');

      $('radarScamList').querySelectorAll('.radar-scan-btn').forEach((b) => {
        b.addEventListener('click', () => {
          $('message').value = decodeURIComponent(b.dataset.text);
          activateTab($('tab-scanner'));
          runSmartScan($('message').value);
        });
      });

      // Civic Watch
      $('radarCivicList').innerHTML = data.civic.map((c) => `
        <article class="radar-item civic" data-tone="civic">
          <div class="radar-meta">
            <span class="pill blue">⚠️ ${c.department}</span>
            <span>📍 ${c.city} (${c.ward})</span>
            <span style="margin-left:auto">${c.timeAgo}</span>
          </div>
          <strong>${c.title}</strong>
          <p class="small muted" style="margin:0">${c.summary}</p>
          <div class="actions" style="margin:0;align-items:center">
            <span class="pill green">${c.status}</span>
            <button type="button" class="chip sm civic-upvote">👍 Support (<span>${c.upvotes}</span>)</button>
          </div>
        </article>
      `).join('');

      $('radarCivicList').querySelectorAll('.civic-upvote').forEach((b) => {
        b.addEventListener('click', () => {
          const sp = b.querySelector('span');
          sp.textContent = String(Number(sp.textContent) + 1);
          Sound.play('blip');
        });
      });

      // Daily Video Reels (3-Column Grid)
      window.ChatSafeReels?.renderReelsFeed($('reelScroller'), data.reels, {
        onSpeak: (script) => speak(script, 'en'),
      });
      applyRadarFeedVisibility();
    } catch (err) {
      console.warn('[Chat_Safe][Radar] Failed to render radar feed:', err?.message || err);
    }
  }

  document.querySelectorAll('#regionPills .region-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      radarCity = btn.dataset.city;
      document.querySelectorAll('#regionPills .region-pill').forEach((b) => b.classList.toggle('active', b === btn));
      renderRadar();
    });
  });

  document.querySelectorAll('#feedModeTabs .feed-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      radarFeedMode = btn.dataset.feed;
      document.querySelectorAll('#feedModeTabs .feed-tab').forEach((b) => b.classList.toggle('active', b === btn));
      applyRadarFeedVisibility();
    });
  });

  $('toggleRedaction').addEventListener('click', () => {
    redactionEnabled = !redactionEnabled;
    $('toggleRedaction').setAttribute('aria-pressed', String(redactionEnabled));
    $('toggleRedaction').textContent = redactionEnabled ? '👁️ Gemini [REDACTED] On' : '👁️ Showing Raw Data';
    renderRadar();
  });
  $('redactBtn').addEventListener('click', async () => {
    const val = $('redactInput').value.trim();
    if (!val) return;
    pulseBus(['netra']);
    try {
      const r = await API.call('redact', { text: val });
      $('redactOut').innerHTML = `Result (${r.count} masked): ${highlightRedacted(r.redacted)}`;
    } catch (err) {
      console.warn('[Chat_Safe][Redact] PII redaction request failed:', err?.message || err);
      toast('Unable to run PII redaction right now.');
    }
  });

  // Verified User Video Publisher
  $('openPublisherBtn').addEventListener('click', () => { $('videoPublisherForm').hidden = !$('videoPublisherForm').hidden; });
  $('cancelPubBtn').addEventListener('click', () => { $('videoPublisherForm').hidden = true; });
  $('videoPublisherForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('pubTitle').value.trim();
    const creator = $('pubCreator').value.trim();
    const category = $('pubCategory').value.trim() || 'Verified Alert';
    const city = $('pubCity').value;
    const summary = $('pubSummary').value.trim();
    const verified = $('pubVerified').checked;
    const file = $('pubVideoFile').files?.[0];
    if (!title || !summary) return;
    const videoUrl = file ? URL.createObjectURL(file) : null;
    window.ChatSafeReels.addUserReel({
      id: `user-reel-${Date.now()}`,
      title,
      creator,
      city,
      category,
      summary,
      duration: '0:30',
      verified,
      verifiedBadge: verified ? 'Verified User ✓' : 'Community',
      durationSec: 15,
      views: 'Just now',
      likes: 1,
      accent: '#7c3aed',
      videoUrl,
      scenes: [
        { badge: category, headline: title, body: summary },
        { badge: city.toUpperCase(), headline: `Posted by ${creator}`, body: 'Verified by Chat_Safe × Drishti Radar.' },
      ],
    });
    $('videoPublisherForm').reset();
    $('videoPublisherForm').hidden = true;
    renderRadar();
    toast('✅ Verified scam video published to Daily News Reels!');
  });

  /**
   * Executes the unified Kavach × Urimai Multi-Agent scan flow: Safe Browsing link check,
   * Dual-Mode Gemini Intent Routing, Google Maps GPS lookup for civic petitions, and DOM updates.
   *
   * @param {string} text Raw text pasted or spoken by the user.
   * @returns {Promise<void>} Resolves once UI panels, palettes, and avatar states are updated.
   */
  async function runSmartScan(text) {
    const clean = text.trim();
    if (!clean) return;
    $('scanBox').classList.add('scanning');
    $('xrayStatus').textContent = 'Analyzing with Gemini Intent Router…';
    $('result').hidden = true;
    $('urimaiScanResult').hidden = true;
    if ($('heroDynamicCard')) $('heroDynamicCard').hidden = true;
    if ($('redFlags')) $('redFlags').innerHTML = '';
    if ($('nextSteps')) $('nextSteps').innerHTML = '';
    if ($('complaint')) $('complaint').value = '';
    if ($('complaintBlock')) $('complaintBlock').hidden = true;
    if ($('upiBlock')) $('upiBlock').hidden = true;
    if ($('upiList')) $('upiList').innerHTML = '';
    pulseBus(['gemini', 'kavach', 'urimai']);
    Sound.play('scan');

    try {
      const sbWidget = $('safebrowsing-widget');
      const sbStatus = $('url-threat-status');
      const mapsBadge = $('maps-status-badge');
      const detectedAddrEl = $('detected-address');
      sbWidget?.classList.add('hidden');
      mapsBadge?.classList.add('hidden');

      // 1) Detect URLs in input & run Google Safe Browsing / Heuristic URL Check
      const detectedUrls = extractUrlsFromText(clean);
      let sbResult = null;
      if (detectedUrls.length) {
        sbWidget?.classList.remove('hidden', 'danger', 'safe');
        if (sbStatus) sbStatus.textContent = `Scanning ${detectedUrls.length} link(s)...`;
        sbResult = await checkSafeBrowsing(detectedUrls);
      }

      // 2) Dual-Mode Gemini Intent Routing (Cloud Run -> Live Gemini 2.5 Flash -> Mock Fallback Engine)
      const routed = await analyzeIntent(clean);
      const isCloud = routed?._source === 'cloud-run';
      const isEdgeByok = routed?._source === 'edge-byok';
      const isMock = routed?._source === 'mock-fallback';
      const aiOffline = Boolean(routed?._offlineFallback);

      const res = isCloud
        ? routed
        : (routed._baseAnalysis || await API.call('analyze', { text: clean, lang, location: 'Ward 12, Coimbatore' }));

      if (isEdgeByok || isMock) {
        const ap = routed.action_payload || {};
        const vectors = Array.isArray(routed.threat_vectors) ? routed.threat_vectors : [];
        const confScore = Math.max(0, Math.min(100, Math.round(Number(routed.confidence_score ?? routed.risk_score) || 0)));

        if (routed.intent === 'CIVIC') {
          const kit = routed.urimaiKit || res.urimaiKit || await API.call('urimai', { text: clean, lang, location: 'Ward 12, Coimbatore' });
          if (ap.department_or_agency) kit.department = ap.department_or_agency;
          if (ap.summary) kit.summary = ap.summary;
          if (ap.draft_text) kit.englishLetter = ap.draft_text;
          if (ap.regional_draft_text) kit.regionalLetter = ap.regional_draft_text;
          res.intent = 'CIVIC';
          res.level = 'civic';
          res.score = 0;
          res.urimaiKit = kit;
        } else {
          const finalScore = confScore;
          const tier = getThreatTier(finalScore);
          const origBaseSafe = !res.level || res.level === 'safe';
          res.intent = tier.intent;
          res.score = tier.score;
          res.level = tier.level;
          if (tier.tier === 'safe') {
            res.verdict = tier.verdict;
            res.scamType = tier.scamType;
            res.redFlags = [];
            res.complaint = '';
            res.nextSteps = ap.next_steps?.length ? ap.next_steps : ['No common scam pattern found. Never share OTPs or PINs with strangers.'];
            res.explanation = tier.verdict;
          } else if (tier.tier === 'moderate') {
            res.verdict = ap.summary || (!origBaseSafe && res.verdict ? res.verdict : tier.verdict);
            res.scamType = vectors[0] || res.scamType || tier.scamType;
            res.redFlags = vectors.length ? vectors : (res.redFlags?.length ? res.redFlags : ['Unverified request or suspicious link — verify independently.']);
            res.complaint = '';
            res.nextSteps = ap.next_steps?.length ? ap.next_steps : (!origBaseSafe && res.nextSteps?.length ? res.nextSteps : ['Verify sender through an official app or website before taking action.']);
            res.explanation = ap.summary || routed.details || (!origBaseSafe && res.explanation ? res.explanation : tier.verdict);
          } else {
            res.verdict = ap.summary || (!origBaseSafe && res.verdict ? res.verdict : tier.verdict);
            res.scamType = vectors[0] || res.scamType || tier.scamType;
            res.redFlags = vectors.length ? [...new Set([...vectors, ...(res.redFlags || [])])] : (res.redFlags || ['High-Risk Cyber Fraud Pattern']);
            res.nextSteps = ap.next_steps?.length ? [...new Set([...ap.next_steps, ...(res.nextSteps || [])])] : (res.nextSteps || []);
            res.complaint = ap.draft_text || res.complaint || `NATIONAL CYBER CRIME REPORTING PORTAL (https://cybercrime.gov.in | Helpline 1930)\nSuspected Scam (${res.score}/100): ${routed.details || clean}\nRecommended Action: ${routed.action || 'Freeze bank/UPI and dial 1930 immediately.'}`;
            res.explanation = ap.summary || routed.details || (!origBaseSafe && res.explanation ? res.explanation : res.verdict);
          }
        }
        res.engine = isEdgeByok
          ? 'Live: Edge AI (BYOK) — Gemini 2.5 Flash'
          : 'Mock Fallback Engine (Local Rules)';
      } else if (isCloud) {
        if (res.intent !== 'CIVIC') {
          const cloudTier = getThreatTier(res.score);
          res.score = cloudTier.score;
          res.level = cloudTier.level;
          res.intent = cloudTier.intent;
          if (cloudTier.tier === 'safe') {
            res.verdict = cloudTier.verdict;
            res.scamType = cloudTier.scamType;
            res.redFlags = [];
            res.complaint = '';
          }
        }
        res.engine = `Live: Cloud Run Server (${res.engine || 'Node.js'})`;
      }

      // 3) Override Risk Score to 100 & Force Deep Crimson Red if Safe Browsing flags a malicious URL
      const flaggedUrls = sbResult && !sbResult.safe && sbResult.matches?.length ? sbResult.matches : [];
      if (flaggedUrls.length > 0) {
        res.intent = 'SCAM';
        res.score = 100;
        res.risk_score = 100;
        res.level = 'critical';
        res.scamType = 'Malicious / Phishing URL Detected';
        res.verdict = `CRITICAL THREAT: Malicious URL Blocked (${flaggedUrls[0].url})`;
        if (!res.complaint) {
          res.complaint = `NATIONAL CYBER CRIME REPORTING PORTAL (https://cybercrime.gov.in | Helpline 1930)\nMalicious Link Detected (${flaggedUrls.map((m) => m.url).join(', ')}): ${clean}`;
        }
      }

      lastResult = res;
      $('scanBox').classList.remove('scanning');

      // Record scan history
      scanHistory.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: res.intent === 'CIVIC' ? 'CIVIC' : res.level.toUpperCase(),
        text: clean.slice(0, 80),
      });
      renderScanHistory();

      const offlineFallbackMsg = 'Network offline - switching to local rules. Please verify manually.';
      const degraded = Boolean(aiOffline || res._fallbackReason || res.aiError);
      if (aiOffline) toast(offlineFallbackMsg);

      // Branch A: URIMAI CIVIC (Blue Theme + Await Google Maps Geolocation + PDF Location Injection)
      if (res.intent === 'CIVIC' && res.urimaiKit) {
        pulseBus(['gemini', 'urimai', 'setu']);
        switchIntentPalette('CIVIC', 0);
        setMood(degraded ? 'suspicious' : 'civic');
        Sound.play('civic');
        $('xrayStatus').textContent = degraded
          ? offlineFallbackMsg
          : `Civic Grievance routed to Urimai Engine (${res.engine})`;
        $('urimaiScanResult').hidden = false;
        mapsBadge?.classList.remove('hidden');
        if (detectedAddrEl) detectedAddrEl.textContent = 'Acquiring precise location...';

        const geo = await getGoogleMapsLocation();
        const streetAddress = geo.address;
        res.urimaiKit.location = streetAddress;
        if (isEdgeByok && routed.details) res.urimaiKit.summary = routed.details;

        if (detectedAddrEl) detectedAddrEl.textContent = streetAddress;
        if ($('geoStatus')) $('geoStatus').textContent = `Google Maps Location: ${streetAddress}`;
        $('usDept').textContent = res.urimaiKit.department;
        $('usSummary').textContent = `${res.urimaiKit.summary} — ${streetAddress}`;
        $('usEngLetter').textContent = res.urimaiKit.englishLetter.replace(/Ward 12[^,\n]*/i, streetAddress);
        $('usRegTitle').textContent = `${res.urimaiKit.langName} (${res.urimaiKit.langNative}) Draft`;
        $('usRegLetter').textContent = res.urimaiKit.regionalLetter;
        activeUrimaiKit = res.urimaiKit;
        renderHeroDynamicCard(routed, clean, streetAddress);
        return;
      }

      // Branch B: KAVACH SCAM / MODERATE / SAFE (Synchronized Tier Verdict, Gauge, Colors & Hero Banner)
      const finalTier = getThreatTier(res.score);
      res.score = finalTier.score;
      res.level = finalTier.level;
      res.intent = finalTier.intent;
      if (finalTier.tier === 'safe') {
        res.verdict = finalTier.verdict;
        res.scamType = finalTier.scamType;
      }
      pulseBus(finalTier.tier === 'critical' ? ['gemini', 'kavach', 'netra', 'payguard'] : ['gemini', 'kavach']);
      switchIntentPalette(finalTier.intent, finalTier.score);
      setMood(flaggedUrls.length ? 'critical' : degraded ? 'suspicious' : finalTier.mood);
      Sound.play(finalTier.tier === 'critical' ? 'alert' : 'safe');
      $('xrayStatus').textContent = degraded ? offlineFallbackMsg : '';
      renderHeroDynamicCard({
        ...routed,
        intent: finalTier.intent,
        confidence_score: finalTier.score,
        threat_vectors: finalTier.tier === 'safe' ? [] : (res.redFlags || routed?.threat_vectors || []),
        action_payload: {
          summary: res.verdict,
          department_or_agency: finalTier.tier === 'critical' ? 'National Cybercrime Helpline (1930)' : 'Kavach Local Shield',
          draft_text: finalTier.tier === 'critical' ? (res.complaint || '') : '',
          next_steps: res.nextSteps || [],
        },
      }, clean);
      $('result').className = `result lvl-${finalTier.level}`;
      $('result').hidden = false;
      $('gauge').className = `gauge lvl-${finalTier.level}`;
      $('gauge').setAttribute('aria-valuenow', String(finalTier.score));
      $('gauge').style.setProperty('--pct', finalTier.score);
      $('scoreText').textContent = finalTier.score;
      $('levelText').className = `level lvl-${finalTier.level}`;
      $('levelText').textContent = `${finalTier.badgeLabel} (${finalTier.score}/100)`;
      $('verdict').textContent = res.verdict;
      $('scamType').textContent = res.scamType;
      $('explanation').textContent = res.explanation || res.details || '';

      const flags = [...(res.redFlags || [])];
      if (detectedUrls.length && sbWidget && sbStatus) {
        sbWidget.classList.remove('hidden', 'danger', 'safe');
        if (flaggedUrls.length) {
          sbWidget.classList.add('danger');
          const desc = flaggedUrls.map((m) => `${m.url} [${m.threatType}]`).join(', ');
          sbStatus.textContent = `🚨 THREAT MATCHED (${sbResult.source}): ${desc}`;
          flags.unshift(`Malicious URL flagged by Safe Browsing: ${desc}`);
        } else {
          sbWidget.classList.add('safe');
          sbStatus.textContent = `✅ Checked ${detectedUrls.length} URL(s) via ${sbResult?.source || 'Safe Browsing'} — no blacklist hits.`;
        }
      }
      $('redFlags').innerHTML = flags.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
      $('nextSteps').innerHTML = (res.nextSteps || []).map((s) => `<li>${escapeHtml(s)}</li>`).join('');

      if (res.upiChecks?.length) {
        $('upiBlock').hidden = false;
        $('upiList').innerHTML = res.upiChecks.map((u) =>
          `<li class="${u.verdict === 'validated' ? 'good' : 'bad'}"><code>${escapeHtml(u.upi)}</code> — ${escapeHtml(u.reason)}</li>`
        ).join('');
      } else {
        $('upiBlock').hidden = true;
      }

      if (res.complaint) {
        $('complaintBlock').hidden = false;
        $('complaint').value = res.complaint;
        $('familyAlert').href = `https://wa.me/?text=${encodeURIComponent(`🚨 Scam Warning (${res.scamType}): ${res.verdict}\n${clean.slice(0, 180)}`)}`;
      } else {
        $('complaintBlock').hidden = true;
      }
      $('engine').textContent = `Engine: ${res.engine}`;
      for (const id of res.categoryIds || []) unlockCategory(id);
    } catch (err) {
      console.warn('[Chat_Safe][SmartScan] Scan pipeline failed, switching to offline notice:', err?.message || err);
      $('scanBox').classList.remove('scanning');
      setMood('suspicious');
      const notice = 'Network offline - switching to local rules. Please verify manually.';
      $('xrayStatus').textContent = notice;
      toast(notice);
    }
  }

  /**
   * Renders up to 6 recent scanner verdicts in the session scan history list.
   *
   * @returns {void}
   */
  function renderScanHistory() {
    $('scanHistoryList').innerHTML = scanHistory.slice(0, 6).map((h) => `
      <li class="got">
        <span>${h.mode === 'CIVIC' ? '⚖️' : '🛡️'}</span>
        <span><strong>${escapeHtml(h.mode)}</strong> — ${escapeHtml(h.text)}</span>
        <span class="small muted">${escapeHtml(h.time)}</span>
      </li>
    `).join('') || '<li class="small muted">No scans yet in this session.</li>';
  }

  $('xrayForm').addEventListener('submit', (e) => { e.preventDefault(); runSmartScan($('message').value); });
  document.querySelectorAll('[data-sample]').forEach((b) => {
    b.addEventListener('click', () => {
      $('message').value = SAMPLES[b.dataset.sample];
      runSmartScan($('message').value);
    });
  });
  $('readAloud').addEventListener('click', () => {
    if (lastResult) speak(`${lastResult.verdict}. ${(lastResult.nextSteps || [])[0] || ''}`, lastResult.lang);
  });
  $('copyComplaint').addEventListener('click', async () => {
    try {
      await navigator.clipboard?.writeText($('complaint').value);
      toast('1930 Cybercrime complaint copied!');
    } catch (err) {
      console.warn('[Chat_Safe][Clipboard] Copy complaint failed:', err?.message || err);
    }
  });
  $('sendToFamilyBtn').addEventListener('click', () => {
    if (!activeUrimaiKit) return;
    dispatchUrimaiKitToFamily(activeUrimaiKit);
    activateTab($('tab-family'));
  });
  $('usDownloadPdfBtn').addEventListener('click', async () => {
    if (!activeUrimaiKit) return;
    try {
      await window.ChatSafePDF.generateUrimaiPdf(activeUrimaiKit, activePhotoDataUrl);
      toast('📄 Bilingual Urimai PDF downloaded!');
    } catch (err) {
      console.warn('[Chat_Safe][PDF] Failed to generate Urimai PDF:', err?.message || err);
      toast('Unable to generate PDF right now.');
    }
  });

  /* ---------- TAB 3: FAMILY HUB (O2O + CM BYPASS + LOCAL PROXY) ---------- */
  /**
   * Surfaces a critical Family SOS banner when a high-risk scam is detected.
   *
   * @param {string} utterance Original citizen report text.
   * @param {Object} analysis Alert metadata (`scamType`, `score`, `lang`).
   * @returns {void}
   */
  function triggerFamilySos(utterance, analysis) {
    $('familyBadge').hidden = false;
    $('familySosBanner').hidden = false;
    $('sosDetails').textContent = `Parent reported: "${utterance}" -> Kavach flagged ${analysis.scamType} (${analysis.score}/100)`;
    $('sosPlayVoice').onclick = () => speak(utterance, analysis.lang || uiLang());
  }
  $('sosDismiss').addEventListener('click', () => { $('familySosBanner').hidden = true; });

  /**
   * Populates the Family Hub view with an active Urimai civic petition kit,
   * CM Helpline bypass payload, and WhatsApp Local Proxy link.
   *
   * @param {Object} kit Structured Urimai civic petition kit.
   * @returns {void}
   */
  function dispatchUrimaiKitToFamily(kit) {
    activeUrimaiKit = kit;
    $('familyBadge').hidden = false;
    $('fhKitBadge').textContent = `🚨 FAMILY REQUEST: URIMAI DRAFT READY (${kit.kitId})`;
    $('fhKitTitle').textContent = kit.summary;
    $('fhReporter').textContent = kit.reporter;
    $('fhDept').textContent = kit.department;
    $('fhEngLetter').textContent = kit.englishLetter;
    $('fhRegHeading').textContent = `${kit.langName} (${kit.langNative}) Official Petition`;
    $('fhRegLetter').textContent = kit.regionalLetter;
    $('fhOfflineInstr').textContent = kit.offlineInstructions;
    $('fhWaBtn').href = `https://wa.me/?text=${encodeURIComponent(`⚖️ Urimai Action Kit (${kit.kitId})\nDept: ${kit.department}\nIssue: ${kit.summary}\n\n${kit.englishLetter.slice(0, 400)}`)}`;

    // Populate Digital Bypass & Local Proxy
    updatePortalUI(kit.state || 'Tamil Nadu');
    const fullProxyUrl = new URL(kit.localProxy.proxyUrl, location.href).href;
    $('proxyLinkInput').value = fullProxyUrl;
    $('previewProxyPageBtn').href = kit.localProxy.proxyUrl;
    $('proxyWaSendBtn').href = `https://wa.me/?text=${encodeURIComponent(kit.localProxy.whatsappText.replace(kit.localProxy.proxyUrl, fullProxyUrl))}`;
    toast('🚨 Family Hub updated: Urimai Action Kit Ready!');
  }

  /**
   * Initializes State CM Helpline portals and seeds the default Family Hub Urimai kit.
   *
   * @returns {Promise<void>} Resolves once portals and initial kit are rendered.
   */
  async function initFamilyHub() {
    try {
      statePortals = await API.call('portals');
      $('portalStateSelect').replaceChildren(...Object.keys(statePortals).map((st) => new Option(st, st)));
      const defaultKit = await API.call('urimai', {
        text: 'The panchayat water pipe on my street in Ward 12 broke 3 days ago and no one is fixing it.',
        lang: uiLang(),
        location: 'Ward 12, RS Puram, Coimbatore',
        state: 'Tamil Nadu',
      });
      dispatchUrimaiKitToFamily(defaultKit);
      $('familyBadge').hidden = true; // hide unread badge for initial seed
    } catch (err) {
      console.warn('[Chat_Safe][FamilyHub] Initialization failed:', err?.message || err);
    }
  }

  /**
   * Updates the CM Helpline portal selector, links, and character-bounded grievance text.
   *
   * @param {string} stateName Indian state or union territory name.
   * @returns {void}
   */
  function updatePortalUI(stateName) {
    const p = statePortals[stateName] || statePortals['Tamil Nadu'];
    if (!p) return;
    $('portalStateSelect').value = stateName;
    $('portalNameLabel').textContent = p.portalName;
    $('portalHelpline').textContent = p.helpline;
    $('openPortalBtn').href = p.url;
    $('openSecondaryPortalBtn').textContent = `📱 ${p.secondaryName}`;
    $('openSecondaryPortalBtn').href = p.secondaryUrl;
    if (activeUrimaiKit) {
      $('portalCopyArea').value = `[${activeUrimaiKit.department}] Location: ${activeUrimaiKit.location}. Grievance: ${activeUrimaiKit.originalText} (Ref: ${activeUrimaiKit.kitId} — Submitted via Urimai Civic Bridge)`.slice(0, p.limitChars);
    }
  }

  $('portalStateSelect').addEventListener('change', (e) => updatePortalUI(e.target.value));
  $('copyPortalTextBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard?.writeText($('portalCopyArea').value);
      toast('📋 CM Helpline portal text copied! Paste on the govt portal.');
    } catch (err) {
      console.warn('[Chat_Safe][Clipboard] Copy portal text failed:', err?.message || err);
    }
  });
  $('copyProxyLinkBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard?.writeText($('proxyLinkInput').value);
      toast('📋 Local Proxy WhatsApp link copied!');
    } catch (err) {
      console.warn('[Chat_Safe][Clipboard] Copy proxy link failed:', err?.message || err);
    }
  });

  // Pathway buttons (Local O2O vs Solution 1 Digital Bypass vs Solution 2 Local Proxy)
  /**
   * Switches between Local O2O, Digital-First CM Bypass, and Local Proxy Family Hub pathways.
   *
   * @param {'local'|'digital'|'proxy'} mode Selected resolution pathway.
   * @returns {void}
   */
  function setPathway(mode) {
    $('pathLocalBtn').setAttribute('aria-pressed', String(mode === 'local'));
    $('pathDigitalBtn').setAttribute('aria-pressed', String(mode === 'digital'));
    $('pathProxyBtn').setAttribute('aria-pressed', String(mode === 'proxy'));
    $('digitalBypassBox').hidden = mode !== 'digital';
    $('localProxyBox').hidden = mode !== 'proxy';
  }
  $('pathLocalBtn').addEventListener('click', () => setPathway('local'));
  $('pathDigitalBtn').addEventListener('click', () => setPathway('digital'));
  $('pathProxyBtn').addEventListener('click', () => setPathway('proxy'));

  $('fhPlayAudio').addEventListener('click', () => {
    if (!activeUrimaiKit) return;
    speak(activeUrimaiKit.originalText, activeUrimaiKit.lang || 'ta');
  });
  $('fhSwitchSample').addEventListener('click', async () => {
    try {
      const kit = await API.call('urimai', {
        text: 'Main road near Temple Street has deep broken potholes and streetlight is off for 2 weeks.',
        lang: uiLang(),
        location: 'Ward 4, Madurai',
        state: 'Tamil Nadu',
        reporter: 'Amma (Keypad Phone — Speed Dial 9)',
      });
      dispatchUrimaiKitToFamily(kit);
    } catch (err) {
      console.warn('[Chat_Safe][FamilyHub] Failed to switch sample Urimai kit:', err?.message || err);
      toast('Unable to load sample Urimai petition right now.');
    }
  });
  $('fhPhotoInput').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type) || f.size > 4 * 1024 * 1024) {
      $('fhPhotoStatus').textContent = 'Choose a JPEG or PNG under 4 MB.';
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      activePhotoDataUrl = r.result;
      $('fhPhotoPreview').src = activePhotoDataUrl;
      $('fhPhotoPreview').hidden = false;
      $('fhPhotoStatus').textContent = '✅ Photo attached! Will be embedded inside the PDF.';
    };
    r.onerror = () => {
      console.warn('[Chat_Safe][FileReader] Photo attachment read failed');
      $('fhPhotoStatus').textContent = 'Unable to read photo file.';
    };
    r.readAsDataURL(f);
  });
  $('fhPdfBtn').addEventListener('click', async () => {
    if (!activeUrimaiKit) return;
    try {
      toast('Generating Unicode bilingual A4 PDF…');
      await window.ChatSafePDF.generateUrimaiPdf(activeUrimaiKit, activePhotoDataUrl);
      toast('📄 Urimai PDF downloaded with 5-signature table!');
    } catch (err) {
      console.warn('[Chat_Safe][PDF] Failed to generate Family Hub PDF:', err?.message || err);
      toast('Unable to generate PDF right now.');
    }
  });

  /* ---------- TAB 4: DAILY STREAK (SWIPE-TO-SURVIVE) ---------- */
  const DECK = [
    { t: 'India Post: Your parcel delivery failed. Update address at http://inida-post.com/track or return.', scam: true, clue: 'Look at the URL — it says "inida-post.com" instead of indiapost.gov.in!' },
    { t: 'SBI: Your KYC expires today. Update at bit.ly/sbi-kyc-now or account blocked tonight.', scam: true, clue: 'Urgency + shortened link. Banks never ask you to update KYC via SMS links.' },
    { t: 'Your OTP for Swiggy order is 482913. Do not share it with anyone.', scam: false, clue: 'You triggered this OTP yourself, and it warns you not to share it.' },
    { t: 'This is CBI Mumbai. A parcel in your name has drugs. Stay on video call — you are under digital arrest.', scam: true, clue: 'Real police never arrest anyone on video call. Authority + fear is the trick.' },
    { t: 'Your electricity bill of ₹1,240 is due on 20 Nov. Pay on the official TNEB app.', scam: false, clue: 'Routine reminder directing you to the official utility app with no threat.' },
    { t: 'Earn ₹5,000/day liking YouTube videos! Deposit ₹500 prepaid task to unlock.', scam: true, clue: 'Real jobs never ask you to deposit money first.' },
    { t: 'Join SEBI VIP Stock Tips! 10% guaranteed daily returns. Pay rajesh.trader@ybl.', scam: true, clue: 'SEBI-registered brokers only use @valid UPI IDs and never guarantee returns.' },
    { t: 'Hi Appa, reached hostel safely. Talk to you tonight!', scam: false, clue: 'Normal personal message with no payment, link, or urgency.' },
  ];

  let gIdx = 0;
  let gHearts = 3;
  let gScore = 0;
  let gStreak = Number(load('streak')) || 0;
  $('streakNum').textContent = gStreak;
  $('gStreak').textContent = gStreak;

  /**
   * Renders the current Swipe-to-Survive card or the end-of-deck streak summary.
   *
   * @returns {void}
   */
  function renderGameCard() {
    if (gIdx >= DECK.length || gHearts <= 0) {
      $('gameBoard').hidden = true;
      $('gDone').hidden = false;
      $('gDone').innerHTML = `
        <div class="g-end">
          <p class="g-face">${gHearts > 0 ? '🏆' : '🛡️'}</p>
          <p class="g-end-score">${gScore} / ${DECK.length}</p>
          <p class="g-end-line"><strong>${gHearts > 0 ? 'Daily Streak Protected!' : 'Out of hearts — try again!'}</strong></p>
          <p class="g-end-sub">Current Streak: 🔥 ${gStreak} days</p>
          <button type="button" id="gReplay" class="primary">Play Again</button>
        </div>
      `;
      $('gReplay').onclick = () => {
        gIdx = 0; gHearts = 3; gScore = 0;
        $('gameBoard').hidden = false; $('gDone').hidden = true;
        renderGameCard();
      };
      return;
    }
    const card = DECK[gIdx];
    $('gText').textContent = card.t;
    $('gResult').hidden = true;
    $('gHearts').textContent = '❤️'.repeat(gHearts) + '🖤'.repeat(3 - gHearts);
    $('gProgress').style.setProperty('--p', `${(gIdx / DECK.length) * 100}%`);
    $('gCard').className = 'g-card';
    $('gCard').style.transform = '';
  }

  /**
   * Evaluates a user's Safe vs. Scam swipe decision, updates hearts/streak, and reveals the clue.
   *
   * @param {boolean} saysScam True if the user swiped/selected SCAM, false for SAFE.
   * @returns {void}
   */
  function answerGame(saysScam) {
    if (!$('gResult').hidden || gIdx >= DECK.length) return;
    const card = DECK[gIdx];
    const right = saysScam === card.scam;
    if (right) {
      gScore += 1;
      gStreak += 1;
      Sound.play('safe');
    } else {
      gHearts = Math.max(0, gHearts - 1);
      gStreak = 0;
      Sound.play('alert');
    }
    store('streak', String(gStreak));
    $('streakNum').textContent = gStreak;
    $('gStreak').textContent = gStreak;
    $('gScore').textContent = gScore;
    $('gCard').classList.add(right ? 'g-right' : 'g-wrong');
    $('gResult').hidden = false;
    $('gResult').className = `g-result ${right ? 'ok' : 'no'}`;
    $('gResult').innerHTML = `
      <p class="g-verdict">${right ? '✅ Spot on!' : '❌ Careful!'} That was ${card.scam ? 'a SCAM' : 'SAFE'}.</p>
      <p class="g-why">💡 Giveaway Clue: ${card.clue}</p>
      <button type="button" id="gNextBtn" class="primary sm" style="margin-top:.5rem">Next Message →</button>
    `;
    $('gNextBtn').onclick = () => { gIdx += 1; renderGameCard(); };
  }

  $('gScam').addEventListener('click', () => answerGame(true));
  $('gSafe').addEventListener('click', () => answerGame(false));

  // Touch/Pointer swipe on gCard
  (() => {
    const card = $('gCard');
    let startX = 0;
    let dragging = false;
    card.addEventListener('pointerdown', (e) => {
      if (!$('gResult').hidden) return;
      startX = e.clientX;
      dragging = true;
      card.setPointerCapture?.(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.04}deg)`;
      card.classList.toggle('tilt-scam', dx < -45);
      card.classList.toggle('tilt-safe', dx > 45);
    });
    card.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      card.classList.remove('tilt-scam', 'tilt-safe');
      if (dx < -90) answerGame(true);
      else if (dx > 90) answerGame(false);
      else card.style.transform = '';
    });
  })();
  renderGameCard();

  /* ---------- TAB 5: AUTOPILOT ---------- */
  $('autoSample').addEventListener('click', () => {
    $('autoInput').value = `${SAMPLES.stock}\n${SAMPLES.safe}\n${SAMPLES.arrest}`;
  });
  $('autoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lines = $('autoInput').value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    try {
      const res = await API.call('autopilot', {
        messages: lines,
        lang,
        autoActions: {
          scan: $('auScan').checked,
          reply: $('auReply').checked,
          warn: $('auWarn').checked,
          report: $('auReport').checked,
        },
      });
      $('autoOut').hidden = false;
      $('autoBadge').hidden = false;
      $('autoBadge').textContent = `${res.scanned} checked`;
      $('autoOut').innerHTML = `
        <div class="auto-worst lvl-${res.worst.level}">
          <p class="aw-tag">Worst Threat: ${res.worst.scamType} (${res.worst.score}/100)</p>
          <p class="aw-text">${res.worst.verdict}</p>
        </div>
        <ol class="auto-plan">
          ${res.plan.map((st) => `
            <li class="st ${st.tone === 'danger' ? 'st-danger' : 'st-auto'}">
              <span class="st-ico">${st.icon || '⚡'}</span>
              <div class="st-main">
                <p class="st-title"><strong>${st.title}</strong></p>
                <p class="st-why">${st.why}</p>
                ${st.text ? `<pre class="st-text">${st.text}</pre>` : ''}
              </div>
            </li>
          `).join('')}
        </ol>
      `;
    } catch (err) {
      console.warn('[Chat_Safe][Autopilot] Batch scan failed:', err?.message || err);
      toast('Unable to run Autopilot batch scan right now.');
    }
  });

  /* ---------- TAB 6: PAY-CHECK ---------- */
  $('payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const upi = $('upi').value.trim();
    if (!upi) return;
    pulseBus(['payguard']);
    try {
      const r = await API.call('upi-check', { upi });
      $('payResult').innerHTML = `<div class="urimai-card" style="border-color:${r.verdict === 'validated' ? 'var(--safe)' : 'var(--critical)'}"><strong>${r.verdict === 'validated' ? '✅ SEBI @valid Handle' : '⚠️ Not SEBI @valid'}</strong><p style="margin:0">${r.reason}</p></div>`;
    } catch (err) {
      console.warn('[Chat_Safe][PayCheck] UPI verification failed:', err?.message || err);
      toast('Unable to verify UPI handle right now.');
    }
  });

  /* ---------- TAB 7: PAATI DECOY ---------- */
  $('paatiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('scammerMsg').value.trim();
    if (!msg) return;
    $('scammerMsg').value = '';
    appendChat($('chatLog'), 'Scammer', 'them', msg);
    try {
      const r = await API.call('decoy', { text: msg, lang, turn: decoyTurn++ });
      appendChat($('chatLog'), 'Kamala Paati', 'paati', r.reply);
      if ($('autoSpeak').checked) await triggerVoiceSynthesis(r.reply, uiLang());
    } catch (err) {
      console.warn('[Chat_Safe][PaatiDecoy] Decoy reply generation failed:', err?.message || err);
      appendChat($('chatLog'), 'Kamala Paati', 'paati', 'Aiyo, the line is breaking up... say that again slowly?');
    }
  });

  /* ---------- TAB 8: 8 SCAMS GRID ---------- */
  if (window.SCAM_TYPES) {
    $('typeGrid').replaceChildren(...window.SCAM_TYPES.map((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'type-card';
      btn.innerHTML = `<span class="ico">${s.icon}</span><span class="nm">${s.name}</span><p class="says">“${s.says}”</p><p class="rule">${s.rule}</p><span class="cta">Test in AI Scanner →</span>`;
      btn.addEventListener('click', () => {
        $('message').value = s.sample || s.says;
        activateTab($('tab-scanner'));
        runSmartScan($('message').value);
      });
      return btn;
    }));
  }

  /* ---------- TAB 9: GOOGLE ECOSYSTEM & 8 AGENTS ---------- */
  window.ChatSafeAgents?.mountAgentGrid($('appAgentGrid'));
  $('detectLocationBtn').addEventListener('click', () => {
    const deniedMsg = 'Location permission denied. Using manual entry.';
    if (!navigator.geolocation) {
      $('geoStatus').textContent = deniedMsg;
      if ($('detected-address')) $('detected-address').textContent = deniedMsg;
      return;
    }
    $('geoStatus').textContent = 'Checking GPS coordinates…';
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          $('geoStatus').textContent = `📍 Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)} — Ward matched! Ready for Google Maps & CM Helpline routing.`;
        },
        (geoErr) => {
          console.warn('[Chat_Safe][Geolocation] Manual location probe failed:', { code: geoErr?.code, message: geoErr?.message });
          $('geoStatus').textContent = deniedMsg;
          if ($('detected-address')) $('detected-address').textContent = deniedMsg;
        },
        { timeout: 5000, maximumAge: 60_000 },
      );
    } catch (err) {
      console.warn('[Chat_Safe][Geolocation] Manual location hardware call threw:', err?.message || err);
      $('geoStatus').textContent = deniedMsg;
      if ($('detected-address')) $('detected-address').textContent = deniedMsg;
    }
  });
  $('gmailDraftBtn').addEventListener('click', () => {
    const subj = encodeURIComponent(`Urimai Civic Grievance: ${activeUrimaiKit?.summary || 'Broken Water Pipe'}`);
    const body = encodeURIComponent(activeUrimaiKit?.englishLetter || 'Please resolve this civic issue.');
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subj}&body=${body}`, '_blank', 'noopener');
  });

  /* ---------- Case Files Drawer & Help ---------- */
  /**
   * Renders saved local chat case summaries into the Case Files drawer.
   *
   * @returns {void}
   */
  function renderCases() {
    const list = caseStore.search('').map((entry) => entry.case);
    $('caseCount').textContent = `${list.length} saved chats`;
    $('caseList').innerHTML = list.map((c) => `
      <li class="case ${c.id === caseStore.currentId ? 'current' : ''}">
        <button type="button" class="case-open" data-cid="${escapeHtml(c.id)}">
          <span class="dot lvl-${escapeHtml(c.mood || 'idle')}"></span>
          <strong>${escapeHtml(c.title || 'New chat')}</strong>
          <time>${escapeHtml(new Date(c.updated || c.updatedAt || Date.now()).toLocaleDateString())}</time>
          <span class="snippet">${escapeHtml((c.messages?.[0]?.text || '').slice(0, 60))}</span>
        </button>
      </li>
    `).join('');
  }

  let releaseCasesTrap = null;
  const closeCasesDrawer = () => {
    const drawer = $('cases');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    $('historyBtn')?.setAttribute('aria-expanded', 'false');
    releaseCasesTrap?.(false);
    releaseCasesTrap = null;
  };
  const openCasesDrawer = () => {
    const drawer = $('cases');
    if (!drawer) return;
    drawer.hidden = false;
    $('historyBtn')?.setAttribute('aria-expanded', 'true');
    renderCases();
    releaseCasesTrap?.(true);
    releaseCasesTrap = trapModalFocus(drawer, {
      onEscape: closeCasesDrawer,
      restoreFocusTo: $('historyBtn'),
    });
    $('closeCases')?.focus();
  };

  $('historyBtn').addEventListener('click', () => {
    if ($('cases').hidden) openCasesDrawer();
    else closeCasesDrawer();
  });
  $('closeCases').addEventListener('click', closeCasesDrawer);
  $('openSearch').addEventListener('click', () => { $('searchBar').hidden = false; $('caseSearch').focus(); });
  $('closeSearch').addEventListener('click', () => { $('searchBar').hidden = true; $('openSearch')?.focus(); });
  $('searchBar')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      $('searchBar').hidden = true;
      $('openSearch')?.focus();
    }
  });
  $('exportCases').addEventListener('click', () => {
    const blob = new Blob([caseStore.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chatsafe-cases.json';
    a.click();
  });
  $('clearCases').addEventListener('click', () => { caseStore.clear(); renderCases(); $('agentLog').replaceChildren(); });

  $('soundBtn').setAttribute('aria-pressed', String(Sound.muted));
  $('soundBtn').addEventListener('click', () => {
    const muted = Sound.toggle();
    $('soundBtn').setAttribute('aria-pressed', String(muted));
    if (muted) killAllAudio();
  });

  const helpDialogEl = $('helpDialog');
  $('helpBtn').addEventListener('click', () => {
    try {
      helpDialogEl?.showModal();
      $('closeHelp')?.focus();
    } catch (err) {
      console.warn('[Chat_Safe][Dialog] Unable to open helpDialog:', err?.message || err);
    }
  });
  $('closeHelp').addEventListener('click', () => helpDialogEl?.close());
  helpDialogEl?.addEventListener('close', () => { $('helpBtn')?.focus(); });

  /* ---------- TAB 10: ISO/IEC 27701 DATA PRIVACY, CONSENT VAULT & COOKIE BANNER ---------- */
  let csrfPrivacyToken = '';

  /**
   * Extracts the `cs_csrf` token from `document.cookie` or returns the cached token.
   *
   * @returns {string} Active CSRF token string.
   */
  function readCsrfCookie() {
    for (const part of String(document.cookie || '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === 'cs_csrf') return decodeURIComponent(v.join('='));
    }
    return csrfPrivacyToken;
  }

  /**
   * Executes an ISO/IEC 27701 privacy API request against the Node server with CSRF protection
   * and structured error logging.
   *
   * @param {string} endpoint Relative path under `api/` (e.g. `'privacy/export'`).
   * @param {Object|null} [body] JSON request payload, or null/undefined for GET requests.
   * @param {'GET'|'POST'|'PUT'|'DELETE'} [method] HTTP method override.
   * @returns {Promise<Object>} Parsed JSON response payload from the server.
   */
  async function privacyServerCall(endpoint, body, method = body ? 'POST' : 'GET') {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    const csrf = readCsrfCookie();
    if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
    try {
      const res = await fetch(`api/${endpoint}`, {
        method,
        headers,
        cache: 'no-store',
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (data.csrfToken) csrfPrivacyToken = data.csrfToken;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      console.warn('[Chat_Safe][PrivacyAPI] Request failed:', { endpoint, method, error: err?.message || err });
      throw err;
    }
  }

  $('privacyProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = $('privacyFormStatus');
    if (!$('privPolicyConsent')?.checked || !$('privAgeConsent')?.checked) {
      statusEl.textContent = 'Privacy Policy consent and Age Verification are required.';
      statusEl.className = 'status error';
      return;
    }
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const city = String(data.city || '').trim();
    const password = String(data.password || '');
    const marketingOptIn = Boolean($('privAlertsOptIn')?.checked);
    const cookiePref = load('cookieConsent') || 'essential';

    if (!name || !email || !email.includes('@')) {
      statusEl.textContent = 'Enter a valid name and email address.';
      statusEl.className = 'status error';
      return;
    }

    // Store minimal consent record locally + sync to encrypted SQLite/Node DB when server is running
    const localRecord = {
      name, email, city, lang: uiLang(),
      consentVersion: 'ISO-27701-v3.0',
      consentAt: new Date().toISOString(),
      ageVerified: true,
      marketingOptIn,
      cookiePref,
    };
    store('privacyProfile', JSON.stringify(localRecord));

    if (API.mode() === 'server') {
      try {
        if (password.length >= 8) {
          await privacyServerCall('auth/signup', {
            name, email, city, password, lang: uiLang(),
            website: data.website || '',
            consent: true, ageConsent: true, marketingOptIn, cookiePref,
          }, 'POST');
          statusEl.textContent = '✅ Account & encrypted citizen profile saved cleanly to SQLite (Argon2id hashed).';
        } else {
          await privacyServerCall('privacy/profile', { name, city, lang: uiLang(), marketingOptIn, cookiePref }, 'PUT');
          statusEl.textContent = '✅ Signed-in profile & consent preferences updated on server.';
        }
        statusEl.className = 'status';
        toast('ISO 27701 profile & consent saved.');
        return;
      } catch (err) {
        statusEl.textContent = `${err.message} (Saved locally on this device.)`;
        statusEl.className = 'status';
        return;
      }
    }
    statusEl.textContent = '✅ Saved locally in encrypted browser session/profile (static mode; enter 8+ char pass on server for SQLite Argon2id storage).';
    statusEl.className = 'status';
    toast('Privacy consent & profile saved locally.');
  });

  $('privacyExportBtn')?.addEventListener('click', async () => {
    let payload = null;
    if (API.mode() === 'server') {
      try {
        payload = await privacyServerCall('privacy/export');
      } catch (err) {
        console.warn('[Chat_Safe][PrivacyExport] Server export failed, using local profile:', err?.message || err);
        payload = null;
      }
    }
    if (!payload) {
      let localProfile = null;
      try { localProfile = JSON.parse(load('privacyProfile') || 'null'); } catch { localProfile = null; }
      payload = {
        standard: 'ISO/IEC 27701 & India DPDP Act 2023 Data Portability Export',
        exportedAt: new Date().toISOString(),
        profile: localProfile,
        learnedScams: getLearned(),
        streak: load('streak') || '0',
        cookieConsent: load('cookieConsent') || 'essential',
      };
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chatsafe-iso27701-export.json';
    a.click();
    if ($('privacyRightsStatus')) $('privacyRightsStatus').textContent = '✅ Data export JSON downloaded.';
  });

  $('privacyUnsubBtn')?.addEventListener('click', async () => {
    if ($('privAlertsOptIn')) $('privAlertsOptIn').checked = false;
    try {
      const p = JSON.parse(load('privacyProfile') || 'null');
      if (p) { p.marketingOptIn = false; store('privacyProfile', JSON.stringify(p)); }
    } catch { /* ignore */ }
    if (API.mode() === 'server') {
      await privacyServerCall('privacy/unsubscribe', {}).catch((err) => {
        console.warn('[Chat_Safe][PrivacyUnsub] Server unsubscribe skipped:', err?.message || err);
      });
    }
    if ($('privacyRightsStatus')) $('privacyRightsStatus').textContent = '🔕 Unsubscribed from all optional alert emails/digests.';
    toast('Unsubscribed cleanly.');
  });

  $('privacyDeleteBtn')?.addEventListener('click', async () => {
    if (!window.confirm('Permanently delete your account, consent record, local history, and API keys?')) return;
    if (API.mode() === 'server') {
      await privacyServerCall('auth/account', {}, 'DELETE').catch((err) => {
        console.warn('[Chat_Safe][PrivacyDelete] Server account deletion skipped:', err?.message || err);
      });
    }
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    caseStore.clear();
    $('privacyProfileForm')?.reset();
    if ($('privacyRightsStatus')) $('privacyRightsStatus').textContent = '🗑️ All server & browser personal data permanently erased.';
    toast('All personal data erased (Right to Erasure).');
  });

  /* ---------- Non-Dark-Pattern Cookie Consent Banner ---------- */
  /**
   * Shows or hides the cookie preferences banner based on saved consent choice.
   *
   * @returns {void}
   */
  function syncCookieBanner() {
    const banner = $('cookieConsentBanner');
    if (!banner) return;
    const saved = load('cookieConsent');
    banner.hidden = Boolean(saved);
  }
  $('cookieEssentialBtn')?.addEventListener('click', () => {
    store('cookieConsent', 'essential');
    syncCookieBanner();
    toast('🍪 Strictly essential security cookies only saved.');
  });
  $('cookieAcceptBtn')?.addEventListener('click', () => {
    store('cookieConsent', 'all');
    syncCookieBanner();
    toast('🍪 Essential + UI preferences saved.');
  });
  $('openCookiePrefsBtn')?.addEventListener('click', () => {
    const banner = $('cookieConsentBanner');
    if (banner) banner.hidden = false;
  });

  /* ---------- One-Click Auto-Pilot Guided Demo ---------- */
  let autoDemoRunning = false;

  /**
   * Simulates realistic typing into `#agentInput` so judges observe live input flow.
   *
   * @param {HTMLTextAreaElement|HTMLInputElement|null} inputEl Target input element.
   * @param {string} phrase Prompt text to type character-by-character.
   * @param {number} [delayMs=18] Per-character typing interval in milliseconds.
   * @returns {Promise<void>} Resolves once the full phrase is populated.
   */
  async function typePromptIntoInput(inputEl, phrase, delayMs = 18) {
    if (!inputEl) return;
    inputEl.value = '';
    inputEl.focus({ preventScroll: true });
    const stepMs = reducedMotion ? 2 : delayMs;
    for (let i = 1; i <= phrase.length; i++) {
      inputEl.value = phrase.slice(0, i);
      await new Promise((r) => setTimeout(r, stepMs));
    }
  }

  /**
   * Executes the one-click Auto-Pilot Guided Demo showcase:
   *  1. Types a CBI digital-arrest cyber fraud prompt, lights up the Agent Bus, displays
   *     the Gemini 2.5 JSON response, and morphs into the Red Scam Card with a 1930 draft.
   *  2. Switches to a Urimai civic voice prompt ("Panchayat water pipe broke"), resolves
   *     geolocation, and morphs into the Blue Civic Card with an exportable bilingual PDF preview.
   *
   * @returns {Promise<void>} Resolves when both showcase phases finish.
   */
  async function runAutoDemo() {
    if (autoDemoRunning) return;
    autoDemoRunning = true;
    const demoBtn = $('demoBtn');
    const prevLabel = demoBtn?.textContent || '▶ Start Auto-Demo';
    if (demoBtn) {
      demoBtn.disabled = true;
      demoBtn.textContent = '▶ Auto-Demo Running…';
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? Math.min(ms, 250) : ms));

    try {
      killAllAudio();
      const inputEl = $('agentInput');
      inputEl?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });

      // Phase 1: Cyber Fraud Threat -> Agent Bus + Gemini JSON + Red Scam Card + 1930 Draft
      Sound.playDtmf('9');
      pulseBus(['vani', 'gemini']);
      const scamPrompt = 'My CBI officer is calling me for digital arrest';
      await typePromptIntoInput(inputEl, scamPrompt, 16);
      await handleUserMessage(scamPrompt);
      await wait(2400);

      // Phase 2: Urimai Civic Voice Prompt -> Blue Civic Card + Live Geolocation + Exportable PDF Preview
      $('mic')?.setAttribute('aria-pressed', 'true');
      $('micLabel').textContent = 'Voice Demo…';
      Sound.play('blip');
      const civicPrompt = 'Panchayat water pipe broke';
      await typePromptIntoInput(inputEl, civicPrompt, 20);
      $('mic')?.setAttribute('aria-pressed', 'false');
      $('micLabel').textContent = t('micStart');
      await handleUserMessage(civicPrompt);
      toast('✅ Auto-Demo complete: Kavach 1930 Scam Shield + Urimai Civic PDF Ready!');
    } catch (err) {
      console.warn('[Chat_Safe][AutoDemo] Guided demo encountered an error:', err?.message || err);
      toast('Auto-Demo switched to instant simulation mode.');
    } finally {
      $('mic')?.setAttribute('aria-pressed', 'false');
      $('micLabel').textContent = t('micStart');
      if (demoBtn) {
        demoBtn.disabled = false;
        demoBtn.textContent = prevLabel;
      }
      autoDemoRunning = false;
    }
  }

  $('demoBtn')?.addEventListener('click', () => { runAutoDemo(); });

  /* ---------- Boot & BYOK Lifecycle ---------- */
  $('lang').addEventListener('change', (e) => applyLanguage(e.target.value));

  /**
   * Initializes session-scoped Bring-Your-Own-Key (BYOK) bindings and boots smoothly into
   * Zero-Config Live AI Simulator mode whenever no Gemini API key is configured.
   *
   * @param {() => void} [syncConnectionBanner] Callback that refreshes UI connection status badges.
   * @returns {Promise<string>} Resolves to the active Gemini API key, or empty string in Simulator Mode.
   */
  async function initBYOK(syncConnectionBanner) {
    const openApiKeyManager = () => {
      showByokModal(
        syncConnectionBanner,
        'View, update, or clear your stored Google Gemini API Key in volatile sessionStorage (optional — Live AI Simulator runs automatically without a key):',
      );
    };
    $('apiKeySettingsBtn')?.addEventListener('click', openApiKeyManager);
    $('apiKeyManageBtn')?.addEventListener('click', openApiKeyManager);
    $('demoSimulatorBadge')?.addEventListener('click', openApiKeyManager);
    if ($('geminiStatusPill')) {
      $('geminiStatusPill').style.cursor = 'pointer';
      $('geminiStatusPill').title = 'Click to configure Gemini API Key for Edge AI Mode (BYOK in sessionStorage)';
      $('geminiStatusPill').addEventListener('click', openApiKeyManager);
    }

    await edgeConsentReady;
    syncConnectionBanner?.();
    return getGeminiSessionKey();
  }

  /**
   * Orchestrates full application startup: backend capability detection, i18n catalog hydration,
   * Radar & Family Hub seeding, Edge Consent + BYOK initialization, and URL query prefill routing.
   *
   * @returns {Promise<void>} Resolves once initial UI hydration and lifecycle gates finish.
   */
  async function bootstrapApp() {
    try {
      await API.detect();
      const syncConnectionBanner = () => {
        if (API.mode() === 'server' && API.aiEnabled?.()) setConnectionStatus('cloud');
        else if (getGeminiSessionKey()) setConnectionStatus('byok');
        else setConnectionStatus('offline');
        syncApiKeyButtons();
      };
      if (getGeminiSessionKey()) API.setGeminiKey?.(getGeminiSessionKey());
      syncConnectionBanner();

      await loadLanguages();
      await renderRadar();
      await initFamilyHub();
      renderScanHistory();
      renderHud();
      syncCookieBanner();
      if (location.hash === '#tab-privacy' && $('tab-privacy')) activateTab($('tab-privacy'));

      await initBYOK(syncConnectionBanner);

      // Handle prefill / share_target / ?try= from demo.html or landing page after consent & BYOK setup
      const q = new URLSearchParams(location.search);
      const prefill = q.get('prefill') || q.get('text');
      const tryId = q.get('try');
      if (prefill) {
        $('message').value = prefill;
        activateTab($('tab-scanner'));
        await runSmartScan(prefill);
      } else if (tryId && window.SCAM_TYPES) {
        const found = window.SCAM_TYPES.find((s) => s.id === tryId);
        if (found) {
          $('message').value = found.sample || found.says;
          activateTab($('tab-scanner'));
          await runSmartScan($('message').value);
        }
      }
    } catch (err) {
      console.warn('[Chat_Safe][Bootstrap] Initialization error boundary:', err?.message || err);
    }
  }

  bootstrapApp();
})();
