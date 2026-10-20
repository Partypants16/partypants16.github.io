// Starfield: cruising through space. Steer with the mouse; hold it down (or
// the space bar) to jump to warp speed.

(function () {
  const { lerp, clamp } = WP;
  const COUNT = 1300;

  function reset(star, random, far) {
    star.x = (random() * 2 - 1) * 1.2;
    star.y = (random() * 2 - 1) * 1.2;
    star.z = far ? 1 : 0.05 + random() * 0.95;
    star.tint = random();
    star.px = null;
    star.py = null;
  }

  const scene = {
    maxDpr: 1.5,
    warm: 1,
    stillTime: 3,
    setup(s) {
      const random = WP.rng("stars");
      s.stars = Array.from({ length: COUNT }, () => {
        const star = {};
        reset(star, random, false);
        return star;
      });
      s.speed = 0.06;
      s.backdrop = WP.makeStars(420, "starfield-backdrop");
      s.space = false;
      s.nebula = [
        { x: 0.25, y: 0.3, r: 0.6, color: "rgba(120, 60, 200, 0.16)" },
        { x: 0.75, y: 0.7, r: 0.55, color: "rgba(40, 110, 220, 0.14)" },
        { x: 0.6, y: 0.2, r: 0.4, color: "rgba(220, 70, 150, 0.08)" }
      ];
    },
    step(s, dt) {
      const warp = s.pointer.down || s.space || s.thumb; // the picker shows it at warp speed
      s.speed = lerp(s.speed, warp ? 1.4 : 0.06, Math.min(1, dt * (warp ? 1.2 : 2)));
      s.stars.forEach(star => {
        star.z -= s.speed * dt;
        if (star.z <= 0.02) reset(star, Math.random, true);
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      const warp = clamp((s.speed - 0.1) / 1.2, 0, 1);
      g.fillStyle = "rgb(" + Math.round(2 + warp * 4) + "," + Math.round(3 + warp * 6) + "," + Math.round(10 + warp * 22) + ")";
      g.fillRect(0, 0, w, h);
      s.nebula.forEach((n, i) => {
        const cx = n.x * w + Math.sin(t * 0.02 + i) * 30 - s.look.x * 20;
        const cy = n.y * h + Math.cos(t * 0.03 + i) * 20 - s.look.y * 12;
        const r = Math.max(w, h) * n.r;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, n.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      });

      WP.drawStars(g, s.backdrop, w, h, t, 0.75 * (1 - warp));
      const cx = w / 2 - s.look.x * w * 0.18;
      const cy = h / 2 - s.look.y * h * 0.18;
      const f = Math.max(w, h) * 0.5;
      g.lineCap = "round";
      s.stars.forEach(star => {
        const sx = cx + (star.x / star.z) * f;
        const sy = cy + (star.y / star.z) * f;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) {
          reset(star, Math.random, true);
          return;
        }
        const near = 1 - star.z;
        const size = 0.7 + near * near * 2.6;
        const alpha = clamp(0.3 + near * 1.1, 0.3, 1);
        const color = star.tint < 0.15 ? "255, 210, 170" : star.tint < 0.3 ? "170, 200, 255" : "255, 255, 255";
        // streaks from where the star was a moment ago
        const back = star.z + s.speed * 0.06 * (1 + warp * 3);
        const bx = cx + (star.x / back) * f;
        const by = cy + (star.y / back) * f;
        g.strokeStyle = "rgba(" + color + ", " + alpha.toFixed(3) + ")";
        g.lineWidth = size;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(sx + 0.01, sy);
        g.stroke();
      });

      if (warp > 0.05) {
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
        glow.addColorStop(0, "rgba(160, 200, 255, " + (0.22 * warp).toFixed(3) + ")");
        glow.addColorStop(1, "rgba(160, 200, 255, 0)");
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
      }
    }
  };

  WP.register({
    id: "starfield",
    name: "Starfield",
    group: "drawn",
    blurb: "Cruising through space. Hold the mouse down (or Space) to warp.",
    quotes: "space",
    scene,
    mount(ctx) {
      const view = ctx.canvas(scene);
      const typing = event => event.target.closest && event.target.closest("input, textarea, select, button, a");
      ctx.on(window, "keydown", event => {
        if (event.code === "Space" && !typing(event)) {
          view.s.space = true;
          event.preventDefault();
        }
      });
      ctx.on(window, "keyup", event => { if (event.code === "Space") view.s.space = false; });
      ctx.on(window, "blur", () => { view.s.space = false; });
    }
  });
})();
