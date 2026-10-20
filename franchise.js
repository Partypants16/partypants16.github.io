// Franchise tracker page: franchise.html?f=<key>, data from franchise-data.js.
// Filters live in the link too (e.g. &who=Parth&status=never), so a filtered
// view can be shared.

// Bar and legend order. The CSS colours each one by its key (data-status).
const STATUSES = [
  { key: "rewatched", label: "Re-watched recently" },
  { key: "watched", label: "Watched" },
  { key: "never", label: "Never watched" },
  { key: "notout", label: "Not out yet" },
  { key: "wont", label: "Won't watch" },
  { key: "unmarked", label: "Not marked yet" }
];
const STATUS_LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));

// 16x16 stroke icons, so a status is never told apart by colour alone.
const ICONS = {
  rewatched: '<path d="M1.5 8.5l3 3 6.5-7.5"/><path d="M8 11.5l6.5-7.5"/>',
  watched: '<path d="M3.5 8.5l3 3 6-7"/>',
  never: '<circle cx="8" cy="8" r="4.5"/>',
  notout: '<circle cx="8" cy="8" r="5"/><path d="M8 5v3.2l2 1.3"/>',
  wont: '<circle cx="8" cy="8" r="5"/><path d="M4.6 11.4l6.8-6.8"/>',
  unmarked: '<path d="M5 8h6"/>'
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusDot(key) {
  const dot = el("span", "status-dot");
  dot.dataset.status = key;
  dot.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + ICONS[key] + "</svg>";
  return dot;
}

function statusOf(entry, person) {
  return entry.status[person] || "unmarked";
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const params = new URLSearchParams(window.location.search);
const key = (params.get("f") || "").toLowerCase();
const franchise = Object.prototype.hasOwnProperty.call(FRANCHISES, key) ? FRANCHISES[key] : null;

if (!franchise) {
  document.getElementById("franchise-name").textContent = "Tracker not found";
  document.getElementById("franchise-summary").textContent =
    "There's no franchise tracker at this link. Go back to the movie lists and pick one.";
} else {
  renderTracker(franchise);
}

function renderTracker(franchise) {
  const people = franchise.people;
  const entries = [];
  franchise.sections.forEach(section => section.titles.forEach(entry => entries.push(entry)));

  document.title = franchise.name + " | Franchise Tracker";
  document.getElementById("franchise-name").textContent = franchise.name;
  document.getElementById("franchise-summary").textContent =
    "Franchise watch tracker · " + entries.length + " titles across " + franchise.sections.length +
    " series · " + people.slice(0, -1).join(", ") + " and " + people[people.length - 1];

  const unmarked = entries.reduce((n, e) => n + people.filter(p => !e.status[p]).length, 0);
  if (unmarked) {
    const note = document.getElementById("franchise-note");
    note.textContent = "Still being filled in: " + unmarked + " spots haven't been marked yet.";
    note.hidden = false;
  }

  renderOverview(people, entries);
  renderList(franchise, people);

  document.getElementById("overview").hidden = false;
  document.getElementById("filters").hidden = false;
}

// ---------- "Who's seen what": one stacked bar per person ----------

function renderOverview(people, entries) {
  const legend = document.getElementById("legend");
  STATUSES.forEach(s => {
    const item = el("li", "legend-item");
    item.appendChild(statusDot(s.key));
    item.appendChild(el("span", null, s.label));
    legend.appendChild(item);
  });

  const counts = people.map(person => {
    const c = Object.fromEntries(STATUSES.map(s => [s.key, 0]));
    entries.forEach(e => c[statusOf(e, person)]++);
    return c;
  });

  const bars = document.getElementById("person-bars");
  people.forEach((person, i) => {
    const c = counts[i];
    const seen = c.rewatched + c.watched;
    const released = entries.length - c.notout;

    const row = el("div", "person-row");
    row.appendChild(el("span", "person-row-name", person));

    const bar = el("div", "stack-bar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", person + ": " +
      STATUSES.filter(s => c[s.key]).map(s => c[s.key] + " " + s.label.toLowerCase()).join(", "));
    STATUSES.forEach(s => {
      if (!c[s.key]) return;
      const seg = el("span", "stack-seg");
      seg.dataset.status = s.key;
      seg.style.flexGrow = c[s.key];
      seg.dataset.tip = person + " · " + s.label + ": " + c[s.key] + " of " + entries.length;
      bar.appendChild(seg);
    });
    row.appendChild(bar);

    const total = el("span", "person-row-total");
    total.textContent = "Seen " + seen + " of " + released;
    total.title = "Out of the " + released + " titles that are out so far";
    row.appendChild(total);

    bars.appendChild(row);
  });

  // The same numbers as a table, for anyone who'd rather read them.
  const table = document.getElementById("counts-table");
  const headRow = el("tr");
  headRow.appendChild(el("th", null, ""));
  STATUSES.forEach(s => headRow.appendChild(el("th", null, s.label)));
  table.querySelector("thead").appendChild(headRow);
  people.forEach((person, i) => {
    const tr = el("tr");
    tr.appendChild(el("th", null, person));
    STATUSES.forEach(s => tr.appendChild(el("td", null, String(counts[i][s.key]))));
    table.querySelector("tbody").appendChild(tr);
  });

  setUpTooltip(bars);
}

function setUpTooltip(container) {
  const tip = document.getElementById("tooltip");

  function show(seg, x, y) {
    tip.textContent = seg.dataset.tip;
    tip.hidden = false;
    const box = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - box.width / 2), window.innerWidth - box.width - 8);
    tip.style.left = left + "px";
    tip.style.top = Math.max(8, y - box.height - 12) + "px";
  }

  container.addEventListener("pointermove", event => {
    const seg = event.target.closest(".stack-seg");
    if (seg && event.pointerType === "mouse") show(seg, event.clientX, event.clientY);
    else if (event.pointerType === "mouse") tip.hidden = true;
  });
  container.addEventListener("pointerleave", () => { tip.hidden = true; });

  // Touch: tap a segment to see its number, tap anywhere else to hide it.
  document.addEventListener("click", event => {
    const seg = event.target.closest(".stack-seg");
    if (!seg) { tip.hidden = true; return; }
    const box = seg.getBoundingClientRect();
    show(seg, box.left + box.width / 2, box.top);
  });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });
}

