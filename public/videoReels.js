'use strict';

/**
 * videoReels.js — Vertical Scrollable Daily News Video Reels + Verified User Video Publisher.
 * Renders animated short-form vertical reels (with Web Speech narration option) AND
 * lets verified users upload real video files (.mp4/.webm) or publish new verified scam/civic reels.
 */
(() => {
  const STORAGE_KEY = 'chatsafe.userReels';

  function loadUserReels() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveUserReels(list) {
    try {
      // Only persist metadata & non-huge items cleanly
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
    } catch { /* ignore */ }
  }

  function animateCanvasReel(canvas, reel) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    let playing = false;
    let progress = 0;
    let raf = null;
    let last = performance.now();

    function draw(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) {
        progress = (progress + dt / (reel.durationSec || 15)) % 1;
      }

      // Dynamic gradient backdrop
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#090d1a');
      grad.addColorStop(0.55, '#121a2f');
      grad.addColorStop(1, reel.accent ? `${reel.accent}33` : '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Animated pulse ring
      const t = now / 1000;
      ctx.strokeStyle = reel.accent || '#22d3ee';
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.34, 70 + Math.sin(t * 2.4) * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      const scenes = reel.scenes || [{ badge: reel.category, headline: reel.title, body: reel.summary || '' }];
      const idx = Math.min(scenes.length - 1, Math.floor(progress * scenes.length));
      const sc = scenes[idx];

      // Category & city pill
      ctx.fillStyle = reel.accent || '#22d3ee';
      ctx.beginPath();
      ctx.roundRect(24, 24, 150, 30, 15);
      ctx.fill();
      ctx.fillStyle = '#04111d';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(sc.badge || reel.category).toUpperCase().slice(0, 18), 99, 43);

      // Verified badge
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`📍 ${reel.city}`, W - 22, 43);

      // Center visual card
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = reel.accent || '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(24, H * 0.25, W - 48, H * 0.44, 18);
      ctx.fill();
      ctx.stroke();

      // Headline wrapped
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px system-ui, sans-serif';
      wrapText(ctx, sc.headline || reel.title, 42, H * 0.34, W - 84, 26);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '15px system-ui, sans-serif';
      wrapText(ctx, sc.body || '', 42, H * 0.47, W - 84, 22);

      // Progress bars at top (Stories/Reels style)
      const barW = (W - 48 - (scenes.length - 1) * 6) / scenes.length;
      for (let i = 0; i < scenes.length; i++) {
        const bx = 24 + i * (barW + 6);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(bx, 10, barW, 4);
        const fill = i < idx ? 1 : i === idx ? (progress * scenes.length) % 1 : 0;
        ctx.fillStyle = reel.accent || '#22d3ee';
        ctx.fillRect(bx, 10, barW * fill, 4);
      }

      // Play/Pause indicator
      if (!playing) {
        ctx.fillStyle = 'rgba(0,0,0,0.48)';
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.8, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶', W / 2 + 2, H * 0.8 + 8);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('● PLAYING REEL · TAP TO PAUSE', W / 2, H * 0.82);
      }

      if (playing) raf = requestAnimationFrame(draw);
    }

    function wrapText(c, str, x, y, maxW, lh) {
      const words = String(str).split(' ');
      let line = '';
      let yy = y;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (c.measureText(test).width > maxW) {
          c.fillText(line, x, yy);
          line = w;
          yy += lh;
        } else {
          line = test;
        }
      }
      if (line) c.fillText(line, x, yy);
    }

    draw(performance.now());
    return {
      toggle() {
        playing = !playing;
        last = performance.now();
        if (playing) raf = requestAnimationFrame(draw);
        else {
          cancelAnimationFrame(raf);
          draw(performance.now());
        }
        return playing;
      },
      pause() {
        playing = false;
        cancelAnimationFrame(raf);
        draw(performance.now());
      },
    };
  }

  function renderReelsFeed(container, baseReels, { onSpeak } = {}) {
    if (!container) return;
    const all = [...loadUserReels(), ...baseReels];
    container.replaceChildren();

    all.forEach((reel) => {
      const card = document.createElement('article');
      card.className = 'reel-card glass';

      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'reel-media';

      let ctrl = null;
      if (reel.videoUrl) {
        const video = document.createElement('video');
        video.src = reel.videoUrl;
        video.controls = true;
        video.playsInline = true;
        video.loop = true;
        video.className = 'reel-video';
        mediaWrap.appendChild(video);
      } else {
        const cv = document.createElement('canvas');
        cv.width = 360;
        cv.height = 480;
        cv.className = 'reel-canvas';
        cv.setAttribute('aria-label', `${reel.title} video reel`);
        mediaWrap.appendChild(cv);
        ctrl = animateCanvasReel(cv, reel);
        cv.addEventListener('click', () => {
          const isPlaying = ctrl.toggle();
          if (isPlaying && onSpeak) {
            const script = (reel.scenes || []).map((s) => `${s.headline}. ${s.body}`).join(' ');
            onSpeak(script || reel.title);
          }
        });
      }

      const info = document.createElement('div');
      info.className = 'reel-info';
      const badgeText = reel.verified ? (reel.verifiedBadge || 'Verified Reporter ✓') : 'Community';
      info.innerHTML = `
        <div class="reel-creator">
          <strong>${escapeHtml(reel.creator)}</strong>
          <span class="verified-pill">${escapeHtml(badgeText)}</span>
        </div>
        <h4>${escapeHtml(reel.title)}</h4>
        <div class="reel-actions">
          <button type="button" class="chip reel-like">❤️ <span>${reel.likes || 1}</span></button>
          <button type="button" class="chip reel-listen">🔊 Listen</button>
          <span class="muted small">${escapeHtml(reel.views || 'New')} views</span>
        </div>
      `;

      info.querySelector('.reel-like').addEventListener('click', (e) => {
        const span = e.currentTarget.querySelector('span');
        span.textContent = String(Number(span.textContent) + 1);
      });
      info.querySelector('.reel-listen').addEventListener('click', () => {
        const script = (reel.scenes || []).map((s) => `${s.headline}. ${s.body}`).join(' ');
        onSpeak?.(script || reel.title);
      });

      card.append(mediaWrap, info);
      container.appendChild(card);
    });
  }

  function addUserReel(reel) {
    const list = loadUserReels();
    list.unshift(reel);
    saveUserReels(list);
    return list;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.ChatSafeReels = { renderReelsFeed, addUserReel, loadUserReels };
})();
