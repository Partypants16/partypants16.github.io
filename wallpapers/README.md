# Wallpapers

The Wallpaper page (`wallpaper.html`) shows one full-screen wallpaper behind a
clock, the date and a quote. Each wallpaper is one file in this folder. The
engine they share is `../wallpaper.js`, and their styles are in `../wallpaper.css`.

## The wallpapers

| Group | id (for `?w=`) | File | What it does | Data |
|---|---|---|---|---|
| Live | `weather` | `weather.js` | Melbourne skyline under the real weather: rain, fog, storms, cloud, wind | Open-Meteo, every 15 min |
| Live | `day-night` | `day-night.js` | Hills under the real sky: sunrise, golden hour, moon phase, stars | worked out on the spot |
| Live | `f1` | `f1.js` | Countdown to the next F1 session, the weekend in your time, the last podium | Jolpica F1 API |
| Live | `now-playing` | `now-playing.js` | What Parth is playing, with a wallpaper to match the game | gaming feed (not built yet, see below) |
| Live | `now-listening` | `now-listening.js` | The song on Navidrome, on a spinning record | ListenBrainz (needs setting up, see below) |
| Drawn | `night-drive` | `night-drive.js` | Synthwave road. Mouse steers, hold to boost | none |
| Drawn | `aurora` | `aurora.js` | Southern lights over mountains and a lake | none |
| Drawn | `rain-glass` | `rain-glass.js` | Misted window. Drag to wipe it | none |
| Drawn | `starfield` | `starfield.js` | Space. Hold the mouse or Space to warp | none |
| Drawn | `loveless` | `loveless.js` | The LOVELESS book's plates in gold, with each act's lines | images in `../wallpaper-files/loveless/` |
| Video | `winter-forest`, `ff7-remake` | `videos.js` | The two videos | `../wallpaper-files/` |
| Tools | `start-page` | `start-page.js` | Search box + quick links with the home server's status dots | the service-status Gist |
| Tools | `focus` | `focus.js` | Pomodoro timer | none |
| Tools | `countdowns` | `countdowns.js` | Countdowns (list in `countdown-dates.js`), plus your own | the F1 calendar, for the next race |

`quotes.js` holds the quotes, which are grouped into sets (`general`, `racing`,
`ff7`, `space`, ...). Each wallpaper names its set.

## Using the page

- 🎨 opens the picker. Your choice is remembered, and **Copy a link** gives a
  `wallpaper.html?w=<id>` link to it.
- ← / → flip through the wallpapers. **F** (or ⛶) is ambient mode: full screen,
  the controls hide after 3 s, and the screen stays on. For a screen that should
  always show it (for example the book computer), open
  `wallpaper.html?w=day-night&ambient=1`.
- The settings gear has a **Wallpaper** section: seconds, the quote (daily /
  motto / hidden), how dark the wallpaper is, and movement. On **Auto**, the
  videos become still pictures on phones and with data saver, and everything
  stops moving when the device asks for less motion. The 12/24-hour clock is
  site-wide, under **Language and time**.
