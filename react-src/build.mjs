// Bundles each React page into one plain (non-module) script at the site root,
// so the pages still work from GitHub Pages, a local server, or a double-clicked file.
//
//   npm run build      (from react-src/)  -> ../music-explorer.js, ../movie-tracker.js
//   npm run watch      rebuilds on every save
//
// The built files are committed (GitHub Pages has no build step). Don't edit them by hand.

import * as esbuild from "esbuild";

const pages = {
  "music-explorer": "src/music/main.jsx",
  "movie-tracker": "src/movies/main.jsx",
};

const options = {
  entryPoints: Object.fromEntries(Object.entries(pages).map(([out, src]) => [out, src])),
  outdir: "..",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: "// Built from react-src/ by `npm run build`. Don't edit by hand." },
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
