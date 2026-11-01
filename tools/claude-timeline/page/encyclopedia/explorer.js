// The Encyclopedia's visual overview (explorer.html): the pages as a flowchart on a dark canvas,
// like n8n's editor, with a details panel on the right like Azure Logic Apps' designer.
//
// explorer.json comes from encyclopedia.py: every page's title, summary, status, Last checked,
// headings and links (read from the page itself), plus the hand-written areas, walkthroughs and
// typed connections from _workspace/encyclopedia/_explorer/explorer.yaml. Nothing is written twice.
//
// Views live in the URL hash, so Back, bookmarks and links work:
//   #                     the map: Parth's setup → six areas → their groups
//   #area/<id>[/<page>]   one area → its groups → their pages (a page selected)
//   #page/<page>          a page, shown in the area it belongs to
//   #tour/<id>[/<step>]   a walkthrough        #tours  the first one        #all  every page
//
// Cards hold only an icon, a title, one short line and a status dot; everything else is in the
// panel. Page text is only ever set as text (never as HTML).

(function () {
  if (/(^|\.)github\.io$/.test(location.hostname)) return; // encyclopedia.js sends these to the gateway

  const $ = id => document.getElementById(id);
  const app = $("nx");
  if (!app) return;
  const stage = $("nx-stage");
  const viewport = $("nx-viewport");
  const world = $("nx-world");
  const panel = $("nx-panel");
  const list = $("nx-list");
  const crumbs = $("nx-crumbs");
  const tourBar = $("nx-tours");

  const W = 236, H = 56;            // a card
  const STALE_DAYS = 30;
  const NARROW = 720;               // below this the map is one indented column
  const SVG = "http://www.w3.org/2000/svg";

  let data = null;
  let view = null;                  // {kind, nodes, edges, …}
  let selected = null;              // a node of the current view, or a page out for the list
  let lastArea = null;
  let trail = [];                   // steps taken in a branching walkthrough
  const camera = { x: 0, y: 0, k: 1 };

  // ---------- Small helpers ----------

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
  const named = (tag, attrs, ...kids) => el(tag, Object.assign({ translate: "no" }, attrs), ...kids); // names and page text
  const page = out => data.pages[out];

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = iso => { const [y, m, d] = iso.split("-").map(Number); return d + " " + MONTHS[m - 1] + " " + y; };
  const age = iso => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
  const slug = text => text.toLowerCase().replace(/\s+/g, "-");

  // ---------- Icons and colours ----------

  const ICONS = {
    hub: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v4M12 18v4M2 12h4M18 12h4",
    laptop: "M4 5h16v11H4zM2 19h20",
    server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
    folder: "M3 6h6l2 2h10v11H3z",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    wrench: "M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-3-3z",
    book: "M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0-2 2zM6 21h14",
    layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
    page: "M6 3h9l4 4v14H6zM14 3v5h5",
    cube: "M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
    alert: "M12 3l10 18H2zM12 10v4M12 17h.01",
    list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
    people: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6",
    pause: "M8 5v14M16 5v14",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
    share: "M6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
    flag: "M5 21V4h11l-2 4 2 4H5",
  };
  const AREA_LOOK = {
    laptop: ["laptop", "#7c8cff"], box: ["server", "#2fb380"], projects: ["folder", "#f0a43c"],
    connect: ["link", "#b57bf2"], ops: ["wrench", "#f0706a"], knowledge: ["book", "#3fbcd6"],
  };
  const FOLDER_LOOK = {
    "": ["book", "knowledge"], "00-index": ["search", "knowledge"], "01-system": ["server", "box"],
    "02-infrastructure": ["layers", "box"], "03-services": ["cube", "box"], "04-operations": ["wrench", "ops"],
    "05-architecture": ["share", "box"], "06-inventory": ["list", "box"], "07-encyclopedia-tab": ["book", "connect"],
    "08-history": ["clock", "knowledge"], "09-plans-and-parked": ["pause", "knowledge"], "10-workspace": ["laptop", "laptop"],
    "11-people-and-access": ["people", "knowledge"], "12-projects": ["folder", "projects"], "13-how-do-i": ["list", "ops"],
    "14-disaster-scenarios": ["alert", "ops"],
  };
  const pageIcon = out => (FOLDER_LOOK[page(out).f] || ["page"])[0];
  const pageColor = out => AREA_LOOK[(FOLDER_LOOK[page(out).f] || [, "knowledge"])[1]][1];

  function icon(name, color) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", ICONS[name] || ICONS.page);
    svg.append(path);
    return el("span", { class: "nx-ico", style: color ? "--c:" + color : null }, svg);
  }

  function statusClass(status) {
    const s = (status || "").toLowerCase();
    if (/running|active|on demand/.test(s)) return "ok";
    if (/parked|paused/.test(s)) return "wait";
    if (/idea/.test(s)) return "idea";
    if (/progress|testing/.test(s)) return "work";
    if (/not running/.test(s)) return "off";
    return s ? "done" : "";
  }
  const chip = status => status ? el("span", { class: "nx-st nx-st-" + statusClass(status) }, status) : null;

  // ---------- Building a view's cards and lines ----------

  function pageNode(out, id, extra) {
    const p = page(out);
    return Object.assign({ id, kind: "page", out, title: p.t, sub: p.s || "Encyclopedia", icon: pageIcon(out),
      color: pageColor(out), status: p.st }, extra || {});
  }

  // Map: Parth's setup → the six areas → their groups.
  function overviewTree() {
    const total = Object.keys(data.pages).length;
    return {
      node: { id: "root", kind: "root", title: "Parth's setup", sub: total + " pages", icon: "hub", color: "#ff6d5a" },
      kids: data.areas.map((a, ai) => {
        const [ic, color] = AREA_LOOK[a.id] || ["folder", "#888"];
        return {
          node: { id: "a" + ai, kind: "area", area: a, title: a.title, sub: a.groups.length + " groups", icon: ic, color },
          kids: a.groups.map((g, gi) => ({
            node: { id: `g${ai}-${gi}`, kind: "group", area: a, group: g, title: g.title, sub: g.pages.length + (g.pages.length === 1 ? " page" : " pages"), icon: "layers", color },
            kids: [],
          })),
        };
      }),
    };
  }

  // An area → its groups → their pages.
  function areaTree(a) {
    const [ic, color] = AREA_LOOK[a.id] || ["folder", "#888"];
    return {
      node: { id: "area", kind: "area", area: a, title: a.title, sub: a.groups.length + " groups", icon: ic, color },
      kids: a.groups.map((g, gi) => ({
        node: { id: "g" + gi, kind: "group", area: a, group: g, title: g.title, sub: g.pages.length + (g.pages.length === 1 ? " page" : " pages"), icon: "layers", color },
        kids: g.pages.map((out, pi) => ({ node: pageNode(out, `p${gi}-${pi}`, { color, area: a, group: g }), kids: [] })),
      })),
    };
  }

  // Wide: the top card, a row of children under it, and each child's own children hanging below
  // it on a connector (like a file tree). Narrow: everything in one indented column.
  function layoutTree(tree, narrow) {
    const nodes = [], edges = [];
    if (narrow) {
      let y = 0;
      (function walk(t, depth, parent) {
        Object.assign(t.node, { x: depth * 26, y, w: W, h: H });
        nodes.push(t.node);
        y += H + 12;
        if (parent) edges.push({ from: parent.id, to: t.node.id, type: "spine" });
        t.kids.forEach(k => walk(k, depth + 1, t.node));
      })(tree, 0, null);
      return { nodes, edges };
    }
    const GAP = 44, INDENT = 26;
    const rowY = H + 84;
    tree.kids.forEach((k, i) => {
      Object.assign(k.node, { x: i * (W + GAP), y: rowY, w: W, h: H });
      nodes.push(k.node);
      edges.push({ from: tree.node.id, to: k.node.id, type: "tb" });
      let y = rowY + H + 22;
      k.kids.forEach(c => {
        Object.assign(c.node, { x: k.node.x + INDENT, y, w: W - INDENT, h: H });
        nodes.push(c.node);
        edges.push({ from: k.node.id, to: c.node.id, type: "spine" });
        y += H + 12;
      });
    });
    const rowWidth = tree.kids.length * (W + GAP) - GAP;
    Object.assign(tree.node, { x: (rowWidth - W) / 2, y: 0, w: W, h: H });
    nodes.unshift(tree.node);
    return { nodes, edges };
  }

  // A walkthrough: a straight one runs top to bottom; a branching one left to right in layers.
  function tourView(t, narrow) {
    const branching = t.steps.some(s => s.choices);
    const nodes = t.steps.map((s, i) => pageNode(s.page, "s:" + s.id, Object.assign({ kind: "step", step: s, index: i }, branching ? {} : { sub: "Step " + (i + 1) })));
    const byId = new Map(nodes.map(n => [n.step.id, n]));
    const edges = [];
    t.steps.forEach((s, i) => {
      if (s.choices) s.choices.forEach(c => byId.has(c.go) && edges.push({ from: "s:" + s.id, to: "s:" + c.go, label: c.label, at: 0.5 }));
      else if (!s.end) {
        const next = s.go ? byId.get(s.go) : nodes[i + 1];
        // A branching walkthrough labels only its choices; the panel still says what comes next.
        if (next) edges.push({ from: "s:" + s.id, to: next.id, label: branching ? "" : s.next || "" });
      }
    });
    if (!branching) {
      nodes.forEach((n, i) => Object.assign(n, { x: 0, y: i * (H + 64), w: W + 40, h: H }));
      edges.forEach(e => (e.type = "tb"));
      return { nodes, edges, branching };
    }
    // Layer = the longest way from the first step; within a layer, the order steps were reached.
    const level = new Map([[nodes[0].id, 0]]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        const l = level.get(e.from);
        if (l != null && (level.get(e.to) == null || level.get(e.to) < l + 1)) { level.set(e.to, l + 1); changed = true; }
      }
    }
    if (narrow) { // one indented column, each step under the first step that leads to it
      const seen = new Set(), order = [];
      (function walk(n, depth) {
        if (seen.has(n.id)) return;
        seen.add(n.id);
        order.push([n, depth]);
        edges.filter(e => e.from === n.id).forEach(e => walk(nodes.find(x => x.id === e.to), depth + 1));
      })(nodes[0], 0);
      order.forEach(([n, depth], i) => Object.assign(n, { x: depth * 26, y: i * (H + 12), w: W, h: H }));
      edges.forEach(e => (e.type = "spine"));
      return { nodes: order.map(([n]) => n), edges: edges.filter(e => order.findIndex(([n]) => n.id === e.to) > order.findIndex(([n]) => n.id === e.from)), branching };
    }
    const columns = [];
    nodes.forEach(n => { const l = level.get(n.id) || 0; (columns[l] = columns[l] || []).push(n); });
    const tallest = Math.max(...columns.map(c => c.length));
    columns.forEach((col, l) => col.forEach((n, i) => Object.assign(n, {
      x: l * (W + 200), y: (i + (tallest - col.length) / 2) * (H + 34), w: W, h: H,
    })));
    edges.forEach(e => (e.type = "lr"));
    return { nodes, edges, branching };
  }

  // ---------- Drawing ----------

  function edgePath(a, b, type) {
    if (type === "lr") {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, d = Math.max(40, (x2 - x1) / 2);
      return { d: `M${x1},${y1} C${x1 + d},${y1} ${x2 - d},${y2} ${x2},${y2}`, at: t => bezier([x1, y1], [x1 + d, y1], [x2 - d, y2], [x2, y2], t) };
    }
    if (type === "spine") {
      const x1 = a.x + 20, y1 = a.y + a.h, x2 = b.x, y2 = b.y + b.h / 2, r = 8;
      return { d: `M${x1},${y1} V${y2 - r} Q${x1},${y2} ${x1 + r},${y2} H${x2}`, at: null };
    }
    const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y, d = Math.max(24, (y2 - y1) / 2);
    return { d: `M${x1},${y1} C${x1},${y1 + d} ${x2},${y2 - d} ${x2},${y2}`, at: t => bezier([x1, y1], [x1, y1 + d], [x2, y2 - d], [x2, y2], t) };
  }

  function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return [0, 1].map(i => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
  }

  function draw() {
    world.textContent = "";
    const byId = new Map(view.nodes.map(n => [n.id, n]));
    const width = Math.max(...view.nodes.map(n => n.x + n.w)) + 40;
    const height = Math.max(...view.nodes.map(n => n.y + n.h)) + 40;
    view.size = [width, height];
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "nx-edges");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS(SVG, "defs");
    defs.innerHTML = '<marker id="nx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>';
    svg.append(defs);
    world.append(svg);
    for (const e of view.edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) continue;
      const { d, at } = edgePath(a, b, e.type);
      const mid = at && at(e.type === "lr" && e.at ? e.at : 0.5);
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "nx-edge nx-edge-" + e.type);
      if (e.type !== "spine") path.setAttribute("marker-end", "url(#nx-arrow)");
      svg.append(path);
      e.el = path;
      if (e.label && mid) {
        e.labelEl = named("span", { class: "nx-edge-label", style: `left:${mid[0]}px;top:${mid[1]}px` }, e.label);
        world.append(e.labelEl);
      }
    }
    for (const n of view.nodes) {
      n.el = el("button", {
        type: "button", class: "nx-node nx-k-" + n.kind, style: `left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px`,
        "data-id": n.id, "aria-label": n.title + (n.status ? ", " + n.status : ""),
        onclick: event => { if (!dragged) select(n, { from: "canvas" }); event.stopPropagation(); },
        ondblclick: () => { if (n.kind === "area" && view.kind === "map") location.hash = "#area/" + n.area.id; },
        onfocus: () => ensureVisible(n),
      },
      icon(n.icon, n.color),
      el("span", { class: "nx-label" }, named("span", { class: "nx-t" }, n.title), named("span", { class: "nx-sub" }, n.sub)),
      n.status ? el("span", { class: "nx-dot nx-dot-" + statusClass(n.status), title: n.status }) : null);
      world.append(n.el);
    }
    world.style.width = width + "px";
    world.style.height = height + "px";
    highlight();
  }

  function highlight() {
    if (!view || !view.nodes) return;
    const id = selected && selected.id;
    view.nodes.forEach(n => n.el && n.el.classList.toggle("is-selected", n.id === id));
    view.edges.forEach(e => {
      if (!e.el) return;
      const on = id && (e.from === id || e.to === id);
      e.el.classList.toggle("is-active", !!on);
      if (e.labelEl) e.labelEl.classList.toggle("is-active", !!on);
    });
  }

  // ---------- Camera: drag to move, Ctrl + scroll or pinch to zoom ----------

  function apply(animate) {
    world.classList.toggle("is-moving", !!animate);
    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
    viewport.style.backgroundPosition = `${camera.x}px ${camera.y}px`;
    viewport.style.backgroundSize = `${20 * camera.k}px ${20 * camera.k}px`;
  }

  function panelWidth() {
    return !panel.hidden && stage.clientWidth >= NARROW ? panel.offsetWidth : 0;
  }

  // On a phone the panel is a sheet over the bottom of the canvas.
  function visibleHeight() {
    return viewport.clientHeight - (!panel.hidden && stage.clientWidth < NARROW ? panel.offsetHeight : 0);
  }

  function fit() {
    if (!view || !view.size) return;
    const [w, h] = view.size;
    const cw = viewport.clientWidth - panelWidth(), ch = viewport.clientHeight;
    camera.k = Math.min(1, (cw - 32) / w);
    if (view.kind !== "map" || stage.clientWidth < NARROW) camera.k = Math.min(1, Math.max(camera.k, 0.55));
    camera.x = Math.max(16, (cw - w * camera.k) / 2);
    camera.y = h * camera.k < ch - 32 ? (ch - h * camera.k) / 2 : 24;
    apply(true);
  }

  function zoomAt(factor, cx, cy) {
    const k = Math.min(1.6, Math.max(0.3, camera.k * factor));
    camera.x = cx - (cx - camera.x) * (k / camera.k);
    camera.y = cy - (cy - camera.y) * (k / camera.k);
    camera.k = k;
    apply();
  }

  function centreOn(n) {
    const cw = viewport.clientWidth - panelWidth(), ch = visibleHeight();
    camera.x = cw / 2 - (n.x + n.w / 2) * camera.k;
    camera.y = ch / 2 - (n.y + n.h / 2) * camera.k;
    apply(true);
  }

  function ensureVisible(n) {
    const cw = viewport.clientWidth - panelWidth(), ch = visibleHeight();
    const x = camera.x + n.x * camera.k, y = camera.y + n.y * camera.k;
    if (x < 0 || y < 0 || x + n.w * camera.k > cw || y + n.h * camera.k > ch) centreOn(n);
  }

  let dragged = false;
  const pointers = new Map();
  let pinch = null;
  viewport.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: camera.k };
    }
  });
  viewport.addEventListener("pointermove", event => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const dx = event.clientX - last[0], dy = event.clientY - last[1];
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const box = viewport.getBoundingClientRect();
      const factor = (pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d) / camera.k;
      zoomAt(factor, (a[0] + b[0]) / 2 - box.left, (a[1] + b[1]) / 2 - box.top);
      dragged = true;
      return;
    }
    if (!dragged && Math.abs(dx) + Math.abs(dy) < 3) return;
    if (!dragged) { dragged = true; viewport.setPointerCapture(event.pointerId); viewport.classList.add("is-dragging"); }
    camera.x += dx;
    camera.y += dy;
    apply();
  });
  const release = event => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    viewport.classList.remove("is-dragging");
    setTimeout(() => { if (!pointers.size) dragged = false; }, 0);
  };
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  viewport.addEventListener("click", () => { if (!dragged) closePanel(); });
  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    const box = viewport.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) zoomAt(Math.exp(-event.deltaY * 0.0025), event.clientX - box.left, event.clientY - box.top);
    else { camera.x -= event.deltaX; camera.y -= event.deltaY; apply(); }
  }, { passive: false });

  $("nx-zoom").addEventListener("click", event => {
    const which = event.target.closest("button") && event.target.closest("button").dataset.zoom;
    const cx = (viewport.clientWidth - panelWidth()) / 2, cy = viewport.clientHeight / 2;
    if (which === "in") zoomAt(1.2, cx, cy);
    if (which === "out") zoomAt(1 / 1.2, cx, cy);
    if (which === "fit") fit();
  });
  stage.addEventListener("keydown", event => {
    if (/^(input|textarea)$/i.test(event.target.tagName)) return;
    if (event.key === "Escape" && !panel.hidden) { closePanel(true); event.preventDefault(); }
    const cx = (viewport.clientWidth - panelWidth()) / 2, cy = viewport.clientHeight / 2;
    if (event.key === "+" || event.key === "=") zoomAt(1.2, cx, cy);
    if (event.key === "-") zoomAt(1 / 1.2, cx, cy);
    if (event.key === "0") fit();
  });

  // ---------- The panel ----------

  function row(out, verb, onClick) {
    const p = page(out);
    return el("li", {}, el("button", { type: "button", class: "nx-row", onclick: onClick || (() => goToPage(out)) },
      icon(pageIcon(out), pageColor(out)),
      el("span", { class: "nx-row-t" }, verb ? named("span", { class: "nx-verb" }, verb) : null, named("span", {}, p.t)),
      p.st ? el("span", { class: "nx-dot nx-dot-" + statusClass(p.st), title: p.st }) : null));
  }

  function section(title, ...body) {
    return el("section", { class: "nx-sec" }, el("h3", {}, title), ...body);
  }

  function tabs(spec) {
    const live = spec.filter(Boolean);
    const strip = el("div", { class: "nx-tabs", role: "tablist" });
    const bodies = [];
    live.forEach(([label, body], i) => {
      const id = "nx-tab-" + i;
      const b = el("button", { type: "button", role: "tab", id: id + "-t", "aria-controls": id, "aria-selected": String(i === 0), tabindex: i ? "-1" : "0" }, label);
      const p = el("div", { role: "tabpanel", id, "aria-labelledby": id + "-t", class: "nx-tabpanel", hidden: i !== 0 }, body);
      b.addEventListener("click", () => show(i));
      b.addEventListener("keydown", event => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (step) { const j = (i + step + live.length) % live.length; show(j); strip.children[j].focus(); event.preventDefault(); }
      });
      strip.append(b);
      bodies.push(p);
    });
    function show(i) {
      [...strip.children].forEach((b, j) => { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
      bodies.forEach((p, j) => (p.hidden = i !== j));
    }
    return [strip, ...bodies];
  }

  function head(iconName, color, title, sub, status) {
    return el("div", { class: "nx-panel-head" },
      icon(iconName, color),
      el("div", { class: "nx-panel-titles" }, named("h2", { tabindex: "-1" }, title), sub ? named("p", {}, sub) : null),
      el("button", { type: "button", class: "nx-close", "aria-label": "Close details", title: "Close details", onclick: () => closePanel(true) }, "×"),
      status ? el("div", { class: "nx-panel-status" }, chip(status)) : null);
  }

  function pageTabs(out) {
    const p = page(out);
    const facts = el("dl", { class: "nx-facts" });
    const fact = (label, ...value) => facts.append(el("dt", {}, label), el("dd", {}, ...value));
    if (p.st) fact("Status", chip(p.st));
    if (p.lc) fact("Last checked", named("span", {}, day(p.lc)), age(p.lc) > STALE_DAYS ? el("span", { class: "nx-stale" }, " · may be out of date") : null);
    if (p.ln) fact("Checked how", named("span", {}, p.ln));
    const counts = p.c ? [["v", "verified"], ["i", "inferred"], ["r", "reported"], ["u", "unknown"]].filter(([k]) => p.c[k]).map(([k, w]) => p.c[k] + " " + w) : [];
    if (counts.length) fact("How sure", el("span", {}, counts.join(" · ")));
    const homes = [];
    data.areas.forEach(a => a.groups.forEach(g => g.pages.includes(out) && homes.push([a, g])));
    const tours = data.tours.flatMap(t => t.steps.filter(s => s.page === out).map(s => [t, s]));
    const details = [
      p.sum ? named("p", { class: "nx-sum" }, p.sum) : null,
      facts,
      homes.length ? section("On the map", el("ul", { class: "nx-rows" }, homes.map(([a, g]) => el("li", {},
        el("button", { type: "button", class: "nx-row", onclick: () => go("#area/" + a.id + "/" + out) },
          icon((AREA_LOOK[a.id] || ["folder"])[0], (AREA_LOOK[a.id] || [, "#888"])[1]), named("span", { class: "nx-row-t" }, a.title + " › " + g.title)))))) : null,
      tours.length ? section("In walkthroughs", el("ul", { class: "nx-rows" }, tours.map(([t, s]) => el("li", {},
        el("button", { type: "button", class: "nx-row", onclick: () => go("#tour/" + t.id + "/" + s.id) },
          icon("flag", "#ff6d5a"), named("span", { class: "nx-row-t" }, t.title)))))) : null,
    ];
    const conn = connections(out);
    const from = p.from || [];
    const links = (conn.length || from.length) ? [
      conn.length ? section("Connects to", el("ul", { class: "nx-rows" }, conn.map(([o, verb]) => row(o, verb)))) : null,
      from.length ? section("Linked from", el("ul", { class: "nx-rows" }, from.map(o => row(o)))) : null,
    ] : null;
    const contents = p.h && p.h.length ? el("ul", { class: "nx-toc" }, p.h.map(([text, s]) => el("li", {}, named("a", { href: out + "#" + s }, text)))) : null;
    return tabs([
      ["Details", details],
      links && ["Links (" + (conn.length + from.length) + ")", links],
      contents && ["On the page (" + p.h.length + ")", contents],
    ]);
  }

  // Typed connections first, then See also, then the page's other links.
  function connections(out) {
    const p = page(out), seen = new Set([out]), found = [];
    for (const [a, verb, b] of data.rel) {
      if (a === out && !seen.has(b)) { found.push([b, verb]); seen.add(b); }
      else if (b === out && !seen.has(a)) { found.push([a, verb + " this"]); seen.add(a); }
    }
    for (const t of (p.see || []).concat(p.to || [])) if (!seen.has(t) && page(t)) { found.push([t, ""]); seen.add(t); }
    return found;
  }

  function openButton(out, anchor, label) {
    return el("a", { class: "nx-btn nx-primary", href: out + (anchor ? "#" + anchor : "") }, label || "Open the full page");
  }

  function fillPanel(n) {
    panel.textContent = "";
    let parts;
    if (n.kind === "root") {
      parts = [head("hub", "#ff6d5a", "Parth's setup", n.sub),
        el("div", { class: "nx-panel-body" },
          el("p", { class: "nx-sum" }, "Everything the Encyclopedia covers, in six areas. Pick an area to see what's in it."),
          section("Areas", el("ul", { class: "nx-rows" }, data.areas.map(a => el("li", {}, el("button", { type: "button", class: "nx-row", onclick: () => go("#area/" + a.id) },
            icon(AREA_LOOK[a.id][0], AREA_LOOK[a.id][1]), named("span", { class: "nx-row-t" }, a.title)))))),
          section("Walkthroughs", el("ul", { class: "nx-rows" }, data.tours.map(t => el("li", {}, el("button", { type: "button", class: "nx-row", onclick: () => go("#tour/" + t.id) },
            icon("flag", "#ff6d5a"), named("span", { class: "nx-row-t" }, t.title))))))) ];
    } else if (n.kind === "area") {
      const a = n.area, outs = new Set(a.groups.flatMap(g => g.pages));
      const tours = data.tours.filter(t => t.steps.some(s => outs.has(s.page)));
      parts = [head(n.icon, n.color, a.title, n.sub),
        el("div", { class: "nx-panel-body" },
          el("div", { class: "nx-actions" },
            view.kind === "map" ? el("a", { class: "nx-btn nx-primary", href: "#area/" + a.id }, "Open this area") : el("a", { class: "nx-btn", href: "#" }, "Back to the map"),
            a.page ? el("button", { type: "button", class: "nx-btn", onclick: () => goToPage(a.page) }, "Its main page") : null),
          named("p", { class: "nx-sum" }, a.blurb),
          section("Groups", el("ul", { class: "nx-rows" }, a.groups.map((g, gi) => el("li", {}, el("button", { type: "button", class: "nx-row",
            onclick: () => { const target = view.nodes.find(x => x.kind === "group" && x.group === g); if (target) select(target, { centre: true }); } },
            icon("layers", n.color), named("span", { class: "nx-row-t" }, g.title), el("span", { class: "nx-count" }, String(g.pages.length))))))),
          tours.length ? section("Walkthroughs through here", el("ul", { class: "nx-rows" }, tours.map(t => el("li", {}, el("button", { type: "button", class: "nx-row", onclick: () => go("#tour/" + t.id) },
            icon("flag", "#ff6d5a"), named("span", { class: "nx-row-t" }, t.title)))))) : null)];
    } else if (n.kind === "group") {
      const g = n.group;
      parts = [head("layers", n.color, g.title, n.area.title + " · " + n.sub),
        el("div", { class: "nx-panel-body" },
          view.kind === "map" ? el("div", { class: "nx-actions" }, el("a", { class: "nx-btn nx-primary", href: "#area/" + n.area.id }, "Open this area")) : null,
          g.blurb ? named("p", { class: "nx-sum" }, g.blurb) : null,
          section("Pages", el("ul", { class: "nx-rows" }, g.pages.map(out => row(out, "", () => {
            const target = view.nodes.find(x => x.out === out && x.group === g);
            if (target) select(target, { centre: true }); else location.hash = "#area/" + n.area.id + "/" + out;
          })))))];
    } else {
      const p = page(n.out);
      const stepBox = n.kind === "step" ? stepControls(n) : null;
      parts = [head(n.icon, n.color, p.t, p.s || "Encyclopedia", p.st),
        el("div", { class: "nx-panel-body" },
          stepBox,
          el("div", { class: "nx-actions" }, openButton(n.out, n.step && n.step.anchor, n.step && n.step.anchor ? "Open that part of the page" : null)),
          pageTabs(n.out))];
    }
    panel.append(...parts);
  }

  function stepControls(n) {
    const t = view.tour, s = n.step;
    const byStep = id => view.nodes.find(x => x.step.id === id);
    // By step order, not card order: on a phone the cards of a branching walkthrough are re-sorted.
    const stepAt = i => t.steps[i] ? byStep(t.steps[i].id) : null;
    const prevNode = view.branching ? (trail.length > 1 ? byStep(trail[trail.length - 2]) : null) : stepAt(n.index - 1);
    const nav = el("div", { class: "nx-step-nav" });
    if (prevNode) nav.append(el("button", { type: "button", class: "nx-btn", onclick: () => { if (view.branching) trail.pop(); select(prevNode, { centre: true, back: true }); } }, "Previous"));
    if (s.choices) {
      nav.append(el("p", { class: "nx-hint-inline" }, "What are you seeing?"));
      s.choices.forEach(c => { const target = byStep(c.go); if (target) nav.append(named("button", { type: "button", class: "nx-btn nx-choice", onclick: () => select(target, { centre: true }) }, c.label)); });
    } else {
      const next = s.end ? null : s.go ? byStep(s.go) : stepAt(n.index + 1);
      if (next) nav.append(el("button", { type: "button", class: "nx-btn nx-primary", onclick: () => select(next, { centre: true }) }, "Next"));
      else nav.append(el("p", { class: "nx-hint-inline" }, "End of the walkthrough."));
    }
    const count = view.branching ? "Step " + Math.max(trail.length, 1) : "Step " + (n.index + 1) + " of " + t.steps.length;
    return el("div", { class: "nx-step" }, el("p", { class: "nx-step-n" }, count, el("span", {}, " · "), named("span", {}, t.title)),
      s.note ? named("p", { class: "nx-note" }, s.note) : null, nav);
  }

  function openPanel() {
    const wasHidden = panel.hidden;
    panel.hidden = false;
    stage.classList.add("has-panel");
    if (wasHidden && selected && selected.el) ensureVisible(selected);
  }

  function closePanel(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    stage.classList.remove("has-panel");
    const was = selected;
    selected = null;
    highlight();
    if (returnFocus && was && was.el) was.el.focus({ preventScroll: true });
  }

  function select(n, opts) {
    opts = opts || {};
    if (view.kind === "tour" && view.branching && !opts.back && n.step) {
      const at = trail.indexOf(n.step.id);
      trail = at >= 0 ? trail.slice(0, at + 1) : trail.concat(n.step.id);
    }
    selected = n;
    highlight();
    fillPanel(n);
    openPanel();
    if (opts.centre) centreOn(n);
    // Remember the selection in the address, without a new history entry.
    if (view.kind === "area" && n.out) history.replaceState(null, "", "#area/" + view.area.id + "/" + n.out);
    if (view.kind === "tour" && n.step) history.replaceState(null, "", "#tour/" + view.tour.id + "/" + n.step.id);
    if (opts.from !== "canvas") { const h = panel.querySelector("h2"); if (h) h.focus({ preventScroll: true }); }
  }

  // Go to a view; the same address again (after a selection rewrote it) still redraws.
  function go(hash) {
    if (location.hash === hash || (hash === "#" && !location.hash)) route(); else location.hash = hash;
  }

  function goToPage(out) {
    if (view && view.nodes) {
      const here = view.nodes.find(n => n.out === out);
      if (here) return select(here, { centre: true });
    }
    location.hash = "#page/" + out;
  }

  // ---------- Every page (a list, with the same panel) ----------

  let filter = { text: "", status: "" };

  function showList() {
    list.textContent = "";
    const statuses = {};
    Object.values(data.pages).forEach(p => { if (p.st) statuses[p.st] = (statuses[p.st] || 0) + 1; });
    const input = el("input", { type: "search", class: "nx-filter", placeholder: "Filter by name", "aria-label": "Filter by name", value: filter.text });
    const chips = el("div", { class: "nx-chips", role: "group", "aria-label": "Status" });
    const body = el("div", { class: "nx-list-body" });
    function fill() {
      body.textContent = "";
      const words = filter.text.toLowerCase().split(/\s+/).filter(Boolean);
      let total = 0;
      for (const [folder, label, outs] of data.sections) {
        const hits = outs.filter(out => {
          const p = page(out);
          return (!filter.status || p.st === filter.status) && words.every(w => (p.t + " " + p.s).toLowerCase().includes(w));
        });
        if (!hits.length) continue;
        total += hits.length;
        body.append(el("section", { class: "nx-list-sec" }, named("h3", {}, folder ? label : "Encyclopedia"),
          el("ul", { class: "nx-rows nx-grid" }, hits.map(out => row(out, "", () => {
            selected = { id: "list:" + out, kind: "page", out, icon: pageIcon(out), color: pageColor(out) };
            fillPanel(selected);
            panel.querySelector(".nx-actions").append(el("button", { type: "button", class: "nx-btn", onclick: () => go("#page/" + out) }, "Show on the map"));
            openPanel();
            panel.querySelector("h2").focus({ preventScroll: true });
          })))));
      }
      if (!total) body.append(el("p", { class: "nx-empty" }, "No pages match."));
    }
    function chipButton(label, value, count) {
      const b = el("button", { type: "button", class: "nx-chip", "aria-pressed": String(filter.status === value) },
        el("span", {}, label), count != null ? el("span", { class: "nx-count" }, String(count)) : null);
      b.addEventListener("click", () => {
        filter.status = value;
        chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        fill();
      });
      return b;
    }
    chips.append(chipButton("All", "", null), ...Object.keys(statuses).sort().map(s => chipButton(s, s, statuses[s])));
    input.addEventListener("input", () => { filter.text = input.value; fill(); });
    fill();
    list.append(el("div", { class: "nx-list-tools" }, input, chips), body);
  }

  // ---------- Routing ----------

  function setMode(mode) {
    app.querySelectorAll(".nx-modes a").forEach(a => {
      if (a.dataset.mode === mode) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const isList = mode === "all";
    viewport.hidden = isList;
    $("nx-zoom").hidden = isList;
    $("nx-hint").hidden = isList;
    list.hidden = !isList;
    tourBar.hidden = mode !== "tours";
  }

  function setCrumbs(parts) {
    crumbs.textContent = "";
    parts.forEach((part, i) => {
      if (i) crumbs.append(el("span", { class: "nx-sep" }, " › "));
      crumbs.append(part[1] ? el("a", { href: part[1] }, part[0]) : el("span", { "aria-current": "page" }, part[0]));
    });
  }

  function homeArea(out) {
    const has = a => a.groups.some(g => g.pages.includes(out));
    return (lastArea && has(lastArea) && lastArea) || data.areas.find(has) || null;
  }

  function route() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    const [kind, ...rest] = hash.split("/");
    const narrow = stage.clientWidth < NARROW;
    panel.hidden = true;
    stage.classList.remove("has-panel");
    selected = null;
    let pick = null;

    if (kind === "all") {
      setMode("all");
      setCrumbs([["Overview", "#"], ["Every page"]]);
      view = { kind: "all" };
      showList();
      return;
    }
    if (kind === "tour" || kind === "tours") {
      const t = data.tours.find(x => x.id === rest[0]) || data.tours[0];
      setMode("tours");
      setCrumbs([["Overview", "#"], ["Walkthroughs"], [t.title]]);
      tourBar.textContent = "";
      data.tours.forEach(x => tourBar.append(named("a", { href: "#tour/" + x.id, class: "nx-tour", "aria-current": x === t ? "true" : null }, x.title)));
      view = Object.assign({ kind: "tour", tour: t }, tourView(t, narrow));
      const wanted = rest[1] || t.steps[0].id;
      pick = view.nodes.find(n => n.step.id === wanted) || view.nodes[0];
      trail = [];
      if (view.branching) trail = pathTo(pick.step.id);
    } else {
      let area = null, out = null;
      if (kind === "area") { area = data.areas.find(a => a.id === rest[0]); out = rest.slice(1).join("/") || null; }
      if (kind === "page") { out = rest.join("/"); area = page(out) ? homeArea(out) : null; }
      setMode("map");
      if (area) {
        lastArea = area;
        setCrumbs([["Overview", "#"], [area.title]]);
        view = Object.assign({ kind: "area", area }, layoutTree(areaTree(area), narrow));
        if (out) pick = view.nodes.find(n => n.out === out) || null;
      } else {
        setCrumbs([["Overview"]]);
        view = Object.assign({ kind: "map" }, layoutTree(overviewTree(), narrow));
        if (kind === "page" && out && page(out)) { // a page on no area: show it from the list
          location.replace("#all");
          return;
        }
      }
    }
    draw();
    fit();
    if (pick) select(pick, { centre: true, from: "canvas" });
  }

  function pathTo(id) {
    const t = view.tour, start = t.steps[0];
    const queue = [[start, [start.id]]], seen = new Set([start.id]);
    while (queue.length) {
      const [s, path] = queue.shift();
      if (s.id === id) return path;
      const nexts = s.choices ? s.choices.map(c => c.go) : s.end ? [] : [s.go || (t.steps[t.steps.indexOf(s) + 1] || {}).id];
      for (const n of nexts) {
        const step = t.steps.find(x => x.id === n);
        if (step && !seen.has(n)) { seen.add(n); queue.push([step, path.concat(n)]); }
      }
    }
    return [start.id];
  }

  let width = 0;
  window.addEventListener("resize", () => {
    if (!data || !view || view.kind === "all") return;
    const narrow = stage.clientWidth < NARROW;
    if ((width < NARROW) !== narrow) route(); else if (!selected) fit();
    width = stage.clientWidth;
  });

  fetch("explorer.json", { cache: "no-store" })
    .then(response => response.ok ? response.json() : Promise.reject(response.status))
    .then(json => {
      data = json;
      width = stage.clientWidth;
      window.addEventListener("hashchange", route);
      route();
    })
    .catch(() => {
      world.textContent = "";
      world.append(el("p", { class: "nx-loading" }, "The map's data didn't load. The pages themselves are on the Encyclopedia's front page."));
    });
})();
