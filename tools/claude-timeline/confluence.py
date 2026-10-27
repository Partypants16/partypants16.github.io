"""The Coles Confluence section of the Encyclopedia tab (since 2026-10-27, at Parth's ask).

build.py calls build() after encyclopedia.build(). It reads parth_project/Coles/Confluence/ (the
mirror of Coles Confluence spaces, one Markdown file per Confluence page with YAML front matter;
see Coles/Confluence/HANDOFF.md and _tools/) and writes dist/encyclopedia/confluence/:

    confluence/index.html             every selected space, with its status and page count
    confluence/<KEY>/index.html       a space's front page: its details and its whole page tree
    confluence/<KEY>/<content_id>.html  one page per Confluence page (named by content_id, so
                                       renames in Confluence don't break links)
    confluence/<KEY>/about.html, export-state.html   the export's README.md and _EXPORT_STATE.md
    confluence/<KEY>/tree.json        the space's page tree; encyclopedia.js draws the sidebar from it
    confluence/titles.json            title + headings of every page, searched with everything else
    confluence/search/<KEY>.json      each space's text (first SEARCH_BODY_MAX characters a page);
    confluence/search/shards.json     encyclopedia.js loads all shards while they're small, else
                                       only the space you're in
    confluence/build-hash.txt         a hash of all of the above; deploy.py skips re-sending the
                                       section when it hasn't changed

Rendering tens of thousands of pages takes minutes, so the output is cached in .cache/confluence/
(git-ignored) under a signature of everything it depends on (every source file's path, size and
time, the notes, HANDOFF.md, this file, encyclopedia.py and the page template). An unchanged
mirror is copied from the cache instead of rendered again.

Each page shows a source panel from its front matter (title in Confluence, last modified,
exported, content ID, "Open in Confluence") and Parth's notes from
Coles/Confluence/_notes/<KEY>/<same path>.md, which no import ever touches. Links between pages
that are both here become local links, including Confluence URLs whose page ID is here; others
stay links to Confluence. Only HTML and JSON are written: the Markdown, the manifest and the
notes' source never leave the dev laptop.

The pages are Coles-internal. They're served only by the box on the home network, like the rest
of the tab; dist/ is git-ignored, so none of it reaches the public website repo.
"""

import hashlib
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import unquote

import yaml

import encyclopedia

SPACE_DIR = re.compile(r"^([A-Z0-9]+) - (.+)$")
META_FILES = {"README.md", "_INDEX.md", "_EXPORT_STATE.md", "_MASTER_INDEX.md"}
SEARCH_BODY_MAX = 4_000
CACHE = Path(__file__).resolve().parent / ".cache" / "confluence"
LOAD_ALL_SHARDS_UNDER = 8_000_000  # bytes: below this, search covers every space from any page
PAGE_ID = re.compile(r"/pages/(?:viewpage\.action\?pageId=)?(\d{5,})|[?&]pageId=(\d{5,})")


# ---------- Reading the mirror ----------

def read(path):
    text = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n").lstrip("﻿")
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            try:
                meta = yaml.safe_load(text[4:end]) or {}
            except yaml.YAMLError:
                meta = {}
            if isinstance(meta, dict):
                return {k: ("" if v is None else str(v)) for k, v in meta.items()}, text[end + 5:]
    return {}, text


def spaces(source):
    """[(KEY, name, folder)] for every space folder in the mirror, in the handoff's order."""
    if not source or not source.is_dir():
        return []
    found = {}
    for d in sorted(source.iterdir()):
        m = SPACE_DIR.match(d.name)
        if d.is_dir() and m:
            found[m.group(1)] = (m.group(1), m.group(2), d)
    order = [k for k, _ in selected(source)]
    return [found[k] for k in order if k in found] + [v for k, v in found.items() if k not in order]


def selected(source):
    """[(KEY, name)] from HANDOFF.md, in its recommended export order."""
    handoff = source / "HANDOFF.md"
    if not handoff.exists():
        return []
    text = handoff.read_text(encoding="utf-8", errors="replace")
    table = re.search(r"# Selected Confluence spaces\s*\n(.*?)\n\n", text, re.S)
    rows = re.findall(r"^\|\s*([^|]+?)\s*\|\s*`([A-Z0-9]+)`\s*\|", table.group(1) if table else "", re.M)
    names = {key: name for name, key in rows}
    order = re.search(r"# Recommended export order\s*\n(.*?)\n\n", text, re.S)
    ranked = re.findall(r"`([A-Z0-9]+)`", order.group(1)) if order else []
    keys = ranked + [k for k in names if k not in ranked]
    return [(k, names[k]) for k in keys if k in names]


