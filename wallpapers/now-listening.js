// Now Listening: the song playing on Navidrome right now, on a spinning record.
// The album art goes on the label when it can be found, and the background
// takes its colour. With nothing playing, the arm lifts and it shows the last song.
//
// Navidrome can tell ListenBrainz what's playing, and ListenBrainz's public API
// lets this page read it without a server of our own. To switch it on: make a
// free ListenBrainz account, paste its token into Navidrome (your avatar →
// Personal → ListenBrainz), then put the ListenBrainz username below.
// Try it: ?w=now-listening&lb=<any ListenBrainz user>, or
// ?w=now-listening&track=Tum%20Hi%20Ho&artist=Arijit%20Singh

const LISTENBRAINZ_USER = "";

(function () {
  const { rgba, mix, hex, clamp, lerp } = WP;
  const API = "https://api.listenbrainz.org/1/user/";

  function colourFor(text) {
    const h = WP.hash(text || "music");
    const hue = h % 360;
    return "hsl(" + hue + ", 55%, 42%)";
  }

  // The colour of a picture, averaged from a tiny copy (needs a CORS-friendly image).
  function averageColour(img) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, 8, 8);
      const d = g.getImageData(0, 0, 8, 8).data;
      let r = 0, gr = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return [r / n, gr / n, b / n];
    } catch (e) {
      return null;
    }
  }

  const scene = {
    maxDpr: 2,
    stillTime: 3,
    setup(s) {
      s.angle = 0;
      s.arm = 0; // 0 = resting, 1 = on the record
      s.bars = Array.from({ length: 48 }, () => Math.random());
    },
    data(s) {
      const d = s.data;
      s.tone = d.tone || hex("#3a2a5a");
    },
    resize(s) {
      const portrait = s.h > s.w * 1.1;
      s.wide = !portrait && s.w >= 900;
      if (s.wide) {
        s.r = Math.min(s.w * 0.22, s.h * 0.38);
        s.cx = s.w * 0.72;
        s.cy = s.h * 0.56;
      } else {
        s.r = portrait ? s.w * 0.62 : Math.min(s.w, s.h) * 0.46;
        s.cx = portrait ? s.w * 0.5 : s.w - s.r * 0.62;
        s.cy = portrait ? s.h + s.r * 0.12 : s.h * 0.58;
      }
      s.grooves = document.createElement("canvas");
      const size = Math.ceil(s.r * 2 * s.ratio);
      s.grooves.width = s.grooves.height = size;
      const g = s.grooves.getContext("2d");
      g.scale(s.ratio, s.ratio);
      const r = s.r;
      g.translate(r, r);
      g.fillStyle = "#0b0b0d";
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      for (let k = r * 0.36; k < r * 0.97; k += 2.2) {
        g.strokeStyle = "rgba(255, 255, 255, " + (0.025 + Math.random() * 0.035).toFixed(3) + ")";
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(0, 0, k, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = "rgba(255, 255, 255, 0.08)";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(0, 0, r * 0.985, 0, Math.PI * 2);
      g.stroke();
    },
    step(s, dt) {
      const playing = !!s.data.playing;
      s.arm += ((playing ? 1 : 0) - s.arm) * Math.min(1, dt * 1.6);
      const speed = playing && s.arm > 0.9 ? (33.333 / 60) * Math.PI * 2 * 0.5 : 0;
      s.spin = lerp(s.spin || 0, speed, Math.min(1, dt * 1.2));
      s.angle += s.spin * dt;
      if (playing) s.bars = s.bars.map((v, i) => clamp(v + (Math.random() - 0.5) * dt * 6, 0.05, 1));
    },
    draw(s, t) {
      const { g, w, h, cx, cy, r } = s;
      const tone = s.tone || hex("#3a2a5a");
      const bg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, Math.max(w, h) * 1.1);
      bg.addColorStop(0, rgba(mix(tone, [255, 255, 255], 0.08)));
      bg.addColorStop(0.45, rgba(mix(tone, [0, 0, 0], 0.55)));
      bg.addColorStop(1, "#040406");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // the "equaliser" along the bottom, only while playing
      const level = s.arm;
      if (level > 0.05) {
        const n = s.bars.length;
        const bw = w / n;
        s.bars.forEach((v, i) => {
          const bh = h * 0.16 * v * level * (0.6 + 0.4 * Math.sin(t * 3 + i));
          g.fillStyle = rgba(mix(tone, [255, 255, 255], 0.35), 0.16);
          g.fillRect(i * bw + 1, h - bh, bw - 2, bh);
        });
      }

      const ox = cx - s.look.x * 10;
      const oy = cy - s.look.y * 6;
      // shadow, record, grooves
      g.save();
      g.shadowColor = "rgba(0, 0, 0, 0.6)";
      g.shadowBlur = 40;
      g.fillStyle = "#08080a";
      g.beginPath();
      g.arc(ox, oy, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.save();
      g.translate(ox, oy);
      g.rotate(s.angle);
      g.drawImage(s.grooves, -r, -r, r * 2, r * 2);
      // the label: album art, or a coloured label with the title
      const labelR = r * 0.33;
      g.save();
      g.beginPath();
      g.arc(0, 0, labelR, 0, Math.PI * 2);
      g.clip();
      if (s.data.art && s.data.art.complete && s.data.art.naturalWidth) {
        g.drawImage(s.data.art, -labelR, -labelR, labelR * 2, labelR * 2);
      } else {
        g.fillStyle = s.data.labelColour || "#b23a48";
        g.fillRect(-labelR, -labelR, labelR * 2, labelR * 2);
        g.fillStyle = "rgba(255, 255, 255, 0.85)";
        g.font = "700 " + Math.round(labelR * 0.16) + "px system-ui, sans-serif";
        g.textAlign = "center";
        g.fillText((s.data.album || "Navidrome").slice(0, 22), 0, -labelR * 0.35);
        g.font = "500 " + Math.round(labelR * 0.12) + "px system-ui, sans-serif";
        g.fillText("33⅓", 0, labelR * 0.55);
      }
      g.restore();
      g.fillStyle = "#d8d8d8";
      g.beginPath();
      g.arc(0, 0, r * 0.018, 0, Math.PI * 2);
      g.fill();
      g.restore();

      // a sheen that stays still while the record turns
      if (g.createConicGradient) {
        const sheen = g.createConicGradient(-0.6, ox, oy);
        sheen.addColorStop(0, "rgba(255,255,255,0)");
        sheen.addColorStop(0.08, "rgba(255,255,255,0.09)");
        sheen.addColorStop(0.16, "rgba(255,255,255,0)");
        sheen.addColorStop(0.5, "rgba(255,255,255,0)");
        sheen.addColorStop(0.58, "rgba(255,255,255,0.07)");
        sheen.addColorStop(0.66, "rgba(255,255,255,0)");
        sheen.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = sheen;
        g.beginPath();
        g.arc(ox, oy, r, 0, Math.PI * 2);
        g.arc(ox, oy, r * 0.34, 0, Math.PI * 2, true);
        g.fill();
      }

      // the tonearm swings on when something plays (when there's room for it)
      if (!s.wide) return;
      const px = ox + r * 0.95;
      const py = oy - r * 0.95;
      const rest = -0.25;
      const play = 0.38;
      const angle = rest + (play - rest) * s.arm;
      g.save();
      g.translate(px, py);
      g.rotate(angle);
      g.fillStyle = "#9da3ab";
      g.beginPath();
      g.arc(0, 0, r * 0.07, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#c7ccd2";
      g.lineWidth = Math.max(3, r * 0.018);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-r * 0.1, r * 0.95);
      g.stroke();
      g.fillStyle = "#e6e8eb";
      g.fillRect(-r * 0.15, r * 0.93, r * 0.11, r * 0.14);
      g.restore();
    }
  };

  // ListenBrainz → { track, artist, album, mbid, at }
  function fromListen(listen) {
    const meta = listen.track_metadata || {};
    const extra = meta.additional_info || {};
    const mapping = meta.mbid_mapping || {};
    return {
      track: meta.track_name,
      artist: meta.artist_name,
      album: meta.release_name,
      mbid: extra.release_mbid || mapping.release_mbid || null,
      at: listen.listened_at ? new Date(listen.listened_at * 1000) : null
    };
  }

  WP.register({
    id: "now-listening",
    name: "Now Listening",
    group: "live",
    blurb: "The song playing on my Navidrome right now, on a spinning record.",
    quotes: "music",
    layout: "left",
    scene,
    thumbData: () => ({ playing: true, labelColour: "#b23a48", album: "Navidrome" }),
    mount(ctx) {
      const view = ctx.canvas(scene, { playing: false });
      const user = WP.params.get("lb") || LISTENBRAINZ_USER;
      let artFor = null;

      function setArt(song) {
        const key = song && song.mbid;
        if (key === artFor) return;
        artFor = key;
        view.setData({ art: null, tone: null, labelColour: colourFor(song && song.album), album: song && song.album });
        if (!key) return;
        const tryLoad = cors => {
          const img = new Image();
          if (cors) img.crossOrigin = "anonymous";
          img.onload = () => {
            if (!ctx.alive || artFor !== key) return;
            const avg = cors ? averageColour(img) : null;
            view.setData({ art: img, tone: avg ? mix(avg, [0, 0, 0], 0.2) : null });
          };
          img.onerror = () => { if (cors) tryLoad(false); };
          img.src = "https://coverartarchive.org/release/" + key + "/front-250";
        };
        tryLoad(true);
      }

      function render(song, playing, note) {
        view.setData({ playing });
        setArt(song);
        if (!song || !song.track) {
          ctx.info(WP.el("p", "wp-live wp-live--quiet", "Now listening"), WP.el("p", "wp-line", note || "Nothing playing right now."));
          return;
        }
        const nodes = [
          WP.el("p", playing ? "wp-live wp-live--green" : "wp-live wp-live--quiet", playing ? "Now listening" : "Last played"),
          WP.el("p", "wp-big", song.track),
          WP.el("p", "wp-line", [song.artist, song.album].filter(Boolean).join("  ·  "))
        ];
        const sub = playing ? "Playing on Navidrome" : song.at ? WP.ago(song.at) : "";
        if (note || sub) nodes.push(WP.el("p", "wp-sub", note || sub));
        ctx.info(nodes);
      }

      const track = WP.params.get("track");
      if (track) {
        render({ track, artist: WP.params.get("artist") || "", album: WP.params.get("album") || "" }, true, "Preview from the address");
        return;
      }
      if (!user) {
        render(null, false, "The music feed isn't connected yet.");
        return;
      }

      let lastSong = null;
      function poll() {
        ctx.getJSON(API + encodeURIComponent(user) + "/playing-now", { ttl: 20000 })
          .then(result => {
            const listens = (result.data.payload && result.data.payload.listens) || [];
            if (listens.length) {
              render(fromListen(listens[0]), true);
              return;
            }
            return ctx.getJSON(API + encodeURIComponent(user) + "/listens?count=1", { ttl: 3 * 60000 })
              .then(last => {
                const items = (last.data.payload && last.data.payload.listens) || [];
                lastSong = items.length ? fromListen(items[0]) : null;
                render(lastSong, false);
              });
          })
          .catch(() => render(lastSong, false, "ListenBrainz couldn't be reached right now."));
      }
      ctx.every(30000, poll);
    }
  });
})();
