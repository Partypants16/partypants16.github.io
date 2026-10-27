"""Build the Claude timeline (the LAN-only "Claude" page) into dist/.

Reads every session log in parth_project/_workspace/context/sessions/ plus the
index in _workspace/context/LOG.md, and writes dist/: the page (from page/), data.json, and copies
of the site files it shares with my-website (top bar, settings, Hinglish,
transitions, wallpapers). deploy.py then puts dist/ on the remote box.

It also builds the ChatGPT page (since 2026-10-27) the same way, from
_workspace/context/chatgpt/ (its own LOG.md and sessions/), into chatgpt-data.json:
never mixed into data.json. Its extra fields are described in chatgpt.py.

    python tools/claude-timeline/build.py            # from my-website/
    python tools/claude-timeline/build.py --strict   # warnings stop the build

Needs PyYAML and markdown-it-py (pip install pyyaml markdown-it-py).

dist/ holds the full, unfiltered logs (Coles work, logins, everything), so it
is git-ignored and must never be committed: this repo is the public website.

Each session file starts with a frontmatter block. The card shows these fields:

    ---
    title: "CrossPaste card on the home page"     (at most 60 characters)
    date: 2026-10-14
    time: "21:18"                                (when the log was started, 24 h, quoted)
    projects: [Website, CrossPaste]              (names from PROJECTS below)
    type: Built                                  (one of TYPES)
    status: Done                                 (one of STATUSES)
    summary: "Added a CrossPaste card ..."        (1-2 sentences, at most 240)
    ---

Other keys (the older logs have project, participants, status_note) are kept
in the file but not shown on the card. A file with no block, or with a field
that doesn't fit the rules, still appears, falls back to its heading, and is
listed as a warning here.
"""

import datetime
import html
import json
import re
import shutil
import sys
from pathlib import Path

import yaml
from markdown_it import MarkdownIt

import todo  # the To do page's text (todo.py, next to this file)
import encyclopedia  # the Encyclopedia tab (encyclopedia.py, next to this file)
import confluence  # its Coles Confluence section (confluence.py, next to this file)
import chatgpt  # the ChatGPT page's extra fields (chatgpt.py, next to this file)

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent                     # my-website/
WORKSPACE = SITE.parent.parent                # parth_project/ (my-website is in apps/ since 2026-10-21)
CONTEXT = WORKSPACE / "_workspace" / "context"
DISCONTINUED = WORKSPACE / "discontinued"     # dropped projects; their saved pages are served too
TODO = CONTEXT / "TODO.md"                    # what's waiting on Parth: the To do page (todo.html)
ENCYCLOPEDIA = WORKSPACE / "_workspace" / "encyclopedia"  # the Encyclopedia's Markdown (since 2026-10-22)
CONFLUENCE = WORKSPACE / "Coles" / "Confluence"  # the Coles Confluence copy, the Encyclopedia's Confluence section (since 2026-10-27)
CHATGPT = CONTEXT / "chatgpt"                 # the ChatGPT page's sessions, index and sources (since 2026-10-27)
DIST = HERE / "dist"

# The two collections of session logs, and the page each one's cards are on.
SESSION_DIRS = {"claude": CONTEXT / "sessions", "chatgpt": CHATGPT / "sessions"}
PAGE_URL = {"claude": "./", "chatgpt": "chatgpt.html"}

# The filter lists show these in this order.
PROJECTS = ["Website", "Apex Dash", "Claire", "Iris", "PAT-AI", "PrintPlace", "SkyWardrobe",
            "StaySafe", "CrossPaste", "Sonic", "Gaming Archive", "NovaDiagnostics", "n8n", "Coles", "Remote box",
            "Music", "Physical projects", "Photos", "OpenRecall", "Workspace"]
TYPES = ["Built", "Improved", "Fixed", "Ideas", "Research", "Setup", "Sync", "Docs"]
STATUSES = ["Done", "Needs testing", "Open", "Parked"]
TITLE_MAX, SUMMARY_MAX = 60, 240

# Files from my-website that the page uses as they are.
SHARED = ["movies.css", "projects.css", "settings.css", "motion.css", "hinglish.js", "i18n.js", "settings.js",
          "motion.js", "wallpaper.js"]
SHARED_DIRS = {"wallpapers": "*.js"}  # the scenes behind "Wallpaper behind every page"

SESSION_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}-[\w.-]+$")
warnings = []


def warn(name, message):
    warnings.append(f"{name}: {message}")


# ---------- Markdown ----------

