// F1 Countdown: counts down to the next Formula 1 session (practice,
// qualifying, sprint or race), shows the weekend's schedule in your own time
// and the last race's podium. During a session it says LIVE. The scene is a
// track map with two cars battling for position, and start lights that go out
// when the wallpaper opens.
//
// Data: the Jolpica F1 API (the free successor to Ergast), cached for hours.

(function () {
  const { lerp } = WP;
  const API = "https://api.jolpi.ca/ergast/f1/";

  const SESSIONS = [
    ["FirstPractice", "Practice 1", "FP1", 60],
    ["SecondPractice", "Practice 2", "FP2", 60],
    ["ThirdPractice", "Practice 3", "FP3", 60],
    ["SprintShootout", "Sprint Shootout", "SS", 45],
    ["SprintQualifying", "Sprint Qualifying", "SQ", 45],
    ["Sprint", "Sprint", "Sprint", 45],
    ["Qualifying", "Qualifying", "Quali", 60]
  ];

  function when(part) {
    return new Date(part.date + "T" + (part.time || "00:00:00Z"));
  }

  function sessionsOf(race) {
    const list = [];
    SESSIONS.forEach(([key, name, short, minutes]) => {
      if (race[key] && race[key].date) list.push({ name, short, minutes, start: when(race[key]), race });
    });
    list.push({ name: "Race", short: "Race", minutes: 120, start: when(race), race, isRace: true });
    return list.sort((a, b) => a.start - b.start);
  }

  // The session on now, or the next one, across the races given.
  function findSession(races, now) {
    for (const race of races) {
      for (const session of sessionsOf(race)) {
        const end = session.start.getTime() + session.minutes * 60000;
        if (now < end) return { session, live: now >= session.start.getTime() };
      }
    }
    return null;
  }

  // ---------- The scene: a track map ----------

  const TRACK = [
    [0.1, 0.6], [0.14, 0.34], [0.26, 0.24], [0.4, 0.27], [0.5, 0.2], [0.66, 0.17], [0.84, 0.22],
    [0.91, 0.4], [0.82, 0.53], [0.9, 0.7], [0.78, 0.86], [0.58, 0.8], [0.44, 0.88], [0.24, 0.86], [0.14, 0.76]
  ];

  // A closed Catmull-Rom curve through the points, sampled evenly by distance.
  function buildTrack(w, h) {
    const pts = TRACK.map(([x, y]) => [x * w, y * h]);
    const raw = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        raw.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    const lengths = [0];
    for (let i = 1; i <= raw.length; i++) {
      const a = raw[i - 1];
      const b = raw[i % raw.length];
      lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    return { points: raw, lengths, total: lengths[lengths.length - 1] };
  }

  function pointAt(track, distance) {
    const d = ((distance % track.total) + track.total) % track.total;
    let lo = 0;
    let hi = track.lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (track.lengths[mid] <= d) lo = mid; else hi = mid;
    }
    const a = track.points[lo % track.points.length];
    const b = track.points[(lo + 1) % track.points.length];
    const t = (d - track.lengths[lo]) / Math.max(0.001, track.lengths[lo + 1] - track.lengths[lo]);
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  }

  function weave(ratio) {
    const size = Math.round(8 * ratio);
    const tile = document.createElement("canvas");
    tile.width = tile.height = size * 2;
    const g = tile.getContext("2d");
    g.fillStyle = "#0d0e11";
    g.fillRect(0, 0, size * 2, size * 2);
    const block = (x, y, horizontal) => {
      const grad = horizontal ? g.createLinearGradient(x, y, x, y + size) : g.createLinearGradient(x, y, x + size, y);
      grad.addColorStop(0, "#1b1d22");
      grad.addColorStop(0.5, "#24272e");
      grad.addColorStop(1, "#15171b");
      g.fillStyle = grad;
      g.fillRect(x + 0.5, y + 0.5, size - 1, size - 1);
    };
    block(0, 0, true);
    block(size, 0, false);
    block(0, size, false);
    block(size, size, true);
    return tile;
  }

  const CARS = [
    { color: "#ff2a2a", glow: "rgba(255, 42, 42, 0.9)", offset: 0 },
    { color: "#27f4d2", glow: "rgba(39, 244, 210, 0.9)", offset: -60 }
  ];

  const scene = {
    maxDpr: 2,
    stillTime: 6,
    setup(s) {
      s.lights = s.still || s.thumb ? -1 : 0; // seconds into the start sequence; -1 = done
      s.cars = CARS.map(car => Object.assign({ distance: car.offset, trail: [] }, car));
    },
    resize(s) {
      const pad = Math.min(s.w, s.h) * 0.02;
      s.track = buildTrack(s.w - pad * 2, s.h - pad * 2);
      s.track.points.forEach(p => { p[0] += pad; p[1] += pad; });
      s.pattern = s.g.createPattern(weave(s.ratio), "repeat");
      if (s.pattern && s.pattern.setTransform) s.pattern.setTransform(new DOMMatrix().scale(1 / s.ratio));
      s.cars.forEach(car => { car.trail = []; });
      if (s.still || s.thumb) {
        s.cars.forEach((car, i) => { car.distance = s.track.total * (0.18 + i * 0.012); });
      }
    },
    step(s, dt) {
      if (s.lights >= 0) {
        s.lights += dt;
        if (s.lights > 5.2) s.lights = -1;
      }
      const launched = s.lights < 0 || s.lights > 4.6;
      const base = Math.min(s.w, s.h) * 0.55;
      s.cars.forEach((car, i) => {
        if (!launched) return;
        // they trade places now and then
        const pace = base * (1 + 0.12 * Math.sin(s.t * 0.23 + i * 3.1));
        car.distance += pace * dt;
        const p = pointAt(s.track, car.distance);
        car.trail.push(p);
        if (car.trail.length > 70) car.trail.shift();
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      g.fillStyle = s.pattern || "#111";
      g.fillRect(0, 0, w, h);
      const shade = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      shade.addColorStop(0, "rgba(40, 0, 0, 0.15)");
      shade.addColorStop(1, "rgba(0, 0, 0, 0.75)");
      g.fillStyle = shade;
      g.fillRect(0, 0, w, h);

      g.save();
      g.translate(-s.look.x * 14, -s.look.y * 8);
      // the circuit
      g.lineJoin = "round";
      g.lineCap = "round";
      g.beginPath();
      s.track.points.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath();
      g.strokeStyle = "rgba(255, 255, 255, 0.06)";
      g.lineWidth = 22;
      g.stroke();
      g.strokeStyle = "rgba(255, 255, 255, 0.55)";
      g.lineWidth = 3;
      g.shadowColor = "rgba(255, 255, 255, 0.5)";
      g.shadowBlur = 10;
      g.stroke();
      g.shadowBlur = 0;

      // start / finish line and sector markers
      const marks = [0, 1 / 3, 2 / 3];
      marks.forEach((m, i) => {
        const a = pointAt(s.track, s.track.total * m);
        const b = pointAt(s.track, s.track.total * m + 2);
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
        g.strokeStyle = i === 0 ? "#ffffff" : ["", "#b65cff", "#ffd400"][i];
        g.lineWidth = i === 0 ? 4 : 3;
        g.beginPath();
        g.moveTo(a[0] + Math.cos(angle) * 14, a[1] + Math.sin(angle) * 14);
        g.lineTo(a[0] - Math.cos(angle) * 14, a[1] - Math.sin(angle) * 14);
        g.stroke();
      });

      // cars and their trails
      s.cars.forEach(car => {
        const trail = car.trail;
        for (let i = 1; i < trail.length; i++) {
          g.strokeStyle = car.color;
          g.globalAlpha = (i / trail.length) * 0.8;
          g.lineWidth = 1 + (i / trail.length) * 4;
          g.beginPath();
          g.moveTo(trail[i - 1][0], trail[i - 1][1]);
          g.lineTo(trail[i][0], trail[i][1]);
          g.stroke();
        }
        g.globalAlpha = 1;
        const p = pointAt(s.track, car.distance);
        g.shadowColor = car.glow;
        g.shadowBlur = 18;
        g.fillStyle = car.color;
        g.beginPath();
        g.arc(p[0], p[1], 6, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(p[0], p[1], 2.4, 0, Math.PI * 2);
        g.fill();
      });
      g.restore();

      // five start lights, top left: on one by one, then out
      const lit = s.lights < 0 ? 0 : s.lights > 4.6 ? 0 : Math.min(5, Math.floor(s.lights / 0.8) + 1);
      const green = s.data.live;
      const size = Math.max(9, Math.min(w, h) * 0.014);
      const x0 = Math.min(w * 0.06, 60);
      const y0 = h * 0.16;
      for (let i = 0; i < 5; i++) {
        const x = x0 + i * size * 2.7;
        g.fillStyle = "#050505";
        g.fillRect(x - size * 1.1, y0 - size * 1.1, size * 2.2, size * 2.2 * 2);
        for (let row = 0; row < 2; row++) {
          const on = green || i < lit;
          g.fillStyle = on ? (green ? "#2bff6a" : "#ff1e1e") : "#2a0d0d";
          if (on) {
            g.shadowColor = green ? "rgba(43, 255, 106, 0.9)" : "rgba(255, 30, 30, 0.9)";
            g.shadowBlur = size * 1.6;
          }
          g.beginPath();
          g.arc(x, y0 + row * size * 2.2, size * 0.75, 0, Math.PI * 2);
          g.fill();
          g.shadowBlur = 0;
        }
      }
    }
  };

  // ---------- The info ----------

  function countdownNode() {
    const box = WP.el("div", "wp-countdown");
    const units = ["days", "hrs", "min", "sec"].map(label => {
      const unit = WP.el("div", "wp-cd-unit wp-glass");
      const value = WP.el("b", null, "--");
      unit.append(value, WP.el("span", null, label));
      box.appendChild(unit);
      return value;
    });
    return {
      node: box,
      set(ms) {
        const p = WP.countdownParts(ms);
        [p.days, p.hours, p.minutes, p.seconds].forEach((v, i) => {
          const text = i === 0 ? String(v) : WP.pad(v);
          if (units[i].textContent !== text) units[i].textContent = text;
        });
      }
    };
  }

  function podiumText(json) {
    const race = json && json.MRData.RaceTable.Races[0];
    if (!race || !race.Results) return null;
    const medal = ["1", "2", "3"];
    const names = race.Results.slice(0, 3).map((r, i) => medal[i] + ". " + r.Driver.familyName);
    return "Last race: " + race.raceName.replace("Grand Prix", "GP") + "  ·  " + names.join("   ");
  }

  WP.register({
    id: "f1",
    name: "F1 Countdown",
    group: "live",
    blurb: "Counts down to the next session, with the weekend in your own time.",
    quotes: "racing",
    scene,
    mount(ctx) {
      const view = ctx.canvas(scene, {});
      const year = new Date().getFullYear();
      let races = null;
      let podium = null;
      let built = null;

      function build() {
        const now = Date.now();
        const found = races && findSession(races, now);
        if (!found) {
          view.setData({ live: false });
          ctx.info(races
            ? WP.el("p", "wp-line", "That's the season. The next calendar isn't out yet.")
            : WP.el("p", "wp-line", "The F1 calendar couldn't be loaded right now."));
          built = null;
          return;
        }
        const { session, live } = found;
        const race = session.race;
        view.setData({ live });
        const head = WP.el("p", live ? "wp-live" : "wp-live wp-live--quiet", live ? "Live now · " + session.name : "Next · " + session.name);
        const title = WP.keep("p", "wp-big", race.raceName);
        const where = WP.bits("wp-sub", ["Round " + race.round, WP.keep("span", null, race.Circuit.circuitName + ", " + race.Circuit.Location.locality + ", " + race.Circuit.Location.country)]);
        const clock = countdownNode();
        const at = WP.el("p", "wp-sub", (live ? "Started " : "") + WP.fmtWhen(session.start) + " your time");
        const chips = WP.el("div", "wp-chips");
        sessionsOf(race).forEach(item => {
          const chip = WP.el("span", "wp-chip f1-chip", item.short + " " + WP.fmtDay(item.start, { weekday: "short", day: undefined, month: undefined }) + " " + WP.fmtTime(item.start));
          const end = item.start.getTime() + item.minutes * 60000;
          if (end < now) chip.classList.add("f1-chip--done");
          if (item === session) chip.classList.add("f1-chip--next");
          chips.appendChild(chip);
        });
        const nodes = [head, title, where, clock.node, at, chips];
        if (podium) nodes.push(WP.el("p", "wp-sub f1-podium", podium));
        ctx.info(nodes);
        built = { session, live, clock };
        tick();
      }

      function tick() {
        if (!built) return;
        const now = Date.now();
        const { session, live, clock } = built;
        const end = session.start.getTime() + session.minutes * 60000;
        // Rebuild when a session starts or ends.
        if ((!live && now >= session.start.getTime()) || (live && now >= end)) return build();
        clock.set(live ? end - now : session.start - now);
      }

      function load() {
        ctx.getJSON(API + "current.json?limit=40", { ttl: 6 * 3600000, cacheKey: "f1-season" })
          .then(result => {
            races = result.data.MRData.RaceTable.Races;
            if (!findSession(races, Date.now())) {
              return ctx.getJSON(API + (year + 1) + ".json?limit=40", { ttl: 12 * 3600000, cacheKey: "f1-next-season" })
                .then(next => { races = races.concat(next.data.MRData.RaceTable.Races); })
                .catch(() => {});
            }
          })
          .catch(() => { races = races || null; })
          .then(() => build());
        ctx.getJSON(API + "current/last/results.json?limit=3", { ttl: 3600000, cacheKey: "f1-last" })
          .then(result => {
            podium = podiumText(result.data);
            build();
          })
          .catch(() => {});
      }

      load();
      ctx.every(1000, tick, false);
      ctx.every(3 * 3600000, load, false);
    }
  });
})();