// ---------- Title cards + filters ----------

function renderList(franchise, people) {
  const searchInput = document.getElementById("filter-search");
  const whoSelect = document.getElementById("filter-who");
  const statusSelect = document.getElementById("filter-status");
  const jump = document.getElementById("section-jump");
  const container = document.getElementById("sections");

  [["any", "Anyone"], ["all", "Everyone"]].concat(people.map(p => [p, p])).forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    whoSelect.appendChild(option);
  });
  [["any", "Any status"]].concat(STATUSES.map(s => [s.key, s.label])).forEach(([value, label]) => {
    const option = el("option", null, label);
    option.value = value;
    statusSelect.appendChild(option);
  });

  // Start from whatever filters the link carries.
  searchInput.value = params.get("q") || "";
  const whoParam = params.get("who");
  const matchedPerson = people.find(p => p.toLowerCase() === (whoParam || "").toLowerCase());
  whoSelect.value = matchedPerson || (["any", "all"].includes(whoParam) ? whoParam : "any");
  statusSelect.value = STATUS_LABEL[params.get("status")] ? params.get("status") : "any";

  const cards = [];
  franchise.sections.forEach(section => {
    const id = "series-" + slug(section.name);

    const link = el("a", "jump-chip");
    link.href = "#" + id;
    link.appendChild(el("span", null, section.name));
    const linkCount = el("span", "jump-count", String(section.titles.length));
    link.appendChild(linkCount);
    jump.appendChild(link);

    const block = el("section", "series");
    block.id = id;
    const heading = el("h2", "series-heading");
    heading.appendChild(el("span", null, section.name));
    const headingCount = el("span", "series-count");
    heading.appendChild(headingCount);
    block.appendChild(heading);

    const list = el("ol", "title-list");
    const sectionCards = section.titles.map((entry, index) => {
      const card = buildCard(entry, index, people);
      list.appendChild(card.node);
      return card;
    });
    block.appendChild(list);
    container.appendChild(block);

    cards.push({ block, link, headingCount, linkCount, total: section.titles.length, items: sectionCards });
  });

  const empty = document.getElementById("filter-empty");
  const count = document.getElementById("filter-count");
  const allTotal = cards.reduce((n, s) => n + s.total, 0);

  function apply() {
    const query = searchInput.value.trim().toLowerCase();
    const who = whoSelect.value;
    const status = statusSelect.value;

    let shown = 0;
    cards.forEach(section => {
      let sectionShown = 0;
      section.items.forEach(card => {
        const statuses = people.map(p => statusOf(card.entry, p));
        let match = !query || card.searchText.includes(query);
        if (match && status !== "any") {
          if (who === "any") match = statuses.includes(status);
          else if (who === "all") match = statuses.every(s => s === status);
          else match = statusOf(card.entry, who) === status;
        }
        card.node.hidden = !match;
        card.node.querySelectorAll("[data-person]").forEach(node => {
          node.classList.toggle("is-focus", node.dataset.person === who);
        });
        if (match) sectionShown++;
      });
      shown += sectionShown;
      section.block.hidden = sectionShown === 0;
      section.link.hidden = sectionShown === 0;
      const filtered = sectionShown !== section.total;
      section.headingCount.textContent = filtered ? sectionShown + " of " + section.total : String(section.total);
      section.linkCount.textContent = filtered ? sectionShown + "/" + section.total : String(section.total);
    });

    count.textContent = shown === allTotal ? "Showing all " + allTotal + " titles" : "Showing " + shown + " of " + allTotal + " titles";
    empty.hidden = shown !== 0;

    // Keep the link in step with the filters, so it can be shared.
    const next = new URLSearchParams();
    next.set("f", key);
    if (query) next.set("q", searchInput.value.trim());
    if (who !== "any") next.set("who", who);
    if (status !== "any") next.set("status", status);
    try {
      history.replaceState(null, "", "?" + next.toString() + window.location.hash);
    } catch (e) {
      // Some browsers refuse this for pages opened straight from disk; filtering still works.
    }
  }

  searchInput.addEventListener("input", apply);
  whoSelect.addEventListener("change", apply);
  statusSelect.addEventListener("change", apply);
  document.getElementById("filter-reset").addEventListener("click", () => {
    searchInput.value = "";
    whoSelect.value = "any";
    statusSelect.value = "any";
    apply();
  });

  apply();
}

