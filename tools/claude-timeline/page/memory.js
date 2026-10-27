// The Memory page: the two session timelines, Claude (./) and ChatGPT
// (chatgpt.html), as one card each. memory.json (made by build.py) has the
// numbers for the cards: sessions, days, what's waiting, and the newest one.
// The cards are plain links, so they work even if that file doesn't load.

(function () {
  // The page's files are also in the public repo, without data. Send anyone
  // who finds them there to the gateway page instead.
  if (/(^|\.)github\.io$/.test(location.hostname)) {
    location.replace("https://partypants16.github.io/memory.html");
    return;
  }

  const SHORT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const asDate = iso => new Date(iso + "T00:00:00Z");

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function count(list, number, label) {
    const item = el("li");
    item.append(el("b", "", String(number)), el("span", "", label));
    list.appendChild(item);
  }

  function fill(card, info) {
    if (!info || !info.sessions) return;
    const counts = card.querySelector(".feature-counts");
    counts.textContent = "";
    count(counts, info.sessions, info.sessions === 1 ? "Session" : "Sessions");
    count(counts, info.days, info.days === 1 ? "Day" : "Days");
    ["Needs testing", "Open"].forEach(status => {
      if (info.statuses && info.statuses[status]) count(counts, info.statuses[status], status);
    });
    counts.hidden = false;
    if (info.missing) {
      const note = el("p", "memory-note", info.missing === 1 ? "1 known chat isn't imported yet" : info.missing + " known chats aren't imported yet");
      counts.after(note);
    }

    const latest = card.querySelector(".memory-latest");
    if (info.latest) {
      latest.textContent = "";
      const title = el("span", "memory-latest-title", info.latest.title);
      const when = el("span", "", SHORT.format(asDate(info.latest.date)));
      title.setAttribute("translate", "no");
      when.setAttribute("translate", "no");
      latest.append(el("span", "memory-latest-label", "Latest"), " ", title, " · ", when);
      latest.hidden = false;
    }
  }

  fetch("memory.json", { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .then(data => {
      document.querySelectorAll("[data-memory]").forEach(card => fill(card, data[card.dataset.memory]));
    })
    .catch(() => { /* the cards still open their timelines */ });
})();
