// Melbourne Weather: the sky over a city skyline follows the real weather in
// Melbourne right now. Rain, drizzle, fog, snow, storms (with lightning), cloud
// cover and wind all show; the sky colour follows the sun, so dusk looks like dusk.
//
// Data: Open-Meteo (free, no key, allows browser requests), every 15 minutes.
// Try any weather with ?wx=<WMO code>, e.g. ?w=weather&wx=95 for a thunderstorm,
// and &wxday=0 or 1 to force night or day.

(function () {
  const { clamp, mix, rgba, hex, smoothstep } = WP;
  const PLACE = WP.MELBOURNE;
  const URL = "https://api.open-meteo.com/v1/forecast?latitude=" + PLACE.lat + "&longitude=" + PLACE.lon +
    "&current=temperature_2m,apparent_temperature,weather_code,is_day,cloud_cover,precipitation,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min&timezone=" + encodeURIComponent(PLACE.tz) + "&forecast_days=1";

  const LABELS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers", 85: "Light snow showers", 86: "Snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
  };

  // What a WMO weather code looks like: cloud amount 0..1, rain/snow 0..1, fog, lightning.
  function look(code) {
    const c = { clouds: 0.35, rain: 0, snow: 0, fog: 0, storm: 0 };
    if (code === 0) c.clouds = 0;
    else if (code === 1) c.clouds = 0.15;
    else if (code === 2) c.clouds = 0.45;
    else if (code === 3) c.clouds = 0.92;
    else if (code === 45 || code === 48) Object.assign(c, { clouds: 0.7, fog: 1 });
    else if (code >= 51 && code <= 57) Object.assign(c, { clouds: 0.85, rain: code >= 55 ? 0.45 : code >= 53 ? 0.32 : 0.22 });
    else if (code >= 61 && code <= 67) Object.assign(c, { clouds: 0.95, rain: code >= 65 ? 1 : code >= 63 ? 0.72 : 0.48 });
    else if (code >= 71 && code <= 77) Object.assign(c, { clouds: 0.9, snow: code === 75 ? 1 : code === 73 ? 0.7 : 0.4 });
    else if (code >= 80 && code <= 82) Object.assign(c, { clouds: 0.8, rain: code === 82 ? 1 : code === 81 ? 0.7 : 0.45 });
    else if (code === 85 || code === 86) Object.assign(c, { clouds: 0.85, snow: code === 86 ? 0.8 : 0.45 });
    else if (code >= 95) Object.assign(c, { clouds: 1, rain: 0.85, storm: 1 });
    return c;
  }

  // Sky colours by the sun's altitude: [degrees, top colour, horizon colour]
  const SKY = [
    [-18, hex("#04060d"), hex("#0a0f1f")],
    [-9, hex("#0b1230"), hex("#26294f")],
    [-3, hex("#1c2a5c"), hex("#c76a5a")],
    [2, hex("#35609e"), hex("#f0a978")],
    [9, hex("#3a78c4"), hex("#a8cdee")],
    [40, hex("#2a68cc"), hex("#98c4ee")]
  ];

  function skyAt(alt) {
    if (alt <= SKY[0][0]) return [SKY[0][1], SKY[0][2]];
    for (let i = 1; i < SKY.length; i++) {
      if (alt <= SKY[i][0]) {
        const t = (alt - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]);
        return [mix(SKY[i - 1][1], SKY[i][1], t), mix(SKY[i - 1][2], SKY[i][2], t)];
      }
    }
    const last = SKY[SKY.length - 1];
    return [last[1], last[2]];
  }

  function sunAltitude(data) {
    if (data.forceDay === true) return 35;
    if (data.forceDay === false) return -25;
    return WP.sunPosition(new Date(), PLACE.lat, PLACE.lon).altitude;
  }

  // ---------- The skyline (drawn once per size) ----------

  function buildSkyline(s) {
    const random = WP.rng("melbourne-skyline");
    const W = s.w;
    const H = s.h;
    const ratio = s.ratio;
    const shape = document.createElement("canvas");
    const lights = document.createElement("canvas");
    shape.width = lights.width = Math.ceil(W * ratio);
    shape.height = lights.height = Math.ceil(H * ratio);
    const g = shape.getContext("2d");
    const l = lights.getContext("2d");
    g.scale(ratio, ratio);
    l.scale(ratio, ratio);
    g.fillStyle = "#000";
    const unit = Math.max(0.6, Math.min(1.4, W / 1400));

    let x = -10;
    const blocks = [];
    while (x < W + 10) {
      const w = (16 + random() * 44) * unit;
      const centre = Math.exp(-Math.pow((x / W - 0.42) / 0.16, 2)); // the CBD cluster
      const h = H * (0.04 + random() * 0.06 + centre * (0.08 + random() * 0.24));
      blocks.push({ x, w, h });
      x += w + random() * 3 * unit;
    }
    blocks.forEach(b => {
      g.fillRect(b.x, H - b.h, b.w, b.h);
      if (b.h > H * 0.2 && random() < 0.5) g.fillRect(b.x + b.w * 0.45, H - b.h - 18 * unit, 2 * unit, 18 * unit); // antenna
      // windows
      const cols = Math.floor(b.w / (7 * unit));
      const rows = Math.floor((b.h - 8) / (9 * unit));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (random() < 0.22) {
            const warm = random();
            l.fillStyle = warm < 0.7 ? "rgba(255, 214, 140, 0.85)" : warm < 0.9 ? "rgba(255, 245, 220, 0.8)" : "rgba(160, 210, 255, 0.75)";
            l.fillRect(b.x + 2 * unit + c * 7 * unit, H - b.h + 6 * unit + r * 9 * unit, 2.6 * unit, 3.6 * unit);
          }
        }
      }
    });
    // A tall tower with a crown, and a thin spire (think Eureka and the Arts Centre)
    const tx = W * 0.47;
    const th = H * 0.42;
    g.fillRect(tx, H - th, 34 * unit, th);
    g.fillRect(tx + 6 * unit, H - th - 14 * unit, 22 * unit, 14 * unit);
    const sx = W * 0.3;
    g.beginPath();
    g.moveTo(sx - 26 * unit, H - H * 0.1);
    g.lineTo(sx, H - H * 0.36);
    g.lineTo(sx + 26 * unit, H - H * 0.1);
    g.closePath();
    g.fill();
    g.fillRect(sx - 1 * unit, H - H * 0.36 - 40 * unit, 2 * unit, 40 * unit);
    g.fillRect(0, H - H * 0.04, W, H * 0.04);
    for (let i = 0; i < 26; i++) {
      l.fillStyle = "rgba(255, 220, 160, 0.9)";
      l.fillRect(tx + 4 * unit + (i % 5) * 6 * unit, H - th + 10 * unit + Math.floor(i / 5) * 40 * unit, 3 * unit, 4 * unit);
    }
    // the spire's lights
    l.fillStyle = "rgba(255, 255, 255, 0.9)";
    l.beginPath();
    l.arc(sx, H - H * 0.36 - 40 * unit, 2.2 * unit, 0, Math.PI * 2);
    l.fill();
    // Only show windows where there's a building.
    l.globalCompositeOperation = "destination-in";
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.drawImage(shape, 0, 0);
    return { shape, lights };
  }

  // ---------- The scene ----------

  function makeClouds(s) {
    const c = s.cond;
    const alt = s.alt;
    const light = smoothstep(-8, 8, alt);
    let base = mix([42, 48, 66], [255, 255, 255], light);
    const dusk = Math.exp(-Math.pow((alt - 1) / 5, 2));
    base = mix(base, [255, 178, 150], dusk * 0.45);
    const grey = clamp((c.clouds - 0.6) / 0.4, 0, 1) * 0.55 + c.rain * 0.3 + c.storm * 0.2;
    base = mix(base, mix([70, 76, 90], [150, 156, 166], light), clamp(grey, 0, 0.85));
    const count = Math.round(2 + c.clouds * 13);
    const random = WP.rng("clouds-" + count);
    s.clouds = [];
    for (let i = 0; i < count; i++) {
      const depth = 0.3 + random() * 0.7;
      const width = s.w * (0.22 + random() * 0.3) * (0.6 + depth * 0.6);
      s.clouds.push({
        sprite: WP.cloudSprite(width, i * 13 + 7, base),
        x: random() * (s.w + width) - width,
        y: s.h * (0.02 + random() * 0.4 * (1 - depth * 0.3)),
        depth,
        alpha: 0.55 + random() * 0.4
      });
    }
    s.clouds.sort((a, b) => a.depth - b.depth);
  }

  function makeDrops(s) {
    const c = s.cond;
    const area = (s.w * s.h) / (1280 * 720);
    const random = Math.random;
    s.rain = [];
    s.snow = [];
    const rainCount = Math.round(c.rain * 650 * area);
    for (let i = 0; i < rainCount; i++) {
      s.rain.push({ x: random() * s.w, y: random() * s.h, len: 10 + random() * 18, speed: 700 + random() * 500, z: 0.4 + random() * 0.6 });
    }
    const snowCount = Math.round(c.snow * 420 * area);
    for (let i = 0; i < snowCount; i++) {
      s.snow.push({ x: random() * s.w, y: random() * s.h, r: 0.8 + random() * 2.4, speed: 30 + random() * 60, phase: random() * 6.28 });
    }
  }

  const scene = {
    maxDpr: 1.5,
    warm: 1,
    stillTime: 8,
    setup(s) {
      s.stars = WP.makeStars(260, "weather-stars");
      s.flash = 0;
      s.bolt = null;
      s.nextBolt = 3;
      scene.data(s);
    },
    resize(s) {
      s.skyline = buildSkyline(s);
      makeClouds(s);
      makeDrops(s);
    },
    data(s) {
      const d = s.data;
      s.cond = look(d.code === undefined ? 2 : d.code);
      s.wind = d.wind === undefined ? 10 : d.wind;
      s.alt = sunAltitude(d);
      if (s.skyline) {
        makeClouds(s);
        makeDrops(s);
      }
    },
    step(s, dt) {
      const c = s.cond;
      const drift = 4 + s.wind * 0.9;
      s.clouds.forEach(cloud => {
        cloud.x += drift * cloud.depth * dt;
        if (cloud.x > s.w + 40) cloud.x = -cloud.sprite.width - 40;
      });
      const slant = clamp(s.wind / 60, 0, 0.5);
      s.rain.forEach(drop => {
        drop.y += drop.speed * drop.z * dt;
        drop.x += drop.speed * drop.z * slant * dt;
        if (drop.y > s.h) {
          drop.y = -drop.len;
          drop.x = Math.random() * (s.w + s.h * slant) - s.h * slant;
        }
      });
      s.snow.forEach(flake => {
        flake.y += flake.speed * dt;
        flake.x += (Math.sin(s.t * 0.8 + flake.phase) * 18 + s.wind * 0.6) * dt;
        if (flake.y > s.h) { flake.y = -4; flake.x = Math.random() * s.w; }
        if (flake.x > s.w) flake.x = 0;
      });
      if (c.storm && !s.still) {
        s.nextBolt -= dt;
        if (s.nextBolt <= 0) {
          s.flash = 1;
          s.bolt = { x: s.w * (0.15 + Math.random() * 0.7), seed: Math.random(), life: 0.35 };
          s.nextBolt = 4 + Math.random() * 9;
        }
      }
      s.flash = Math.max(0, s.flash - dt * 2.6);
      if (s.bolt) {
        s.bolt.life -= dt;
        if (s.bolt.life <= 0) s.bolt = null;
      }
    },
    draw(s, t) {
      const { g, w, h, cond: c } = s;
      const alt = s.alt;
      const night = 1 - smoothstep(-10, -2, alt);
      let [top, horizon] = skyAt(alt);
      const grey = clamp(c.clouds * 0.75 + c.rain * 0.25 + c.fog * 0.3, 0, 0.9);
      const greyTop = mix([28, 32, 42], [118, 128, 142], smoothstep(-6, 10, alt));
      const greyLow = mix([40, 44, 56], [170, 176, 186], smoothstep(-6, 10, alt));
      top = mix(top, greyTop, grey);
      horizon = mix(horizon, greyLow, grey);
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, rgba(top));
      sky.addColorStop(0.75, rgba(horizon));
      sky.addColorStop(1, rgba(horizon));
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      // city lights glowing up into the sky (and the clouds) at night
      if (night > 0.05) {
        const glow = g.createLinearGradient(0, h, 0, h * 0.35);
        glow.addColorStop(0, "rgba(255, 150, 90, " + (0.2 * night * (0.6 + grey)).toFixed(3) + ")");
        glow.addColorStop(1, "rgba(255, 150, 90, 0)");
        g.fillStyle = glow;
        g.fillRect(0, h * 0.35, w, h * 0.65);
      }

      // stars, then the sun or moon
      WP.drawStars(g, s.stars, w, h, t, night * (1 - c.clouds * 0.9), 0.7);
      const bodyX = w * 0.78 - s.look.x * 10;
      const bodyY = h * 0.2 - s.look.y * 6;
      const clear = clamp(1 - c.clouds * 1.05, 0, 1);
      if (alt > -4) {
        const glowR = Math.min(w, h) * 0.32;
        const glow = g.createRadialGradient(bodyX, bodyY, 0, bodyX, bodyY, glowR);
        const tone = alt < 6 ? [255, 190, 120] : [255, 244, 214];
        glow.addColorStop(0, rgba(tone, 0.55 * clear));
        glow.addColorStop(1, rgba(tone, 0));
        g.fillStyle = glow;
        g.fillRect(bodyX - glowR, bodyY - glowR, glowR * 2, glowR * 2);
        const r = Math.min(w, h) * 0.035;
        const core = g.createRadialGradient(bodyX, bodyY, 0, bodyX, bodyY, r * 2.2);
        const disc = mix([255, 253, 244], [255, 200, 135], smoothstep(8, -2, alt));
        core.addColorStop(0, rgba(disc, clear));
        core.addColorStop(0.42, rgba(disc, clear));
        core.addColorStop(0.5, rgba(disc, 0.45 * clear));
        core.addColorStop(1, rgba(disc, 0));
        g.fillStyle = core;
        g.beginPath();
        g.arc(bodyX, bodyY, r * 2.2, 0, Math.PI * 2);
        g.fill();
      } else if (clear > 0.2) {
        g.globalAlpha = clear;
        WP.drawMoon(g, bodyX, bodyY, Math.min(w, h) * 0.035, WP.moonPhase(new Date()), true);
        g.globalAlpha = 1;
      }

      // clouds (lightning lights them up)
      s.clouds.forEach(cloud => {
        g.globalAlpha = cloud.alpha;
        g.drawImage(cloud.sprite, cloud.x - s.look.x * 26 * cloud.depth, cloud.y - s.look.y * 10 * cloud.depth);
      });
      g.globalAlpha = 1;

      if (s.flash > 0) {
        g.fillStyle = "rgba(220, 225, 255, " + (s.flash * 0.45).toFixed(3) + ")";
        g.fillRect(0, 0, w, h);
      }
      if (s.bolt) drawBolt(g, s, h);

      // fog
      if (c.fog) {
        for (let i = 0; i < 4; i++) {
          const y = h * (0.45 + i * 0.12);
          const band = g.createLinearGradient(0, y - h * 0.12, 0, y + h * 0.12);
          const tone = mix([60, 64, 76], [205, 210, 216], smoothstep(-6, 10, alt));
          band.addColorStop(0, rgba(tone, 0));
          band.addColorStop(0.5, rgba(tone, 0.32 + 0.08 * Math.sin(t * 0.2 + i)));
          band.addColorStop(1, rgba(tone, 0));
          g.fillStyle = band;
          g.fillRect(0, y - h * 0.12, w, h * 0.24);
        }
      }

      // the skyline, its windows at night, and a little haze in front
      const sx = -s.look.x * 8;
      const silhouette = mix([4, 6, 11], [46, 56, 76], smoothstep(-6, 12, alt) * (1 - grey * 0.4));
      g.save();
      g.translate(sx, 0);
      g.drawImage(tinted(s, silhouette), 0, 0, w, h);
      const lit = Math.max(night, c.clouds > 0.85 ? 0.35 : 0) * (0.9 + 0.1 * Math.sin(t * 0.5));
      if (lit > 0.02) {
        g.globalAlpha = lit;
        g.drawImage(s.skyline.lights, 0, 0, w, h);
        g.globalAlpha = 1;
      }
      g.restore();
      if (c.fog) {
        const haze = g.createLinearGradient(0, h * 0.3, 0, h);
        const tone = mix([60, 64, 76], [205, 210, 216], smoothstep(-6, 10, alt));
        haze.addColorStop(0, rgba(tone, 0));
        haze.addColorStop(0.5, rgba(tone, 0.45));
        haze.addColorStop(1, rgba(tone, 0.7));
        g.fillStyle = haze;
        g.fillRect(0, h * 0.3, w, h * 0.7);
      }

      // rain and snow
      if (s.rain.length) {
        const slant = clamp(s.wind / 60, 0, 0.5);
        g.strokeStyle = rgba(mix([160, 175, 200], [225, 232, 242], smoothstep(-6, 10, alt)), 0.55);
        g.lineWidth = 1.3;
        g.beginPath();
        s.rain.forEach(drop => {
          g.moveTo(drop.x, drop.y);
          g.lineTo(drop.x + drop.len * slant, drop.y + drop.len * drop.z);
        });
        g.stroke();
      }
      if (s.snow.length) {
        g.fillStyle = "rgba(255, 255, 255, 0.85)";
        s.snow.forEach(flake => {
          g.beginPath();
          g.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
          g.fill();
        });
      }
    }
  };

  // The skyline in its colour for the current light (recoloured only when that changes).
  function tinted(s, color) {
    const key = color.map(Math.round).join(",");
    const sky = s.skyline;
    if (sky.tintKey !== key) {
      if (!sky.tinted) {
        sky.tinted = document.createElement("canvas");
        sky.tinted.width = sky.shape.width;
        sky.tinted.height = sky.shape.height;
      }
      const t = sky.tinted.getContext("2d");
      t.globalCompositeOperation = "copy";
      t.drawImage(sky.shape, 0, 0);
      t.globalCompositeOperation = "source-in";
      t.fillStyle = rgba(color);
      t.fillRect(0, 0, sky.tinted.width, sky.tinted.height);
      sky.tintKey = key;
    }
    return sky.tinted;
  }

  function drawBolt(g, s, h) {
    const random = WP.rng(Math.floor(s.bolt.seed * 1e9));
    let x = s.bolt.x;
    let y = 0;
    g.save();
    g.strokeStyle = "rgba(235, 240, 255, " + (s.bolt.life / 0.35).toFixed(3) + ")";
    g.lineWidth = 2.4;
    g.shadowColor = "rgba(180, 200, 255, 0.9)";
    g.shadowBlur = 18;
    g.beginPath();
    g.moveTo(x, y);
    while (y < h * 0.62) {
      x += (random() - 0.5) * 60;
      y += 20 + random() * 40;
      g.lineTo(x, y);
    }
    g.stroke();
    g.restore();
  }

  // Open-Meteo's answer → what the scene needs
  function fromAPI(json) {
    const cur = json.current || {};
    return { code: cur.weather_code, isDay: cur.is_day === 1, wind: cur.wind_speed_10m, temp: cur.temperature_2m };
  }

  function forced() {
    const code = WP.params.get("wx");
    if (code === null || isNaN(+code)) return null;
    const day = WP.params.get("wxday");
    return { code: +code, wind: 18, forceDay: day === "1" ? true : day === "0" ? false : undefined };
  }

  function tempText(value) {
    return Math.round(value) + "°";
  }

  WP.register({
    id: "weather",
    name: "Melbourne Weather",
    group: "live",
    blurb: "The sky over Melbourne, right now: rain, fog, storms and all.",
    quotes: "general",
    scene,
    thumbData() {
      const json = WP.cached("weather");
      return forced() || (json ? fromAPI(json) : { code: 2 });
    },
    mount(ctx) {
      const preview = forced();
      const view = ctx.canvas(scene, preview || this.thumbData());
      // Keep the sky's colour moving with the sun.
      ctx.every(60000, () => view.setData({}), false);

      function render(result) {
        const json = result.data;
        const cur = json.current || {};
        const daily = json.daily || {};
        const big = WP.el("p", "wp-big", tempText(cur.temperature_2m) + "  " + (LABELS[cur.weather_code] || ""));
        const bits = [PLACE.name];
        if (cur.apparent_temperature !== undefined) bits.push("Feels like " + tempText(cur.apparent_temperature));
        if (daily.temperature_2m_max) bits.push("H " + tempText(daily.temperature_2m_max[0]) + "  L " + tempText(daily.temperature_2m_min[0]));
        if (cur.wind_speed_10m !== undefined) bits.push("Wind " + Math.round(cur.wind_speed_10m) + " km/h");
        const line = WP.el("p", "wp-line", bits.join("  ·  "));
        const when = WP.el("p", "wp-sub", (result.stale ? "Couldn't refresh. Last update " : "Updated ") + WP.ago(new Date(result.at)) + " · Open-Meteo");
        ctx.info(big, line, when);
      }

      if (preview) {
        ctx.info(WP.el("p", "wp-big", "Preview: " + (LABELS[preview.code] || "Code " + preview.code)),
          WP.el("p", "wp-sub", "Showing ?wx=" + preview.code + ". Remove it from the address to see the real weather."));
        return;
      }

      let last = null;
      const refresh = () => ctx.getJSON(URL, { ttl: 10 * 60000, cacheKey: "weather" })
        .then(result => {
          last = result;
          view.setData(fromAPI(result.data));
          render(result);
        })
        .catch(() => {
          if (!last) ctx.info(WP.el("p", "wp-line", "Melbourne's weather couldn't be loaded right now."), WP.el("p", "wp-sub", "Trying again in a few minutes."));
        });
      ctx.every(15 * 60000, refresh);
      // keep "Updated 5 min ago" honest
      ctx.every(60000, () => { if (last) render(last); }, false);
    }
  });
})();