function buildCard(entry, index, people) {
  const node = el("li", "title-card");

  const head = el("div", "title-head");
  head.appendChild(el("span", "title-num", String(index + 1).padStart(2, "0")));
  const name = el("h3", "title-name", entry.title);
  name.setAttribute("translate", "no"); // film titles stay as they are in Hinglish
  head.appendChild(name);
  node.appendChild(head);

  const chips = el("ul", "watch-chips");
  people.forEach(person => {
    const status = statusOf(entry, person);
    const chip = el("li", "watch-chip");
    chip.dataset.status = status;
    chip.dataset.person = person;
    chip.title = person + ": " + STATUS_LABEL[status];
    chip.appendChild(statusDot(status));
    chip.appendChild(el("span", "chip-name", person));
    chip.appendChild(el("span", "visually-hidden", ": " + STATUS_LABEL[status]));
    chips.appendChild(chip);
  });
  node.appendChild(chips);

  const thoughts = entry.thoughts || {};
  const writers = people.filter(p => thoughts[p]);
  if (writers.length) {
    const list = el("dl", "thoughts");
    writers.forEach(person => {
      const row = el("div", "thought");
      row.dataset.person = person;
      row.appendChild(el("dt", null, person));
      const words = el("dd", null, thoughts[person]);
      words.setAttribute("translate", "no"); // everyone's thoughts stay in their own words
      row.appendChild(words);
      list.appendChild(row);
    });
    node.appendChild(list);
  } else {
    node.appendChild(el("p", "no-thoughts", "No thoughts written yet."));
  }

  const searchText = [entry.title].concat(writers.map(p => thoughts[p])).join("\n").toLowerCase();
  return { node, entry, searchText };
}
