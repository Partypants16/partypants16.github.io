// Site settings. Loaded in <head> on every page (after i18n.js), so the saved
// theme and accent colour are applied before the page draws (no white flash in
// dark mode).
//
// The gear button in the top bar (id="settingsToggle") opens a panel that
// slides in from the right. The panel is built here, so every page only needs
// the button. To add a setting, add a section to SETTINGS_SECTIONS below.
// A page can add sections of its own by putting them into SETTINGS_SECTIONS
// before DOMContentLoaded (wallpaper.js adds "Wallpaper" that way).
// Styles: settings.css. The transition levels themselves live in motion.js
// and motion.css; this file only stores the choice as <html data-motion>.
// The language (English / Hinglish) lives in i18n.js; this file only shows it.
//
// Also here: the site-wide clock format (SiteClock), the wallpaper behind every
// page (a drawn wallpaper from wallpapers/, run by wallpaper.js), keyboard
// shortcuts, and "Reset everything".

// Where the site's files are, so pages in sub-folders can load the wallpapers.
const SITE_BASE = new URL(".", document.currentScript ? document.currentScript.src : location.href).href;

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

function removeSetting(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) { /* nothing saved anyway */ }
}

// ---------- Theme: Auto / Light / Dark ("theme" is the key older visits already saved) ----------

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function themeSetting() {
  const stored = readSetting("theme");
  return stored === "dark" || stored === "light" ? stored : "auto";
}

function isDark() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function applyTheme(dark) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// origin: the control that was used, so Full/Extreme can wipe in from it.
function setTheme(mode, origin) {
  if (mode === "auto") removeSetting("theme");
  else saveSetting("theme", mode);
  const dark = mode === "dark" || (mode === "auto" && darkQuery.matches);
  if (dark === isDark()) return;
  if (window.SiteMotion) {
    window.SiteMotion.themeChange(() => applyTheme(dark), origin);
  } else {
    applyTheme(dark);
  }
}

applyTheme(themeSetting() === "dark" || (themeSetting() === "auto" && darkQuery.matches));
// On Auto, follow the device when it switches between light and dark.
darkQuery.addEventListener("change", () => {
  if (themeSetting() === "auto") applyTheme(darkQuery.matches);
});

// ---------- Accent colour ----------

// main: buttons and links on light pages. bright: the same on dark ones.
// line: the thin line under the top bar. soft / softDark: picked-option backgrounds.
const ACCENTS = [
  { key: "blue", label: "Blue", main: "#1464c0", bright: "#4d8fe8", line: "#e0f7fa", soft: "#eef4fc", softDark: "#1d2a3d" },
  { key: "teal", label: "Teal", main: "#0f766e", bright: "#2dd4bf", line: "#ccfbf1", soft: "#e6f6f4", softDark: "#13302e" },
  { key: "purple", label: "Purple", main: "#6d28d9", bright: "#a78bfa", line: "#ede9fe", soft: "#f1ecfd", softDark: "#2a2140" },
  { key: "pink", label: "Pink", main: "#be185d", bright: "#f472b6", line: "#fce7f3", soft: "#fcedf4", softDark: "#3a1d2c" },
  { key: "red", label: "Red", main: "#c8102e", bright: "#ff5a6e", line: "#ffe4e6", soft: "#fdecee", softDark: "#3a1b20" },
  { key: "orange", label: "Orange", main: "#c2410c", bright: "#fb923c", line: "#ffedd5", soft: "#fdf0e8", softDark: "#3a2416" },
  { key: "green", label: "Green", main: "#15803d", bright: "#4ade80", line: "#dcfce7", soft: "#e9f6ee", softDark: "#16301f" }
];

function accentSetting() {
  const stored = readSetting("accent");
  return ACCENTS.some(a => a.key === stored) ? stored : "blue";
}

