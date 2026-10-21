// Served from the home server, so these pages have their own saved settings.
// The website's gateway pages (claude.html, todo.html) pass the visitor's
// settings along in the link (#settings=…); copy them in before the site
// scripts read them. Loaded first in <head> on index.html and todo.html.
(function () {
  const KEYS = ["theme", "accent", "backdrop", "language", "clock", "transitions"];
  const match = location.hash.match(/^#settings=([^&]*)(?:&(.*))?$/);
  if (!match) return;
  try {
    const settings = JSON.parse(decodeURIComponent(match[1]));
    KEYS.forEach(key => {
      if (typeof settings[key] === "string") localStorage.setItem(key, settings[key]);
      else localStorage.removeItem(key);
    });
  } catch (e) { /* bad link or no storage: keep what's here */ }
  history.replaceState(null, "", location.pathname + location.search + (match[2] ? "#" + match[2] : ""));
})();
