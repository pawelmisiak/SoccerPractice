/* Golazo Skills — soccer skills tracker for the family.
 * Plain JavaScript, no build step. All data lives on the device (localStorage).
 */
'use strict';

(() => {
  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'golazo.v1';

  const KITS = {
    blaugrana: { label: 'Blaugrana', a: '#a50044', b: '#004d98', num: '#edbb00', outline: '#14103a', stripes: 13 },
    senyera: { label: 'Gold', a: '#edbb00', b: '#da291c', num: '#0b2a6b', outline: '#ffffff', stripes: 6 },
    midnight: { label: 'Midnight', a: '#111827', b: '#1f2a44', num: '#edbb00', outline: '#000000', stripes: 13 },
    sky: { label: 'Sky', a: '#38bdf8', b: '#e0f2fe', num: '#0c2d6b', outline: '#ffffff', stripes: 13 },
    pitch: { label: 'Pitch', a: '#15803d', b: '#22c55e', num: '#ffffff', outline: '#0b3d1e', stripes: 13 },
    neon: { label: 'Neon', a: '#db2777', b: '#7c3aed', num: '#ffffff', outline: '#2a0a3d', stripes: 13 },
  };

  const DEFAULT_MOVES = [
    { name: 'Toe Taps', icon: '👟' },
    { name: 'Inside-Outside', icon: '↔️' },
    { name: 'Juggling', icon: '⚽' },
    { name: 'Sole Rolls', icon: '🌀' },
    { name: 'Pull-Backs', icon: '🔁' },
    { name: 'Step-Overs', icon: '⚡' },
    { name: 'Wall Passes', icon: '🧱', mic: true },
  ];

  const MOVE_ICONS = ['⚽', '👟', '🦶', '↔️', '🌀', '🔁', '⚡', '🧱', '🎯', '🔥', '⭐', '🚀', '🌪️', '🐐', '🪄', '🏃', '🥅', '💫'];

  const LEVELS = [
    { at: 0, name: 'Rookie', emoji: '🌱' },
    { at: 5, name: 'Academy', emoji: '🎒' },
    { at: 15, name: 'La Masia', emoji: '🏫' },
    { at: 30, name: 'B Team', emoji: '🅱️' },
    { at: 50, name: 'First Team', emoji: '👕' },
    { at: 75, name: 'Starter', emoji: '⚡' },
    { at: 110, name: 'Star Player', emoji: '⭐' },
    { at: 150, name: 'Captain', emoji: '©️' },
    { at: 200, name: 'Legend', emoji: '🏆' },
    { at: 300, name: 'G.O.A.T.', emoji: '🐐' },
  ];

  const CHEERS = ['Força!', 'Great training!', 'Keep it up!', 'Nice work!', 'Champion effort!', 'Vamos!', 'Top class!'];

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function defaultData() {
    return {
      version: 1,
      players: [],
      moves: DEFAULT_MOVES.map((m) => ({ id: uid(), ...m })),
      sessions: [],
      settings: { timedSeconds: 60, raceTarget: 50, countdown: 3, sound: true, micSensitivity: 3, micGap: 300 },
    };
  }

  function normalize(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    return {
      version: 1,
      players: Array.isArray(d.players) ? d.players : [],
      // Older data has no `mic` flag on moves: turn sound counting on for Wall Passes only.
      moves: Array.isArray(d.moves) ? d.moves.map((m) => (m.mic === undefined ? { ...m, mic: m.name === 'Wall Passes' } : m)) : base.moves,
      sessions: Array.isArray(d.sessions) ? d.sessions : [],
      settings: { ...base.settings, ...(d.settings || {}) },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('Could not load data', e);
    }
    return defaultData();
  }

  let data = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      toast('⚠️ Could not save. Storage may be full.');
    }
  }

  const player = (id) => data.players.find((p) => p.id === id);
  const move = (id) => data.moves.find((m) => m.id === id);

  // The "param" of a session is the rule it was played under (60 seconds, 50 reps...).
  // Scores are only compared against sessions played under the same rule.
  const currentParam = (mode) => (mode === 'timed' ? data.settings.timedSeconds : data.settings.raceTarget);
  const paramOf = (s) => (s.mode === 'timed' ? s.seconds : s.target);

  function sessionsFor(pid, mid, mode, param = currentParam(mode)) {
    return data.sessions
      .filter((s) => s.playerId === pid && s.moveId === mid && s.mode === mode && paramOf(s) === param)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const scoreOf = (s) => (s.mode === 'timed' ? s.reps : s.timeMs);
  const better = (mode, a, b) => (mode === 'timed' ? a > b : a < b);

  function bestOf(list) {
    let best = null;
    for (const s of list) if (!best || better(s.mode, scoreOf(s), scoreOf(best))) best = s;
    return best;
  }

  function levelFor(count) {
    let idx = 0;
    LEVELS.forEach((l, i) => { if (count >= l.at) idx = i; });
    return { ...LEVELS[idx], idx, next: LEVELS[idx + 1] || null };
  }

  const playerCount = (pid) => data.sessions.filter((s) => s.playerId === pid).length;

  function dayKey(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
  }

  // Consecutive training days ending today (or yesterday, so the streak survives until bedtime).
  function streakFor(pid) {
    const days = new Set(data.sessions.filter((s) => s.playerId === pid).map((s) => dayKey(s.date)));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fmtDuration(ms) {
    const t = Math.max(0, Math.floor(ms / 100)); // tenths
    const tenths = t % 10;
    const secs = Math.floor(t / 10);
    if (secs < 60) return `${secs}.${tenths}s`;
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.${tenths}`;
  }

  function fmtStopwatch(ms) {
    const t = Math.max(0, Math.floor(ms / 100));
    const secs = Math.floor(t / 10);
    if (secs < 60) return `${secs}.${t % 10}`;
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

  function fmtCountdown(ms) {
    const secs = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }

  const fmtSeconds = (s) => (s % 60 === 0 ? `${s / 60}:00` : `${s}s`);
  const scoreText = (s) => (s.mode === 'timed' ? `${s.reps}` : fmtDuration(s.timeMs));
  const scoreUnit = (s) => (s.mode === 'timed' ? 'reps' : '');

  function fmtDate(iso) {
    const d = new Date(iso);
    const today = dayKey(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (dayKey(d) === today) return `Today, ${time}`;
    if (dayKey(d) === dayKey(y)) return `Yesterday, ${time}`;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function modeInfo(mode) {
    if (mode === 'timed') {
      const s = data.settings.timedSeconds;
      return { icon: '⏱️', name: 'Beat the Clock', desc: `How many reps in ${fmtSeconds(s)}?` };
    }
    const n = data.settings.raceTarget;
    return { icon: '🏁', name: `Race to ${n}`, desc: `How fast can you do ${n} reps?` };
  }

  // ---------------------------------------------------------------------------
  // Graphics
  // ---------------------------------------------------------------------------
  const SHIRT = 'M40 12 L50 8 Q60 17 70 8 L80 12 L108 28 L99 50 L87 44 L87 113 L33 113 L33 44 L21 50 L12 28 Z';
  let svgId = 0;

  function jerseySVG(p, size = 120, showName = true) {
    const k = KITS[p.kit] || KITS.blaugrana;
    const id = `jc${++svgId}`;
    const name = String(p.name || '').toUpperCase().slice(0, 10);
    const num = String(p.number ?? '').slice(0, 2);
    let stripes = '';
    for (let x = k.stripes, i = 0; x < 120; x += k.stripes * 2, i++) {
      stripes += `<rect x="${x}" y="0" width="${k.stripes}" height="120" fill="${k.b}"/>`;
    }
    const nameSize = name.length > 7 ? 8.5 : 11;
    return `<svg class="jersey" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${SHIRT}"/></clipPath></defs>
      <g clip-path="url(#${id})">
        <rect width="120" height="120" fill="${k.a}"/>${stripes}
        <path d="M12 28 L40 12 L33 44 L21 50Z M108 28 L80 12 L87 44 L99 50Z" fill="rgba(0,0,0,.18)"/>
      </g>
      <path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M50 8 Q60 17 70 8" fill="none" stroke="${k.num}" stroke-width="3" stroke-linecap="round"/>
      ${showName && name ? `<text x="60" y="40" text-anchor="middle" font-family="Avenir Next, Futura, Arial Black, sans-serif" font-weight="900" font-size="${nameSize}" fill="${k.num}" stroke="${k.outline}" stroke-width="0.8" paint-order="stroke">${esc(name)}</text>` : ''}
      <text x="60" y="${showName && name ? 90 : 84}" text-anchor="middle" font-family="Avenir Next, Futura, Arial Black, sans-serif" font-weight="900" font-size="${num.length > 1 ? 40 : 46}" fill="${k.num}" stroke="${k.outline}" stroke-width="2" paint-order="stroke">${esc(num)}</text>
    </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Sound (synthesized with WebAudio — no files needed)
  // ---------------------------------------------------------------------------
  const sound = {
    ctx: null,
    unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* no audio */ }
    },
    tone(freq, dur, { type = 'sine', vol = 0.25, at = 0 } = {}) {
      if (!data.settings.sound || !this.ctx) return;
      const t = this.ctx.currentTime + at;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
      this.markBusy(t + dur);
    },
    // Remember when our own sounds end, so the microphone doesn't count them as hits.
    busyUntil: 0,
    markBusy(end) { this.busyUntil = Math.max(this.busyUntil, end + 0.15); },
    isBusy() { return !!this.ctx && this.ctx.currentTime < this.busyUntil; },
    beep() { this.tone(880, 0.15, { vol: 0.3 }); },
    // Referee whistle: high tone with a fast trill.
    whistle(dur = 0.5, at = 0) {
      if (!data.settings.sound || !this.ctx) return;
      const t = this.ctx.currentTime + at;
      const o = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(2900, t);
      lfo.frequency.setValueAtTime(28, t);
      lfoGain.gain.setValueAtTime(180, t);
      lfo.connect(lfoGain).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.setValueAtTime(0.22, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
      this.markBusy(t + dur);
    },
    finalWhistle() { this.whistle(0.35); this.whistle(0.35, 0.45); this.whistle(0.8, 0.9); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.3, at: i * 0.13 }));
      this.tone(1047, 0.6, { type: 'triangle', vol: 0.3, at: 0.55 });
    },
  };

  // ---------------------------------------------------------------------------
  // Keep the screen awake while training.
  // Uses the Screen Wake Lock API, plus a tiny silent looping video as a fallback
  // for older iPadOS versions where the wake lock doesn't work in home-screen apps.
  // ---------------------------------------------------------------------------
  const keepAwake = {
    wanted: false,
    sentinel: null,
    video: null,
    on() {
      this.wanted = true;
      this.startVideo(); // must start synchronously inside the tap
      this.requestLock();
    },
    async requestLock() {
      if (!('wakeLock' in navigator) || this.sentinel) return;
      try {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => { this.sentinel = null; });
        if (!this.wanted) this.off();
      } catch (e) { /* not allowed right now; video fallback still runs */ }
    },
    startVideo() {
      try {
        if (!this.video) {
          const v = document.createElement('video');
          v.className = 'hidden-video';
          v.muted = true;
          v.loop = true;
          v.setAttribute('muted', '');
          v.setAttribute('playsinline', '');
          v.setAttribute('aria-hidden', 'true');
          v.src = 'assets/keepawake.mp4';
          document.body.appendChild(v);
          this.video = v;
        }
        const p = this.video.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    },
    off() {
      this.wanted = false;
      if (this.sentinel) { this.sentinel.release().catch(() => {}); this.sentinel = null; }
      if (this.video) this.video.pause();
    },
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && keepAwake.wanted) {
      keepAwake.requestLock();
      keepAwake.startVideo();
    }
  });

  // ---------------------------------------------------------------------------
  // Microphone rep counter: hears the ball hitting the wall (see hit-worklet.js).
  // ---------------------------------------------------------------------------
  // Sensitivity 1 (only very loud hits) … 5 (picks up soft taps).
  const MIC_THRESHOLDS = [0.4, 0.25, 0.15, 0.09, 0.05];

  const mic = {
    stream: null,
    src: null,
    node: null,
    loaded: false,
    onHit: null,
    onLevel: null,
    supported() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioWorkletNode);
    },
    threshold() {
      return MIC_THRESHOLDS[(data.settings.micSensitivity || 3) - 1] || 0.15;
    },
    // Call from a tap (so the audio context may start). Rejects if the mic is blocked.
    async start() {
      this.stop();
      sound.unlock();
      const ctx = sound.ctx;
      if (!ctx || !this.supported()) throw new Error('unsupported');
      if (!this.loaded) {
        await ctx.audioWorklet.addModule('js/hit-worklet.js');
        this.loaded = true;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.stream = stream;
      this.src = ctx.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(ctx, 'hit-detector');
      this.configure();
      this.node.port.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'hit') {
          // Ignore our own whistle and beeps.
          if (!sound.isBusy() && this.onHit) this.onHit(m.level);
        } else if (this.onLevel) {
          this.onLevel(m.level);
        }
      };
      this.src.connect(this.node);
      // The node outputs silence; connecting it keeps the browser processing it.
      this.node.connect(ctx.destination);
    },
    configure() {
      if (this.node) this.node.port.postMessage({ threshold: this.threshold(), gap: (data.settings.micGap || 300) / 1000 });
    },
    stop() {
      try {
        if (this.src) this.src.disconnect();
        if (this.node) { this.node.port.onmessage = null; this.node.disconnect(); }
      } catch (e) { /* already disconnected */ }
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      this.stream = this.src = this.node = null;
      this.onHit = this.onLevel = null;
    },
  };

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------
  const app = document.getElementById('app');

  function toast(msg, ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // Simple modal. Resolves with { value, body } where body is the modal content element.
  function showModal({ title, html = '', buttons = [{ label: 'OK', value: true, cls: 'primary' }] }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal card" role="dialog" aria-modal="true">
          <h2>${esc(title)}</h2>
          <div class="modal-body">${html}</div>
          <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
        </div>`;
      wrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.chips[data-single] .chip');
        if (chip) {
          chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
          return;
        }
        const b = e.target.closest('[data-i]');
        if (!b) return;
        const body = wrap.querySelector('.modal-body');
        wrap.remove();
        resolve({ value: buttons[+b.dataset.i].value, body });
      });
      document.body.appendChild(wrap);
      const input = wrap.querySelector('input');
      if (input) setTimeout(() => input.focus(), 50);
    });
  }

  async function confirmBox(title, message, okLabel = 'Yes', danger = false) {
    const r = await showModal({
      title,
      html: esc(message),
      buttons: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, cls: danger ? 'danger' : 'primary' }],
    });
    return r.value;
  }

  function confetti(duration = 3500) {
    const c = document.createElement('canvas');
    c.className = 'confetti';
    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const colors = ['#004d98', '#a50044', '#edbb00', '#ffffff', '#ffd84d'];
    const bits = Array.from({ length: 160 }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      w: 6 + Math.random() * 8,
      h: 10 + Math.random() * 10,
      vy: 2.5 + Math.random() * 4,
      vx: -1.5 + Math.random() * 3,
      r: Math.random() * Math.PI,
      vr: -0.2 + Math.random() * 0.4,
      color: colors[(Math.random() * colors.length) | 0],
      ball: Math.random() < 0.08,
    }));
    const start = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        if (b.ball) {
          ctx.font = '26px sans-serif';
          ctx.fillText('⚽', -13, 9);
        } else {
          ctx.fillStyle = b.color;
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        }
        ctx.restore();
      }
      if (now - start < duration) requestAnimationFrame(frame);
      else c.remove();
    })(start);
  }

  // ---------------------------------------------------------------------------
  // State & routing
  // ---------------------------------------------------------------------------
  const state = {
    view: 'players',
    playerId: null,
    moveId: null,
    mode: 'timed',
    progressMode: 'timed',
    progressMove: null,
    familyMode: 'timed',
    lastResult: null,
    editPlayerId: null,
    editFrom: 'parent',
    draft: null,
  };

  let cleanup = null;

  function go(view, patch = {}) {
    if (cleanup) { cleanup(); cleanup = null; }
    Object.assign(state, patch, { view });
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const fn = VIEWS[state.view] || VIEWS.players;
    app.innerHTML = fn();
    const after = AFTER[state.view];
    if (after) after();
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------
  const topbarHome = () => `
    <div class="stripes"></div>
    <div class="topbar">
      <div class="brand"><img src="assets/icon-192.png" alt=""><span>GOLAZO <span class="gold">SKILLS</span></span></div>
      <div class="spacer"></div>
      <button class="icon-btn" data-action="family" aria-label="Family trophy room">🏆</button>
      <button class="icon-btn hold-btn" data-hold="parent" aria-label="Parent settings (press and hold)">⚙️</button>
    </div>`;

  function playerHeader(p, backAction = 'toPlayers') {
    const n = playerCount(p.id);
    const lv = levelFor(n);
    return `
      <div class="stripes"></div>
      <div class="topbar">
        <button class="icon-btn" data-action="${backAction}" aria-label="Back">⬅️</button>
        <div class="who">
          ${jerseySVG(p, 58, false)}
          <div class="who-text">
            <div class="who-name">${esc(p.name)}</div>
            <div class="who-sub">${lv.emoji} ${esc(lv.name)}</div>
          </div>
        </div>
        <div class="spacer"></div>
      </div>`;
  }

  const VIEWS = {
    players() {
      if (!data.players.length) {
        return `${topbarHome()}
          <div class="welcome card">
            <div class="big-ball">⚽</div>
            <h1 class="title">Welcome to <span class="gold">Golazo!</span></h1>
            <p>Track your soccer moves, beat your records, and level up from Rookie to G.O.A.T.</p>
            <div class="btn-row"><button class="btn primary" data-action="firstPlayer">➕ Add the first player</button></div>
          </div>`;
      }
      const tiles = data.players.map((p) => {
        const n = playerCount(p.id);
        const lv = levelFor(n);
        const st = streakFor(p.id);
        const k = KITS[p.kit] || KITS.blaugrana;
        return `<button class="card player-tile" style="--tile-accent: linear-gradient(90deg, ${k.a}, ${k.b})" data-action="pickPlayer" data-id="${p.id}">
            ${jerseySVG(p, 150)}
            <div class="pname">${esc(p.name)}</div>
            <div class="badge">${lv.emoji} ${esc(lv.name)}</div>
            <div class="${st ? 'streak' : 'muted'}">${st ? `🔥 ${st}-day streak` : `${n} training${n === 1 ? '' : 's'}`}</div>
          </button>`;
      }).join('');
      return `${topbarHome()}
        <h1 class="title">Who's training <span class="gold">today?</span></h1>
        <div class="player-grid">${tiles}
          <button class="card player-tile add-tile" data-action="addPlayerTile" aria-label="Add a player">
            <div class="add-plus">+</div>
            <div class="pname">Add player</div>
            <div class="muted">New teammate</div>
          </button>
        </div>`;
    },

    home() {
      const p = player(state.playerId);
      if (!p) return VIEWS.players();
      const n = playerCount(p.id);
      const lv = levelFor(n);
      const pct = lv.next ? Math.round(((n - lv.at) / (lv.next.at - lv.at)) * 100) : 100;
      const modes = ['timed', 'race'].map((m) => {
        const mi = modeInfo(m);
        return `<button class="card mode-card ${state.mode === m ? 'selected' : ''}" data-action="pickMode" data-mode="${m}">
            <div class="mode-icon">${mi.icon}</div>
            <div><div class="mode-name">${esc(mi.name)}</div><div class="mode-desc">${esc(mi.desc)}</div></div>
          </button>`;
      }).join('');
      const moves = data.moves.map((m) => {
        const best = bestOf(sessionsFor(p.id, m.id, state.mode));
        return `<button class="card move-card" data-action="pickMove" data-id="${m.id}">
            <div class="micon">${esc(m.icon)}</div>
            <div class="mname">${esc(m.name)}</div>
            ${best ? `<div class="mbest">🏆 ${esc(scoreText(best))} ${scoreUnit(best)}</div>` : '<div class="mbest none">No record yet</div>'}
          </button>`;
      }).join('');
      return `${playerHeader(p)}
        <div class="card level">
          <div class="level-emoji">${lv.emoji}</div>
          <div class="level-main">
            <div class="level-name">${esc(lv.name)} · ${n} training${n === 1 ? '' : 's'}</div>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <div class="level-next">${lv.next ? `${lv.next.at - n} more to reach ${lv.next.emoji} ${esc(lv.next.name)}` : 'Top level reached. Legendary!'}</div>
          </div>
          <button class="btn small" data-action="progress">📈 Progress</button>
        </div>
        <div class="section-title">1 · Pick your challenge</div>
        <div class="mode-grid">${modes}</div>
        <div class="section-title">2 · Pick your move</div>
        <div class="move-grid">${moves}</div>`;
    },

    train() {
      const p = player(state.playerId);
      const m = move(state.moveId);
      if (!p || !m) return VIEWS.players();
      const mi = modeInfo(state.mode);
      const best = bestOf(sessionsFor(p.id, m.id, state.mode));
      const startClock = state.mode === 'timed' ? fmtCountdown(data.settings.timedSeconds * 1000) : '0.0';
      return `<div class="train">
          <div class="train-top">
            <button class="icon-btn" data-action="leaveTrain" aria-label="Back">✖️</button>
            ${jerseySVG(p, 54, false)}
            <div class="train-info">
              <div class="train-move">${esc(m.icon)} ${esc(m.name)}</div>
              <div class="train-mode">${esc(p.name)} · ${mi.icon} ${esc(mi.name)}${useMic(m) ? ' · 🎤 Sound counting' : ''}</div>
            </div>
            <div class="spacer"></div>
            <div class="train-best"><small>Record</small>${best ? `${esc(scoreText(best))} ${scoreUnit(best)}` : '—'}</div>
          </div>
          <button class="bigbtn ready" id="bigbtn" aria-label="Start">
            <div class="clock" id="clock">${startClock}</div>
            <div class="count" id="count" hidden></div>
            <div class="hint" id="hint">Tap to kick off ⚽</div>
          </button>
        </div>`;
    },

    result() {
      const r = state.lastResult;
      const p = player(state.playerId);
      const m = move(state.moveId);
      if (!r || !p || !m) return VIEWS.players();
      const s = r.session;
      const mi = modeInfo(s.mode);
      let head;
      let sub;
      let compare = '';
      if (r.isPB && r.prevBest) {
        head = 'GOOOOL!';
        sub = 'NEW PERSONAL RECORD!';
        const diff = s.mode === 'timed' ? `+${s.reps - r.prevBest.reps} reps` : `${fmtDuration(r.prevBest.timeMs - s.timeMs)} faster`;
        compare = `Old record: ${scoreText(r.prevBest)} ${scoreUnit(r.prevBest)} · ${diff}`;
      } else if (r.isPB) {
        head = 'First record!';
        sub = 'Now try to beat it!';
      } else {
        head = CHEERS[Math.floor(Math.random() * CHEERS.length)];
        sub = 'Great effort!';
        const b = r.prevBest;
        if (s.mode === 'timed') {
          const gap = b.reps - s.reps;
          compare = gap === 0 ? `You tied your record of ${b.reps}! 🤝` : `Record: ${b.reps} reps · only ${gap} to go!`;
        } else {
          const gap = s.timeMs - b.timeMs;
          compare = gap === 0 ? 'You tied your record! 🤝' : `Record: ${fmtDuration(b.timeMs)} · ${fmtDuration(gap)} to beat it!`;
        }
      }
      const lvNow = levelFor(playerCount(p.id));
      return `${playerHeader(p, 'backHome')}
        <div class="result">
          ${r.isPB ? '<div class="trophy">🏆</div>' : ''}
          <div class="result-head">${esc(head)}</div>
          <div class="result-sub">${esc(sub)}</div>
          <div class="card result-score">
            <div class="muted" style="font-weight:800;font-size:18px">${esc(m.icon)} ${esc(m.name)} · ${mi.icon} ${esc(mi.name)}</div>
            <div class="num">${esc(scoreText(s))}</div>
            <div class="unit">${s.mode === 'timed' ? `reps in ${fmtSeconds(s.seconds)}` : `for ${s.target} reps`}</div>
            ${compare ? `<div class="result-compare">${esc(compare)}</div>` : ''}
          </div>
          ${r.levelUp ? `<div class="card levelup">⬆️ LEVEL UP! You're now ${lvNow.emoji} ${esc(lvNow.name)}!</div>` : ''}
          <div class="btn-row">
            <button class="btn primary" data-action="again">🔁 Go again</button>
            <button class="btn" data-action="backHome">⚽ Another move</button>
            <button class="btn" data-action="progress">📈 Progress</button>
          </div>
        </div>`;
    },

    progress() {
      const p = player(state.playerId);
      if (!p) return VIEWS.players();
      const mode = state.progressMode;
      const seg = modeSeg(mode, 'progressMode');
      if (state.progressMove) return progressDetail(p, move(state.progressMove), mode, seg);
      const cards = data.moves.map((m) => {
        const list = sessionsFor(p.id, m.id, mode);
        const best = bestOf(list);
        const last = list[list.length - 1];
        return `<button class="card prog-card" data-action="progressMove" data-id="${m.id}">
            <div class="micon">${esc(m.icon)}</div>
            <div class="pc-main">
              <div class="mname">${esc(m.name)}</div>
              <div class="pc-stats">${list.length ? `${list.length} session${list.length === 1 ? '' : 's'} · last ${esc(scoreText(last))} ${scoreUnit(last)}` : 'Not tried yet'}</div>
            </div>
            <div class="pc-best">${best ? `<small>Record</small>${esc(scoreText(best))}` : ''}</div>
          </button>`;
      }).join('');
      return `${playerHeader(p, 'backHome')}
        <h1 class="title">My <span class="gold">Progress</span></h1>
        <div style="text-align:center;margin-bottom:20px">${seg}</div>
        <div class="prog-list">${cards}</div>`;
    },

    family() {
      const mode = state.familyMode;
      if (!data.players.length) return VIEWS.players();
      const head = data.players.map((p) => `<th><div class="th-player">${jerseySVG(p, 54, false)}${esc(p.name)}</div></th>`).join('');
      const rows = data.moves.map((m) => {
        const bests = data.players.map((p) => bestOf(sessionsFor(p.id, m.id, mode)));
        let top = null;
        bests.forEach((b) => { if (b && (!top || better(mode, scoreOf(b), scoreOf(top)))) top = b; });
        const cells = bests.map((b) => {
          if (!b) return '<td class="muted">—</td>';
          const isTop = top && scoreOf(b) === scoreOf(top);
          return `<td class="${isTop ? 'top' : ''}">${isTop && data.players.length > 1 ? '👑 ' : ''}${esc(scoreText(b))}</td>`;
        }).join('');
        return `<tr><td><div class="mcell">${esc(m.icon)} ${esc(m.name)}</div></td>${cells}</tr>`;
      }).join('');
      return `<div class="stripes"></div>
        <div class="topbar">
          <button class="icon-btn" data-action="toPlayers" aria-label="Back">⬅️</button>
          <div class="brand">🏆 Trophy Room</div>
        </div>
        <h1 class="title">Family <span class="gold">Records</span></h1>
        <div style="text-align:center;margin-bottom:20px">${modeSeg(mode, 'familyMode')}</div>
        <div class="card table-wrap"><table class="family"><thead><tr><th>Move</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    },

    parent() {
      const s = data.settings;
      const players = data.players.map((p) => `
        <div class="list-row">
          ${jerseySVG(p, 52, false)}
          <div class="grow">${esc(p.name)}<small>#${esc(p.number)} · ${playerCount(p.id)} sessions</small></div>
          <button class="btn small" data-action="editPlayer" data-id="${p.id}">Edit</button>
        </div>`).join('');
      const moves = data.moves.map((m) => `
        <div class="list-row">
          <div style="font-size:30px">${esc(m.icon)}</div>
          <div class="grow">${esc(m.name)}<small>${data.sessions.filter((x) => x.moveId === m.id).length} sessions${m.mic ? ' · 🎤 sound counting' : ''}</small></div>
          <button class="btn small" data-action="editMove" data-id="${m.id}">Edit</button>
        </div>`).join('');
      const chips = (key, opts, fmt) => `<div class="chips">${opts.map((o) => `<button class="chip ${s[key] === o ? 'on' : ''}" data-action="setting" data-key="${key}" data-val="${o}">${fmt(o)}</button>`).join('')}</div>`;
      const wl = 'wakeLock' in navigator;
      return `<div class="stripes"></div>
        <div class="topbar">
          <button class="icon-btn" data-action="toPlayers" aria-label="Back">⬅️</button>
          <div class="brand">⚙️ Parent Corner</div>
        </div>

        <div class="section-title">Players</div>
        <div class="card list">${players || '<div class="note">No players yet.</div>'}</div>
        <div class="btn-row" style="justify-content:flex-start"><button class="btn primary" data-action="newPlayer">➕ Add player</button></div>

        <div class="section-title">Moves</div>
        <div class="card list">${moves}</div>
        <div class="btn-row" style="justify-content:flex-start"><button class="btn primary" data-action="newMove">➕ Add move</button></div>

        <div class="section-title">Training rules</div>
        <div class="card">
          <div class="setting-row"><div class="grow">⏱️ Beat the Clock length<small>Records are kept separately for each length.</small></div>${chips('timedSeconds', [30, 45, 60, 90, 120], fmtSeconds)}</div>
          <div class="setting-row"><div class="grow">🏁 Race target<small>Number of reps to race to.</small></div>${chips('raceTarget', [10, 25, 50, 100], (o) => `${o}`)}</div>
          <div class="setting-row"><div class="grow">🚦 Get-ready countdown<small>Time to get to the ball after tapping start.</small></div>${chips('countdown', [0, 3, 5, 10], (o) => (o ? `${o}s` : 'Off'))}</div>
          <div class="setting-row"><div class="grow">🔊 Whistle &amp; beeps<small>The iPad's silent switch / volume also applies.</small></div>${chips('sound', [true, false], (o) => (o ? 'On' : 'Off'))}</div>
        </div>

        <div class="section-title">🎤 Sound counting</div>
        <div class="card">
          <div class="note">For moves with sound counting turned on (edit a move above), the iPad listens for the ball hitting the wall and counts each hit as a rep. Put the iPad a few steps from the wall, then use the test to pick the right sensitivity.</div>
          <div class="setting-row"><div class="grow">Sensitivity<small>Higher picks up softer hits, but also more background noise.</small></div>${chips('micSensitivity', [1, 2, 3, 4, 5], (o) => `${o}`)}</div>
          <div class="setting-row"><div class="grow">Shortest time between hits<small>Stops one hit (and its echo) counting twice.</small></div>${chips('micGap', [200, 300, 500, 800], (o) => `${o / 1000}s`)}</div>
          <div class="btn-row" style="justify-content:flex-start;padding:0 18px 18px;margin-top:0">
            <button class="btn" data-action="micTest">🎤 Test the microphone</button>
          </div>
          ${mic.supported() ? '' : '<div class="note">⚠️ This browser can\'t use the microphone for counting.</div>'}
        </div>

        <div class="section-title">Backup</div>
        <div class="card">
          <div class="note">All scores are stored only on this iPad. Save a backup now and then (e.g. to Files or iCloud Drive) so you never lose progress.</div>
          <div class="btn-row" style="justify-content:flex-start;padding:0 18px 18px;margin-top:0">
            <button class="btn" data-action="exportData">💾 Save backup</button>
            <button class="btn" data-action="importData">📂 Restore backup</button>
          </div>
        </div>

        <div class="section-title">About this iPad</div>
        <div class="card"><div class="note">
          Keep-awake: ${wl ? '✅ Screen Wake Lock supported' : '⚠️ Wake Lock not supported — using video fallback'}.<br>
          Installed as app: ${isStandalone() ? '✅ Yes' : '❌ Not yet. In Safari tap Share → <b>Add to Home Screen</b> so data is kept safe and the app runs full screen.'}<br>
          ${data.sessions.length} sessions saved in total.
        </div></div>
        <div class="btn-row" style="justify-content:flex-start">
          <button class="btn danger small" data-action="resetAll">🗑️ Erase everything</button>
        </div>`;
    },

    micTest() {
      const sens = data.settings.micSensitivity;
      return `<div class="stripes"></div>
        <div class="topbar">
          <button class="icon-btn" data-action="micTestBack" aria-label="Back">⬅️</button>
          <div class="brand">🎤 Microphone test</div>
        </div>
        <div class="card" style="padding:22px;max-width:760px;margin:10px auto">
          <div class="note" style="padding:0 0 14px">Tap <b>Start listening</b>, then kick the ball at the wall a few times. Every hit should add exactly one to the counter. Talking and footsteps should not.</div>
          <div class="meter"><i id="meterFill"></i><b id="meterMark" style="left:${(Math.sqrt(mic.threshold()) * 100).toFixed(1)}%"></b></div>
          <div class="muted" style="font-size:14px;font-weight:700;margin-top:6px">The bar shows how loud it is. A sound must pass the white line to count.</div>
          <div class="mic-hits" id="micHits">0</div>
          <div style="text-align:center;font-weight:800;color:var(--ink-2)">hits heard</div>
          <div class="setting-row" style="padding:18px 0 0;border:0"><div class="grow">Sensitivity</div>
            <div class="chips">${[1, 2, 3, 4, 5].map((o) => `<button class="chip ${sens === o ? 'on' : ''}" data-action="micSens" data-val="${o}">${o}</button>`).join('')}</div></div>
          <div class="btn-row">
            <button class="btn primary" id="micToggle" data-action="micToggle">🎤 Start listening</button>
            <button class="btn" data-action="micReset">↺ Reset count</button>
          </div>
        </div>`;
    },

    editPlayer() {
      const d = state.draft;
      const isNew = !state.editPlayerId;
      const kits = Object.entries(KITS).map(([key, k]) => `
        <button class="kit-opt ${d.kit === key ? 'on' : ''}" data-action="draftKit" data-kit="${key}">
          ${jerseySVG({ ...d, kit: key, name: '' }, 80, false)}${esc(k.label)}
        </button>`).join('');
      const nums = [7, 8, 9, 10, 11, 19].map((n) => `<button class="chip ${String(d.number) === String(n) ? 'on' : ''}" data-action="draftNum" data-num="${n}">${n}</button>`).join('');
      return `<div class="stripes"></div>
        <div class="topbar">
          <button class="icon-btn" data-action="cancelEdit" aria-label="Back">⬅️</button>
          <div class="brand">${isNew ? '➕ New player' : '✏️ Edit player'}</div>
        </div>
        <div class="editor">
          <div class="card editor-preview" id="preview">${jerseySVG(d, 200)}<div class="pname" style="font-weight:900;font-size:26px">${esc(d.name || 'Player')}</div></div>
          <div>
            <div class="field"><label for="pname">Name</label><input class="input" id="pname" maxlength="14" value="${esc(d.name)}" placeholder="e.g. Leo" autocomplete="off"></div>
            <div class="field"><label for="pnum">Shirt number</label>
              <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
                <input class="input" id="pnum" inputmode="numeric" maxlength="2" value="${esc(d.number)}" style="width:110px;text-align:center">
                <div class="chips">${nums}</div>
              </div>
            </div>
            <div class="field"><label>Kit</label><div class="kit-grid">${kits}</div></div>
            <div class="btn-row" style="justify-content:flex-start">
              <button class="btn primary" data-action="savePlayer">✅ Save</button>
              ${isNew ? '' : '<button class="btn danger" data-action="deletePlayer">🗑️ Delete player</button>'}
            </div>
          </div>
        </div>`;
    },
  };

  function modeSeg(mode, key) {
    return `<div class="seg">${['timed', 'race'].map((m) => {
      const mi = modeInfo(m);
      return `<button class="${mode === m ? 'on' : ''}" data-action="setView" data-key="${key}" data-val="${m}">${mi.icon} ${esc(mi.name)}</button>`;
    }).join('')}</div>`;
  }

  function progressDetail(p, m, mode, seg) {
    if (!m) { state.progressMove = null; return VIEWS.progress(); }
    const list = sessionsFor(p.id, m.id, mode);
    const best = bestOf(list);
    const all = data.sessions
      .filter((s) => s.playerId === p.id && s.moveId === m.id && s.mode === mode)
      .sort((a, b) => b.date.localeCompare(a.date));
    const param = currentParam(mode);
    const rows = all.map((s) => {
      const otherRule = paramOf(s) !== param;
      const rule = otherRule ? ` <span class="muted" style="font-size:14px">(${s.mode === 'timed' ? fmtSeconds(s.seconds) : `${s.target} reps`})</span>` : '';
      return `<div class="hrow">
          <div class="hstar">${best && s.id === best.id ? '🏆' : ''}</div>
          <div class="hdate">${esc(fmtDate(s.date))}</div>
          <div class="hscore">${esc(scoreText(s))} <span class="muted" style="font-size:15px">${scoreUnit(s)}</span>${rule}</div>
          <button class="hdel" data-action="deleteSession" data-id="${s.id}" aria-label="Delete">🗑️</button>
        </div>`;
    }).join('');
    const mi = modeInfo(mode);
    return `${playerHeader(p, 'progressBack')}
      <h1 class="title">${esc(m.icon)} ${esc(m.name)}</h1>
      <div style="text-align:center;margin-bottom:8px">${seg}</div>
      <div class="card chart-card">
        <div class="chart-title">${mi.icon} ${esc(mi.name)}${best ? ` · Record ${esc(scoreText(best))} ${scoreUnit(best)}` : ''}</div>
        <div class="chart-sub">${mode === 'timed' ? 'Reps per session — higher is better' : 'Time per session — the line goes up as you get faster'}. Tap a dot to see the score.</div>
        ${list.length ? chartSVG(list, mode, best) : '<div class="note" style="padding:30px 0;text-align:center">No sessions yet. Go train! ⚽</div>'}
      </div>
      ${all.length ? `<div class="section-title">History</div><div class="card history">${rows}</div>` : ''}
      <div class="btn-row"><button class="btn primary" data-action="trainThis">⚽ Train this move</button></div>`;
  }

  // Single-series line chart. For race mode the y-axis is flipped so "up" always means "better".
  function chartSVG(list, mode, best) {
    const pts = list.slice(-30);
    const W = 800, H = 280, L = 54, R = 20, T = 30, B = 34;
    const iw = W - L - R, ih = H - T - B;
    const vals = pts.map((s) => (mode === 'timed' ? s.reps : s.timeMs / 1000));
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const pad = vMax > vMin ? (vMax - vMin) * 0.25 : Math.max(vMax * 0.2, 1);
    const ticks = niceTicks(Math.max(0, vMin - pad), vMax + pad, 4);
    const lo = ticks[0];
    const hi = ticks[ticks.length - 1];
    const x = (i) => (pts.length === 1 ? L + iw / 2 : L + (i / (pts.length - 1)) * iw);
    const frac = (v) => (v - lo) / (hi - lo || 1);
    const y = (v) => (mode === 'timed' ? T + ih - frac(v) * ih : T + frac(v) * ih);
    const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join('');
    const yLabels = ticks.map((t) => `<text x="${L - 10}" y="${y(t) + 4}" text-anchor="end">${mode === 'timed' ? t : `${t}s`}</text>`).join('');
    const path = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(vals[i]).toFixed(1)}`).join(' ');
    const baseY = T + ih;
    const area = pts.length > 1 ? `<path class="area" d="${path} L${x(pts.length - 1)} ${baseY} L${x(0)} ${baseY} Z"/>` : '';
    const bi = pts.findIndex((s) => best && s.id === best.id);
    const dots = pts.map((s, i) => `<circle class="dot ${i === bi ? 'pb' : ''}" cx="${x(i)}" cy="${y(vals[i])}" r="${i === bi ? 7 : 5}"/>`).join('');
    const hits = pts.map((s, i) => `<circle class="hit" cx="${x(i)}" cy="${y(vals[i])}" r="22" data-action="chartTip" data-x="${x(i)}" data-y="${y(vals[i])}" data-label="${esc(`${scoreText(s)} ${scoreUnit(s)} · ${fmtDate(s.date)}`)}"/>`).join('');
    const bestLine = bi >= 0 ? `<line class="best-line" x1="${L}" x2="${W - R}" y1="${y(vals[bi])}" y2="${y(vals[bi])}"/>` : '';
    const bestLabel = bi >= 0 ? `<text class="label" x="${Math.min(Math.max(x(bi), L + 40), W - R - 40)}" y="${y(vals[bi]) - 14}" text-anchor="middle">🏆 ${esc(scoreText(pts[bi]))}</text>` : '';
    const xLabels = pts.length > 1
      ? `<text x="${L}" y="${H - 8}">${esc(fmtShort(pts[0].date))}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${esc(fmtShort(pts[pts.length - 1].date))}</text>`
      : `<text x="${L + iw / 2}" y="${H - 8}" text-anchor="middle">${esc(fmtShort(pts[0].date))}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">
      <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#edbb00" stop-opacity=".28"/><stop offset="1" stop-color="#edbb00" stop-opacity="0"/>
      </linearGradient></defs>
      <g class="grid">${grid}</g>
      <g class="axis">${yLabels}${xLabels}</g>
      ${area}${bestLine}<path class="line" d="${path}"/>${dots}${bestLabel}${hits}
      <g class="tip" id="tip" style="display:none"><rect rx="8" height="28"/><text y="19"></text></g>
    </svg>`;
  }

  // Round tick values covering [lo, hi].
  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((st) => st >= raw) || raw;
    const start = Math.floor(lo / step) * step;
    const out = [];
    for (let v = start; v < hi + step - 1e-9; v += step) out.push(+v.toFixed(2));
    return out;
  }

  const fmtShort = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const useMic = (m) => !!(m && m.mic) && mic.supported();

  const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  // ---------------------------------------------------------------------------
  // Training screen logic
  // ---------------------------------------------------------------------------
  const AFTER = {
    micTest() {
      cleanup = () => { mic.stop(); state.micReset = null; };
    },
    train() {
      const btn = document.getElementById('bigbtn');
      const clock = document.getElementById('clock');
      const hint = document.getElementById('hint');
      const countEl = document.getElementById('count');
      const mode = state.mode;
      const target = data.settings.raceTarget;
      const run = { phase: 'ready', raf: 0, t0: 0, lastSec: null, hits: 0, listening: false };
      const wantMic = useMic(move(state.moveId));

      const showCount = () => {
        countEl.hidden = false;
        countEl.textContent = mode === 'race' ? `⚽ ${run.hits} / ${target}` : `⚽ ${run.hits}`;
      };

      // Each ball-on-wall sound while the clock runs counts as one rep.
      const onHit = () => {
        if (run.phase !== 'running' || performance.now() - run.t0 < 300) return;
        run.hits++;
        showCount();
        btn.classList.remove('bump');
        void btn.offsetWidth; // restart the flash animation
        btn.classList.add('bump');
        if (mode === 'race' && run.hits >= target) finishRace();
      };

      const startMic = () => {
        mic.start()
          .then(() => {
            if (run.phase === 'finished' || state.run !== run) { mic.stop(); return; }
            mic.onHit = onHit;
            run.listening = true;
            btn.classList.add('listening');
          })
          .catch(() => toast('🎤 Microphone not available. Count your reps yourself this time.', 3500));
      };
      const setPhase = (ph) => {
        run.phase = ph;
        btn.className = `bigbtn ${ph}`;
      };

      const tick = () => {
        const now = performance.now();
        if (run.phase === 'countdown') {
          const left = run.t0 - now;
          if (left <= 0) {
            startRunning();
          } else {
            const sec = Math.ceil(left / 1000);
            if (sec !== run.lastSec) {
              run.lastSec = sec;
              clock.textContent = sec;
              sound.beep();
            }
          }
        } else if (run.phase === 'running') {
          const elapsed = now - run.t0;
          if (mode === 'timed') {
            const total = data.settings.timedSeconds * 1000;
            const left = total - elapsed;
            if (left <= 0) {
              clock.textContent = '0:00';
              finishTimed();
              return;
            }
            clock.textContent = fmtCountdown(left);
            const sec = Math.ceil(left / 1000);
            if (sec <= 5 && sec !== run.lastSec) {
              run.lastSec = sec;
              btn.classList.add('hurry');
              // While listening, skip the beeps: the mic would ignore real hits during them.
              if (!run.listening) sound.beep();
            }
          } else {
            clock.textContent = fmtStopwatch(elapsed);
          }
        }
        run.raf = requestAnimationFrame(tick);
      };

      const startRunning = () => {
        setPhase('running');
        if (run.listening) btn.classList.add('listening');
        run.t0 = performance.now();
        run.lastSec = null;
        sound.whistle(0.6);
        clock.textContent = mode === 'timed' ? fmtCountdown(data.settings.timedSeconds * 1000) : '0.0';
        hint.textContent = mode === 'timed' ? 'Go go go! 🔥' : `Tap when you hit ${target}! 🏁`;
        if (wantMic) {
          showCount();
          hint.textContent = mode === 'timed' ? '🎤 Listening… go go go!' : `🎤 Listening… race to ${target}!`;
        }
      };

      const finishTimed = () => {
        cancelAnimationFrame(run.raf);
        setPhase('finished');
        mic.stop();
        hint.textContent = 'Time!';
        sound.finalWhistle();
        showEntry();
      };

      const finishRace = () => {
        const ms = performance.now() - run.t0;
        cancelAnimationFrame(run.raf);
        setPhase('finished');
        mic.stop();
        clock.textContent = fmtStopwatch(ms);
        hint.textContent = 'Finished!';
        sound.finalWhistle();
        const fields = { mode: 'race', target, timeMs: Math.round(ms) };
        if (run.listening) fields.micHits = run.hits;
        record(fields);
      };

      const showEntry = () => {
        // With sound counting, start from what the mic heard; the first key typed replaces it.
        let val = run.listening ? String(run.hits) : '';
        let fresh = run.listening;
        const ov = document.createElement('div');
        ov.className = 'entry';
        ov.innerHTML = `<div class="card entry-box">
            <div class="entry-q">⏱️ Time's up! How many did you do?</div>
            <div class="entry-sub">${run.listening ? `🎤 The mic counted <b>${run.hits}</b>. Fix it if it's wrong, then tap ✅` : 'Type your reps and tap ✅'}</div>
            <div class="entry-display" id="entryVal">${val || '0'}</div>
            <div class="keypad">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
              <button data-k="del" aria-label="Delete">⌫</button><button data-k="0">0</button><button data-k="ok" class="ok" aria-label="Save">✅</button>
            </div>
            <div class="btn-row"><button class="btn small" data-k="skip">Don't save</button></div>
          </div>`;
        const disp = ov.querySelector('#entryVal');
        ov.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-k]');
          if (!b) return;
          const k = b.dataset.k;
          if (fresh && /^\d$/.test(k)) val = '';
          fresh = false;
          if (k === 'del') val = val.slice(0, -1);
          else if (k === 'ok') {
            const reps = parseInt(val || '0', 10);
            if (!reps && !(await confirmBox('Zero reps?', 'Save a score of 0?', 'Save 0'))) return;
            ov.remove();
            const fields = { mode: 'timed', seconds: data.settings.timedSeconds, reps };
            if (run.listening) fields.micHits = run.hits;
            record(fields);
            return;
          } else if (k === 'skip') {
            ov.remove();
            go('home');
            return;
          } else if (val.length < 3) val = (val === '0' ? '' : val) + k;
          disp.textContent = val || '0';
        });
        document.body.appendChild(ov);
        run.overlay = ov;
      };

      const onPress = (e) => {
        e.preventDefault();
        if (run.phase === 'ready') {
          sound.unlock();
          keepAwake.on();
          if (wantMic) startMic();
          const cd = data.settings.countdown;
          if (cd > 0) {
            setPhase('countdown');
            hint.textContent = 'Get ready…';
            run.t0 = performance.now() + cd * 1000;
            run.lastSec = null;
          } else {
            startRunning();
          }
          run.raf = requestAnimationFrame(tick);
        } else if (run.phase === 'running' && mode === 'race') {
          // Tapping still works with sound counting, e.g. if the mic missed a hit.
          // Ignore taps in the first second so a double-tap at the start doesn't stop the clock.
          if (performance.now() - run.t0 > 1000) finishRace();
        }
      };
      btn.addEventListener('pointerdown', onPress);
      // Keyboard support (space / enter) for testing on a computer.
      btn.addEventListener('click', (e) => { if (e.detail === 0) onPress(e); });

      run.isActive = () => run.phase === 'countdown' || run.phase === 'running';
      state.run = run;

      cleanup = () => {
        cancelAnimationFrame(run.raf);
        if (run.overlay) run.overlay.remove();
        mic.stop();
        keepAwake.off();
        state.run = null;
      };
    },
  };

  function record(fields) {
    const pid = state.playerId;
    const before = bestOf(sessionsFor(pid, state.moveId, fields.mode));
    const levelBefore = levelFor(playerCount(pid)).idx;
    const session = { id: uid(), playerId: pid, moveId: state.moveId, date: new Date().toISOString(), ...fields };
    data.sessions.push(session);
    save();
    const isPB = !before || better(session.mode, scoreOf(session), scoreOf(before));
    const levelUp = levelFor(playerCount(pid)).idx > levelBefore;
    state.lastResult = { session, isPB, prevBest: before, levelUp };
    setTimeout(() => {
      go('result');
      if (isPB || levelUp) {
        confetti();
        sound.fanfare();
      }
    }, fields.mode === 'race' ? 900 : 0);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function newDraft() {
    const used = new Set(data.players.map((p) => p.kit));
    const kit = Object.keys(KITS).find((k) => !used.has(k)) || 'blaugrana';
    return { name: '', number: '10', kit };
  }

  function refreshEditorPreview() {
    const d = state.draft;
    const prev = document.getElementById('preview');
    if (prev) prev.innerHTML = `${jerseySVG(d, 200)}<div class="pname" style="font-weight:900;font-size:26px">${esc(d.name || 'Player')}</div>`;
  }

  function readDraftInputs() {
    const n = document.getElementById('pname');
    const num = document.getElementById('pnum');
    if (n) state.draft.name = n.value.trim();
    if (num) state.draft.number = num.value.replace(/\D/g, '').slice(0, 2);
  }

  async function moveDialog(m) {
    const isNew = !m;
    const cur = m || { name: '', icon: '⚽' };
    const html = `<div class="field"><label for="mname">Move name</label><input class="input" id="mname" maxlength="22" value="${esc(cur.name)}" placeholder="e.g. Elastico" autocomplete="off"></div>
      <div class="field"><label>Icon</label><div class="chips" data-single>${MOVE_ICONS.map((i) => `<button class="chip emoji ${i === cur.icon ? 'on' : ''}" data-icon="${i}">${i}</button>`).join('')}</div></div>
      <div class="field"><label>🎤 Count reps by sound <small class="muted">(for moves where the ball hits a wall)</small></label>
        <div class="chips mic-chips" data-single><button class="chip ${cur.mic ? 'on' : ''}" data-mic="1">On</button><button class="chip ${cur.mic ? '' : 'on'}" data-mic="0">Off</button></div></div>`;
    const buttons = [{ label: 'Cancel', value: 'cancel' }];
    if (!isNew) buttons.push({ label: 'Delete', value: 'delete', cls: 'danger' });
    buttons.push({ label: 'Save', value: 'save', cls: 'primary' });
    const r = await showModal({ title: isNew ? 'New move' : 'Edit move', html, buttons });
    if (r.value === 'save') {
      const name = r.body.querySelector('#mname').value.trim();
      const icon = r.body.querySelector('.chip.emoji.on')?.dataset.icon || '⚽';
      const micOn = r.body.querySelector('.mic-chips .chip.on')?.dataset.mic === '1';
      if (!name) { toast('Give the move a name'); return; }
      if (isNew) data.moves.push({ id: uid(), name, icon, mic: micOn });
      else Object.assign(m, { name, icon, mic: micOn });
      save();
      render();
    } else if (r.value === 'delete') {
      const n = data.sessions.filter((s) => s.moveId === m.id).length;
      if (await confirmBox(`Delete "${m.name}"?`, n ? `This also deletes ${n} saved session${n === 1 ? '' : 's'} for this move (for every player).` : 'This move has no saved sessions.', 'Delete', true)) {
        data.moves = data.moves.filter((x) => x.id !== m.id);
        data.sessions = data.sessions.filter((s) => s.moveId !== m.id);
        save();
        render();
      }
    }
  }

  async function exportData() {
    const json = JSON.stringify(data, null, 2);
    const name = `golazo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Golazo backup' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        const parsed = JSON.parse(await f.text());
        if (!Array.isArray(parsed.players) || !Array.isArray(parsed.sessions)) throw new Error('bad file');
        const ok = await confirmBox('Restore backup?', `This replaces everything on this iPad with the backup (${parsed.players.length} players, ${parsed.sessions.length} sessions).`, 'Restore', true);
        if (!ok) return;
        data = normalize(parsed);
        save();
        toast('✅ Backup restored');
        render();
      } catch (e) {
        toast('⚠️ That file is not a Golazo backup');
      }
    };
    input.click();
  }

  const ACTIONS = {
    toPlayers: () => go('players'),
    family: () => go('family'),
    addPlayerTile: () => go('editPlayer', { editPlayerId: null, editFrom: 'players', draft: newDraft() }),
    firstPlayer: () => go('editPlayer', { editPlayerId: null, editFrom: 'players', draft: newDraft() }),
    newPlayer: () => go('editPlayer', { editPlayerId: null, editFrom: 'parent', draft: newDraft() }),
    editPlayer: (el) => {
      const p = player(el.dataset.id);
      if (p) go('editPlayer', { editPlayerId: p.id, editFrom: 'parent', draft: { name: p.name, number: p.number, kit: p.kit } });
    },
    cancelEdit: () => go(state.editFrom),
    draftKit: (el) => {
      readDraftInputs();
      state.draft.kit = el.dataset.kit;
      document.querySelectorAll('.kit-opt').forEach((k) => k.classList.toggle('on', k === el));
      refreshEditorPreview();
    },
    draftNum: (el) => {
      state.draft.number = el.dataset.num;
      document.getElementById('pnum').value = el.dataset.num;
      document.querySelectorAll('[data-action="draftNum"]').forEach((c) => c.classList.toggle('on', c === el));
      refreshEditorPreview();
    },
    savePlayer: () => {
      readDraftInputs();
      const d = state.draft;
      if (!d.name) { toast('Type a name first'); document.getElementById('pname').focus(); return; }
      if (state.editPlayerId) {
        Object.assign(player(state.editPlayerId), d);
      } else {
        data.players.push({ id: uid(), ...d, lastMode: 'timed' });
      }
      save();
      go(state.editFrom);
    },
    deletePlayer: async () => {
      const p = player(state.editPlayerId);
      const n = playerCount(p.id);
      if (await confirmBox(`Delete ${p.name}?`, `This deletes ${p.name} and all ${n} of their saved sessions. This can't be undone.`, 'Delete', true)) {
        data.players = data.players.filter((x) => x.id !== p.id);
        data.sessions = data.sessions.filter((s) => s.playerId !== p.id);
        save();
        go('parent');
      }
    },
    pickPlayer: (el) => {
      const p = player(el.dataset.id);
      go('home', { playerId: p.id, mode: p.lastMode || 'timed' });
    },
    pickMode: (el) => {
      state.mode = el.dataset.mode;
      const p = player(state.playerId);
      p.lastMode = state.mode;
      save();
      render();
    },
    pickMove: (el) => go('train', { moveId: el.dataset.id }),
    leaveTrain: async () => {
      if (state.run && state.run.isActive()) {
        if (!(await confirmBox('Stop this round?', "The timer is running. This round won't be saved.", 'Stop', true))) return;
      }
      go('home');
    },
    again: () => go('train'),
    backHome: () => go('home', { progressMove: null }),
    progress: () => go('progress', { progressMove: null, progressMode: state.mode }),
    progressMove: (el) => go('progress', { progressMove: el.dataset.id }),
    progressBack: () => go('progress', { progressMove: null }),
    trainThis: () => go('train', { moveId: state.progressMove, mode: state.progressMode }),
    setView: (el) => { state[el.dataset.key] = el.dataset.val; render(); },
    chartTip: (el) => {
      const svg = el.closest('svg');
      const tip = svg.querySelector('#tip');
      const text = tip.querySelector('text');
      const rect = tip.querySelector('rect');
      text.textContent = el.dataset.label;
      tip.style.display = '';
      const w = text.getComputedTextLength() + 20;
      const vbW = svg.viewBox.baseVal.width;
      const cx = Math.min(Math.max(+el.dataset.x - w / 2, 0), vbW - w);
      const cy = Math.max(+el.dataset.y - 44, 0);
      rect.setAttribute('width', w);
      rect.setAttribute('x', 0);
      text.setAttribute('x', 10);
      tip.setAttribute('transform', `translate(${cx} ${cy})`);
    },
    deleteSession: async (el) => {
      const s = data.sessions.find((x) => x.id === el.dataset.id);
      if (!s) return;
      if (await confirmBox('Delete this score?', `${scoreText(s)} ${scoreUnit(s)} from ${fmtDate(s.date)}`, 'Delete', true)) {
        data.sessions = data.sessions.filter((x) => x.id !== s.id);
        save();
        render();
      }
    },
    newMove: () => moveDialog(null),
    editMove: (el) => moveDialog(move(el.dataset.id)),
    setting: (el) => {
      const key = el.dataset.key;
      const raw = el.dataset.val;
      data.settings[key] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
      save();
      mic.configure();
      render();
    },
    micTest: () => go('micTest'),
    micTestBack: () => go('parent'),
    micToggle: async (el) => {
      if (mic.stream) {
        mic.stop();
        el.textContent = '🎤 Start listening';
        document.getElementById('meterFill').style.width = '0%';
        return;
      }
      try {
        await mic.start();
      } catch (e) {
        toast('🎤 Could not use the microphone. Allow it in Settings → Safari (or the app) → Microphone.', 4000);
        return;
      }
      if (state.view !== 'micTest') { mic.stop(); return; }
      el.textContent = '⏹ Stop listening';
      let hits = 0;
      mic.onHit = () => {
        hits++;
        const h = document.getElementById('micHits');
        h.textContent = hits;
        h.classList.remove('bump');
        void h.offsetWidth;
        h.classList.add('bump');
      };
      mic.onLevel = (lvl) => {
        const f = document.getElementById('meterFill');
        if (!f) return;
        f.style.width = `${Math.min(100, Math.sqrt(lvl) * 100).toFixed(1)}%`;
        f.classList.toggle('over', lvl > mic.threshold());
      };
      state.micReset = () => { hits = 0; };
    },
    micReset: () => {
      if (state.micReset) state.micReset();
      document.getElementById('micHits').textContent = '0';
    },
    micSens: (el) => {
      data.settings.micSensitivity = Number(el.dataset.val);
      save();
      mic.configure();
      document.querySelectorAll('[data-action="micSens"]').forEach((c) => c.classList.toggle('on', c === el));
      document.getElementById('meterMark').style.left = `${(Math.sqrt(mic.threshold()) * 100).toFixed(1)}%`;
    },
    exportData,
    importData,
    resetAll: async () => {
      if (!(await confirmBox('Erase everything?', 'All players, moves and scores on this iPad will be deleted. Save a backup first if you might want them back.', 'Erase', true))) return;
      if (!(await confirmBox('Are you really sure?', 'This cannot be undone.', 'Yes, erase', true))) return;
      data = defaultData();
      save();
      go('players');
    },
  };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !app.contains(el)) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  // Live jersey preview while typing in the player editor.
  app.addEventListener('input', (e) => {
    if (state.view !== 'editPlayer' || !e.target.matches('#pname, #pnum')) return;
    readDraftInputs();
    refreshEditorPreview();
  });

  // Press-and-hold (1.5 s) to open the parent corner, so kids don't wander in by accident.
  let holdTimer = null;
  app.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-hold]');
    if (!el) return;
    el.classList.add('holding');
    holdTimer = setTimeout(() => {
      el.classList.remove('holding');
      holdTimer = null;
      go(el.dataset.hold);
    }, 1500);
  });
  const cancelHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      document.querySelectorAll('.holding').forEach((x) => x.classList.remove('holding'));
      toast('Grown-ups: press and hold ⚙️ to open settings', 1800);
    }
  };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((t) => app.addEventListener(t, cancelHold));

  // Stop iOS pinch-zoom from interfering with taps.
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  render();
})();