// Blue is the site's own look, so it sets nothing and the CSS defaults apply.
function applyAccent(key) {
  const style = document.documentElement.style;
  const accent = ACCENTS.find(a => a.key === key);
  ["--accent", "--accent-bright", "--accent-line", "--accent-soft", "--accent-soft-dark"].forEach(name => style.removeProperty(name));
  if (!accent || accent.key === "blue") return;
  style.setProperty("--accent", accent.main);
  style.setProperty("--accent-bright", accent.bright);
  style.setProperty("--accent-line", accent.line);
  style.setProperty("--accent-soft", accent.soft);
  style.setProperty("--accent-soft-dark", accent.softDark);
}

function setAccent(key) {
  if (key === "blue") removeSetting("accent");
  else saveSetting("accent", key);
  applyAccent(key);
}

applyAccent(accentSetting());

// ---------- Clock: 24-hour or 12-hour, everywhere a time is shown ----------

const SiteClock = window.SiteClock = {
  format() {
    // "wp-clock" is where the Wallpaper page kept it before it went site-wide.
    const stored = readSetting("clock") || readSetting("wp-clock");
    return stored === "12" ? "12" : "24";
  },
  hour12() {
    return SiteClock.format() === "12";
  },
  set(value) {
    saveSetting("clock", value);
    removeSetting("wp-clock");
    document.dispatchEvent(new CustomEvent("clockchange", { detail: { format: value } }));
  }
};

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

// ---------- A wallpaper behind every page ----------
//
// One of the drawn wallpapers from the Wallpaper page, dimmed behind the
// content. wallpaper.js and the wallpaper's own file are only loaded when one
// is picked. scene: "scene" / "thumbScene" draws just that; live ones run the
// wallpaper itself (so Weather fetches the real weather).

const BACKDROPS = [
  { key: "none", label: "None" },
  { key: "aurora", label: "Aurora", file: "aurora.js", scene: "scene" },
  { key: "starfield", label: "Starfield", file: "starfield.js", scene: "scene" },
  { key: "night-drive", label: "Night Drive", file: "night-drive.js", scene: "scene" },
  { key: "rain-glass", label: "Rain on Glass", file: "rain-glass.js", scene: "scene" },
  { key: "day-night", label: "Day & Night", file: "day-night.js" },
  { key: "weather", label: "Melbourne Weather", file: "weather.js" },
  { key: "start-page", label: "Colour glow", file: "start-page.js", scene: "scene" },
  { key: "now-playing", label: "Controller buttons", file: "now-playing.js", scene: "thumbScene" }
];

const onWallpaperPage = () => document.documentElement.dataset.page === "wallpaper";

function backdropSetting() {
  const stored = readSetting("backdrop");
  return BACKDROPS.some(b => b.key === stored) ? stored : "none";
}

const loadedScripts = {};
function loadScript(path) {
  if (!loadedScripts[path]) {
    loadedScripts[path] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SITE_BASE + path;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Couldn't load " + path));
      document.head.appendChild(script);
    });
  }
  return loadedScripts[path];
}

let backdropShowing = null; // { key, handle, box }

function showBackdrop(key) {
  const root = document.documentElement;
  if (backdropShowing) {
    if (backdropShowing.handle) backdropShowing.handle.stop();
    backdropShowing.box.remove();
    backdropShowing = null;
  }
  const choice = BACKDROPS.find(b => b.key === key);
  if (!choice || !choice.file || onWallpaperPage() || !document.body) {
    delete root.dataset.backdrop;
    return;
  }
  const box = document.createElement("div");
  box.className = "site-wallpaper";
  box.setAttribute("aria-hidden", "true");
  document.body.prepend(box);
  root.dataset.backdrop = key;
  const showing = backdropShowing = { key, handle: null, box };
  // Still when the device asks for less motion, or transitions are Off.
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || motionLevel() === "off";
  loadScript("wallpaper.js")
    .then(() => loadScript("wallpapers/" + choice.file))
    .then(() => {
      if (backdropShowing !== showing || !window.WP) return;
      const def = window.WP.get(choice.key);
      showing.handle = window.WP.mountBackdrop(box, choice.key, { still, scene: choice.scene && def ? def[choice.scene] : null });
    })
    .catch(() => {
      box.remove();
      delete root.dataset.backdrop;
    });
}

