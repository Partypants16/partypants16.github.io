// Countdowns: ticking cards for things coming up, soonest first, over a night
// sky with fireworks (more of them when something hits zero).
//
// The shared list is in countdown-dates.js. The weekend, Christmas, New Year
// and the next F1 race are added automatically. "Add a countdown" keeps the
// viewer's own ones in their browser.

(function () {
  const KEY = "wp-countdowns";
  const DAY = 86400000;

  function localDate(text, time) {
    const [y, m, d] = text.split("-").map(Number);
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  }

  // Next date (this year or next) for a fixed month/day.
  function nextYearly(month, day, now) {
    const thisYear = new Date(now.getFullYear(), month - 1, day);
    return thisYear.getTime() + DAY > now.getTime() ? thisYear : new Date(now.getFullYear() + 1, month - 1, day);
  }

  function automatic(now) {
    const list = [];
    // the weekend: Saturday 00:00 (or "it's the weekend" until Monday)
    const day = now.getDay();
    const saturday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (day === 0 ? -1 : 6 - day));
    list.push({ title: "The weekend", at: saturday, icon: "🛋️", lasts: 2 * DAY, auto: true });
    const christmas = nextYearly(12, 25, now);
    list.push({ title: "Christmas", at: christmas, icon: "🎄", auto: true });
    const newYear = nextYearly(1, 1, now);
    list.push({ title: "New Year " + newYear.getFullYear(), at: newYear, icon: "🎆", auto: true });
    // the next F1 race, from the F1 wallpaper's saved calendar
    const season = WP.cached("f1-season");
    const races = season && season.MRData && season.MRData.RaceTable.Races;
    if (races) {
      const next = races.find(r => new Date(r.date + "T" + (r.time || "00:00:00Z")).getTime() + 2 * 3600000 > now.getTime());
      if (next) list.push({ title: next.raceName, at: new Date(next.date + "T" + (next.time || "00:00:00Z")), icon: "🏁", lasts: 2 * 3600000, note: "Lights out, your time", auto: true });
    }
    return list;
  }

  function fixed() {
    const list = typeof COUNTDOWN_DATES !== "undefined" ? COUNTDOWN_DATES : [];
    return list.map(item => ({ title: item.title, at: localDate(item.date, item.time), icon: item.icon || "⭐", note: item.note, lasts: item.time ? 3600000 : DAY }));
  }

  function mine() {
    return (WP.loadJSON(KEY, []) || []).map((item, index) => ({ title: item.title, at: localDate(item.date, item.time), icon: item.icon || "⭐", lasts: item.time ? 3600000 : DAY, own: index }));
  }

  // ---------- Fireworks ----------

  const COLORS = ["#ff5470", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ffffff"];

  const scene = {
    maxDpr: 1.25,
    warm: 3,
    stillTime: 3,
    setup(s) {
      s.stars = WP.makeStars(200, "countdowns");
      s.rockets = [];
      s.sparks = [];
      s.next = 0.5;
    },
    step(s, dt) {
      s.next -= dt * (s.data.party ? 4 : 1);
      if (s.next <= 0) {
        s.next = 1.6 + Math.random() * 2.8;
        s.rockets.push({ x: s.w * (0.1 + Math.random() * 0.8), y: s.h, vy: -s.h * (0.55 + Math.random() * 0.25), top: s.h * (0.12 + Math.random() * 0.35), color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      }
      s.rockets = s.rockets.filter(r => {
        r.y += r.vy * dt;
        if (r.y <= r.top) {
          const n = 46 + Math.floor(Math.random() * 30);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const speed = s.h * (0.08 + Math.random() * 0.12);
            s.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1, color: r.color });
          }
          return false;
        }
        return true;
      });
      s.sparks = s.sparks.filter(p => {
        p.vy += s.h * 0.09 * dt;
        p.vx *= Math.pow(0.4, dt);
        p.vy *= Math.pow(0.6, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.55;
        return p.life > 0;
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#050716");
      bg.addColorStop(1, "#140b26");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      WP.drawStars(g, s.stars, w, h, t, 0.7);
      g.globalCompositeOperation = "lighter";
      s.rockets.forEach(r => {
        g.fillStyle = "rgba(255, 230, 190, 0.9)";
        g.fillRect(r.x - 1, r.y, 2, 10);
      });
      s.sparks.forEach(p => {
        g.globalAlpha = Math.max(0, p.life) * 0.85;
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        g.fill();
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
  };

  WP.register({
    id: "countdowns",
    name: "Countdowns",
    group: "tools",
    icon: "🎉",
    layout: "tool",
    blurb: "Ticking countdowns to things coming up. Add your own.",
    quotes: "general",
    scene,
    mount(ctx) {
      const view = ctx.canvas(scene, { party: false });
      const box = WP.el("div", "cd-box");
      const grid = WP.el("div", "cd-grid");
      const form = WP.el("form", "cd-add wp-glass");
      form.hidden = true;
      const addButton = WP.el("button", "cd-toggle", "+ Add a countdown");
      addButton.type = "button";
      box.append(grid, addButton, form);
      ctx.info(box);

      // the add form
      const name = WP.el("input");
      name.placeholder = "What's coming up?";
      name.required = true;
      name.maxLength = 40;
      name.setAttribute("aria-label", "Name");
      const date = WP.el("input");
      date.type = "date";
      date.required = true;
      date.setAttribute("aria-label", "Date");
      const time = WP.el("input");
      time.type = "time";
      time.setAttribute("aria-label", "Time (optional)");
      const save = WP.el("button", "cd-save", "Add");
      save.type = "submit";
      const note = WP.el("p", "cd-form-note", "Saved in this browser only.");
      form.append(name, date, time, save, note);
      addButton.addEventListener("click", () => {
        form.hidden = !form.hidden;
        if (!form.hidden) name.focus();
      });
      form.addEventListener("submit", event => {
        event.preventDefault();
        const list = WP.loadJSON(KEY, []) || [];
        list.push({ title: name.value.trim().slice(0, 40), date: date.value, time: time.value || "" });
        WP.saveJSON(KEY, list);
        form.reset();
        form.hidden = true;
        build();
      });

      let cards = [];
      function build() {
        const now = new Date();
        const items = fixed().concat(mine(), automatic(now))
          .filter(item => item.at.getTime() + (item.lasts || DAY) > now.getTime())
          .sort((a, b) => a.at - b.at);
        grid.replaceChildren();
        cards = items.map(item => {
          const card = WP.el("div", "cd-card wp-glass");
          const head = WP.el("div", "cd-head");
          // people's own countdowns are their words, so they're left as typed
          head.append(WP.el("span", "cd-icon", item.icon), item.own !== undefined ? WP.keep("span", "cd-title", item.title) : WP.el("span", "cd-title", item.title));
          if (item.own !== undefined) {
            const remove = WP.el("button", "cd-remove", "×");
            remove.type = "button";
            remove.setAttribute("aria-label", "Remove " + item.title);
            remove.addEventListener("click", () => {
              const list = WP.loadJSON(KEY, []) || [];
              list.splice(item.own, 1);
              WP.saveJSON(KEY, list);
              build();
            });
            head.appendChild(remove);
          }
          const big = WP.el("div", "cd-days");
          const small = WP.el("div", "cd-time");
          const when = WP.el("div", "cd-when", WP.fmtDay(item.at, { weekday: "short", day: "numeric", month: "short", year: item.at.getFullYear() !== now.getFullYear() ? "numeric" : undefined }) +
            (item.at.getHours() || item.at.getMinutes() ? ", " + WP.fmtTime(item.at) : ""));
          card.append(head, big, small, when);
          if (item.note) card.appendChild(WP.el("div", "cd-note", item.note));
          grid.appendChild(card);
          return { item, card, big, small };
        });
        if (!cards.length) grid.appendChild(WP.el("p", "wp-line", "Nothing coming up. Add something!"));
        tick();
      }

      let lastBuild = Date.now();
      function tick() {
        const now = Date.now();
        let party = false;
        cards.forEach(({ item, card, big, small }) => {
          const ms = item.at.getTime() - now;
          if (ms <= 0) {
            if (ms > -3600000) party = true; // fireworks for the first hour
            card.classList.add("cd-card--now");
            big.textContent = item.title === "The weekend" ? "It's the weekend!" : "It's here!";
            small.textContent = "";
            return;
          }
          const p = WP.countdownParts(ms);
          const days = p.days === 1 ? "1 day" : p.days + " days";
          big.textContent = p.days ? days : WP.pad(p.hours) + ":" + WP.pad(p.minutes) + ":" + WP.pad(p.seconds);
          small.textContent = p.days ? WP.pad(p.hours) + "h " + WP.pad(p.minutes) + "m " + WP.pad(p.seconds) + "s" : "today";
        });
        view.setData({ party });
        // re-sort now and then (things finish, the weekend comes round)
        if (now - lastBuild > 60000) {
          lastBuild = now;
          build();
        }
      }

      build();
      ctx.every(1000, tick, false);
      // the F1 date comes from the F1 wallpaper's calendar; fetch it if we haven't yet
      if (!WP.cached("f1-season")) {
        ctx.getJSON("https://api.jolpi.ca/ergast/f1/current.json?limit=40", { ttl: 6 * 3600000, cacheKey: "f1-season" }).then(build).catch(() => {});
      }
    }
  });
})();
