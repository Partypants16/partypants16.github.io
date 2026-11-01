// The Encyclopedia's visual overview (explorer.html): a clickable map of the same pages.
//
// explorer.json comes from encyclopedia.py: every page's title, summary, status, Last checked,
// headings and links (read from the page itself), plus the hand-written areas, walkthroughs
// and typed connections from _workspace/encyclopedia/_explorer/explorer.yaml. Nothing here is
// written twice, so the map can't drift from the pages.
//
// Views live in the URL hash, so Back, bookmarks and links all work:
//   #               the six areas            #area/<id>              one area's groups
//   #page/<out>     a topic and its links    #tours                  every walkthrough
//   #tour/<id>/<a~b~c>  a walkthrough, with the steps taken so far    #all   every page
//
// Page text is only ever set as text (never as HTML). Lines between boxes are an SVG layer
// drawn from where the boxes ended up; on a narrow screen the boxes stack and the lines go.

(function () {
  if (/(^|\.)github\.io$/.test(location.hostname)) return; // encyclopedia.js sends these to the gateway

  const $ = id => document.getElementById(id);
  const box = $("ex");
  const crumbs = $("ex-crumbs");
  if (!box) return;

  const STALE_DAYS = 30;
  const SHOW = 10; // links shown in a column before "more"
  let data = null;
  let lastArea = null;
  let lines = [];
  let firstRoute = true;

  // ---------- Small helpers ----------

  // el("a", {href: "#", class: "x"}, "text", child, …): strings become text nodes.
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value == null) continue;
      if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  const page = out => data.pages[out];
  const named = (tag, attrs, ...kids) => el(tag, Object.assign({ translate: "no" }, attrs), ...kids); // names and page text

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function day(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return d + " " + MONTHS[m - 1] + " " + y;
  }
  function age(iso) {
    return Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
  }

  function badge(status) {
    if (!status) return null;
    return el("span", { class: "ex-st ex-st-" + status.toLowerCase().replace(/\s+/g, "-") }, status);
  }

  function checked(p, long) {
    if (!p.lc) return null;
    const stale = age(p.lc) > STALE_DAYS;
    return el("span", { class: "ex-checked" + (stale ? " is-stale" : ""), title: long && p.ln ? p.ln : null },
      el("span", {}, "checked " + day(p.lc)),
      stale ? el("span", {}, " · may be out of date") : null);
  }

  // A topic as a box on the map. verb: the connection's label, shown above the title.
  function node(out, verb, extra) {
    const p = page(out);
    if (!p) return null;
    return el("a", { class: "ex-node" + (extra ? " " + extra : ""), href: "#page/" + out },
      verb ? named("span", { class: "ex-verb" }, verb) : null,
      named("span", { class: "ex-node-t" }, p.t),
      el("span", { class: "ex-node-meta" }, badge(p.st), p.f ? named("span", { class: "ex-node-s" }, p.s) : null));
  }

  function heading(text, level) {
    return el("h" + (level || 2), { class: "ex-title", tabindex: "-1" }, text);
  }

  function fullPage(out, anchor, label) {
    return el("a", { class: "ex-open", href: out + (anchor ? "#" + anchor : "") }, label || "Open the full page");
  }

  // ---------- Lines between boxes ----------

  function canvas(cls) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ex-lines");
    svg.setAttribute("aria-hidden", "true");
    return el("div", { class: "ex-canvas " + (cls || "") }, svg);
  }

  function link(from, to) {
    if (from && to) lines.push([from, to]);
  }

  function drawLines() {
    document.querySelectorAll(".ex-canvas").forEach(c => {
      const svg = c.querySelector("svg.ex-lines");
      if (!svg) return;
      while (svg.firstChild) svg.firstChild.remove();
      svg.setAttribute("width", c.clientWidth);
      svg.setAttribute("height", c.clientHeight);
      // The CSS turns lines off where boxes stack (--ex-lines: off), so they'd only cross them.
      if (getComputedStyle(c).getPropertyValue("--ex-lines").trim() === "off") return;
      const base = c.getBoundingClientRect();
      for (const [from, to] of lines) {
        if (!c.contains(from) || !c.contains(to)) continue;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const ax = a.left + a.width / 2 - base.left, ay = a.top + a.height / 2 - base.top;
        const bx = b.left + b.width / 2 - base.left, by = b.top + b.height / 2 - base.top;
        let d;
        if (b.left >= a.right || a.left >= b.right) { // side by side: from an edge to the facing edge
          const x1 = bx > ax ? a.right - base.left : a.left - base.left;
          const x2 = bx > ax ? b.left - base.left : b.right - base.left;
          const mid = (x1 + x2) / 2;
          d = `M${x1},${ay} C${mid},${ay} ${mid},${by} ${x2},${by}`;
        } else { // above and below
          const y1 = by > ay ? a.bottom - base.top : a.top - base.top;
          const y2 = by > ay ? b.top - base.top : b.bottom - base.top;
          const mid = (y1 + y2) / 2;
          d = `M${ax},${y1} C${ax},${mid} ${bx},${mid} ${bx},${y2}`;
        }
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        svg.append(path);
      }
    });
  }

  let pending = 0;
  function redraw() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(drawLines);
  }
  window.addEventListener("resize", redraw);
  if (window.ResizeObserver) new ResizeObserver(redraw).observe(box);

  // ---------- Where a topic sits ----------

  function areasWith(out) {
    const found = [];
    for (const area of data.areas) {
      if (area.page === out) found.push({ area, group: null });
      for (const group of area.groups) if (group.pages.includes(out)) found.push({ area, group });
    }
    return found;
  }

  function toursWith(out) {
    return data.tours.map(tour => ({ tour, steps: tour.steps.filter(s => s.page === out) })).filter(x => x.steps.length);
  }

  // Typed connections first, then See also, then the page's other links.
  function connections(out) {
    const p = page(out);
    const seen = new Set([out]);
    const list = [];
    for (const [a, verb, b] of data.rel) {
      if (a === out && !seen.has(b)) { list.push([b, verb]); seen.add(b); }
      else if (b === out && !seen.has(a)) { list.push([a, verb + " this"]); seen.add(a); }
    }
    for (const target of (p.see || []).concat(p.to || [])) {
      if (!seen.has(target) && page(target)) { list.push([target, ""]); seen.add(target); }
    }
    return list;
  }

  // ---------- Crumbs and the mode tabs ----------

  function setCrumbs(parts) {
    crumbs.textContent = "";
    parts.forEach((part, i) => {
      if (i) crumbs.append(el("span", { class: "crumb-sep" }, " › "));
      crumbs.append(part[1] ? el("a", { href: part[1], translate: part[2] ? "no" : null }, part[0])
        : el("span", { "aria-current": "page", translate: part[2] ? "no" : null }, part[0]));
    });
  }

  function setMode(mode) {
    document.querySelectorAll(".ex-modes a").forEach(a => {
      if (a.dataset.mode === mode) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  // ---------- Views ----------

  function overview() {
    setMode("map");
    setCrumbs([["Overview"]]);
    const c = canvas("ex-overview");
    const hub = el("div", { class: "ex-hub" },
      heading("Parth's setup"),
      el("p", {}, Object.keys(data.pages).length + " pages in six areas"));
    const left = el("div", { class: "ex-areas ex-areas-left" });
    const right = el("div", { class: "ex-areas ex-areas-right" });
    data.areas.forEach((area, i) => {
      const grid = i < Math.ceil(data.areas.length / 2) ? left : right;
      const count = new Set(area.groups.flatMap(g => g.pages)).size;
      const card = el("a", { class: "ex-area", href: "#area/" + area.id },
        named("span", { class: "ex-area-t" }, area.title),
        named("span", { class: "ex-area-b" }, area.blurb),
        named("span", { class: "ex-area-g" }, area.groups.map(g => g.title).join(" · ")),
        el("span", { class: "ex-count" }, count + " topics"));
      grid.append(card);
      link(hub, card);
    });
    c.append(left, hub, right);

    const strip = el("section", { class: "ex-strip" }, el("h3", {}, "Or follow a walkthrough"),
      el("div", { class: "ex-tour-cards" }, data.tours.map(tourCard)));
    return [c, strip];
  }

  function area(id) {
    const a = data.areas.find(x => x.id === id);
    if (!a) return overview();
    lastArea = a;
    setMode("map");
    setCrumbs([["Overview", "#"], [a.title, null, true]]);
    const c = canvas("ex-area-map");
    const head = el("div", { class: "ex-head" },
      heading(a.title),
      named("p", {}, a.blurb),
      a.page ? el("p", { class: "ex-start" }, el("span", {}, "Start with "), node(a.page)) : null);
    // The head joins the first row of groups; each group joins the one below it (two columns).
    const groups = el("div", { class: "ex-groups" });
    const boxes = [];
    for (const g of a.groups) {
      const groupBox = el("section", { class: "ex-group" },
        named("h3", {}, g.title),
        g.blurb ? named("p", {}, g.blurb) : null,
        el("div", { class: "ex-nodes" }, g.pages.map(out => node(out))));
      groups.append(groupBox);
      link(boxes.length < 2 ? head : boxes[boxes.length - 2], groupBox);
      boxes.push(groupBox);
    }
    c.append(head, groups);

    const outs = new Set(a.groups.flatMap(g => g.pages));
    const tours = data.tours.filter(t => t.steps.some(s => outs.has(s.page)));
    const guide = el("aside", { class: "ex-guide" },
      tours.length ? el("section", {}, el("h3", {}, "Walkthroughs through here"),
        el("ul", {}, tours.map(t => el("li", {}, named("a", { href: "#tour/" + t.id }, t.title))))) : null,
      el("section", {}, el("h3", {}, "Other areas"),
        el("ul", {}, data.areas.filter(x => x !== a).map(x => el("li", {}, named("a", { href: "#area/" + x.id }, x.title))))));
    return [el("div", { class: "ex-split" }, c, guide)];
  }

  function topic(out) {
    const p = page(out);
    if (!p) return overview();
    setMode("map");
    const homes = areasWith(out);
    const home = (lastArea && homes.find(h => h.area === lastArea)) || homes[0];
    if (home) lastArea = home.area;
    setCrumbs([["Overview", "#"]].concat(home ? [[home.area.title, "#area/" + home.area.id, true]] : [], [[p.t, null, true]]));

    const c = canvas("ex-topic");
    const centre = el("div", { class: "ex-centre" },
      p.f ? named("p", { class: "ex-section" }, p.s) : null,
      heading(p.t),
      el("p", { class: "ex-node-meta" }, badge(p.st), checked(p, true)),
      p.sum ? named("p", { class: "ex-sum" }, p.sum) : null,
      fullPage(out));

    function column(title, items, cls) {
      const col = el("section", { class: "ex-col " + cls }, el("h3", {}, title));
      if (!items.length) {
        col.append(el("p", { class: "ex-none" }, "None"));
        return col;
      }
      const list = el("div", { class: "ex-nodes" });
      items.slice(0, SHOW).forEach(([target, verb]) => {
        const n = node(target, verb);
        list.append(n);
        if (cls === "ex-from") link(n, centre); else link(centre, n);
      });
      col.append(list);
      if (items.length > SHOW) {
        const more = el("button", { type: "button", class: "ex-more" }, items.length - SHOW + " more");
        more.addEventListener("click", () => {
          items.slice(SHOW).forEach(([target, verb]) => list.append(node(target, verb)));
          more.remove();
          redraw();
        });
        col.append(more);
      }
      return col;
    }

    const from = (p.from || []).map(o => [o, ""]);
    c.append(column("Linked from", from, "ex-from"), centre, column("Connects to", connections(out), "ex-to"));

    const counts = p.c ? [["v", "verified"], ["i", "inferred"], ["r", "reported"], ["u", "unknown"]]
      .filter(([k]) => p.c[k]).map(([k, word]) => p.c[k] + " " + word) : [];
    const tours = toursWith(out);
    const guide = el("aside", { class: "ex-guide" },
      p.h && p.h.length ? el("section", {}, el("h3", {}, "On the page"),
        el("ul", {}, p.h.map(([text, slug]) => el("li", {}, named("a", { href: out + "#" + slug }, text))))) : null,
      counts.length ? el("section", {}, el("h3", {}, "How sure the page is"),
        el("p", {}, counts.join(" · ")),
        el("p", { class: "ex-hint" }, "Labels on the page's facts. Verified means someone looked.")) : null,
      p.ln ? el("section", {}, el("h3", {}, "Last checked"), named("p", {}, day(p.lc) + (p.ln ? " · " + p.ln : ""))) : null,
      homes.length ? el("section", {}, el("h3", {}, "On the map"),
        el("ul", {}, homes.map(h => el("li", {}, named("a", { href: "#area/" + h.area.id },
          h.area.title + (h.group ? " › " + h.group.title : "")))))) : null,
      tours.length ? el("section", {}, el("h3", {}, "In walkthroughs"),
        el("ul", {}, tours.map(({ tour, steps }) => el("li", {},
          named("a", { href: "#tour/" + tour.id + "/" + trailTo(tour, steps[0].id).join("~") }, tour.title))))) : null);
    return [el("div", { class: "ex-split" }, c, guide)];
  }

  // ---------- Walkthroughs ----------

  function nextOf(tour, step) {
    if (step.end || step.choices) return null;
    if (step.go) return tour.steps.find(s => s.id === step.go) || null;
    const i = tour.steps.indexOf(step);
    return tour.steps[i + 1] || null;
  }

  const branching = tour => tour.steps.some(s => s.choices);

  // The shortest way from the first step to a step, following "next" and the choices.
  function trailTo(tour, id) {
    const start = tour.steps[0];
    const queue = [[start, [start.id]]];
    const seen = new Set([start.id]);
    while (queue.length) {
      const [step, path] = queue.shift();
      if (step.id === id) return path;
      const outs = step.choices ? step.choices.map(c => tour.steps.find(s => s.id === c.go)) : [nextOf(tour, step)];
      for (const s of outs) {
        if (s && !seen.has(s.id)) {
          seen.add(s.id);
          queue.push([s, path.concat(s.id)]);
        }
      }
    }
    return [start.id];
  }

  function tourCard(tour) {
    const first = tour.steps.slice(0, 4).map(s => (page(s.page) || {}).t).filter(Boolean);
    return el("a", { class: "ex-tour-card", href: "#tour/" + tour.id },
      named("span", { class: "ex-area-t" }, tour.title),
      named("span", { class: "ex-area-b" }, tour.blurb),
      named("span", { class: "ex-area-g" }, first.join(" → ") + (tour.steps.length > 4 ? " → …" : "")),
      el("span", { class: "ex-count" }, branching(tour) ? "Choose your way" : tour.steps.length + " steps"));
  }

  function tours() {
    setMode("tours");
    setCrumbs([["Overview", "#"], ["Walkthroughs"]]);
    return [el("div", { class: "ex-head ex-plain" }, heading("Walkthroughs"),
      el("p", {}, "Step-by-step paths through the pages. Each step says why it's there; open any page on the way.")),
      el("div", { class: "ex-tour-cards ex-tour-list" }, data.tours.map(tourCard))];
  }

  function tour(id, trailText) {
    const t = data.tours.find(x => x.id === id);
    if (!t || !t.steps.length) return tours();
    setMode("tours");
    const byId = new Map(t.steps.map(s => [s.id, s]));
    let trail = (trailText ? trailText.split("~") : [t.steps[0].id]).filter(s => byId.has(s));
    if (!trail.length) trail = [t.steps[0].id];
    const step = byId.get(trail[trail.length - 1]);
    const p = page(step.page);
    setCrumbs([["Overview", "#"], ["Walkthroughs", "#tours"], [t.title, null, true]]);
    const to = ids => "#tour/" + t.id + "/" + ids.join("~");

    // The flow: every step for a straight walkthrough, the path taken so far for a branching one.
    const flow = el("ol", { class: "ex-flow" });
    const shown = branching(t) ? trail.map(sid => byId.get(sid)) : t.steps;
    shown.forEach((s, i) => {
      const at = trail.indexOf(s.id);
      const state = s === step ? " is-current" : at !== -1 ? " is-done" : "";
      const target = branching(t) ? trail.slice(0, at + 1) : t.steps.slice(0, i + 1).map(x => x.id);
      const label = i < shown.length - 1 ? arrowLabel(s, shown[i + 1]) : "";
      flow.append(el("li", { class: "ex-flow-step" + state },
        el("a", { href: to(target), "aria-current": s === step ? "step" : null },
          el("span", { class: "ex-flow-n" }, String(i + 1)),
          named("span", { class: "ex-flow-t" }, (page(s.page) || {}).t || s.page)),
        label ? named("span", { class: "ex-flow-arrow" }, label) : null));
    });

    const prev = trail.length > 1 ? el("a", { class: "ex-btn", href: to(trail.slice(0, -1)) }, "Previous") : null;
    const next = nextOf(t, step);
    let forward;
    if (step.choices) {
      forward = el("div", { class: "ex-choices" }, el("p", { class: "ex-hint" }, "What are you seeing?"),
        step.choices.map(c => named("a", { class: "ex-btn ex-choice", href: to(trail.concat(c.go)) }, c.label)));
    } else if (next) {
      forward = el("a", { class: "ex-btn ex-primary", href: to(trail.concat(next.id)) },
        el("span", {}, "Next"), step.next ? named("span", { class: "ex-btn-sub" }, ": " + step.next) : null);
    } else {
      forward = el("div", { class: "ex-choices" }, el("p", { class: "ex-hint" }, "End of the walkthrough."),
        el("a", { class: "ex-btn", href: to([t.steps[0].id]) }, "Start again"),
        el("a", { class: "ex-btn", href: "#tours" }, "Other walkthroughs"));
    }

    const card = el("section", { class: "ex-step" },
      el("p", { class: "ex-section" }, branching(t) ? "Step " + trail.length : "Step " + trail.length + " of " + t.steps.length),
      el("h3", {}, named("a", { href: "#page/" + step.page }, p ? p.t : step.page)),
      p ? el("p", { class: "ex-node-meta" }, badge(p.st), checked(p)) : null,
      step.note ? named("p", { class: "ex-note" }, step.note) : null,
      p && p.sum ? named("p", { class: "ex-sum" }, p.sum) : null,
      fullPage(step.page, step.anchor, step.anchor ? "Open that part of the page" : null),
      el("div", { class: "ex-step-nav" }, prev, forward));

    return [el("div", { class: "ex-head ex-plain" }, heading(t.title), named("p", {}, t.blurb)), flow, card];
  }

  function arrowLabel(from, to) {
    if (from.choices) {
      const choice = from.choices.find(c => c.go === to.id);
      return choice ? choice.label : "";
    }
    return from.next || "";
  }

  // ---------- Every page ----------

  let filter = { text: "", status: "" };

  function all() {
    setMode("all");
    setCrumbs([["Overview", "#"], ["Every page"]]);
    const statuses = {};
    Object.values(data.pages).forEach(p => { if (p.st) statuses[p.st] = (statuses[p.st] || 0) + 1; });
    const list = el("div", { class: "ex-all" });
    const input = el("input", { type: "search", class: "ex-filter", placeholder: "Filter by name", "aria-label": "Filter by name", value: filter.text });
    const chips = el("div", { class: "ex-chips", role: "group", "aria-label": "Status" });

    function fill() {
      list.textContent = "";
      const words = filter.text.toLowerCase().split(/\s+/).filter(Boolean);
      let total = 0;
      for (const [folder, label, outs] of data.sections) {
        const hits = outs.filter(out => {
          const p = page(out);
          const hay = (p.t + " " + p.s).toLowerCase();
          return (!filter.status || p.st === filter.status) && words.every(w => hay.includes(w));
        });
        if (!hits.length) continue;
        total += hits.length;
        list.append(el("section", { class: "ex-group" }, named("h3", {}, folder ? label : "Encyclopedia"),
          el("div", { class: "ex-nodes" }, hits.map(out => node(out)))));
      }
      if (!total) list.append(el("p", { class: "ex-none" }, "No pages match."));
    }

    function chip(label, value, count) {
      const b = el("button", { type: "button", class: "ex-chip", "aria-pressed": String(filter.status === value) },
        el("span", {}, label), count != null ? el("span", { class: "ex-chip-n" }, " " + count) : null);
      b.addEventListener("click", () => {
        filter.status = value;
        chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        fill();
      });
      return b;
    }
    chips.append(chip("All", "", null), ...Object.keys(statuses).sort().map(s => chip(s, s, statuses[s])));
    input.addEventListener("input", () => { filter.text = input.value; fill(); });
    fill();
    return [el("div", { class: "ex-head ex-plain" }, heading("Every page"),
      el("p", {}, "Every page of the Encyclopedia by section. Pick one to see what it connects to.")),
      el("div", { class: "ex-tools" }, input, chips), list];
  }

  // ---------- Routing ----------

  function route() {
    lines = [];
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    const [kind, ...rest] = hash.split("/");
    let view;
    if (kind === "area") view = area(rest[0]);
    else if (kind === "page") view = topic(rest.join("/"));
    else if (kind === "tours") view = tours();
    else if (kind === "tour") view = tour(rest[0], rest[1]);
    else if (kind === "all") view = all();
    else view = overview();
    box.textContent = "";
    box.append(...view);
    redraw();
    if (!firstRoute) {
      const title = box.querySelector(".ex-title");
      if (title) {
        title.focus({ preventScroll: true });
        const top = crumbs.getBoundingClientRect().top;
        if (top < 0 || top > innerHeight * 0.6) crumbs.scrollIntoView({ block: "start" });
      }
    }
    firstRoute = false;
  }

  fetch("explorer.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : Promise.reject(response.status))
    .then(json => {
      data = json;
      window.addEventListener("hashchange", route);
      route();
    })
    .catch(() => {
      box.textContent = "";
      box.append(el("p", { class: "ex-none" }, "The map's data didn't load. The pages themselves are in the contents on the left."));
    });
})();