function setBackdrop(key) {
  if (key === "none") removeSetting("backdrop");
  else saveSetting("backdrop", key);
  showBackdrop(key);
}

document.addEventListener("DOMContentLoaded", () => {
  if (backdropSetting() !== "none") showBackdrop(backdropSetting());
});
document.addEventListener("motionchange", event => {
  // Off makes it still, anything else lets it move again.
  if (backdropShowing && (event.detail.level === "off" || event.detail.previous === "off")) showBackdrop(backdropShowing.key);
});

// ---------- Reset everything ----------

// Everything the site saves. DATA_KEYS (and the wallpaper data cache) only go
// when "Also delete my saved things" is ticked.
const SETTING_KEYS = ["theme", "accent", "backdrop", "language", "clock", "transitions",
  "wallpaper", "wp-clock", "wp-seconds", "wp-quote", "wp-dim", "wp-motion", "wp-search"];
const DATA_KEYS = ["wp-focus", "wp-countdowns"];

function resetEverything(alsoData) {
  SETTING_KEYS.forEach(removeSetting);
  if (alsoData) {
    DATA_KEYS.forEach(removeSetting);
    try {
      Object.keys(localStorage).filter(key => key.startsWith("wp-cache:")).forEach(removeSetting);
    } catch (e) { /* nothing to clear */ }
  }
  location.reload();
}

// ---------- What the panel holds ----------

const keyboard = window.matchMedia("(hover: hover) and (pointer: fine)");

// when: leave a section out when it says false.
const SETTINGS_SECTIONS = [
  { title: "Appearance", build: buildAppearance },
  { title: "Language and time", build: buildLanguage },
  { title: "Page transitions", build: buildTransitions },
  { title: "Keyboard shortcuts", build: buildShortcuts, when: () => keyboard.matches },
  { title: "Reset", build: buildReset }
];

function buildAppearance() {
  const rows = [
    segmentedRow({
      id: "setting-theme",
      label: "Theme",
      hint: "Auto follows your device's light or dark setting.",
      options: [{ key: "auto", label: "Auto" }, { key: "light", label: "Light" }, { key: "dark", label: "Dark" }],
      get: themeSetting,
      set: setTheme
    }),
    swatchRow({
      id: "setting-accent",
      label: "Accent colour",
      hint: "For buttons, links and the line under the top bar.",
      options: ACCENTS.map(a => ({ key: a.key, label: a.label, color: a.main })),
      get: accentSetting,
      set: setAccent
    })
  ];
  if (!onWallpaperPage()) {
    rows.push(selectRow({
      id: "setting-backdrop",
      label: "Wallpaper behind every page",
      hint: "One of the drawn wallpapers, dimmed behind everything.",
      options: BACKDROPS.map(b => ({ key: b.key, label: b.label })),
      get: backdropSetting,
      set: setBackdrop
    }));
  }
  return rows;
}