def export_complete(folder):
    state = folder / "_EXPORT_STATE.md"
    if not state.exists():
        return None
    m = re.search(r"(?i)export complete:?\**\s*:?\s*`?(yes|true|no|false)", state.read_text(encoding="utf-8", errors="replace"))
    return None if not m else m.group(1).lower() in ("yes", "true")


def index_order(folder):
    """{relative path: position} from the space's _INDEX.md, which lists pages in Confluence's order."""
    path = folder / "_INDEX.md"
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8", errors="replace")
    targets = [unquote(m.group(1).strip("<>").split("#")[0])
               for m in re.finditer(r"\]\((<[^>]+>|[^)\s]+)\)", text)]
    return {t: i for i, t in enumerate(targets)}


def collect(key, name, folder):
    order = index_order(folder)
    pages = []
    for path in sorted(folder.rglob("*.md")):
        rel = path.relative_to(folder)
        if path.name in META_FILES or path.name.startswith("_") or any(p.startswith(("_", ".")) for p in rel.parts[:-1]):
            continue
        meta, body = read(path)
        heading = re.match(r"\s*#\s+(.+?)\s*$", body, re.M)
        title = meta.get("confluence_title") or (heading.group(1) if heading and body.lstrip().startswith("#") else path.stem)
        cid = meta.get("content_id") or "p" + hashlib.sha1(rel.as_posix().encode()).hexdigest()[:12]
        pages.append({"key": key, "space": name, "folder": folder, "path": path, "rel": rel.as_posix(), "meta": meta,
                      "body": body, "title": title, "id": cid, "out": f"{key}/{cid}.html",
                      "pos": order.get(rel.as_posix(), 10**9)})
    ids = {p["id"] for p in pages}
    for p in pages:
        parent = p["meta"].get("parent_content_id", "")
        p["parent"] = parent if parent in ids and parent != p["id"] else None
    children = {}
    for p in pages:
        children.setdefault(p["parent"], []).append(p)
    for group in children.values():
        group.sort(key=lambda p: (p["pos"], p["title"].lower()))
    return pages, children


# ---------- Rendering ----------

def make_resolver(page, by_path, by_id, missing):
    def to(target_page, fragment=""):
        if target_page["key"] == page["key"]:
            return f"{target_page['id']}.html{fragment}"
        return f"../{target_page['out']}{fragment}"

    def resolve(href):
        if re.match(r"^(https?:|mailto:)", href):
            m = PAGE_ID.search(href)
            cid = m and (m.group(1) or m.group(2))
            if cid and cid in by_id:
                return "page", to(by_id[cid])
            return "web", href
        if href.startswith("#"):
            return "anchor", href
        path_part, _, fragment = href.partition("#")
        fragment = "#" + fragment if fragment else ""
        path_part = unquote(path_part)
        if not path_part:
            return "anchor", href
        target = (page["path"].parent / path_part).resolve()
        hit = by_path.get(target) or by_path.get(Path(str(target) + ".md"))  # "X/" is the page X.md
        if hit:
            return "page", to(hit, fragment)
        missing.append(path_part)
        return "file", path_part

    return resolve


def render_md(text, resolve):
    env = {"resolve": resolve}
    return encyclopedia.md.render(text, env), env


def source_panel(page):
    meta = page["meta"]
    rows = [("In Confluence", meta.get("confluence_title") or page["title"]),
            ("Space", f"{page['space']} ({page['key']})"),
            ("Last changed in Confluence", meta.get("last_modified", "")[:16].replace("T", " ")),
            ("Exported", meta.get("exported_at", "")[:16].replace("T", " ")),
            ("Content ID", page["id"] if meta.get("content_id") else "")]
    items = "".join(f"<div><dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd></div>" for k, v in rows if v)
    url = meta.get("confluence_url", "")
    link = (f'<p class="cf-open"><a href="{html.escape(url)}" target="_blank" rel="noopener noreferrer">Open in Confluence</a>'
            f' <span>(needs a Coles login)</span></p>') if url.startswith("http") else ""
    return f'<aside class="cf-source"><dl>{items}</dl>{link}</aside>'


def notes_box(page, notes_root, resolve):
    path = notes_root / page["key"] / page["rel"]
    if not path.exists():
        return ""
    _, body = read(path)
    rendered, _ = render_md(body, resolve)
    return f'<aside class="cf-notes"><p class="cf-notes-title">My notes</p>{rendered}</aside>'


