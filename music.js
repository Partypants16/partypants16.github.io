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

(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  if (typeof MUSIC === "undefined") {
    $("mu-missing").hidden = false;
    return;
  }

  const D = MUSIC;
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

  let current = "all";

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
    node.addEventListener("pointerenter", e => {
      if (e.pointerType === "touch") return;
      fillTip(typeof lines === "function" ? lines(e) : lines);
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
      fillTip(typeof lines === "function" ? lines(e) : lines);
      placeTip(e.clientX, e.clientY);
      tipSticky = true;
    });
    if (focusable) {
      node.setAttribute("tabindex", "0");
      node.addEventListener("focus", () => {
        const r = node.getBoundingClientRect();
        fillTip(typeof lines === "function" ? lines(null) : lines);
        placeTip(r.left + r.width / 2, r.top);
      });
      node.addEventListener("blur", hideTip);
    }
  }

  document.addEventListener("pointerdown", () => { if (tipSticky) hideTip(); });
  window.addEventListener("scroll", () => { if (!tip.hidden) hideTip(); }, { passive: true });

  // ---------- reusable charts ----------

  // Ranked list with a thin bar under each name (HTML, so long names wrap nicely).
  function barList(box, rows, opts) {
    opts = opts || {};
    box.replaceChildren();
    const max = Math.max(...rows.map(r => r.value), 0) || 1;
    rows.forEach((r, i) => {
      const li = el("li", { class: "mu-bar" + (opts.noRank ? " no-rank" : "") }, box);
      if (!opts.noRank) el("span", { class: "mu-bar-rank" }, li, String(i + 1));
      const name = el("span", { class: "mu-bar-name" }, li);
      const main = el("span", r.raw ? { translate: "no" } : null, name, r.label);
      if (r.sub) {
        name.append(" ");
        el("small", r.subRaw ? { translate: "no" } : null, name, r.sub);
      }
      name.title = r.sub ? `${r.label} · ${r.sub}` : r.label;
      if (r.raw) name.setAttribute("translate", "no");
      void main;
      el("span", { class: "mu-bar-value" }, li, r.valueText);
      const track = el("span", { class: "mu-bar-track" }, li);
      const fill = el("span", { class: "mu-bar-fill" }, track);
      fill.style.width = (100 * r.value / max).toFixed(2) + "%";
      if (r.colour) fill.style.background = r.colour;
      if (r.tip) withTip(li, r.tip, true);
    });
  }

  // Columns over a band axis. opts: labels, values, tip(i), tickLabel(i), yText(v), highlight(i), onPick(i)
  function columns(box, opts) {
    const W = Math.max(280, box.clientWidth);
    const H = opts.height || 200;
    const m = { l: 42, r: 6, t: 10, b: 24 };
    const svg = svgIn(box, W, H);
    const max = Math.max(...opts.values, 0);
    const tk = ticks(max, 4);
    const top = tk[tk.length - 1] || 1;
    const ph = H - m.t - m.b;
    const pw = W - m.l - m.r;
    const y = v => m.t + ph - (v / top) * ph;
    tk.forEach(v => {
      sv("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, svg, opts.yText ? opts.yText(v) : fmt(v));
    });
    const n = opts.values.length;
    const band = pw / n;
    const bw = Math.min(24, band * 0.72);
    opts.values.forEach((v, i) => {
      const cx = m.l + band * i + band / 2;
      const hgt = Math.max(0, y(0) - y(v));
      const on = !opts.highlight || opts.highlight(i);
      if (hgt > 0) sv("path", { d: columnPath(cx - bw / 2, y(v), bw, hgt, 4), fill: on ? "var(--mu-accent)" : "var(--mu-dim)" }, svg);
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
  // opts: keys, series [{name, values, colour}], tickLabel(i), yText(v), yMax, area, tip(i)
  function lines(box, opts) {
    const W = Math.max(280, box.clientWidth);
    const H = opts.height || 220;
    const m = { l: 42, r: 12, t: 12, b: 24 };
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
      sv("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, svg, opts.yText ? opts.yText(v) : fmt(v));
    });
    opts.keys.forEach((k, i) => {
      const label = opts.tickLabel ? opts.tickLabel(i) : k;
      if (label) sv("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, svg, label);
    });
    opts.series.forEach(s => {
      // Split at gaps (null), so a missing month isn't drawn as a straight line.
      let runs = [], run = [];
      s.values.forEach((v, i) => {
        if (v === null) { if (run.length) runs.push(run); run = []; }
        else run.push([x(i), y(v)]);
      });
      if (run.length) runs.push(run);
      runs.forEach(r => {
        const d = r.map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
        if (opts.area && r.length > 1) {
          const a = sv("path", { d: d + `L${r[r.length - 1][0]},${y(0)}L${r[0][0]},${y(0)}Z`, fill: s.colour }, svg);
          a.style.opacity = "0.1";
        }
        sv("path", { d, fill: "none", stroke: s.colour, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
        if (r.length === 1) sv("circle", { cx: r[0][0], cy: r[0][1], r: 3, fill: s.colour }, svg);
      });
      if (opts.dots) s.values.forEach((v, i) => {
        if (v !== null) sv("circle", { cx: x(i), cy: y(v), r: 4, fill: s.colour, stroke: "var(--mu-surface)", "stroke-width": 2 }, svg);
      });
    });
    // Crosshair.
    const cross = sv("g", { visibility: "hidden" }, svg);
    const vline = sv("line", { y1: m.t, y2: m.t + ph, stroke: "var(--mu-axis)", "stroke-width": 1 }, cross);
    const marks = opts.series.map(s => sv("circle", { r: 4, fill: s.colour, stroke: "var(--mu-surface)", "stroke-width": 2 }, cross));
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
    items.forEach(it => {
      const s = el("span", null, box);
      const key = el("i", it.line ? { class: "line" } : null, s);
      key.style.background = it.colour;
      el("span", it.raw ? { translate: "no" } : null, s, it.label);
      if (it.note) el("b", null, s, it.note);
    });
  }

  // ---------- the chosen year (or all time) ----------

  function view() {
    return D.views[current];
  }

  function renderYears() {
    const box = $("mu-years");
    box.replaceChildren();
    ["all", ...YEARS].forEach(y => {
      const b = el("button", { type: "button", "aria-pressed": String(y === current) }, box, y === "all" ? "All time" : y);
      b.addEventListener("click", () => choose(y));
    });
  }

  function renderNumbers() {
    const v = view();
    const s = v.stats;
    $("mu-h-numbers").textContent = current === "all" ? "All time" : current;
    const tiles = $("mu-tiles");
    tiles.replaceChildren();
    const tile = (box, label, value, note, noteRaw) => {
      const li = el("li", null, box);
      el("span", { class: "mu-tile-label" }, li, label);
      el("span", { class: "mu-tile-value" }, li, value);
      if (note) el("span", Object.assign({ class: "mu-tile-note" }, noteRaw ? { translate: "no" } : {}), li, note);
      return li;
    };
    tile(tiles, "Hours listened", fmt(s.hours), `${fmt(s.hours / 24)} days nonstop`);
    tile(tiles, "Plays", fmt(s.plays), "30 seconds or more");
    tile(tiles, "Artists", fmt(s.artists));
    tile(tiles, "Songs", fmt(s.songs), `from ${fmt(s.albums)} albums`);
    tile(tiles, "Days with music", fmt(s.days));
    tile(tiles, "Per listening day", duration(s.minPerDay), "on average");
    tile(tiles, "Skipped", pct(s.skipRate), "of plays");
    tile(tiles, "On shuffle", pct(s.shuffle), "of plays");

    const rec = $("mu-records");
    rec.replaceChildren();
    if (s.streak) tile(rec, "Longest streak", `${fmt(s.streak.days)} days in a row`,
      s.streak.days > 1 ? `${niceDate(s.streak.from)} to ${niceDate(s.streak.to)}` : niceDate(s.streak.from));
    if (s.bigDay) tile(rec, "Biggest day", duration(s.bigDay.min), niceDate(s.bigDay.date));
    if (s.session) tile(rec, "Longest session", duration(s.session.min), `without a 30-minute break, ${niceDate(s.session.date)}`);
    if (s.repeat) {
      const li = tile(rec, "Most on repeat", `${fmt(s.repeat.n)} plays in a day`);
      const note = el("span", { class: "mu-tile-note" }, li);
      el("span", { translate: "no" }, note, `${s.repeat.track} · ${s.repeat.artist}`);
      el("span", { class: "mu-tile-note" }, li, niceDate(s.repeat.date));
    }
  }

  function renderTop() {
    const v = view();
    barList($("mu-artists"), v.artists.map(([a, h, n]) => ({
      label: a, raw: true, value: h, valueText: hrs(h) + " h",
      tip: [{ t: a, no: true }, hoursText(h), playsText(n)]
    })));
    barList($("mu-songs"), v.songs.map(([t, a, n, h]) => ({
      label: t, raw: true, sub: a, subRaw: true, value: n, valueText: fmt(n),
      tip: [{ t, no: true }, { t: a, no: true }, playsText(n), hoursText(h)]
    })));
    barList($("mu-albums"), v.albums.map(([al, a, h]) => ({
      label: al, raw: true, sub: a, subRaw: true, value: h, valueText: hrs(h) + " h",
      tip: [{ t: al, no: true }, { t: a, no: true }, hoursText(h)]
    })));
  }

  function renderTimeline() {
    const box = $("mu-timeline");
    if (current === "all") {
      $("mu-timeline-title").textContent = "Hours listened each month";
      $("mu-timeline-sub").textContent = `Every month since ${monthLabel(D.allTime.monthly[0][0])}`;
      const rows = D.allTime.monthly;
      lines(box, {
        keys: rows.map(r => r[0]),
        series: [{ name: "Hours", values: rows.map(r => r[1]), colour: "var(--mu-accent)" }],
        area: true,
        height: 240,
        tickLabel: i => {
          const [y, m] = rows[i][0].split("-");
          const narrow = box.clientWidth < 560;
          return m === "01" && (!narrow || Number(y) % 2 === 0) ? y : "";
        },
        tip: i => [monthLabel(rows[i][0]), hoursText(rows[i][1]), playsText(rows[i][2])]
      });
    } else {
      $("mu-timeline-title").textContent = "Hours listened each month";
      $("mu-timeline-sub").textContent = `In ${current}`;
      const mins = view().months;
      const narrow = box.clientWidth < 420;
      columns(box, {
        labels: MONTHS,
        values: mins.map(v => v / 60),
        tickLabel: i => (narrow ? MONTHS[i][0] : MONTHS[i]),
        tip: i => [`${MONTHS[i]} ${current}`, hoursText(Math.round(mins[i] / 6) / 10)]
      });
    }
  }

  function renderHeat() {
    const box = $("mu-heat");
    const heat = view().heat;
    const max = Math.max(...heat.flat(), 1);
    const left = 38, top = 6, bottom = 22;
    const cw = Math.max(16, Math.floor((Math.max(box.clientWidth, 300) - left) / 24));
    const ch = Math.max(16, Math.round(cw * 0.75));
    const W = left + cw * 24;
    const H = top + ch * 7 + bottom;
    const svg = svgIn(box, W, H);
    heat.forEach((row, d) => {
      sv("text", { x: left - 8, y: top + ch * d + ch / 2 + 4, "text-anchor": "end" }, svg, DAYS[d]);
      row.forEach((min, hr) => {
        const cell = sv("rect", {
          x: left + cw * hr + 1, y: top + ch * d + 1, width: cw - 2, height: ch - 2, rx: 3,
          fill: shade(min / max)
        }, svg);
        withTip(cell, [`${DAY_NAMES[d]}, ${hourName(hr)} to ${hourName((hr + 1) % 24)}`, hoursText(Math.round(min / 6) / 10)]);
      });
    });
    for (let hr = 0; hr < 24; hr += 3) {
      sv("text", { x: left + cw * hr + cw / 2, y: H - 6, "text-anchor": "middle" }, svg, hourName(hr));
    }
  }

  function hourName(h) {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  }

  function renderHoursAndDays() {
    const heat = view().heat;
    const byHour = Array.from({ length: 24 }, (_, h) => heat.reduce((s, row) => s + row[h], 0) / 60);
    const box = $("mu-hours");
    columns(box, {
      labels: byHour.map((_, h) => hourName(h)),
      values: byHour,
      height: 190,
      tickLabel: h => (h % (box.clientWidth < 420 ? 6 : 3) === 0 ? hourName(h) : ""),
      tip: h => [`${hourName(h)} to ${hourName((h + 1) % 24)}`, hoursText(Math.round(byHour[h] * 10) / 10)]
    });
    const byDay = heat.map(row => row.reduce((a, b) => a + b, 0) / 60);
    barList($("mu-weekdays"), byDay.map((h, d) => ({
      label: DAY_NAMES[d], value: h, valueText: hrs(h) + " h",
      tip: [DAY_NAMES[d], hoursText(Math.round(h * 10) / 10)]
    })), { noRank: true });
  }

  // GitHub-style calendar: a column per week, Monday at the top.
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
    const cell = 11, gap = 2, step = cell + gap, left = 30, top = 16;

    years.forEach(y => {
      const days = D.views[y].days || {};
      if (years.length > 1) el("div", { class: "mu-cal-year" }, box, y);
      const jan1 = new Date(Date.UTC(Number(y), 0, 1));
      const offset = (jan1.getUTCDay() + 6) % 7; // Monday = 0
      const total = (Number(y) % 4 === 0 && (Number(y) % 100 !== 0 || Number(y) % 400 === 0)) ? 366 : 365;
      const weeks = Math.ceil((offset + total) / 7);
      const svg = sv("svg", { width: left + weeks * step, height: top + 7 * step, role: "img", "aria-label": `Listening each day in ${y}` }, box);
      [0, 2, 4].forEach(d => sv("text", { x: left - 6, y: top + d * step + cell - 1, "text-anchor": "end" }, svg, DAYS[d]));
      let lastMonth = -1;
      for (let i = 0; i < total; i++) {
        const date = new Date(jan1.getTime() + i * 864e5);
        const pos = offset + i;
        const wk = Math.floor(pos / 7), dow = pos % 7;
        const iso = date.toISOString().slice(0, 10);
        const min = days[iso] || 0;
        const r = sv("rect", { x: left + wk * step, y: top + dow * step, width: cell, height: cell, rx: 2, fill: colour(level(min)) }, svg);
        withTip(r, [niceDate(iso), min ? duration(min) : "Nothing played"]);
        const mo = date.getUTCMonth();
        if (mo !== lastMonth && dow < 7) {
          lastMonth = mo;
          sv("text", { x: left + wk * step, y: top - 5 }, svg, MONTHS[mo]);
        }
      }
    });

    const scale = $("mu-cal-scale");
    scale.replaceChildren();
    el("span", null, scale, "Less");
    for (let l = 0; l <= 5; l++) el("i", null, scale).style.background = colour(l);
    el("span", null, scale, "More");
  }

  function renderDevices() {
    const box = $("mu-devices");
    box.replaceChildren();
    const rows = view().devices.slice().sort((a, b) => DEVICE_ORDER.indexOf(a[0]) - DEVICE_ORDER.indexOf(b[0]));
    const total = rows.reduce((s, r) => s + r[1], 0) || 1;
    const bar = el("div", { class: "mu-seg" }, box);
    rows.forEach(([d, h]) => {
      const seg = el("span", null, bar);
      seg.style.flex = String(h / total);
      seg.style.background = DEVICE_COLOUR[d] || "var(--mu-unknown)";
      withTip(seg, [d, `${pct(100 * h / total)} · ${hoursText(h)}`]);
    });
    legend(el("div", { class: "mu-legend" }, box), rows.map(([d, h]) => ({
      label: d, colour: DEVICE_COLOUR[d] || "var(--mu-unknown)", note: pct(100 * h / total)
    })));
  }

  function renderReasons() {
    [["mu-starts", view().starts], ["mu-ends", view().ends]].forEach(([id, rows]) => {
      const total = rows.reduce((s, r) => s + r[1], 0) || 1;
      barList($(id), rows.slice(0, 8).map(([why, n]) => ({
        label: why, value: n, valueText: pct(100 * n / total),
        tip: [why, `${pct(100 * n / total)} · ${playsText(n)}`]
      })), { noRank: true });
    });
  }

  // ---------- across the years ----------

  const isCurrentYear = i => current === "all" || YEARS[i] === current;
  const pickYear = i => { choose(YEARS[i] === current ? "all" : YEARS[i]); window.scrollTo({ top: 0, behavior: "smooth" }); };

  function renderYearly() {
    const rows = D.allTime.yearly;
    columns($("mu-yearly"), {
      labels: rows.map(r => String(r.year)),
      values: rows.map(r => r.hours),
      height: 220,
      highlight: isCurrentYear,
      onPick: pickYear,
      tickLabel: i => (($("mu-yearly").clientWidth < 420 && rows.length > 6) ? "’" + String(rows[i].year).slice(2) : String(rows[i].year)),
      tip: i => [String(rows[i].year), hoursText(rows[i].hours), playsText(rows[i].plays), "Click to see this year"]
    });
  }

  function renderBump() {
    const { artists, ranks } = D.allTime.bump;
    const LIMIT = 25;
    const colours = artists.map((_, i) => `var(--mu-s${i + 1})`);
    legend($("mu-bump-legend"), artists.map((a, i) => ({ label: a, raw: true, colour: colours[i], line: true })));
    const box = $("mu-bump");
    const W = Math.max(300, box.clientWidth);
    const narrow = W < 560;
    const m = { l: 34, r: narrow ? 12 : 120, t: 12, b: 24 };
    const H = 400;
    const svg = svgIn(box, W, H);
    const n = YEARS.length;
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const x = i => m.l + (pw * i) / (n - 1);
    const y = r => m.t + (ph * (r - 1)) / (LIMIT - 1);
    [1, 5, 10, 15, 20, 25].forEach(r => {
      sv("line", { x1: m.l, x2: m.l + pw, y1: y(r), y2: y(r), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 8, y: y(r) + 4, "text-anchor": "end" }, svg, "#" + r);
    });
    YEARS.forEach((yr, i) => {
      const t = sv("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, svg, narrow ? "’" + yr.slice(2) : yr);
      if (current !== "all" && yr === current) t.setAttribute("class", "mu-label");
    });
    if (current !== "all") {
      const i = YEARS.indexOf(current);
      sv("rect", { x: x(i) - 12, y: m.t - 8, width: 24, height: ph + 16, rx: 6, fill: "var(--mu-empty)" }, svg).style.opacity = "0.8";
    }
    artists.forEach((a, k) => {
      const ok = ranks[a].map(r => (r && r <= LIMIT ? r : null));
      let d = "";
      ok.forEach((r, i) => {
        if (r === null) return;
        d += (i > 0 && ok[i - 1] !== null ? "L" : "M") + x(i).toFixed(1) + "," + y(r).toFixed(1);
      });
      sv("path", { d, fill: "none", stroke: colours[k], "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    });
    artists.forEach((a, k) => {
      ranks[a].forEach((r, i) => {
        if (!r || r > LIMIT) return;
        const dot = sv("circle", { cx: x(i), cy: y(r), r: 4.5, fill: colours[k], stroke: "var(--mu-surface)", "stroke-width": 2 }, svg);
        const hit = sv("circle", { cx: x(i), cy: y(r), r: 9, class: "mu-hit" }, svg);
        withTip(hit, [{ t: a, no: true }, `#${r} in ${YEARS[i]}`]);
        void dot;
      });
      // Name at the right end, for artists still in the last year's top 25.
      const last = ranks[a][n - 1];
      if (!narrow && last && last <= LIMIT) {
        const t = sv("text", { x: x(n - 1) + 10, y: y(last) + 4, class: "mu-label", translate: "no" }, svg, a.length > 15 ? a.slice(0, 14) + "…" : a);
        void t;
      }
    });
  }

  function renderDiscovery() {
    const rows = D.allTime.yearly;
    const short = id => $(id).clientWidth < 420;
    columns($("mu-new"), {
      labels: rows.map(r => String(r.year)),
      values: rows.map(r => r.newArtists),
      highlight: isCurrentYear,
      onPick: pickYear,
      tickLabel: i => (short("mu-new") ? "’" + String(rows[i].year).slice(2) : String(rows[i].year)),
      tip: i => [String(rows[i].year), `${fmt(rows[i].newArtists)} new artists`, `of ${fmt(rows[i].artists)} played`]
    });
    const series = [
      { name: "New artists that year", values: rows.map(r => r.newShare), colour: "var(--mu-s1)" },
      { name: "My top 10 artists that year", values: rows.map(r => r.top10Share), colour: "var(--mu-s2)" }
    ];
    legend($("mu-share-legend"), series.map(s => ({ label: s.name, colour: s.colour, line: true })));
    lines($("mu-share"), {
      keys: rows.map(r => String(r.year)),
      series,
      yMax: 100,
      dots: true,
      yText: v => v + "%",
      tickLabel: i => (short("mu-share") ? "’" + String(rows[i].year).slice(2) : String(rows[i].year)),
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
      yText: v => v + "%",
      height: 200,
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
    const H = 230;
    const m = { l: 42, r: 6, t: 10, b: 24 };
    const svg = svgIn(box, W, H);
    const ph = H - m.t - m.b, pw = W - m.l - m.r;
    const y = v => m.t + ph - (v / 100) * ph;
    [0, 25, 50, 75, 100].forEach(v => {
      sv("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: "mu-gridline" }, svg);
      sv("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end" }, svg, v + "%");
    });
    const used = new Set();
    const band = pw / YEARS.length;
    const bw = Math.min(24, band * 0.72);
    YEARS.forEach((yr, i) => {
      const rows = D.views[yr].devices.slice().sort((a, b) => DEVICE_ORDER.indexOf(a[0]) - DEVICE_ORDER.indexOf(b[0]));
      const total = rows.reduce((s, r) => s + r[1], 0) || 1;
      const cx = m.l + band * i + band / 2;
      let acc = 0;
      rows.forEach(([d, h], j) => {
        used.add(d);
        const share = (100 * h) / total;
        const y0 = y(acc), y1 = y(acc + share);
        acc += share;
        const hgt = y0 - y1 - (j < rows.length - 1 ? 2 : 0); // 2px surface gap between segments
        if (hgt <= 0.3) return;
        const seg = j === rows.length - 1
          ? sv("path", { d: columnPath(cx - bw / 2, y1, bw, hgt, 4), fill: DEVICE_COLOUR[d] }, svg)
          : sv("rect", { x: cx - bw / 2, y: y1 + (j < rows.length - 1 ? 2 : 0), width: bw, height: hgt, fill: DEVICE_COLOUR[d] }, svg);
        if (current !== "all" && yr !== current) seg.style.opacity = "0.35";
        withTip(seg, [`${d}, ${yr}`, `${pct(share)} · ${hoursText(h)}`]);
      });
      const narrow = W < 420;
      sv("text", { x: cx, y: H - 6, "text-anchor": "middle" }, svg, narrow ? "’" + yr.slice(2) : yr);
    });
    legend($("mu-dev-legend"), DEVICE_ORDER.filter(d => used.has(d)).map(d => ({ label: d, colour: DEVICE_COLOUR[d] })));
  }

  function renderLoyal() {
    const box = $("mu-loyal");
    box.replaceChildren();
    D.allTime.loyal.forEach(([a, yrs, h]) => {
      const li = el("li", null, box);
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
    })), { noRank: true });
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
      link.addEventListener("click", e => { e.preventDefault(); choose(String(r.year)); window.scrollTo({ top: 0, behavior: "smooth" }); });
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
    renderYears();
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
    renderAll();
  }

  $("mu-range").textContent = `From my Spotify history, ${niceDate(D.meta.from)} to ${niceDate(D.meta.to)}.`;
  const asked = new URLSearchParams(location.search).get("year");
  current = YEARS.includes(asked) ? asked : "all";
  renderAll();

  // Redraw the SVG charts when the page width changes (they're drawn to fit).
  let lastWidth = document.querySelector("main.mu").clientWidth;
  let timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = document.querySelector("main.mu").clientWidth;
      if (w !== lastWidth) { lastWidth = w; renderAll(); }
    }, 150);
  });
})();
