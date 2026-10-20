// Day & Night: hills under a sky that follows the real sun over Melbourne.
// Dawn, golden hour, blue hour, night with the real moon phase and stars. The
// sun is worked out on the spot (no data needed), so it works offline too.
//
// Try a time with ?w=day-night&time=19:40 (Melbourne time), or watch a whole
// day go by with &speed=600 (600 times faster).

(function () {
  const { mix, rgba, hex, clamp, lerp, smoothstep } = WP;
  const PLACE = WP.MELBOURNE;

  // [altitude, top, middle, horizon]
  const SKY = [
    [-18, "#04050e", "#0a0e22", "#151c3a"],
    [-12, "#060a24", "#10173d", "#202858"],
    [-6, "#0e1944", "#25397a", "#5b5a9c"],
    [-3, "#19295f", "#4a579e", "#e2897a"],
    [0, "#2b4588", "#7c86c0", "#ffad78"],
    [4, "#3b6bb6", "#9ab7df", "#ffd3a2"],
    [10, "#3e7ece", "#8dbfeb", "#d3e8f8"],
    [30, "#2b6fd6", "#6daeee", "#c0e0fa"]
  ].map(([alt, a, b, c]) => [alt, hex(a), hex(b), hex(c)]);

  function sky(alt) {
    if (alt <= SKY[0][0]) return SKY[0].slice(1);
    for (let i = 1; i < SKY.length; i++) {
      if (alt <= SKY[i][0]) {
        const t = (alt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
        return [1, 2, 3].map(k => mix(SKY[i - 1][k], SKY[i][k], t));
      }
    }
    return SKY[SKY.length - 1].slice(1);
  }

  // Hills, far to near: [base height (share of screen), roughness, day colour, night colour]
  const HILLS = [
    [0.36, 0.05, hex("#8fb3b8"), hex("#0b1022")],
    [0.30, 0.06, hex("#5f8f84"), hex("#070a18")],
    [0.23, 0.05, hex("#3c6b4c"), hex("#04060f")],
    [0.14, 0.04, hex("#24452c"), hex("#020307")]
  ];

  function phaseName(alt, rising) {
    if (alt < -18) return "Night";
    if (alt < -6) return rising ? "First light" : "Last light";
    if (alt < -4) return "Blue hour";
    if (alt < 6) return "Golden hour";
    return "Daytime";
  }

  // The moment the scene shows: now, or ?time= / ?speed= for trying it out.
  const startedAt = Date.now();
  function sceneTime() {
    const asked = WP.params.get("time");
    const speed = +WP.params.get("speed") || 1;
    let base = Date.now();
    if (asked && /^\d{1,2}:\d{2}$/.test(asked)) {
      const [hh, mm] = asked.split(":").map(Number);
      base = WP.zonedMidnight(new Date(), PLACE.tz).getTime() + (hh * 60 + mm) * 60000;
      return new Date(base + (Date.now() - startedAt) * speed);
    }
    return new Date(startedAt + (Date.now() - startedAt) * speed);
  }

  function buildHills(s) {
    s.hills = HILLS.map((spec, i) => {
      const random = WP.rng("hill-" + i);
      const waves = [];
      for (let k = 0; k < 4; k++) waves.push({ f: (0.6 + random() * 2.4) * (k + 1), p: random() * 6.28, a: spec[1] * (1 / (k + 1)) * (0.6 + random() * 0.8) });
      const W = s.w + 60;
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(W * s.ratio);
      canvas.height = Math.ceil(s.h * s.ratio);
      const g = canvas.getContext("2d");
      g.scale(s.ratio, s.ratio);
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(0, s.h);
      for (let x = 0; x <= W; x += 6) {
        let y = spec[0];
        waves.forEach(wave => { y += wave.a * Math.sin((x / W) * wave.f * Math.PI + wave.p); });
        g.lineTo(x, s.h - y * s.h);
      }
      g.lineTo(W, s.h);
      g.closePath();
      g.fill();
      // little trees along the nearest ridge
      if (i === HILLS.length - 1) {
        for (let x = 10; x < W; x += 14 + random() * 30) {
          let y = spec[0];
          waves.forEach(wave => { y += wave.a * Math.sin((x / W) * wave.f * Math.PI + wave.p); });
          const top = s.h - y * s.h;
          const size = 10 + random() * 16;
          g.beginPath();
          g.moveTo(x - size * 0.35, top + 4);
          g.lineTo(x, top - size);
          g.lineTo(x + size * 0.35, top + 4);
          g.fill();
        }
      }
      // where house lights can sit at night
      const lights = [];
      if (i >= 1) {
        for (let n = 0; n < 6 + i * 4; n++) {
          const x = random() * W;
          let y = spec[0];
          waves.forEach(wave => { y += wave.a * Math.sin((x / W) * wave.f * Math.PI + wave.p); });
          lights.push({ x, y: s.h - y * s.h + 6 + random() * s.h * 0.05, on: random() });
        }
      }
      return { mask: canvas, tinted: null, key: "", depth: (i + 1) / HILLS.length, lights };
    });
  }

  function tint(layer, color) {
    const key = color.map(Math.round).join(",");
    if (layer.key === key) return layer.tinted;
    if (!layer.tinted) {
      layer.tinted = document.createElement("canvas");
      layer.tinted.width = layer.mask.width;
      layer.tinted.height = layer.mask.height;
    }
    const g = layer.tinted.getContext("2d");
    g.globalCompositeOperation = "copy";
    g.drawImage(layer.mask, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = rgba(color);
    g.fillRect(0, 0, layer.tinted.width, layer.tinted.height);
    layer.key = key;
    return layer.tinted;
  }

  const scene = {
    maxDpr: 1.5,
    setup(s) {
      s.stars = WP.makeStars(320, "day-night-stars");
      s.birds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.25 + Math.random() * 0.2, speed: 0.008 + Math.random() * 0.01, phase: Math.random() * 6, size: 5 + Math.random() * 4, i }));
      s.lastTimes = null;
    },
    resize(s) {
      buildHills(s);
    },
    step(s, dt) {
      s.birds.forEach(bird => {
        bird.x += bird.speed * dt;
        if (bird.x > 1.1) bird.x = -0.1;
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      const now = s.data.now ? new Date(s.data.now) : sceneTime();
      const sun = WP.sunPosition(now, PLACE.lat, PLACE.lon);
      const alt = sun.altitude;
      const dayKey = WP.zonedMidnight(now, PLACE.tz).getTime();
      if (!s.lastTimes || s.lastTimes.key !== dayKey) s.lastTimes = Object.assign({ key: dayKey }, WP.sunTimes(now, PLACE));
      const times = s.lastTimes;
      const [top, middle, horizon] = sky(alt);
      const horizonY = h * 0.66;

      const gradient = g.createLinearGradient(0, 0, 0, horizonY);
      gradient.addColorStop(0, rgba(top));
      gradient.addColorStop(0.55, rgba(middle));
      gradient.addColorStop(1, rgba(horizon));
      g.fillStyle = gradient;
      g.fillRect(0, 0, w, h);

      const night = 1 - smoothstep(-14, -4, alt);
      WP.drawStars(g, s.stars, w, h, t, night, 0.72);

      // Where the sun is along today's arc
      const rise = times.rise ? times.rise.getTime() : times.start.getTime() + 6 * 3600000;
      const set = times.set ? times.set.getTime() : times.start.getTime() + 18 * 3600000;
      const noonAlt = WP.sunPosition(times.noon, PLACE.lat, PLACE.lon).altitude;
      const f = (now.getTime() - rise) / (set - rise);
      const sunX = lerp(w * 0.08, w * 0.92, clamp(f, -0.1, 1.1)) - s.look.x * 12;
      const sunHorizon = h * 0.6;
      const sunY = sunHorizon - (alt / Math.max(10, noonAlt)) * (sunHorizon - h * 0.12);

      // glow along the horizon around sunrise and sunset
      const twilight = Math.exp(-Math.pow((alt + 2) / 7, 2));
      if (twilight > 0.02) {
        const glowX = clamp(sunX, w * 0.05, w * 0.95);
        const glow = g.createRadialGradient(glowX, horizonY, 0, glowX, horizonY, w * 0.6);
        glow.addColorStop(0, rgba([255, 160, 90], 0.55 * twilight));
        glow.addColorStop(0.4, rgba([255, 120, 110], 0.18 * twilight));
        glow.addColorStop(1, "rgba(255,120,110,0)");
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
      }

      if (alt > -2) {
        const r = Math.min(w, h) * 0.04;
        const warm = smoothstep(12, -1, alt);
        const disc = mix([255, 252, 240], [255, 170, 95], warm);
        // light, not paint: the halo brightens the sky around it
        g.globalCompositeOperation = "lighter";
        const halo = g.createRadialGradient(sunX, sunY, r * 0.8, sunX, sunY, r * 9);
        halo.addColorStop(0, rgba(disc, 0.55));
        halo.addColorStop(0.25, rgba(disc, 0.18));
        halo.addColorStop(1, rgba(disc, 0));
        g.fillStyle = halo;
        g.fillRect(sunX - r * 9, sunY - r * 9, r * 18, r * 18);
        g.globalCompositeOperation = "source-over";
        g.shadowColor = rgba(disc, 0.9);
        g.shadowBlur = r * 1.5;
        g.fillStyle = rgba(mix(disc, [255, 255, 255], 0.5));
        g.beginPath();
        g.arc(sunX, sunY, r, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      }

      // The moon: crosses the sky through the night
      if (night > 0.05) {
        const nextRise = rise + (f > 1 ? 86400000 : 0);
        const lastSet = set - (f < 0 ? 86400000 : 0);
        const nf = clamp((now.getTime() - lastSet) / (nextRise - lastSet), 0, 1);
        const mx = lerp(w * 0.1, w * 0.9, nf) - s.look.x * 8;
        const my = horizonY - Math.sin(nf * Math.PI) * (horizonY - h * 0.14);
        g.globalAlpha = night;
        WP.drawMoon(g, mx, my, Math.min(w, h) * 0.032, WP.moonPhase(now), true);
        g.globalAlpha = 1;
      }

      // hills: far ones take on the sky's colour, all of them darken at night
      const light = smoothstep(-8, 8, alt);
      const golden = Math.exp(-Math.pow((alt - 3) / 6, 2));
      s.hills.forEach((layer, i) => {
        const spec = HILLS[i];
        let color = mix(spec[3], spec[2], light);
        color = mix(color, [200, 120, 90], golden * 0.25 * (1 - layer.depth * 0.5));
        color = mix(color, horizon, (1 - layer.depth) * 0.45 * (0.4 + light * 0.6));
        const shift = -s.look.x * 28 * layer.depth - 30;
        g.drawImage(tint(layer, color), shift, 0, w + 60, h);
        if (night > 0.2 && layer.lights.length) {
          layer.lights.forEach((spot, k) => {
            const on = (Math.sin(t * 0.05 + spot.on * 40) > -0.3) && spot.on > 0.25;
            if (!on) return;
            g.fillStyle = "rgba(255, 200, 120, " + (night * 0.25).toFixed(3) + ")";
            g.beginPath();
            g.arc(spot.x + shift, spot.y, 5, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = "rgba(255, 220, 160, " + (night * 0.95).toFixed(3) + ")";
            g.fillRect(spot.x + shift - 1.4, spot.y - 1.4, 2.8, 2.8);
          });
        }
      });

      // birds around sunrise and sunset
      if (golden > 0.3 && !s.thumb) {
        g.strokeStyle = "rgba(20, 20, 30, " + (golden * 0.7).toFixed(3) + ")";
        g.lineWidth = 1.6;
        s.birds.forEach(bird => {
          const bx = bird.x * w;
          const by = bird.y * h + Math.sin(t * 0.7 + bird.phase) * 6;
          const flap = Math.sin(t * 7 + bird.phase) * bird.size * 0.5;
          g.beginPath();
          g.moveTo(bx - bird.size, by - flap);
          g.quadraticCurveTo(bx - bird.size * 0.4, by - flap * 0.2, bx, by);
          g.quadraticCurveTo(bx + bird.size * 0.4, by - flap * 0.2, bx + bird.size, by - flap);
          g.stroke();
        });
      }

      s.phase = { alt, rising: WP.sunPosition(new Date(now.getTime() + 600000), PLACE.lat, PLACE.lon).altitude > alt, times, now };
    }
  };

  WP.register({
    id: "day-night",
    name: "Day & Night",
    group: "live",
    blurb: "Hills under Melbourne's real sky: sunrise, golden hour, the moon and stars.",
    quotes: "general",
    scene,
    mount(ctx) {
      const view = ctx.canvas(scene);
      const zone = { timeZone: PLACE.tz };
      const simulated = WP.params.get("time") || WP.params.get("speed");

      function render() {
        if (ctx.still) view.redraw();
        const info = view.s.phase;
        if (!info) return;
        const { alt, rising, times, now } = info;
        const next = WP.sunCrossings(now, new Date(now.getTime() + 36 * 3600000), PLACE, -0.833)[0];
        const bits = [PLACE.name];
        if (times.rise) bits.push("Sunrise " + WP.fmtTime(times.rise, zone));
        if (times.set) bits.push("Sunset " + WP.fmtTime(times.set, zone));
        const sub = next
          ? (next.rising ? "Sunrise" : "Sunset") + " in " + WP.span(next.at - now)
          : "";
        ctx.info(
          WP.el("p", "wp-big", phaseName(alt, rising)),
          WP.el("p", "wp-line", bits.join("  ·  ")),
          WP.el("p", "wp-sub", sub + (simulated ? "  ·  Showing " + WP.fmtTime(now, zone) + " (from the address)" : "") + "  ·  Moon " + moonName(WP.moonPhase(now)))
        );
      }
      // the scene works out the sun on its first frame
      ctx.after(60, render);
      ctx.every(simulated ? 1000 : 30000, render, false);
    }
  });

  function moonName(phase) {
    const names = ["new", "waxing crescent", "first quarter", "waxing gibbous", "full", "waning gibbous", "last quarter", "waning crescent"];
    return names[Math.round(phase * 8) % 8];
  }
})();
