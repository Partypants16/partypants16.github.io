// Car Shows (car-events.html): draws data/car-events.json.
// That file is made every morning by n8n on the home server (apps/n8n-home, "Car Events -
// Scraper") and comes along with the next website commit (tools/car_events/). Never hand-edit it.
// Event names, venues and source names come from the data: they're marked translate="no".
(function () {
  "use strict";

  const TZ = "Australia/Melbourne";
  const $ = id => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function data(tag, className, text) {
    const node = el(tag, className, text);
    node.setAttribute("translate", "no");
    return node;
  }

  // ---------- dates: "YYYY-MM-DD" strings, read as plain calendar days (no time zone shifts) ----------
  const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const asDate = iso => new Date(iso + "T00:00:00Z");
  const fmt = (iso, opts) => new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", ...opts }).format(asDate(iso)).replace(",", "");
  const addDays = (iso, n) => { const d = asDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const stamp = when => new Intl.DateTimeFormat("en-AU", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    hour12: window.SiteClock && typeof window.SiteClock.hour12 === "function" ? window.SiteClock.hour12() : true }).format(new Date(when));

  // This weekend: Saturday and Sunday of this week (on a Sunday, just today).
  function weekend(today) {
    const dow = asDate(today).getUTCDay();          // 0 Sun .. 6 Sat
    if (dow === 0) return [today, today];
    const sat = addDays(today, 6 - dow);
    return [sat, addDays(sat, 1)];
  }
  const overlaps = (e, from, to) => e.start <= to && (e.end || e.start) >= from;

  // ---------- pieces ----------
  function sourceChip(s, staleAfterDays) {
    const li = el("li", "ce-source");
    const a = data("a", "ce-source-name", s.name);
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    li.appendChild(a);
    li.appendChild(el("span", "ce-source-count", s.count === 1 ? "1 event" : s.count + " events"));
    const stale = !s.lastOk || (Date.now() - new Date(s.lastOk).getTime()) > staleAfterDays * 864e5;
    if (s.status !== "ok" || stale) {
      li.classList.add("is-stale");
      li.appendChild(el("span", "ce-source-status", s.lastOk ? "Not updating since " + stamp(s.lastOk) : "Not updating"));
    }
    return li;
  }

  function card(e, names) {
    const article = el("article", "ce-card");
    const badge = el("div", "ce-date");
    badge.setAttribute("translate", "no");
    badge.append(el("span", "ce-dow", fmt(e.start, { weekday: "short" })), el("span", "ce-day", fmt(e.start, { day: "numeric" })),
      el("span", "ce-mon", fmt(e.start, { month: "short" })));
    article.appendChild(badge);

    const body = el("div", "ce-body");
    const h = el("h3", "ce-name");
    const link = data("a", null, e.name);
    link.href = e.links[0].url;
    link.target = "_blank";
    link.rel = "noopener";
    h.appendChild(link);
    body.appendChild(h);

    const where = [e.venue, e.suburb].filter(Boolean).join(", ");
    if (where) body.appendChild(data("p", "ce-where", where));
    const when = [];
    if (e.end) when.push(el("span", null, "to " + fmt(e.end, { weekday: "short", day: "numeric", month: "short" })));
    if (e.time) when.push(data("span", null, e.time));
    if (when.length) {
      const p = el("p", "ce-when");
      when.forEach((w, i) => { if (i) p.appendChild(document.createTextNode(" · ")); p.appendChild(w); });
      body.appendChild(p);
    }

    const foot = el("div", "ce-foot");
    foot.appendChild(el("span", "ce-cat", e.category || "Other"));
    for (const l of e.links) {
      const a = data("a", "ce-link", (names[l.source] || l.source) + " ↗");
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener";
      foot.appendChild(a);
    }
    body.appendChild(foot);
    article.appendChild(body);
    return article;
  }

  function section(title, events, names, emptyText) {
    const s = el("section", "ce-section");
    s.appendChild(el("h2", "ce-head", title));
    if (!events.length) {
      s.appendChild(el("p", "ce-none", emptyText));
      return s;
    }
    const grid = el("div", "ce-grid card-container");
    events.forEach(e => grid.appendChild(card(e, names)));
    s.appendChild(grid);
    return s;
  }

  // ---------- page ----------
  let all = [];
  let names = {};
  let filter = "All";

  function render() {
    const list = $("ce-list");
    list.textContent = "";
    const today = todayIso();
    const shown = all.filter(e => filter === "All" || e.category === filter);
    const [sat, sun] = weekend(today);
    const thisWeekend = shown.filter(e => overlaps(e, sat, sun));
    const beforeWeekend = shown.filter(e => !thisWeekend.includes(e) && e.start < sat);
    const later = shown.filter(e => !thisWeekend.includes(e) && !beforeWeekend.includes(e));

    $("ce-empty").hidden = all.length > 0;
    if (!all.length) return;
    if (beforeWeekend.length) list.appendChild(section("Before the weekend", beforeWeekend, names, ""));
    list.appendChild(section("This weekend", thisWeekend, names, "Nothing listed for this weekend."));

    // Coming up, one heading per month
    const months = new Map();
    for (const e of later) {
      const key = e.start.slice(0, 7);
      if (!months.has(key)) months.set(key, []);
      months.get(key).push(e);
    }
    if (!later.length) {
      list.appendChild(section("Coming up", [], names, filter === "All" ? "Nothing else listed yet." : "No events of this type coming up."));
    }
    let first = true;
    for (const [key, events] of months) {
      const s = section(first ? "Coming up" : "", events, names, "");
      first = false;
      const label = data("h3", "ce-month", fmt(key + "-01", { month: "long", year: "numeric" }));
      const head = s.querySelector(".ce-head");
      if (!head.textContent) head.remove();
      s.insertBefore(label, s.querySelector(".ce-grid"));
      list.appendChild(s);
    }
  }

  function filters(categories) {
    const box = $("ce-filters");
    box.textContent = "";
    for (const c of ["All", ...categories]) {
      const b = el("button", "ce-filter", c);
      b.type = "button";
      b.setAttribute("aria-pressed", String(c === filter));
      b.addEventListener("click", () => {
        filter = c;
        box.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        render();
      });
      box.appendChild(b);
    }
    box.hidden = categories.length < 2;
  }

  async function load() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch("data/car-events.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const file = await response.json();
      const today = todayIso();
      all = (file.events || []).filter(e => e && e.name && e.start && (e.end || e.start) >= today && e.links && e.links.length)
        .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
      names = Object.fromEntries((file.sources || []).map(s => [s.id, s.name]));

      const sources = $("ce-sources");
      (file.sources || []).forEach(s => sources.appendChild(sourceChip(s, 3)));

      if (file.generatedAt) {
        $("ce-updated").textContent = "Updated " + stamp(file.generatedAt);
        $("ce-updated").hidden = false;
      }
      const cats = [...new Set(all.map(e => e.category || "Other"))].sort((a, b) => (a === "Other") - (b === "Other") || a.localeCompare(b));
      filters(cats);
      render();
    } catch (err) {
      $("ce-error").hidden = false;
    } finally {
      clearTimeout(timer);
      $("ce-loading").hidden = true;
    }
  }

  $("year").textContent = new Date().getFullYear();
  load();
})();
