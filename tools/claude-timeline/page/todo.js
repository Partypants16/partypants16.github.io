// The To do page: a short summary of what's waiting on Parth across parth_project.
//
// Only on the remote box (http://192.168.212.60:8120/todo.html, LAN only),
// because it names Coles work. todo.json is made by build.py (todo.py) from
// parth_project/_workspace/context/TODO.md, which every session rewrites, with
// section 1 written from git each time the page is built. The website's
// todo.html sends visitors here when they're on home Wi-Fi.

(function () {
  const SITE_URL = "https://partypants16.github.io/";
  // The page's files are also in the public repo, without data. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace(SITE_URL + "todo.html");
    return;
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hour12 = () => (window.SiteClock ? window.SiteClock.hour12() : false);
  const $ = id => document.getElementById(id);
  let data = null;

  function el(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function when(iso) {
    const date = new Date(iso);
    const time = date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: hour12() });
    return date.getDate() + " " + MONTHS[date.getMonth()] + ", " + time;
  }

  function renderMeta() {
    const meta = $("meta");
    meta.textContent = "";
    const stamp = (label, iso) => {
      const span = el("span");
      const value = el("span", when(iso));
      value.setAttribute("translate", "no");
      span.append(el("span", label), " ", value);
      return span;
    };
    if (data.written) meta.append(stamp("Written", data.written), " · ");
    meta.append(stamp("Git checked", data.built));
    // Sessions logged after the text was last written: it may be missing what they left.
    if (data.newer.length) {
      const note = el("span");
      note.className = "todo-newer";
      note.append(el("span", "Logged since then:"), " ");
      data.newer.forEach((log, index) => {
        if (index) note.append(", ");
        const link = el("a", log.title);
        link.href = (log.page === "chatgpt" ? "chatgpt.html" : "./") + "#" + encodeURIComponent(log.id);
        link.setAttribute("translate", "no");
        note.append(link);
      });
      meta.append(note);
    }
  }

  fetch("todo.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(json => {
      data = json;
      // Built from TODO.md by markdown-it with raw HTML turned off, so this is only the text's own formatting.
      $("todo").innerHTML = data.html;
      renderMeta();
    })
    .catch(() => {
      $("message").textContent = "Couldn't load the to-do list. Try reloading the page.";
      $("message").hidden = false;
    });

  // The clock setting changed (12/24 h): redo the times.
  document.addEventListener("clockchange", () => { if (data) renderMeta(); });
})();
