"""Build the Claude timeline (the LAN-only "Claude" page) into dist/.

Reads every session log in parth_project/_workspace/context/sessions/ plus the
index in _workspace/context/LOG.md, and writes dist/: the page (from page/), data.json, and copies
of the site files it shares with my-website (top bar, settings, Hinglish,
transitions, wallpapers). deploy.py then puts dist/ on the remote box.

    python tools/claude-timeline/build.py            # from my-website/
    python tools/claude-timeline/build.py --strict   # warnings stop the build

Needs PyYAML and markdown-it-py (pip install pyyaml markdown-it-py).

dist/ holds the full, unfiltered logs (Coles work, logins, everything), so it
is git-ignored and must never be committed: this repo is the public website.

Each session file starts with a frontmatter block. The card shows these fields:

    ---
    title: "CrossPaste card on the home page"     (at most 60 characters)
    date: 2026-10-14
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

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent                     # my-website/
WORKSPACE = SITE.parent.parent                # parth_project/ (my-website is in apps/ since 2026-10-21)
CONTEXT = WORKSPACE / "_workspace" / "context"
DISCONTINUED = WORKSPACE / "discontinued"     # dropped projects; their saved pages are served too
DIST = HERE / "dist"

# The filter lists show these in this order.
PROJECTS = ["Website", "Apex Dash", "Claire", "Iris", "PAT-AI", "PrintPlace", "SkyWardrobe",
            "StaySafe", "CrossPaste", "Sonic", "NovaDiagnostics", "n8n", "Coles", "Remote box",
            "Music", "Physical projects", "Photos", "OpenRecall", "Workspace"]
TYPES = ["Built", "Improved", "Fixed", "Ideas", "Research", "Setup", "Sync", "Docs"]
STATUSES = ["Done", "Needs testing", "Open", "Parked"]
TITLE_MAX, SUMMARY_MAX = 60, 240

# Files from my-website that the page uses as they are.
SHARED = ["movies.css", "settings.css", "motion.css", "hinglish.js", "i18n.js", "settings.js",
          "motion.js", "wallpaper.js"]
SHARED_DIRS = {"wallpapers": "*.js"}  # the scenes behind "Wallpaper behind every page"

SESSION_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}-[\w.-]+$")
warnings = []


def warn(name, message):
    warnings.append(f"{name}: {message}")


# ---------- Markdown ----------

md = MarkdownIt("commonmark", {"html": False}).enable(["table", "strikethrough"])


def link_kind(href):
    """web (opens in a new tab), session (jumps to that card) or file (shown, not a link)."""
    if re.match(r"^(https?:|mailto:)", href):
        return "web", href
    stem = Path(href.split("#")[0]).stem
    if href.split("#")[0].endswith(".md") and SESSION_NAME.match(stem) and (CONTEXT / "sessions" / (stem + ".md")).exists():
        return "session", stem
    return "file", href


def render_link_open(self, tokens, idx, options, env):
    kind, target = link_kind(tokens[idx].attrGet("href") or "")
    if kind == "session" and target == env.get("self"):
        kind = "self"  # LOG.md's entry links to its own log: just text on its own card
    env.setdefault("links", []).append(kind)
    if kind == "self":
        return ""
    if kind == "web":
        return f'<a href="{html.escape(target)}" target="_blank" rel="noopener noreferrer">'
    if kind == "session":
        return f'<a href="#{target}" class="session-link" data-session="{target}">'
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


def render(text, name=None):
    return md.render(text, {"self": name})


def plain(text):
    """Markdown → rough plain text, for search."""
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`#>|]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# ---------- Reading the logs ----------

def read_log_index():
    """LOG.md → {session name: (position, markdown of its entry and any "Then …" lines)}."""
    entries, current = {}, None
    lines = (CONTEXT / "LOG.md").read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
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


def read_session(path, log_index):
    name = path.stem
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n").lstrip("﻿")
    front, body = split_frontmatter(text)
    meta = {}
    if front is None:
        warn(name, "no frontmatter block")
    else:
        try:
            meta = yaml.safe_load(front) or {}
        except yaml.YAMLError as error:
            warn(name, "frontmatter isn't valid YAML: " + str(error).replace("\n", " "))
    if not isinstance(meta, dict):
        meta = {}

    card = check(name, meta) if meta else {}
    file_date = name[:10]
    date = str(meta.get("date") or file_date)
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        warn(name, f"date {date!r} isn't YYYY-MM-DD, using {file_date}")
        date = file_date

    heading = heading_of(body)
    position, log_md = log_index.get(name, (None, ""))
    if position is None:
        warn(name, "not listed in LOG.md")

    projects = card.get("projects") or []
    return {
        "id": name,
        "date": date,
        "title": card.get("title") or heading or name,
        "summary": card.get("summary", ""),
        "projects": projects,
        "type": card.get("type", ""),
        "status": card.get("status", ""),
        "heading": heading,
        "file": "_workspace/context/sessions/" + path.name,
        "words": len(body.split()),
        "complete": all(key in card for key in ("title", "summary", "projects", "type", "status")),
        "log": render(log_md, name) if log_md else "",
        "raw": render(body, name),
        "search": " ".join([card.get("title", ""), card.get("summary", ""), heading, " ".join(projects),
                            card.get("type", ""), card.get("status", "")]).lower(),
        "searchRaw": (plain(log_md) + " " + plain(body)).lower(),
        "_order": position if position is not None else 10_000,
    }


def build():
    log_index = read_log_index()
    files = sorted((CONTEXT / "sessions").glob("*.md"))
    entries = [read_session(path, log_index) for path in files]
    for name in log_index:
        if not (CONTEXT / "sessions" / (name + ".md")).exists():
            warn(name, "listed in LOG.md but the file doesn't exist")

    # Newest first: by date, then by where LOG.md puts it (it lists newest first).
    entries.sort(key=lambda e: (e["date"], -e["_order"], e["id"]), reverse=True)
    for entry in entries:
        del entry["_order"]

    data = {
        "built": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "projects": PROJECTS,
        "types": TYPES,
        "statuses": STATUSES,
        "entries": entries,
    }

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

    size = (DIST / "data.json").stat().st_size
    print(f"{len(entries)} sessions → {DIST.relative_to(SITE)} (data.json {size / 1024:.0f} KB)")
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
