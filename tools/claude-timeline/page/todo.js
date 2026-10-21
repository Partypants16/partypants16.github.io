// The To do page: what's waiting on Parth across parth_project.
//
// Only on the remote box (http://192.168.212.60:8120/todo.html, LAN only),
// because it names Coles work. todo.json is made by build.py (todo.py): the
// list from parth_project/_workspace/context/TODO.yaml, which every session
// keeps up to date, plus "Work you could lose", worked out from git on the dev
// laptop each time the page is built. The website's todo.html sends visitors
// here when they're on home Wi-Fi.
//
// ?project=<name> shows one project. Session links open that log's card on
// the Claude page next door.

(function () {
  const SITE_URL = "https://partypants16.github.io/";
  // The page's files are also in the public repo, without data. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace(SITE_URL + "todo.html");
    return;
  }

  // [id, title, line under it, icon]
  const SECTIONS = [
    ["risk", "Work you could lose", "Only on this laptop until it's committed and pushed. Checked with git every time this page is built.", "shield"],
    ["test", "Tests only you can run", "Built and checked here, but they need LEGION, your phone or Azure.", "flask"],
    ["decide", "Decisions you owe", "Nothing moves on these until you pick.", "decide"],
    ["parked", "Parked", "Whenever you want them. Nothing is waiting on these.", "pause"],
    ["research", "Still in research", "Ideas and builds that haven't started yet.", "bulb"]
  ];
  const SHORT = { risk: "Could be lost", test: "Only you can test", decide: "Decisions", parked: "Parked", research: "Research" };
  const WHERE = [["LEGION", "On LEGION", "laptop"], ["Phone", "On your phone", "phone"], ["Azure", "In Azure", "cloud"],
                 ["Remote box", "On the remote box", "server"], ["This laptop", "On this laptop", "laptop"], ["", "Anywhere", "pin"]];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const ICONS = {
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.5V3"/><path d="M7.5 15h9"/>',
    decide: '<circle cx="6" cy="19" r="2"/><circle cx="6" cy="5" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9c0 5-6 4-11 8.5"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6"/><path d="M14 9v6"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19.5 11 3.5 3.5 0 0 1 18 18z"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01"/><path d="M7 16.5h.01"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9a6 6 0 0 1-6 6H6"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    news: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>'
  };

  const $ = id => document.getElementById(id);
  const hour12 = () => (window.SiteClock ? window.SiteClock.hour12() : false);
  let data = null;
  let current = new URLSearchParams(location.search).get("project") || "";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Text from TODO.yaml or git: written in English, never translated.
  function raw(tag, className, text) {
    const node = el(tag, className, text);
    node.setAttribute("translate", "no");
    return node;
  }

  function icon(name) {
    const holder = document.createElement("span");
    holder.innerHTML = '<svg class="pj-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
    return holder.firstChild;
  }

  function dateLabel(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return d + " " + MONTHS[m - 1] + (y === new Date().getFullYear() ? "" : " " + y);
  }

  function timeLabel(hours, minutes) {
    return new Date(Date.UTC(2000, 0, 1, hours, minutes)).toLocaleTimeString("en-AU",
      { hour: "numeric", minute: "2-digit", hour12: hour12(), timeZone: "UTC" });
  }

  // "2026-10-21 23:25" → "21 Oct, 11:25 pm" (or 23:25, per the clock setting)
  function stampLabel(stamp) {
    const [date, time] = stamp.split(" ");
    if (!time) return dateLabel(date);
    const [h, m] = time.split(":").map(Number);
    return dateLabel(date) + ", " + timeLabel(h, m);
  }

  function builtLabel(iso) {
    const when = new Date(iso);
    const date = when.getFullYear() + "-" + String(when.getMonth() + 1).padStart(2, "0") + "-" + String(when.getDate()).padStart(2, "0");
    return dateLabel(date) + ", " + timeLabel(when.getHours(), when.getMinutes());
  }

  // Whole days since a YYYY-MM-DD date, in local time.
  function daysSince(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const then = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today - then) / 86400000));
  }

  function sessionLinks(logs) {
    if (!logs.length) return null;
    const line = el("p", "todo-logs");
    line.append(icon("chat"), el("span", "todo-logs-label", "From"));
    logs.forEach((log, index) => {
      if (index) line.append(raw("span", "todo-logs-sep", "·"));
      const link = raw("a", "", log.title);
      link.href = "./#" + encodeURIComponent(log.id);
      link.title = dateLabel(log.date);
      line.append(link);
    });
    return line;
  }

  // ---------- pieces ----------

  // Text with `backticks` (commands, file names) → those parts in <code>.
  function withCode(node, text) {
    text.split("`").forEach((part, index) => {
      if (part) node.append(index % 2 ? el("code", "", part) : part);
    });
    return node;
  }

  // Tests and decisions are waiting on Parth, so they count the days (red after
  // two weeks). Parked and research things aren't, so they just say since when.
  function itemCard(item, category) {
    const compact = category === "research";
    const card = el("article", "todo-item" + (compact ? " todo-item--compact" : ""));
    card.dataset.project = item.project;
    const top = el("div", "todo-item-top");
    if (item.project) top.append(raw("span", "todo-project", item.project));
    if (item.effort) {
      const effort = el("span", "todo-effort");
      effort.append(icon("clock"), raw("span", "", item.effort));
      top.append(effort);
    }
    if (item.since) {
      const waiting = category === "test" || category === "decide";
      const days = daysSince(item.since);
      const age = el("span", "todo-age" + (waiting && days >= 14 ? " is-old" : ""));
      if (waiting) {
        age.title = dateLabel(item.since);
        age.append(el("span", "", "Waiting"), " ", el("span", "", days === 0 ? "today" : days === 1 ? "1 day" : days + " days"));
      } else {
        age.append(el("span", "", "Since"), " ", raw("span", "", dateLabel(item.since)));
      }
      top.append(age);
    }
    card.append(top, raw("h3", "", item.title));
    if (item.detail) card.append(withCode(raw("p", "todo-detail"), item.detail));
    if (item.steps.length) {
      const steps = raw("ul", "todo-steps");
      item.steps.forEach(step => steps.append(withCode(el("li"), step)));
      card.append(steps);
    }
    const links = sessionLinks(item.logs);
    if (links) card.append(links);
    return card;
  }

  function issuePill(issue) {
    const pill = el("li", "repo-issue");
    pill.dataset.kind = issue.kind;
    if (issue.kind === "uncommitted") pill.textContent = issue.count === 1 ? "1 file not committed" : issue.count + " files not committed";
    else if (issue.kind === "unpushed") pill.textContent = issue.count === 1 ? "1 commit not pushed" : issue.count + " commits not pushed";
    else if (issue.kind === "noremote") pill.textContent = "No remote: only on this laptop";
    else if (issue.kind === "neverpushed") pill.textContent = "This branch was never pushed";
    else if (issue.kind === "notyours") pill.textContent = "The remote is " + issue.owner + "'s, not yours";
    return pill;
  }

  function repoCard(repo) {
    const card = el("article", "repo-card");
    card.dataset.project = repo.project;
    const head = el("div", "repo-head");
    head.append(raw("code", "repo-folder", repo.folder));
    if (repo.project) head.append(raw("span", "todo-project", repo.project));
    card.append(head);

    const issues = el("ul", "repo-issues");
    repo.issues.forEach(issue => issues.append(issuePill(issue)));
    card.append(issues);

    const meta = el("p", "repo-meta");
    if (repo.branch) {
      const branch = el("span");
      branch.append(icon("branch"), el("span", "", "Branch"), " ", raw("code", "", repo.branch));
      meta.append(branch);
    }
    if (repo.lastCommit) {
      const last = el("span");
      last.append(el("span", "", "Last commit"), " ", raw("span", "", dateLabel(repo.lastCommit)));
      meta.append(last);
    }
    if (repo.remote) {
      const remote = el("span");
      remote.append(el("span", "", "Remote"), " ", raw("code", "", repo.remote));
      meta.append(remote);
    }
    card.append(meta);
    if (repo.note) card.append(raw("p", "repo-note", repo.note));

    if (repo.files.length) {
      const total = repo.files.length + repo.moreFiles;
      const details = el("details", "repo-files");
      details.append(el("summary", "", "Show the files (" + total + ")"));
      const list = raw("ul", "");
      repo.files.forEach(file => list.append(raw("li", "", file)));
      if (repo.moreFiles) list.append(el("li", "repo-more", "and " + repo.moreFiles + " more"));
      details.append(list);
      card.append(details);
    }
    return card;
  }

  function sectionBox(id, title, lead, iconName, count) {
    const section = el("section", "todo-section");
    section.id = id;
    section.dataset.cat = id;
    const head = el("div", "todo-section-head");
    const badge = el("span", "todo-section-icon");
    badge.append(icon(iconName));
    const text = el("div");
    const heading = el("h2");
    heading.append(el("span", "", title), " ", el("span", "todo-count", String(count)));
    text.append(heading, el("p", "todo-lead", lead));
    head.append(badge, text);
    section.append(head);
    return section;
  }

  function counts() {
    const s = data.sections;
    return { risk: data.repos ? data.repos.risky.length : 0, test: s.test.length, decide: s.decide.length,
             parked: s.parked.length, research: s.research.length };
  }

  // ---------- the page ----------

  function renderMeta() {
    const meta = $("meta");
    meta.textContent = "";
    if (data.updated) meta.append(el("span", "", "List updated"), " ", raw("span", "", stampLabel(data.updated)));
    if (data.updated && data.repos) meta.append(raw("span", "todo-meta-sep", " · "));
    if (data.repos) meta.append(el("span", "", "Git checked"), " ", raw("span", "", builtLabel(data.built)));
    const built = $("built");
    built.textContent = "";
    built.append(el("span", "", "Built"), " ", raw("span", "", builtLabel(data.built)));
  }

  function render() {
    const root = $("todo");
    root.textContent = "";
    const number = counts();

    // Sessions written since the list was last updated: it may be missing what they left.
    if (data.newer.length) {
      const note = el("div", "todo-newer");
      note.append(icon("news"));
      const text = el("p");
      text.append(el("strong", "", data.newer.length === 1 ? "1 session since this list was updated." : data.newer.length + " sessions since this list was updated."),
                  " ", el("span", "", "Anything they left for you may not be on it yet:"), " ");
      data.newer.forEach((log, index) => {
        if (index) text.append(raw("span", "", ", "));
        const link = raw("a", "", log.title);
        link.href = "./#" + encodeURIComponent(log.id);
        text.append(link);
      });
      note.append(text);
      root.append(note);
    }

    const overview = el("div", "todo-overview");
    SECTIONS.forEach(([id]) => {
      const tile = el("a", "todo-tile");
      tile.href = "#" + id;
      tile.dataset.cat = id;
      tile.append(el("span", "todo-tile-num", String(number[id])), el("span", "todo-tile-label", SHORT[id]));
      overview.append(tile);
    });
    root.append(overview);

    if (data.startHere.title || data.startHere.text) {
      const start = el("section", "todo-start");
      start.setAttribute("aria-labelledby", "start-title");
      const badge = el("span", "todo-start-icon");
      badge.append(icon("star"));
      const text = el("div");
      text.append(el("span", "todo-start-label", "Start here"));
      const title = raw("h2", "", data.startHere.title);
      title.id = "start-title";
      text.append(title);
      if (data.startHere.text) text.append(raw("p", "", data.startHere.text));
      start.append(badge, text);
      root.append(start);
    }

    root.append(filterRow());

    SECTIONS.forEach(([id, title, lead, iconName]) => {
      const section = sectionBox(id, title, lead, iconName, number[id]);
      if (id === "risk") {
        if (!data.repos) {
          section.append(el("p", "todo-empty", "Git wasn't available when this page was built, so this couldn't be checked."));
        } else {
          const grid = el("div", "todo-grid");
          data.repos.risky.forEach(repo => grid.append(repoCard(repo)));
          if (data.repos.risky.length) section.append(grid);
          else section.append(el("p", "todo-empty", "Everything is committed and pushed."));
          if (data.repos.safe.length) {
            const safe = el("p", "repo-safe");
            safe.append(icon("check"), el("span", "", "Committed and pushed:"), " ",
                        raw("span", "", data.repos.safe.map(r => r.folder).join(", ")));
            section.append(safe);
          }
        }
      } else if (id === "test") {
        WHERE.forEach(([key, label, iconName]) => {
          const items = data.sections.test.filter(item => item.where === key);
          if (!items.length) return;
          const group = el("div", "todo-where-group");
          const heading = el("h3", "todo-where");
          heading.append(icon(iconName), el("span", "", label));
          const grid = el("div", "todo-grid");
          items.forEach(item => grid.append(itemCard(item, "test")));
          group.append(heading, grid);
          section.append(group);
        });
      } else {
        const grid = el("div", "todo-grid" + (id === "research" || id === "parked" ? " todo-grid--compact" : ""));
        data.sections[id].forEach(item => grid.append(itemCard(item, id)));
        section.append(grid);
      }
      if (id !== "risk" && !data.sections[id].length) section.append(el("p", "todo-empty", "Nothing here right now."));
      root.append(section);
    });

    root.append(el("p", "todo-empty todo-none", "Nothing for this project right now."));
    applyFilter();
  }

  function filterRow() {
    const projects = new Set();
    Object.values(data.sections).forEach(items => items.forEach(item => item.project && projects.add(item.project)));
    if (data.repos) data.repos.risky.forEach(repo => repo.project && projects.add(repo.project));
    const names = [...projects].sort((a, b) => a.localeCompare(b));
    if (current && !projects.has(current)) current = "";

    const row = el("div", "chip-row todo-filters");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Show one project");
    [""].concat(names).forEach(name => {
      const chip = el("button", "pj-chip");
      chip.type = "button";
      chip.dataset.project = name;
      if (name) chip.append(raw("span", "", name));
      else chip.append(el("span", "", "All projects"));
      chip.addEventListener("click", () => {
        current = name;
        const url = new URL(location.href);
        if (name) url.searchParams.set("project", name);
        else url.searchParams.delete("project");
        history.replaceState(null, "", url);
        applyFilter();
      });
      row.append(chip);
    });
    return row;
  }

  function applyFilter() {
    const root = $("todo");
    root.querySelectorAll(".todo-filters .pj-chip").forEach(chip => {
      chip.setAttribute("aria-pressed", String(chip.dataset.project === current));
    });
    root.querySelectorAll(".todo-item, .repo-card").forEach(card => {
      card.hidden = !!current && card.dataset.project !== current;
    });
    root.querySelectorAll(".todo-where-group").forEach(group => {
      group.hidden = !group.querySelector(".todo-item:not([hidden])");
    });
    let shown = 0;
    root.querySelectorAll(".todo-section").forEach(section => {
      const any = !!section.querySelector(".todo-item:not([hidden]), .repo-card:not([hidden])");
      // With a project picked, sections with nothing for it step aside.
      section.hidden = !!current && !any;
      section.querySelectorAll(".repo-safe").forEach(line => { line.hidden = !!current; });
      if (any) shown++;
    });
    root.querySelector(".todo-none").hidden = !current || shown > 0;
  }

  function fail() {
    const message = $("message");
    message.textContent = "Couldn't load the to-do list. Try reloading the page.";
    message.hidden = false;
  }

  fetch("todo.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(json => {
      data = json;
      renderMeta();
      render();
    })
    .catch(fail);

  // The clock setting changed (12/24 h): redo every time shown.
  document.addEventListener("clockchange", () => { if (data) renderMeta(); });
})();
