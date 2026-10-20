// Site settings. Loaded in <head> on every page, so the saved theme is applied
// before the page draws (no white flash in dark mode).
//
// The gear button in the top bar (id="settingsToggle") opens a panel that
// slides in from the right. The panel is built here, so every page only needs
// the button. To add a setting, add a section to SETTINGS_SECTIONS below.
// Styles: settings.css.

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Storage blocked (e.g. private browsing): the choice lasts until the page closes.
  }
}

// ---------- Dark mode ("theme" is the key older visits already saved) ----------

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function setDark(dark) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  saveSetting("theme", dark ? "dark" : "light");
}

(function applySavedTheme() {
  const stored = readSetting("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (stored === "dark" || (!stored && prefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

// ---------- What the panel holds ----------

const SETTINGS_SECTIONS = [
  { title: "Appearance", build: buildAppearance },
  { title: "Page transitions", soon: true, build: buildTransitions }
];

function buildAppearance() {
  return [
    switchRow({
      id: "setting-dark-mode",
      label: "Dark mode",
      hint: "Darker colours, easier on the eyes at night.",
      get: isDark,
      set: setDark
    })
  ];
}

function buildTransitions() {
  // Empty for now. Levels of page transition (e.g. none / subtle / full) go here.
  const note = document.createElement("p");
  note.className = "settings-empty";
  note.textContent = "Nothing to choose yet. Later you'll be able to pick how much animation plays when you move between pages.";
  return [note];
}

// An on/off setting: a label (and optional hint) with a switch beside it.
function switchRow({ id, label, hint, get, set }) {
  const row = document.createElement("div");
  row.className = "settings-row";

  const text = document.createElement("div");
  text.className = "settings-row-text";
  const name = document.createElement("span");
  name.className = "settings-row-label";
  name.id = id + "-label";
  name.textContent = label;
  text.appendChild(name);
  if (hint) {
    const hintText = document.createElement("span");
    hintText.className = "settings-row-hint";
    hintText.id = id + "-hint";
    hintText.textContent = hint;
    text.appendChild(hintText);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-switch";
  button.id = id;
  button.setAttribute("role", "switch");
  button.setAttribute("aria-labelledby", name.id);
  if (hint) button.setAttribute("aria-describedby", id + "-hint");

  const sync = () => button.setAttribute("aria-checked", String(get()));
  sync();
  button.addEventListener("click", () => {
    set(!get());
    sync();
  });
  // Clicking the words flips it too, like a normal label.
  text.addEventListener("click", () => button.click());

  row.append(text, button);
  return row;
}

// ---------- The panel itself ----------

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("settingsToggle");
  if (!toggle) return;
  const root = document.documentElement;

  const backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";

  const panel = document.createElement("div");
  panel.className = "settings-panel";
  panel.id = "settingsPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "settings-title");

  const head = document.createElement("div");
  head.className = "settings-head";
  const title = document.createElement("h2");
  title.id = "settings-title";
  title.textContent = "Settings";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "settings-close";
  close.setAttribute("aria-label", "Close settings");
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  head.append(title, close);
  panel.appendChild(head);

  const body = document.createElement("div");
  body.className = "settings-body";
  SETTINGS_SECTIONS.forEach(section => {
    // A div rather than <section>: the home page styles every "section h2/p".
    const block = document.createElement("div");
    block.className = "settings-section";
    block.setAttribute("role", "group");
    const heading = document.createElement("h3");
    heading.id = "settings-section-" + section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    block.setAttribute("aria-labelledby", heading.id);
    heading.textContent = section.title;
    if (section.soon) {
      const tag = document.createElement("span");
      tag.className = "settings-soon";
      tag.textContent = "Coming soon";
      heading.appendChild(tag);
    }
    block.appendChild(heading);
    section.build().forEach(node => block.appendChild(node));
    body.appendChild(block);
  });
  panel.appendChild(body);

  const foot = document.createElement("p");
  foot.className = "settings-foot";
  foot.textContent = "Settings are saved in this browser only.";
  panel.appendChild(foot);

  document.body.append(backdrop, panel);

  function focusable() {
    return [...panel.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter(node => !node.disabled);
  }

  function open() {
    // Keep the page from jumping sideways when its scrollbar is hidden.
    root.style.setProperty("--settings-scrollbar", (window.innerWidth - root.clientWidth) + "px");
    root.classList.add("settings-open");
    toggle.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => close.focus());
  }

  function shut() {
    root.classList.remove("settings-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  const isOpen = () => root.classList.contains("settings-open");

  toggle.addEventListener("click", () => (isOpen() ? shut() : open()));
  close.addEventListener("click", shut);
  backdrop.addEventListener("click", shut);

  document.addEventListener("keydown", event => {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      shut();
    } else if (event.key === "Tab") {
      // Keep keyboard focus inside the panel while it's open.
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
});
