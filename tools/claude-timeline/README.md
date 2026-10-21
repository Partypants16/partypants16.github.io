# The Claude page

A timeline of everything Parth has used Claude for in `parth_project`, built
from the session logs in `parth_project/_workspace/context/sessions/`. Each log is a card
with a clean title, summary, project, type, status and the time it was started. Every card opens to
show its raw log, and "Show all raw logs" opens them all. Filters (search,
project, type, status, month, order) are at the top and are kept in the
address, so a filtered view can be bookmarked.

**It's only on the home network:** http://192.168.212.60:8120 on the remote
box. The raw logs hold everything (Coles work, logins, family details), so
they never go on the public website. It's a section of **Projects** (since
2026-10-21): the top bar's Projects link opens the public showcase
(`projects.html`), and its **Claude** tab goes to `claude.html` on the
website, which forwards to the box. This page has the same Showcase / Claude
tabs (styles from `projects.css`), so the way back is the Showcase tab. Off home Wi-Fi, the
box's address doesn't answer, so after 3 seconds it stops trying and says to
connect to home Wi-Fi.

## Files

| File | What it is |
|---|---|
| `build.py` | Reads the logs + `_workspace/context/LOG.md` and writes `dist/`: the page, `data.json`, and copies of the site files it shares (top bar styles, the Projects tabs, settings, Hinglish, transitions, wallpapers). It also copies every `.html` page saved in `parth_project/discontinued/<project>/` to `/discontinued/<project>/`, so pages like Artifact reviews open on the LAN without a Claude sign-in. |
| `page/` | The page itself: `index.html`, `claude.js`, `claude.css`. |
| `deploy.py` | Runs `build.py`, then uploads `dist/` to `~/claude-timeline/` on the box and restarts the container. |
| `update_site.py`, `Caddyfile`, `docker-compose.yml` | The box side: container `claude-timeline` (`caddy:2-alpine`, port 8120 → 80, `restart: unless-stopped`), same setup as Apex Dash. |
| `dist/` | The build. **Git-ignored and must never be committed**: it's the full logs, and this repo is public. |
| `../../claude.html` | The public gateway page the Projects page's Claude tab links to. |

## Updating it

From `my-website/`:

```
python tools/claude-timeline/deploy.py          # build + deploy (asks for the box password,
                                                # or set REMOTE_BOX_PW)
python tools/claude-timeline/build.py           # build only, to look at dist/ locally
python tools/claude-timeline/build.py --strict  # warnings stop the build
```

Needs `pip install pyyaml markdown-it-py`, and PuTTY for deploying. The site
files are copied in at build time, so after changing `settings.js`,
`hinglish.js`, `movies.css` etc., redeploy here too.

The workspace's standing logging rule (root `CLAUDE.md`) says to rebuild and
deploy after every session log, so the page stays current without Parth doing
anything.

## The card fields (frontmatter)

Every session file starts with:

```yaml
---
title: "CrossPaste card on the home page"
date: 2026-10-14
time: "21:18"
projects: [Website, CrossPaste]
type: Built
status: Done
summary: "Added a CrossPaste card to the home page ... (1-2 sentences, at most 240 characters)"
---
```

- **title**: at most 60 characters, no project prefix (the project is a chip).
- **time**: when the log was started, 24-hour local time, **in quotes** (YAML
  reads an unquoted `21:18` as a number; `build.py` copes, but quote it). It's
  shown on the right of the card in the site's 12/24 h clock format, and orders
  cards within a day. Optional: a log without one shows just the day. The
  times on logs before 2026-10-21 were backfilled from Claude Code's
  transcripts (the first write of each file). The 8 oldest logs have no
  transcript, so they have no time.
- **projects**: main project first. Names: Website, Apex Dash, Claire, Iris,
  PAT-AI, PrintPlace, SkyWardrobe, StaySafe, CrossPaste, Sonic, Gaming Archive,
  NovaDiagnostics, n8n, Coles, Remote box, Music, Physical projects, Photos,
  OpenRecall, Workspace. To add one, add it to `PROJECTS` in `build.py`.
- **type**: Built, Improved, Fixed, Ideas, Research, Setup, Sync or Docs.
- **status**: Done, Needs testing, Open or Parked.

The older logs also keep `project`, `participants` and `status_note` in the
block. Those aren't shown on the card. A log without a block (or with a value
that isn't on the lists) still shows up, using its heading, with a
"No summary yet" badge, and `build.py` prints a warning for it.

## How the pieces talk

- The website and the box are different sites, so settings saved in the
  browser aren't shared. `claude.html` passes theme, accent, wallpaper,
  language, clock and transitions along in the link (`#settings=…`), and the
  page copies them in before anything draws. Changes made on the box's copy
  stay there.
- Links work both ways: `claude.html?project=Coles#2026-10-14-…` lands on the
  same filter and card. Links inside a raw log to another session log jump to
  that card. Links to other files in the workspace are shown, not clickable.
- Off home Wi-Fi, some networks reject the address straight away instead of
  ignoring it. Then the browser shows its own "can't be reached" page instead
  of the message.
