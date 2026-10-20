// Rain on Glass: a misted-up window at night with city lights blurred behind
// it. Drops gather, slide down and leave clear trails; the mist slowly comes
// back. Drag your mouse (or finger) across to wipe the glass.

(function () {
  const { clamp, rgba, hex } = WP;
  const LIGHTS = [hex("#ffb347"), hex("#ff6b4a"), hex("#ffd98a"), hex("#ff3355"), hex("#7fd3ff"), hex("#f4f0e8"), hex("#c38bff")];

  // The blurry city behind the glass, drawn once per size.
  function buildBokeh(s) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(s.w * s.ratio);
    canvas.height = Math.ceil(s.h * s.ratio);
    const g = canvas.getContext("2d");
    g.scale(s.ratio, s.ratio);
    const bg = g.createLinearGradient(0, 0, 0, s.h);
    bg.addColorStop(0, "#070a16");
    bg.addColorStop(0.6, "#121426");
    bg.addColorStop(1, "#1d1420");
    g.fillStyle = bg;
    g.fillRect(0, 0, s.w, s.h);
    const random = WP.rng("bokeh");
    const count = Math.round(70 * (s.w * s.h) / (1280 * 720));
    for (let i = 0; i < count; i++) {
      const color = LIGHTS[Math.floor(random() * LIGHTS.length)];
      const x = random() * s.w;
      const y = s.h * (0.35 + random() * 0.6);
      const r = 18 + random() * random() * 90;
      const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      grad.addColorStop(0, rgba(color, 0.32));
      grad.addColorStop(0.75, rgba(color, 0.22));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return canvas;
  }

  // A water drop: light refracted from below, a dark rim, a bright glint.
  function dropSprite() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    const c = size / 2;
    // lit from below like a little lens, with a faint dark edge
    const body = g.createRadialGradient(c, c + 8, 2, c, c, c - 2);
    body.addColorStop(0, "rgba(255, 245, 230, 0.32)");
    body.addColorStop(0.6, "rgba(220, 228, 245, 0.16)");
    body.addColorStop(0.86, "rgba(240, 244, 255, 0.34)");
    body.addColorStop(0.95, "rgba(10, 14, 24, 0.22)");
    body.addColorStop(1, "rgba(10, 14, 24, 0)");
    g.fillStyle = body;
    g.beginPath();
    g.arc(c, c, c - 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.85)";
    g.beginPath();
    g.ellipse(c - c * 0.32, c - c * 0.38, c * 0.16, c * 0.1, -0.6, 0, Math.PI * 2);
    g.fill();
    return canvas;
  }

  // a soft round brush for clearing the mist
  function brushSprite() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const g = canvas.getContext("2d");
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.8)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return canvas;
  }

  function newDrop(s, random) {
    return {
      x: random() * s.w,
      y: random() * s.h,
      r: 4 + random() * 7,
      vy: 0,
      wait: random() * 8,
      wobble: random() * 6.28
    };
  }

  const scene = {
    maxDpr: 1.5,
    warm: 6,
    stillTime: 6,
    setup(s) {
      s.drop = dropSprite();
      s.brush = brushSprite();
      s.random = Math.random;
    },
    resize(s) {
      s.bokeh = buildBokeh(s);
      s.fog = document.createElement("canvas");
      s.fog.width = Math.ceil(s.w / 2);
      s.fog.height = Math.ceil(s.h / 2);
      s.fogG = s.fog.getContext("2d");
      s.fogG.fillStyle = "#fff";
      s.fogG.fillRect(0, 0, s.fog.width, s.fog.height);
      const area = (s.w * s.h) / (1280 * 720);
      s.tiny = Array.from({ length: Math.round(520 * area) }, () => ({ x: Math.random() * s.w, y: Math.random() * s.h, r: 0.8 + Math.random() * 2.2 }));
      s.drops = Array.from({ length: Math.round(42 * area) }, () => newDrop(s, Math.random));
      s.lastWipe = null;
    },
    step(s, dt) {
      const fog = s.fogG;
      // the mist comes back slowly
      fog.globalCompositeOperation = "source-over";
      fog.fillStyle = "rgba(255, 255, 255, " + (dt * 0.22).toFixed(4) + ")";
      fog.fillRect(0, 0, s.fog.width, s.fog.height);
      fog.globalCompositeOperation = "destination-out";
      fog.fillStyle = "#000";

      s.drops.forEach((d, i) => {
        if (d.wait > 0) {
          d.wait -= dt;
          return;
        }
        d.vy = Math.min(d.vy + dt * (40 + d.r * 18), 120 + d.r * 30);
        d.y += d.vy * dt;
        d.x += Math.sin(d.y * 0.05 + d.wobble) * 0.4;
        const br = d.r * 0.34;
        fog.drawImage(s.brush, d.x / 2 - br, d.y / 2 - br, br * 2, br * 2);
        // leave a few little beads behind
        if (Math.random() < dt * 6 && s.tiny.length < 1400) s.tiny.push({ x: d.x + (Math.random() - 0.5) * d.r, y: d.y - d.r, r: 0.6 + Math.random() * 1.2 });
        if (d.y > s.h + 20) s.drops[i] = Object.assign(newDrop(s, Math.random), { y: -10 - Math.random() * s.h * 0.4, wait: Math.random() * 3 });
      });
      // beads in a drop's way get swept up
      if (s.tiny.length > 900) s.tiny.splice(0, s.tiny.length - 900);

      // wiping with the mouse or a finger
      const p = s.pointer;
      if (p.down && !s.thumb) {
        const here = [p.x / 2, p.y / 2];
        const from = s.lastWipe || here;
        const steps = Math.max(1, Math.ceil(Math.hypot(here[0] - from[0], here[1] - from[1]) / 4));
        for (let k = 0; k <= steps; k++) {
          const x = from[0] + (here[0] - from[0]) * (k / steps);
          const y = from[1] + (here[1] - from[1]) * (k / steps);
          fog.drawImage(s.brush, x - 22, y - 22, 44, 44);
        }
        s.tiny = s.tiny.filter(b => Math.hypot(b.x - p.x, b.y - p.y) > 34);
        s.lastWipe = here;
      } else {
        s.lastWipe = null;
      }
      fog.globalCompositeOperation = "source-over";
    },
    draw(s, t) {
      const { g, w, h } = s;
      // the city behind, slowly breathing
      const sway = Math.sin(t * 0.05) * 10;
      g.drawImage(s.bokeh, sway - 10, 0, w + 20, h);
      // mist on the glass
      g.save();
      g.globalAlpha = 0.2;
      g.imageSmoothingEnabled = true;
      g.drawImage(s.fog, 0, 0, w, h);
      g.restore();
      // tiny beads, then the big drops
      g.globalAlpha = 0.8;
      s.tiny.forEach(b => g.drawImage(s.drop, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2));
      g.globalAlpha = 1;
      s.drops.forEach(d => {
        const stretch = clamp(d.vy / 200, 0, 0.6);
        g.drawImage(s.drop, d.x - d.r, d.y - d.r * (1 + stretch), d.r * 2, d.r * 2 * (1 + stretch));
      });
    }
  };

  WP.register({
    id: "rain-glass",
    name: "Rain on Glass",
    group: "drawn",
    blurb: "A misted window on a rainy night. Drag across it to wipe the glass.",
    quotes: "general",
    scene,
    mount(ctx) {
      ctx.canvas(scene);
    }
  });
})();