md = MarkdownIt("commonmark", {"html": False}).enable(["table", "strikethrough"])


def session_collection(path_part, stem, base):
    """Which page a link to a session log goes to: "claude", "chatgpt" or None (not a log)."""
    if base is not None:  # where the link really points, from the file it's in
        target = (base / path_part).resolve()
        for key, folder in SESSION_DIRS.items():
            if target.parent == folder.resolve() and target.exists():
                return key
    # Otherwise by name, the way the Claude logs have always been linked (any path to a log's file).
    if "chatgpt/" in path_part.replace("\\", "/") and (SESSION_DIRS["chatgpt"] / (stem + ".md")).exists():
        return "chatgpt"
    if (SESSION_DIRS["claude"] / (stem + ".md")).exists():
        return "claude"
    return None


def link_kind(href, base=None):
    """web (opens in a new tab), session (jumps to that card, on its own page) or file (shown, not a link)."""
    if re.match(r"^(https?:|mailto:)", href):
        return "web", href
    path_part = href.split("#")[0]
    stem = Path(path_part).stem
    if path_part.endswith(".md") and SESSION_NAME.match(stem):
        which = session_collection(path_part, stem, base)
        if which:
            return "session", (which, stem)
    return "file", href


def render_link_open(self, tokens, idx, options, env):
    kind, target = link_kind(tokens[idx].attrGet("href") or "", env.get("base"))
    page = env.get("page", "claude")
    if kind == "session" and target == (page, env.get("self")):
        kind = "self"  # LOG.md's entry links to its own log: just text on its own card
    env.setdefault("links", []).append(kind)
    if kind == "self":
        return ""
    if kind == "web":
        return f'<a href="{html.escape(target)}" target="_blank" rel="noopener noreferrer">'
    if kind == "session":
        which, stem = target
        if which == page:
            return f'<a href="#{stem}" class="session-link" data-session="{stem}">'
        # A log on the other page (Claude ↔ ChatGPT, or from To do): open it there.
        return f'<a href="{PAGE_URL[which]}#{stem}" class="session-link session-link--other">'
    return f'<span class="file-ref" title="{html.escape(target)}">'


def render_link_close(self, tokens, idx, options, env):
    kind = env["links"].pop()
    return "" if kind == "self" else "</span>" if kind == "file" else "</a>"


def render_image(self, tokens, idx, options, env):
    # The pictures the logs point at aren't on the server, so show what they were.
    token = tokens[idx]
    return f'<span class="file-ref" title="{html.escape(token.attrGet("src") or "")}">[image: {html.escape(token.content)}]</span>'


md.add_render_rule("link_open", render_link_open)
md.add_render_rule("link_close", render_link_close)
md.add_render_rule("image", render_image)


def render(text, name=None, page="claude", base=None):
    """Markdown → HTML for one page ("claude", "chatgpt" or "todo"); base is the folder the text's
    file is in, so its relative links to session logs can be followed."""
    return md.render(text, {"self": name, "page": page, "base": base})


def plain(text):
    """Markdown → rough plain text, for search."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`#>|]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# ---------- Reading the logs ----------

def read_log_index(folder=CONTEXT):
    """LOG.md → {session name: (position, markdown of its entry and any "Then …" lines)}."""
    entries, current = {}, None
    if not (folder / "LOG.md").exists():
        return {}
    lines = (folder / "LOG.md").read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
    for line in lines:
        if line.startswith("- **"):
            found = re.search(r"\]\(sessions/([^)]+)\.md\)", line)
            current = None
            if found:
                current = found.group(1)
                if current in entries:  # mentioned twice: keep the newest (first) line
                    current = None
                else:
                    entries[current] = [len(entries), [line[2:]]]
        elif current and line.startswith("  ") and line.strip():
            entries[current][1].append(line.strip())
        elif not line.strip():
            current = None
    return {name: (pos, "\n\n".join(parts)) for name, (pos, parts) in entries.items()}


def split_frontmatter(text):
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[4:end], text[end + 5:]
    return None, text


def heading_of(body):
    found = re.search(r"^#\s+(.+)$", body, re.M)
    if not found:
        return ""
    title = found.group(1).strip()
    title = re.sub(r"^(Session:\s*)", "", title)
    return re.sub(r"^\d{4}-\d{2}-\d{2}\s*[—–-]+\s*", "", title)


def check(name, meta):
    """The card fields, cleaned. Anything that doesn't fit is warned about and left empty."""
    card = {}
    title = meta.get("title")
    if isinstance(title, str) and title.strip():
        card["title"] = title.strip()
        if len(card["title"]) > TITLE_MAX:
            warn(name, f"title is {len(card['title'])} characters (max {TITLE_MAX})")
    else:
        warn(name, "no title")

    summary = meta.get("summary")
    if isinstance(summary, str) and summary.strip():
        card["summary"] = " ".join(summary.split())
        if len(card["summary"]) > SUMMARY_MAX:
            warn(name, f"summary is {len(card['summary'])} characters (max {SUMMARY_MAX})")
    else:
        warn(name, "no summary")

    projects = meta.get("projects")
    if isinstance(projects, list) and projects:
        unknown = [p for p in projects if p not in PROJECTS]
        if unknown:
            warn(name, "unknown project(s) " + ", ".join(map(str, unknown)))
        card["projects"] = [p for p in projects if p in PROJECTS]
    else:
        warn(name, "no projects list")

    for key, allowed in (("type", TYPES), ("status", STATUSES)):
        value = meta.get(key)
        if value in allowed:
            card[key] = value
        else:
            warn(name, f"{key} {value!r} isn't one of {', '.join(allowed)}")
    return card


