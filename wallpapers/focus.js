// Focus: a Pomodoro timer. Focus for 25 minutes, then a short break; every
// fourth break is a long one. The lengths can be changed under the timer. It
// keeps going if you reload or switch wallpaper (it remembers when it ends),
// chimes when time's up, and shows the time left in the tab's title.
// Warm embers drift up while you focus; cool bubbles during breaks.

(function () {
  const { clamp, rgba, hex, mix } = WP;
  const KEY = "wp-focus";
  const MODES = {
    focus: { name: "Focus", color: hex("#ff8a4c") },
    short: { name: "Short break", color: hex("#3fd4b0") },
    long: { name: "Long break", color: hex("#5aa9ff") }
  };
  const LIMITS = { focus: [5, 90, 5], short: [1, 30, 1], long: [5, 45, 5] };
  const DEFAULTS = { mode: "focus", running: false, endsAt: 0, left: 25 * 60000, done: 0, lengths: { focus: 25, short: 5, long: 15 } };

  function loadState() {
    const saved = WP.loadJSON(KEY, null);
    const state = Object.assign({}, DEFAULTS, saved || {});
    state.lengths = Object.assign({}, DEFAULTS.lengths, (saved && saved.lengths) || {});
    if (!MODES[state.mode]) state.mode = "focus";
    return state;
  }

  function chime() {
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.28, 0.56].forEach((at, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = [660, 880, 1320][i];
        gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.9);
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + at);
        osc.stop(audio.currentTime + at + 1);
      });
      setTimeout(() => audio.close(), 2000);
    } catch (e) { /* no sound */ }
  }

  const scene = {
    maxDpr: 1.25,
    warm: 6,
    stillTime: 5,
    setup(s) {
      s.parts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 3, speed: 0.01 + Math.random() * 0.03, sway: Math.random() * 6.28 }));
      s.tone = MODES.focus.color;
    },
    step(s, dt) {
      const target = (MODES[s.data.mode] || MODES.focus).color;
      s.tone = mix(s.tone, target, Math.min(1, dt * 1.5));
      const pace = s.data.running ? 1 : 0.35;
      s.parts.forEach(p => {
        p.y -= p.speed * pace * dt;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      const tone = s.tone;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, rgba(mix(tone, [0, 0, 0], 0.92)));
      bg.addColorStop(1, rgba(mix(tone, [0, 0, 0], 0.78)));
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // a slow breathing glow where the timer sits
      const breathe = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / 8));
      const cy = h * 0.5;
      const r = Math.min(w, h) * (0.42 + breathe * 0.06);
      const glow = g.createRadialGradient(w / 2, cy, 0, w / 2, cy, r);
      glow.addColorStop(0, rgba(tone, 0.22 + breathe * 0.1));
      glow.addColorStop(1, rgba(tone, 0));
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      const breakTime = s.data.mode !== "focus";
      s.parts.forEach(p => {
        const x = p.x * w + Math.sin(t * 0.5 + p.sway) * 20;
        const y = p.y * h;
        const fade = clamp(Math.min(p.y, 1 - p.y) * 5, 0, 1);
        if (breakTime) {
          g.strokeStyle = rgba(mix(tone, [255, 255, 255], 0.4), 0.35 * fade);
          g.lineWidth = 1;
          g.beginPath();
          g.arc(x, y, p.r * 2, 0, Math.PI * 2);
          g.stroke();
        } else {
          g.fillStyle = rgba(mix(tone, [255, 230, 160], 0.4), 0.6 * fade);
          g.beginPath();
          g.arc(x, y, p.r * 0.8, 0, Math.PI * 2);
          g.fill();
        }
      });
    }
  };

  WP.register({
    id: "focus",
    name: "Focus",
    group: "tools",
    icon: "⏱️",
    layout: "tool",
    blurb: "A Pomodoro timer: 25 minutes of focus, then a break. It chimes when time's up.",
    quotes: "focus",
    scene,
    mount(ctx) {
      let state = loadState();
      const view = ctx.canvas(scene, { mode: state.mode, running: state.running });
      const title = document.title;
      ctx.onRetire(() => { document.title = title; });

      const R = 92;
      const CIRC = 2 * Math.PI * R;
      const box = WP.el("div", "fo-box");
      const tabs = WP.el("div", "fo-tabs");
      tabs.setAttribute("role", "tablist");
      const tabButtons = {};
      Object.entries(MODES).forEach(([key, mode]) => {
        const b = WP.el("button", "fo-tab", mode.name);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.addEventListener("click", () => setMode(key, false));
        tabButtons[key] = b;
        tabs.appendChild(b);
      });

      const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      ring.setAttribute("viewBox", "0 0 220 220");
      ring.setAttribute("class", "fo-ring");
      ring.innerHTML = '<circle cx="110" cy="110" r="' + R + '" class="fo-track"/><circle cx="110" cy="110" r="' + R + '" class="fo-bar" transform="rotate(-90 110 110)"/>';
      const bar = ring.querySelector(".fo-bar");
      bar.style.strokeDasharray = CIRC;
      const face = WP.el("div", "fo-face");
      const time = WP.el("div", "fo-time", "25:00");
      const label = WP.el("div", "fo-label", "Focus");
      face.append(time, label);
      const dial = WP.el("div", "fo-dial");
      dial.append(ring, face);

      const controls = WP.el("div", "fo-controls");
      const start = WP.el("button", "fo-btn fo-btn--main", "Start");
      const reset = WP.el("button", "fo-btn", "Reset");
      const skip = WP.el("button", "fo-btn", "Skip");
      [start, reset, skip].forEach(b => { b.type = "button"; });
      controls.append(reset, start, skip);

      const dots = WP.el("div", "fo-dots");
      const lengths = WP.el("div", "fo-lengths");
      const lengthValues = {};
      Object.entries(MODES).forEach(([key, mode]) => {
        const item = WP.el("div", "fo-length");
        const minus = WP.el("button", "fo-step", "−");
        const plus = WP.el("button", "fo-step", "+");
        const value = WP.el("span", "fo-length-value");
        [minus, plus].forEach(b => { b.type = "button"; });
        minus.setAttribute("aria-label", "Shorter " + mode.name.toLowerCase());
        plus.setAttribute("aria-label", "Longer " + mode.name.toLowerCase());
        minus.addEventListener("click", () => changeLength(key, -1));
        plus.addEventListener("click", () => changeLength(key, 1));
        item.append(WP.el("span", "fo-length-name", mode.name), minus, value, plus);
        lengthValues[key] = value;
        lengths.appendChild(item);
      });
      box.append(tabs, dial, controls, dots, lengths);
      ctx.info(box);

      let note = null; // "Focus done!" for a few seconds

      function save() {
        WP.saveJSON(KEY, state);
      }

      function full(mode) {
        return state.lengths[mode] * 60000;
      }

      function left() {
        return state.running ? Math.max(0, state.endsAt - Date.now()) : state.left;
      }

      function nextMode() {
        if (state.mode !== "focus") return "focus";
        return (state.done + 1) % 4 === 0 ? "long" : "short";
      }

      function setMode(mode, finished) {
        if (finished && state.mode === "focus") state.done += 1;
        state.mode = mode;
        state.running = false;
        state.left = full(mode);
        save();
        render();
      }

      function changeLength(mode, direction) {
        const [lo, hi, stepBy] = LIMITS[mode];
        state.lengths[mode] = clamp(state.lengths[mode] + direction * stepBy, lo, hi);
        if (mode === state.mode && !state.running) state.left = full(mode);
        save();
        render();
      }

      start.addEventListener("click", () => {
        if (state.running) {
          state.left = left();
          state.running = false;
        } else {
          if (state.left <= 0) state.left = full(state.mode);
          state.endsAt = Date.now() + state.left;
          state.running = true;
        }
        save();
        render();
      });
      reset.addEventListener("click", () => {
        state.running = false;
        state.left = full(state.mode);
        save();
        render();
      });
      skip.addEventListener("click", () => setMode(nextMode(), true));

      function render() {
        const ms = left();
        const total = full(state.mode);
        const secs = Math.ceil(ms / 1000);
        const text = WP.pad(Math.floor(secs / 60)) + ":" + WP.pad(secs % 60);
        if (time.textContent !== text) time.textContent = text;
        label.textContent = note && Date.now() < note.until
          ? note.text
          : MODES[state.mode].name + (state.running ? "" : ms < total ? " · paused" : "");
        bar.style.strokeDashoffset = String(CIRC * (1 - clamp(ms / total, 0, 1)));
        box.dataset.mode = state.mode;
        start.textContent = state.running ? "Pause" : ms < total && ms > 0 ? "Resume" : "Start";
        Object.entries(tabButtons).forEach(([key, b]) => b.setAttribute("aria-selected", String(key === state.mode)));
        Object.entries(lengthValues).forEach(([key, v]) => { v.textContent = state.lengths[key] + " min"; });
        const round = state.done % 4;
        dots.replaceChildren(...[0, 1, 2, 3].map(i => WP.el("span", i < round ? "fo-dot fo-dot--done" : "fo-dot")));
        dots.title = state.done + " focus session" + (state.done === 1 ? "" : "s") + " done";
        document.title = state.running ? text + " · " + MODES[state.mode].name : title;
        view.setData({ mode: state.mode, running: state.running });
      }

      function tick() {
        if (state.running && Date.now() >= state.endsAt) {
          const was = state.mode;
          note = { text: MODES[was].name + " done! " + MODES[nextMode()].name + " next", until: Date.now() + 6000 };
          setMode(nextMode(), true);
          chime();
          return;
        }
        render();
      }

      // If it ran out while the page was closed, just move on (no chime).
      if (state.running && Date.now() >= state.endsAt) setMode(nextMode(), true);
      render();
      ctx.every(250, tick, false);
    }
  });
})();
