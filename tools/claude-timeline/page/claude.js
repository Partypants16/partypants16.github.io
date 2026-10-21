// The Claude page: every session log from parth_project/_workspace/context/sessions/ as
// a timeline of cards, newest first. Each card shows the clean summary from
// the log's frontmatter, and opens to the raw log underneath.
//
// Only on the remote box (http://192.168.212.60:8120, LAN only), because the
// raw logs hold everything. data.json is made by build.py. The website's
// claude.html sends visitors here when they're on home Wi-Fi.
//
// Filters, search, order and "show all raw logs" are kept in the address
// (?q=…&project=…&type=…&status=…&month=…&sort=old&raw=1), and #<log name>
// opens that card.

(function () {
  const SITE_URL = "https://partypants16.github.io/";
  // The page's files are also in the public repo, without data. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace(SITE_URL + "claude.html");
    return;
  }

  const $ = id => document.getElementById(id);
  const ui = {
    stats: $("stats"), controls: $("controls"), message: $("message"), empty: $("filter-empty"),
    timeline: $("timeline"), count: $("filter-count"), rawAll: $("raw-all"), reset: $("filter-reset"),
    search: $("filter-search"), project: $("filter-project"), type: $("filter-type"),
    status: $("filter-status"), month: $("filter-month"), sort: $("filter-sort"), built: $("built")
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  const DAY = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const DAY_YEAR = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const MONTH = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  const asDate = iso => new Date(iso + "T00:00:00Z");
  const thisYear = String(new Date().getFullYear());
  const dayLabel = iso => (iso.slice(0, 4) === thisYear ? DAY : DAY_YEAR).format(asDate(iso)).replace(",", "");

  const hour12 = () => (window.SiteClock ? window.SiteClock.hour12() : false);  // the site-wide 12/24 h setting

  // "21:18" (from the log's frontmatter) → "21:18" or "9:18 pm", whichever the clock setting says.
  function timeLabel(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: hour12(), timeZone: "UTC" });
  }

  function builtLabel(iso) {
    const when = new Date(iso);
    if (isNaN(when)) return "";
    const time = when.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: hour12() });
    return SHORT.format(new Date(Date.UTC(when.getFullYear(), when.getMonth(), when.getDate()))) + ", " + time;
  }

  // ---------- Search ----------

  function words(query) {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
  }

  // Put text into a node, with the search words marked.
  function fill(node, text, terms) {
    node.textContent = "";
    if (!terms.length) {
      node.textContent = text;
      return;
    }
    const pattern = new RegExp("(" + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi");
    text.split(pattern).forEach((piece, i) => {
      node.appendChild(i % 2 ? el("mark", "", piece) : document.createTextNode(piece));
    });
  }

  // Mark the search words inside rendered HTML (the raw log).
  function markIn(root, terms) {
    if (!terms.length) return;
    const pattern = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue;
      pattern.lastIndex = 0;
      if (!pattern.test(text)) return;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(pattern, (match, offset) => {
        frag.appendChild(document.createTextNode(text.slice(last, offset)));
        frag.appendChild(el("mark", "", match));
        last = offset + match.length;
      });
      frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // ---------- State ----------

  let data = null;
  const cards = new Map();   // id → { entry, node, parts, open, rawShown }
  const state = { q: "", project: "", type: "", status: "", month: "", sort: "new", raw: false };

  function readAddress() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    state.project = params.get("project") || "";
    state.type = params.get("type") || "";
    state.status = params.get("status") || "";
    state.month = params.get("month") || "";
    state.sort = params.get("sort") === "old" ? "old" : "new";
    state.raw = params.get("raw") === "1";
  }

  function writeAddress() {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    ["project", "type", "status", "month"].forEach(key => { if (state[key]) params.set(key, state[key]); });
    if (state.sort === "old") params.set("sort", "old");
    if (state.raw) params.set("raw", "1");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }

  function matches(entry, terms) {
    if (state.project && !entry.projects.includes(state.project)) return false;
    if (state.type && entry.type !== state.type) return false;
    if (state.status && entry.status !== state.status) return false;
    if (state.month && entry.date.slice(0, 7) !== state.month) return false;
    return terms.every(t => entry.search.includes(t) || entry.searchRaw.includes(t));
  }

  // ---------- Cards ----------

  function buildCard(entry) {
    const node = el("article", "entry");
    node.id = entry.id;

    const meta = el("div", "entry-meta");
    const projects = el("span", "entry-projects");
    projects.setAttribute("translate", "no");
    entry.projects.forEach((name, i) => projects.appendChild(el("span", "chip" + (i ? "" : " chip--main"), name)));
    meta.appendChild(projects);
    if (entry.type) meta.appendChild(el("span", "badge badge--type", entry.type));
    if (entry.status) {
      const status = el("span", "badge badge--status", entry.status);
      status.dataset.status = slug(entry.status);
      meta.appendChild(status);
    }
    if (!entry.complete) meta.appendChild(el("span", "badge badge--todo", "No summary yet"));
    let time = null;
    if (entry.time) {
      time = el("time", "entry-time", timeLabel(entry.time));
      time.dateTime = entry.date + "T" + entry.time;
      time.setAttribute("translate", "no");
      meta.appendChild(time);
    }
    node.appendChild(meta);

    const title = el("h3", "entry-title");
    title.setAttribute("translate", "no");
    node.appendChild(title);
    const summary = el("p", "entry-summary");
    summary.setAttribute("translate", "no");
    if (entry.summary) node.appendChild(summary);
    const hit = el("p", "entry-hit", "Found in the raw log");
    hit.hidden = true;
    node.appendChild(hit);

    const toggle = el("button", "entry-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "raw-" + entry.id);
    const label = el("span", "", "Show raw log");
    toggle.append(label, el("span", "entry-words", plural(entry.words, "word")));
    node.appendChild(toggle);

    const raw = el("div", "entry-raw");
    raw.id = "raw-" + entry.id;
    raw.hidden = true;
    node.appendChild(raw);

    const card = { entry, node, parts: { title, summary, hit, toggle, label, raw, time }, open: false, rawShown: null };
    toggle.addEventListener("click", () => {
      setOpen(card, !card.open);
      syncRawAll();
    });
    return card;
  }

  function fillRaw(card, terms) {
    const key = terms.join(" ");
    if (card.rawShown === key) return;
    const { raw } = card.parts;
    const { entry } = card;
    raw.textContent = "";
    if (entry.log) {
      const index = el("section", "raw-index");
      index.appendChild(el("p", "raw-label", "In the log index"));
      const body = el("div", "markdown");
      body.setAttribute("translate", "no");
      body.innerHTML = entry.log;
      index.appendChild(body);
      raw.appendChild(index);
    }
    const label = el("p", "raw-label", "The session log");
    raw.appendChild(label);
    const body = el("div", "markdown raw-body");
    body.setAttribute("translate", "no");
    body.innerHTML = entry.raw;
    raw.appendChild(body);
    const file = el("p", "raw-file", entry.file);
    file.setAttribute("translate", "no");
    raw.appendChild(file);
    markIn(raw, terms);
    card.rawShown = key;
  }

  function setOpen(card, open) {
    card.open = open;
    if (open) fillRaw(card, words(state.q));
    card.parts.raw.hidden = !open;
    card.parts.toggle.setAttribute("aria-expanded", String(open));
    card.parts.label.textContent = open ? "Hide raw log" : "Show raw log";
    card.node.classList.toggle("is-open", open);
  }

  function visibleCards() {
    return [...cards.values()].filter(card => !card.node.hidden && card.node.isConnected);
  }

  function syncRawAll() {
    const shown = visibleCards();
    state.raw = shown.length > 0 && shown.every(card => card.open);
    ui.rawAll.textContent = state.raw ? "Hide all raw logs" : "Show all raw logs";
    ui.rawAll.setAttribute("aria-pressed", String(state.raw));
    writeAddress();
  }

  // ---------- Drawing ----------

  function render() {
    const terms = words(state.q);
    const shown = data.entries.filter(entry => matches(entry, terms));
    if (state.sort === "old") shown.reverse();

    ui.timeline.textContent = "";
    let day = null;
    let list = null;
    shown.forEach(entry => {
      if (!day || day.dataset.date !== entry.date) {
        day = el("section", "day");
        day.dataset.date = entry.date;
        const head = el("h2", "day-head");
        const time = el("time", "", dayLabel(entry.date));
        time.dateTime = entry.date;
        time.setAttribute("translate", "no");
        head.append(time, el("span", "day-count", plural(shown.filter(e => e.date === entry.date).length, "session")));
        day.appendChild(head);
        list = el("div", "day-cards");
        day.appendChild(list);
        ui.timeline.appendChild(day);
      }
      const card = cards.get(entry.id);
      fill(card.parts.title, entry.title, terms);
      if (entry.summary) fill(card.parts.summary, entry.summary, terms);
      card.parts.hit.hidden = !terms.length || terms.every(t => entry.search.includes(t));
      if (state.raw && !card.open) setOpen(card, true);
      if (card.open) fillRaw(card, terms);
      list.appendChild(card.node);
    });

    const total = data.entries.length;
    ui.count.textContent = shown.length === total ? "Showing all " + plural(total, "session") : "Showing " + shown.length + " of " + plural(total, "session");
    ui.empty.hidden = shown.length > 0;
    ui.rawAll.disabled = shown.length === 0;
    if (shown.length) syncRawAll();
    else writeAddress();
  }

  // items: [{ key, label, count, noTranslate }]
  function setOptions(select, allLabel, items, current) {
    select.textContent = "";
    const all = el("option", "", allLabel);
    all.value = "";
    select.appendChild(all);
    items.forEach(item => {
      const option = el("option", "", item.label + " (" + item.count + ")");
      option.value = item.key;
      if (item.noTranslate) option.setAttribute("translate", "no");
      select.appendChild(option);
    });
    select.value = items.some(item => item.key === current) ? current : "";
  }

  function countBy(key) {
    const counts = {};
    data.entries.forEach(entry => {
      [].concat(entry[key]).forEach(value => { if (value) counts[value] = (counts[value] || 0) + 1; });
    });
    return counts;
  }

  function buildControls() {
    // Only values that some log has, in the order build.py lists them.
    const items = (names, counts, noTranslate) =>
      names.filter(n => counts[n]).map(n => ({ key: n, label: n, count: counts[n], noTranslate }));
    setOptions(ui.project, "All projects", items(data.projects, countBy("projects"), true), state.project);
    setOptions(ui.type, "Any type", items(data.types, countBy("type")), state.type);
    setOptions(ui.status, "Any status", items(data.statuses, countBy("status")), state.status);

    const months = {};
    data.entries.forEach(entry => { const m = entry.date.slice(0, 7); months[m] = (months[m] || 0) + 1; });
    const monthItems = Object.keys(months).sort().reverse()
      .map(m => ({ key: m, label: MONTH.format(asDate(m + "-01")), count: months[m] }));
    setOptions(ui.month, "Any time", monthItems, state.month);
    ui.search.value = state.q;
    ui.sort.value = state.sort;

    const onChange = () => {
      state.q = ui.search.value.trim();
      state.project = ui.project.value;
      state.type = ui.type.value;
      state.status = ui.status.value;
      state.month = ui.month.value;
      state.sort = ui.sort.value;
      render();
    };
    ui.search.addEventListener("input", onChange);
    [ui.project, ui.type, ui.status, ui.month, ui.sort].forEach(select => select.addEventListener("change", onChange));
    ui.reset.addEventListener("click", () => {
      resetFilters();
      render();
    });
    // Show opens the cards on screen; Hide closes every card, filtered out or not.
    ui.rawAll.addEventListener("click", () => {
      if (state.raw) cards.forEach(card => setOpen(card, false));
      else visibleCards().forEach(card => setOpen(card, true));
      syncRawAll();
    });
  }

  function resetFilters() {
    state.q = state.project = state.type = state.status = state.month = "";
    ui.search.value = "";
    [ui.project, ui.type, ui.status, ui.month].forEach(select => { select.value = ""; });
  }

  function buildStats() {
    const entries = data.entries;
    const dates = entries.map(e => e.date).sort();
    const days = new Set(dates).size;
    ui.stats.textContent = "";
    const line = el("span");
    const range = el("span", "", SHORT.format(asDate(dates[0])) + " – " + SHORT.format(asDate(dates[dates.length - 1])));
    range.setAttribute("translate", "no");
    line.append(el("span", "", plural(entries.length, "session") + " · " + plural(days, "day") + " · "), range);
    ui.stats.append(line);

    // Quick filters for what still needs something from Parth.
    const statuses = countBy("status");
    const quick = el("span", "stat-quick");
    ["Needs testing", "Open", "Parked"].forEach(name => {
      if (!statuses[name]) return;
      const button = el("button", "stat-chip", name + ": " + statuses[name]);
      button.type = "button";
      button.dataset.status = slug(name);
      button.addEventListener("click", () => {
        resetFilters();
        state.status = name;
        ui.status.value = name;
        render();
        ui.controls.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      quick.appendChild(button);
    });
    if (quick.children.length) ui.stats.appendChild(quick);

    showBuilt();
  }

  function showBuilt() {
    const when = builtLabel(data.built);
    ui.built.textContent = when ? "Updated " + when : "";
  }

  // The clock setting changed (12/24 h): redo every time shown.
  document.addEventListener("clockchange", () => {
    if (!data) return;
    cards.forEach(card => { if (card.parts.time) card.parts.time.textContent = timeLabel(card.entry.time); });
    showBuilt();
  });

  // ---------- Jumping to a card ----------

  function jumpTo(id, smooth) {
    let card = cards.get(id);
    if (!card) return false;
    if (!card.node.isConnected) {
      resetFilters();
      render();
    }
    setOpen(card, true);
    syncRawAll();
    history.replaceState(null, "", location.pathname + location.search + "#" + id);
    card.node.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    card.node.classList.remove("is-flash");
    void card.node.offsetWidth;
    card.node.classList.add("is-flash");
    return true;
  }

  ui.timeline.addEventListener("click", event => {
    const link = event.target.closest("a.session-link");
    if (!link) return;
    if (jumpTo(link.dataset.session, true)) event.preventDefault();
  });

  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (cards.has(id)) jumpTo(id, true);
  });

  // ---------- Start ----------

  function fail(text) {
    ui.message.textContent = text;
    ui.message.hidden = false;
  }

  readAddress();
  fetch("data.json", { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(json => {
      data = json;
      if (!data.entries || !data.entries.length) {
        fail("There are no session logs yet.");
        return;
      }
      data.entries.forEach(entry => cards.set(entry.id, buildCard(entry)));
      buildStats();
      buildControls();
      ui.controls.hidden = false;
      render();
      const id = decodeURIComponent(location.hash.slice(1));
      if (cards.has(id)) jumpTo(id, false);
    })
    .catch(() => fail("Couldn't load the session logs. Try reloading the page."));
})();
