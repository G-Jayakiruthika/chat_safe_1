'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = window.createBackground($('bg'), { reducedMotion });
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const paint = () => bg.setColor([167, 139, 250], isDark() ? 0.55 : 0.3);
  paint();

  $('themeToggle').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('chatsafe.theme', next); } catch { /* ignore */ }
    paint();
  });

  /** Accounts only exist on the server build; api.js knows which mode we are in. */
  async function call(path, body) {
    const res = await fetch(`api/${path}`, body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function show(which) {
    for (const id of ['authCard', 'profileCard', 'noAccounts']) $(id).hidden = id !== which;
  }

  function renderProfile(user) {
    $('profName').textContent = user.name;
    $('statStreak').textContent = String(user.streak);
    $('statBest').textContent = String(user.best);
    $('statScans').textContent = String(user.scans);
    const types = window.SCAM_TYPES || [];
    $('statLearned').textContent = `${user.learned.length}/${types.length || 8}`;
    $('profLearned').replaceChildren(...types.map((t) => {
      const li = document.createElement('li');
      const got = user.learned.includes(t.id);
      li.className = got ? 'got' : '';
      const ico = document.createElement('span');
      ico.className = 'ico-sm';
      ico.append(window.scamIcon ? window.scamIcon(t.id, 22) : document.createTextNode(t.icon));
      const nm = document.createElement('span');
      nm.textContent = t.name;
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = got ? '✅' : '⬜';
      li.append(ico, nm, mark);
      li.setAttribute('aria-label', `${t.name}: ${got ? 'learned' : 'not yet'}`);
      return li;
    }));
    show('profileCard');
  }

  /* ---------- Tabs ---------- */
  const tabs = [$('tab-signup'), $('tab-login')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t, n) => {
        t.setAttribute('aria-selected', String(n === i));
        t.tabIndex = n === i ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = n !== i;
      });
      $('authMsg').textContent = '';
    });
  });

  /* ---------- Forms ---------- */
  async function submit(form, path, msgEl) {
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    msgEl.textContent = 'Please wait…';
    msgEl.className = 'status';
    try {
      const { user } = await call(path, data);
      form.reset();
      msgEl.textContent = '';
      // Record today's visit straight away so the streak starts on day one.
      try {
        const learned = (localStorage.getItem('chatsafe.learned') || '').split(',').filter(Boolean);
        const synced = await call('progress', { learned, scanned: false });
        renderProfile(synced.user);
        return;
      } catch { /* the streak can wait */ }
      renderProfile(user);
    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'status error';
    } finally {
      btn.disabled = false;
    }
  }

  $('signupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target, 'signup', $('authMsg'));
  });
  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submit(e.target, 'login', $('authMsg'));
  });
  $('logoutBtn').addEventListener('click', async () => {
    await call('logout', {}).catch(() => {});
    show('authCard');
  });

  /* ---------- Who is here? ---------- */
  call('me')
    .then(({ user, accounts }) => {
      if (!accounts) return show('noAccounts');
      if (user) {
        // Pull the local progress up to the account on every visit.
        const learned = (() => {
          try { return (localStorage.getItem('chatsafe.learned') || '').split(',').filter(Boolean); } catch { return []; }
        })();
        return call('progress', { learned, scanned: false })
          .then(({ user: fresh }) => renderProfile(fresh))
          .catch(() => renderProfile(user));
      }
      return show('authCard');
    })
    .catch(() => show('noAccounts'));
})();