function buildLanguage() {
  const rows = [];
  if (window.SiteI18n) {
    rows.push(segmentedRow({
      id: "setting-language",
      label: "Language",
      hint: "Hinglish: the whole site in Hindi and English mixed, written in English letters.",
      options: [{ key: "en", label: "English" }, { key: "hinglish", label: "Hinglish" }],
      get: () => window.SiteI18n.language(),
      set: value => window.SiteI18n.set(value)
    }));
  }
  rows.push(segmentedRow({
    id: "setting-clock",
    label: "Clock",
    hint: "For every time on the site: the wallpaper clock, countdowns, F1 and the server status.",
    options: [{ key: "24", label: "24-hour" }, { key: "12", label: "12-hour" }],
    get: SiteClock.format,
    set: SiteClock.set
  }));
  return rows;
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

// The keys that do something, on every page and then on this one.
const SHORTCUTS = [
  { keys: ["?"], does: "Open this list" },
  { keys: ["L"], does: "Switch between English and Hinglish" },
  { keys: ["D"], does: "Switch between light and dark" },
  { keys: ["Esc"], does: "Close the settings or the wallpaper picker" }
];
const WALLPAPER_SHORTCUTS = [
  { keys: ["←", "→"], does: "Previous or next wallpaper" },
  { keys: ["F"], does: "Ambient mode: full screen, controls hide" },
  { keys: ["/"], does: "Search (on the Start Page)" },
  { keys: ["Space"], does: "Warp speed (on the Starfield)" }
];

function buildShortcuts() {
  const list = document.createElement("dl");
  list.className = "settings-keys";
  const add = (items, heading) => {
    if (heading) {
      const title = document.createElement("p");
      title.className = "settings-keys-heading";
      title.textContent = heading;
      list.appendChild(title);
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "settings-key";
      const keys = document.createElement("dt");
      item.keys.forEach(key => {
        const kbd = document.createElement("kbd");
        kbd.textContent = key;
        kbd.setAttribute("translate", "no");
        keys.appendChild(kbd);
      });
      const does = document.createElement("dd");
      does.textContent = item.does;
      row.append(keys, does);
      list.appendChild(row);
    });
  };
  add(SHORTCUTS);
  if (onWallpaperPage()) add(WALLPAPER_SHORTCUTS, "On this page");
  return [list];
}

