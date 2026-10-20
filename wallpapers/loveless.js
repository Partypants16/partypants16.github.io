// LOVELESS: the engravings from Parth's hand-bound LOVELESS book, gilded on
// dark leather like a book cover, one act at a time, with that act's lines
// from the poem under the clock. Black feathers drift down.
//
// The plates are drawn by the book's own code and turned into images by
// tools/build_wallpaper_images.py. The words are the book's master wording
// (physical_projects/.../loveless_book/build/content.py), unchanged.

(function () {
  const { clamp } = WP;
  const SECONDS_PER_ACT = 40;
  const FADE = 3;

  const ACTS = [
    { plate: "prologue", title: "Prologue", lines: [
      "When the war of the beasts brings about the world’s end",
      "The goddess descends from the sky",
      "Wings of light and dark spread afar",
      "She guides us to bliss, her gift everlasting"] },
    { plate: "act1", title: "Act I", lines: [
      "Infinite in mystery is the gift of the goddess",
      "We seek it thus, and take it to the sky",
      "Ripples form on the water’s surface",
      "The wandering soul knows no rest"] },
    { plate: "act2", title: "Act II", lines: [
      "There is no hate, only joy",
      "For you are beloved by the goddess",
      "Hero of the dawn, Healer of worlds",
      "Dreams of the morrow hath the shattered soul",
      "Pride is lost",
      "Wings stripped away, the end is nigh"] },
    { plate: "act3", title: "Act III", lines: [
      "My friend, do you fly away now?",
      "To a world that abhors you and I?",
      "All that awaits you is a somber morrow",
      "No matter where the winds may blow",
      "My friend, your desire",
      "Is the bringer of life, the gift of the goddess",
      "Even if the morrow is barren of promises",
      "Nothing shall forestall my return"] },
    { plate: "act4", title: "Act IV", lines: [
      "My friend, the fates are cruel",
      "There are no dreams, no honor remains",
      "The arrow has left the bow of the goddess",
      "My soul, corrupted by vengeance",
      "Hath endured torment, to find the end of the journey",
      "In my own salvation",
      "And your eternal slumber",
      "Legend shall speak",
      "Of sacrifice at world’s end",
      "The wind sails over the water’s surface",
      "Quietly, but surely"] },
    { plate: "act5", title: "Act V, as Genesis ended it", lines: [
      "Even if the morrow is barren of promises",
      "Nothing shall forestall my return",
      "To become the dew that quenches the land",
      "To spare the sands, the seas, the skies",
      "I offer thee this silent sacrifice"] }
  ];

  const images = {};
  function plateImage(name) {
    if (!images[name]) {
      const img = new Image();
      img.decoding = "async";
      img.src = "wallpaper-files/loveless/" + name + ".webp";
      images[name] = img;
    }
    return images[name];
  }

  // The plate in gold: ink becomes a gilt gradient, paper stays see-through.
  function gild(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    const gold = g.createLinearGradient(0, 0, canvas.width, canvas.height);
    gold.addColorStop(0, "#f3dc9a");
    gold.addColorStop(0.35, "#c9a356");
    gold.addColorStop(0.6, "#e8cd84");
    gold.addColorStop(1, "#a07a35");
    g.fillStyle = gold;
    g.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  // Halve a canvas `times` times: much cleaner than one big jump down.
  function shrink(source, times) {
    let canvas = source;
    for (let i = 0; i < times; i++) {
      const next = document.createElement("canvas");
      next.width = Math.max(1, Math.round(canvas.width / 2));
      next.height = Math.max(1, Math.round(canvas.height / 2));
      const g = next.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(canvas, 0, 0, next.width, next.height);
      canvas = next;
    }
    return canvas;
  }

  function leather(s) {
    const canvas = document.createElement("canvas");
    const W = Math.ceil(s.w * s.ratio);
    const H = Math.ceil(s.h * s.ratio);
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext("2d");
    const base = g.createRadialGradient(W * 0.35, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    base.addColorStop(0, "#2c0e13");
    base.addColorStop(0.6, "#170609");
    base.addColorStop(1, "#070203");
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // grain
    const grain = g.createImageData(W, H);
    const random = WP.rng("leather");
    for (let i = 0; i < grain.data.length; i += 4) {
      const v = random() * 255;
      grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = v;
      grain.data[i + 3] = 10;
    }
    const tmp = document.createElement("canvas");
    tmp.width = W;
    tmp.height = H;
    tmp.getContext("2d").putImageData(grain, 0, 0);
    g.globalCompositeOperation = "overlay";
    g.drawImage(tmp, 0, 0);
    g.globalCompositeOperation = "source-over";
    // a gilt double rule around the edge, like a tooled cover
    g.scale(s.ratio, s.ratio);
    const inset = Math.max(14, Math.min(s.w, s.h) * 0.03);
    g.strokeStyle = "rgba(214, 178, 102, 0.55)";
    g.lineWidth = 1.5;
    g.strokeRect(inset, inset, s.w - inset * 2, s.h - inset * 2);
    g.strokeStyle = "rgba(214, 178, 102, 0.3)";
    g.lineWidth = 1;
    g.strokeRect(inset + 6, inset + 6, s.w - inset * 2 - 12, s.h - inset * 2 - 12);
    [[inset, inset], [s.w - inset, inset], [inset, s.h - inset], [s.w - inset, s.h - inset]].forEach(([x, y]) => {
      g.fillStyle = "rgba(214, 178, 102, 0.6)";
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.fillRect(-4, -4, 8, 8);
      g.restore();
    });
    return canvas;
  }

  function feather(g, size) {
    g.beginPath();
    g.moveTo(0, -size);
    g.quadraticCurveTo(size * 0.32, -size * 0.2, size * 0.08, size);
    g.quadraticCurveTo(-size * 0.28, size * 0.1, 0, -size);
    g.fill();
    g.strokeStyle = "rgba(200, 160, 90, 0.35)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, -size * 0.95);
    g.quadraticCurveTo(size * 0.1, 0, size * 0.06, size * 1.15);
    g.stroke();
  }

  function actAt(t) {
    return Math.floor(t / SECONDS_PER_ACT) % ACTS.length;
  }

  const scene = {
    maxDpr: 1.5,
    stillTime: 0,
    setup(s) {
      s.gilded = {};
      s.feathers = Array.from({ length: 9 }, (_, i) => ({ x: Math.random(), y: Math.random(), size: 9 + Math.random() * 12, spin: Math.random() * 6.28, speed: 0.012 + Math.random() * 0.02, sway: Math.random() * 6.28 }));
      s.start = s.data.startAct || 0;
    },
    resize(s) {
      s.bg = leather(s);
      s.split = s.w >= 900;
    },
    draw(s, t) {
      const { g, w, h } = s;
      g.imageSmoothingQuality = "high"; // the plates are big; shrinking them roughly makes moiré
      g.drawImage(s.bg, 0, 0, w, h);

      const time = t + s.start * SECONDS_PER_ACT;
      const index = actAt(time);
      const into = time % SECONDS_PER_ACT;
      const fadeIn = clamp(into / FADE, 0, 1);
      const nextIndex = (index + 1) % ACTS.length;
      plateImage(ACTS[nextIndex].plate); // start loading the next one early
      s.act = index;

      const drawPlate = (i, alpha, progress) => {
        const img = plateImage(ACTS[i].plate);
        if (!img.complete || !img.naturalWidth) return;
        if (!s.gilded[i]) s.gilded[i] = gild(img);
        let plate = s.gilded[i];
        if (s.thumb) plate = shrink(plate, 4);
        const ph = s.split ? h * 0.8 : h * 0.7;
        const pw = ph * (plate.width / plate.height);
        const zoom = 1 + progress * 0.05;
        const cx = (s.split ? w * 0.26 : w * 0.5) - s.look.x * 8;
        const cy = h * 0.5 - s.look.y * 5;
        g.save();
        g.globalAlpha = alpha * (s.split ? 0.92 : 0.38);
        g.translate(cx, cy);
        g.scale(zoom, zoom);
        g.drawImage(plate, -pw / 2, -ph / 2, pw, ph);
        if (s.split) {
          g.strokeStyle = "rgba(214, 178, 102, 0.55)";
          g.lineWidth = 1.2 / zoom;
          g.strokeRect(-pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 20);
          g.strokeStyle = "rgba(214, 178, 102, 0.25)";
          g.strokeRect(-pw / 2 - 15, -ph / 2 - 15, pw + 30, ph + 30);
        }
        g.restore();
      };
      if (fadeIn < 1 && !s.still && !s.thumb) drawPlate((index - 1 + ACTS.length) % ACTS.length, 1 - fadeIn, 1);
      drawPlate(index, s.still || s.thumb ? 1 : fadeIn, into / SECONDS_PER_ACT);

      // soften the plate's edges into the leather
      const cx = s.split ? w * 0.26 : w * 0.5;
      const edge = g.createRadialGradient(cx, h / 2, Math.min(w, h) * 0.3, cx, h / 2, Math.max(w, h) * 0.62);
      edge.addColorStop(0, "rgba(10, 3, 4, 0)");
      edge.addColorStop(1, "rgba(10, 3, 4, 0.75)");
      g.fillStyle = edge;
      g.fillRect(0, 0, w, h);

      // black feathers, edged in gold
      if (!s.still) {
        s.feathers.forEach(f => {
          f.y += f.speed * (s.dt || 0);
          if (f.y > 1.1) { f.y = -0.1; f.x = Math.random(); }
          g.save();
          g.translate(f.x * w + Math.sin(t * 0.4 + f.sway) * 30, f.y * h);
          g.rotate(f.spin + Math.sin(t * 0.6 + f.sway) * 0.6);
          g.fillStyle = "rgba(6, 3, 4, 0.85)";
          feather(g, f.size);
          g.restore();
        });
      }
    }
  };

  WP.register({
    id: "loveless",
    name: "LOVELESS",
    group: "drawn",
    blurb: "My LOVELESS book's engravings in gold, with the poem's lines, act by act.",
    layout: "split",
    scene,
    thumb(canvas) {
      const img = plateImage("act1");
      const draw = () => WP.renderSceneThumb(scene, canvas, { startAct: 1 });
      if (img.complete && img.naturalWidth) draw();
      else img.addEventListener("load", draw, { once: true });
    },
    mount(ctx) {
      // start on a different act each day
      const startAct = WP.hash(new Date().toDateString()) % ACTS.length;
      const view = ctx.canvas(scene, { startAct });
      let shown = -1;
      const update = () => {
        const act = view.s.act === undefined ? startAct : view.s.act;
        if (act === shown) return;
        shown = act;
        const a = ACTS[act];
        ctx.setQuote({ text: a.lines.join("\n"), by: "LOVELESS, " + a.title, verse: true });
        if (ctx.still) view.redraw();
      };
      update();
      ctx.every(1000, update, false);
      // in still mode the first plate may arrive after the first frame
      if (ctx.still) {
        const img = plateImage(ACTS[startAct].plate);
        img.addEventListener("load", () => view.redraw(), { once: true });
      }
    }
  });
})();
