// Night Drive: a synthwave road at night. A striped neon sun, mountains, a grid
// rushing under the car and street lights flying past. Move the mouse (or your
// finger) to steer; hold it down to boost.

(function () {
  const { lerp, clamp } = WP;

  function buildSun(r, ratio) {
    const size = Math.ceil(r * 2 * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    g.scale(ratio, ratio);
    const grad = g.createLinearGradient(0, 0, 0, r * 2);
    grad.addColorStop(0, "#ffc04d");
    grad.addColorStop(0.45, "#ff8a3d");
    grad.addColorStop(0.75, "#ff4f8b");
    grad.addColorStop(1, "#d62fb8");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(r, r, r, 0, Math.PI * 2);
    g.fill();
    return canvas;
  }

  function ridge(seed, count, height) {
    const random = WP.rng(seed);
    const pts = [];
    for (let i = 0; i <= count; i++) {
      const edge = Math.min(i, count - i) / (count / 2);
      pts.push([i / count, height * (0.25 + random() * 0.75) * (0.35 + 0.65 * Math.min(1, edge * 1.6))]);
    }
    return pts;
  }

  const scene = {
    maxDpr: 1.5,
    stillTime: 3,
    setup(s) {
      s.stars = WP.makeStars(180, "night-drive");
      s.back = ridge("drive-back", 22, 0.16);
      s.front = ridge("drive-front", 14, 0.1);
      s.travel = 0;
      s.speed = 1;
      s.stripe = 0;
    },
    resize(s) {
      s.horizon = s.h * 0.58;
      s.sunR = Math.min(s.w, s.h) * 0.23;
      s.sun = buildSun(s.sunR, s.ratio);
    },
    step(s, dt) {
      const boost = s.pointer.down ? 3.2 : 1;
      s.speed = lerp(s.speed, boost, Math.min(1, dt * 1.5));
      s.travel += s.speed * dt * 6;
      s.stripe = (s.stripe + dt * 0.04) % 1;
    },
    draw(s, t) {
      const { g, w, h } = s;
      const horizon = s.horizon;
      const steer = s.look.x;
      const vx = w / 2 - steer * w * 0.12;

      // sky
      const sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#090322");
      sky.addColorStop(0.55, "#2a0b4f");
      sky.addColorStop(0.88, "#7a1a6e");
      sky.addColorStop(1, "#ff3d8b");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, horizon + 1);
      WP.drawStars(g, s.stars, w, horizon, t, 0.9, 0.8);

      // the sun, cut into bands that slide down
      const sunX = w / 2 - steer * w * 0.03;
      const sunY = horizon - s.sunR * 0.42;
      g.save();
      g.beginPath();
      g.rect(0, 0, w, horizon);
      const top = sunY;
      for (let i = 0; i < 9; i++) {
        const f = (i + s.stripe) / 9;
        const y = top + f * s.sunR;
        const gap = 1 + f * f * s.sunR * 0.09;
        g.rect(sunX - s.sunR, y, s.sunR * 2, gap);
      }
      g.clip("evenodd");
      g.shadowColor = "rgba(255, 90, 160, 0.8)";
      g.shadowBlur = s.sunR * 0.4;
      g.drawImage(s.sun, sunX - s.sunR, sunY - s.sunR, s.sunR * 2, s.sunR * 2);
      g.restore();

      // mountains, back then front, each with a glowing ridge line
      [[s.back, "#2b0d4d", "rgba(255, 70, 200, 0.9)", 0.04], [s.front, "#150630", "rgba(60, 220, 255, 0.85)", 0.08]].forEach(([pts, fill, line, par]) => {
        const ox = -steer * w * par;
        g.beginPath();
        g.moveTo(-w * 0.1 + ox, horizon);
        pts.forEach(([x, y]) => g.lineTo(-w * 0.1 + x * w * 1.2 + ox, horizon - y * h));
        g.lineTo(w * 1.1 + ox, horizon);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
        g.strokeStyle = line;
        g.lineWidth = 1.6;
        g.beginPath();
        pts.forEach(([x, y], i) => {
          const px = -w * 0.1 + x * w * 1.2 + ox;
          if (i) g.lineTo(px, horizon - y * h); else g.moveTo(px, horizon - y * h);
        });
        g.stroke();
      });

      // the ground
      const ground = g.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, "#1a0533");
      ground.addColorStop(1, "#05010d");
      g.fillStyle = ground;
      g.fillRect(0, horizon, w, h - horizon);

      // perspective: a point on the ground at depth z sits at y = horizon + f / z
      const f = (h - horizon) * 0.9;
      const depthToY = z => horizon + f / z;
      const xAt = (X, z) => vx + (X * f * 1.6) / z;

      // grid: lines across that rush towards you, lines along that meet at the horizon
      g.lineWidth = 1.2;
      const offset = s.travel % 1;
      for (let k = 0; k < 40; k++) {
        const z = 0.6 + k - offset;
        if (z <= 0.3) continue;
        const y = depthToY(z);
        if (y > h) continue;
        const fade = clamp(1 - z / 40, 0, 1);
        g.strokeStyle = "rgba(255, 60, 210, " + (0.12 + fade * 0.55).toFixed(3) + ")";
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let X = -16; X <= 16; X++) {
        if (Math.abs(X) < 2) continue;
        g.strokeStyle = "rgba(255, 60, 210, 0.45)";
        g.beginPath();
        g.moveTo(vx, horizon);
        g.lineTo(xAt(X, 0.35), depthToY(0.35));
        g.stroke();
      }

      // the road: dark tarmac, cyan edges, dashes down the middle
      g.fillStyle = "rgba(8, 2, 18, 0.92)";
      g.beginPath();
      g.moveTo(vx, horizon);
      g.lineTo(xAt(-1.7, 0.35), depthToY(0.35));
      g.lineTo(xAt(1.7, 0.35), depthToY(0.35));
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(70, 230, 255, 0.95)";
      g.lineWidth = 2.5;
      g.shadowColor = "rgba(70, 230, 255, 0.9)";
      g.shadowBlur = 12;
      [-1.7, 1.7].forEach(X => {
        g.beginPath();
        g.moveTo(vx, horizon);
        g.lineTo(xAt(X, 0.35), depthToY(0.35));
        g.stroke();
      });
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255, 240, 180, 0.9)";
      const dashOffset = (s.travel * 0.5) % 1;
      for (let k = 0; k < 24; k++) {
        const z1 = 0.5 + k * 1 - dashOffset;
        const z2 = z1 + 0.45;
        if (z1 <= 0.35) continue;
        const y1 = depthToY(z1);
        const y2 = depthToY(z2);
        const half1 = (0.06 * f * 1.6) / z1;
        const half2 = (0.06 * f * 1.6) / z2;
        g.beginPath();
        g.moveTo(xAt(0, z1) - half1, y1);
        g.lineTo(xAt(0, z1) + half1, y1);
        g.lineTo(xAt(0, z2) + half2, y2);
        g.lineTo(xAt(0, z2) - half2, y2);
        g.closePath();
        g.fill();
      }

      // street lights flying past on both sides
      const postOffset = (s.travel * 0.25) % 1;
      for (let k = 0; k < 14; k++) {
        const z = 0.5 + k * 2.2 - postOffset * 2.2;
        if (z <= 0.45) continue;
        [-2.6, 2.6].forEach(X => {
          const x = xAt(X, z);
          const y = depthToY(z);
          if (x < -200 || x > w + 200) return;
          const tall = (0.9 * f) / z;
          const near = clamp(2.4 / z, 0, 1);
          const arm = x - Math.sign(X) * tall * 0.22;
          g.lineCap = "round";
          [[Math.max(3, 14 / z), 0.18], [Math.max(1.2, 4 / z), 0.9]].forEach(([width, alpha]) => {
            g.strokeStyle = "rgba(255, 90, 220, " + (alpha * (0.35 + near * 0.65)).toFixed(3) + ")";
            g.lineWidth = width;
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x, y - tall);
            g.lineTo(arm, y - tall);
            g.stroke();
          });
          const r = Math.max(6, 110 / z);
          const glow = g.createRadialGradient(arm, y - tall, 0, arm, y - tall, r);
          glow.addColorStop(0, "rgba(255, 235, 190, " + (0.55 + near * 0.45).toFixed(3) + ")");
          glow.addColorStop(0.3, "rgba(255, 150, 90, " + (0.25 * near + 0.1).toFixed(3) + ")");
          glow.addColorStop(1, "rgba(255, 120, 80, 0)");
          g.fillStyle = glow;
          g.beginPath();
          g.arc(arm, y - tall, r, 0, Math.PI * 2);
          g.fill();
        });
      }

      // speed lines when boosting
      const rush = clamp((s.speed - 1.2) / 2, 0, 1);
      if (rush > 0.02) {
        g.strokeStyle = "rgba(255, 255, 255, " + (0.25 * rush).toFixed(3) + ")";
        g.lineWidth = 1.5;
        const random = WP.rng(Math.floor(t * 20));
        for (let i = 0; i < 30; i++) {
          const a = random() * Math.PI * 2;
          const r0 = Math.min(w, h) * (0.35 + random() * 0.3);
          const r1 = r0 + 80 + random() * 160;
          g.beginPath();
          g.moveTo(vx + Math.cos(a) * r0, horizon + Math.sin(a) * r0 * 0.6);
          g.lineTo(vx + Math.cos(a) * r1, horizon + Math.sin(a) * r1 * 0.6);
          g.stroke();
        }
      }

      // a little haze on the horizon
      const haze = g.createLinearGradient(0, horizon - 30, 0, horizon + 40);
      haze.addColorStop(0, "rgba(255, 61, 139, 0)");
      haze.addColorStop(0.5, "rgba(255, 61, 139, 0.35)");
      haze.addColorStop(1, "rgba(255, 61, 139, 0)");
      g.fillStyle = haze;
      g.fillRect(0, horizon - 30, w, 70);
    }
  };

  WP.register({
    id: "night-drive",
    name: "Night Drive",
    group: "drawn",
    blurb: "A neon synthwave road. Steer with your mouse, hold it down to boost.",
    quotes: "racing",
    scene,
    mount(ctx) {
      ctx.canvas(scene);
    }
  });
})();
