// English / Hinglish for the whole site. Loaded in <head> on every page, after
// hinglish.js (the translations) and before settings.js.
//
// The pages are written in English. With Hinglish on, this swaps every bit of
// text that has a translation in hinglish.js: text on the page, text that
// scripts add later (it watches for changes), the tab title, and the
// placeholder / title / aria-label / alt of elements. Switching back puts the
// English back. It doesn't touch anything inside translate="no", which marks
// things like movie titles, friends' thoughts and quotes.
//
// The language is saved as "language" ("hinglish", or nothing for English).
// The toggle in the top bar and the one in Settings → Language and time both
// call SiteI18n.set(). Pressing L switches too (settings.js).

(function () {
  const root = document.documentElement;
  const KEY = "language";
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];
  const SKIP = "script, style, textarea, code, pre, [translate='no']:not(html)";

  const changed = new Set();        // text nodes we've rewritten
  const originals = new WeakMap();  // text node -> its English
  const ours = new WeakMap();       // text node -> the Hinglish we wrote (to spot our own changes)
  const attrOriginals = new WeakMap(); // element -> { attribute: English }
  const changedElements = new Set();
  let observer = null;
  let reverse = null;

  function stored() {
    try {
      return localStorage.getItem(KEY) === "hinglish" ? "hinglish" : "en";
    } catch (e) {
      return "en";
    }
  }

  let language = stored();

  function dictionary() {
    return typeof HINGLISH !== "undefined" ? HINGLISH : null;
  }

  // The Hinglish for one piece of text, or null if there isn't one.
  function translate(text) {
    const D = dictionary();
    if (!D || !text) return null;
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (!trimmed || !/[A-Za-z]/.test(trimmed)) return null;
    let out = Object.prototype.hasOwnProperty.call(D.words, trimmed) ? D.words[trimmed] : undefined;
    if (out === undefined) {
      for (const [pattern, replace] of D.patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          out = typeof replace === "function" ? replace(match, part) : trimmed.replace(pattern, replace);
          break;
        }
      }
    }
    if (out === undefined || out === null || out === trimmed) return null;
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return lead + out + trail;
  }

  // For patterns: translate a captured piece if possible, else leave it.
  function part(text) {
    const out = translate(text);
    return out === null ? text : out.trim();
  }

  function skipped(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return !element || !!element.closest(SKIP);
  }

  function translateText(node) {
    if (skipped(node)) return;
    const value = node.nodeValue;
    if (ours.get(node) === value) return; // our own write
    const out = translate(value);
    if (out === null) return;
    originals.set(node, value);
    ours.set(node, out);
    changed.add(node);
    node.nodeValue = out;
  }

  function translateAttributes(element) {
    if (skipped(element)) return;
    ATTRS.forEach(name => {
      if (!element.hasAttribute(name)) return;
      const value = element.getAttribute(name);
      const saved = attrOriginals.get(element) || {};
      if (saved["_" + name] === value) return; // our own write
      const out = translate(value);
      if (out === null) return;
      saved[name] = value;
      saved["_" + name] = out;
      attrOriginals.set(element, saved);
      changedElements.add(element);
      element.setAttribute(name, out);
    });
  }

  function walk(start) {
    if (start.nodeType === 3) {
      translateText(start);
      return;
    }
    if (start.nodeType !== 1 && start.nodeType !== 9) return;
    if (start.nodeType === 1) translateAttributes(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === 3) translateText(node);
      else translateAttributes(node);
      node = walker.nextNode();
    }
  }

  function onMutations(list) {
    list.forEach(mutation => {
      if (mutation.type === "characterData") translateText(mutation.target);
      else if (mutation.type === "attributes") translateAttributes(mutation.target);
      else mutation.addedNodes.forEach(walk);
    });
    // Forget nodes that are gone (the Wallpaper page rebuilds bits every minute).
    if (changed.size > 3000) changed.forEach(node => { if (!node.isConnected) changed.delete(node); });
  }

  function start() {
    if (observer) return;
    walk(document);
    observer = new MutationObserver(onMutations);
    observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Back to English: undo what we changed, and catch any Hinglish written
  // since (e.g. a title that motion.js rebuilt) with the reverse lookup.
  function restore() {
    if (observer) observer.disconnect();
    observer = null;
    changed.forEach(node => {
      if (node.isConnected && ours.get(node) === node.nodeValue) node.nodeValue = originals.get(node);
      ours.delete(node);
    });
    changed.clear();
    changedElements.forEach(element => {
      const saved = attrOriginals.get(element) || {};
      ATTRS.forEach(name => {
        if (saved[name] !== undefined && element.getAttribute(name) === saved["_" + name]) element.setAttribute(name, saved[name]);
      });
      attrOriginals.delete(element);
    });
    changedElements.clear();
    const D = dictionary();
    if (!D) return;
    if (!reverse) {
      reverse = new Map();
      Object.entries(D.words).forEach(([english, hinglish]) => { if (!reverse.has(hinglish)) reverse.set(hinglish, english); });
    }
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue.trim();
      if (text && reverse.has(text) && !skipped(node)) node.nodeValue = node.nodeValue.replace(text, reverse.get(text));
      node = walker.nextNode();
    }
  }

  function applyLang() {
    root.lang = language === "hinglish" ? "hi-Latn" : "en";
    if (language === "hinglish") root.dataset.lang = "hinglish";
    else delete root.dataset.lang;
  }

  function set(next) {
    next = next === "hinglish" ? "hinglish" : "en";
    if (next === language) return;
    try {
      if (next === "hinglish") localStorage.setItem(KEY, "hinglish");
      else localStorage.removeItem(KEY);
    } catch (e) { /* lasts until the page closes */ }
    document.dispatchEvent(new CustomEvent("languagewillchange", { detail: { language: next } }));
    language = next;
    applyLang();
    if (next === "hinglish") start();
    else restore();
    updateToggle();
    document.querySelectorAll('input[name="setting-language"]').forEach(input => { input.checked = input.value === language; });
    document.dispatchEvent(new CustomEvent("languagechange", { detail: { language } }));
  }

  // ---------- The quick toggle in the top bar, next to the gear ----------

  let toggleButton = null;

  function updateToggle() {
    if (!toggleButton) return;
    const hinglish = language === "hinglish";
    toggleButton.querySelector(".lang-code").textContent = hinglish ? "HI" : "EN";
    toggleButton.setAttribute("aria-pressed", String(hinglish));
    // Written in the language you'd switch to, so it makes sense either way.
    const label = hinglish ? "Switch to English" : "Hinglish mein dekho";
    toggleButton.setAttribute("aria-label", label);
    toggleButton.title = label + " (L)";
  }

  function addToggle() {
    const gear = document.getElementById("settingsToggle");
    if (!gear || document.querySelector(".lang-toggle")) return;
    const tools = document.createElement("span");
    tools.className = "nav-tools";
    gear.parentNode.insertBefore(tools, gear);
    toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "lang-toggle";
    toggleButton.setAttribute("translate", "no");
    toggleButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9s1.2-6.4 3.8-9z"/></svg><span class="lang-code"></span>';
    toggleButton.addEventListener("click", () => set(language === "hinglish" ? "en" : "hinglish"));
    tools.append(toggleButton, gear);
    updateToggle();
  }

  window.SiteI18n = {
    language: () => language,
    set,
    toggle: () => set(language === "hinglish" ? "en" : "hinglish"),
    translate: text => (language === "hinglish" ? part(text) : text)
  };

  applyLang();
  // Start straight away, so the page is translated as it arrives (no English flash).
  if (language === "hinglish") start();
  document.addEventListener("DOMContentLoaded", addToggle);
})();
