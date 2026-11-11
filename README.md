# Parth's Palace

My personal website: **[partypants16.github.io](https://partypants16.github.io/)**

A hand-built static site with plain HTML, CSS and JavaScript. It has no framework and no build step, and GitHub Pages serves it straight from this repo. It's where I keep my projects, my gaming, my movie lists, a set of wallpapers, and links to the services I self-host at home.

## What's on it

| Page | What it is |
|---|---|
| **Home** (`index.html`) | Swipe cards at the top (welcome, Vibe Testing Zone, Car Shows), then the *LAN Only* services I run on my home server, each with a live Online/Offline dot. |
| **Wallpaper** (`wallpaper.html`) | 15 live wallpapers (animated scenes, Melbourne weather, countdowns, quotes, F1 and more) to view full screen. |
| **Games** (`gaming.html`) | My gaming platforms, what I'm playing, and my own games under "My Games". |
| **Media** (`media.html`) | Movies (recommendation lists plus franchise trackers like Marvel) and Music (`music.html`): my Spotify history since 2017 in charts (top artists, songs and albums, when I listen, every day, devices, and how it changed year by year), from a summary made by `tools/build_music_data.py`. |
| **Music Explorer** (`music-explorer.html`) | Every artist and song I've played since 2017: pick a year, click an artist or song to see when I played it, search everything, or compare two years side by side. A React page. |
| **Movie Tracker** (`movie-tracker.html`) | Tick off films in each franchise and recommendation list, see progress bars and the next film in watch order. Starts from the shared spreadsheet's marks; ticks are saved in your browser. A React page. |
| **Car Shows** (`car-events.html`) | Car shows, meets, cruises and track days coming up around Melbourne and Victoria, from three event sites (Trading Garage, Drivesome, Shannons Club), grouped into this weekend and then by month, with a type filter. See "Car Shows data" below. |
| **Projects** (`projects.html`) | A showcase of things I've built. Each one has a story page (`project.html?p=<slug>`) covering the journey, the big decisions, a timeline, what didn't work and what I learned. |
| **Profile** (`profile.html`) | About me. Click the **PS** logo in the top bar to get there. |
| **Page not found** (`404.html`) | What GitHub Pages shows for an address that doesn't exist: a pixel-art ghost and links home. |

Some tabs under Projects (Memory, To do, Encyclopedia) only work on my home network. The pages in this repo just forward you there.

## Features

- **Settings panel** (the gear in the top bar): light/dark theme, accent colour, a wallpaper behind every page, language, page transitions and keyboard shortcuts, all saved in your browser.
- **Hinglish mode**: the whole site can switch between English and Hinglish.
- **Page transitions** in four levels: Off, Subtle (default), Full and Extreme.
- Works on phones down to 360px wide.
- **Pixel-art touches** (`pixelfx.css`): a gold sparkle when you point at one of my games on the Games page, a GO! burst from a game's Play button, and the 404 ghost. They're one-row PNG strips in `images/pixelfx/`, pre-rendered from [pixelfx](https://github.com/patch-gg/pixelfx) (MIT, licence in that folder) by `tools/pixelfx_strips.mjs`, and played by CSS alone. Transitions set to Off hide them.

## The React pages

Music Explorer and Movie Tracker are built with React 19. Their source is in `react-src/` and gets bundled by esbuild into one plain script each at the root (`music-explorer.js`, `movie-tracker.js`). Those built files are committed, so GitHub Pages still needs no build step, and the pages still open as plain files. The HTML pages around them are hand-written like every other page (same top bar, settings, Hinglish and transitions).

After changing anything in `react-src/src/`:

```sh
cd react-src
npm install        # first time only
npm run build      # or: npm run watch
```

Then commit the rebuilt `.js` files with the source. Don't edit the built files by hand. Visible text still needs its Hinglish line in `hinglish.js`; put names and titles in `translate="no"`, and build each sentence as one string (not `{n} plays` split into pieces) so the Hinglish switch sees it whole.

## Car Shows data

`data/car-events.json` is made by **n8n on my home server**, not by hand. Never edit it.

- n8n's *Car Events - Scraper* workflow reads the three sites every morning at 4am and saves the list on the server. Its *Car Events - Weekly Digest* sends me the week's shows on Discord every Monday at 7am. The workflows live in `apps/n8n-home/workflows/` in my workspace.
- The file reaches this site **with the next commit**: a git pre-commit hook runs `tools/car_events/pull_car_events.py --stage`, which fetches the latest list from n8n (home Wi-Fi only) and adds it to the commit. If n8n can't be reached it changes nothing, and the commit still goes through. So the page is as fresh as the last push.
- To refresh the page on its own: `python tools/car_events/pull_car_events.py`, then commit and push.
- One-time setup per clone: `python tools/car_events/install_hook.py`, plus the n8n address in `tools/car_events/source_url.txt` (git-ignored; it's a home-network address, so it never goes in this public repo).
- The page hides events that have already happened, so a list that's a few days old still looks right.

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
  - `build_music_data.py` regenerates `music-data.js` and `music-explorer-data.js` from the git-ignored Spotify export.
  - `build_wallpaper_images.py` draws the images some wallpapers use.
  - `pixelfx_strips.mjs` re-renders the pixel-art strips in `images/pixelfx/` from a pixelfx checkout (it says how).
  - [`service-status/`](tools/service-status/README.md) is the checker behind the Online/Offline dots.
  - [`claude-timeline/`](tools/claude-timeline/README.md) builds the LAN-only Memory, To do and Encyclopedia pages.

## Adding to it

- Every page loads `motion.js` and `motion.css`, or page transitions skip it.
- New visible text needs a matching line in `hinglish.js`. Names and titles stay untranslated (`translate="no"`).
- New settings go in `SETTINGS_SECTIONS` in `settings.js`.
