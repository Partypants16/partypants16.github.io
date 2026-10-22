// Projects: draws projects.html (the showcase) and project.html?p=<slug> (one
// project's story) from PROJECTS_DATA in projects-data.js.
//
// Text that comes from the data is marked translate="no" (it's written in
// English). The labels around it go through Hinglish like the rest of the
// site, so every label in this file needs its line in hinglish.js.
//
// The Claude links go through claude.html, which only opens the Claude page
// on home Wi-Fi. Commit links only exist for public repos.
//
// Addresses: projects.html?status=active keeps the showcase filter, and
// project.html?p=pat-ai#e-<event id> opens that moment in the timeline.

(function () {
  const DATA = typeof PROJECTS_DATA === "undefined" ? { projects: [] } : PROJECTS_DATA;
  const PROJECTS = DATA.projects || [];

  // status → [label, showcase filter]
  const STAGES = {
    idea: ["Idea", "ideas"],
    planning: ["Planning", "ideas"],
    building: ["Building", "active"],
    usable: ["Usable", "active"],
    improving: ["Improving", "active"],
    paused: ["Paused", "paused"],
    complete: ["Complete", "complete"],
    archived: ["Archived", "archived"]
  };
  const LIFECYCLE = ["idea", "planning", "building", "usable", "improving", "complete"];
  const GROUPS = [["all", "All"], ["active", "Active"], ["ideas", "Ideas"], ["complete", "Complete"],
                  ["paused", "Paused"], ["archived", "Archived"]];

  // event type → [label, plural]; the icon has the type's name
  const TYPES = {
    decision: ["Decision", "Decisions"],
    direction: ["Change of direction", "Changes of direction"],
    experiment: ["Experiment", "Experiments"],
    problem: ["Problem", "Problems"],
    deadend: ["Dead end", "Dead ends"],
    milestone: ["Milestone", "Milestones"],
    release: ["Release", "Releases"],
    refactor: ["Refactor", "Refactors"],
    pause: ["Paused", "Pauses"],
    resume: ["Picked back up", "Pick-ups"]
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August",
                       "September", "October", "November", "December"];

  const ICONS = {
    decision: '<circle cx="6" cy="19" r="2"/><circle cx="6" cy="5" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10"/><path d="M18 9c0 5-6 4-11 8.5"/>',
    direction: '<path d="M4 20v-6a5 5 0 0 1 5-5h11"/><path d="M16 5l4 4-4 4"/>',
    experiment: '<path d="M9 3h6"/><path d="M10 3v6.5L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.5V3"/><path d="M7.5 15h9"/>',
    problem: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    deadend: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
    milestone: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    release: '<path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0"/><path d="M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2"/>',
    refactor: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    pause: '<path d="M9 5v14"/><path d="M15 5v14"/>',
    resume: '<path d="M7 4l12 8-12 8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    cross: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3 12h5.5"/><path d="M15.5 12H21"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    list: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 3"/>',
    github: '<path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.5-2.6-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3 .7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z"/>'
  };

  // ---------- helpers ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Text from the data: written in English, never translated.
  function data(tag, className, text) {
    const node = el(tag, className, text);
    node.setAttribute("translate", "no");
    return node;
  }

  function icon(name) {
    const holder = document.createElement("span");
    const filled = name === "github";
    holder.innerHTML = '<svg class="pj-icon' + (filled ? " pj-icon--fill" : "") +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || "") + "</svg>";
    return holder.firstChild;
  }

  function emoji(text, className) {
    const node = data("span", className, text);
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function parts(iso) {
    const [y, m, d] = String(iso).split("-").map(Number);
    return { y, m: (m || 1) - 1, d: d || 1 };
  }

  function longDate(iso) {
    const p = parts(iso);
    return p.d + " " + MONTHS[p.m] + " " + p.y;
  }

  const stage = p => STAGES[p.status] || STAGES.idea;
  const hasStory = p => Array.isArray(p.events) && p.events.length > 0;
  // Featured projects get a card in "The full story"; the rest are rows under "Other projects".
  const isFeatured = p => p.featured && hasStory(p);
  const repoUrl = p => (p.repo && !p.repo.private ? "https://github.com/" + p.repo.name : null);
  const storyUrl = p => "project.html?p=" + encodeURIComponent(p.slug);
  const claudeUrl = p => "claude.html?project=" + encodeURIComponent(p.claudeProject);
  const isDecision = e => e.type === "decision" || e.type === "direction";
  const typeOf = e => (TYPES[e.type] ? e.type : "milestone");
  // Oldest first; same-day moments keep the order they're written in.
  const sortEvents = events => events.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const lastUpdate = p => (hasStory(p) ? sortEvents(p.events).pop().date : p.started);

  function externalLink(node, href) {
    node.href = href;
    node.target = "_blank";
    node.rel = "noopener noreferrer";
    return node;
  }

  function stagePill(p) {
    const pill = el("span", "stage-pill", stage(p)[0]);
    pill.dataset.stageGroup = stage(p)[1];
    return pill;
  }

  function tagList(items) {
    const list = data("ul", "tag-list");
    (items || []).forEach(item => list.append(el("li", "tag", item)));
    return list;
  }

  function button(className, iconName, label, extra) {
    const node = el("a", "pj-btn " + className);
    if (iconName) node.append(icon(iconName));
    node.append(el("span", "", label));
    if (extra) node.append(el("small", "", extra));
    return node;
  }

  function sampleNote() {
    const note = el("p", "sample-note");
    note.append(icon("note"), el("span", "", "Sample data: the write-ups here are placeholders while the layout is being built."));
    return note;
  }

  // ---------- the showcase (projects.html) ----------

  function renderShowcase() {
    const $ = id => document.getElementById(id);
    if (DATA.sample) $("sample-slot").append(sampleNote());

    const decisions = PROJECTS.reduce((n, p) => n + (p.events || []).filter(isDecision).length, 0);
    [[PROJECTS.length, "Projects"],
     [PROJECTS.filter(p => stage(p)[1] === "active").length, "Active now"],
     [PROJECTS.filter(p => stage(p)[1] === "complete").length, "Finished"],
     [decisions, "Decisions written up"]].forEach(([number, label]) => {
      const tile = el("div", "pj-stat");
      tile.append(el("span", "pj-stat-num", String(number)), el("span", "pj-stat-label", label));
      $("stats").append(tile);
    });

    const featured = PROJECTS.filter(isFeatured);
    $("featured").hidden = featured.length === 0;
    featured.forEach(p => $("featured-list").append(featureCard(p)));

    renderArchive($("archive"), $("filters"), $("archive-empty"));
  }

  function featureCard(p) {
    const events = sortEvents(p.events);
    const card = el("a", "feature-card");
    card.href = storyUrl(p);
    card.style.setProperty("--hue", p.hue);

    const cover = el("div", "feature-cover pj-cover");
    const strip = el("div");
    const dots = el("ol", "story-strip");
    dots.setAttribute("aria-hidden", "true");
    events.forEach(e => {
      const dot = el("li", e.key ? "is-key" : "");
      dot.dataset.type = typeOf(e);
      dots.append(dot);
    });
    strip.append(el("span", "story-strip-caption", "The story so far"), dots);
    cover.append(emoji(p.icon, "cover-icon"), strip);

    const body = el("div", "feature-body");
    const top = el("div", "feature-top");
    top.append(stagePill(p));
    if (DATA.sample) top.append(el("span", "sample-badge", "Sample"));
    body.append(top, data("h3", "", p.name), data("p", "feature-tagline", p.tagline));

    const turn = events.find(e => e.key && e.type === "direction") || events.find(e => e.key);
    if (turn) {
      const call = el("div", "feature-call");
      call.dataset.type = typeOf(turn);
      call.append(el("span", "feature-call-label", turn.type === "direction" ? "The turning point" : "The big call"),
                  data("span", "feature-call-title", turn.title));
      body.append(call);
    }

    const counts = el("ul", "feature-counts");
    [[events.length, "Moments"], [events.filter(isDecision).length, "Decisions"],
     [(p.lessons || []).length, "Lessons"]].forEach(([number, label]) => {
      const item = el("li");
      item.append(el("b", "", String(number)), el("span", "", label));
      counts.append(item);
    });
    body.append(counts, tagList(p.technologies));

    const cta = el("span", "feature-cta");
    cta.append(el("span", "", "Read the story"), icon("arrow"));
    body.append(cta);

    card.append(cover, body);
    return card;
  }

  function renderArchive(list, filters, empty) {
    // Only the projects without a featured story. Newest start first, in one block per year.
    const others = PROJECTS.filter(p => !isFeatured(p));
    const sorted = others.slice().sort((a, b) => String(b.started).localeCompare(String(a.started)));
    const years = new Map();
    sorted.forEach(p => {
      const year = String(p.started).slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(p);
    });
    years.forEach((items, year) => {
      const block = el("div", "archive-group");
      const rows = el("ul", "archive-list");
      items.forEach(p => rows.append(archiveRow(p)));
      block.append(data("h3", "archive-year", year), rows);
      list.append(block);
    });

    const counts = {};
    others.forEach(p => { counts[stage(p)[1]] = (counts[stage(p)[1]] || 0) + 1; });
    let current = new URLSearchParams(location.search).get("status") || "all";
    if (current !== "all" && !counts[current]) current = "all";

    const chips = [];
    GROUPS.forEach(([id, label]) => {
      const number = id === "all" ? others.length : counts[id];
      if (!number) return;
      const chip = el("button", "pj-chip");
      chip.type = "button";
      chip.dataset.group = id;
      chip.append(el("span", "", label), el("span", "count", String(number)));
      chip.addEventListener("click", () => apply(id, true));
      chips.push(chip);
      filters.append(chip);
    });

    function apply(id, remember) {
      chips.forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.group === id)));
      list.querySelectorAll(".archive-list > li").forEach(row => {
        row.hidden = id !== "all" && row.dataset.group !== id;
      });
      list.querySelectorAll(".archive-group").forEach(block => {
        block.hidden = !block.querySelector(".archive-list > li:not([hidden])");
      });
      empty.hidden = !!list.querySelector(".archive-list > li:not([hidden])");
      if (remember) {
        const url = new URL(location.href);
        if (id === "all") url.searchParams.delete("status");
        else url.searchParams.set("status", id);
        history.replaceState(null, "", url);
      }
    }
    apply(current, false);
  }

  function archiveRow(p) {
    const item = el("li");
    item.dataset.group = stage(p)[1];
    const story = hasStory(p);
    const repo = repoUrl(p);
    const row = el(story || repo ? "a" : "div", "archive-row");
    if (story) row.href = storyUrl(p);
    else if (repo) externalLink(row, repo);
    row.style.setProperty("--hue", p.hue);

    const main = el("span");
    main.append(data("span", "archive-name", p.name), data("span", "archive-tagline", p.tagline));

    const tags = el("span", "archive-tags");
    tags.append(stagePill(p));
    (p.categories || []).forEach(category => tags.append(data("span", "tag", category)));

    const action = el("span", "archive-action");
    if (story) {
      action.append(el("span", "", "Read the story"), icon("arrow"));
    } else if (repo) {
      action.append(icon("github"), el("span", "", "GitHub"), icon("external"));
    } else {
      action.classList.add("is-muted");
      if (p.repo) action.append(icon("lock"), el("span", "", "Code is private"));
      else action.append(el("span", "", "Story coming soon"));
    }

    row.append(emoji(p.icon, "archive-icon"), main, tags, action);
    item.append(row);
    return item;
  }

  // ---------- one project's story (project.html) ----------

  function renderStory() {
    const root = document.getElementById("story");
    const slug = new URLSearchParams(location.search).get("p");
    const p = PROJECTS.find(project => project.slug === slug);
    if (!p || !hasStory(p)) {
      renderMissing(root, p);
      return;
    }
    document.title = p.name + " | Projects";
    root.closest("main").style.setProperty("--hue", p.hue);
    const events = sortEvents(p.events);

    if (DATA.sample) root.append(sampleNote());
    root.append(hero(p));

    // [id, label in the jump bar, heading, line under it, what goes in it]
    const sections = [];
    if ((p.photos || []).length) {
      sections.push(["photos", "Photos", "Photos", "What it actually looks like.", () => photos(p.photos)]);
    }
    if ((p.evolution || []).length) {
      sections.push(["journey", "Journey", "The journey", "How the idea turned into what it is now.", () => journey(p)]);
    }
    const calls = events.filter(e => e.key);
    if (calls.length) {
      sections.push(["big-calls", "Big calls", "The big calls", "The decisions that shaped it, and what each one was chosen over.", () => bigCalls(calls)]);
    }
    sections.push(["timeline", "Timeline", "Timeline", "Everything that happened, in order. Open any moment to see the thinking behind it.", section => timeline(p, events, section)]);
    const dropped = events.filter(e => e.type === "deadend" || e.type === "experiment");
    if (dropped.length) {
      sections.push(["didnt-work", "What didn't work", "What didn't work", "The experiments and dead ends. They stay in on purpose: most of the learning happened here.", () => deadEnds(dropped)]);
    }
    if ((p.lessons || []).length) {
      sections.push(["lessons", "Lessons", "What I learned", null, () => lessons(p.lessons)]);
    }
    if (p.focus || (p.next || []).length) {
      sections.push(["next", "What's next", "Now and next", null, () => nowAndNext(p)]);
    }
    sections.push(["sources", "Sources", "Where this comes from", "Every moment is written from the commits and Claude sessions behind it.", () => sources(p, events)]);

    const nav = el("nav", "jump-nav");
    nav.setAttribute("aria-label", "On this page");
    const navList = el("ul");
    nav.append(navList);
    root.append(nav);

    sections.forEach(([id, navLabel, title, lead, build], index) => {
      const link = el("a", "", navLabel);
      link.href = "#" + id;
      const navItem = el("li");
      navItem.append(link);
      navList.append(navItem);

      const section = el("section", "pj-section");
      section.id = id;
      const head = el("div", "pj-section-head");
      const text = el("div");
      const heading = el("h2");
      heading.append(el("span", "section-num", String(index + 1).padStart(2, "0")), el("span", "", title));
      text.append(heading);
      if (lead) text.append(el("p", "pj-lead", lead));
      head.append(text);
      section.append(head);
      const content = build(section);
      if (content) section.append(content);
      root.append(section);
    });

    root.append(storyEnd(p));
    watchSections(nav, sections.map(s => s[0]));
    const match = location.hash.match(/^#e-(.+)$/);
    if (match) requestAnimationFrame(() => showEvent(decodeURIComponent(match[1])));
  }

  function renderMissing(root, p) {
    const box = el("div", "pj-empty");
    box.append(el("p", "", p ? "This project's story hasn't been written yet." : "Couldn't find that project."));
    const row = el("div", "story-actions");
    row.style.justifyContent = "center";
    if (p && repoUrl(p)) row.append(externalLink(button("pj-btn--dark", "github", "View the code on GitHub"), repoUrl(p)));
    const back = button("pj-btn--ghost", "back", "All projects");
    back.href = "projects.html";
    row.append(back);
    box.append(row);
    root.append(box);
  }

  function hero(p) {
    const header = el("header", "story-hero pj-cover");
    const top = el("div", "story-hero-top");
    const titles = el("div");
    const eyebrow = el("p", "pj-eyebrow");
    eyebrow.append(el("span", "", p.kind || "Personal"));
    (p.categories || []).forEach(category => eyebrow.append(" · ", data("span", "", category)));
    titles.append(eyebrow, data("h1", "", p.name), data("p", "story-tagline", p.tagline));
    top.append(emoji(p.icon, "cover-icon"), titles);
    header.append(top);
    if (p.summary) header.append(data("p", "story-summary", p.summary));

    const meta = el("div", "story-meta");
    [["Started", data("span", "meta-value", longDate(p.started))],
     ["Last update", data("span", "meta-value", longDate(lastUpdate(p)))],
     ["Built with", tagList(p.technologies)]].forEach(([label, value]) => {
      const item = el("div");
      item.append(el("span", "meta-label", label), value);
      meta.append(item);
    });
    header.append(meta, lifecycle(p), actions(p));
    return header;
  }

  function lifecycle(p) {
    const wrap = el("div", "lifecycle");
    wrap.append(el("span", "meta-label", "Where it's at"));
    const steps = el("ol");
    // Paused and archived projects show how far they got (`reached`, if given).
    const reached = LIFECYCLE.indexOf(LIFECYCLE.includes(p.status) ? p.status : p.reached || "building");
    LIFECYCLE.forEach((status, index) => {
      const step = el("li", index < reached ? "is-done" : index === reached ? "is-current" : "");
      if (index === reached) step.setAttribute("aria-current", "step");
      step.append(el("span", "", STAGES[status][0]));
      steps.append(step);
    });
    wrap.append(steps);
    wrap.append(el("span", "lifecycle-now", stage(p)[0])); // phones only: the bar has no room for labels
    if (p.status === "paused") wrap.append(el("p", "lifecycle-note", "Paused for now."));
    if (p.status === "archived") wrap.append(el("p", "lifecycle-note", "Archived: finished with, but kept here."));
    return wrap;
  }

  function actions(p) {
    const row = el("div", "story-actions");
    if (repoUrl(p)) {
      row.append(externalLink(button("pj-btn--dark", "github", "View the code on GitHub"), repoUrl(p)));
    } else if (p.repo) {
      const locked = el("span", "pj-btn pj-btn--muted");
      locked.append(icon("lock"), el("span", "", "Code is private"));
      row.append(locked);
    }
    if (p.claudeProject) {
      const claude = button("pj-btn--ghost", "chat", "Claude sessions");
      claude.href = claudeUrl(p);
      row.append(claude);
    }
    return row;
  }

  function journey(p) {
    const steps = el("ol", "journey");
    steps.style.setProperty("--steps", p.evolution.length);
    p.evolution.forEach((step, index) => {
      const item = el("li", "journey-step" + (index === p.evolution.length - 1 ? " is-now" : ""));
      const card = el("div", "journey-card");
      card.append(data("h3", "", step.label), data("p", "", step.text));
      item.append(el("span", "journey-dot", String(index + 1)), card);
      steps.append(item);
    });
    return steps;
  }

  // "Decision · 20 Sep 2026", with "Big call" for the key ones in the timeline.
  function kicker(e, inTimeline) {
    const line = el("p", "kicker");
    line.append(icon(typeOf(e)), el("span", "", TYPES[typeOf(e)][0]));
    if (inTimeline && e.key) line.append(el("span", "key-badge", "Big call"));
    const when = data("time", inTimeline ? "tl-when" : "", longDate(e.date));
    when.dateTime = e.date;
    line.append(when);
    return line;
  }

  function optionList(options) {
    const list = el("ul", "options");
    options.forEach(option => {
      const item = el("li", option.chosen ? "is-chosen" : "is-rejected");
      const mark = el("span", "opt-icon");
      mark.append(icon(option.chosen ? "check" : "cross"));
      const text = el("span");
      text.append(el("span", "visually-hidden", option.chosen ? "Chosen: " : "Not chosen: "),
                  data("span", "opt-text", option.text));
      if (option.note) text.append(data("span", "opt-note", option.note));
      item.append(mark, text);
      list.append(item);
    });
    return list;
  }

  function timelineLink(e) {
    const link = el("a", "call-link", "See it in the timeline");
    link.href = "#e-" + e.id;
    link.addEventListener("click", event => {
      event.preventDefault();
      showEvent(e.id);
    });
    return link;
  }

  function bigCalls(calls) {
    const grid = el("div", "calls-grid");
    calls.forEach(e => {
      const card = el("article", "call-card");
      card.dataset.type = typeOf(e);
      card.append(kicker(e, false), data("h3", "", e.title));
      if ((e.options || []).length) card.append(optionList(e.options));
      if (e.why) card.append(data("blockquote", "call-why", e.why));
      card.append(timelineLink(e));
      grid.append(card);
    });
    return grid;
  }

  function timeline(p, events, section) {
    const tools = el("div", "timeline-tools");
    const chipRow = el("div", "chip-row");
    chipRow.setAttribute("role", "group");
    chipRow.setAttribute("aria-label", "Filter the timeline");
    const counts = {};
    events.forEach(e => { counts[typeOf(e)] = (counts[typeOf(e)] || 0) + 1; });
    const chips = [];
    const addChip = (id, label, number) => {
      const chip = el("button", "pj-chip");
      chip.type = "button";
      chip.dataset.filter = id;
      if (id !== "all") {
        chip.dataset.type = id;
        chip.append(el("span", "dot"));
      }
      chip.append(el("span", "", label), el("span", "count", String(number)));
      chip.addEventListener("click", () => filter(id));
      chips.push(chip);
      chipRow.append(chip);
    };
    addChip("all", "All", events.length);
    Object.keys(TYPES).forEach(type => { if (counts[type]) addChip(type, TYPES[type][1], counts[type]); });
    const toggle = el("button", "text-button", "Open all");
    toggle.type = "button";
    tools.append(chipRow, toggle);
    section.append(tools);

    const wrap = el("div", "pj-timeline");
    let list = null;
    let month = null;
    events.forEach(e => {
      if (e.date.slice(0, 7) !== month) {
        month = e.date.slice(0, 7);
        const when = parts(e.date);
        list = el("ol", "tl-list");
        wrap.append(data("h3", "timeline-month", MONTH_NAMES[when.m] + " " + when.y), list);
      }
      list.append(eventItem(p, e));
    });
    section.append(wrap);

    function filter(id) {
      chips.forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.filter === id)));
      wrap.querySelectorAll(".tl-event").forEach(item => {
        item.hidden = id !== "all" && item.dataset.type !== id;
      });
      wrap.querySelectorAll(".tl-list").forEach(ol => {
        const shown = [...ol.children].filter(item => !item.hidden);
        ol.hidden = shown.length === 0;
        ol.previousElementSibling.hidden = ol.hidden;
        // The date shows once per day, on the first moment still showing.
        shown.forEach((item, index) => {
          item.classList.toggle("same-day", index > 0 && shown[index - 1].dataset.date === item.dataset.date);
        });
      });
    }
    filter("all");
    section.filterTimeline = filter;

    const allThinking = () => [...wrap.querySelectorAll("details.tl-thinking")];
    const syncToggle = () => { toggle.textContent = allThinking().every(d => d.open) ? "Close all" : "Open all"; };
    toggle.addEventListener("click", () => {
      const open = !allThinking().every(d => d.open);
      allThinking().forEach(d => { d.open = open; });
      syncToggle();
    });
    wrap.addEventListener("toggle", syncToggle, true); // "toggle" doesn't bubble, so listen on the way down
  }

  function eventItem(p, e) {
    const type = typeOf(e);
    const item = el("li", "tl-event" + (e.key ? " is-key" : ""));
    item.id = "e-" + e.id;
    item.dataset.type = type;
    item.dataset.date = e.date;

    const when = parts(e.date);
    const date = data("div", "tl-date");
    date.append(el("span", "tl-day", String(when.d)), el("span", "tl-mon", MONTHS[when.m]));
    const node = el("div", "tl-node");
    node.setAttribute("aria-hidden", "true");
    node.append(icon(type));

    const card = el("article", "tl-card");
    card.append(kicker(e, true), data("h4", "", e.title));
    if (e.summary) card.append(data("p", "tl-summary", e.summary));
    if (e.why) {
      const why = el("p", "tl-why");
      why.append(el("span", "tl-why-label", "Why:"), data("span", "", e.why));
      card.append(why);
    }

    const rows = [];
    if (e.context) rows.push(["The situation", data("dd", "", e.context)]);
    if ((e.options || []).length) {
      const options = el("dd");
      options.append(optionList(e.options));
      rows.push(["The options", options]);
    }
    if (e.outcome) rows.push(["What happened", data("dd", "", e.outcome)]);
    if (e.lesson) rows.push(["What it taught me", data("dd", "", e.lesson)]);
    if ((e.sources || []).length) {
      const proof = el("dd");
      proof.append(evidence(p, e.sources));
      rows.push(["Evidence", proof]);
    }
    if (rows.length) {
      const details = el("details", "tl-thinking");
      const summary = el("summary");
      const label = el("span", "", "See the thinking");
      summary.append(icon("chevron"), label);
      const list = el("dl", "thinking");
      rows.forEach(([title, value]) => {
        const row = el("div");
        row.append(el("dt", "", title), value);
        list.append(row);
      });
      details.append(summary, list);
      details.addEventListener("toggle", () => {
        label.textContent = details.open ? "Hide the thinking" : "See the thinking";
      });
      card.append(details);
    }

    item.append(date, node, card);
    return item;
  }

  function evidence(p, list) {
    const wrap = el("div", "evidence");
    const repo = repoUrl(p);
    list.forEach(source => {
      let chip;
      if (source.type === "git") {
        chip = el(repo ? "a" : "span", "evidence-chip");
        if (repo) externalLink(chip, repo + "/commit/" + source.ref);
        else chip.title = "In a private repository";
        chip.append(icon("commit"), data("code", "", source.ref));
        if (source.label) chip.append(data("span", "", source.label));
      } else if (source.type === "claude") {
        chip = el("a", "evidence-chip");
        chip.href = "claude.html#" + encodeURIComponent(source.ref);
        chip.append(icon("chat"), el("span", "", "Claude session"), data("span", "", "· " + (source.label || source.ref)));
      } else {
        chip = el("span", "evidence-chip");
        chip.append(icon("note"), data("span", "", source.label || source.ref));
      }
      wrap.append(chip);
    });
    return wrap;
  }

  function deadEnds(items) {
    const grid = el("div", "deadend-grid");
    items.forEach(e => {
      const card = el("article", "deadend-card");
      card.dataset.type = typeOf(e);
      card.append(kicker(e, false), data("h3", "", e.title));
      if (e.summary) card.append(data("p", "", e.summary));
      if (e.lesson) {
        const lesson = el("div", "deadend-lesson");
        lesson.append(icon("bulb"), data("span", "", e.lesson));
        card.append(lesson);
      }
      card.append(timelineLink(e));
      grid.append(card);
    });
    return grid;
  }

  // Each photo opens full size in a new tab.
  function photos(items) {
    const grid = el("div", "photo-grid");
    items.forEach(photo => {
      const figure = el("figure", "photo-card");
      const link = el("a");
      externalLink(link, photo.src);
      const img = el("img");
      img.src = photo.src;
      img.alt = photo.alt || "";
      link.append(img);
      figure.append(link);
      if (photo.caption) figure.append(data("figcaption", "", photo.caption));
      grid.append(figure);
    });
    return grid;
  }

  function lessons(items) {
    const grid = el("div", "lessons-grid");
    items.forEach((lesson, index) => {
      const card = el("article", "lesson-card");
      card.append(el("span", "lesson-num", String(index + 1).padStart(2, "0")),
                  data("h3", "", lesson.title), data("p", "", lesson.text));
      grid.append(card);
    });
    return grid;
  }

  function nowAndNext(p) {
    const grid = el("div", "next-grid");
    if (p.focus) {
      const card = el("div", "next-card");
      const heading = el("h3");
      heading.append(icon("target"), el("span", "", "Current focus"));
      card.append(heading, data("p", "", p.focus));
      grid.append(card);
    }
    if ((p.next || []).length) {
      const card = el("div", "next-card");
      const heading = el("h3");
      heading.append(icon("list"), el("span", "", "Next steps"));
      const list = data("ul", "next-list");
      p.next.forEach(step => list.append(el("li", "", step)));
      card.append(heading, list);
      grid.append(card);
    }
    return grid;
  }

  function sources(p, events) {
    const wrap = el("div");
    const grid = el("div", "proof");
    const repo = repoUrl(p);
    const tile = (tag, iconName, number, label, note) => {
      const node = el(tag, "proof-tile");
      node.append(icon(iconName), el("span", "proof-num", String(number)), el("span", "proof-label", label),
                  el("span", "proof-note", note));
      grid.append(node);
      return node;
    };
    if (p.commits) {
      const commits = tile(repo ? "a" : "div", "commit", p.commits, "Commits", repo ? "On GitHub" : "In a private repository");
      if (repo) externalLink(commits, repo + "/commits");
    }
    if (p.sessions && p.claudeProject) {
      tile("a", "chat", p.sessions, "Claude sessions", "On the Claude page").href = claudeUrl(p);
    }
    tile("div", "history", events.length, "Moments on the timeline", "Grouped from the commits and sessions");

    const principle = el("p", "principle");
    principle.append("Git shows what changed. ", el("span", "", "This page is about why."));
    wrap.append(grid, principle);
    return wrap;
  }

  function storyEnd(p) {
    const end = el("section", "story-end");
    const repo = repoUrl(p);
    end.append(el("h2", "", repo ? "Want to see the code?" : "The code for this one is private"),
               el("p", "", repo ? "Everything above is the why. The how is on GitHub."
                                : "The story is all here, but the repository itself stays private."));
    const row = el("div", "story-actions");
    if (repo) row.append(externalLink(button("pj-btn--dark", "github", "View the code on GitHub"), repo));
    const back = button("pj-btn--ghost", "back", "All projects");
    back.href = "projects.html";
    row.append(back);
    end.append(row);
    return end;
  }

  // Opens a moment in the timeline (showing all types again if it's filtered out).
  function showEvent(id) {
    const item = document.getElementById("e-" + id);
    if (!item) return;
    if (item.hidden) {
      const section = document.getElementById("timeline");
      if (section && section.filterTimeline) section.filterTimeline("all");
    }
    const details = item.querySelector("details");
    if (details) details.open = true;
    history.replaceState(null, "", "#e-" + id);
    item.scrollIntoView({ block: "start" });
    item.classList.remove("is-flash");
    void item.offsetWidth; // restarts the highlight
    item.classList.add("is-flash");
  }

  // Lights up the jump bar link for the section being read.
  function watchSections(nav, ids) {
    if (!("IntersectionObserver" in window)) return;
    const list = nav.querySelector("ul");
    const links = new Map([...nav.querySelectorAll("a")].map(a => [a.getAttribute("href").slice(1), a]));
    const visible = new Set();
    let active = null;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      const current = ids.find(id => visible.has(id)) || null;
      if (current === active) return;
      active = current;
      links.forEach((link, id) => link.classList.toggle("is-active", id === current));
      const link = links.get(current);
      if (link) {
        const left = link.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
          list.scrollLeft = Math.max(0, left - 16);
        }
      }
    }, { rootMargin: "-25% 0px -60% 0px" });
    ids.forEach(id => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  if (document.body.dataset.page === "projects") renderShowcase();
  else if (document.body.dataset.page === "project") renderStory();
})();
