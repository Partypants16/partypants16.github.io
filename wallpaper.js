// The Wallpaper page: a full-screen wallpaper behind a clock, the date and a quote.
//
// Each wallpaper is its own file in wallpapers/ that calls WP.register({...});
// wallpapers/README.md says how to add one. This file is what they share:
//   - the picker (🎨), remembering the choice, and ?w=<id> links to one
//   - the clock, the date and the daily quote (quotes live in wallpapers/quotes.js)
//   - still pictures instead of motion on phones / data saver / reduced motion
//   - ambient mode (⛶ or F): full screen, controls hide, the screen stays on
//   - the "Wallpaper" section of the settings panel
//   - helpers: canvas scenes, cached JSON, times and countdowns, sun and moon maths
//
// Loaded with defer, before the wallpaper files, so WP exists when they register.

(function () {
  "use strict";

  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const DEFAULT_ID = "weather";
  const MELBOURNE = { name: "Melbourne", lat: -37.8136, lon: 144.9631, tz: "Australia/Melbourne" };

  const GROUPS = [
    { key: "live", title: "Live", hint: "Follow real things as they happen" },
    { key: "drawn", title: "Drawn", hint: "Drawn in code. Most react to your mouse or finger" },
    { key: "video", title: "Video", hint: "Looping videos" },
    { key: "tools", title: "Tools", hint: "Wallpapers that do something" }
  ];

  // ---------- Storage (blocked storage just means nothing is remembered) ----------

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) { /* private browsing: lasts until the page closes */ }
  }

  function loadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    save(key, JSON.stringify(value));
  }

  // ---------- Settings (the panel's "Wallpaper" section) ----------

  const SETTINGS = {
    clock: { key: "wp-clock", options: ["24", "12"], fallback: "24" },
    seconds: { key: "wp-seconds", options: ["off", "on"], fallback: "off" },
    quote: { key: "wp-quote", options: ["daily", "motto", "off"], fallback: "daily" },
    dim: { key: "wp-dim", options: ["light", "medium", "strong"], fallback: "medium" },
    motion: { key: "wp-motion", options: ["auto", "move", "still"], fallback: "auto" }
  };
  const DIM = { light: 0.12, medium: 0.3, strong: 0.5 };

  function setting(name) {
    const spec = SETTINGS[name];
    const value = load(spec.key, spec.fallback);
    return spec.options.includes(value) ? value : spec.fallback;
  }

  function setSetting(name, value) {
    save(SETTINGS[name].key, value);
    if (name === "clock" || name === "seconds") tick();
    if (name === "quote") renderQuote();
    if (name === "dim") applyDim();
    if (name === "motion" && current) show(current.def.id, { instant: true });
    document.dispatchEvent(new CustomEvent("wallpapersetting", { detail: { name, value } }));
  }

  function applyDim() {
    root.style.setProperty("--wp-dim", DIM[setting("dim")]);
  }

  if (typeof SETTINGS_SECTIONS !== "undefined") {
    SETTINGS_SECTIONS.unshift({ title: "Wallpaper", build: buildSettings });
  }

  function buildSettings() {
    return [
      segmentedRow({
        id: "wp-setting-clock",
        label: "Clock",
        options: [{ key: "24", label: "24-hour" }, { key: "12", label: "12-hour" }],
        get: () => setting("clock"),
        set: value => setSetting("clock", value)
      }),
      switchRow({
        id: "wp-setting-seconds",
        label: "Show seconds",
        get: () => setting("seconds") === "on",
        set: on => setSetting("seconds", on ? "on" : "off")
      }),
      segmentedRow({
        id: "wp-setting-quote",
        label: "Quote",
        hint: "Daily picks a new one each day to suit the wallpaper. LOVELESS always shows its own lines.",
        options: [{ key: "daily", label: "Daily" }, { key: "motto", label: "My motto" }, { key: "off", label: "Hidden" }],
        get: () => setting("quote"),
        set: value => setSetting("quote", value)
      }),
      segmentedRow({
        id: "wp-setting-dim",
        label: "Darken the wallpaper",
        hint: "More makes the clock easier to read.",
        options: [{ key: "light", label: "Less" }, { key: "medium", label: "Medium" }, { key: "strong", label: "More" }],
        get: () => setting("dim"),
        set: value => setSetting("dim", value)
      }),
      segmentedRow({
        id: "wp-setting-motion",
        label: "Movement",
        hint: "Auto shows a still picture instead of the videos on phones and with data saver, and stops everything moving when your device asks for less motion.",
        options: [{ key: "auto", label: "Auto" }, { key: "move", label: "Moving" }, { key: "still", label: "Still" }],
        get: () => setting("motion"),
        set: value => setSetting("motion", value)
      })
    ];
  }

  // ---------- Still or moving ----------

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const phone = window.matchMedia("(max-width: 760px), (hover: none) and (pointer: coarse)");

  function saveData() {
    return !!(navigator.connection && navigator.connection.saveData);
  }

  function isStill(def) {
    const mode = setting("motion");
    if (mode === "still") return true;
    if (mode === "move") return false;
    if (reducedMotion.matches) return true;
    return def.group === "video" && (phone.matches || saveData());
  }

  // ---------- Small helpers, shared with the wallpapers ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // A repeatable random number generator: the same seed draws the same scene.
  function rng(seed) {
    let a = typeof seed === "number" ? seed >>> 0 : hash(String(seed));
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Colours as [r, g, b]; mix() blends two, rgba() writes one for canvas.
  function hex(code) {
    const n = parseInt(code.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function rgba(c, alpha) {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + (alpha === undefined ? 1 : alpha) + ")";
  }

  // Picks a colour from stops [[position, [r,g,b]], ...] sorted by position.
  function ramp(stops, x) {
    if (x <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (x <= stops[i][0]) {
        const [p0, c0] = stops[i - 1];
        const [p1, c1] = stops[i];
        return mix(c0, c1, (x - p0) / (p1 - p0));
      }
    }
    return stops[stops.length - 1][1];
  }

  // ---------- Times and countdowns ----------

  function hour12() {
    return setting("clock") === "12";
  }

  function fmtTime(date, options) {
    return date.toLocaleTimeString(undefined, Object.assign({ hour: "numeric", minute: "2-digit", hour12: hour12() }, options));
  }

  function fmtDay(date, options) {
    return date.toLocaleDateString(undefined, Object.assign({ weekday: "short", day: "numeric", month: "short" }, options));
  }

  function fmtWhen(date, options) {
    return fmtDay(date, options) + ", " + fmtTime(date, options);
  }

  // 2 h 10 min / 45 min / 3 days
  function span(ms) {
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 1) return "less than a minute";
    if (minutes < 60) return minutes + " min";
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return hours + " h" + (minutes % 60 ? " " + (minutes % 60) + " min" : "");
    return Math.round(hours / 24) + " days";
  }

  function ago(date) {
    const ms = Date.now() - date;
    return ms < 60000 ? "just now" : span(ms) + " ago";
  }

  function countdownParts(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor(total / 3600) % 24,
      minutes: Math.floor(total / 60) % 60,
      seconds: total % 60
    };
  }

  // Minutes a time zone is ahead of UTC at a moment.
  function tzOffset(date, tz) {
    const p = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(date).forEach(part => { p[part.type] = part.value; });
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  }

  // Midnight at the start of the day `date` falls on, in time zone tz.
  function zonedMidnight(date, tz) {
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date).forEach(part => { p[part.type] = part.value; });
    const guess = Date.UTC(+p.year, +p.month - 1, +p.day);
    return new Date(guess - tzOffset(new Date(guess), tz) * 60000);
  }

  // ---------- Sun and moon ----------

  const RAD = Math.PI / 180;

  // Where the sun is: altitude above the horizon and azimuth from north, in degrees.
  function sunPosition(date, lat, lon) {
    const d = date / 86400000 + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
    const ha = (gmst * 15 + lon) * RAD - ra;
    const phi = lat * RAD;
    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
    const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
    return { altitude: alt / RAD, azimuth: (az / RAD + 180 + 360) % 360 };
  }

  // Moments between from and to when the sun's altitude crosses `degrees`.
  function sunCrossings(from, to, place, degrees) {
    const found = [];
    const step = 120000;
    let prevTime = from.getTime();
    let prev = sunPosition(from, place.lat, place.lon).altitude - degrees;
    for (let t = prevTime + step; t <= to.getTime(); t += step) {
      const now = sunPosition(new Date(t), place.lat, place.lon).altitude - degrees;
      if ((prev < 0) !== (now < 0)) {
        const at = prevTime + step * (prev / (prev - now));
        found.push({ at: new Date(at), rising: now > prev });
      }
      prev = now;
      prevTime = t;
    }
    return found;
  }

  // Sunrise, sunset and solar noon for the local day `date` falls on at `place`.
  function sunTimes(date, place) {
    const start = zonedMidnight(date, place.tz);
    const end = new Date(start.getTime() + 86400000);
    const crossings = sunCrossings(start, end, place, -0.833);
    const rise = crossings.find(c => c.rising);
    const set = crossings.find(c => !c.rising);
    let noon = start;
    let best = -90;
    for (let t = start.getTime(); t < end.getTime(); t += 300000) {
      const alt = sunPosition(new Date(t), place.lat, place.lon).altitude;
      if (alt > best) { best = alt; noon = new Date(t); }
    }
    return { rise: rise ? rise.at : null, set: set ? set.at : null, noon, start, end };
  }

  // 0 = new moon, 0.25 first quarter, 0.5 full, 0.75 last quarter.
  function moonPhase(date) {
    const synodic = 29.530588853;
    const age = ((date - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % synodic;
    return (age < 0 ? age + synodic : age) / synodic;
  }

  // Draws the moon as it looks tonight. In the southern hemisphere a waxing
  // moon is lit on the left.
  function drawMoon(g, x, y, r, phase, southern) {
    const waxing = phase < 0.5;
    const k = Math.cos(phase * 2 * Math.PI); // 1 at new, -1 at full
    g.save();
    g.translate(x, y);
    g.scale((waxing ? 1 : -1) * (southern ? -1 : 1), 1);
    g.shadowColor = "rgba(255, 250, 225, 0.5)";
    g.shadowBlur = r * 1.4;
    g.fillStyle = "rgba(30, 36, 58, 0.55)";
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = r * 0.9;
    g.fillStyle = "#f4f1e4";
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, Math.max(0.01, r * Math.abs(k)), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    g.fill();
    g.restore();
  }

  // Stars: [{x, y (0..1), r, phase, bright}], the same for the same seed.
  function makeStars(count, seed) {
    const random = rng(seed);
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({ x: random(), y: random(), r: 0.4 + random() * random() * 1.6, phase: random() * 6.28, bright: 0.35 + random() * 0.65 });
    }
    return stars;
  }

  function drawStars(g, stars, w, h, t, alpha, maxY) {
    if (alpha <= 0.01) return;
    const limit = maxY === undefined ? 1 : maxY;
    stars.forEach(star => {
      if (star.y > limit) return;
      const twinkle = 0.65 + 0.35 * Math.sin(t * (0.6 + star.bright) + star.phase);
      g.fillStyle = "rgba(255, 255, 255, " + (alpha * star.bright * twinkle).toFixed(3) + ")";
      g.beginPath();
      g.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
      g.fill();
    });
  }

  // A soft, puffy cloud drawn once to its own canvas, to stamp onto scenes.
  function cloudSprite(width, seed, color, shade) {
    const random = rng(seed);
    const height = width * 0.42;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const g = canvas.getContext("2d");
    const base = color || [255, 255, 255];
    const under = shade || mix(base, [90, 100, 120], 0.45);
    const puffs = 9 + Math.floor(random() * 6);
    for (let i = 0; i < puffs; i++) {
      const px = width * (0.15 + random() * 0.7);
      const py = height * (0.45 + random() * 0.25 - Math.sin((px / width) * Math.PI) * 0.18);
      const r = width * (0.09 + random() * 0.12) * Math.sin((px / width) * Math.PI * 0.9 + 0.15);
      const grad = g.createRadialGradient(px, py - r * 0.3, r * 0.1, px, py, r);
      const c = mix(under, base, clamp(1 - py / height + 0.35, 0, 1));
      grad.addColorStop(0, rgba(c, 0.9));
      grad.addColorStop(0.6, rgba(c, 0.55));
      grad.addColorStop(1, rgba(c, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
    return canvas;
  }

  // ---------- Cached JSON ----------

  const memoryCache = new Map();

  // Resolves with { data, at, stale }. Fresh copies within ttl come from the
  // cache; if the request fails, an older copy is better than nothing.
  function getJSON(url, options) {
    const opts = Object.assign({ ttl: 10 * 60000, timeout: 10000 }, options);
    const storeKey = opts.cacheKey ? "wp-cache:" + opts.cacheKey : null;
    let cached = memoryCache.get(url);
    if (!cached && storeKey) {
      const stored = loadJSON(storeKey, null);
      if (stored && stored.url === url) cached = stored;
    }
    if (cached && Date.now() - cached.at < opts.ttl) return Promise.resolve(Object.assign({ stale: false }, cached));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout);
    return fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(data => {
        const entry = { url, data, at: Date.now() };
        memoryCache.set(url, entry);
        if (storeKey) saveJSON(storeKey, entry);
        return Object.assign({ stale: false }, entry);
      })
      .catch(error => {
        if (cached) return Object.assign({}, cached, { stale: true });
        throw error;
      })
      .finally(() => clearTimeout(timer));
  }

  function cached(cacheKey) {
    const stored = loadJSON("wp-cache:" + cacheKey, null);
    return stored ? stored.data : null;
  }

  // ---------- Pointer (shared by every canvas scene) ----------

  // nx/ny: -1..1 across the window. down: held on the wallpaper itself
  // (not on a button, link, field, the picker or the settings panel).
  const pointer = { x: -1, y: -1, nx: 0, ny: 0, down: false, inside: false, moved: 0 };
  const UI = "a, button, input, select, textarea, label, .modal, .settings-panel, .wp-widget, header, .wp-buttons";

  window.addEventListener("pointermove", event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.inside = true;
    pointer.moved = performance.now();
  }, { passive: true });
  window.addEventListener("pointerdown", event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.inside = true;
    pointer.down = !(event.target.closest && event.target.closest(UI));
  });
  ["pointerup", "pointercancel", "blur"].forEach(type => window.addEventListener(type, () => { pointer.down = false; }));
  document.addEventListener("pointerleave", () => { pointer.inside = false; pointer.down = false; });

  // ---------- Canvas scenes ----------
  //
  // A scene is { setup(s), resize(s), step(s, dt), draw(s, t, dt), maxDpr,
  // scale, warm, stillTime }. Only draw is required. s holds the 2D context
  // (s.g), the size in CSS pixels (s.w, s.h), s.data (live data), s.pointer,
  // s.look (the pointer, smoothed, -1..1), s.t, s.still and s.thumb.

  function sceneState(g, canvas, w, h, ratio, extra) {
    return Object.assign({ g, canvas, w, h, ratio, data: {}, pointer, look: { x: 0, y: 0 }, t: 0, dt: 1 / 60, still: false, thumb: false }, extra);
  }

  function warmUp(scene, s) {
    if (!scene.step || !scene.warm) return;
    const dt = 1 / 30;
    for (let i = 0; i < scene.warm * 30; i++) {
      s.t += dt;
      scene.step(s, dt);
    }
  }

  function startScene(container, scene, options) {
    const opts = options || {};
    const canvas = el("canvas", "wp-canvas");
    container.appendChild(canvas);
    const g = canvas.getContext("2d");
    const s = sceneState(g, canvas, 1, 1, 1, { data: opts.data || {}, still: !!opts.still });
    let running = true;
    let started = false;
    let last = 0;
    let raf = 0;

    function size() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, scene.maxDpr || 1.5) * (scene.scale || 1);
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      s.w = w;
      s.h = h;
      s.ratio = ratio;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (started) {
        if (scene.resize) scene.resize(s);
        if (s.still) drawOnce();
      }
    }

    function drawOnce() {
      g.setTransform(s.ratio, 0, 0, s.ratio, 0, 0);
      scene.draw(s, s.t, 0);
    }

    function frame(now) {
      const dt = Math.min(0.1, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      s.t += dt;
      s.dt = dt;
      const k = 1 - Math.pow(0.02, dt);
      s.look.x += ((pointer.inside ? pointer.nx : 0) - s.look.x) * k;
      s.look.y += ((pointer.inside ? pointer.ny : 0) - s.look.y) * k;
      if (scene.step) scene.step(s, dt);
      scene.draw(s, s.t, dt);
    }

    function loop(now) {
      if (!running) return;
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    size();
    if (scene.setup) scene.setup(s);
    if (scene.resize) scene.resize(s);
    if (scene.data) scene.data(s);
    started = true;
    const observer = new ResizeObserver(size);
    observer.observe(container);

    if (s.still) {
      s.t = scene.stillTime || 0;
      warmUp(scene, s);
      drawOnce();
    } else {
      warmUp(scene, s);
      raf = requestAnimationFrame(loop);
    }

    return {
      s,
      canvas,
      setData(data) {
        Object.assign(s.data, data);
        if (scene.data) scene.data(s);
        if (s.still && running) drawOnce();
      },
      redraw() {
        if (s.still && running) drawOnce();
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        observer.disconnect();
        canvas.remove();
      }
    };
  }

  // Draws one frame of a scene into a small canvas, as if on a 1280 x 720 screen.
  function renderSceneThumb(scene, canvas, data) {
    const W = 1280;
    const H = 720;
    const g = canvas.getContext("2d");
    const scale = canvas.width / W;
    const s = sceneState(g, canvas, W, H, scale, { data: data || {}, still: true, thumb: true });
    g.setTransform(scale, 0, 0, scale, 0, 0);
    if (scene.setup) scene.setup(s);
    if (scene.resize) scene.resize(s);
    if (scene.data) scene.data(s);
    s.t = scene.stillTime || 0;
    warmUp(scene, s);
    g.setTransform(scale, 0, 0, scale, 0, 0);
    scene.draw(s, s.t, 0);
  }

  // ---------- Page parts ----------

  let stage, clockEl, dateEl, widget, quoteEl, modal, pickerBody, header;
  const wallpapers = [];
  const byId = Object.create(null);
  let current = null; // { def, layer, ctx }
  let quoteOverride = null;

  function setLayout(name) {
    root.dataset.layout = name || "clock";
  }

  // Everything a wallpaper gets while it's showing. Timers, listeners and
  // requests made through ctx stop by themselves when another wallpaper is picked.
  function makeContext(def, layer) {
    const timers = new Set();
    const intervals = new Set();
    const listeners = [];
    const onRetire = [];
    const onStop = [];

    const ctx = {
      def, layer, widget, params,
      alive: true,
      still: isStill(def),
      place: MELBOURNE,

      setLayout(name) {
        if (ctx.alive) setLayout(name);
      },
      // Fill the info area under the date: text, nodes, or null to hide it.
      info(...nodes) {
        if (!ctx.alive) return;
        widget.replaceChildren();
        nodes.flat().forEach(node => {
          if (node === null || node === undefined || node === false) return;
          widget.appendChild(typeof node === "string" ? el("p", "wp-line", node) : node);
        });
        widget.hidden = !widget.childNodes.length;
      },
      setQuote(quote) {
        if (!ctx.alive) return;
        quoteOverride = quote;
        renderQuote();
      },
      every(ms, fn, now) {
        if (now !== false) fn();
        const id = setInterval(() => { if (ctx.alive) fn(); }, ms);
        intervals.add(id);
        return id;
      },
      after(ms, fn) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (ctx.alive) fn();
        }, ms);
        timers.add(id);
        return id;
      },
      on(target, type, fn, options) {
        target.addEventListener(type, fn, options);
        listeners.push([target, type, fn, options]);
      },
      // Never resolves once the wallpaper has gone, so late answers can't write over the next one.
      guard(promise) {
        return new Promise((resolve, reject) => {
          promise.then(value => { if (ctx.alive) resolve(value); }, error => { if (ctx.alive) reject(error); });
        });
      },
      getJSON(url, options) {
        return ctx.guard(getJSON(url, options));
      },
      canvas(scene, data, options) {
        const handle = startScene((options && options.into) || layer, scene, { still: ctx.still, data });
        onStop.push(handle.stop);
        return handle;
      },
      video(src, poster, into) {
        const box = into || layer;
        if (ctx.still) {
          const img = el("img", "wp-media");
          img.src = poster;
          img.alt = "";
          box.appendChild(img);
          return img;
        }
        const video = el("video", "wp-media");
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.poster = poster;
        video.src = src;
        box.appendChild(video);
        video.play().catch(() => { /* autoplay blocked: the poster stays */ });
        onStop.push(() => {
          video.pause();
          video.removeAttribute("src");
          video.load();
        });
        return video;
      },
      onRetire(fn) {
        onRetire.push(fn);
      },
      onStop(fn) {
        onStop.push(fn);
      },
      _retire() {
        if (!ctx.alive) return;
        ctx.alive = false;
        timers.forEach(clearTimeout);
        intervals.forEach(clearInterval);
        listeners.forEach(([target, type, fn, options]) => target.removeEventListener(type, fn, options));
        onRetire.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      },
      _stop() {
        ctx._retire();
        onStop.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
      }
    };
    return ctx;
  }

  function show(id, options) {
    const def = byId[id] || byId[DEFAULT_ID] || wallpapers[0];
    if (!def) return;
    const previous = current;
    if (previous) previous.ctx._retire();

    const layer = el("div", "wp-layer");
    layer.dataset.wallpaper = def.id;
    stage.appendChild(layer);
    widget.replaceChildren();
    widget.hidden = true;
    quoteOverride = null;
    root.dataset.wallpaper = def.id;
    setLayout(def.layout);

    const ctx = makeContext(def, layer);
    current = { def, layer, ctx };
    try {
      def.mount(ctx);
    } catch (error) {
      console.error("Wallpaper " + def.id + " failed to start", error);
    }
    renderQuote();
    markPicker();

    const instant = !previous || (options && options.instant) || root.dataset.motion === "off";
    if (instant) {
      layer.classList.add("wp-in");
      if (previous) retire(previous);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("wp-in")));
      setTimeout(() => retire(previous), 900);
    }
  }

  function retire(entry) {
    entry.ctx._stop();
    entry.layer.remove();
  }

  function choose(id) {
    if (!byId[id]) return;
    save("wallpaper", id);
    params.set("w", id);
    try {
      history.replaceState(null, "", location.pathname + "?" + params.toString() + location.hash);
    } catch (e) { /* file:// pages can't change their address */ }
    if (!current || current.def.id !== id) show(id);
  }

  function step(direction) {
    if (!current) return;
    const order = GROUPS.flatMap(group => wallpapers.filter(def => def.group === group.key));
    const index = order.indexOf(current.def);
    choose(order[(index + direction + order.length) % order.length].id);
  }

  // ---------- Clock, date, quote ----------

  let lastDay = -1;

  function dayNumber(date) {
    const d = date || new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  }

  let tickTimer = 0;
  function tick() {
    clearTimeout(tickTimer);
    const now = new Date();
    let hours = now.getHours();
    let suffix = "";
    if (hour12()) {
      suffix = hours < 12 ? "AM" : "PM";
      hours = hours % 12 || 12;
    } else {
      hours = pad(hours);
    }
    let time = hours + ":" + pad(now.getMinutes());
    if (setting("seconds") === "on") time += ":" + pad(now.getSeconds());
    const text = time + suffix;
    if (clockEl.dataset.text !== text) {
      clockEl.dataset.text = text;
      clockEl.replaceChildren(el("span", "clock-time", time));
      if (suffix) clockEl.appendChild(el("span", "clock-suffix", suffix));
    }
    const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    if (dateEl.textContent !== date) dateEl.textContent = date;
    const day = dayNumber(now);
    if (day !== lastDay) {
      lastDay = day;
      renderQuote();
    }
    tickTimer = setTimeout(tick, 1000 - now.getMilliseconds() + 5);
  }

  function pickQuote(def) {
    const mode = setting("quote");
    if (mode === "off") return null;
    if (quoteOverride) return quoteOverride;
    // quotes.js declares it with const, so it isn't on window
    const Q = typeof WALLPAPER_QUOTES !== "undefined" ? WALLPAPER_QUOTES : null;
    if (!Q) return null;
    if (mode === "motto") return Q.motto;
    const set = Q.sets[def.quotes || "general"] || Q.sets.general;
    return set[(dayNumber() + hash(def.id)) % set.length];
  }

  function renderQuote() {
    if (!quoteEl) return;
    const quote = current ? pickQuote(current.def) : null;
    quoteEl.replaceChildren();
    quoteEl.hidden = !quote;
    if (!quote) return;
    quoteEl.classList.toggle("quote--verse", !!quote.verse);
    const text = el("p");
    quote.text.split("\n").forEach((line, i) => {
      if (i) text.appendChild(document.createElement("br"));
      text.appendChild(document.createTextNode(line));
    });
    quoteEl.appendChild(text);
    if (quote.by) quoteEl.appendChild(el("cite", null, quote.by));
  }

  // ---------- Picker ----------

  let pickerBuilt = false;
  let thumbsQueued = false;
  const thumbJobs = [];

  function buildPicker() {
    pickerBody.replaceChildren();
    GROUPS.forEach(group => {
      const defs = wallpapers.filter(def => def.group === group.key);
      if (!defs.length) return;
      const section = el("section", "picker-group");
      const heading = el("h3", "picker-group-title", group.title);
      if (group.hint) heading.appendChild(el("span", "picker-group-hint", group.hint));
      const grid = el("div", "picker-grid");
      defs.forEach(def => {
        const tile = el("button", "wp-tile");
        tile.type = "button";
        tile.dataset.id = def.id;
        const thumb = el("span", "wp-tile-thumb");
        if (typeof def.thumb === "string") {
          const img = el("img");
          img.alt = "";
          img.loading = "lazy";
          img.src = def.thumb;
          thumb.appendChild(img);
        } else if (def.thumb || def.scene || def.thumbScene) {
          const canvas = el("canvas");
          canvas.width = 320;
          canvas.height = 180;
          thumb.appendChild(canvas);
          thumbJobs.push(() => {
            if (typeof def.thumb === "function") def.thumb(canvas);
            else renderSceneThumb(def.thumbScene || def.scene, canvas, def.thumbData ? def.thumbData() : {});
          });
        }
        if (def.icon) thumb.appendChild(el("span", "wp-tile-icon", def.icon));
        const name = el("span", "wp-tile-name", def.name);
        const blurb = el("span", "wp-tile-blurb", def.blurb || "");
        tile.append(thumb, name, blurb);
        tile.addEventListener("click", () => {
          choose(def.id);
          closePicker();
        });
        grid.appendChild(tile);
      });
      section.append(heading, grid);
      pickerBody.appendChild(section);
    });
    pickerBuilt = true;
    markPicker();
  }

  // One thumbnail per frame, so opening the picker never stutters.
  function drawThumbs() {
    if (thumbsQueued) return;
    thumbsQueued = true;
    const next = () => {
      const job = thumbJobs.shift();
      if (!job) return;
      try { job(); } catch (error) { console.error(error); }
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  function markPicker() {
    if (!pickerBuilt || !current) return;
    pickerBody.querySelectorAll(".wp-tile").forEach(tile => {
      tile.setAttribute("aria-pressed", String(tile.dataset.id === current.def.id));
    });
  }

  let pickerOpener = null;
  function openPicker() {
    if (!pickerBuilt) buildPicker();
    pickerOpener = document.activeElement;
    modal.classList.add("show");
    root.classList.add("wp-picking");
    drawThumbs();
    const selected = pickerBody.querySelector('.wp-tile[aria-pressed="true"]') || pickerBody.querySelector(".wp-tile");
    requestAnimationFrame(() => {
      if (selected) {
        selected.focus({ preventScroll: true });
        selected.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function closePicker() {
    if (!modal.classList.contains("show")) return;
    modal.classList.remove("show");
    root.classList.remove("wp-picking");
    if (pickerOpener && pickerOpener.focus) pickerOpener.focus({ preventScroll: true });
  }

  function copyLink(note) {
    if (!current) return;
    const url = location.origin + location.pathname + "?w=" + current.def.id;
    const done = text => {
      note.textContent = text;
      clearTimeout(copyLink.timer);
      copyLink.timer = setTimeout(() => { note.textContent = ""; }, 4000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => done("Link copied"), () => done(url));
    } else {
      done(url);
    }
  }

  // ---------- Ambient mode ----------

  let ambient = false;
  let ambientFullscreen = false;
  let wakeLock = null;
  let idleTimer = 0;
  let shiftTimer = 0;

  function lockScreen() {
    if (!ambient || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    navigator.wakeLock.request("screen").then(lock => { wakeLock = lock; }).catch(() => { /* not allowed here */ });
  }

  function wake() {
    root.classList.remove("wp-idle");
    clearTimeout(idleTimer);
    if (ambient) idleTimer = setTimeout(() => root.classList.add("wp-idle"), 3000);
  }

  // Moves the clock a few pixels every minute so a screen left on never burns it in.
  function shift() {
    root.style.setProperty("--wp-shift-x", Math.round((Math.random() - 0.5) * 16) + "px");
    root.style.setProperty("--wp-shift-y", Math.round((Math.random() - 0.5) * 12) + "px");
  }

  function setAmbient(on, viaFullscreen) {
    ambient = on;
    root.classList.toggle("wp-ambient", on);
    const button = document.getElementById("ambientBtn");
    if (button) {
      button.setAttribute("aria-pressed", String(on));
      button.title = on ? "Leave ambient mode (F)" : "Ambient mode: full screen, controls hide, screen stays on (F)";
    }
    clearInterval(shiftTimer);
    if (on) {
      if (viaFullscreen && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => { ambientFullscreen = true; }).catch(() => { ambientFullscreen = false; });
      }
      lockScreen();
      shiftTimer = setInterval(shift, 60000);
      wake();
    } else {
      root.classList.remove("wp-idle");
      clearTimeout(idleTimer);
      root.style.removeProperty("--wp-shift-x");
      root.style.removeProperty("--wp-shift-y");
      if (wakeLock) wakeLock.release().catch(() => {});
      wakeLock = null;
      if (ambientFullscreen && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
      ambientFullscreen = false;
    }
  }

  // ---------- Public API for the wallpaper files ----------

  window.WP = {
    register(def) {
      if (!def || !def.id || !def.mount) throw new Error("A wallpaper needs an id and a mount()");
      if (byId[def.id]) throw new Error("Two wallpapers are called " + def.id);
      def.group = def.group || "drawn";
      wallpapers.push(def);
      byId[def.id] = def;
    },
    get: id => byId[id],
    all: () => wallpapers.slice(),
    current: () => (current ? current.def.id : null),
    choose,
    params,
    MELBOURNE,
    setting,
    el, pad, hash, rng, clamp, lerp, smoothstep, hex, mix, rgba, ramp,
    fmtTime, fmtDay, fmtWhen, span, ago, countdownParts, tzOffset, zonedMidnight,
    sunPosition, sunCrossings, sunTimes, moonPhase, drawMoon, makeStars, drawStars, cloudSprite,
    getJSON, cached, loadJSON, saveJSON, load, save,
    renderSceneThumb
  };

  // ---------- Start ----------

  document.addEventListener("DOMContentLoaded", () => {
    stage = document.getElementById("stage");
    clockEl = document.getElementById("clock");
    dateEl = document.getElementById("date");
    widget = document.getElementById("widget");
    quoteEl = document.getElementById("quote");
    modal = document.getElementById("wallpaperModal");
    pickerBody = document.getElementById("pickerBody");
    header = document.querySelector("header");

    const measure = () => root.style.setProperty("--header-h", (header ? header.offsetHeight : 0) + "px");
    measure();
    window.addEventListener("resize", measure);

    applyDim();
    tick();

    const asked = params.get("w");
    const saved = load("wallpaper", null);
    show(byId[asked] ? asked : byId[saved] ? saved : DEFAULT_ID);

    document.getElementById("openModal").addEventListener("click", openPicker);
    document.getElementById("closeModal").addEventListener("click", closePicker);
    modal.addEventListener("click", event => { if (event.target === modal) closePicker(); });
    const copyButton = document.getElementById("copyLink");
    const copyNote = document.getElementById("copyNote");
    copyButton.addEventListener("click", () => copyLink(copyNote));

    document.getElementById("ambientBtn").addEventListener("click", () => setAmbient(!ambient, true));
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && ambientFullscreen) {
        ambientFullscreen = false;
        setAmbient(false);
      }
    });
    document.addEventListener("visibilitychange", lockScreen);
    ["pointermove", "pointerdown", "keydown", "touchstart"].forEach(type =>
      window.addEventListener(type, () => { if (ambient) wake(); }, { passive: true }));
    if (params.get("ambient") === "1") setAmbient(true, false);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && modal.classList.contains("show")) {
        event.preventDefault();
        closePicker();
        return;
      }
      // keep Tab inside the picker while it's open
      if (event.key === "Tab" && modal.classList.contains("show")) {
        const items = [...modal.querySelectorAll("button, [href]")].filter(node => !node.disabled && node.offsetParent !== null);
        const first = items[0];
        const last = items[items.length - 1];
        if (!modal.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const typing = event.target.closest && event.target.closest("input, textarea, select, [contenteditable]");
      if (typing || event.ctrlKey || event.metaKey || event.altKey || root.classList.contains("settings-open")) return;
      if (modal.classList.contains("show")) return;
      if (event.key === "f" || event.key === "F") {
        setAmbient(!ambient, true);
      } else if (event.key === "ArrowRight") {
        step(1);
      } else if (event.key === "ArrowLeft") {
        step(-1);
      }
    });

    reducedMotion.addEventListener("change", () => { if (current && setting("motion") === "auto") show(current.def.id, { instant: true }); });
  });
})();
