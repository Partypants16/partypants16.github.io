// The Usage tab (since 2026-11-04): Claude Code use per day, from usage-data.json, which
// build.py makes from the ledger that tools/claude-timeline/usage.py keeps (ccusage, merged
// so days survive Claude deleting old chats). A Parth | Mridul | Both switch picks whose rows
// count; Both adds "Other" (test runs in temporary folders). Costs are API-equivalent
// estimates, not a bill.

(function () {
  // The page's files are also in the public repo, without data. Send anyone who finds them
  // there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace("https://partypants16.github.io/usage.html");
    return;
  }

  const SERIES = {
    Parth: { label: "Parth", color: "var(--series-parth)" },
    Mridul: { label: "Mridul", color: "var(--series-mridul)" },
    Other: { label: "Other (test runs)", color: "var(--series-other)" },
  };
  const DAY = 86400000;
  const SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  const LONG = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  const asDate = iso => new Date(iso + "T00:00:00Z");
  const isoDay = date => date.toISOString().slice(0, 10);

  const params = new URLSearchParams(location.search);
  const person = { mridul: "Mridul", both: "Both" }[params.get("person")] || "Parth";
  const state = { range: "30", measure: "cost" };
  let data = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function data_(text) {  // a number or name: keep it out of the Hinglish translation
    const span = el("span", "", text);
    span.setAttribute("translate", "no");
    return span;
  }

  function tokens(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(Math.round(n));
  }

  function money(n) {
    return "US$" + n.toLocaleString("en-AU", { maximumFractionDigits: n >= 100 ? 0 : 2, minimumFractionDigits: n >= 100 ? 0 : 2 });
  }

  const value = row => state.measure === "cost" ? row.totalCost : row.totalTokens;
  const show = n => state.measure === "cost" ? money(n) : tokens(n);

  // ---------------------------------------------------------------- rows in view

  function seriesInView() {
    return person === "Both" ? ["Parth", "Mridul", "Other"] : [person];
  }

  function rowsInView() {
    const who = new Set(seriesInView());
    const rows = data.rows.filter(r => who.has(r.person));
    if (state.range === "all") return rows;
    const end = asDate(lastDay());
    const start = isoDay(new Date(end - (Number(state.range) - 1) * DAY));
    return rows.filter(r => r.date >= start);
  }

  function lastDay() {
    const today = isoDay(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
    const newest = data.rows.reduce((m, r) => r.date > m ? r.date : m, "");
    return newest > today ? newest : today;
  }

  function daysInView(rows) {
    const end = asDate(lastDay());
    const first = state.range === "all"
      ? asDate(data.rows.reduce((m, r) => r.date < m ? r.date : m, lastDay()))
      : new Date(end - (Number(state.range) - 1) * DAY);
    const days = [];
    for (let t = first.getTime(); t <= end.getTime(); t += DAY) days.push(isoDay(new Date(t)));
    const byDay = new Map(days.map(d => [d, {}]));
    rows.forEach(r => {
      const slot = byDay.get(r.date);
      if (slot) slot[r.person] = (slot[r.person] || 0) + value(r);
    });
    return days.map(d => ({ date: d, values: byDay.get(d) }));
  }

  // ---------------------------------------------------------------- tiles

  function tiles(rows) {
    const box = document.getElementById("tiles");
    box.textContent = "";
    const sum = key => rows.reduce((s, r) => s + r[key], 0);
    const total = sum("totalTokens");
    const active = new Set(rows.filter(r => r.totalTokens > 0).map(r => r.date)).size;
    // [label, big number, caption]: a caption is text, or [number, text after it]
    const items = [
      ["Cost (API prices)", money(sum("totalCost")), "An estimate, not a bill"],
      ["Tokens", tokens(total), [tokens(sum("inputTokens") + sum("outputTokens")), "new, the rest cache"]],
      ["Days used", String(active), active ? [money(sum("totalCost") / active), "a day on average"] : ""],
      ["Cache reads", total ? Math.round(sum("cacheReadTokens") / total * 100) + "%" : "0%", "Of all tokens"],
    ];
    items.forEach(([label, big, sub]) => {
      const tile = el("div", "usage-tile");
      tile.append(el("span", "label", label));
      const v = data_(big);
      v.className = "value";
      tile.append(v);
      if (sub) {
        const s = el("span", "sub");
        if (Array.isArray(sub)) s.append(data_(sub[0]), " ", el("span", "", sub[1]));
        else s.textContent = sub;
        tile.append(s);
      }
      box.append(tile);
    });
  }

  // ---------------------------------------------------------------- daily chart

  function niceMax(max) {
    if (max <= 0) return 1;
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
    return 10 * step;
  }

  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function daily(rows) {
    const series = seriesInView();
    const days = daysInView(rows);
    const holder = document.getElementById("daily");
    holder.textContent = "";
    document.getElementById("dailyTitle").textContent = state.measure === "cost" ? "Cost per day" : "Tokens per day";

    const legend = document.getElementById("legend");
    legend.textContent = "";
    if (series.length > 1) series.forEach(s => {
      const item = el("span", "", SERIES[s].label);
      item.style.setProperty("--swatch", SERIES[s].color);
      legend.append(item);
    });

    // drawn at the holder's real width, so labels stay 11px on a phone (redrawn on resize)
    const W = Math.max(300, Math.round(holder.getBoundingClientRect().width)), H = W < 600 ? 220 : 260;
    const L = 56, R = 8, T = 10, B = 26;
    const plotW = W - L - R, plotH = H - T - B;
    const totals = days.map(d => series.reduce((s, k) => s + (d.values[k] || 0), 0));
    const max = niceMax(Math.max(0, ...totals));
    const y = v => T + plotH - v / max * plotH;
    const slot = plotW / days.length;
    const barW = Math.max(1, Math.min(28, slot - 2));

    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": document.getElementById("dailyTitle").textContent });
    const grid = svg("g", { class: "grid" });
    for (let i = 0; i <= 4; i++) {
      const v = max / 4 * i, yy = y(v);
      grid.append(svg("line", { x1: L, x2: W - R, y1: yy, y2: yy }));
      const t = svg("text", { x: L - 6, y: yy + 4, "text-anchor": "end", class: "tick", translate: "no" });
      t.textContent = show(v);
      grid.append(t);
    }
    root.append(grid);

    const every = Math.ceil(days.length / Math.max(2, Math.floor(plotW / 64)));
    days.forEach((d, i) => {
      const x = L + i * slot + (slot - barW) / 2;
      let base = 0;
      const stack = series.filter(k => d.values[k] > 0);
      stack.forEach((k, j) => {
        const v = d.values[k];
        const top = y(base + v), bottom = y(base);
        const h = Math.max(0, bottom - top - (j > 0 ? 2 : 0));  // 2px gap between stacked segments
        const shape = j === stack.length - 1
          ? svg("path", { d: roundedTop(x, top, barW, h, 4) })
          : svg("rect", { x, y: top, width: barW, height: h });
        shape.style.fill = SERIES[k].color;
        root.append(shape);
        base += v;
      });
      if (i % every === 0) {
        const t = svg("text", { x: x + barW / 2, y: H - 8, "text-anchor": "middle", class: "tick", translate: "no" });
        t.textContent = SHORT.format(asDate(d.date));
        root.append(t);
      }
    });
    root.append(svg("line", { class: "axis", x1: L, x2: W - R, y1: T + plotH, y2: T + plotH }));

    // hover: one hit area per day (the whole column), tooltip with every series and the total
    const tip = el("div", "usage-tip");
    tip.hidden = true;
    days.forEach((d, i) => {
      const hit = svg("rect", { class: "hit", x: L + i * slot, y: T, width: slot, height: plotH });
      const showTip = () => {
        holder.querySelectorAll(".hit.active").forEach(n => n.classList.remove("active"));
        hit.classList.add("active");
        tip.textContent = "";
        tip.append(el("b", "", LONG.format(asDate(d.date))));
        series.forEach(k => {
          const row = el("div", "row");
          const name = el("span", "", SERIES[k].label);
          if (series.length > 1) row.style.setProperty("--swatch", SERIES[k].color);
          row.append(name, data_(show(d.values[k] || 0)));
          tip.append(row);
        });
        if (series.length > 1) {
          const row = el("div", "row");
          row.append(el("span", "", "Total"), data_(show(totals[i])));
          tip.append(row);
        }
        tip.hidden = false;
        const box = holder.getBoundingClientRect();
        const cx = (L + (i + .5) * slot) / W * box.width;
        tip.style.left = Math.min(Math.max(0, cx - 80), box.width - tip.offsetWidth) + "px";
        tip.style.top = "0px";
      };
      hit.addEventListener("mouseenter", showTip);
      hit.addEventListener("click", showTip);
      root.append(hit);
    });
    root.addEventListener("mouseleave", () => {
      tip.hidden = true;
      holder.querySelectorAll(".hit.active").forEach(n => n.classList.remove("active"));
    });
    holder.append(root, tip);

    // the same numbers as a table, newest first, days with nothing left out
    const table = document.getElementById("dailyTable");
    table.textContent = "";
    const head = el("tr");
    head.append(el("th", "", "Day"), ...series.map(k => el("th", "", SERIES[k].label)));
    if (series.length > 1) head.append(el("th", "", "Total"));
    table.append(head);
    days.map((d, i) => [d, totals[i]]).filter(([, t]) => t > 0).reverse().forEach(([d, t]) => {
      const tr = el("tr");
      const day = el("td");
      day.append(data_(LONG.format(asDate(d.date))));
      tr.append(day);
      series.forEach(k => { const td = el("td"); td.append(data_(show(d.values[k] || 0))); tr.append(td); });
      if (series.length > 1) { const td = el("td"); td.append(data_(show(t))); tr.append(td); }
      table.append(tr);
    });
  }

  // ---------------------------------------------------------------- bars, months

  function bars(holderId, groups, colorOf) {
    const holder = document.getElementById(holderId);
    holder.textContent = "";
    const list = el("div", "usage-bars");
    const entries = [...groups.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = entries.length ? entries[0][1] : 1;
    entries.forEach(([key, v]) => {
      const bar = el("div", "usage-bar");
      const top = el("div", "top");
      top.append(data_(key.split("\t").pop()), data_(show(v)));
      const track = el("div", "track");
      const fill = el("div", "fill");
      fill.style.width = Math.max(1, v / max * 100) + "%";
      fill.style.setProperty("--swatch", colorOf(key));
      track.append(fill);
      bar.append(top, track);
      list.append(bar);
    });
    if (!entries.length) list.append(el("p", "usage-meta", "Nothing in this range."));
    holder.append(list);
  }

  function projects(rows) {
    const groups = new Map();
    rows.forEach(r => {
      const key = r.person + "\t" + (person === "Both" ? r.person + ": " : "") + r.project;
      groups.set(key, (groups.get(key) || 0) + value(r));
    });
    bars("projects", groups, key => SERIES[key.split("\t")[0]].color);
  }

  function models(rows) {
    const groups = new Map();
    rows.forEach(r => Object.entries(r.models || {}).forEach(([name, m]) => {
      groups.set(name, (groups.get(name) || 0) + (state.measure === "cost" ? m.cost : m.tokens));
    }));
    bars("models", groups, () => "var(--link)");
  }

  function months(rows) {
    const table = document.getElementById("months");
    table.textContent = "";
    const head = el("tr");
    ["Month", "Cost", "Tokens", "New", "Cache writes", "Cache reads", "Days used"].forEach(h => head.append(el("th", "", h)));
    table.append(head);
    const byMonth = new Map();
    rows.forEach(r => {
      const m = byMonth.get(r.date.slice(0, 7)) || { cost: 0, tokens: 0, fresh: 0, write: 0, read: 0, days: new Set() };
      m.cost += r.totalCost; m.tokens += r.totalTokens; m.fresh += r.inputTokens + r.outputTokens;
      m.write += r.cacheCreationTokens; m.read += r.cacheReadTokens;
      if (r.totalTokens > 0) m.days.add(r.date);
      byMonth.set(r.date.slice(0, 7), m);
    });
    [...byMonth.entries()].sort().reverse().forEach(([month, m]) => {
      const tr = el("tr");
      [MONTH.format(asDate(month + "-01")), money(m.cost), tokens(m.tokens), tokens(m.fresh), tokens(m.write), tokens(m.read), String(m.days.size)]
        .forEach(text => { const td = el("td"); td.append(data_(text)); tr.append(td); });
      table.append(tr);
    });
  }

  // ---------------------------------------------------------------- wiring

  function render() {
    document.querySelectorAll("[data-range]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.range === state.range)));
    document.querySelectorAll("[data-measure]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.measure === state.measure)));
    const rows = rowsInView();
    tiles(rows);
    daily(rows);
    projects(rows);
    models(rows);
    months(person === "Both" ? data.rows : data.rows.filter(r => r.person === person));
  }

  document.querySelectorAll(".person-switch a").forEach(a => {
    if (a.dataset.person === person.toLowerCase()) a.setAttribute("aria-current", "page");
  });
  document.querySelectorAll("[data-range]").forEach(b => b.addEventListener("click", () => { state.range = b.dataset.range; render(); }));
  document.querySelectorAll("[data-measure]").forEach(b => b.addEventListener("click", () => { state.measure = b.dataset.measure; render(); }));
  let resizeTimer, lastWidth = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const width = document.getElementById("daily").getBoundingClientRect().width;
      if (data && Math.abs(width - lastWidth) > 20) { lastWidth = width; daily(rowsInView()); }
    }, 150);
  });

  fetch("usage-data.json", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      data = json;
      document.getElementById("usage").hidden = false;
      render();
      const meta = document.getElementById("meta");
      meta.append("Updated ", data_(new Date(data.updated).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })),
        " from ", data_(data.ccusage), ".");
    })
    .catch(() => {
      const msg = document.getElementById("message");
      msg.textContent = "No usage record yet. It's made by usage.py at the next session close.";
      msg.hidden = false;
    });
})();
