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
  const t = (key, vars = {}) => {
    const s = (I18N[uiLang()] && I18N[uiLang()][key]) || I18N.en[key] || key;
    return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  };
  const langInfo = (code) => languages.find((l) => l.code === code) || languages[0];
  const store = (k, v) => { try { localStorage.setItem(`chatsafe.${k}`, v); } catch { /* ignore */ } };
  const load = (k) => { try { return localStorage.getItem(`chatsafe.${k}`); } catch { return null; } };

  const kavach = window.createKavach($('kavach'), {
    reducedMotion,
    onPoke: () => { Sound.play('blip'); speak("I am Kavach and Urimai — ready to stop scams and draft civic petitions!", 'en'); },
  });
  const bg = window.createBackground($('bg'), { reducedMotion });
  const caseStore = window.createHistory();
  const isDark = () => document.documentElement.dataset.theme !== 'light';

  function setMood(mood) {
    kavach.setMood(mood);
    bg.setColor(MOOD_RGB[mood] || MOOD_RGB.idle, isDark() ? 0.6 : 0.35);
  }
  function switchIntentPalette(intent, score = 0) {
    const targetPalette = intent === 'CIVIC'
      ? 'bluedragon'
      : (intent === 'SCAM' || score >= 50)
        ? 'lionfish'
        : null;
    if (!targetPalette) return;
    if (window.ChatSafeTheme?.set) window.ChatSafeTheme.set('palette', targetPalette);
    else document.documentElement.dataset.palette = targetPalette;
    kavach.setDark(isDark());
  }
  function enrichCivicLocation(kit) {
    if (!kit || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const geo = await API.call('reverse-geocode', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          if (!geo?.address) return;
          kit.location = geo.address;
          if ($('geoStatus')) $('geoStatus').textContent = `📍 GPS Street Match: ${geo.address}`;
          if (activeUrimaiKit === kit) {
            $('usSummary').textContent = `${kit.summary} (${geo.address})`;
            $('fhKitTitle').textContent = `${kit.summary} — ${geo.address}`;
          }
        } catch {
          /* non-fatal fallback: keep Ward default */
        }
      },
      () => { /* permission declined or unavailable; keep default location */ },
      { timeout: 3500, maximumAge: 60_000 },
    );
  }
  function setAgentState(state) {
    kavach.setState(state);
    $('agentState').textContent = t(`state_${state}`);
  }
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 3400);
  }
  function pulseBus(activeIds) {
    document.querySelectorAll('#agentBus .bus-node').forEach((n) => {
      n.classList.toggle('active', activeIds.includes(n.dataset.bus));
    });
  }

  /* ---------- Languages (All 23 Indian languages) ---------- */
  function applyLanguage(code) {
    lang = code === 'auto' || languages.some((l) => l.code === code) ? code : 'en';
    const info = langInfo(uiLang());
    document.documentElement.lang = uiLang();
    document.documentElement.dir = info.rtl ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (el.id === 'tab-family') return; // preserve badge child
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    const notes = [];
    if (lang !== 'auto') notes.push(t('uiNote', { lang: `${info.native} (${info.name})` }));
    if (API.mode() === 'local') notes.push(t('offlineMode'));
    $('uiNote').hidden = notes.length === 0;
    $('uiNote').textContent = notes.join(' · ');
    $('micLabel').textContent = t(recognizer ? 'micStop' : 'micStart');
    renderHud();
    store('lang', lang);
  }

  async function loadLanguages() {
    try {
      languages = (await API.call('languages')).languages;
    } catch { /* fallback */ }
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
  const refreshVoices = () => { voices = 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []; };
  if ('speechSynthesis' in window) {
    refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  }
  const voiceFor = (code) => {
    const tag = langInfo(code).speech.toLowerCase();
    return voices.find((v) => v.lang.toLowerCase() === tag) || voices.find((v) => v.lang.toLowerCase().startsWith(`${code}-`));
  };

  function speak(text, code = replyLang) {
    return new Promise((resolve) => {
      if (!text || !('speechSynthesis' in window)) { resolve(false); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langInfo(code).speech;
      const v = voiceFor(code);
      if (v) u.voice = v;
      u.rate = 0.96;
      u.onstart = () => setAgentState('speaking');
      u.onboundary = () => kavach.pulse();
      u.onend = u.onerror = () => { setAgentState('idle'); resolve(true); };
      window.speechSynthesis.speak(u);
    });
  }

  /* ---------- Voice In ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;

  function startMic(onText) {
    if (!SR) { toast(t('noMic')); return; }
    if (recognizer) { recognizer.stop(); return; }
    window.speechSynthesis?.cancel();
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
    rec.onerror = () => toast('Could not hear clearly — try typing or speaking again.');
    rec.onend = () => {
      recognizer = null;
      $('mic').setAttribute('aria-pressed', 'false');
      $('micLabel').textContent = t('micStart');
      if ($('agentState').textContent === t('state_listening')) setAgentState('idle');
    };
    rec.start();
  }
  $('mic').addEventListener('click', () => startMic((said) => askAgent(said)));
  $('scannerMicBtn').addEventListener('click', () => startMic((said) => {
    $('message').value = said;
    runSmartScan(said);
  }));

  /* ---------- Chat & Speed-Dial '9' Voice IVR ---------- */
  function appendChat(logEl, who, cls, text) {
    const li = document.createElement('li');
    li.className = cls;
    const tag = document.createElement('span');
    tag.className = 'who';
    tag.textContent = who;
    const body = document.createElement('span');
    body.dir = 'auto';
    body.textContent = text;
    li.append(tag, body);
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function addAgentMessage(who, cls, text) {
    appendChat($('agentLog'), who, cls, text);
    caseStore.addMessage({ who, cls, text });
    renderCases();
  }

  async function askAgent(text) {
    const clean = text.trim();
    if (!clean) return;
    $('agentInput').value = '';
    addAgentMessage('You', 'you', clean);
    setAgentState('thinking');
    pulseBus(['vani', 'gemini']);

    try {
      const res = await API.call('agent', { text: clean, lang, turn: agentTurn++, location: 'Ward 12, Coimbatore' });
      replyLang = res.lang || uiLang();
      if (res._fallbackReason) {
        setMood('suspicious');
        toast(res._fallbackReason);
      } else {
        setMood(res.mood || 'safe');
      }

      if (res.mode === 'urimai' && res.urimaiKit) {
        pulseBus(['vani', 'gemini', 'urimai', 'setu']);
        switchIntentPalette('CIVIC', 0);
        Sound.play('civic');
        addAgentMessage('Kavach × Urimai', 'kavach', `${res.reply}\n\n⚖️ Action Kit ${res.urimaiKit.kitId} dispatched to Family Hub!`);
        dispatchUrimaiKitToFamily(res.urimaiKit);
        enrichCivicLocation(res.urimaiKit);
      } else if (res.mode === 'scan' && res.analysis) {
        pulseBus(['vani', 'gemini', 'kavach', 'netra']);
        switchIntentPalette(res.analysis.intent, res.analysis.score);
        Sound.play(res.analysis.score >= 50 ? 'alert' : 'scan');
        addAgentMessage('Kavach', `kavach lvl-${res.mood}`, res.reply);
        if (res.analysis.score >= 50) triggerFamilySos(clean, res.analysis);
        for (const id of res.analysis.categoryIds || []) unlockCategory(id);
      } else {
        pulseBus(['vani', 'gemini', 'kavach']);
        Sound.play('safe');
        addAgentMessage('Kavach', 'kavach', res.reply);
      }
      if ($('autoSpeak').checked) await speak(res.reply, replyLang);
      else setAgentState('idle');
    } catch {
      setAgentState('idle');
      setMood('suspicious');
      const notice = API.OFFLINE_NOTICE || 'Network unstable. Reverting to Offline Rule Engine. Please verify manually.';
      addAgentMessage('Kavach (Offline)', 'kavach', notice);
      toast(notice);
    }
  }

  // Keypad Phone Speed-Dial '9'
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
  function getLearned() {
    try { return (localStorage.getItem('chatsafe.learned') || '').split(',').filter(Boolean); } catch { return []; }
  }
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
  function activateTab(tab) {
    tabs.forEach((btn) => {
      const on = btn === tab;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      $(btn.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((btn) => btn.addEventListener('click', () => activateTab(btn)));

  /* ---------- TAB 1: RADAR & DAILY VIDEO REELS ---------- */
  function highlightRedacted(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\[[A-Z_]+_REDACTED\]/g, (tag) => `<span class="redacted-tag">${tag}</span>`);
  }

  let radarCity = 'All';
  let radarFeedMode = 'all'; // 'all' | 'scams' | 'civic' | 'video'

  function applyRadarFeedVisibility() {
    $('radarVideoSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'video');
    $('radarScamSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'scams');
    $('radarCivicSection').hidden = !(radarFeedMode === 'all' || radarFeedMode === 'civic');
  }

  async function renderRadar() {
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
    const r = await API.call('redact', { text: val });
    $('redactOut').innerHTML = `Result (${r.count} masked): ${highlightRedacted(r.redacted)}`;
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

  /* ---------- TAB 2: UNIFIED AI SCANNER (KAVACH RED VS URIMAI BLUE) ---------- */
  async function runSmartScan(text) {
    const clean = text.trim();
    if (!clean) return;
    $('scanBox').classList.add('scanning');
    $('xrayStatus').textContent = 'Analyzing with Gemini Intent Router…';
    $('result').hidden = true;
    $('urimaiScanResult').hidden = true;
    pulseBus(['gemini', 'kavach', 'urimai']);
    Sound.play('scan');

    try {
      const res = await API.call('analyze', { text: clean, lang, location: 'Ward 12, Coimbatore' });
      lastResult = res;
      $('scanBox').classList.remove('scanning');

      // Record scan history
      scanHistory.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: res.intent === 'CIVIC' ? 'CIVIC' : res.level.toUpperCase(),
        text: clean.slice(0, 80),
      });
      renderScanHistory();

      const offlineFallbackMsg = API.OFFLINE_NOTICE || 'Network unstable. Reverting to Offline Rule Engine. Please verify manually.';
      const degraded = Boolean(res._fallbackReason || res.aiError);

      if (res.intent === 'CIVIC' && res.urimaiKit) {
        pulseBus(['gemini', 'urimai', 'setu']);
        switchIntentPalette('CIVIC', 0);
        setMood(degraded ? 'suspicious' : 'civic');
        Sound.play('civic');
        $('xrayStatus').textContent = degraded
          ? offlineFallbackMsg
          : `Civic Grievance routed to Urimai Engine (${res.engine})`;
        $('usDept').textContent = res.urimaiKit.department;
        $('usSummary').textContent = res.urimaiKit.summary;
        $('usEngLetter').textContent = res.urimaiKit.englishLetter;
        $('usRegTitle').textContent = `${res.urimaiKit.langName} (${res.urimaiKit.langNative}) Draft`;
        $('usRegLetter').textContent = res.urimaiKit.regionalLetter;
        $('urimaiScanResult').hidden = false;
        activeUrimaiKit = res.urimaiKit;
        enrichCivicLocation(res.urimaiKit);
        return;
      }

      // Scam / Safe Result
      pulseBus(['gemini', 'kavach', 'netra', 'payguard']);
      switchIntentPalette(res.intent, res.score);
      setMood(degraded ? 'suspicious' : res.level);
      Sound.play(res.score >= 50 ? 'alert' : 'safe');
      $('xrayStatus').textContent = degraded ? offlineFallbackMsg : '';
      $('result').className = `result lvl-${res.level}`;
      $('result').hidden = false;
      $('gauge').className = `gauge lvl-${res.level}`;
      $('gauge').style.setProperty('--pct', res.score);
      $('scoreText').textContent = res.score;
      $('levelText').className = `level lvl-${res.level}`;
      $('levelText').textContent = `${res.level.toUpperCase()} (${res.score}/100)`;
      $('verdict').textContent = res.verdict;
      $('scamType').textContent = res.scamType;
      $('explanation').textContent = res.explanation || res.details || '';
      const flags = [...(res.redFlags || [])];
      if (res.indicators?.urls?.length) {
        const sb = await API.call('safebrowsing', { urls: res.indicators.urls }).catch(() => null);
        if (sb && !sb.safe && sb.matches?.length) {
          flags.unshift(`Safe Browsing Alert (${sb.source}): ${sb.matches.map((m) => `${m.url} [${m.threatType}]`).join(', ')}`);
        }
      }
      $('redFlags').innerHTML = flags.map((f) => `<li>${f}</li>`).join('');
      $('nextSteps').innerHTML = (res.nextSteps || []).map((s) => `<li>${s}</li>`).join('');

      if (res.upiChecks?.length) {
        $('upiBlock').hidden = false;
        $('upiList').innerHTML = res.upiChecks.map((u) =>
          `<li class="${u.verdict === 'validated' ? 'good' : 'bad'}"><code>${u.upi}</code> — ${u.reason}</li>`
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
    } catch {
      $('scanBox').classList.remove('scanning');
      setMood('suspicious');
      const notice = API.OFFLINE_NOTICE || 'Network unstable. Reverting to Offline Rule Engine. Please verify manually.';
      $('xrayStatus').textContent = notice;
      toast(notice);
    }
  }

  function renderScanHistory() {
    $('scanHistoryList').innerHTML = scanHistory.slice(0, 6).map((h) => `
      <li class="got">
        <span>${h.mode === 'CIVIC' ? '⚖️' : '🛡️'}</span>
        <span><strong>${h.mode}</strong> — ${h.text}</span>
        <span class="small muted">${h.time}</span>
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
    await navigator.clipboard?.writeText($('complaint').value).catch(() => {});
    toast('1930 Cybercrime complaint copied!');
  });
  $('sendToFamilyBtn').addEventListener('click', () => {
    if (!activeUrimaiKit) return;
    dispatchUrimaiKitToFamily(activeUrimaiKit);
    activateTab($('tab-family'));
  });
  $('usDownloadPdfBtn').addEventListener('click', async () => {
    if (!activeUrimaiKit) return;
    await window.ChatSafePDF.generateUrimaiPdf(activeUrimaiKit, activePhotoDataUrl);
    toast('📄 Bilingual Urimai PDF downloaded!');
  });

  /* ---------- TAB 3: FAMILY HUB (O2O + CM BYPASS + LOCAL PROXY) ---------- */
  function triggerFamilySos(utterance, analysis) {
    $('familyBadge').hidden = false;
    $('familySosBanner').hidden = false;
    $('sosDetails').textContent = `Parent reported: "${utterance}" -> Kavach flagged ${analysis.scamType} (${analysis.score}/100)`;
    $('sosPlayVoice').onclick = () => speak(utterance, analysis.lang || uiLang());
  }
  $('sosDismiss').addEventListener('click', () => { $('familySosBanner').hidden = true; });

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

  async function initFamilyHub() {
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
  }

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
    await navigator.clipboard?.writeText($('portalCopyArea').value).catch(() => {});
    toast('📋 CM Helpline portal text copied! Paste on the govt portal.');
  });
  $('copyProxyLinkBtn').addEventListener('click', async () => {
    await navigator.clipboard?.writeText($('proxyLinkInput').value).catch(() => {});
    toast('📋 Local Proxy WhatsApp link copied!');
  });

  // Pathway buttons (Local O2O vs Solution 1 Digital Bypass vs Solution 2 Local Proxy)
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
    const kit = await API.call('urimai', {
      text: 'Main road near Temple Street has deep broken potholes and streetlight is off for 2 weeks.',
      lang: uiLang(),
      location: 'Ward 4, Madurai',
      state: 'Tamil Nadu',
      reporter: 'Amma (Keypad Phone — Speed Dial 9)',
    });
    dispatchUrimaiKitToFamily(kit);
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
    r.readAsDataURL(f);
  });
  $('fhPdfBtn').addEventListener('click', async () => {
    if (!activeUrimaiKit) return;
    toast('Generating Unicode bilingual A4 PDF…');
    await window.ChatSafePDF.generateUrimaiPdf(activeUrimaiKit, activePhotoDataUrl);
    toast('📄 Urimai PDF downloaded with 5-signature table!');
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
  });

  /* ---------- TAB 6: PAY-CHECK ---------- */
  $('payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const upi = $('upi').value.trim();
    if (!upi) return;
    pulseBus(['payguard']);
    const r = await API.call('upi-check', { upi });
    $('payResult').innerHTML = `<div class="urimai-card" style="border-color:${r.verdict === 'validated' ? 'var(--safe)' : 'var(--critical)'}"><strong>${r.verdict === 'validated' ? '✅ SEBI @valid Handle' : '⚠️ Not SEBI @valid'}</strong><p style="margin:0">${r.reason}</p></div>`;
  });

  /* ---------- TAB 7: PAATI DECOY ---------- */
  $('paatiForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('scammerMsg').value.trim();
    if (!msg) return;
    $('scammerMsg').value = '';
    appendChat($('chatLog'), 'Scammer', 'them', msg);
    const r = await API.call('decoy', { text: msg, lang, turn: decoyTurn++ });
    appendChat($('chatLog'), 'Kamala Paati', 'paati', r.reply);
    if ($('autoSpeak').checked) speak(r.reply, uiLang());
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
    if (!navigator.geolocation) {
      $('geoStatus').textContent = 'Geolocation unavailable — defaulting to Ward 12, Coimbatore.';
      return;
    }
    $('geoStatus').textContent = 'Checking GPS coordinates…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $('geoStatus').textContent = `📍 Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)} — Ward matched! Ready for Google Maps & CM Helpline routing.`;
      },
      () => {
        $('geoStatus').textContent = 'Permission declined — using Ward 12, Coimbatore (Remote Hostel Mode available in Family Hub).';
      },
    );
  });
  $('gmailDraftBtn').addEventListener('click', () => {
    const subj = encodeURIComponent(`Urimai Civic Grievance: ${activeUrimaiKit?.summary || 'Broken Water Pipe'}`);
    const body = encodeURIComponent(activeUrimaiKit?.englishLetter || 'Please resolve this civic issue.');
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subj}&body=${body}`, '_blank', 'noopener');
  });

  /* ---------- Case Files Drawer & Help ---------- */
  function renderCases() {
    const list = caseStore.list();
    $('caseCount').textContent = `${list.length} saved chats`;
    $('caseList').innerHTML = list.map((c) => `
      <li class="case ${c.id === caseStore.currentId ? 'current' : ''}">
        <button type="button" class="case-open" data-cid="${c.id}">
          <span class="dot"></span>
          <strong>${c.title || 'New chat'}</strong>
          <time>${new Date(c.updatedAt || Date.now()).toLocaleDateString()}</time>
          <span class="snippet">${(c.messages?.[0]?.text || '').slice(0, 60)}</span>
        </button>
      </li>
    `).join('');
  }
  $('historyBtn').addEventListener('click', () => { $('cases').hidden = !$('cases').hidden; renderCases(); });
  $('closeCases').addEventListener('click', () => { $('cases').hidden = true; });
  $('openSearch').addEventListener('click', () => { $('searchBar').hidden = false; $('caseSearch').focus(); });
  $('closeSearch').addEventListener('click', () => { $('searchBar').hidden = true; });
  $('exportCases').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(caseStore.list(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chatsafe-cases.json';
    a.click();
  });
  $('clearCases').addEventListener('click', () => { caseStore.clear(); renderCases(); $('agentLog').replaceChildren(); });

  $('soundBtn').addEventListener('click', () => {
    const muted = Sound.toggle();
    $('soundBtn').textContent = muted ? '🔇' : '🔊';
  });
  $('helpBtn').addEventListener('click', () => $('helpDialog').showModal());
  $('closeHelp').addEventListener('click', () => $('helpDialog').close());

  /* ---------- Guided Demo Tour ---------- */
  $('demoBtn').addEventListener('click', () => {
    activateTab($('tab-family'));
    triggerSpeedDial9();
    setTimeout(() => askAgent('The panchayat water pipe on my street broke 3 days ago and no one is fixing it.'), 600);
  });

  /* ---------- Boot ---------- */
  $('lang').addEventListener('change', (e) => applyLanguage(e.target.value));
  (async () => {
    await API.detect();
    const refreshGeminiBadge = () => {
      $('geminiStatusPill').textContent = API.aiEnabled()
        ? 'Gemini 2.5 Flash Live (BYOK) ✓'
        : 'Offline Hybrid Engine (Click to Add BYOK Key)';
    };
    refreshGeminiBadge();
    $('geminiStatusPill').style.cursor = 'pointer';
    $('geminiStatusPill').title = 'Click to configure your own Gemini API key (BYOK, stored locally only)';
    $('geminiStatusPill').addEventListener('click', () => {
      const current = API.getGeminiKey ? API.getGeminiKey() : '';
      const entered = window.prompt('Enter your Gemini API Key for BYOK Live Mode (leave blank to clear & use Offline Rule Engine):', current);
      if (entered === null) return;
      API.setGeminiKey?.(entered);
      refreshGeminiBadge();
      toast(entered.trim() ? 'BYOK Gemini API key saved locally in browser.' : 'Switched to Offline Rule Engine.');
    });
    await loadLanguages();
    await renderRadar();
    await initFamilyHub();
    renderScanHistory();
    renderHud();

    // Handle prefill / share_target / ?try= from demo.html or landing page
    const q = new URLSearchParams(location.search);
    const prefill = q.get('prefill') || q.get('text');
    const tryId = q.get('try');
    if (prefill) {
      $('message').value = prefill;
      activateTab($('tab-scanner'));
      runSmartScan(prefill);
    } else if (tryId && window.SCAM_TYPES) {
      const found = window.SCAM_TYPES.find((s) => s.id === tryId);
      if (found) {
        $('message').value = found.sample || found.says;
        activateTab($('tab-scanner'));
        runSmartScan($('message').value);
      }
    }
  })();
})();
