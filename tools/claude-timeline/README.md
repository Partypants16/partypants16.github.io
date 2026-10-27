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
(`projects.html`), and its **Memory** tab (since 2026-10-27) goes to
`memory.html` on the website, which forwards to the box's Memory page: one
card for this timeline and one for its ChatGPT twin (below), with their
counts and newest session, from a small `memory.json` the build writes. Both
timelines have a Claude | ChatGPT switch under the tabs, and the Memory tab
leads back to the cards. `claude.html` still forwards straight to this
timeline, for old links. These pages have the same Showcase / Memory / To do
/ Encyclopedia tabs (styles from `projects.css`), so the way back is the Showcase tab. Off home Wi-Fi, the
box's address doesn't answer, so after 3 seconds it stops trying and says to
connect to home Wi-Fi.

The same build makes a twin of it, **ChatGPT** (`chatgpt.html`, since
2026-10-27): the same timeline for work done with ChatGPT or Codex, from its own
records in `parth_project/_workspace/context/chatgpt/`. It's drawn by the same
`claude.js`, with its own data file (`chatgpt-data.json`; the two are never
mixed). Each card also says where it came from (Codex or ChatGPT, a historical
import or logged during the session), opens to **Show session details** (the
write-up), and, where the chat itself was saved, **Show conversation record**:
the messages in order, labelled Parth / Codex, never called a transcript if it
isn't one. See [The ChatGPT page](#the-chatgpt-page) below.

The same build makes another page, **To do** (`todo.html`, since 2026-10-21):
what's waiting on Parth across `parth_project`. It's LAN-only for the same
reason (it names Coles work), and the website's `todo.html` is its gateway.

It's one short text, like a message: `parth_project/_workspace/context/TODO.md`,
shown as it is, with numbered sections (uncommitted work, tests only Parth can
run, decisions he owes, things he parked) and "My pick" at the end, which the
page sets apart. Every session rewrites it (step 3 of the logging rule in the
root `CLAUDE.md`).

The build writes section 1 itself, in place of the file's `{{git}}` line:
`todo.py` finds every git repo in `parth_project` and adds a line for each one
with uncommitted files, commits not pushed, no remote, or a remote that isn't
Parth's. It's this laptop's state at build time, and nothing is fetched first.