- As a browser home page: `.../wallpaper.html?w=start-page`. Press **/** to search.

## Trying things out (address options)

| Option | Example | Does |
|---|---|---|
| `wx`, `wxday` | `?w=weather&wx=95&wxday=0` | any weather (a WMO code), at night (0) or day (1) |
| `time`, `speed` | `?w=day-night&time=19:40&speed=600` | a Melbourne time of day, sped up |
| `game`, `platform` | `?w=now-playing&game=Forza%20Horizon%205&platform=steam` | pretend something is being played |
| `lb` | `?w=now-listening&lb=<ListenBrainz user>` | someone else's listening |
| `track`, `artist`, `album` | `?w=now-listening&track=Kesariya&artist=Arijit%20Singh` | pretend a song is playing |

## Switching on the two feeds

**Now Listening (music).** It reads ListenBrainz, so no server is needed:

1. Make a free account at listenbrainz.org and copy your user token (Settings → User token).
2. In Navidrome: your avatar → Personal → ListenBrainz, then paste the token.
3. Put the ListenBrainz username in `LISTENBRAINZ_USER` at the top of `now-listening.js`.

It only knows about songs whose player tells Navidrome what's playing.
Navidrome's own web player does. Once this is switched on, what's playing is
public on the site.

**Now Playing (games).** This needs the home server to publish a small JSON
file, the same way it publishes the service status
(`../tools/service-status/`). That script isn't written yet. When it is, put its
raw Gist URL in `GAMING_FEED_URL` at the top of `now-playing.js`. The page
expects:

```json
{
  "checked_at": "2026-10-21T09:00:00Z",
  "heartbeat_minutes": 15,
  "now_playing": { "title": "Forza Horizon 5", "platform": "steam", "since": "2026-10-21T08:20:00Z" },
  "last_played": { "title": "Gran Turismo 7", "platform": "psn", "at": "2026-10-20T20:00:00Z" }
}
```

`now_playing` is `null` when nothing is on. Platforms are `steam`, `psn`,
`xbox`, `epic` and `nintendo`. If `checked_at` is older than two heartbeats
plus 10 minutes, the page says the status is out of date. Which games bring up
which wallpaper is set in `MATCHES` in `now-playing.js`.

## Adding a wallpaper

1. Make `wallpapers/<name>.js`, and add a `<script defer>` for it in
   `wallpaper.html` (picker order follows script order within each group).
2. Register it:

```js
WP.register({
  id: "my-thing",            // used in ?w= and saved choices; don't rename later
  name: "My Thing",
  group: "drawn",            // live | drawn | video | tools
  blurb: "One line for the picker.",
  quotes: "general",         // a set in quotes.js
  layout: "clock",           // clock (default) | tool | split | left
  scene,                     // optional: a canvas scene, also used for its thumbnail
  mount(ctx) { ctx.canvas(scene); }
});
```

A **scene** is `{ setup(s), resize(s), data(s), step(s, dt), draw(s, t) }`.
Only `draw` is required. `s.g` is the 2D context and `s.w` / `s.h` the size in
CSS pixels. `s.look` is the pointer smoothed to -1..1, `s.pointer.down` means
held on the wallpaper, and `s.data` is whatever `handle.setData()` was given.
`s.still` and `s.thumb` say whether it's a single frame. Thumbnails are drawn
as if on a 1280×720 screen.

`ctx` (what `mount` gets) has `info(...nodes)` for the line under the date,
`setQuote()`, `canvas(scene, data)`, `video(src, poster)`, and
`every(ms, fn)`, `after()`, `on()` and `getJSON(url, { ttl, cacheKey })`. Timers,
listeners and requests made through `ctx` stop by themselves when another
wallpaper is picked. `WP` has shared helpers: colours, times and countdowns, sun
position and sunrise/sunset, the moon phase, stars and clouds.

## Behind other pages

Settings → Appearance → **Wallpaper behind every page** puts one of these behind
every page except this one. `settings.js` loads `wallpaper.js` and the
wallpaper's file only when one is picked, then calls
`WP.mountBackdrop(container, id, { still, scene })`. Drawn ones run just their
scene; Day & Night and Weather run as themselves without their info line. The
list is `BACKDROPS` in `settings.js`.

## Hinglish

The whole page can be in Hinglish (`../i18n.js` and `../hinglish.js`). Text a
wallpaper shows is translated if `hinglish.js` has it, so when you add words,
add their Hinglish there too. Put data (song and game titles, race names) in
`WP.keep()`, which marks it `translate="no"`. Build lines of several facts with
`WP.bits()`, so each fact is translated on its own.

## Images

`python tools/build_wallpaper_images.py` (from `my-website/`) rebuilds the video
stills and thumbnails, the LOVELESS plates (drawn by the book's own code in
`physical_projects/.../loveless_book/build`) and the cut-down EB Garamond font
(OFL, licence in `../wallpaper-files/fonts/`).
