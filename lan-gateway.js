// The gateway for pages that only live on the home server: claude.html (the
// Claude page), chatgpt.html (ChatGPT), todo.html (To do) and encyclopedia.html.
// All are on the remote box (LAN only, plain HTTP), so these pages only send
// visitors there. The address is in
// <main data-lan-url="…">.
//
// A secure page can't check whether a home-network address answers, so it
// just goes: on home Wi-Fi the box answers at once and the browser moves on;
// anywhere else the address doesn't answer, so after WAIT_MS this stops
// trying and says why. The box's pages are in tools/claude-timeline/.
(function () {
  const main = document.querySelector("main[data-lan-url]");
  if (!main) return;
  const LAN_URL = main.dataset.lanUrl;
  const WAIT_MS = 3000;
  // Settings are saved per site, so pass them along to the home server's copy.
  const SETTING_KEYS = ["theme", "accent", "backdrop", "language", "clock", "transitions"];
  const checking = document.getElementById("checking");
  const offline = document.getElementById("offline");
  let timer = null;

  function target() {
    const settings = {};
    SETTING_KEYS.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) settings[key] = value;
      } catch (e) { /* no storage: the home server's copy uses its own */ }
    });
    // ?project=… and #<log name> links carry on to the same place.
    const hash = location.hash.slice(1);
    return LAN_URL + location.search + "#settings=" + encodeURIComponent(JSON.stringify(settings)) + (hash ? "&" + hash : "");
  }

  function showOffline() {
    clearTimeout(timer);
    checking.hidden = true;
    offline.hidden = false;
  }

  function go() {
    checking.hidden = false;
    offline.hidden = true;
    clearTimeout(timer);
    const url = target();
    document.getElementById("direct").href = url;
    timer = setTimeout(() => {
      window.stop(); // gives up on the address that isn't answering
      showOffline();
    }, WAIT_MS);
    location.replace(url);
  }

  document.getElementById("retry").addEventListener("click", go);
  // Came back to this page (Back button, restored tab): ask, don't jump.
  window.addEventListener("pageshow", event => { if (event.persisted) showOffline(); });
  // After the page has loaded, so stopping can't cut off this page's own files.
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
})();
