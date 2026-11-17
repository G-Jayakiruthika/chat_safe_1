'use strict';

(() => {
  const TYPES = [
    {
      kind: 'scam',
      n: 'Fake investment',
      d: 'Fraudsters promise 10x returns via "insider" crypto or stock groups, show fake profit dashboards, then block withdrawals.',
      msg: 'Join our VIP group: invest ₹10,000, get ₹1 lakh in 7 days. 100% guaranteed! Pay rajesh.trader@ybl',
      tip: 'Guaranteed returns do not exist. SEBI-registered brokers only use @valid UPI handles.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Digital arrest',
      d: 'Callers pose as CBI/police, claim you are linked to a crime, and keep you on video call demanding "bail" money.',
      msg: 'You are under DIGITAL ARREST. Do not disconnect this call. Transfer ₹2,00,000 to the RBI safe account.',
      tip: 'There is no such thing as digital arrest. Real police never arrest on video call. Hang up, call 1930.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'KYC / OTP',
      d: 'Fake bank messages push you to "update KYC" and then ask for the OTP that drains your account.',
      msg: 'Dear customer your KYC is pending. Click bit.ly/kyc-now and enter OTP.',
      tip: 'Never share an OTP — not even with the bank.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Courier parcel',
      d: 'A "courier" says your parcel has illegal items or needs a fee, then transfers you to fake officials.',
      msg: 'FedEx: Parcel held at customs with illegal items. Pay ₹3,450 clearance via UPI to release.',
      tip: 'Check tracking on the official courier app only.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Task job',
      d: 'Pay-per-like tasks pay tiny sums first, then require larger "deposits" to unlock bigger earnings.',
      msg: 'Earn ₹3,000/day. Like YouTube videos, then deposit ₹5,000 to unlock premium tasks.',
      tip: 'Real jobs never ask you to pay to work.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Lottery / bill',
      d: 'Fake prize winnings and urgent "electricity disconnection" notices create greed or fear.',
      msg: 'Your TNEB power will be cut tonight 9:30 PM. Call 98xxxxxx immediately to pay pending bill.',
      tip: 'Verify bills in your official utility app only.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Voice clone',
      d: 'AI clones a relative’s voice from social media clips and pleads for urgent money.',
      msg: '“Papa, I’ve had an accident. Please send ₹40,000 right now, don’t tell mom.”',
      tip: 'Agree on a family safe-word and call back on the saved number.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'scam',
      n: 'Loan / sextortion',
      d: 'Predatory loan apps steal contacts and harass; sextortion callers threaten to leak private videos.',
      msg: 'Pay back ₹28,000 now or we will send morphed photos to all your contacts.',
      tip: 'Do not pay. Screenshot, block, report on 1930.',
      footer: 'Report on 1930 · cybercrime.gov.in',
    },
    {
      kind: 'civic',
      n: 'Urimai: Broken Water Pipe (Speed-Dial 9)',
      d: 'Rural elder presses 9 on keypad phone and speaks in Tamil/Hindi. Gemini classifies it as a CIVIC issue and activates Urimai.',
      msg: '“The panchayat water pipe on my street broke 3 days ago and no one is fixing it.”',
      tip: 'Urimai drafts a bilingual English + Tamil petition to the Municipal Water Board and sends the Action Kit to the son’s phone.',
      footer: 'O2O PDF + 5-Signature Block · CM Helpline',
    },
    {
      kind: 'civic',
      n: 'Urimai: Remote Son Proxy & CM Bypass',
      d: 'If the son lives in another city, Urimai adapts: 1-click CM Helpline copy-paste OR Local Proxy WhatsApp link to a neighbor.',
      msg: '“Broken road near school bus stop in Ward 12. Are you in town? -> Ask Local Proxy.”',
      tip: 'Neighbor snaps 1 photo via WhatsApp link; Urimai embeds it in the PDF or formats it for Mudhalvarin Mugavari / CPGRAMS.',
      footer: 'Digital-First Bypass · Local Proxy Bridge',
    },
  ];

  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = window.createBackground?.($('bg'), { reducedMotion });

  const list = $('demoSteps');
  list.innerHTML = TYPES.map((s, i) => `
    <li class="demo-scroll-step ${i === 0 ? 'active' : ''}" data-idx="${i}">
      <span class="eyebrow">${String(i + 1).padStart(2, '0')} / ${String(TYPES.length).padStart(2, '0')} · ${s.kind === 'civic' ? 'URIMAI CIVIC' : 'KAVACH SCAM'}</span>
      <h2 style="margin:0;font-size:clamp(1.6rem,3.5vw,2.5rem)">${s.n}</h2>
      <p class="muted" style="font-size:1.1rem;max-width:44ch">${s.d}</p>
      <p style="font-weight:700">💡 ${s.tip}</p>
    </li>
  `).join('');

  let current = -1;
  function show(i) {
    if (i === current || !TYPES[i]) return;
    current = i;
    const t = TYPES[i];
    document.querySelectorAll('.demo-scroll-step').forEach((el, k) => el.classList.toggle('active', k === i));
    $('dpSender').textContent = t.kind === 'civic' ? 'Speed-Dial 9 · Keypad Voice' : 'Unknown sender · now';
    $('dpMsg').textContent = t.msg;
    $('dpEngine').textContent = t.kind === 'civic' ? 'URIMAI CIVIC ENGINE' : 'KAVACH VERDICT';
    $('dpTitle').textContent = t.kind === 'civic' ? `⚖️ CIVIC · ${t.n}` : `⚠ SCAM · ${t.n}`;
    $('dpTip').textContent = t.tip;
    $('dpFooter').textContent = t.footer;
    const box = $('dpVerdictBox');
    box.className = `demo-verdict-box ${t.kind}`;
    $('dpTryLink').href = `app.html?prefill=${encodeURIComponent(t.msg)}`;
    bg?.setColor(t.kind === 'civic' ? [59, 130, 246] : [248, 113, 113], 0.45);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) show(Number(e.target.dataset.idx));
    }
  }, { threshold: 0.55 });

  document.querySelectorAll('.demo-scroll-step').forEach((el) => io.observe(el));
  show(0);

  $('themeToggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    window.ChatSafeTheme?.set('mode', next);
  });
})();
