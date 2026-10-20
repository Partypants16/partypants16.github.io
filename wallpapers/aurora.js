// Aurora: southern lights rippling over dark mountains, reflected in a still
// lake. The curtains drift with your mouse.

(function () {
  const { clamp, rgba, hex } = WP;

  // One vertical ray: bright at the bottom edge, fading up through teal to violet.
  function raySprite(colors) {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 256;
    const g = canvas.getContext("2d");
    const grad = g.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, rgba(colors[0], 0));
    grad.addColorStop(0.04, rgba(colors[0], 0.9));
    grad.addColorStop(0.25, rgba(colors[1], 0.55));
    grad.addColorStop(0.7, rgba(colors[2], 0.18));
    grad.addColorStop(1, rgba(colors[2], 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    return canvas;
  }

  const CURTAINS = [
    { y: 0.3, height: 0.26, speed: 0.05, colors: [hex("#7dffb2"), hex("#2fe0a8"), hex("#7a4bff")], seed: 1 },
    { y: 0.38, height: 0.2, speed: -0.035, colors: [hex("#b7ff8a"), hex("#33f0c0"), hex("#3e7bff")], seed: 2 },
    { y: 0.24, height: 0.3, speed: 0.025, colors: [hex("#ff7ad9"), hex("#8f6bff"), hex("#3a2a9a")], seed: 3, faint: 0.45 }
  ];

  function mountains(seed, base, rough) {
    const random = WP.rng(seed);
    const pts = [];
    let y = base;
    for (let i = 0; i <= 40; i++) {
      y = clamp(y + (random() - 0.5) * rough, base - rough * 2, base + rough * 2);
      pts.push([i / 40, y + (i % 3 === 0 ? -random() * rough : 0)]);
    }
    return pts;
  }

  const scene = {
    maxDpr: 1,
    scale: 0.75,
    stillTime: 20,
    setup(s) {
      s.stars = WP.makeStars(380, "aurora");
      s.rays = CURTAINS.map(c => raySprite(c.colors));
      s.far = mountains("aurora-far", 0.3, 0.035);
      s.near = mountains("aurora-near", 0.24, 0.05);
    },
    draw(s, t) {
      const { g, w, h } = s;
      const lake = h * 0.74;
      const sky = g.createLinearGradient(0, 0, 0, lake);
      sky.addColorStop(0, "#01030a");
      sky.addColorStop(0.6, "#041021");
      sky.addColorStop(1, "#0a1f33");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, lake);
      WP.drawStars(g, s.stars, w, lake, t, 0.9);

      // the curtains, drawn as many soft vertical rays
      g.globalCompositeOperation = "lighter";
      const step = 3;
      CURTAINS.forEach((c, ci) => {
        const sprite = s.rays[ci];
        const shift = -s.look.x * 30 * (1 + ci * 0.3);
        for (let x = -20; x < w + 20; x += step) {
          const u = x / w;
          const wave = Math.sin(u * 3.1 + t * c.speed * 6 + c.seed) * 0.05 +
            Math.sin(u * 7.3 - t * c.speed * 9 + c.seed * 2) * 0.025 +
            Math.sin(u * 13.7 + t * 0.3 + c.seed) * 0.008;
          const base = h * (c.y + wave);
          const pulse = 0.5 + 0.5 * Math.sin(u * 9 + t * 0.6 * (ci % 2 ? -1 : 1) + c.seed * 3);
          const fold = 0.5 + 0.5 * Math.sin(u * 23 + t * 0.9 + c.seed);
          const strength = clamp((0.25 + pulse * 0.75) * (0.55 + fold * 0.45) * (c.faint || 1), 0, 1);
          const tall = h * c.height * (0.55 + pulse * 0.6);
          g.globalAlpha = strength * 0.55;
          g.drawImage(sprite, x + shift, base - tall, step + 1.5, tall);
        }
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";

      // mountains
      [[s.far, "#07111c", 0.5], [s.near, "#03070d", 1]].forEach(([pts, fill, depth]) => {
        const ox = -s.look.x * 14 * depth;
        g.beginPath();
        g.moveTo(-20 + ox, lake);
        pts.forEach(([x, y]) => g.lineTo(-20 + x * (w + 40) + ox, lake - y * h * 0.6));
        g.lineTo(w + 20 + ox, lake);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
      });

      // the lake: the sky above, upside down and darker, with ripples
      g.save();
      g.globalAlpha = 0.42;
      const squash = (h - lake) / lake;
      g.translate(0, lake + lake * squash);
      g.scale(1, -squash);
      g.drawImage(s.canvas, 0, 0, s.canvas.width, lake * s.ratio, 0, 0, w, lake);
      g.restore();
      const water = g.createLinearGradient(0, lake, 0, h);
      water.addColorStop(0, "rgba(2, 8, 16, 0.35)");
      water.addColorStop(1, "rgba(1, 3, 8, 0.92)");
      g.fillStyle = water;
      g.fillRect(0, lake, w, h - lake);
      g.strokeStyle = "rgba(160, 255, 220, 0.06)";
      g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const y = lake + 4 + i * i * 0.45;
        if (y > h) break;
        const x = (Math.sin(i * 12.9 + t * 0.4) * 0.5 + 0.5) * w;
        g.beginPath();
        g.moveTo(x - 40 - i * 6, y);
        g.lineTo(x + 40 + i * 6, y);
        g.stroke();
      }
    }
  };

  WP.register({
    id: "aurora",
    name: "Aurora",
    group: "drawn",
    blurb: "Southern lights over the mountains, mirrored in a still lake.",
    quotes: "space",
    scene,
    mount(ctx) {
      ctx.canvas(scene);
    }
  });
})();