def crumbs(page, by_id, prefix=""):
    trail, seen, node = [], set(), page
    while node.get("parent") and node["parent"] not in seen:
        seen.add(node["parent"])
        node = by_id[node["parent"]]
        trail.append(node)
    parts = [f'<a href="{prefix}../../index.html">Encyclopedia</a>', f'<a href="{prefix}../index.html">Confluence</a>',
             f'<a href="{prefix}index.html">{html.escape(page["space"])}</a>']
    if len(trail) > 4:
        trail = trail[:3] + [None]
    for t in reversed(trail):
        parts.append("<span>…</span>" if t is None else f'<a href="{t["id"]}.html">{html.escape(t["title"])}</a>')
    parts.append(f'<span aria-current="page">{html.escape(page["title"])}</span>')
    return ' <span class="crumb-sep">›</span> '.join(parts)


def neighbours(page, children):
    group = children.get(page["parent"], [])
    i = group.index(page)
    out = []
    if i > 0:
        out.append(f'<a class="enc-prev" href="{group[i - 1]["id"]}.html"><small>Previous</small>{html.escape(group[i - 1]["title"])}</a>')
    if i < len(group) - 1:
        out.append(f'<a class="enc-next" href="{group[i + 1]["id"]}.html"><small>Next</small>{html.escape(group[i + 1]["title"])}</a>')
    return "".join(out)


def nav(spaces_list, current_key=None, current_id="", depth=2):
    """The sidebar on Confluence pages: home links, the spaces, and (on a space's pages) its tree."""
    up = "../" * depth
    conf = "../" * (depth - 1)
    parts = [f'<a class="enc-home" href="{up}index.html">Encyclopedia</a>',
             f'<a class="enc-home cf-home" href="{conf}index.html">Confluence</a>', '<ul class="enc-root cf-spaces">']
    for key, name, _ in spaces_list:
        cur = ' aria-current="page"' if key == current_key and not current_id else ""
        parts.append(f'<li><a href="{conf}{key}/index.html"{cur}>{html.escape(name)}</a></li>')
    parts.append("</ul>")
    if current_key:
        parts.append(f'<div class="cf-tree" id="cf-tree" data-space="{current_key}" data-current="{html.escape(current_id)}">'
                     f'<p class="cf-tree-loading">Loading the page tree…</p></div>')
    return "\n".join(parts)


def tree_html(node_id, children, limit_depth=99, depth=0):
    kids = children.get(node_id, [])
    if not kids or depth >= limit_depth:
        return ""
    items = "".join(f'<li><a href="{k["id"]}.html">{html.escape(k["title"])}</a>{tree_html(k["id"], children, limit_depth, depth + 1)}</li>'
                    for k in kids)
    return f"<ul>{items}</ul>"


def tree_json(node_id, children):
    return [[k["id"], k["title"], tree_json(k["id"], children)] for k in children.get(node_id, [])]


def fill(template, *, root, site, tab_title, title, description, crumbs_html, nav_html, content, neighbours_html, source, mermaid):
    return (template
            .replace("{{root}}", root)
            .replace("{{site}}", site)
            .replace("{{tab_title}}", html.escape(tab_title))
            .replace("{{title}}", html.escape(title))
            .replace("{{description}}", html.escape(description))
            .replace("{{crumbs}}", crumbs_html)
            .replace("{{nav}}", nav_html)
            .replace("{{content}}", content)
            .replace("{{neighbours}}", neighbours_html)
            .replace("{{source}}", html.escape(source))
            .replace("{{source_note}}", "Coles Confluence, read-only copy · notes go in <code translate=\"no\">Coles/Confluence/_notes/</code>")
            .replace("{{mermaid}}", f'<script src="{root}mermaid.min.js"></script>' if mermaid else ""))


# ---------- Build ----------

def signature(source, template_path):
    """A hash of everything the rendered section depends on."""
    digest = hashlib.sha256()
    for path in sorted(p for p in source.rglob("*") if p.is_file()):
        rel = path.relative_to(source).as_posix()
        if rel.startswith(("_tools/", "_stale/", "_staging/", "_exports/")) or rel in ("_manifest.json", "_INDEX.md"):
            continue
        st = path.stat()
        digest.update(f"{rel}|{st.st_size}|{st.st_mtime_ns};".encode())
    for path in (Path(__file__), Path(encyclopedia.__file__), template_path):
        digest.update(path.read_bytes())
    return digest.hexdigest()


