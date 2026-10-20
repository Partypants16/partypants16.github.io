// Start Page: a new-tab page. A search box (press / to jump to it), then quick
// links to this site, the home server (with the same Online / Offline dots as
// the home page) and a few favourites. To use it as your browser's home page,
// set the home page to .../wallpaper.html?w=start-page
//
// To change the links, edit LINKS below. data-service ids are the ones in
// tools/service-status/check_services.py.

(function () {
  const ENGINES = {
    google: { name: "Google", url: "https://www.google.com/search", param: "q" },
    duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/", param: "q" },
    bing: { name: "Bing", url: "https://www.bing.com/search", param: "q" },
    youtube: { name: "YouTube", url: "https://www.youtube.com/results", param: "search_query" }
  };

  const LINKS = [
    { group: "This site", items: [
      { name: "Home", icon: "🏰", href: "index.html" },
      { name: "Games", icon: "🎮", href: "gaming.html" },
      { name: "Movies", icon: "🎬", href: "movies.html" },
      { name: "Profile", icon: "🙂", href: "profile.html" },
      { name: "Vibe Testing Zone", icon: "🧪", href: "vibe-testing-zone/home.html" }
    ] },
    { group: "Home server", hint: "Home Wi-Fi only", items: [
      { name: "Navidrome", icon: "🎵", href: "http://192.168.212.60:4533", service: "navidrome" },
      { name: "Immich", icon: "🖼️", href: "http://192.168.212.160:2283/", service: "immich" },
      { name: "Khane main Kya hai?", icon: "🍛", href: "http://192.168.212.60:8095", service: "khane" },
      { name: "SkyWardrobe", icon: "🧥", href: "http://192.168.212.60:3000", service: "skywardrobe" },
      { name: "StaySafe", icon: "🛡️", href: "http://192.168.212.60:8100", service: "staysafe" },
      { name: "CrossPaste", icon: "📋", href: "http://192.168.212.60", service: "crosspaste" },
      { name: "Code Server", icon: "💻", href: "http://192.168.212.60:8080", service: "codeserver" },
      { name: "Netdata", icon: "📈", href: "http://192.168.212.60:19999", service: "netdata" },
      { name: "Sonic", icon: "🦔", href: "http://192.168.212.60:8000" }
    ] },
    { group: "Elsewhere", items: [
      { name: "GitHub", icon: "🐙", href: "https://github.com/Partypants16" },
      { name: "YouTube", icon: "▶️", href: "https://www.youtube.com/" },
      { name: "PSNProfiles", icon: "🏆", href: "https://psnprofiles.com/Partypants16" },
      { name: "Steam", icon: "🕹️", href: "https://steamcommunity.com/profiles/76561198993129663/" }
    ] }
  ];

  // Soft colour blobs drifting behind frosted glass
  const BLOBS = [
    ["#6a5cff", 0.22, 0.3], ["#ff6ab0", 0.78, 0.25], ["#33d6b8", 0.7, 0.8], ["#ffb35c", 0.2, 0.78], ["#4aa3ff", 0.5, 0.5]
  ];

  const scene = {
    maxDpr: 1,
    scale: 0.6,
    stillTime: 30,
    setup(s) {
      s.blobs = BLOBS.map(([color, x, y], i) => ({ color: WP.hex(color), x, y, phase: i * 1.7 }));
    },
    draw(s, t) {
      const { g, w, h } = s;
      g.fillStyle = "#0b0d1a";
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      s.blobs.forEach((b, i) => {
        const x = (b.x + Math.sin(t * 0.05 + b.phase) * 0.12) * w - s.look.x * 30;
        const y = (b.y + Math.cos(t * 0.04 + b.phase * 1.3) * 0.1) * h - s.look.y * 20;
        const r = Math.max(w, h) * (0.36 + 0.05 * Math.sin(t * 0.07 + i));
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, WP.rgba(b.color, 0.42));
        grad.addColorStop(1, WP.rgba(b.color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      });
      g.globalCompositeOperation = "source-over";
    }
  };

  function searchBox() {
    const saved = WP.load("wp-search", "google");
    let engine = ENGINES[saved] ? saved : "google";
    const form = WP.el("form", "sp-search wp-glass");
    form.setAttribute("role", "search");
    form.method = "get";
    const select = WP.el("select", "sp-engine");
    select.setAttribute("aria-label", "Search with");
    Object.entries(ENGINES).forEach(([key, value]) => {
      const option = WP.el("option", null, value.name);
      option.value = key;
      option.selected = key === engine;
      select.appendChild(option);
    });
    const input = WP.el("input", "sp-input");
    input.type = "search";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Search");
    const button = WP.el("button", "sp-go", "→");
    button.type = "submit";
    button.setAttribute("aria-label", "Search");
    const apply = () => {
      const e = ENGINES[engine];
      form.action = e.url;
      input.name = e.param;
      // the "/" shortcut only means something with a keyboard
      const keyboard = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      input.placeholder = "Search " + e.name + (keyboard ? "   (press / )" : "");
    };
    select.addEventListener("change", () => {
      engine = select.value;
      WP.save("wp-search", engine);
      apply();
      input.focus();
    });
    apply();
    form.append(select, input, button);
    return { form, input };
  }

  function linkGrid() {
    const wrap = WP.el("div", "sp-groups");
    LINKS.forEach(section => {
      const group = WP.el("section", "sp-group");
      const title = WP.el("h2", "sp-group-title", section.group);
      if (section.hint) title.appendChild(WP.el("span", "sp-group-hint", section.hint));
      const grid = WP.el("div", "sp-grid");
      section.items.forEach(item => {
        const a = WP.el("a", "sp-link wp-glass");
        a.href = item.href;
        if (/^https?:/.test(item.href)) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        if (item.service) a.dataset.service = item.service;
        a.append(WP.el("span", "sp-icon", item.icon), WP.el("span", "sp-name", item.name));
        grid.appendChild(a);
      });
      group.append(title, grid);
      wrap.appendChild(group);
    });
    return wrap;
  }

  WP.register({
    id: "start-page",
    name: "Start Page",
    group: "tools",
    icon: "🔎",
    layout: "tool",
    blurb: "Search, plus quick links to the site and the home server, with live status.",
    quotes: "general",
    scene,
    mount(ctx) {
      ctx.canvas(scene);
      const search = searchBox();
      const grid = linkGrid();
      ctx.info(search.form, grid);
      ctx.on(window, "keydown", event => {
        const typing = event.target.closest && event.target.closest("input, textarea, select");
        if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          search.input.focus();
        }
      });
      if (window.ServiceStatus) {
        ctx.every(5 * 60000, () => window.ServiceStatus.apply(grid, { fresh: true }));
      }
    }
  });
})();
