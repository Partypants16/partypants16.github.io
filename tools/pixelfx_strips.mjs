// Pre-renders the few pixelfx effects the site uses into one-row PNG strips in images/pixelfx/, which
// pixelfx.css plays with a CSS steps() animation (no script). pixelfx (MIT, https://github.com/patch-gg/pixelfx)
// is not part of the site: clone it anywhere, pin the commit, and point this at it:
//   git clone https://github.com/patch-gg/pixelfx && git -C pixelfx checkout a84159688af3ca37a4be05a0d422b94451b2e24e
//   node tools/pixelfx_strips.mjs <path to pixelfx>
// It prints each strip's frame size, frame count and speed: pixelfx.css needs them (--w, --h, --n, --t).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const GOLD = ["#2a1604", "#5e3208", "#a05c0c", "#e09414", "#ffc626", "#ffe866", "#fff8c4", "#ffffff"];
// key -> effect id, its options, frame rate, and the part of it to keep (seconds)
const STRIPS = {
  sparkle: { id: "pickups/collect-burst", options: { palette: GOLD }, fps: 30 }, // Games page: hovering a game card
  go: { id: "ui/countdown", options: { from: 1 }, fps: 20, from: 0.56 }, // a game's story page: hovering Play (only the GO! burst)
  ghost: { id: "critters/ghost", options: {}, fps: 20 }, // 404 page (loops)
};

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = path.join(path.dirname(HERE), "images", "pixelfx");
const PFX = path.resolve(process.argv[2] ?? process.env.PIXELFX_DIR ?? "");
if (!fs.existsSync(path.join(PFX, "tools", "lib", "fxlib.mjs"))) {
  console.error("usage: node tools/pixelfx_strips.mjs <path to a pixelfx checkout>");
  process.exit(1);
}
const { loadEffect, renderFrames, canvas } = await import(pathToFileURL(path.join(PFX, "tools", "lib", "fxlib.mjs")).href);

fs.mkdirSync(OUT, { recursive: true });
for (const [key, s] of Object.entries(STRIPS)) {
  const fx = await loadEffect(s.id);
  const r = renderFrames(fx, { bg: "none", fps: s.fps, options: s.options });
  const frames = r.frames.filter((f) => f.t >= (s.from ?? 0) - 1e-6);
  const { w, h } = r, n = frames.length;
  const img = canvas(n * w, h, [0, 0, 0, 0]);
  frames.forEach((f, i) => img.paste(f.clear, w, h, i * w, 0));
  fs.writeFileSync(path.join(OUT, `${key}.png`), img.png());
  console.log(`${key.padEnd(8)} ${s.id.padEnd(22)} --w: ${w}; --h: ${h}; --n: ${n}; --t: ${(n / s.fps).toFixed(2)}s; pivot ${fx.meta.origin}${fx.meta.loop ? "  (loops)" : ""}`);
}
// 256-colour PNGs are ~6x smaller and look the same (pixel art has few colours); needs Python + Pillow
const pngs = Object.keys(STRIPS).map((k) => path.join(OUT, `${k}.png`));
const q = spawnSync("python", ["-c", "import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n Image.open(f).convert('RGBA').quantize(256, method=Image.Quantize.FASTOCTREE).save(f, optimize=True)", ...pngs], { encoding: "utf8" });
if (q.status === 0) console.log(`quantised to 256 colours: ${(pngs.reduce((a, f) => a + fs.statSync(f).size, 0) / 1024).toFixed(0)} KB in all`);
else console.warn("Python + Pillow not found: strips left full colour (bigger, same look)");
// the MIT notice goes with the pictures
fs.copyFileSync(path.join(PFX, "LICENSE"), path.join(OUT, "LICENSE.txt"));