def clock(name, value):
    """time: "HH:MM" → "HH:MM", or "" if it's missing or wrong. Unquoted 21:18 reaches here as
    1278 (YAML 1.1 reads it as minutes in base 60), so that's turned back into a time too."""
    if value is None:
        return ""
    if isinstance(value, int) and 0 <= value < 24 * 60:
        return f"{value // 60:02d}:{value % 60:02d}"
    found = re.match(r"^([01]?\d|2[0-3]):([0-5]\d)$", str(value).strip())
    if found:
        return f"{int(found.group(1)):02d}:{found.group(2)}"
    warn(name, f"time {value!r} isn't HH:MM, leaving it off")
    return ""


def read_session(path, log_index, page="claude"):
    """One session file → its card. page is "claude" (_workspace/context/sessions/) or "chatgpt"
    (_workspace/context/chatgpt/sessions/, which also has the provenance fields in chatgpt.py)."""
    name = path.stem
    label = name if page == "claude" else "chatgpt/" + name  # how warnings name it
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n").lstrip("﻿")
    front, body = split_frontmatter(text)
    meta = {}
    if front is None:
        warn(label, "no frontmatter block")
    else:
        try:
            meta = yaml.safe_load(front) or {}
        except yaml.YAMLError as error:
            warn(label, "frontmatter isn't valid YAML: " + str(error).replace("\n", " "))
    if not isinstance(meta, dict):
        meta = {}

    card = check(label, meta) if meta else {}
    file_date = name[:10]
    date = str(meta.get("date") or file_date)
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        warn(label, f"date {date!r} isn't YYYY-MM-DD, using {file_date}")
        date = file_date
    time = clock(label, meta.get("time"))

    heading = heading_of(body)
    position, log_md = log_index.get(name, (None, ""))
    if position is None:
        warn(label, "not listed in LOG.md")

    projects = card.get("projects") or []
    folder = path.parent.parent  # the folder LOG.md is in
    entry = {
        "id": name,
        "date": date,
        "time": time,
        "title": card.get("title") or heading or name,
        "summary": card.get("summary", ""),
        "projects": projects,
        "type": card.get("type", ""),
        "status": card.get("status", ""),
        "heading": heading,
        "file": path.relative_to(WORKSPACE).as_posix(),
        "words": len(body.split()),
        "complete": all(key in card for key in ("title", "summary", "projects", "type", "status")),
        "log": render(log_md, name, page, folder) if log_md else "",
        "raw": render(body, name, page, path.parent),
        "search": " ".join([card.get("title", ""), card.get("summary", ""), heading, " ".join(projects),
                            card.get("type", ""), card.get("status", "")]).lower(),
        "searchRaw": (plain(log_md) + " " + plain(body)).lower(),
        "_order": position if position is not None else 10_000,
    }
    if page == "chatgpt":
        entry.update(chatgpt.provenance(label, meta, folder, lambda text: render(text, name, page), warn))
    return entry