def build(source, dest, template_path, warn):
    """source: Coles/Confluence/, dest: dist/encyclopedia/confluence/. Returns the number of pages."""
    space_list = spaces(source)
    if not space_list:
        return 0
    sig = signature(source, template_path)
    cached = CACHE / "signature.txt"
    if cached.exists() and cached.read_text(encoding="utf-8").split("|")[0] == sig and (CACHE / "out").is_dir():
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(CACHE / "out", dest)
        return int(cached.read_text(encoding="utf-8").split("|")[1])
    total = render_all(source, dest, template_path, warn, space_list)
    if (CACHE / "out").exists():
        shutil.rmtree(CACHE / "out")
    CACHE.mkdir(parents=True, exist_ok=True)
    shutil.copytree(dest, CACHE / "out")
    cached.write_text(f"{sig}|{total}", encoding="utf-8")
    return total


def render_all(source, dest, template_path, warn, space_list):
    template = template_path.read_text(encoding="utf-8")
    notes_root = source / "_notes"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "search").mkdir(exist_ok=True)

    collected = {key: collect(key, name, folder) for key, name, folder in space_list}
    by_path = {p["path"].resolve(): p for pages, _ in collected.values() for p in pages}
    by_id = {p["id"]: p for pages, _ in collected.values() for p in pages}
    titles, total, summary = [], 0, []

    for key, name, folder in space_list:
        pages, children = collected[key]
        (dest / key).mkdir(exist_ok=True)
        shard, missing = [], []
        for page in pages:
            resolve = make_resolver(page, by_path, by_id, missing)
            body = page["body"]
            if not re.match(r"\s*#\s", body):
                body = f"# {page['title']}\n\n{body}"
            rendered, env = render_md(body, resolve)
            headings = env.get("headings", [])
            extra = source_panel(page) + notes_box(page, notes_root, resolve) + encyclopedia.toc_html(headings)
            rendered = rendered.replace("</h1>", "</h1>\n" + extra, 1)
            (dest / page["out"]).write_text(fill(
                template, root="../../", site="../../../",
                tab_title=f"{page['title']} · {key} · Encyclopedia | Parth", title=page["title"],
                description=f"{page['title']}: a Coles Confluence page ({name}). Only on the home server.",
                crumbs_html=crumbs(page, by_id), nav_html=nav(space_list, key, page["id"]), content=rendered,
                neighbours_html=neighbours(page, children), source=f"Coles/Confluence/{folder.name}/{page['rel']}",
                mermaid=env.get("mermaid")), encoding="utf-8")
            heads = [t for level, t, _ in headings if level > 1]
            titles.append({"u": f"confluence/{page['out']}", "t": page["title"], "s": f"Confluence · {key}", "h": heads[:30]})
            shard.append({"u": f"confluence/{page['out']}", "t": page["title"], "s": f"Confluence · {key}", "h": heads[:30],
                          "b": encyclopedia.plain(page["body"])[:SEARCH_BODY_MAX]})
        total += len(pages)
        if missing:
            warn(f"confluence/{key}", f"{len(missing)} link(s) to pages that aren't in the mirror (shown as plain text)")

        (dest / key / "tree.json").write_text(json.dumps(tree_json(None, children), ensure_ascii=False, separators=(",", ":")),
                                              encoding="utf-8")
        (dest / "search" / f"{key}.json").write_text(json.dumps(shard, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        write_space_pages(key, name, folder, pages, children, space_list, template, dest, by_path, by_id)
        summary.append((key, name, folder, len(pages)))

    write_landing(source, summary, space_list, template, dest)
    (dest / "titles.json").write_text(json.dumps(titles, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sizes = {key: (dest / "search" / f"{key}.json").stat().st_size for key, *_ in space_list}
    (dest / "search" / "shards.json").write_text(json.dumps(
        {"all": sum(sizes.values()) < LOAD_ALL_SHARDS_UNDER, "spaces": sizes}), encoding="utf-8")
    write_hash(dest)
    return total


def write_space_pages(key, name, folder, pages, children, space_list, template, dest, by_path, by_id):
    complete = export_complete(folder)
    exported = max((p["meta"].get("exported_at", "")[:10] for p in pages), default="")
    status = {True: "complete", False: "partly exported", None: "unknown"}[complete]
    extras = []
    for src, out, label in (("README.md", "about.html", "About this export"), ("_EXPORT_STATE.md", "export-state.html", "Export state")):
        path = folder / src
        if not path.exists():
            continue
        _, body = read(path)
        fake = {"key": key, "path": path}
        rendered, env = render_md(body, make_resolver(fake, by_path, by_id, []))
        (dest / key / out).write_text(fill(
            template, root="../../", site="../../../", tab_title=f"{label} · {key} · Encyclopedia | Parth", title=label,
            description=f"{label} for the {name} Confluence space. Only on the home server.",
            crumbs_html=(f'<a href="../../index.html">Encyclopedia</a> <span class="crumb-sep">›</span> <a href="../index.html">Confluence</a>'
                         f' <span class="crumb-sep">›</span> <a href="index.html">{html.escape(name)}</a> <span class="crumb-sep">›</span> '
                         f'<span aria-current="page">{label}</span>'),
            nav_html=nav(space_list, key, out), content=rendered, neighbours_html="",
            source=f"Coles/Confluence/{folder.name}/{src}", mermaid=env.get("mermaid")), encoding="utf-8")
        extras.append(f'<a href="{out}">{label}</a>')

    rows = [("Space key", key), ("Pages here", str(len(pages))), ("Export", status), ("Exported", exported)]
    panel = "<aside class=\"cf-source\"><dl>" + "".join(f"<div><dt>{k}</dt><dd>{html.escape(v)}</dd></div>" for k, v in rows if v) + "</dl>"
    panel += (f'<p class="cf-open">{" · ".join(extras)}</p>' if extras else "") + "</aside>"
    content = (f"<h1>{html.escape(name)}</h1>\n{panel}\n<h2 id=\"pages\">Pages<a class=\"anchor\" href=\"#pages\" aria-label=\"Link to this heading\">#</a></h2>\n"
               f'<div class="cf-fulltree">{tree_html(None, children)}</div>')
    (dest / key / "index.html").write_text(fill(
        template, root="../../", site="../../../", tab_title=f"{name} · Confluence · Encyclopedia | Parth", title=name,
        description=f"The {name} Confluence space, read-only copy. Only on the home server.",
        crumbs_html=(f'<a href="../../index.html">Encyclopedia</a> <span class="crumb-sep">›</span> <a href="../index.html">Confluence</a>'
                     f' <span class="crumb-sep">›</span> <span aria-current="page">{html.escape(name)}</span>'),
        nav_html=nav(space_list, key), content=content, neighbours_html="", source=f"Coles/Confluence/{folder.name}/",
        mermaid=False), encoding="utf-8")


def write_landing(source, summary, space_list, template, dest):
    here = {key: (name, folder, n) for key, name, folder, n in summary}
    rows = []
    wanted = selected(source) or [(k, n) for k, n, _ in space_list]
    for key, name in wanted + [(k, n) for k, n, _ in space_list if k not in dict(wanted)]:
        if key in here:
            _, folder, n = here[key]
            done = {True: "complete", False: "partly exported", None: "unknown"}[export_complete(folder)]
            rows.append(f'<tr><td><a href="{key}/index.html">{html.escape(name)}</a></td><td><code>{key}</code></td><td>{n}</td><td>{done}</td></tr>')
        else:
            rows.append(f"<tr><td>{html.escape(name)}</td><td><code>{key}</code></td><td></td><td>not exported yet</td></tr>")
    total = sum(n for *_, n in summary)
    content = (
        "<h1>Confluence</h1>\n"
        f"<p>A read-only copy of {len(summary)} Coles Confluence space{'s' if len(summary) != 1 else ''} ({total} pages), "
        "one page per Confluence page, in Confluence's own hierarchy. Every page links back to the original and shows when "
        "it last changed there. It's Coles-internal, so it's only here, on the home network.</p>\n"
        "<p>Parth's own notes on a page live next to the copy, in <code translate=\"no\">Coles/Confluence/_notes/</code>, "
        "so a fresh export never overwrites them. New exports go in with <code translate=\"no\">Coles/Confluence/_tools/confluence_import.py</code>.</p>\n"
        '<div class="table-wrap">\n<table><thead><tr><th>Space</th><th>Key</th><th>Pages</th><th>Export</th></tr></thead>'
        f"<tbody>{''.join(rows)}</tbody></table>\n</div>")
    (dest / "index.html").write_text(fill(
        template, root="../", site="../../", tab_title="Confluence · Encyclopedia | Parth", title="Confluence",
        description="Coles Confluence spaces, read-only copy. Only on the home server.",
        crumbs_html='<a href="../index.html">Encyclopedia</a> <span class="crumb-sep">›</span> <span aria-current="page">Confluence</span>',
        nav_html=nav(space_list, None, "", depth=1), content=content, neighbours_html="",
        source="Coles/Confluence/", mermaid=False), encoding="utf-8")


def write_hash(dest):
    digest = hashlib.sha256()
    for path in sorted(p for p in dest.rglob("*") if p.is_file() and p.name != "build-hash.txt"):
        digest.update(path.relative_to(dest).as_posix().encode())
        digest.update(path.read_bytes())
    (dest / "build-hash.txt").write_text(digest.hexdigest() + "\n", encoding="utf-8")
