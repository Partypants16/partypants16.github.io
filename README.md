# Parth's Palace

My personal website: **[partypants16.github.io](https://partypants16.github.io/)**

A hand-built static site with plain HTML, CSS and JavaScript. It has no framework and no build step, and GitHub Pages serves it straight from this repo. It's where I keep my projects, my gaming, my movie lists, a set of wallpapers, and links to the services I self-host at home.

## What's on it

| Page | What it is |
|---|---|
| **Home** (`index.html`) | Welcome cards and two groups of links: *LAN Only* services I run on my home server (each with a live Online/Offline dot), and *Projects & Ideas*. |
| **Wallpaper** (`wallpaper.html`) | 15 live wallpapers (animated scenes, Melbourne weather, countdowns, quotes, F1 and more) to view full screen. |
| **Games** (`gaming.html`) | My gaming platforms, what I'm playing, and my own games under "My Games". |
| **Media** (`media.html`) | Movies (recommendation lists plus franchise trackers like Marvel) and Music (coming soon). |
| **Projects** (`projects.html`) | A showcase of things I've built. Each one has a story page (`project.html?p=<slug>`) covering the journey, the big decisions, a timeline, what didn't work and what I learned. |
| **Profile** (`profile.html`) | About me. Click the **PS** logo in the top bar to get there. |

Some tabs under Projects (Memory, To do, Encyclopedia) only work on my home network. The pages in this repo just forward you there.

## Features

- **Settings panel** (the gear in the top bar): light/dark theme, accent colour, a wallpaper behind every page, language, page transitions and keyboard shortcuts, all saved in your browser.
- **Hinglish mode**: the whole site can switch between English and Hinglish.
- **Page transitions** in four levels: Off, Subtle (default), Full and Extreme.
- Works on phones down to 360px wide.

## Running it locally

There's nothing to install. Open `index.html` in a browser, or serve the folder:

```sh
python -m http.server 8000
```

Then go to <http://localhost:8000>.

## How it's organised

- One `.html` page per section, with its own `.css` and `.js` where needed.
- Shared across pages: `style.css`, `settings.js`/`settings.css`, `motion.js`/`motion.css`, and `i18n.js` + `hinglish.js` for the language switch.
- Data files: `projects-data.js` (project stories), `movie-lists.js`, and `franchise-data.js` (generated, see below).
- `wallpapers/` holds one file per wallpaper, run by `wallpaper.js` (see [`wallpapers/README.md`](wallpapers/README.md)).
- `images/`, `wallpaper-files/` and `cert-files/` hold images and certificates.
- `vibe-testing-zone/` is a playground for experiments.
- `tools/` holds helper scripts:
  - `build_franchise_data.py` regenerates `franchise-data.js` (don't edit that file by hand).
  - `build_wallpaper_images.py` draws the images some wallpapers use.
  - [`service-status/`](tools/service-status/README.md) is the checker behind the Online/Offline dots.
  - [`claude-timeline/`](tools/claude-timeline/README.md) builds the LAN-only Memory, To do and Encyclopedia pages.

## Adding to it

- Every page loads `motion.js` and `motion.css`, or page transitions skip it.
- New visible text needs a matching line in `hinglish.js`. Names and titles stay untranslated (`translate="no"`).
- New settings go in `SETTINGS_SECTIONS` in `settings.js`.
