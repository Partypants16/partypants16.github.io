// The Music page (music.html): draws every chart from music-data.js
// (`const MUSIC`, made by tools/build_music_data.py from the Spotify export).
//
// No chart library: each chart is a small SVG or HTML list built here, so it
// follows the site's theme and accent colour (tokens in music.css) and its
// words go through the Hinglish layer (i18n.js translates text as it appears;
// names and song titles are marked translate="no").
//
// The year switcher (?year=2024 in the link) changes the top half of the page.
// "Across the years" always covers every year and highlights the chosen one.
//
// Cover art is generated: initials on a gradient whose colours come from the
// name, so the same artist always gets the same cover. Charts animate in as
// they scroll into view (not with Settings → Transitions → Off, the system's
// reduce-motion setting, or when the page is only redrawn for a new width).

(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  if (typeof MUSIC === "undefined") {
    $("mu-missing").hidden = false;
    return;
  }

  const D = MUSIC;
  const MAIN = document.querySelector("main.mu");
  const YEARS = D.meta.years.map(String);
  const NS = "http://www.w3.org/2000/svg";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  // Colour follows the device, whichever year is shown.
  const DEVICE_ORDER = ["Windows", "iPhone / iPad", "Mac", "PlayStation", "Android", "Web player", "Unknown"];
  const DEVICE_COLOUR = {
    "Windows": "var(--mu-s1)", "iPhone / iPad": "var(--mu-s2)", "Mac": "var(--mu-s3)",
    "PlayStation": "var(--mu-s4)", "Android": "var(--mu-s5)", "Web player": "var(--mu-s6)",
    "Unknown": "var(--mu-unknown)"
  };
  const ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    wave: '<path d="M3 12h3l3-7 4 14 3-7h5"/>',
    skip: '<path d="M5 5l10 7-10 7z"/><path d="M19 5v14"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    flame: '<path d="M12 22c4.4 0 7-2.9 7-6.7 0-4.3-3.5-6.2-4.2-10.3C12 7 9.6 9.9 9.6 12.6c-1-.4-1.9-1.4-2.2-2.6C5.9 11.6 5 13.4 5 15.3 5 19.1 7.6 22 12 22z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'
  };

  let current = "all";
  let uid = 0;

  // ---------- small helpers ----------

  function el(tag, attrs, parent, text) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function sv(tag, attrs, parent, text) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) {
      if (k === "fill" || k === "stroke") n.style[k] = attrs[k]; // var() only works as a style
      else n.setAttribute(k, attrs[k]);
    }
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function svgIn(box, w, h) {
    box.replaceChildren();
    return sv("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: "img" }, box);
  }

  // A vertical gradient of one colour, strong at the top and fading down.
  function gradient(svg, colour, top, bottom) {
    const id = "mu-g" + (++uid);
    const defs = sv("defs", null, svg);
    const g = sv("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    sv("stop", { offset: 0 }, g).setAttribute("style", `stop-color:${colour};stop-opacity:${top}`);
    sv("stop", { offset: 1 }, g).setAttribute("style", `stop-color:${colour};stop-opacity:${bottom}`);
    return `url(#${id})`;
  }

  function icon(name) {
    const span = el("span", { class: "mu-icon", "aria-hidden": "true" });
    span.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${ICONS[name]}</svg>`;
    return span;
  }

  // Generated cover art: initials on a gradient picked from the name.
  function hue(name) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return h % 360;
  }

  function initials(name) {
    const words = name.replace(/\(.*?\)|\[.*?\]/g, " ").split(/[\s\-–|/&,.]+/).filter(w => /[\p{L}\p{N}]/u.test(w));
    if (!words.length) return "♪";
    const first = w => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ""))[0] || "";
    return (first(words[0]) + (words[1] ? first(words[1]) : "")).toUpperCase();
  }

  function cover(name, square, parent) {
    const c = el("span", { class: "mu-cover" + (square ? " is-square" : ""), "aria-hidden": "true", translate: "no" }, parent, initials(name));
    const h = hue(name);
    c.style.setProperty("--h1", h);
    c.style.setProperty("--h2", (h + 40 + (h % 50)) % 360);
    return c;
  }

  const fmt = n => Math.round(n).toLocaleString("en-AU");
  const hrs = v => (v < 10 ? (Math.round(v * 10) / 10).toString() : fmt(v));
  const hoursText = v => `${hrs(v)} ${v === 1 ? "hour" : "hours"}`;
  const playsText = n => `${fmt(n)} ${n === 1 ? "play" : "plays"}`;
  const pct = v => (v > 0 && v < 0.5 ? "<1%" : `${Math.round(v)}%`);

  function duration(min) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  function niceDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  // Clean axis ticks: 0 and three or four round steps up to just past max.
  function ticks(max, count) {
    if (max <= 0) return [0, 1];
    const raw = max / (count || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw);
    const out = [];
    for (let v = 0; v < max + step * 0.999; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }

  // A column whose top corners are rounded and whose foot sits square on the baseline.
  function columnPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  // Sequential colour: the accent mixed into the empty-cell colour.
  const shade = p => (p <= 0 ? "var(--mu-empty)" : `color-mix(in oklab, var(--mu-accent) ${Math.round(12 + 88 * p)}%, var(--mu-empty))`);

  const still = () => MAIN.classList.contains("mu-still")
    || document.documentElement.dataset.motion === "off"
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function delay(node, ms) {
    node.style.animationDelay = ms + "ms";
    return node;
  }

  // ---------- charts animate once their card scrolls into view ----------

  const seen = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); seen.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" })
    : null;
  document.querySelectorAll(".mu-card, .mu-tiles, .mu-records").forEach(c => {
    if (seen) seen.observe(c); else c.classList.add("is-in");
  });
  const pauseStyle = document.createElement("style");
  pauseStyle.textContent = ".mu :is(.mu-card, .mu-tiles, .mu-records):not(.is-in) * { animation-play-state: paused !important; }";
  document.head.appendChild(pauseStyle);

  // ---------- tooltip ----------

  const tip = $("mu-tip");
  let tipSticky = false;

  // lines: first one bold. A line given as {t, no: true} is a name (not translated).
  function fillTip(lines) {
    tip.replaceChildren();
    lines.forEach((line, i) => {
      const n = el(i === 0 ? "b" : "span", null, tip, typeof line === "string" ? line : line.t);
      if (typeof line !== "string" && line.no) n.setAttribute("translate", "no");
    });
    tip.hidden = false;
  }

  function placeTip(x, y) {
    const r = tip.getBoundingClientRect();
    let left = x + 14;
    let top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 14);
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function hideTip() {
    tip.hidden = true;
    tipSticky = false;
  }

  // Hover (mouse), tap (touch: stays until the next tap) and keyboard focus.
  function withTip(node, lines, focusable) {
    node.setAttribute("data-tip", "");
    const get = e => (typeof lines === "function" ? lines(e) : lines);
    node.addEventListener("pointerenter", e => {
      if (e.pointerType === "touch") return;
      fillTip(get(e));
      placeTip(e.clientX, e.clientY);
    });
    node.addEventListener("pointermove", e => {
      if (e.pointerType === "touch" || tipSticky) return;
      if (typeof lines === "function") fillTip(lines(e));
      placeTip(e.clientX, e.clientY);
    });
    node.addEventListener("pointerleave", e => { if (e.pointerType !== "touch" && !tipSticky) hideTip(); });
    node.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      e.stopPropagation();
      fillTip(get(e));
      placeTip(e.clientX, e.clientY);
      tipSticky = true;
    });
    if (focusable) {
      node.setAttribute("tabindex", "0");
      node.addEventListener("focus", () => {
        const r = node.getBoundingClientRect();
        fillTip(get(null));
        placeTip(r.left + r.width / 2, r.top);
      });
      node.addEventListener("blur", hideTip);
    }
  }

  document.addEventListener("pointerdown", () => { if (tipSticky) hideTip(); });
  window.addEventListener("scroll", () => { if (!tip.hidden && tipSticky) hideTip(); }, { passive: true });

  // ---------- reusable charts ----------

  // Ranked list with a thin gradient bar under each name.
  // opts: rankFrom (shows rank numbers and covers), square (song/album covers), max
  function barList(box, rows, opts) {
    opts = opts || {};
    box.replaceChildren();
    const max = opts.max || Math.max(...rows.map(r => r.value), 0) || 1;
    rows.forEach((r, i) => {
      const li = el("li", { class: "mu-bar" + (opts.rankFrom ? " has-rank" : "") }, box);
      if (opts.rankFrom) {
        el("span", { class: "mu-bar-rank" }, li, String(opts.rankFrom + i));
        cover(r.label, opts.square, li);
      }
      const name = el("span", { class: "mu-bar-name" }, li);
      el("span", r.raw ? { translate: "no" } : null, name, r.label);
      if (r.sub) {
        name.append(" ");
        el("small", r.subRaw ? { translate: "no" } : null, name, r.sub);
      }
      name.title = r.sub ? `${r.label} · ${r.sub}` : r.label;
      if (r.raw) name.setAttribute("translate", "no");
      el("span", { class: "mu-bar-value" }, li, r.valueText);
      const track = el("span", { class: "mu-bar-track" }, li);
      const fill = el("span", { class: "mu-bar-fill" }, track);
      fill.style.width = (100 * r.value / max).toFixed(2) + "%";
      if (r.colour) fill.style.background = r.colour;
      delay(fill, i * 40);
      if (r.tip) withTip(li, r.tip, true);
    });
  }

  // The top three as big cards with cover art.
  function podium(box, rows, square) {
    box.replaceChildren();
    rows.slice(0, 3).forEach((r, i) => {
      const li = el("li", { class: "mu-pod" }, box);
      el("span", { class: "mu-pod-rank" }, li, "#" + (i + 1));
      cover(r.label, square, li);
      el("span", { class: "mu-pod-name", translate: "no", title: r.label }, li, r.label);
      if (r.sub) el("span", { class: "mu-pod-sub", translate: "no" }, li, r.sub);
      el("span", { class: "mu-pod-value" }, li, r.valueText);
      if (r.tip) withTip(li, r.tip, true);
    });
  }

  // Columns over a band axis. opts: labels, values, tip(i), tickLabel(i), yText(v), highlight(i), onPick(i)
  function columns(box, opts) {
    const W = Math.max(280, box.clientWidth);
    const H = opts.height || 210;
    const m = { l: 42, r: 6, t: 12, b: 26 };
    const svg = svgIn(box, W, H);
    const fillOn = gradient(svg, "var(--mu-accent)", 1, 0.55);
    const max = Math.max(...opts.values, 0);
    const tk = ticks(max, 4);
    const top = tk[tk.length - 1] || 1;
    const ph = H - m.t - m.b;
    const pw = W - m.l - m.r;
    const y = v => m.t + ph - (v / top) * ph;
    tk.forEach(v => {
      sv("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, svg, opts.yText ? opts.yText(v) : fmt(v));
    });
    const n = opts.values.length;
    const band = pw / n;
    const bw = Math.min(26, band * 0.68);
    opts.values.forEach((v, i) => {
      const cx = m.l + band * i + band / 2;
      const hgt = Math.max(0, y(0) - y(v));
      const on = !opts.highlight || opts.highlight(i);
      if (hgt > 0) {
        const bar = sv("path", { d: columnPath(cx - bw / 2, y(v), bw, hgt, Math.min(6, bw / 2)), class: "mu-grow" }, svg);
        bar.style.fill = on ? fillOn : "var(--mu-dim)";
        delay(bar, i * (600 / n));
      }
      const label = opts.tickLabel ? opts.tickLabel(i) : opts.labels[i];
      if (label) sv("text", { x: cx, y: H - 6, "text-anchor": "middle" }, svg, label);
      const hit = sv("rect", { x: m.l + band * i, y: m.t, width: band, height: ph, class: "mu-hit" }, svg);
      if (opts.tip) withTip(hit, () => opts.tip(i), true);
      if (opts.onPick) {
        hit.style.cursor = "pointer";
        hit.addEventListener("click", () => opts.onPick(i));
        hit.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onPick(i); } });
      }
    });
    return svg;
  }

  // Lines over a point axis, with a crosshair that follows the pointer.
  // opts: keys, series [{name, values, colour}], tickLabel(i), yText(v), yMax, area, dots, tip(i)
  function lines(box, opts) {
    const W = Math.max(280, box.clientWidth);
    const H = opts.height || 230;
    const m = { l: 42, r: 12, t: 14, b: 26 };
    const svg = svgIn(box, W, H);
    const all = opts.series.flatMap(s => s.values.filter(v => v !== null));
    const tk = ticks(opts.yMax || Math.max(...all, 0), 4);
    const top = opts.yMax || tk[tk.length - 1] || 1;
    const ph = H - m.t - m.b;
    const pw = W - m.l - m.r;
    const n = opts.keys.length;
    const x = i => m.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
    const y = v => m.t + ph - (v / top) * ph;
    tk.filter(v => v <= top).forEach(v => {
      sv("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, svg, opts.yText ? opts.yText(v) : fmt(v));
    });
    opts.keys.forEach((k, i) => {
      const label = opts.tickLabel ? opts.tickLabel(i) : k;
      if (label) sv("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, svg, label);
    });
    opts.series.forEach(s => {
      const wash = opts.area ? gradient(svg, s.colour, 0.32, 0) : null;
      // Split at gaps (null), so a missing month isn't drawn as a straight line.
      const runs = [];
      let run = [];
      s.values.forEach((v, i) => {
        if (v === null) { if (run.length) runs.push(run); run = []; }
        else run.push([x(i), y(v)]);
      });
      if (run.length) runs.push(run);
      runs.forEach(r => {
        const d = r.map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
        if (wash && r.length > 1) {
          const a = sv("path", { d: d + `L${r[r.length - 1][0]},${y(0)}L${r[0][0]},${y(0)}Z`, class: "mu-fade" }, svg);
          a.style.fill = wash;
        }
        sv("path", { d, fill: "none", stroke: s.colour, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round", pathLength: 1, class: "mu-draw" }, svg);
        if (r.length === 1) sv("circle", { cx: r[0][0], cy: r[0][1], r: 3, fill: s.colour }, svg);
      });
      if (opts.dots) s.values.forEach((v, i) => {
        if (v !== null) delay(sv("circle", { cx: x(i), cy: y(v), r: 4.5, fill: s.colour, stroke: "var(--mu-surface)", "stroke-width": 2, class: "mu-fade" }, svg), 300 + i * 60);
      });
    });
    // Crosshair.
    const cross = sv("g", { visibility: "hidden" }, svg);
    sv("line", { y1: m.t, y2: m.t + ph, stroke: "var(--mu-axis)", "stroke-width": 1, "stroke-dasharray": "3 3", class: "mu-vline" }, cross);
    const vline = cross.lastChild;
    const marks = opts.series.map(s => sv("circle", { r: 5, fill: s.colour, stroke: "var(--mu-surface)", "stroke-width": 2.5 }, cross));
    const hit = sv("rect", { x: m.l - 6, y: m.t, width: pw + 12, height: ph, class: "mu-hit" }, svg);
    let idx = 0;
    const pick = e => {
      if (e) {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left;
        idx = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : ((px - m.l) / pw) * (n - 1))));
      }
      cross.setAttribute("visibility", "visible");
      vline.setAttribute("x1", x(idx));
      vline.setAttribute("x2", x(idx));
      opts.series.forEach((s, j) => {
        const v = s.values[idx];
        marks[j].setAttribute("visibility", v === null ? "hidden" : "visible");
        if (v !== null) { marks[j].setAttribute("cx", x(idx)); marks[j].setAttribute("cy", y(v)); }
      });
      return opts.tip(idx);
    };
    withTip(hit, pick, true);
    hit.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      idx = Math.max(0, Math.min(n - 1, idx + (e.key === "ArrowRight" ? 1 : -1)));
      fillTip(pick(null));
      const r = svg.getBoundingClientRect();
      placeTip(r.left + x(idx), r.top + m.t);
    });
    hit.addEventListener("pointerleave", () => cross.setAttribute("visibility", "hidden"));
    hit.addEventListener("blur", () => cross.setAttribute("visibility", "hidden"));
    return svg;
  }

  function legend(box, items) {
    box.replaceChildren();
    return items.map(it => {
      const s = el(it.button ? "button" : "span", it.button ? { type: "button" } : null, box);
      const key = el("i", it.line ? { class: "line" } : null, s);
      key.style.background = it.colour;
      el("span", it.raw ? { translate: "no" } : null, s, it.label);
      if (it.note) el("b", null, s, it.note);
      return s;
    });
  }

  // ---------- the hero ----------

  function countUp(node, to) {
    if (still()) { node.textContent = fmt(to); return; }
    const from = Number(node.dataset.value || 0);
    const t0 = performance.now();
    const ms = 1100;
    node.dataset.value = String(to);
    const step = now => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 4);
      node.textContent = fmt(from + (to - from) * e);
      if (p < 1 && node.dataset.value === String(to)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function renderHero() {
    const v = view();
    $("mu-hero-label").textContent = current === "all" ? "All time" : current;
    countUp($("mu-hero-hours"), v.stats.hours);
    $("mu-hero-note").textContent = `${fmt(v.stats.hours / 24)} days nonstop`;
    const chips = $("mu-hero-chips");
    chips.replaceChildren();
    const chip = (label, name, square) => {
      const li = el("li", null, chips);
      cover(name, square, li);
      const t = el("span", { class: "mu-chip-text" }, li);
      el("small", null, t, label);
      el("span", { translate: "no", title: name }, t, name);
    };
    if (v.artists[0]) chip("#1 artist", v.artists[0][0], false);
    if (v.songs[0]) chip("#1 song", v.songs[0][0], true);
  }

  function buildEqualiser() {
    const eq = $("mu-eq");
    const n = 48;
    for (let i = 0; i < n; i++) {
      const bar = el("i", null, eq);
      const wave = 0.5 + 0.5 * Math.sin(i / 3.2) * Math.cos(i / 9);
      bar.style.setProperty("--h", Math.round(25 + 75 * Math.abs(wave)) + "%");
      bar.style.setProperty("--d", (0.7 + ((i * 37) % 9) / 10).toFixed(2) + "s");
      bar.style.setProperty("--delay", (-((i * 53) % 13) / 10).toFixed(2) + "s");
    }
  }

  // ---------- the chosen year (or all time) ----------

  function view() {
    return D.views[current];
  }

  function buildYears() {
    const box = $("mu-years");
    ["all", ...YEARS].forEach(y => {
      const b = el("button", { type: "button", "data-year": y }, box, y === "all" ? "All time" : y);
      b.addEventListener("click", () => choose(y));
    });
  }

  function updateYears() {
    const box = $("mu-years");
    let on = null;
    box.querySelectorAll("button").forEach(b => {
      const yes = b.dataset.year === current;
      b.setAttribute("aria-pressed", String(yes));
      if (yes) on = b;
    });
    if (!on) return;
    const pill = box.querySelector(".mu-years-pill");
    pill.style.width = on.offsetWidth + "px";
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
    // On a phone the row scrolls: keep the chosen year in view.
    if (box.scrollWidth > box.clientWidth) {
      box.scrollTo({ left: on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2, behavior: still() ? "auto" : "smooth" });
    }
  }

  function renderNumbers() {
    const s = view().stats;
    const tiles = $("mu-tiles");
    tiles.replaceChildren();
    const tile = (box, ic, label, value, note, i) => {
      const li = el("li", null, box);
      li.classList.add("mu-fade");
      delay(li, i * 60);
      li.appendChild(icon(ic));
      el("span", { class: "mu-tile-label" }, li, label);
      el("span", { class: "mu-tile-value" }, li, value);
      if (note) el("span", { class: "mu-tile-note" }, li, note);
      return li;
    };
    tile(tiles, "clock", "Hours listened", fmt(s.hours), `${fmt(s.hours / 24)} days nonstop`, 0);
    tile(tiles, "play", "Plays", fmt(s.plays), "30 seconds or more", 1);
    tile(tiles, "mic", "Artists", fmt(s.artists), null, 2);
    tile(tiles, "note", "Songs", fmt(s.songs), `from ${fmt(s.albums)} albums`, 3);
    tile(tiles, "calendar", "Days with music", fmt(s.days), null, 4);
    tile(tiles, "wave", "Per listening day", duration(s.minPerDay), "on average", 5);
    tile(tiles, "skip", "Skipped", pct(s.skipRate), "of plays", 6);
    tile(tiles, "shuffle", "On shuffle", pct(s.shuffle), "of plays", 7);

    const rec = $("mu-records");
    rec.replaceChildren();
    if (s.streak) tile(rec, "flame", "Longest streak", `${fmt(s.streak.days)} days in a row`,
      s.streak.days > 1 ? `${niceDate(s.streak.from)} to ${niceDate(s.streak.to)}` : niceDate(s.streak.from), 0);
    if (s.bigDay) tile(rec, "trophy", "Biggest day", duration(s.bigDay.min), niceDate(s.bigDay.date), 1);
    if (s.session) tile(rec, "headphones", "Longest session", duration(s.session.min), `without a 30-minute break, ${niceDate(s.session.date)}`, 2);
    if (s.repeat) {
      const li = tile(rec, "repeat", "Most on repeat", `${fmt(s.repeat.n)} plays in a day`, null, 3);
      el("span", { class: "mu-song", translate: "no" }, li, `${s.repeat.track} · ${s.repeat.artist}`);
      el("span", { class: "mu-tile-note" }, li, niceDate(s.repeat.date));
    }
  }

  function renderTop() {
    const v = view();
    const artists = v.artists.map(([a, h, n]) => ({
      label: a, raw: true, value: h, valueText: hrs(h) + " h",
      tip: [{ t: a, no: true }, hoursText(h), playsText(n)]
    }));
    podium($("mu-artists-top"), artists, false);
    barList($("mu-artists"), artists.slice(3), { rankFrom: 4, max: artists[0] ? artists[0].value : 1 });

    const songs = v.songs.map(([t, a, n, h]) => ({
      label: t, raw: true, sub: a, subRaw: true, value: n, valueText: playsText(n),
      tip: [{ t, no: true }, { t: a, no: true }, playsText(n), hoursText(h)]
    }));
    podium($("mu-songs-top"), songs, true);
    barList($("mu-songs"), songs.slice(3).map(s => Object.assign({}, s, { valueText: fmt(s.value) })),
      { rankFrom: 4, square: true, max: songs[0] ? songs[0].value : 1 });

    const box = $("mu-albums");
    box.replaceChildren();
    v.albums.forEach(([al, a, h], i) => {
      const li = el("li", { class: "mu-album mu-fade" }, box);
      delay(li, i * 50);
      const c = cover(al, true, li);
      el("span", { class: "mu-album-rank" }, c, String(i + 1));
      el("div", { class: "mu-album-name", translate: "no", title: al }, li, al);
      el("div", { class: "mu-album-sub" }, li, "").append(
        Object.assign(document.createElement("span"), { textContent: a, translate: false }), " · " + hrs(h) + " h");
      li.querySelector(".mu-album-sub span").setAttribute("translate", "no");
      withTip(li, [{ t: al, no: true }, { t: a, no: true }, hoursText(h)], true);
    });
  }

  function renderTimeline() {
    const box = $("mu-timeline");
    $("mu-timeline-title").textContent = "Hours listened each month";
    if (current === "all") {
      $("mu-timeline-sub").textContent = `Every month since ${monthLabel(D.allTime.monthly[0][0])}`;
      const rows = D.allTime.monthly;
      lines(box, {
        keys: rows.map(r => r[0]),
        series: [{ name: "Hours", values: rows.map(r => r[1]), colour: "var(--mu-accent)" }],
        area: true,
        height: 260,
        tickLabel: i => {
          const [y, m] = rows[i][0].split("-");
          const narrow = box.clientWidth < 560;
          return m === "01" && (!narrow || Number(y) % 2 === 0) ? y : "";
        },
        tip: i => [monthLabel(rows[i][0]), hoursText(rows[i][1]), playsText(rows[i][2])]
      });
    } else {
      $("mu-timeline-sub").textContent = `In ${current}`;
      const mins = view().months;
      const narrow = box.clientWidth < 420;
      columns(box, {
        labels: MONTHS,
        values: mins.map(v => v / 60),
        height: 240,
        tickLabel: i => (narrow ? MONTHS[i][0] : MONTHS[i]),
        tip: i => [`${MONTHS[i]} ${current}`, hoursText(Math.round(mins[i] / 6) / 10)]
      });
    }
  }

  function hourName(h) {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }

  function renderHeat() {
    const box = $("mu-heat");
    const heat = view().heat;
    const max = Math.max(...heat.flat(), 1);
    const left = 40, top = 4, bottom = 24, gap = 3;
    const cw = Math.max(17, Math.floor((Math.max(box.clientWidth, 300) - left) / 24));
    const ch = Math.max(17, Math.round(cw * 0.72));
    const W = left + cw * 24;
    const H = top + ch * 7 + bottom;
    const svg = svgIn(box, W, H);
    heat.forEach((row, d) => {
      sv("text", { x: left - 10, y: top + ch * d + ch / 2 + 4, "text-anchor": "end" }, svg, DAYS[d]);
      row.forEach((min, hr) => {
        const cell = sv("rect", {
          x: left + cw * hr + gap / 2, y: top + ch * d + gap / 2, width: cw - gap, height: ch - gap, rx: 5,
          fill: shade(min / max), class: "mu-cell mu-fade"
        }, svg);
        delay(cell, (hr + d) * 18);
        withTip(cell, [`${DAY_NAMES[d]}, ${hourName(hr)} to ${hourName((hr + 1) % 24)}`, hoursText(Math.round(min / 6) / 10)]);
      });
    });
    for (let hr = 0; hr < 24; hr += 3) {
      sv("text", { x: left + cw * hr + cw / 2, y: H - 6, "text-anchor": "middle" }, svg, hourName(hr));
    }
  }

  function renderHoursAndDays() {
    const heat = view().heat;
    const byHour = Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0) / 60);
    const box = $("mu-hours");
    columns(box, {
      labels: byHour.map((_, h) => hourName(h)),
      values: byHour,
      height: 300,
      tickLabel: h => (h % (box.clientWidth < 420 ? 6 : 3) === 0 ? hourName(h) : ""),
      tip: h => [`${hourName(h)} to ${hourName((h + 1) % 24)}`, hoursText(Math.round(byHour[h] * 10) / 10)]
    });
    const byDay = heat.map(row => row.reduce((a, b) => a + b, 0) / 60);
    barList($("mu-weekdays"), byDay.map((h, d) => ({
      label: DAY_NAMES[d], value: h, valueText: hrs(h) + " h",
      tip: [DAY_NAMES[d], hoursText(Math.round(h * 10) / 10)]
    })));
  }

  // All time: one thin strip per year, a sliver per day (newest year on top).
  function renderRibbons(colour, level) {
    const box = $("mu-calendar");
    const years = YEARS.slice().reverse();
    const W = Math.max(300, box.clientWidth);
    const left = 46, top = 18, rowH = 22, gap = 8;
    const dw = (W - left) / 366;
    const H = top + years.length * (rowH + gap);
    const svg = svgIn(box, W, H);
    const clip = "mu-c" + (++uid);
    // Month marks, using a leap year so every row lines up.
    MONTHS.forEach((mo, i) => {
      const doy = (Date.UTC(2024, i, 1) - Date.UTC(2024, 0, 1)) / 864e5;
      if (W < 420 && i % 3) return;
      sv("text", { x: left + doy * dw, y: 11 }, svg, mo);
    });
    years.forEach((y, r) => {
      const days = D.views[y].days || {};
      const ry = top + r * (rowH + gap);
      sv("text", { x: left - 10, y: ry + rowH / 2 + 4, "text-anchor": "end", class: "mu-row-label" }, svg, y);
      const g = sv("g", { class: "mu-fade" }, svg);
      delay(g, r * 70);
      const cid = clip + "-" + r;
      const cp = sv("clipPath", { id: cid }, sv("defs", null, g));
      sv("rect", { x: left, y: ry, width: W - left, height: rowH, rx: 6 }, cp);
      const inner = sv("g", { "clip-path": `url(#${cid})` }, g);
      sv("rect", { x: left, y: ry, width: W - left, height: rowH, fill: "var(--mu-empty)" }, inner);
      const jan1 = Date.UTC(Number(y), 0, 1);
      Object.entries(days).forEach(([iso, min]) => {
        const i = Math.round((Date.UTC(...iso.split("-").map((v, k) => Number(v) - (k === 1 ? 1 : 0))) - jan1) / 864e5);
        sv("rect", { x: left + i * dw, y: ry, width: dw + 0.4, height: rowH, fill: colour(level(min)) }, inner);
      });
      const hit = sv("rect", { x: left, y: ry, width: W - left, height: rowH, class: "mu-hit" }, g);
      withTip(hit, e => {
        if (!e) return [y, `${Object.keys(days).length} days with music`];
        const bb = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(365, Math.floor((e.clientX - bb.left - left) / dw)));
        const iso = new Date(jan1 + i * 864e5).toISOString().slice(0, 10);
        if (!iso.startsWith(y)) return [y];
        const min = days[iso] || 0;
        return [niceDate(iso), min ? duration(min) : "Nothing played"];
      }, true);
    });
  }

  // One year: a GitHub-style calendar, a column per week, Monday at the top.
  function renderCalendar() {
    const box = $("mu-calendar");
    box.replaceChildren();
    const years = current === "all" ? YEARS.slice().reverse() : [current];
    const values = years.flatMap(y => Object.values(D.views[y].days || {}));
    const sorted = values.slice().sort((a, b) => a - b);
    const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75), q(0.92)];
    const level = v => (v <= 0 ? 0 : 1 + cuts.filter(c => v > c).length); // 0..5
    const colour = l => shade([0, 0.15, 0.35, 0.55, 0.78, 1][l]);
    const fit = Math.floor((Math.max(box.clientWidth, 300) - 32) / 54);
    const cell = Math.max(10, Math.min(16, fit - 3)), gap = 3, step = cell + gap, left = 32, top = 16;

    const scale = $("mu-cal-scale");
    scale.replaceChildren();
    el("span", null, scale, "Less");
    for (let l = 0; l <= 5; l++) el("i", null, scale).style.background = colour(l);
    el("span", null, scale, "More");
    $("mu-cal-sub").textContent = current === "all"
      ? "One row per year, one thin line per day. Darker means more minutes."
      : "One square per day. Darker means more minutes.";
    if (current === "all") { renderRibbons(colour, level); return; }

    years.forEach(y => {
      const days = D.views[y].days || {};
      if (years.length > 1) el("div", { class: "mu-cal-year" }, box, y);
      const jan1 = new Date(Date.UTC(Number(y), 0, 1));
      const offset = (jan1.getUTCDay() + 6) % 7; // Monday = 0
      const yr = Number(y);
      const total = (yr % 4 === 0 && (yr % 100 !== 0 || yr % 400 === 0)) ? 366 : 365;
      const weeks = Math.ceil((offset + total) / 7);
      const svg = sv("svg", { width: left + weeks * step, height: top + 7 * step, role: "img", "aria-label": `Listening each day in ${y}` }, box);
      [0, 2, 4].forEach(d => sv("text", { x: left - 6, y: top + d * step + cell - 2, "text-anchor": "end" }, svg, DAYS[d]));
      let lastMonth = -1;
      for (let i = 0; i < total; i++) {
        const date = new Date(jan1.getTime() + i * 864e5);
        const pos = offset + i;
        const wk = Math.floor(pos / 7), dow = pos % 7;
        const iso = date.toISOString().slice(0, 10);
        const min = days[iso] || 0;
        const r = sv("rect", { x: left + wk * step, y: top + dow * step, width: cell, height: cell, rx: 3, fill: colour(level(min)), class: "mu-cell" }, svg);
        withTip(r, [niceDate(iso), min ? duration(min) : "Nothing played"]);
        const mo = date.getUTCMonth();
        if (mo !== lastMonth) {
          lastMonth = mo;
          sv("text", { x: left + wk * step, y: top - 5 }, svg, MONTHS[mo]);
        }
      }
    });
  }

  // Devices as a donut, the biggest one named in the middle.
  function renderDevices() {
    const box = $("mu-devices");
    box.replaceChildren();
    const rows = view().devices.slice().sort((a, b) => DEVICE_ORDER.indexOf(a[0]) - DEVICE_ORDER.indexOf(b[0]));
    const total = rows.reduce((s, r) => s + r[1], 0) || 1;
    const wrap = el("div", { class: "mu-donut" }, box);
    const size = 200, r = 74, sw = 24, c = size / 2;
    const svg = sv("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: "img" }, wrap);
    sv("circle", { cx: c, cy: c, r, fill: "none", stroke: "var(--mu-empty)", "stroke-width": sw }, svg);
    const gapPct = rows.length > 1 ? 0.6 : 0;
    let acc = 0;
    rows.forEach(([d, h], i) => {
      const share = (100 * h) / total;
      const len = Math.max(0, share - gapPct);
      if (len > 0) {
        const seg = sv("circle", {
          cx: c, cy: c, r, fill: "none", stroke: DEVICE_COLOUR[d] || "var(--mu-unknown)", "stroke-width": sw,
          pathLength: 100, "stroke-dasharray": `${len} ${100 - len}`, "stroke-dashoffset": String(-acc),
          transform: `rotate(-90 ${c} ${c})`, class: "mu-fade"
        }, svg);
        delay(seg, i * 90);
        withTip(seg, [d, `${pct(share)} · ${hoursText(h)}`]);
      }
      acc += share;
    });
    const topRow = rows.slice().sort((a, b) => b[1] - a[1])[0];
    if (topRow) {
      sv("text", { x: c, y: c + 4, "text-anchor": "middle", class: "mu-donut-center" }, svg, pct(100 * topRow[1] / total));
      sv("text", { x: c, y: c + 24, "text-anchor": "middle", class: "mu-donut-caption" }, svg, topRow[0]);
    }
    legend(el("div", { class: "mu-legend" }, wrap), rows.map(([d, h]) => ({
      label: d, colour: DEVICE_COLOUR[d] || "var(--mu-unknown)", note: pct(100 * h / total)
    })));
  }

  function renderReasons() {
    [["mu-starts", view().starts], ["mu-ends", view().ends]].forEach(([id, rows]) => {
      const total = rows.reduce((s, r) => s + r[1], 0) || 1;
      barList($(id), rows.slice(0, 7).map(([why, n]) => ({
        label: why, value: n, valueText: pct(100 * n / total),
        tip: [why, `${pct(100 * n / total)} · ${playsText(n)}`]
      })));
    });
  }

  // ---------- across the years ----------

  const isCurrentYear = i => current === "all" || YEARS[i] === current;
  const pickYear = i => {
    choose(YEARS[i] === current ? "all" : YEARS[i]);
    MAIN.querySelector(".mu-hero").scrollIntoView({ behavior: still() ? "auto" : "smooth" });
  };
  const shortYear = (box, y) => (box.clientWidth < 420 ? "’" + String(y).slice(2) : String(y));

  function renderYearly() {
    const rows = D.allTime.yearly;
    const box = $("mu-yearly");
    columns(box, {
      labels: rows.map(r => String(r.year)),
      values: rows.map(r => r.hours),
      height: 240,
      highlight: isCurrentYear,
      onPick: pickYear,
      tickLabel: i => shortYear(box, rows[i].year),
      tip: i => [String(rows[i].year), hoursText(rows[i].hours), playsText(rows[i].plays), "Click to see this year"]
    });
  }

  // Rank chart: smooth curves between years, one group per artist so a
  // legend chip (or a point) can bring one artist forward.
  function renderBump() {
    const { artists, ranks } = D.allTime.bump;
    const LIMIT = 25;
    const colours = artists.map((_, i) => `var(--mu-s${i + 1})`);
    const box = $("mu-bump");
    const W = Math.max(300, box.clientWidth);
    const narrow = W < 560;
    const m = { l: 34, r: narrow ? 12 : 120, t: 12, b: 26 };
    const H = 420;
    const svg = svgIn(box, W, H);
    const n = YEARS.length;
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const x = i => m.l + (pw * i) / (n - 1);
    const y = r => m.t + (ph * (r - 1)) / (LIMIT - 1);
    if (current !== "all") {
      const i = YEARS.indexOf(current);
      sv("rect", { x: x(i) - 14, y: m.t - 10, width: 28, height: ph + 20, rx: 10, fill: "color-mix(in srgb, var(--mu-accent) 12%, transparent)" }, svg);
    }
    [1, 5, 10, 15, 20, 25].forEach(r => {
      sv("line", { x1: m.l, x2: m.l + pw, y1: y(r), y2: y(r), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 8, y: y(r) + 4, "text-anchor": "end" }, svg, "#" + r);
    });
    YEARS.forEach((yr, i) => {
      const t = sv("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, svg, narrow ? "’" + yr.slice(2) : yr);
      if (current !== "all" && yr === current) t.setAttribute("class", "mu-label");
    });
    const groups = [];
    const focus = k => {
      box.classList.toggle("has-focus", k !== null);
      groups.forEach((g, j) => g.classList.toggle("is-on", j === k));
      chips.forEach((ch, j) => ch.classList.toggle("is-on", j === k));
    };
    artists.forEach((a, k) => {
      const g = sv("g", { class: "mu-series" }, svg);
      groups.push(g);
      const ok = ranks[a].map(r => (r && r <= LIMIT ? r : null));
      let d = "";
      ok.forEach((r, i) => {
        if (r === null) return;
        if (i > 0 && ok[i - 1] !== null) {
          const x0 = x(i - 1), y0 = y(ok[i - 1]), x1 = x(i), y1 = y(r), dx = (x1 - x0) / 2;
          d += `C${(x0 + dx).toFixed(1)},${y0.toFixed(1)} ${(x1 - dx).toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
        } else {
          d += `M${x(i).toFixed(1)},${y(r).toFixed(1)}`;
        }
      });
      if (d) sv("path", { d, fill: "none", stroke: colours[k], "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round", pathLength: 1, class: "mu-draw" }, g);
      ok.forEach((r, i) => {
        if (r === null) return;
        delay(sv("circle", { cx: x(i), cy: y(r), r: 5, fill: colours[k], stroke: "var(--mu-surface)", "stroke-width": 2, class: "mu-fade" }, g), 400 + i * 50);
        const hit = sv("circle", { cx: x(i), cy: y(r), r: 10, class: "mu-hit" }, g);
        withTip(hit, [{ t: a, no: true }, `#${r} in ${YEARS[i]}`]);
        hit.addEventListener("pointerenter", () => focus(k));
        hit.addEventListener("pointerleave", () => focus(null));
      });
      // Name at the right end, for artists still in the last year's top 25.
      const last = ranks[a][n - 1];
      if (!narrow && last && last <= LIMIT) {
        sv("text", { x: x(n - 1) + 12, y: y(last) + 4, class: "mu-label", translate: "no" }, g, a.length > 15 ? a.slice(0, 14) + "…" : a);
      }
    });
    const chips = legend($("mu-bump-legend"), artists.map((a, i) => ({ label: a, raw: true, colour: colours[i], button: true })));
    chips.forEach((ch, k) => {
      ch.addEventListener("pointerenter", () => focus(k));
      ch.addEventListener("pointerleave", () => focus(null));
      ch.addEventListener("focus", () => focus(k));
      ch.addEventListener("blur", () => focus(null));
      ch.addEventListener("click", () => focus(ch.classList.contains("is-on") ? null : k));
    });
  }

  function renderDiscovery() {
    const rows = D.allTime.yearly;
    const boxNew = $("mu-new");
    columns(boxNew, {
      labels: rows.map(r => String(r.year)),
      values: rows.map(r => r.newArtists),
      highlight: isCurrentYear,
      onPick: pickYear,
      tickLabel: i => shortYear(boxNew, rows[i].year),
      tip: i => [String(rows[i].year), `${fmt(rows[i].newArtists)} new artists`, `of ${fmt(rows[i].artists)} played`]
    });
    const series = [
      { name: "New artists that year", values: rows.map(r => r.newShare), colour: "var(--mu-s1)" },
      { name: "My top 10 artists that year", values: rows.map(r => r.top10Share), colour: "var(--mu-s2)" }
    ];
    legend($("mu-share-legend"), series.map(s => ({ label: s.name, colour: s.colour, line: true })));
    const boxShare = $("mu-share");
    lines(boxShare, {
      keys: rows.map(r => String(r.year)),
      series,
      yMax: 100,
      dots: true,
      yText: v => v + "%",
      tickLabel: i => shortYear(boxShare, rows[i].year),
      tip: i => [String(rows[i].year), `New artists: ${pct(rows[i].newShare)}`, `Top 10 artists: ${pct(rows[i].top10Share)}`]
    });
  }

  function renderSkips() {
    const rows = D.allTime.monthly;
    const box = $("mu-skips");
    lines(box, {
      keys: rows.map(r => r[0]),
      series: [{ name: "Skip rate", values: rows.map(r => (r[2] >= 30 ? r[3] : null)), colour: "var(--mu-accent)" }],
      yMax: 100,
      area: true,
      yText: v => v + "%",
      height: 210,
      tickLabel: i => {
        const [y, m] = rows[i][0].split("-");
        return m === "01" && (box.clientWidth >= 560 || Number(y) % 2 === 0) ? y : "";
      },
      tip: i => [monthLabel(rows[i][0]), rows[i][2] >= 30 ? `${pct(rows[i][3])} skipped` : "Too few plays", playsText(rows[i][2])]
    });
  }

  function renderDeviceYears() {
    const box = $("mu-dev-years");
    const W = Math.max(280, box.clientWidth);
    const H = 240;
    const m = { l: 42, r: 6, t: 12, b: 26 };
    const svg = svgIn(box, W, H);
    const ph = H - m.t - m.b, pw = W - m.l - m.r;
    const y = v => m.t + ph - (v / 100) * ph;
    [0, 25, 50, 75, 100].forEach(v => {
      sv("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, svg, v + "%");
    });
    const used = new Set();
    const band = pw / YEARS.length;
    const bw = Math.min(30, band * 0.68);
    YEARS.forEach((yr, i) => {
      const rows = D.views[yr].devices.slice().sort((a, b) => DEVICE_ORDER.indexOf(a[0]) - DEVICE_ORDER.indexOf(b[0]));
      const total = rows.reduce((s, r) => s + r[1], 0) || 1;
      const cx = m.l + band * i + band / 2;
      const col = sv("g", { class: "mu-grow" }, svg);
      delay(col, i * 60);
      let acc = 0;
      rows.forEach(([d, h], j) => {
        used.add(d);
        const share = (100 * h) / total;
        const y0 = y(acc), y1 = y(acc + share);
        acc += share;
        const last = j === rows.length - 1;
        const hgt = y0 - y1 - (last ? 0 : 2); // 2px surface gap between segments
        if (hgt <= 0.3) return;
        const seg = last
          ? sv("path", { d: columnPath(cx - bw / 2, y1, bw, hgt, 6), fill: DEVICE_COLOUR[d] }, col)
          : sv("rect", { x: cx - bw / 2, y: y1 + 2, width: bw, height: hgt, fill: DEVICE_COLOUR[d] }, col);
        if (current !== "all" && yr !== current) seg.style.opacity = "0.3";
        withTip(seg, [`${d}, ${yr}`, `${pct(share)} · ${hoursText(h)}`]);
      });
      sv("text", { x: cx, y: H - 6, "text-anchor": "middle" }, svg, shortYear(box, yr));
    });
    legend($("mu-dev-legend"), DEVICE_ORDER.filter(d => used.has(d)).map(d => ({ label: d, colour: DEVICE_COLOUR[d] })));
  }

  function renderLoyal() {
    const box = $("mu-loyal");
    box.replaceChildren();
    D.allTime.loyal.forEach(([a, yrs, h]) => {
      const li = el("li", null, box);
      cover(a, false, li);
      const name = el("span", { class: "mu-bar-name" }, li);
      el("span", { translate: "no" }, name, a);
      el("small", null, name, `${yrs.length} of ${YEARS.length} years · ${hoursText(h)}`);
      const dots = el("span", { class: "mu-dots" }, li);
      YEARS.forEach(y => {
        const on = yrs.includes(Number(y));
        const dot = el("i", on ? { class: "on" } : null, dots);
        withTip(dot, [y, on ? "Played" : "Not played"]);
      });
    });
  }

  function renderPodcasts() {
    const p = D.allTime.podcasts;
    $("mu-pod-sub").textContent = `Hardly any: ${hoursText(p.hours)} over ${fmt(p.episodes)} episodes`;
    barList($("mu-podcasts"), p.shows.slice(0, 5).map(([s, h, n]) => ({
      label: s, raw: true, value: h, valueText: duration(Math.max(1, Math.round(h * 60))),
      tip: [{ t: s, no: true }, `${fmt(n)} ${n === 1 ? "episode" : "episodes"}`, duration(Math.max(1, Math.round(h * 60)))]
    })));
  }

  function renderTable() {
    const t = $("mu-table");
    t.replaceChildren();
    const head = el("tr", null, el("thead", null, t));
    [["Year"], ["Hours", "num"], ["Plays", "num"], ["Artists", "num"], ["New artists", "num"], ["Top artist"], ["Top song"]]
      .forEach(([h, c]) => el("th", c ? { class: c, scope: "col" } : { scope: "col" }, head, h));
    const body = el("tbody", null, t);
    D.allTime.yearly.slice().reverse().forEach(r => {
      const tr = el("tr", String(r.year) === current ? { class: "is-current" } : null, body);
      const yc = el("td", null, tr);
      const link = el("a", { href: `?year=${r.year}` }, yc, String(r.year));
      link.addEventListener("click", e => {
        e.preventDefault();
        choose(String(r.year));
        MAIN.querySelector(".mu-hero").scrollIntoView({ behavior: still() ? "auto" : "smooth" });
      });
      el("td", { class: "num" }, tr, fmt(r.hours));
      el("td", { class: "num" }, tr, fmt(r.plays));
      el("td", { class: "num" }, tr, fmt(r.artists));
      el("td", { class: "num" }, tr, fmt(r.newArtists));
      el("td", { translate: "no" }, tr, r.topArtist || "");
      const song = el("td", { translate: "no" }, tr, r.topSong ? r.topSong[0] : "");
      if (r.topSong) el("small", null, song, r.topSong[1]);
    });
  }

  // ---------- putting it together ----------

  function renderAll() {
    updateYears();
    renderHero();
    renderNumbers();
    renderTop();
    renderTimeline();
    renderHeat();
    renderHoursAndDays();
    renderCalendar();
    renderDevices();
    renderReasons();
    renderYearly();
    renderBump();
    renderDiscovery();
    renderSkips();
    renderDeviceYears();
    renderLoyal();
    renderPodcasts();
    renderTable();
  }

  function choose(y) {
    current = YEARS.includes(y) ? y : "all";
    const url = new URL(location.href);
    if (current === "all") url.searchParams.delete("year");
    else url.searchParams.set("year", current);
    history.replaceState(null, "", url);
    hideTip();
    MAIN.classList.remove("mu-still");
    renderAll();
  }

  $("mu-range").textContent = `From my Spotify history, ${niceDate(D.meta.from)} to ${niceDate(D.meta.to)}.`;
  buildEqualiser();
  buildYears();
  const asked = new URLSearchParams(location.search).get("year");
  current = YEARS.includes(asked) ? asked : "all";
  renderAll();

  // Redraw the SVG charts when the page width changes (they're drawn to fit),
  // without replaying the animations.
  let lastWidth = MAIN.clientWidth;
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = MAIN.clientWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        MAIN.classList.add("mu-still");
        renderAll();
      } else {
        updateYears();
      }
    }, 150);
  });
  // The pill needs real button widths, which can change once fonts or the
  // Hinglish words arrive.
  window.addEventListener("load", updateYears);
  document.addEventListener("click", e => { if (e.target.closest(".lang-toggle")) setTimeout(updateYears, 50); });
})();
