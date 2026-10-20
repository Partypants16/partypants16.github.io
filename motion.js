// Transition levels: Off / Subtle / Full / Extreme.
//
// settings.js stores the level and sets it as <html data-motion="...">, and
// motion.css does everything CSS can do on its own. This file adds the parts
// that need script:
//   - page changes: picks the style (slide direction, or Extreme's random
//     flip / portal / vortex) and skips them on Off
//   - Full and up: content fades in as it scrolls into view
//   - Extreme: cards tilt towards the cursor, rainbow title letters, a sparkle
//     trail, click bursts, and confetti when Extreme is picked
//   - Full and up: the dark mode switch wipes the new theme in as a circle
//
// Loaded in <head> straight after settings.js: the page-change hooks have to
// exist before the page first draws. Choosing a level in the settings panel
// fires "motionchange", and everything here re-applies without a reload.

(function () {
  const root = document.documentElement;
  const LEVELS = ["off", "subtle", "full", "extreme"];
  const level = () => (LEVELS.includes(root.dataset.motion) ? root.dataset.motion : "subtle");
  const atLeast = name => LEVELS.indexOf(level()) >= LEVELS.indexOf(name);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

  // Browsers that animate between pages get data-vt; motion.css gives the
  // others a simple entrance animation instead.
  if ("CSSViewTransitionRule" in window) root.dataset.vt = "";

  function session(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
    return null;
  }

  const random = (min, max) => min + Math.random() * (max - min);

  // A skipped or interrupted transition rejects "ready"; that's expected, not an error.
  const quiet = transition => transition.ready.catch(() => {});

  // Shared with settings.js (theme changes) and handy for checking what ran.
  const SiteMotion = window.SiteMotion = { lastPageTransition: null };

  // ---------- Dark mode wipe (Full and up) ----------

  // settings.js calls this to switch the theme; apply() does the switching.
  SiteMotion.themeChange = function (apply, origin) {
    if (!atLeast("full") || !document.startViewTransition) {
      apply();
      return;
    }
    const box = origin ? origin.getBoundingClientRect() : null;
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const y = box ? box.top + box.height / 2 : window.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty("--theme-x", x + "px");
    root.style.setProperty("--theme-y", y + "px");
    root.style.setProperty("--theme-r", Math.ceil(radius) + "px");
    root.dataset.themeVt = "";
    try {
      const transition = document.startViewTransition(apply);
      quiet(transition);
      transition.finished.finally(() => delete root.dataset.themeVt);
    } catch (e) {
      delete root.dataset.themeVt;
      apply();
    }
  };

  // ---------- Page changes ----------

  const EXTREME_STYLES = ["flip", "portal", "vortex"];

  // Remember where a link was clicked (Extreme's portal opens from there) and
  // whether it was a "back" link (Full slides the other way for those).
  document.addEventListener("click", event => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    let x = event.clientX;
    let y = event.clientY;
    if (!event.detail) { // keyboard: use the middle of the link
      const box = link.getBoundingClientRect();
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
    }
    session("mo-origin", JSON.stringify({ x: Math.round(x / window.innerWidth * 100), y: Math.round(y / window.innerHeight * 100) }));
    session("mo-dir", link.classList.contains("back-link") ? "back" : null);
  }, true);

  function navDirection() {
    if (session("mo-dir") === "back") return "back";
    try {
      const activation = window.navigation && window.navigation.activation;
      if (activation && activation.navigationType === "traverse" && activation.from && activation.entry &&
          activation.entry.index < activation.from.index) return "back";
    } catch (e) { /* no Navigation API */ }
    return "forward";
  }

  // Old page, just before it goes
  window.addEventListener("pageswap", event => {
    if (!event.viewTransition) return;
    quiet(event.viewTransition);
    if (level() === "off") event.viewTransition.skipTransition();
  });

  // New page, just before it first draws
  window.addEventListener("pagereveal", event => {
    const transition = event.viewTransition;
    if (!transition) return;
    quiet(transition);
    if (level() === "off") {
      transition.skipTransition();
      SiteMotion.lastPageTransition = "skipped";
      return;
    }
    root.dataset.pageVt = "";
    root.dataset.navDir = navDirection();
    let style = level() === "full" ? "slide-" + root.dataset.navDir : "fade";
    if (level() === "extreme") {
      const options = EXTREME_STYLES.filter(name => name !== session("mo-last-style"));
      style = options[Math.floor(Math.random() * options.length)];
      session("mo-last-style", style);
      root.dataset.vtStyle = style;
      let origin = null;
      try { origin = JSON.parse(session("mo-origin")); } catch (e) { /* none saved */ }
      root.style.setProperty("--vt-x", (origin ? origin.x : 50) + "%");
      root.style.setProperty("--vt-y", (origin ? origin.y : 50) + "%");
    }
    SiteMotion.lastPageTransition = style;
    transition.finished.finally(() => {
      delete root.dataset.pageVt;
      delete root.dataset.navDir;
      delete root.dataset.vtStyle;
      session("mo-origin", null);
      session("mo-dir", null);
    });
  });

  // ---------- Content fading in as it scrolls into view (Full and up) ----------

  const REVEAL = [
    ".card-container > *", ".people-list > li", ".franchise-list > li", ".movie-list > li",
    ".tracker-overview", ".title-card", ".platform-card", ".experiment-card",
    ".profile-header", ".tech-stack", ".contact-info", ".certifications", ".development-notice"
  ].join(", ");

  let observer = null;

  function stopReveal() {
    if (observer) observer.disconnect();
    observer = null;
    document.querySelectorAll(".mo-reveal").forEach(node => node.classList.remove("mo-reveal", "mo-in"));
  }

  function startReveal() {
    stopReveal();
    if (!atLeast("full") || !("IntersectionObserver" in window)) return;
    const extreme = level() === "extreme";
    observer = new IntersectionObserver(entries => {
      entries
        .filter(entry => entry.isIntersecting)
        .map(entry => entry.target)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top ||
                        a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        .forEach((node, i) => {
          node.style.setProperty("--mo-delay", Math.min(i, 12) * (extreme ? 90 : 60) + "ms");
          node.classList.add("mo-in");
          observer.unobserve(node);
        });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });

    document.querySelectorAll(REVEAL).forEach(node => {
      if (node.closest(".settings-panel")) return;
      if (extreme) { // each one flies in from somewhere different
        const angle = random(0, Math.PI * 2);
        const distance = random(220, 520);
        node.style.setProperty("--mo-x", Math.round(Math.cos(angle) * distance) + "px");
        node.style.setProperty("--mo-y", Math.round(Math.sin(angle) * distance) + "px");
        node.style.setProperty("--mo-r", Math.round(random(-220, 220)) + "deg");
      }
      node.classList.add("mo-reveal");
      observer.observe(node);
    });
  }

  // Once something has come in, hand it back to its normal styles (hover etc.).
  document.addEventListener("animationend", event => {
    const node = event.target;
    if (node.classList && node.classList.contains("mo-in") && event.animationName.indexOf("mo-reveal") === 0) {
      node.classList.remove("mo-reveal", "mo-in");
    }
  });

  // ---------- Extreme: rainbow title letters ----------

  function titleElement() {
    return document.querySelector("#hero h2") || document.querySelector("main h1");
  }

  function splitTitle() {
    const title = titleElement();
    if (!title || title.dataset.moText !== undefined || title.children.length) return;
    const text = title.textContent;
    title.dataset.moText = text;
    title.setAttribute("aria-label", text.trim());
    title.classList.add("mo-title");
    title.textContent = "";
    let i = 0;
    text.trim().split(/\s+/).forEach((word, w) => {
      if (w) title.appendChild(document.createTextNode(" "));
      const wordSpan = document.createElement("span");
      wordSpan.className = "mo-word";
      wordSpan.setAttribute("aria-hidden", "true");
      [...word].forEach(char => {
        const letter = document.createElement("span");
        letter.className = "mo-letter";
        letter.style.setProperty("--i", i++);
        letter.textContent = char;
        wordSpan.appendChild(letter);
      });
      title.appendChild(wordSpan);
    });
  }

  function unsplitTitle() {
    const title = document.querySelector(".mo-title");
    if (!title) return;
    title.textContent = title.dataset.moText;
    delete title.dataset.moText;
    title.removeAttribute("aria-label");
    title.classList.remove("mo-title");
  }

  // ---------- Extreme: cards tilt towards the cursor ----------

  const TILT = ".card-container .card, .person-card, .franchise-card, .platform-card, .experiment-card";
  let tilted = null;

  function untilt() {
    if (tilted) tilted.classList.remove("mo-tilting");
    tilted = null;
  }

  function onTilt(event) {
    const card = event.target.closest ? event.target.closest(TILT) : null;
    if (card !== tilted) untilt();
    if (!card) return;
    const box = card.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width;
    const py = (event.clientY - box.top) / box.height;
    card.style.setProperty("--tilt-x", ((0.5 - py) * 18).toFixed(2) + "deg");
    card.style.setProperty("--tilt-y", ((px - 0.5) * 22).toFixed(2) + "deg");
    card.style.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
    card.style.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
    card.classList.add("mo-tilting");
    tilted = card;
  }

  function onLeaveWindow(event) {
    if (!event.relatedTarget) untilt();
  }

  // ---------- Extreme: sparkles, bursts and confetti (one canvas) ----------

  const fx = { canvas: null, ctx: null, parts: [], raf: 0, lastSpawn: 0, hue: 0, dpr: 1 };

  function sizeCanvas() {
    if (!fx.canvas) return;
    fx.dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.canvas.width = Math.round(window.innerWidth * fx.dpr);
    fx.canvas.height = Math.round(window.innerHeight * fx.dpr);
    fx.ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  }

  function addParticle(part) {
    fx.parts.push(part);
    if (fx.parts.length > 600) fx.parts.splice(0, fx.parts.length - 600);
    if (!fx.raf) fx.raf = requestAnimationFrame(drawParticles);
  }

  function spark(x, y, speed, size) {
    const angle = random(0, Math.PI * 2);
    const v = random(speed * 0.3, speed);
    fx.hue = (fx.hue + 7) % 360;
    addParticle({
      kind: "spark", x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 0.6,
      gravity: 0.06, drag: 0.96, life: 1, decay: random(0.018, 0.032), size: random(size * 0.5, size),
      hue: fx.hue + random(-20, 20), rot: random(0, Math.PI), spin: random(-0.2, 0.2)
    });
  }

  function confettiBurst(origin) {
    if (!fx.canvas) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    if (origin) {
      const box = origin.getBoundingClientRect();
      x = box.left + box.width / 2;
      y = box.top + box.height / 2;
    }
    for (let i = 0; i < 170; i++) {
      const angle = random(-Math.PI * 0.95, -Math.PI * 0.05);
      const v = random(5, 15);
      addParticle({
        kind: i % 5 ? "confetti" : "spark", x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        gravity: 0.22, drag: 0.975, life: 1, decay: random(0.004, 0.008),
        size: random(6, 11), hue: random(0, 360), rot: random(0, Math.PI), spin: random(-0.3, 0.3)
      });
    }
  }

  function drawParticles() {
    const { ctx } = fx;
    if (!ctx) { fx.raf = 0; return; }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const dark = root.dataset.theme === "dark";
    fx.parts = fx.parts.filter(p => p.life > 0 && p.y < window.innerHeight + 40);
    fx.parts.forEach(p => {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.4));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.kind === "confetti") {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "hsl(" + p.hue + " 90% " + (dark ? 62 : 52) + "%)";
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else { // a four-pointed star
        ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
        ctx.fillStyle = "hsl(" + p.hue + " 100% " + (dark ? 70 : 55) + "%)";
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    fx.raf = fx.parts.length ? requestAnimationFrame(drawParticles) : 0;
    if (!fx.raf) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function onSparkleMove(event) {
    if (!finePointer.matches || event.pointerType !== "mouse") return;
    const now = performance.now();
    if (now - fx.lastSpawn < 16) return;
    fx.lastSpawn = now;
    spark(event.clientX, event.clientY, 2.2, 7);
    spark(event.clientX, event.clientY, 1.6, 5);
  }

  function onBurst(event) {
    for (let i = 0; i < 22; i++) spark(event.clientX, event.clientY, 7, 9);
  }

  function effectsOn() {
    if (fx.canvas) return;
    const canvas = document.createElement("canvas");
    canvas.className = "mo-sparkles";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    fx.canvas = canvas;
    fx.ctx = canvas.getContext("2d");
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    document.addEventListener("pointermove", onSparkleMove, { passive: true });
    document.addEventListener("pointerdown", onBurst, { passive: true });
    document.addEventListener("pointermove", onTilt, { passive: true });
    document.addEventListener("pointerout", onLeaveWindow, { passive: true });
  }

  function effectsOff() {
    if (!fx.canvas) return;
    window.removeEventListener("resize", sizeCanvas);
    document.removeEventListener("pointermove", onSparkleMove);
    document.removeEventListener("pointerdown", onBurst);
    document.removeEventListener("pointermove", onTilt);
    document.removeEventListener("pointerout", onLeaveWindow);
    untilt();
    cancelAnimationFrame(fx.raf);
    fx.raf = 0;
    fx.parts = [];
    fx.canvas.remove();
    fx.canvas = null;
    fx.ctx = null;
  }

  // ---------- Applying a level ----------

  function applyLevel() {
    startReveal();
    if (level() === "extreme") {
      splitTitle();
      effectsOn();
    } else {
      unsplitTitle();
      effectsOff();
    }
  }

  document.addEventListener("DOMContentLoaded", applyLevel);

  document.addEventListener("motionchange", event => {
    applyLevel();
    if (event.detail && event.detail.level === "extreme" && event.detail.previous !== "extreme") {
      confettiBurst(event.detail.origin);
    }
  });
})();
