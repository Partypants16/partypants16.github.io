// The Eunomia page: what Claude and Codex remember about Parth's projects, from
// eunomia-data.json. That file is a snapshot made on the laptop by
// `_workspace/eunomia/scripts/eunomia.py snapshot` and copied in by build.py,
// so the page works when the laptop (and Eunomia) is off.
//
// Facts are grouped by project (vault), then by what they're about (their
// subject entity). Eunomia records no links between subjects yet, so there's
// no map: the grouping is just grouping. Who saved a fact and its status come
// from the tag at the start of its text, which build_snapshot() splits out.
// Everything from the data goes in as text, never as HTML.

(function () {
  // The page's files are also in the public repo, without data. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace("https://partypants16.github.io/eunomia.html");
    return;
  }

  const SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const LOCAL = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  const STALE_DAYS = 7;
  const NONE = "(none)";

  const BY = { claude: "Claude", codex: "Codex", import: "Imported" };
  const STATUS = { verified: "Verified", documented: "Documented", tentative: "Tentative", historical: "Historical" };
  const STATUS_CLASS = { verified: "done", documented: "open", tentative: "testing", historical: "parked" };
  const TYPE = { world: "Fact", experience: "Session note", observation: "Observation" };

  const ui = {
    stats: document.getElementById("stats"),
    stale: document.getElementById("stale"),
    controls: document.getElementById("controls"),
    search: document.getElementById("filter-search"),
    vault: document.getElementById("filter-vault"),
    by: document.getElementById("filter-by"),
    status: document.getElementById("filter-status"),
    type: document.getElementById("filter-type"),
    history: document.getElementById("filter-history"),
    reset: document.getElementById("filter-reset"),
    count: document.getElementById("filter-count"),
    message: document.getElementById("message"),
    empty: document.getElementById("filter-empty"),
    list: document.getElementById("list"),
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  const isHistorical = m => m.status === "historical" || m.engine_status === "superseded";

  // ---------- Sources: a session log opens on its timeline; anything else is plain text ----------

  function sourceLink(part) {
    let m = part.match(/^(?:_workspace\/context\/sessions\/|session:)([\w.-]+)\.md$/);
    if (m) return "./#" + encodeURIComponent(m[1]);
    m = part.match(/^_workspace\/context\/chatgpt\/sessions\/([\w.-]+)\.md$/);
    if (m) return "chatgpt.html#" + encodeURIComponent(m[1]);
    return null;
  }

  function sources(src) {
    const out = el("span", "eu-sources");
    out.setAttribute("translate", "no");
    if (!src) {
      out.textContent = NONE;
      return out;
    }
    src.split(",").map(s => s.trim()).filter(Boolean).forEach((part, i) => {
      if (i) out.append(", ");
      const href = sourceLink(part);
      if (href) {
        const a = el("a", "", part);
        a.href = href;
        out.append(a);
      } else {
        out.append(el("code", "", part));
      }
    });
    return out;
  }

  // ---------- Filters ----------

  function setOptions(select, all, values, labels) {
    select.textContent = "";
    select.append(new Option(all, ""));
    values.forEach(([value, n]) => select.append(new Option((labels[value] || value) + " (" + n + ")", value)));
  }

  function tally(memories, key) {
    const counts = new Map();
    memories.forEach(m => {
      const value = m[key] || NONE;
      counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
  }

  function ordered(counts, order) {
    const known = order.filter(k => counts.has(k)).map(k => [k, counts.get(k)]);
    const rest = [...counts].filter(([k]) => !order.includes(k)).sort();
    return known.concat(rest);
  }

  function matches(m, f) {
    if (!f.history && isHistorical(m)) return false;
    if (f.vault && m.vault !== f.vault) return false;
    if (f.by && (m.by || NONE) !== f.by) return false;
    if (f.status && (m.status || NONE) !== f.status) return false;
    if (f.type && (m.type || NONE) !== f.type) return false;
    if (f.words.length) {
      const hay = m._search;
      if (!f.words.every(w => hay.includes(w))) return false;
    }
    return true;
  }

  // ---------- Rendering ----------

  function chip(text, cls) {
    return el("span", "eu-chip" + (cls ? " eu-chip--" + cls : ""), text);
  }

  function row(dl, label, value) {
    dl.append(el("dt", "", label));
    const dd = el("dd");
    if (value instanceof Node) dd.append(value);
    else {
      dd.textContent = value || NONE;
      dd.setAttribute("translate", "no");
    }
    dl.append(dd);
  }

  function factCard(m, subject) {
    const card = el("article", "eu-fact" + (isHistorical(m) ? " eu-fact--historical" : ""));
    const text = el("p", "eu-fact-text", m.fact);
    text.setAttribute("translate", "no");

    const meta = el("p", "eu-fact-meta");
    meta.append(m.status ? chip(STATUS[m.status] || m.status, STATUS_CLASS[m.status]) : chip("No status"));
    meta.append(" ", chip(m.by ? (BY[m.by] || m.by) : "No author"));
    if (m.seen) {
      const seen = el("span", "eu-seen", m.seen);
      seen.setAttribute("translate", "no");
      meta.append(" ", seen);
    }
    if (!m.tagged) meta.append(" ", chip("No tag", "parked"));

    const more = el("details", "eu-more");
    more.append(el("summary", "", "Details"));
    const dl = el("dl");
    row(dl, "Source", sources(m.src));
    row(dl, "Seen", m.seen);
    row(dl, "Saved by", m.by ? (BY[m.by] || m.by) : null);
    row(dl, "Status", m.status ? (STATUS[m.status] || m.status) : null);
    row(dl, "Kind", m.type ? (TYPE[m.type] || m.type) : null);
    row(dl, "About", subject ? subject.name + " (" + subject.kind + ")" : m.subject);
    row(dl, "Project", m.vault);
    row(dl, "Written", m.created_at ? LOCAL.format(new Date(m.created_at)) : null);
    row(dl, "Last changed", m.updated_at ? LOCAL.format(new Date(m.updated_at)) + " (version " + m.version + ")" : null);
    row(dl, "Memory id", m.id);
    more.append(dl);

    card.append(text, meta, more);
    return card;
  }

  function render(data, f) {
    const subjects = new Map(data.entities.map(e => [e.id, e]));
    const shown = data.memories.filter(m => matches(m, f));
    const visible = data.memories.filter(m => f.history || !isHistorical(m)).length;
    const hidden = data.memories.length - visible;

    ui.list.textContent = "";
    ui.empty.hidden = shown.length > 0;
    ui.count.textContent = (shown.length === visible ? "Showing all " + plural(visible, "memory", "memories")
      : "Showing " + shown.length + " of " + plural(visible, "memory", "memories"))
      + (hidden ? " · " + hidden + " historical hidden" : "");

    const byVault = new Map();
    shown.forEach(m => {
      if (!byVault.has(m.vault)) byVault.set(m.vault, new Map());
      const bySubject = byVault.get(m.vault);
      if (!bySubject.has(m.subject)) bySubject.set(m.subject, []);
      bySubject.get(m.subject).push(m);
    });

    // workspace first (it's about everything), then the projects by name
    const vaults = [...byVault.keys()].sort((a, b) => (a !== "workspace") - (b !== "workspace") || a.localeCompare(b));
    vaults.forEach(vault => {
      const section = el("section", "eu-vault");
      const bySubject = byVault.get(vault);
      const total = [...bySubject.values()].reduce((n, list) => n + list.length, 0);
      const head = el("h2", "eu-vault-head");
      const name = el("span", "", vault);
      name.setAttribute("translate", "no");
      head.append(name, " ", el("span", "day-count", plural(total, "memory", "memories")));
      section.append(head);

      const names = [...bySubject.keys()].sort((a, b) =>
        ((subjects.get(a) || {}).name || a).localeCompare((subjects.get(b) || {}).name || b));
      names.forEach(id => {
        const subject = subjects.get(id);
        const list = bySubject.get(id).sort((a, b) => (b.seen || "").localeCompare(a.seen || ""));
        const group = el("details", "eu-subject");
        group.open = true;
        const summary = el("summary");
        const title = el("span", "eu-subject-name", subject ? subject.name : id);
        title.setAttribute("translate", "no");
        summary.append(title, " ");
        if (subject) summary.append(chip(subject.kind), " ");
        summary.append(el("span", "day-count", String(list.length)));
        group.append(summary);
        const facts = el("div", "eu-facts");
        list.forEach(m => facts.append(factCard(m, subject)));
        group.append(facts);
        section.append(group);
      });
      ui.list.append(section);
    });
  }

  function start(data) {
    data.memories.forEach(m => {
      const e = data.entities.find(x => x.id === m.subject);
      m._search = [m.fact, m.src, m.vault, e && e.name, e && e.kind].filter(Boolean).join(" ").toLowerCase();
    });

    // One span per phrase: .claude-stats is a wrapping flex row, so each phrase wraps whole
    const projects = data.vaults.filter(v => v.memories).length;
    ui.stats.textContent = "";
    ui.stats.append(el("span", "", plural(data.memories.length, "memory", "memories") + " · " + plural(projects, "project", "projects") + " ·"));
    const refreshed = el("span");
    const when = el("span", "", LOCAL.format(new Date(data.generated_at)));
    when.setAttribute("translate", "no");
    refreshed.append("Last refreshed", " ", when);
    ui.stats.append(refreshed);
    if (data.dropped) ui.stats.append(el("span", "", "· " + plural(data.dropped, "security note", "security notes") + " left out"));

    const age = (Date.now() - new Date(data.generated_at)) / 864e5;
    if (age > STALE_DAYS) {
      ui.stale.textContent = "This snapshot is " + Math.floor(age) + " days old. Run the snapshot on the laptop and redeploy to refresh it.";
      ui.stale.hidden = false;
    }

    const vaultCounts = tally(data.memories, "vault");
    setOptions(ui.vault, "All projects", ordered(vaultCounts, ["workspace"].concat([...vaultCounts.keys()].sort())), {});
    setOptions(ui.by, "Anyone", ordered(tally(data.memories, "by"), Object.keys(BY)), BY);
    setOptions(ui.status, "Any status", ordered(tally(data.memories, "status"), Object.keys(STATUS)), STATUS);
    setOptions(ui.type, "Any kind", ordered(tally(data.memories, "type"), Object.keys(TYPE)), TYPE);

    const filters = () => ({
      words: ui.search.value.toLowerCase().split(/\s+/).filter(Boolean),
      vault: ui.vault.value, by: ui.by.value, status: ui.status.value, type: ui.type.value,
      history: ui.history.checked,
    });
    const update = () => render(data, filters());
    [ui.search, ui.vault, ui.by, ui.status, ui.type, ui.history].forEach(c => c.addEventListener("input", update));
    ui.reset.addEventListener("click", () => {
      ui.search.value = "";
      [ui.vault, ui.by, ui.status, ui.type].forEach(s => { s.value = ""; });
      ui.history.checked = false;
      update();
    });

    ui.message.hidden = true;
    ui.controls.hidden = false;
    update();
  }

  fetch("eunomia-data.json", { cache: "no-cache" })
    .then(response => {
      if (response.status === 404) throw new Error("none");
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(start)
    .catch(error => {
      ui.message.textContent = error.message === "none"
        ? "There's no snapshot yet. Make one on the laptop, then redeploy this page."
        : "Couldn't load the memories. Try reloading the page.";
      ui.message.hidden = false;
    });
})();
