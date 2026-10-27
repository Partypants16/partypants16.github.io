// The Encyclopedia tab's page script: search across every page, the sidebar
// on a phone, copy buttons on code, and Mermaid diagrams drawn from the local
// copy of mermaid.min.js (no CDN, so it works with the internet off).
//
// Only on the remote box (http://192.168.212.60:8120/encyclopedia/, LAN only):
// the pages describe the whole home setup. The website's encyclopedia.html
// sends visitors here when they're on home Wi-Fi.

(function () {
  const SITE_URL = "https://partypants16.github.io/";
  // The page's files are also in the public repo, without content. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace(SITE_URL + "encyclopedia.html");
    return;
  }

  const $ = id => document.getElementById(id);
  const root = (document.querySelector('link[href$="encyclopedia.css"]') || {}).getAttribute
    ? document.querySelector('link[href$="encyclopedia.css"]').getAttribute("href").replace(/encyclopedia\.css$/, "")
    : "";

  // ---------- Sidebar on a phone ----------

  const toggle = $("enc-nav-toggle");
  const side = toggle && toggle.closest(".enc-side");
  if (toggle && side) {
    toggle.addEventListener("click", () => {
      const open = side.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---------- Search ----------

  const input = $("enc-search");
  const results = $("enc-results");
  let index = null;
  let loading = null;

  const getJSON = (url, fallback) => fetch(url, { cache: "no-store" })
    .then(response => response.ok ? response.json() : fallback)
    .catch(() => fallback);

  // The Encyclopedia's pages, then the Confluence copy: every page's title and headings
  // (titles.json), plus page text from the per-space shards: all of them while they're
  // small, otherwise only the space you're reading.
  function load() {
    if (index) return Promise.resolve(index);
    if (!loading) {
      const tree = $("cf-tree");
      const here = tree ? tree.dataset.space : "";
      loading = Promise.all([
        getJSON(root + "search.json", []),
        getJSON(root + "confluence/titles.json", []),
        getJSON(root + "confluence/search/shards.json", null)
      ]).then(([own, titles, shards]) => {
        const keys = !shards ? [] : Object.keys(shards.spaces).filter(key => shards.all || key === here);
        return Promise.all(keys.map(key => getJSON(root + "confluence/search/" + key + ".json", [])))
          .then(parts => {
            const full = new Map();
            parts.flat().forEach(page => full.set(page.u, page));
            index = own.concat(titles.map(page => full.get(page.u) || page));
            return index;
          });
      });
    }
    return loading;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function score(page, terms) {
    let total = 0;
    const title = page.t.toLowerCase();
    const headings = (page.h || []).join(" ").toLowerCase();
    const body = (page.b || "").toLowerCase();
    for (const term of terms) {
      let found = 0;
      if (title.includes(term)) found += 12;
      if (headings.includes(term)) found += 5;
      const count = body.split(term).length - 1;
      if (count) found += Math.min(count, 6);
      if (!found) return 0; // every word has to match somewhere
      total += found;
    }
    return total;
  }

  function snippet(page, terms) {
    const body = page.b || (page.h || []).join(" · ");
    const lower = body.toLowerCase();
    let at = -1;
    for (const term of terms) {
      at = lower.indexOf(term);
      if (at !== -1) break;
    }
    if (at === -1) return body.slice(0, 140);
    const start = Math.max(0, at - 60);
    const end = Math.min(body.length, at + 100);
    return (start ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
  }

  function mark(text, terms) {
    const pattern = new RegExp("(" + terms.map(escapeRegExp).join("|") + ")", "ig");
    const parts = text.split(pattern);
    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2) {
        const m = document.createElement("mark");
        m.textContent = part;
        fragment.append(m);
      } else if (part) {
        fragment.append(part);
      }
    });
    return fragment;
  }

  function show(list, terms) {
    results.textContent = "";
    if (!list.length) {
      const li = document.createElement("li");
      li.className = "enc-none";
      li.textContent = "Nothing found for " + terms.join(" ");
      results.append(li);
    }
    list.slice(0, 25).forEach(page => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = root + page.u;
      const section = document.createElement("span");
      section.className = "r-section";
      section.textContent = page.s || "Encyclopedia";
      const title = document.createElement("span");
      title.className = "r-title";
      title.setAttribute("translate", "no");
      title.append(mark(page.t, terms));
      const text = document.createElement("span");
      text.className = "r-snippet";
      text.setAttribute("translate", "no");
      text.append(mark(snippet(page, terms), terms));
      a.append(section, title, text);
      li.append(a);
      results.append(li);
    });
    results.hidden = false;
  }

  function search() {
    const terms = input.value.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
    if (!terms.length) {
      results.hidden = true;
      results.textContent = "";
      return;
    }
    load().then(pages => {
      const scored = pages.map(page => ({ page, n: score(page, terms) })).filter(x => x.n > 0);
      scored.sort((a, b) => b.n - a.n || a.page.t.localeCompare(b.page.t));
      show(scored.map(x => x.page), terms);
    });
  }

  if (input && results) {
    let timer = null;
    input.addEventListener("focus", load);
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(search, 120);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        input.value = "";
        results.hidden = true;
      } else if (event.key === "ArrowDown") {
        const first = results.querySelector("a");
        if (first) { first.focus(); event.preventDefault(); }
      }
    });
    results.addEventListener("keydown", event => {
      const links = [...results.querySelectorAll("a")];
      const at = links.indexOf(document.activeElement);
      if (event.key === "ArrowDown" && at < links.length - 1) { links[at + 1].focus(); event.preventDefault(); }
      if (event.key === "ArrowUp") { (at > 0 ? links[at - 1] : input).focus(); event.preventDefault(); }
      if (event.key === "Escape") { input.focus(); results.hidden = true; }
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".enc-search")) results.hidden = true;
    });
    // Press / to search, like GitHub.
    document.addEventListener("keydown", event => {
      if (event.key === "/" && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        input.focus();
        event.preventDefault();
      }
    });
  }

  // ---------- Copy buttons on code ----------

  document.querySelectorAll(".hl-wrap").forEach(wrap => {
    const code = wrap.querySelector("code");
    if (!code || !navigator.clipboard) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hl-copy";
    button.textContent = "Copy";
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(code.textContent).then(() => {
        button.textContent = "Copied";
        button.classList.add("is-done");
        setTimeout(() => { button.textContent = "Copy"; button.classList.remove("is-done"); }, 1500);
      });
    });
    wrap.append(button);
  });

  // ---------- Mermaid ----------

  const diagrams = [...document.querySelectorAll("pre.mermaid")];
  if (diagrams.length && window.mermaid) {
    const dark = () => document.documentElement.getAttribute("data-theme") === "dark";

    function draw() {
      diagrams.forEach(el => {
        el.removeAttribute("data-processed");
        el.textContent = el.dataset.src;
      });
      mermaid.initialize({ startOnLoad: false, theme: dark() ? "dark" : "default", securityLevel: "strict", fontFamily: "inherit" });
      mermaid.run({ nodes: diagrams }).catch(() => { /* a diagram with a mistake shows its source */ });
    }

    draw();
    // The theme is <html data-theme="dark"> or nothing (settings.js); redraw when it changes.
    new MutationObserver(list => {
      if (list.some(m => m.attributeName === "data-theme")) draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // ---------- A Confluence space's page tree (confluence/<KEY>/tree.json) ----------

  // Drawn here rather than written into every page, so a space of thousands of pages
  // doesn't repeat its whole tree in each one. The branch holding this page is opened.
  const treeBox = $("cf-tree");
  if (treeBox) {
    const currentId = treeBox.dataset.current;
    getJSON("tree.json", null).then(tree => {
      treeBox.textContent = "";
      if (!tree || !tree.length) return;
      const path = new Set();
      (function find(nodes, trail) {
        for (const [id, , kids] of nodes) {
          if (id === currentId) { trail.forEach(x => path.add(x)); return true; }
          if (kids.length && find(kids, trail.concat(id))) return true;
        }
        return false;
      })(tree, []);
      let currentLink = null;
      function list(nodes) {
        const ul = document.createElement("ul");
        nodes.forEach(([id, title, kids]) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = id + ".html";
          a.textContent = title;
          if (id === currentId) { a.setAttribute("aria-current", "page"); currentLink = a; }
          if (kids.length) {
            const details = document.createElement("details");
            details.open = path.has(id) || id === currentId;
            const summary = document.createElement("summary");
            summary.append(a);
            details.append(summary, list(kids));
            li.append(details);
          } else {
            li.append(a);
          }
          ul.append(li);
        });
        return ul;
      }
      treeBox.append(list(tree));
      // Scroll the sidebar (not the page) so this page's entry is in view.
      const box = $("enc-nav");
      if (currentLink && box && box.scrollHeight > box.clientHeight) {
        const top = currentLink.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
        box.scrollTop = Math.max(0, top - box.clientHeight / 2);
      }
    });
  }

  // ---------- The heading the page was opened at ----------

  // Collapsed folders in the sidebar hide the current page: open its folder.
  const current = document.querySelector('.enc-nav a[aria-current="page"]');
  if (current) {
    const details = current.closest("details");
    if (details) details.open = true;
  }
})();
