// Online / Offline on the home page cards for the self-hosted services.
// The remote box checks them every 5 minutes and publishes the result to a
// GitHub Gist (see tools/service-status/README.md). A card opts in with
// data-service="<id>", using the ids in tools/service-status/check_services.py.
// The gist id is also in ~/.config/service-status/gist-id on the box.
// While STATUS_URL is empty, or the gist can't be loaded, nothing is shown.

const STATUS_URL = "https://gist.githubusercontent.com/Partypants16/bed5059789305f00ccb304cca1d13034/raw/status.json";

(function () {
  const cards = document.querySelectorAll("[data-service]");
  if (!STATUS_URL || !cards.length) return;

  function ago(date) {
    const minutes = Math.max(0, Math.round((Date.now() - date) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + " min ago";
    const hours = Math.round(minutes / 60);
    if (hours < 48) return hours + " h ago";
    return Math.round(hours / 24) + " days ago";
  }

  function when(date) {
    return date.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }

  function show(status) {
    const checked = new Date(status.checked_at);
    if (isNaN(checked)) return;
    // No word for a couple of heartbeats means the box itself is off or offline.
    const staleAfter = ((status.heartbeat_minutes || 15) * 2 + 10) * 60000;
    const stale = Date.now() - checked > staleAfter;

    cards.forEach(card => {
      const info = status.services && status.services[card.dataset.service];
      if (!info) return;
      const state = stale ? "unknown" : info.up ? "up" : "down";

      const pill = document.createElement("span");
      pill.className = "status-pill";
      pill.dataset.state = state;
      const dot = document.createElement("span");
      dot.className = "status-pill-dot";
      dot.setAttribute("aria-hidden", "true");
      pill.appendChild(dot);
      pill.appendChild(document.createTextNode(state === "up" ? "Online" : state === "down" ? "Offline" : "Unknown"));
      pill.title = stale
        ? "The home server hasn't reported since " + when(checked) + "."
        : (info.up ? "Online" : "Offline") + (info.since ? " since " + when(new Date(info.since)) : "") + ". Updated " + ago(checked) + ".";
      card.appendChild(pill);
    });

    const summary = document.getElementById("status-summary");
    if (summary) {
      summary.textContent = stale
        ? "The home server hasn't reported since " + when(checked) + ", so it may be off. Service statuses are unknown."
        : "Self-hosted services are checked by the home server every " + (status.check_every_minutes || 5) + " minutes. Updated " + ago(checked) + ".";
      summary.hidden = false;
    }
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 8000);
  // The query string gets past GitHub's 5-minute cache (a new one each minute).
  fetch(STATUS_URL + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store", signal: controller.signal })
    .then(response => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.json();
    })
    .then(show)
    .catch(() => { /* no status is better than a wrong one */ });
})();
