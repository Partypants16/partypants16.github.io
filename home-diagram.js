// The home page (index.html) as an interactive diagram, since 2026-11-21.
//
// A centre node (the Palace, with Melbourne's live clock and weather) wired to nodes for the rest of
// the site. Click a node for a detail panel; on a computer, drag nodes around and the wires follow.
// Data: Melbourne weather from OpenWeatherMap, fetched by the home server and published to the
// service-status gist as weather.json (the website can't hold an API key); home-service status from
// the same gist; the next car shows from data/car-events.json. No LAN addresses on this page.
(function () {
  const GIST = "https://gist.githubusercontent.com/Partypants16/bed5059789305f00ccb304cca1d13034/raw/";
  const TZ = "Australia/Melbourne";
  const t = text => (window.SiteI18n ? window.SiteI18n.translate(text) : text);
  const root = document.querySelector(".hd");
  const stage = root.querySelector(".hd-stage");
  const svg = root.querySelector(".hd-wires");
  const panel = root.querySelector(".hd-panel");
  const panelTitle = panel.querySelector("h2");
  const panelIcon = panel.querySelector(".hd-panel-icon");
  const panelBody = panel.querySelector(".hd-panel-body");
  const hub = root.querySelector(".hd-node--hub");
  const nodes = [...root.querySelectorAll(".hd-node:not(.hd-node--hub)")];
  const motionOff = () => document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isPhone = () => matchMedia("(max-width: 760px)").matches;

  const state = { weather: null, status: null, events: null };

  // ---------- Live clock ----------
  function hour12() { return window.SiteClock ? window.SiteClock.hour12() : true; }
  function clockText(withSeconds) {
    return new Date().toLocaleTimeString("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: withSeconds ? "2-digit" : undefined, hour12: hour12() });
  }
  function dateText() {
    return new Date().toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  }
  function tick() {
    root.querySelectorAll("[data-clock]").forEach(el => { el.textContent = clockText(el.dataset.clock === "seconds"); });
    root.querySelectorAll("[data-date]").forEach(el => { el.textContent = dateText(); });
  }

  // ---------- Weather ----------
  const SKY = { Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Drizzle: "🌦️", Thunderstorm: "⛈️", Snow: "❄️", Mist: "🌫️", Fog: "🌫️", Haze: "🌫️", Smoke: "🌫️", Dust: "🌫️" };
  function skyIcon(w) {
    if (!w) return "🌡️";
    if (w.main === "Clear" && !w.is_day) return "🌙";
    if (w.main === "Clouds" && /few|scattered/.test(w.description || "")) return w.is_day ? "⛅" : "☁️";
    return SKY[w.main] || "🌡️";
  }
  function sentence(text) { return text ? text.charAt(0).toUpperCase() + text.slice(1) : ""; }
  function timeOf(iso) {
    return new Date(iso).toLocaleTimeString("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: hour12() });
  }
  function showWeather() {
    const w = state.weather;
    root.querySelectorAll("[data-weather]").forEach(el => {
      el.textContent = w ? skyIcon(w) + " " + Math.round(w.temp) + "°C · " + t(sentence(w.description)) : t("Weather unavailable");
    });
  }

  // ---------- Node subtitles from live data ----------
  function nextEvents(n) {
    if (!state.events) return [];
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    return state.events.filter(e => (e.end || e.start) >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, n);
  }
  function eventDate(e) {
    const d = new Date(e.start + "T12:00:00");
    return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
  }
  function statusSummary() {
    const s = state.status;
    if (!s) return null;
    const list = Object.entries(s.services || {});
    const stale = Date.now() - new Date(s.checked_at) > ((s.heartbeat_minutes || 15) * 2 + 10) * 60000;
    const up = list.filter(([, v]) => v.up).length;
    return { list, up, total: list.length, stale, state: stale ? "unknown" : up === list.length ? "up" : "some-down" };
  }
  function showSubtitles() {
    const ev = nextEvents(1)[0];
    const carSub = root.querySelector('[data-node="cars"] .hd-sub');
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const onNow = ev && ev.start <= today;
    if (carSub) carSub.textContent = ev ? (onNow ? t("On now:") : t("Next:")) + " " + ev.name + (onNow ? "" : " · " + eventDate(ev)) : t("See what's coming up");
    const lab = statusSummary();
    const labSub = root.querySelector('[data-node="homelab"] .hd-sub');
    if (labSub && lab) {
      labSub.innerHTML = "";
      const dot = document.createElement("span");
      dot.className = "hd-dot";
      dot.dataset.state = lab.state;
      labSub.append(dot, " " + (lab.stale ? t("Home server not reporting") : lab.up + " / " + lab.total + " " + t("online")));
    }
  }

  // ---------- Detail panels ----------
  function links(items) {
    const ul = document.createElement("ul");
    ul.className = "hd-links";
    items.forEach(([label, href, note]) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      const name = document.createElement("span");
      name.textContent = label;
      a.appendChild(name);
      if (note) { const small = document.createElement("small"); small.textContent = note; a.appendChild(small); }
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }
  function para(text) { const p = document.createElement("p"); p.textContent = text; return p; }
  function fact(value, label) {
    const d = document.createElement("div");
    d.className = "hd-fact";
    const b = document.createElement("b"); b.textContent = value;
    const s = document.createElement("span"); s.textContent = label;
    d.append(b, s);
    return d;
  }

  const PANELS = {
    melbourne() {
      const out = [];
      const big = document.createElement("div"); big.className = "hd-big-clock"; big.dataset.clock = "seconds"; big.textContent = clockText(true);
      const date = para(dateText()); date.dataset.date = "";
      out.push(big, date);
      const w = state.weather;
      if (w) {
        const line = para(skyIcon(w) + " " + t(sentence(w.description)));
        const facts = document.createElement("div"); facts.className = "hd-facts";
        facts.append(fact(Math.round(w.temp) + "°C", t("Now")), fact(Math.round(w.feels_like) + "°C", t("Feels like")),
          fact(Math.round(w.temp_min) + "° / " + Math.round(w.temp_max) + "°", t("Low / high")), fact(w.wind_kmh + " km/h", t("Wind")),
          fact(timeOf(w.sunrise), t("Sunrise")), fact(timeOf(w.sunset), t("Sunset")));
        const src = para(t("Weather from OpenWeatherMap, updated every 15 minutes by the home server."));
        src.style.fontSize = ".8rem";
        out.push(line, facts, src);
      } else {
        out.push(para(t("The weather isn't available right now.")));
      }
      return out;
    },
    play() {
      return [para(t("My games, playable in the browser.")), links([
        ["Apex Dash", "play/apex-dash/", t("Arcade racer")],
        ["Apex Dash 3D Masters", "play/apex-dash-3d-masters/", t("The 3D sequel")],
        [t("All games and platforms"), "gaming.html"],
        ["itch.io", "https://partypants16.itch.io/"]
      ])];
    },
    media() {
      return [para(t("What I watch, what I listen to, and the wallpapers I made.")), links([
        [t("Movies"), "movies.html", t("Lists and franchise trackers")],
        [t("Music"), "music.html", t("Years of listening, in charts")],
        ["Wallpaper", "wallpaper.html", t("Fifteen live wallpapers")]
      ])];
    },
    cars() {
      const out = [para(t("Car shows, meets and track days around Melbourne and Victoria."))];
      const list = nextEvents(3);
      list.forEach(e => {
        const d = document.createElement("div"); d.className = "hd-event";
        const b = document.createElement("b"); b.textContent = e.name; b.setAttribute("translate", "no");
        const s = document.createElement("span"); s.textContent = eventDate(e) + (e.venue ? " · " + e.venue : "");
        d.append(b, s); out.push(d);
      });
      if (!list.length) out.push(para(t("Nothing coming up right now.")));
      out.push(links([[t("All car shows"), "car-events.html"]]));
      return out;
    },
    homelab() {
      const lab = statusSummary();
      const out = [para(t("Everything running on the home server. It only opens on the home Wi-Fi."))];
      if (lab) {
        const ul = document.createElement("ul"); ul.className = "hd-services";
        lab.list.forEach(([id, v]) => {
          const li = document.createElement("li");
          const dot = document.createElement("span"); dot.className = "hd-dot"; dot.dataset.state = lab.stale ? "unknown" : v.up ? "up" : "some-down";
          const name = document.createElement("span"); name.textContent = SERVICE_NAMES[id] || id; name.setAttribute("translate", "no");
          li.append(dot, name); ul.appendChild(li);
        });
        out.push(ul);
      }
      out.push(links([[t("Open Home Lab"), "homelab.html"]]));
      return out;
    },
    projects() {
      return [para(t("The stories behind what I've built: the journey, the big calls and what I learned.")), links([[t("See my projects"), "projects.html"]])];
    },
    scanviewer() {
      return [para(t("Open an STL file or a 3D scan and see it in full colour and light. Your file never leaves your device.")),
        para(t("Works with STL, GLB, PLY and USDZ files.")),
        links([[t("Open the viewer"), "stl-viewer.html"]])];
    },
    vibe() {
      return [para(t("Pure vibe coding to test the capabilities and experiment with new technologies. No fleshed out products.")),
        links([[t("Step inside"), "vibe-testing-zone/home.html"]])];
    },
    about() {
      return [para(t("Who I am, what I use and how to reach me.")), links([[t("Profile"), "profile.html"], ["GitHub", "https://github.com/Partypants16"]])];
    }
  };
  const SERVICE_NAMES = { immich: "Immich", khane: "Khane", vikunja: "Vikunja", katha: "Katha Sankalp", skywardrobe: "SkyWardrobe",
    staysafe: "StaySafe", navidrome: "Navidrome", crosspaste: "CrossPaste", searxng: "SearXNG", n8n: "n8n", netdata: "Netdata",
    codeserver: "Code Server", apexdash: "Sonic Apex Dash", scanrunner: "Scan Runner", portfolio: "Portfolio", discordbot: "Discord bot" };

  let openNode = null;
  function openPanel(node) {
    const key = node.dataset.node;
    if (!PANELS[key]) return;
    if (openNode) openNode.setAttribute("aria-expanded", "false");
    openNode = node;
    node.setAttribute("aria-expanded", "true");
    panelTitle.textContent = node.querySelector(".hd-title").textContent;
    panelIcon.textContent = node.querySelector(".hd-icon").textContent;
    panelBody.replaceChildren(...PANELS[key]());
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    relayout();
    highlight(node, true);
    panel.querySelector(".hd-close").focus({ preventScroll: true });
  }
  function closePanel() {
    if (!panel.classList.contains("is-open")) return;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    relayout();
    if (openNode) {
      openNode.setAttribute("aria-expanded", "false");
      highlight(openNode, false);
      openNode.focus({ preventScroll: true });
      openNode = null;
    }
  }
  panel.querySelector(".hd-close").addEventListener("click", closePanel);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
  stage.addEventListener("click", e => { if (e.target === stage || e.target === svg) closePanel(); });

  // ---------- Layout and wires ----------
  // Where each node sits, as a fraction of the stage (centre = hub). Dragging changes these.
  const SPOTS = {
    play: [0.2, 0.15], media: [0.2, 0.38], cars: [0.2, 0.62], scanviewer: [0.2, 0.85],
    homelab: [0.8, 0.15], projects: [0.8, 0.38], vibe: [0.8, 0.62], about: [0.8, 0.85]
  };
  const pos = {};
  function place() {
    if (isPhone()) { nodes.forEach(n => { n.style.left = n.style.top = ""; }); hub.style.left = hub.style.top = ""; return; }
    // With a panel open, squeeze the diagram into the space to its left (like n8n's side panel).
    const width = stage.clientWidth;
    const room = panel.classList.contains("is-open") ? Math.max(0.45, (width - panel.offsetWidth - 40) / width) : 1;
    hub.style.left = (50 * room) + "%"; hub.style.top = "50%";
    nodes.forEach(n => {
      const [x, y] = pos[n.dataset.node] || SPOTS[n.dataset.node];
      n.style.left = (x * room * 100) + "%";
      n.style.top = (y * 100) + "%";
      n.dataset.side = x < 0.5 ? "left" : "right";
    });
    drawWires();
  }
  // Move the nodes, then keep redrawing the wires while they glide (about 0.3 s).
  function relayout() {
    place();
    const until = performance.now() + 380;
    (function follow() { drawWires(); if (performance.now() < until) requestAnimationFrame(follow); })();
  }
  const wires = {};
  function drawWires() {
    if (isPhone()) return;
    const box = stage.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
    const h = hub.getBoundingClientRect();
    nodes.forEach(n => {
      const r = n.getBoundingClientRect();
      const left = r.left + r.width / 2 < h.left + h.width / 2;
      // From the hub's side to the node's port (its inner edge), as a smooth n8n-style curve.
      const x1 = (left ? h.left : h.right) - box.left, y1 = h.top + h.height / 2 - box.top;
      const x2 = (left ? r.right : r.left) - box.left, y2 = r.top + r.height / 2 - box.top;
      const bend = Math.max(40, Math.abs(x2 - x1) * 0.5) * (left ? -1 : 1);
      const d = "M" + x1 + "," + y1 + " C" + (x1 + bend) + "," + y1 + " " + (x2 - bend) + "," + y2 + " " + x2 + "," + y2;
      let w = wires[n.dataset.node];
      if (!w) {
        w = { base: make("hd-wire"), flow: make("hd-wire hd-wire--flow") };
        wires[n.dataset.node] = w;
      }
      w.base.setAttribute("d", d);
      w.flow.setAttribute("d", d);
      w.base.style.setProperty("--len", Math.ceil(w.base.getTotalLength()));
    });
  }
  function make(cls) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("class", cls);
    svg.appendChild(p);
    return p;
  }
  function highlight(node, on) {
    node.classList.toggle("is-hot", on || node.getAttribute("aria-expanded") === "true");
    const w = wires[node.dataset.node];
    if (w) {
      const hot = on || node.getAttribute("aria-expanded") === "true";
      w.base.classList.toggle("is-hot", hot);
      w.flow.classList.toggle("is-hot", hot);
    }
  }

  // ---------- Click, hover, drag ----------
  nodes.forEach(node => {
    node.setAttribute("aria-expanded", "false");
    node.addEventListener("mouseenter", () => highlight(node, true));
    node.addEventListener("mouseleave", () => highlight(node, false));
    node.addEventListener("focus", () => highlight(node, true));
    node.addEventListener("blur", () => highlight(node, false));

    let start = null, moved = false;
    node.addEventListener("pointerdown", e => {
      if (isPhone() || e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
      moved = false;
      node.setPointerCapture(e.pointerId);
    });
    node.addEventListener("pointermove", e => {
      if (!start) return;
      if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
      moved = true;
      node.classList.add("is-dragging");
      const box = stage.getBoundingClientRect();
      const room = panel.classList.contains("is-open") ? Math.max(0.45, (box.width - panel.offsetWidth - 40) / box.width) : 1;
      const x = Math.min(0.92, Math.max(0.08, (e.clientX - box.left) / box.width / room));
      const y = Math.min(0.92, Math.max(0.08, (e.clientY - box.top) / box.height));
      pos[node.dataset.node] = [x, y];
      place();
    });
    node.addEventListener("pointerup", () => {
      node.classList.remove("is-dragging");
      start = null;
    });
    node.addEventListener("click", e => {
      if (moved) { e.preventDefault(); moved = false; return; }
      if (openNode === node) closePanel(); else openPanel(node);
    });
  });

  // ---------- Opening: hub first, then each wire draws out and its node appears ----------
  function intro() {
    if (motionOff() || isPhone()) { root.classList.remove("is-intro"); return; }
    root.classList.add("is-intro");
    hub.style.opacity = "0";
    requestAnimationFrame(() => {
      hub.style.transition = "opacity .5s ease";
      hub.style.opacity = "1";
      setTimeout(() => {
        root.classList.remove("is-intro");
        nodes.forEach((n, i) => { n.style.transitionDelay = (i * 90) + "ms"; });
        setTimeout(() => nodes.forEach(n => { n.style.transitionDelay = ""; }), 1400);
      }, 450);
    });
  }

  // ---------- Data ----------
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  const minute = Math.floor(Date.now() / 60000);
  getJSON(GIST + "weather.json?t=" + minute).then(w => { state.weather = w; }).catch(() => {}).finally(() => { showWeather(); refreshPanel(); });
  getJSON(GIST + "status.json?t=" + minute).then(s => { state.status = s; showSubtitles(); refreshPanel(); }).catch(() => {});
  getJSON("data/car-events.json").then(d => { state.events = d.events || []; showSubtitles(); refreshPanel(); }).catch(() => {});
  function refreshPanel() { if (openNode && panel.classList.contains("is-open")) panelBody.replaceChildren(...PANELS[openNode.dataset.node]()); }

  // Text this script writes (weather line, node subtitles, an open panel) is redrawn in the new language.
  document.addEventListener("languagechange", () => { showWeather(); showSubtitles(); refreshPanel(); });

  tick();
  setInterval(tick, 1000);
  place();
  intro();
  window.addEventListener("resize", place);
  hub.addEventListener("click", () => openPanel(hub));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWires);
})();