Under the text: when it was last written (the file's time), when git was
checked, and any session logged since it was written, in case they left
something that isn't in it yet.

The build also makes the **Encyclopedia** (`encyclopedia/`, since 2026-10-22):
everything about the home server and `parth_project`, as reference pages, from
the Markdown in `parth_project/_workspace/encyclopedia/` (`encyclopedia.py`,
which has the full description at the top). It's the fourth tab of Projects,
LAN-only like the other two, with the website's `encyclopedia.html` as its
gateway. One static HTML page per `.md` file, a sidebar of every page, search
in the browser (`search.json`), code colours from Pygments at build time, and
Mermaid diagrams from a local copy of `mermaid.min.js` (fetched once into
`vendor/`, git-ignored). The Markdown is the only thing to edit; the next
deploy ships it. A link to a page that doesn't exist is a build warning.

## Files

| File | What it is |
|---|---|
| `build.py` | Reads the logs + `_workspace/context/LOG.md` and writes `dist/`: the pages, `data.json`, `todo.json` (from `todo.py`), and copies of the site files it shares (top bar styles, the Projects tabs, settings, Hinglish, transitions, wallpapers). It also copies every `.html` page saved in `parth_project/discontinued/<project>/` to `/discontinued/<project>/`, so pages like Artifact reviews open on the LAN without a Claude sign-in. |
| `chatgpt.py` | The ChatGPT page's extra card fields (where a session came from) and its conversation records, for `build.py`. |
| `import_chatgpt.py` | Imports chats into `_workspace/context/chatgpt/`: Codex's local records (read only) or a ChatGPT export, by chat id, without duplicates. |
| `tests/` | `test_chatgpt.py`: the importer and the build on made-up chats (nothing real). |
| `todo.py` | The To do page's text: `_workspace/context/TODO.md`, with section 1 written from what git says about every repo. |
| `encyclopedia.py` | The Encyclopedia: renders `_workspace/encyclopedia/**/*.md` into `dist/encyclopedia/` (pages, `search.json`, `pygments.css`, Mermaid). |
| `page/` | The pages: `memory.html`, `memory.js`, `memory.css` (Memory: the two cards); `index.html`, `claude.js`, `claude.css` (Claude; `chatgpt.html` is the ChatGPT page, the same script and styles) and `todo.html`, `todo.js`, `todo.css` (To do). `handoff.js` copies in the settings the website passes along, on all of them. |
| `page/encyclopedia/` | The Encyclopedia's template (`_template.html`, filled per page), `encyclopedia.css` and `encyclopedia.js` (search, sidebar on a phone, copy buttons, Mermaid). |
| `vendor/` | `mermaid.min.js` (3.5 MB), fetched once by the build. Git-ignored. |
| `deploy.py` | Runs `build.py`, then uploads `dist/` to `~/claude-timeline/` on the box and restarts the container. |
| `update_site.py`, `Caddyfile`, `docker-compose.yml` | The box side: container `claude-timeline` (`caddy:2-alpine`, port 8120 → 80, `restart: unless-stopped`), same setup as Apex Dash. |
| `dist/` | The build. **Git-ignored and must never be committed**: it's the full logs, the ChatGPT conversations and the to-do list, and this repo is public. |
| `../../memory.html`, `../../todo.html`, `../../encyclopedia.html` | The public gateway pages the Memory, To do and Encyclopedia tabs link to. `../../claude.html` and `../../chatgpt.html` go straight to one timeline (for old links and deep links). All use `../../lan-gateway.js`. |

## Updating it

From `my-website/`:

```
python tools/claude-timeline/deploy.py          # build + deploy (asks for the box password,
                                                # or set REMOTE_BOX_PW)
python tools/claude-timeline/build.py           # build only, to look at dist/ locally
python tools/claude-timeline/build.py --strict  # warnings stop the build
python tools/claude-timeline/import_chatgpt.py  # bring in new Codex chats (see below)
python -m unittest discover -s tools/claude-timeline/tests
```

Needs `pip install pyyaml markdown-it-py pygments` (and `zstandard` to import older Codex chats), and PuTTY for deploying. The site
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

## The ChatGPT page

Its records live outside this repo, in `parth_project/_workspace/context/chatgpt/`
(that folder's `README.md` is the full description):

- `LOG.md` and `sessions/*.md`: the same shape as Claude's. A session's
  frontmatter has the card fields above plus where it came from: `source`
  (Codex or ChatGPT), `chat_id`, `chat_title`, `record` (Historical import or
  Maintained), `imported`, `completeness` (Complete, Partial or Not available),
  `gaps`, and `conversation: true` to show its conversation record.
  `build.py --strict` checks those too.
- `sources/<chat-id>.json`: a chat's conversation record (messages, their times
  in Australia/Sydney, attachment names, a note of the tools used between
  messages). `sources/manifest.json` lists every chat by id, plus chats known
  about but not imported (`known_missing`, shown on the page as "Not
  imported"). Only the messages of a session that says `conversation: true`
  go into the build. The rest of `sources/` never does.

`import_chatgpt.py` fills `sources/` and makes a skeleton write-up for a chat
that has none. It skips scripted `codex exec` runs (`--include-scripted` takes
them), and ends with a "To write up" list: the new chats, and the chats that
went on. Claude runs it at every session close and writes those up (step 6 of
the root `CLAUDE.md` routine). It never touches an existing write-up, so hand corrections stay,
and a second run updates by chat id instead of adding a duplicate. Codex chats
are read from `~/.codex/sessions/` (only those that ran inside `parth_project`).
ChatGPT chats need an account export: `--chatgpt-export conversations.json
--chat <id>`. There's no watcher or scheduled import: chats appear when Codex
follows the root `AGENTS.md` or someone runs the importer.

Conversation text is rendered from Markdown with raw HTML turned off (so a
`<script>` in a chat shows as text), with the same link rules as the logs.

## How the pieces talk

- The website and the box are different sites, so settings saved in the
  browser aren't shared. The gateway pages (`claude.html`, `chatgpt.html`, `todo.html`, `encyclopedia.html`) pass theme, accent,
  wallpaper, language, clock and transitions along in the link
  (`#settings=…`), and `handoff.js` copies them in before anything draws.
  Changes made on the box's copy stay there.
- Links work both ways: `claude.html?project=Coles#2026-10-14-…` (or
  `chatgpt.html?…#…`) lands on the same filter and card. Links inside a raw log
  to another session log jump to that card, on whichever page it's on: a Claude
  log linking to `../chatgpt/sessions/X.md` opens `chatgpt.html#X`, and a
  ChatGPT write-up linking to `../../sessions/Y.md` opens the Claude page's card.
  The To do page and the Encyclopedia follow the same rule. Links to other files in the workspace are shown, not clickable.
- Off home Wi-Fi, some networks reject the address straight away instead of
  ignoring it. Then the browser shows its own "can't be reached" page instead
  of the message.