function buildReset() {
  const intro = document.createElement("p");
  intro.className = "settings-intro";
  intro.textContent = "Puts every setting back to how the site starts out.";

  const check = document.createElement("label");
  check.className = "settings-check";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.id = "setting-reset-data";
  const text = document.createElement("span");
  text.textContent = "Also delete my saved things (countdowns, the Focus timer, saved wallpaper data)";
  check.append(box, text);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "settings-reset";
  button.id = "setting-reset";
  button.textContent = "Reset everything";
  // A second click within a few seconds does it, so it can't happen by accident.
  let armed = 0;
  button.addEventListener("click", () => {
    if (armed) {
      clearTimeout(armed);
      resetEverything(box.checked);
      return;
    }
    button.textContent = "Click again to reset";
    button.classList.add("is-armed");
    armed = setTimeout(() => {
      armed = 0;
      button.textContent = "Reset everything";
      button.classList.remove("is-armed");
    }, 4000);
  });
  return [intro, check, button];
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

// The label and hint over a field (segmentedRow, swatchRow, selectRow).
function fieldHead(id, label, hint) {
  const field = document.createElement("div");
  field.className = "settings-field";
  const name = document.createElement("span");
  name.className = "settings-row-label";
  name.id = id + "-label";
  name.textContent = label;
  field.appendChild(name);
  if (hint) {
    const hintText = document.createElement("span");
    hintText.className = "settings-row-hint";
    hintText.id = id + "-hint";
    hintText.textContent = hint;
    field.appendChild(hintText);
  }
  return field;
}

// A short pick-one setting: a label (and optional hint) over a row of
// segments. options: [{ key, label }]. set(key, segment) is called with the new
// choice and the segment that was clicked.
function segmentedRow({ id, label, hint, options, get, set }) {
  const field = fieldHead(id, label, hint);
  const group = document.createElement("div");
  group.className = "settings-segments";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", id + "-label");
  if (hint) group.setAttribute("aria-describedby", id + "-hint");

  const current = get();
  options.forEach(option => {
    const segment = document.createElement("label");
    segment.className = "settings-segment";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = id;
    input.value = option.key;
    input.checked = option.key === current;
    input.addEventListener("change", () => {
      if (input.checked) set(option.key, segment);
    });
    const text = document.createElement("span");
    text.textContent = option.label;
    segment.append(input, text);
    group.appendChild(segment);
  });

  field.appendChild(group);
  return field;
}

// Pick a colour: a row of round swatches. options: [{ key, label, color }].
function swatchRow({ id, label, hint, options, get, set }) {
  const field = fieldHead(id, label, hint);
  const group = document.createElement("div");
  group.className = "settings-swatches";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", id + "-label");
  const current = get();
  options.forEach(option => {
    const swatch = document.createElement("label");
    swatch.className = "settings-swatch";
    swatch.title = option.label;
    swatch.style.setProperty("--swatch", option.color);
    const input = document.createElement("input");
    input.type = "radio";
    input.name = id;
    input.value = option.key;
    input.checked = option.key === current;
    input.setAttribute("aria-label", option.label);
    input.addEventListener("change", () => {
      if (input.checked) set(option.key, swatch);
    });
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    swatch.append(input, dot);
    group.appendChild(swatch);
  });
  field.appendChild(group);
  return field;
}

// A longer pick-one setting, as a drop-down. options: [{ key, label }].
function selectRow({ id, label, hint, options, get, set }) {
  const field = fieldHead(id, label, hint);
  const select = document.createElement("select");
  select.className = "settings-select";
  select.id = id;
  select.setAttribute("aria-labelledby", id + "-label");
  if (hint) select.setAttribute("aria-describedby", id + "-hint");
  const current = get();
  options.forEach(option => {
    const item = document.createElement("option");
    item.value = option.key;
    item.textContent = option.label;
    item.selected = option.key === current;
    select.appendChild(item);
  });
  select.addEventListener("change", () => set(select.value, select));
  field.appendChild(select);
  return field;
}

// ---------- The panel itself ----------

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("settingsToggle");
  const root = document.documentElement;

  // Shortcuts that work on every page (not while typing, or with Ctrl/Cmd/Alt).
  document.addEventListener("keydown", event => {
    const typing = event.target.closest && event.target.closest("input, textarea, select, [contenteditable]");
    if (typing || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (event.key === "?" && window.SiteSettings) {
      event.preventDefault();
      window.SiteSettings.open("keyboard-shortcuts");
    } else if ((event.key === "l" || event.key === "L") && window.SiteI18n) {
      window.SiteI18n.toggle();
    } else if (event.key === "d" || event.key === "D") {
      setTheme(isDark() ? "light" : "dark");
      document.querySelectorAll('input[name="setting-theme"]').forEach(input => { input.checked = input.value === themeSetting(); });
    }
  });

  if (!toggle) return;

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
  SETTINGS_SECTIONS.filter(section => !section.when || section.when()).forEach((section, index) => {
    // A div rather than <section>: the home page styles every "section h2/p".
    const block = document.createElement("div");
    block.className = "settings-section";
    block.setAttribute("role", "group");
    const heading = document.createElement("h3");
    heading.id = "settings-section-" + section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    heading.tabIndex = -1;
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

  // section: jump to that section (its id without "settings-section-").
  function open(section) {
    // Keep the page from jumping sideways when its scrollbar is hidden.
    root.style.setProperty("--settings-scrollbar", (window.innerWidth - root.clientWidth) + "px");
    root.classList.add("settings-open");
    toggle.setAttribute("aria-expanded", "true");
    const target = section && document.getElementById("settings-section-" + section);
    requestAnimationFrame(() => {
      if (target) {
        target.scrollIntoView({ block: "start" });
        target.focus({ preventScroll: true });
      } else {
        close.focus();
      }
    });
  }

  function shut() {
    root.classList.remove("settings-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  const isOpen = () => root.classList.contains("settings-open");
  window.SiteSettings = { open, close: shut, isOpen };

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

// The Projects tabs (Showcase · Claude · ChatGPT · To do · Encyclopedia) scroll
// sideways on a phone: start with the current one in view.
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelector(".section-tabs");
  const current = tabs && tabs.querySelector('[aria-current="page"]');
  if (!current || tabs.scrollWidth <= tabs.clientWidth) return;
  const offset = current.getBoundingClientRect().left - tabs.getBoundingClientRect().left;
  tabs.scrollLeft += offset - (tabs.clientWidth - current.offsetWidth) / 2;
});
