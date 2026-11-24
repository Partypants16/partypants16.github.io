// Top bar extras, on every page (loaded with defer after settings.js):
//
// 1. A status dot on the "Home Lab" link: green when every home-server service is up,
//    amber when some are down, grey when the box hasn't reported. Same data as the Home Lab
//    cards (the gist the box updates every 5 minutes; see service-status.js), cached for a
//    few minutes per tab so moving between pages doesn't fetch it again.
// 2. A quick launcher: the search button next to the language button, or "/" (also Ctrl+K),
//    opens a box to type part of a page, game or home service and jump to it.
//
// Also used by the box's pages (:8120, copied there by tools/claude-timeline/build.py), where
// links have to point back at the website, so they get SITE in front.
(function () {
  const STATUS_URL = "https://gist.githubusercontent.com/Partypants16/bed5059789305f00ccb304cca1d13034/raw/status.json";
  const CACHE_KEY = "topbar-status";
  const CACHE_MS = 3 * 60 * 1000;
  const host = location.hostname;
  const onSite = location.protocol === "file:" || host.endsWith("github.io") || host === "localhost" || host === "127.0.0.1";
  const SITE = onSite ? "" : "https://partypants16.github.io/";
  const BOX = "http://192.168.212.60";
  const t = text => (window.SiteI18n ? window.SiteI18n.translate(text) : text);

  // ---------- What the launcher can open ----------
  // [name, link, group, extra words to match, lan?]
  const ENTRIES = [
    ["Home", SITE + "index.html", "Pages", "start welcome"],
    ["Games", SITE + "gaming.html", "Pages", "platforms playstation xbox steam epic itch"],
    ["Media", SITE + "media.html", "Pages", "watch listen"],
    ["Movies", SITE + "movies.html", "Pages", "films lists franchises"],
    ["Movie Tracker", SITE + "movie-tracker.html", "Pages", "films ticks watched"],
    ["Music", SITE + "music-people.html", "Pages", "spotify listening charts people aaron henry"],
    ["My Music", SITE + "music.html", "Pages", "spotify listening charts parth"],
    ["Music Explorer", SITE + "music-explorer.html", "Pages", "spotify artists songs years"],
    ["Wallpaper", SITE + "wallpaper.html", "Pages", "start page backgrounds"],
    ["Projects", SITE + "projects.html", "Pages", "showcase stories work"],
    ["Home Lab", SITE + "homelab.html", "Pages", "lan services home server"],
    ["Profile", SITE + "profile.html", "Pages", "about me psn"],
    ["Car Shows", SITE + "car-events.html", "Pages", "cars meets track days events"],
    ["3D Scan Viewer", SITE + "stl-viewer.html", "Pages", "stl usdz glb ply model"],
    ["Vibe Testing Zone", SITE + "vibe-testing-zone/home.html", "Pages", "experiments"],
    ["Claude page", SITE + "claude.html", "Pages", "memory sessions timeline log", true],
    ["ChatGPT page", SITE + "chatgpt.html", "Pages", "codex memory sessions", true],
    ["To do", SITE + "todo.html", "Pages", "tasks waiting", true],
    ["Encyclopedia", SITE + "encyclopedia.html", "Pages", "docs reference", true],
    ["Usage", SITE + "usage.html", "Pages", "claude tokens", true],
    ["Eunomia", SITE + "eunomia.html", "Pages", "memory facts", true],
    ["Apex Dash", SITE + "play/apex-dash/", "Games", "racer racing cars play"],
    ["Apex Dash 3D Masters", SITE + "play/apex-dash-3d-masters/", "Games", "racer racing sequel play"],
    ["Sonic Apex Dash", BOX + ":8110", "Games", "racer ring racers", true],
    ["Scan Runner", BOX + ":8113", "Games", "unity runner scan", true],
    ["itch.io", "https://partypants16.itch.io/", "Games", "itch profile"],
    ["Immich", "http://192.168.212.160:2283/", "Home Lab", "photos pictures family library", true],
    ["Khane main Kya hai?", BOX + ":8095", "Home Lab", "food meals menu khana", true],
    ["Vikunja", BOX + ":3456", "Home Lab", "tasks todo kanban lists", true],
    ["Katha Sankalp", BOX + ":8090", "Home Lab", "katha planning guests", true],
    ["SkyWardrobe", BOX + ":3000", "Home Lab", "weather clothes wear", true],
    ["StaySafe", BOX + ":8100", "Home Lab", "crime safety map victoria", true],
    ["Navidrome", BOX + ":4533", "Home Lab", "music car songs", true],
    ["CrossPaste", BOX, "Home Lab", "clipboard copy paste files", true],
    ["SearXNG", BOX + ":8081", "Home Lab", "search engine", true],
    ["Sonic", BOX + ":8000", "Home Lab", "assistant ai", true],
    ["Portfolio", BOX + ":8112", "Home Lab", "shares stocks etf stake money", true],
    ["n8n", BOX + ":5678", "Home Lab", "automation workflows", true],
    ["Netdata", BOX + ":19999", "Home Lab", "server health cpu memory", true],
    ["Code Server", BOX + ":8080", "Home Lab", "vs code editor", true]
  ].map(([name, url, group, words, lan]) => ({ name, url, group, words: words || "", lan: !!lan }));

  // ---------- 1. Status dot on Home Lab ----------
  function cachedStatus() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (saved && Date.now() - saved.at < CACHE_MS) return Promise.resolve(saved.status);
    } catch (e) { /* storage blocked: just fetch */ }
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    return fetch(STATUS_URL + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store", signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(status => {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), status })); } catch (e) { /* fine */ }
        return status;
      });
  }

  function addStatusDot() {
    const link = document.querySelector('header nav ul a[href$="homelab.html"]');
    if (!link) return;
    cachedStatus().then(status => {
      const services = Object.values(status.services || {});
      if (!services.length) return;
      const staleAfter = ((status.heartbeat_minutes || 15) * 2 + 10) * 60000;
      const stale = Date.now() - new Date(status.checked_at) > staleAfter;
      const down = services.filter(s => !s.up).length;
      const state = stale ? "unknown" : down ? "some-down" : "up";
      const text = stale ? "The home server isn't reporting"
        : down ? down + " of " + services.length + " home services are offline"
        : "All home services are online";
      const dot = document.createElement("span");
      dot.className = "topbar-status-dot";
      dot.dataset.state = state;
      dot.setAttribute("aria-hidden", "true");
      link.appendChild(dot);
      link.title = t(text);
      const hidden = document.createElement("span");
      hidden.className = "topbar-sr-only";
      hidden.textContent = " (" + t(text) + ")";
      link.appendChild(hidden);
    }).catch(() => { /* no dot is better than a wrong one */ });
  }

  // ---------- 2. Quick launcher ----------
  let dialog, input, list, results = [], active = 0;

  function score(entry, q) {
    const name = entry.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/[\s.?]+/).some(w => w.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (entry.words.split(" ").some(w => w.startsWith(q))) return 3;
    if ((entry.group + " " + entry.words).toLowerCase().includes(q)) return 4;
    return -1;
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    results = q
      ? ENTRIES.map(e => [e, score(e, q)]).filter(([, s]) => s >= 0).sort((a, b) => a[1] - b[1]).map(([e]) => e)
      : ENTRIES.slice();
    active = Math.min(active, Math.max(results.length - 1, 0));
    list.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("li");
      empty.className = "launcher-empty";
      empty.textContent = t("No matches");
      list.appendChild(empty);
      input.removeAttribute("aria-activedescendant");
      return;
    }
    let lastGroup = "";
    results.forEach((entry, i) => {
      if (!q && entry.group !== lastGroup) {
        const head = document.createElement("li");
        head.className = "launcher-group";
        head.setAttribute("role", "presentation");
        head.textContent = t(entry.group);
        list.appendChild(head);
        lastGroup = entry.group;
      }
      const li = document.createElement("li");
      li.id = "launcher-item-" + i;
      li.className = "launcher-item";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      const name = document.createElement("span");
      name.className = "launcher-name";
      name.setAttribute("translate", "no");
      name.textContent = entry.name;
      li.appendChild(name);
      if (q) {
        const group = document.createElement("span");
        group.className = "launcher-tag";
        group.textContent = t(entry.group);
        li.appendChild(group);
      }
      if (entry.lan) {
        const lan = document.createElement("span");
        lan.className = "launcher-tag launcher-tag--lan";
        lan.textContent = "LAN";
        lan.title = t("Only opens on the home Wi-Fi");
        li.appendChild(lan);
      }
      li.addEventListener("mousemove", () => { if (active !== i) { active = i; mark(); } });
      li.addEventListener("click", () => open(entry));
      list.appendChild(li);
    });
    mark();
  }

  function mark() {
    list.querySelectorAll(".launcher-item").forEach(li => {
      const on = li.id === "launcher-item-" + active;
      li.setAttribute("aria-selected", String(on));
      if (on) li.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", "launcher-item-" + active);
  }

  function open(entry) {
    close();
    const external = /^https?:/.test(entry.url) && !entry.url.startsWith(SITE || location.origin);
    if (external) window.open(entry.url, "_blank", "noopener");
    else location.href = entry.url;
  }

  function build() {
    dialog = document.createElement("dialog");
    dialog.className = "launcher";
    dialog.setAttribute("aria-label", t("Quick launcher"));
    dialog.innerHTML =
      '<div class="launcher-box">' +
      '<input class="launcher-input" type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="launcher-list" aria-autocomplete="list">' +
      '<ul class="launcher-list" id="launcher-list" role="listbox"></ul>' +
      '<p class="launcher-hint"></p>' +
      "</div>";
    document.body.appendChild(dialog);
    input = dialog.querySelector(".launcher-input");
    list = dialog.querySelector(".launcher-list");
    input.placeholder = t("Search pages, games and home services");
    input.setAttribute("aria-label", input.placeholder);
    dialog.querySelector(".launcher-hint").textContent = t("↑ ↓ to choose, Enter to open, Esc to close. LAN ones only open on the home Wi-Fi.");
    input.addEventListener("input", () => { active = 0; render(); });
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); active = Math.min(active + 1, results.length - 1); mark(); }
      else if (event.key === "ArrowUp") { event.preventDefault(); active = Math.max(active - 1, 0); mark(); }
      else if (event.key === "Enter" && results[active]) { event.preventDefault(); open(results[active]); }
    });
    // A click on the dimmed area outside the box closes it.
    dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
    dialog.addEventListener("close", () => document.documentElement.classList.remove("launcher-open"));
  }

  function show() {
    if (!dialog) build();
    if (dialog.open) return;
    input.value = "";
    active = 0;
    render();
    dialog.showModal();
    document.documentElement.classList.add("launcher-open");
    input.focus();
  }

  function close() {
    if (dialog && dialog.open) dialog.close();
  }

  function addButton() {
    const tools = document.querySelector("header .nav-tools") || document.getElementById("settingsToggle");
    if (!tools || document.querySelector(".launcher-toggle")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "launcher-toggle";
    const label = t("Search") + " (/)";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
    button.addEventListener("click", show);
    if (tools.classList.contains("nav-tools")) tools.prepend(button);
    else tools.parentNode.insertBefore(button, tools);
  }

  document.addEventListener("keydown", event => {
    const typing = event.target.closest && event.target.closest("input, textarea, select, [contenteditable='true']");
    const settingsOpen = document.documentElement.classList.contains("settings-open");
    if (((event.key === "/" && !typing) || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) && !settingsOpen) {
      event.preventDefault();
      show();
    }
  });

  function start() {
    addButton();
    addStatusDot();
  }
  // i18n.js adds the language button (and its .nav-tools wrapper) on DOMContentLoaded, so wait for it.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
