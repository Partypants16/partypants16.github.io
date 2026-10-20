// Now Playing: what Parth is playing right now, and a wallpaper to match it.
// FF7 games bring up the FF7 Remake video, racing games the Night Drive, Star
// Wars and space games the Starfield; anything else gets floating controller
// buttons. With nothing on, it shows what was played last.
//
// It reads a small JSON "gaming feed" that the home server will publish (the
// same way it publishes the service status). Until FEED_URL is filled in, it
// says it isn't connected yet. The feed's format is in wallpapers/README.md.
// Try it without a feed: ?w=now-playing&game=Forza%20Horizon%205&platform=steam

const GAMING_FEED_URL = "";

(function () {
  const { rgba, hex, clamp } = WP;

  const PLATFORMS = { steam: "Steam", psn: "PlayStation", playstation: "PlayStation", xbox: "Xbox", epic: "Epic Games", nintendo: "Nintendo" };

  // First match wins. Video ones use the files in wallpaper-files/.
  const MATCHES = [
    { test: /final fantasy vii|\bff ?vii\b|\bff7\b|crisis core|ever crisis/i, video: "FF7-remake" },
    { test: /forza|gran turismo|\bf1\b|wreckfest|assetto|\bwrc\b|dirt ?\d|need for speed|the crew|trackmania|motogp|kartkraft|hot wheels|dakar|driveclub|v-rally|supercross|rally/i, scene: "night-drive" },
    { test: /star wars|jedi|battlefront|halo|starfield|no man's sky|planetside|warframe|elite dangerous/i, scene: "starfield" }
  ];

  function platformName(key) {
    return PLATFORMS[String(key || "").toLowerCase()] || key || "";
  }

  // ---------- Default scene: controller buttons drifting in the dark ----------

  const SHAPES = [
    { kind: "triangle", color: hex("#3ee0c3") },
    { kind: "circle", color: hex("#ff5470") },
    { kind: "cross", color: hex("#7aa7ff") },
    { kind: "square", color: hex("#ff86d6") }
  ];

  function drawShape(g, kind, size) {
    g.beginPath();
    if (kind === "triangle") {
      g.moveTo(0, -size);
      g.lineTo(size * 0.87, size * 0.5);
      g.lineTo(-size * 0.87, size * 0.5);
      g.closePath();
    } else if (kind === "circle") {
      g.arc(0, 0, size * 0.85, 0, Math.PI * 2);
    } else if (kind === "cross") {
      g.moveTo(-size * 0.75, -size * 0.75);
      g.lineTo(size * 0.75, size * 0.75);
      g.moveTo(size * 0.75, -size * 0.75);
      g.lineTo(-size * 0.75, size * 0.75);
    } else {
      g.rect(-size * 0.72, -size * 0.72, size * 1.44, size * 1.44);
    }
  }

  const buttons = {
    maxDpr: 1.5,
    warm: 2,
    stillTime: 4,
    setup(s) {
      const random = WP.rng("buttons");
      s.items = Array.from({ length: 34 }, (_, i) => {
        const depth = 0.25 + random() * 0.75;
        return {
          shape: SHAPES[i % 4], depth,
          x: random(), y: random(),
          vx: 0, vy: 0,
          spin: (random() - 0.5) * 0.6, angle: random() * 6.28,
          size: 10 + depth * 30, bob: random() * 6.28
        };
      });
    },
    step(s, dt) {
      const p = s.pointer;
      s.items.forEach(item => {
        item.y -= 0.012 * item.depth * dt;
        item.angle += item.spin * dt;
        // a press pushes them away
        if (p.down) {
          const dx = item.x * s.w - p.x;
          const dy = item.y * s.h - p.y;
          const d = Math.max(30, Math.hypot(dx, dy));
          if (d < 260) {
            item.vx += (dx / d) * (260 - d) * 0.004 * dt * 60 / s.w;
            item.vy += (dy / d) * (260 - d) * 0.004 * dt * 60 / s.h;
          }
        }
        item.x += item.vx * dt * 60;
        item.y += item.vy * dt * 60;
        item.vx *= Math.pow(0.04, dt);
        item.vy *= Math.pow(0.04, dt);
        if (item.y < -0.08) { item.y = 1.08; item.x = Math.random(); }
        if (item.x < -0.08) item.x = 1.08;
        if (item.x > 1.08) item.x = -0.08;
      });
    },
    draw(s, t) {
      const { g, w, h } = s;
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#120a2a");
      bg.addColorStop(0.55, "#0a0b1d");
      bg.addColorStop(1, "#04050c");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      // soft coloured glows behind
      [[0.2, 0.3, "#3ee0c3"], [0.8, 0.25, "#ff5470"], [0.7, 0.8, "#7aa7ff"], [0.25, 0.8, "#ff86d6"]].forEach(([x, y, c], i) => {
        const r = Math.max(w, h) * 0.35;
        const cx = x * w + Math.sin(t * 0.1 + i) * 40;
        const cy = y * h + Math.cos(t * 0.13 + i) * 30;
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        glow.addColorStop(0, rgba(hex(c), 0.13));
        glow.addColorStop(1, rgba(hex(c), 0));
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
      });
      g.lineCap = "round";
      g.lineJoin = "round";
      s.items.slice().sort((a, b) => a.depth - b.depth).forEach(item => {
        g.save();
        g.translate(item.x * w - s.look.x * 40 * item.depth, item.y * h + Math.sin(t + item.bob) * 4 - s.look.y * 20 * item.depth);
        g.rotate(item.angle);
        g.strokeStyle = rgba(item.shape.color, clamp(0.25 + item.depth * 0.7, 0, 0.95));
        g.lineWidth = 2 + item.depth * 3;
        g.shadowColor = rgba(item.shape.color, 0.8);
        g.shadowBlur = 6 + item.depth * 14;
        drawShape(g, item.shape.kind, item.size);
        g.stroke();
        g.restore();
      });
    }
  };

  // ---------- The wallpaper ----------

  function simulated() {
    const game = WP.params.get("game");
    if (!game) return null;
    return { checked_at: new Date().toISOString(), now_playing: { title: game, platform: WP.params.get("platform") || "", since: new Date(Date.now() - 42 * 60000).toISOString() }, simulated: true };
  }

  function stale(feed) {
    const checked = new Date(feed.checked_at);
    if (isNaN(checked)) return true;
    return Date.now() - checked > ((feed.heartbeat_minutes || 15) * 2 + 10) * 60000;
  }

  WP.register({
    id: "now-playing",
    name: "Now Playing",
    group: "live",
    blurb: "What I'm playing right now, with a wallpaper to match the game.",
    quotes: "gaming",
    thumbScene: buttons,
    mount(ctx) {
      const box = WP.el("div", "wp-sub-stage");
      ctx.layer.appendChild(box);
      let showing = null; // { key, stop }

      function backdrop(title) {
        const match = title ? MATCHES.find(m => m.test.test(title)) : null;
        const key = match ? (match.video || match.scene) : "buttons";
        if (showing && showing.key === key) return;
        if (showing) showing.stop();
        const holder = WP.el("div", "wp-sub-stage");
        box.appendChild(holder);
        let stop;
        if (match && match.video) {
          const media = ctx.video("wallpaper-files/" + match.video + ".mp4", "wallpaper-files/" + match.video + ".jpg", holder);
          stop = () => {
            if (media.pause) media.pause();
            holder.remove();
          };
        } else {
          const def = match ? WP.get(match.scene) : null;
          const handle = ctx.canvas(def && def.scene ? def.scene : buttons, {}, { into: holder });
          stop = () => {
            handle.stop();
            holder.remove();
          };
        }
        showing = { key, stop };
      }

      function render(feed) {
        const link = WP.el("a", "wp-link", "My gaming profiles");
        link.href = "gaming.html";
        const more = WP.el("p", "wp-sub");
        more.appendChild(link);
        if (!feed) {
          backdrop(null);
          ctx.info(
            WP.el("p", "wp-live wp-live--quiet", "Gaming status"),
            WP.el("p", "wp-line", "Live status isn't connected yet."),
            more
          );
          return;
        }
        const old = stale(feed);
        const now = !old && feed.now_playing;
        const last = feed.last_played;
        backdrop(now ? now.title : null);
        const nodes = [];
        if (now) {
          nodes.push(WP.el("p", "wp-live wp-live--green", "Now playing" + (feed.simulated ? " (preview)" : "")));
          nodes.push(WP.keep("p", "wp-big", now.title));
          const bits = [];
          if (now.platform) bits.push("on " + platformName(now.platform));
          if (now.since && !isNaN(new Date(now.since))) bits.push("for " + WP.span(Date.now() - new Date(now.since)));
          if (bits.length) nodes.push(WP.bits("wp-line", bits));
        } else {
          nodes.push(WP.el("p", "wp-live wp-live--quiet", old ? "Status is out of date" : "Not playing right now"));
          if (last && last.title) {
            nodes.push(WP.keep("p", "wp-big", last.title));
            const bits = ["Last played"];
            if (last.platform) bits.push("on " + platformName(last.platform));
            if (last.at && !isNaN(new Date(last.at))) bits.push(WP.ago(new Date(last.at)));
            nodes.push(WP.bits("wp-line", bits));
          }
          if (old) nodes.push(WP.el("p", "wp-sub", "The home server hasn't reported since " + WP.fmtWhen(new Date(feed.checked_at)) + "."));
        }
        nodes.push(more);
        ctx.info(nodes);
      }

      const preview = simulated();
      if (preview) {
        render(preview);
        return;
      }
      if (!GAMING_FEED_URL) {
        render(null);
        return;
      }
      let latest = null;
      const load = () => ctx.getJSON(GAMING_FEED_URL + "?t=" + Math.floor(Date.now() / 60000), { ttl: 60000 })
        .then(result => { latest = result.data; render(latest); })
        .catch(() => { if (!latest) render(null); });
      ctx.every(2 * 60000, load);
      ctx.every(60000, () => { if (latest) render(latest); }, false);
    }
  });
})();
