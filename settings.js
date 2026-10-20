// Site settings. Loaded in <head> on every page, so the saved theme is applied
// before the page draws (no white flash in dark mode).
//
// The gear button in the top bar (id="settingsToggle") opens a panel that
// slides in from the right. The panel is built here, so every page only needs
// the button. To add a setting, add a section to SETTINGS_SECTIONS below.
// Styles: settings.css. The transition levels themselves live in motion.js
// and motion.css; this file only stores the choice as <html data-motion>.

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

// origin: the control that was used, so Full/Extreme can wipe in from it.
function setDark(dark, origin) {
  const apply = () => {
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  };
  if (window.SiteMotion) {
    window.SiteMotion.themeChange(apply, origin);
  } else {
    apply();
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

// ---------- Transition levels (motion.js / motion.css do the animating) ----------

const MOTION_LEVELS = [
  { key: "off", label: "Off", hint: "No animation at all. Everything changes instantly." },
  { key: "subtle", label: "Subtle", hint: "Small touches that make the site feel smooth.", tag: "Recommended" },
  { key: "full", label: "Full", hint: "Pages slide, content glides in as you scroll. More noticeable." },
  { key: "extreme", label: "Extreme", hint: "Pure showing off. Slow, over the top and very shiny." }
];

// Subtle unless the device asks for less motion, until someone picks a level.
function defaultMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "off" : "subtle";
}

function motionLevel() {
  return document.documentElement.getAttribute("data-motion");
}

function setMotion(level, origin) {
  const previous = motionLevel();
  document.documentElement.setAttribute("data-motion", level);
  saveSetting("transitions", level);
  document.dispatchEvent(new CustomEvent("motionchange", { detail: { level, previous, origin } }));
}

(function applySavedMotion() {
  const stored = readSetting("transitions");
  const known = MOTION_LEVELS.some(option => option.key === stored);
  document.documentElement.setAttribute("data-motion", known ? stored : defaultMotion());
})();

// ---------- What the panel holds ----------

const SETTINGS_SECTIONS = [
  { title: "Appearance", build: buildAppearance },
  { title: "Page transitions", build: buildTransitions }
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
  const intro = document.createElement("p");
  intro.className = "settings-intro";
  intro.textContent = "How much the site moves: changing pages, scrolling and hovering.";

  const group = document.createElement("div");
  group.className = "settings-choices";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", "settings-section-page-transitions");

  MOTION_LEVELS.forEach(option => {
    const choice = document.createElement("label");
    choice.className = "settings-choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "setting-motion";
    input.value = option.key;
    input.checked = motionLevel() === option.key;
    input.addEventListener("change", () => {
      if (input.checked) setMotion(option.key, choice);
    });

    const name = document.createElement("span");
    name.className = "settings-choice-name";
    name.textContent = option.label;
    if (option.tag) {
      const tag = document.createElement("span");
      tag.className = "settings-tag";
      tag.textContent = option.tag;
      name.appendChild(tag);
    }

    const hint = document.createElement("span");
    hint.className = "settings-choice-hint";
    hint.textContent = option.hint;

    choice.append(input, name, hint);
    group.appendChild(choice);
  });

  const nodes = [intro, group];
  if (!readSetting("transitions") && defaultMotion() === "off") {
    const note = document.createElement("p");
    note.className = "settings-note";
    note.textContent = "Your device asks for less motion, so this starts on Off. You can still pick another level.";
    nodes.push(note);
  }
  return nodes;
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

  button.setAttribute("aria-checked", String(get()));
  button.addEventListener("click", () => {
    // Show the new state straight away: with a transition running, the
    // change itself only lands a moment later, so reading it back would be stale.
    const next = !get();
    set(next, button);
    button.setAttribute("aria-checked", String(next));
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
  SETTINGS_SECTIONS.forEach((section, index) => {
    // A div rather than <section>: the home page styles every "section h2/p".
    const block = document.createElement("div");
    block.className = "settings-section";
    block.setAttribute("role", "group");
    const heading = document.createElement("h3");
    heading.id = "settings-section-" + section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    block.setAttribute("aria-labelledby", heading.id);
    block.style.setProperty("--i", index); // lets Full/Extreme stagger the sections
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
    // Only the chosen radio button takes part in Tab, like the browser does.
    return [...panel.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter(node => !node.disabled && !(node.type === "radio" && !node.checked));
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