def read_collection(folder, page):
    """Every session in folder/sessions/, newest first, checked against folder/LOG.md."""
    log_index = read_log_index(folder)
    entries = [read_session(path, log_index, page) for path in sorted((folder / "sessions").glob("*.md"))]
    for name in log_index:
        if not (folder / "sessions" / (name + ".md")).exists():
            warn(name if page == "claude" else "chatgpt/" + name, "listed in LOG.md but the file doesn't exist")

    # Newest first: by date, then time, then by where LOG.md puts it (it lists newest first).
    # Logs with no time count as the earliest of their day.
    entries.sort(key=lambda e: (e["date"], e["time"], -e["_order"], e["id"]), reverse=True)
    for entry in entries:
        del entry["_order"]
    return entries


def summary(entries, missing=()):
    """One card on the Memory page (memory.html): how many sessions, over how long, what's waiting,
    and the newest one. Small on purpose, so the page doesn't load either full dataset."""
    dates = sorted(e["date"] for e in entries)
    statuses = {s: sum(e["status"] == s for e in entries) for s in STATUSES}
    newest = entries[0] if entries else None
    return {
        "sessions": len(entries),
        "days": len(set(dates)),
        "first": dates[0] if dates else "",
        "last": dates[-1] if dates else "",
        "statuses": {s: n for s, n in statuses.items() if n},
        "latest": {"id": newest["id"], "title": newest["title"], "date": newest["date"]} if newest else None,
        "missing": len(missing),
    }


def build():
    built = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    entries = read_collection(CONTEXT, "claude")
    data = {"built": built, "projects": PROJECTS, "types": TYPES, "statuses": STATUSES, "entries": entries}
    # The ChatGPT page: its own sessions in its own file, never mixed into data.json.
    chatgpt_entries = read_collection(CHATGPT, "chatgpt") if (CHATGPT / "sessions").is_dir() else []
    chatgpt_data = {"built": built, "projects": PROJECTS, "types": TYPES, "statuses": STATUSES,
                    "entries": chatgpt_entries, "missing": chatgpt.missing(CHATGPT)}

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(HERE / "page", DIST)
    for name in SHARED:
        shutil.copy2(SITE / name, DIST / name)
    for folder, pattern in SHARED_DIRS.items():
        (DIST / folder).mkdir()
        for path in (SITE / folder).glob(pattern):
            shutil.copy2(path, DIST / folder / path.name)
    # Saved pages of dropped projects (e.g. a review page from a claude.ai Artifact), so they
    # open on the LAN without a Claude sign-in: discontinued/<project>/x.html → /discontinued/<project>/x.html
    for path in sorted(DISCONTINUED.glob("*/*.html")):
        target = DIST / "discontinued" / path.parent.name / path.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
    (DIST / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DIST / "chatgpt-data.json").write_text(json.dumps(chatgpt_data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    # The Memory page's two cards (since 2026-10-27): Claude and ChatGPT, side by side.
    memory = {"built": built, "claude": summary(entries), "chatgpt": summary(chatgpt_entries, chatgpt_data["missing"])}
    (DIST / "memory.json").write_text(json.dumps(memory, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    logged = [dict(e, page="claude") for e in entries] + [dict(e, page="chatgpt") for e in chatgpt_entries]
    to_do = todo.make(TODO, WORKSPACE, logged, lambda text: render(text, page="todo", base=CONTEXT), warn)
    (DIST / "todo.json").write_text(json.dumps(to_do, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    spaces = [(key, name) for key, name, _ in confluence.spaces(CONFLUENCE)]
    pages = encyclopedia.build(ENCYCLOPEDIA, DIST / "encyclopedia", WORKSPACE, CONTEXT, warn, spaces)
    confluence_pages = confluence.build(CONFLUENCE, DIST / "encyclopedia" / "confluence", encyclopedia.TEMPLATE, warn)

    size = (DIST / "data.json").stat().st_size
    print(f"{len(entries)} sessions → {DIST.relative_to(SITE)} (data.json {size / 1024:.0f} KB)")
    size = (DIST / "chatgpt-data.json").stat().st_size
    print(f"ChatGPT: {len(chatgpt_entries)} sessions → chatgpt-data.json ({size / 1024:.0f} KB)")
    print(f"To do: TODO.md → todo.json ({len(to_do['html']) / 1024:.0f} KB, git section written now)")
    print(f"Encyclopedia: {pages} pages → {DIST.relative_to(SITE)}/encyclopedia/")
    if confluence_pages:
        print(f"Confluence: {confluence_pages} pages in {len(spaces)} spaces → {DIST.relative_to(SITE)}/encyclopedia/confluence/")
    return len(entries)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # Windows' console default can't print → or ’
    build()
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for line in warnings:
            print("  " + line)
        if "--strict" in sys.argv:
            sys.exit(1)
