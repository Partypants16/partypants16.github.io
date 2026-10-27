"""The Encyclopedia: the fourth, LAN-only tab of Projects (Showcase / Claude / To do / Encyclopedia).

build.py calls build() and this writes dist/encyclopedia/: one static HTML page per Markdown
file in parth_project/_workspace/encyclopedia/, plus search.json, the page's CSS and JS, the
Pygments stylesheet and a local copy of Mermaid. deploy.py ships it with the rest of dist/, and
the same Caddy container serves it at http://192.168.212.60:8120/encyclopedia/.

The Markdown is the source of truth. Each page gets: the site's top bar and the Projects tabs,
a sidebar tree of every page (folders in name order, so 01-system sorts before 02-…), a crumb
line, "On this page" from its headings, heading anchors, code with syntax colours (Pygments at
build time, so no JavaScript is needed to read it), Mermaid diagrams (```mermaid fences, drawn
in the browser from the local copy), tables that scroll sideways on a phone, and previous /
next links within its folder. Raw HTML in the Markdown is not passed through.

Links in the Markdown:
  - another page, as a relative .md path            → that page (checked: a missing one is a warning)
  - a session log, e.g. ../../context/sessions/X.md → its card on the Claude page next door
    (../../context/chatgpt/sessions/X.md            → its card on the ChatGPT page)
  - any other file in parth_project                 → shown as a path, not a link (it isn't served)
  - http(s)                                         → opens in a new tab

A folder's README.md is its landing page (index.html); the root README.md is the Encyclopedia's
front page. A page's title is its first "# " heading. Folder labels come from the folder name
("01-system" → "System"). Files that aren't Markdown (images) are copied as they are.

Mermaid is a 3.5 MB file, so it isn't in the repo: vendor/mermaid.min.js is fetched once from
jsdelivr (pinned version below) and git-ignored. Without it the build still works, with a warning,
and diagrams show as their source text.
"""

import html
import json
import re
import shutil
import urllib.request
from pathlib import Path

from markdown_it import MarkdownIt
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import TextLexer, get_lexer_by_name
from pygments.util import ClassNotFound

HERE = Path(__file__).resolve().parent
VENDOR = HERE / "vendor"
TEMPLATE = HERE / "page" / "encyclopedia" / "_template.html"
MERMAID_VERSION = "11.17.2"
MERMAID_URL = f"https://cdn.jsdelivr.net/npm/mermaid@{MERMAID_VERSION}/dist/mermaid.min.js"
SESSION_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}-[\w.-]+$")
SEARCH_BODY_MAX = 20_000  # characters of a page's text kept in search.json


# ---------- Markdown ----------

md = MarkdownIt("commonmark", {"html": False}).enable(["table", "strikethrough"])


def slugify(text):
    text = re.sub(r"[`*_~\[\]()]", "", text).strip().lower()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return re.sub(r"[\s_-]+", "-", text).strip("-") or "section"


def heading_text(inline_token):
    """The plain words of a heading, without its Markdown marks."""
    return re.sub(r"[`*_~]|\[([^\]]*)\]\([^)]*\)", r"\1", inline_token.content).strip()


def render_heading_open(self, tokens, idx, options, env):
    token = tokens[idx]
    text = heading_text(tokens[idx + 1])
    slug = base = slugify(text)
    used = env.setdefault("slugs", set())
    n = 1
    while slug in used:
        n += 1
        slug = f"{base}-{n}"
    used.add(slug)
    env.setdefault("headings", []).append((int(token.tag[1]), text, slug))
    env.setdefault("slug_stack", []).append(slug)
    return f'<{token.tag} id="{slug}">'


def render_heading_close(self, tokens, idx, options, env):
    slug = env["slug_stack"].pop()
    tag = tokens[idx].tag
    if tag == "h1":
        return f"</{tag}>"
    return f'<a class="anchor" href="#{slug}" aria-label="Link to this heading">#</a></{tag}>'


def render_fence(self, tokens, idx, options, env):
    token = tokens[idx]
    info = (token.info or "").strip().split()
    lang = info[0].lower() if info else ""
    code = token.content
    if lang == "mermaid":
        env["mermaid"] = True
        escaped = html.escape(code)
        return f'<pre class="mermaid" data-src="{escaped}">{escaped}</pre>\n'
    try:
        lexer = get_lexer_by_name(lang) if lang else TextLexer()
    except ClassNotFound:
        lexer = TextLexer()
    body = highlight(code, lexer, HtmlFormatter(nowrap=True))
    cls = f' class="language-{html.escape(lang)}"' if lang else ""
    return f'<div class="hl-wrap"><pre class="hl"><code{cls}>{body}</code></pre></div>\n'


def render_table_open(self, tokens, idx, options, env):
    return '<div class="table-wrap">\n<table>'


def render_table_close(self, tokens, idx, options, env):
    return "</table>\n</div>"


def render_link_open(self, tokens, idx, options, env):
    href = tokens[idx].attrGet("href") or ""
    kind, target = env["resolve"](href)
    env.setdefault("links", []).append(kind)
    title = tokens[idx].attrGet("title")
    title_attr = f' title="{html.escape(title)}"' if title else ""
    if kind == "web":
        return f'<a href="{html.escape(target)}"{title_attr} target="_blank" rel="noopener noreferrer">'
    if kind == "file":
        return f'<span class="file-ref" title="{html.escape(target)}">'
    cls = ' class="session-link"' if kind == "session" else ""
    return f'<a href="{html.escape(target)}"{cls}{title_attr}>'


def render_link_close(self, tokens, idx, options, env):
    kind = env["links"].pop()
    return "</span>" if kind == "file" else "</a>"


def render_image(self, tokens, idx, options, env):
    token = tokens[idx]
    src = token.attrGet("src") or ""
    kind, target = env["resolve"](src)
    alt = html.escape(token.content)
    if kind != "page" and kind != "asset":
        return f'<span class="file-ref" title="{html.escape(target)}">[image: {alt}]</span>'
    return f'<img src="{html.escape(target)}" alt="{alt}" loading="lazy">'


md.add_render_rule("heading_open", render_heading_open)
md.add_render_rule("heading_close", render_heading_close)
md.add_render_rule("fence", render_fence)
md.add_render_rule("table_open", render_table_open)
md.add_render_rule("table_close", render_table_close)
md.add_render_rule("link_open", render_link_open)
md.add_render_rule("link_close", render_link_close)
md.add_render_rule("image", render_image)


def plain(text):
    """Markdown → rough plain text, for search."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`#>|]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


# ---------- The tree ----------

# Folder names that don't read well when the number is stripped and the first letter capitalised.
FOLDER_LABELS = {
    "00-index": "Index",
    "07-encyclopedia-tab": "Encyclopedia tab",
    "09-plans-and-parked": "Plans and parked",
    "11-people-and-access": "People and access",
    "13-how-do-i": "How do I…",
    "14-disaster-scenarios": "Disaster scenarios",
}


def folder_label(name):
    if name in FOLDER_LABELS:
        return FOLDER_LABELS[name]
    return re.sub(r"^\d+[-_]", "", name).replace("-", " ").replace("_", " ").strip().capitalize() or name


def page_title(text, path):
    found = re.search(r"^#\s+(.+?)\s*$", text, re.M)
    if found:
        return heading_text_raw(found.group(1))
    stem = path.stem
    return "Encyclopedia" if stem.lower() == "readme" else folder_label(stem)


def heading_text_raw(text):
    return re.sub(r"[`*_~]|\[([^\]]*)\]\([^)]*\)", r"\1", text).strip()


def out_name(path, source):
    """Where a Markdown file's page goes, relative to dist/encyclopedia/ (posix)."""
    rel = path.relative_to(source)
    if rel.stem.lower() == "readme":
        rel = rel.with_name("index.md")
    return rel.with_suffix(".html").as_posix()


def collect(source):
    pages = []
    for path in sorted(source.rglob("*.md")):
        if any(part.startswith(".") or part.startswith("_") for part in path.relative_to(source).parts[:-1]):
            continue
        text = path.read_text(encoding="utf-8").replace("\r\n", "\n").lstrip("﻿")
        rel = path.relative_to(source)
        pages.append({
            "path": path,
            "rel": rel.as_posix(),
            "out": out_name(path, source),
            "folder": rel.parts[0] if len(rel.parts) > 1 else "",
            "title": page_title(text, path),
            "text": text,
            "is_index": rel.stem.lower() == "readme",
        })
    # Within a folder: the folder's README first, then by file name.
    pages.sort(key=lambda p: (p["folder"], not p["is_index"], p["rel"]))
    return pages


def sections(pages):
    """[(folder, label, [pages])] in folder order, with the root's pages first under ""."""
    order, groups = [], {}
    for page in pages:
        if page["folder"] not in groups:
            order.append(page["folder"])
            groups[page["folder"]] = []
        groups[page["folder"]].append(page)
    return [(folder, folder_label(folder) if folder else "", groups[folder]) for folder in order]


def rel_url(from_out, to_out):
    """A relative URL from one output page to another (both posix paths under dist/encyclopedia/)."""
    from_dir = Path(from_out).parent
    target = Path(to_out)
    try:
        up = len(from_dir.parts)
        return ("../" * up) + target.as_posix() if up else target.as_posix()
    except ValueError:
        return target.as_posix()


def root_prefix(out):
    return "../" * len(Path(out).parent.parts)


# ---------- Rendering one page ----------

def make_resolver(page, pages, source, workspace, context, warn):
    by_path = {p["path"].resolve(): p for p in pages}
    source_resolved = source.resolve()

    def resolve(href):
        if re.match(r"^(https?:|mailto:)", href):
            return "web", href
        if href.startswith("#"):
            return "anchor", href
        path_part, _, fragment = href.partition("#")
        fragment = "#" + fragment if fragment else ""
        if not path_part:
            return "anchor", href
        target = (page["path"].parent / path_part).resolve()
        if target in by_path:
            return "page", rel_url(page["out"], by_path[target]["out"]) + fragment
        stem = Path(path_part).stem
        if path_part.endswith(".md") and SESSION_NAME.match(stem):
            chatgpt_log = context / "chatgpt" / "sessions" / (stem + ".md")
            if target == chatgpt_log.resolve() and chatgpt_log.exists():
                return "session", root_prefix(page["out"]) + "../chatgpt.html#" + stem
            if (context / "sessions" / (stem + ".md")).exists():
                return "session", root_prefix(page["out"]) + "../#" + stem
        try:
            inside = target.relative_to(source_resolved)
            if target.is_file():
                return "asset", rel_url(page["out"], inside.as_posix())
            if path_part.endswith(".md"):
                warn(page["rel"], f"links to a page that doesn't exist: {path_part}")
        except ValueError:
            pass
        try:
            shown = target.relative_to(workspace.resolve()).as_posix()
        except ValueError:
            shown = path_part
        return "file", shown

    return resolve


def nav_html(page, secs):
    root = root_prefix(page["out"])
    parts = [f'<a class="enc-home" href="{root}index.html">Encyclopedia</a>']
    for folder, label, group in secs:
        if not folder:
            items = [p for p in group if not p["is_index"]]
            if items:
                parts.append("<ul class=\"enc-root\">" + "".join(nav_item(page, p) for p in items) + "</ul>")
            continue
        current = page["folder"] == folder
        parts.append(f'<details{" open" if current else ""}><summary>{html.escape(label)}</summary><ul>'
                     + "".join(nav_item(page, p, folder_index=True) for p in group) + "</ul></details>")
    if CONFLUENCE_SPACES:
        # The Coles Confluence copy (confluence.py): its overview and one link per space.
        items = [f'<li><a href="{root}confluence/index.html">Overview</a></li>']
        items += [f'<li><a href="{root}confluence/{key}/index.html">{html.escape(name)}</a></li>' for key, name in CONFLUENCE_SPACES]
        parts.append("<details><summary>Confluence</summary><ul>" + "".join(items) + "</ul></details>")
    return "\n".join(parts)


CONFLUENCE_SPACES = []  # [(KEY, name)], set by build() when the Confluence copy has spaces


def nav_item(page, target, folder_index=False):
    current = ' aria-current="page"' if target is page else ""
    label = "Overview" if folder_index and target["is_index"] else target["title"]
    return f'<li><a href="{rel_url(page["out"], target["out"])}"{current}>{html.escape(label)}</a></li>'


def toc_html(headings):
    items = [(level, text, slug) for level, text, slug in headings if level in (2, 3)]
    if len(items) < 2:
        return ""
    out = ['<details class="enc-toc" open><summary>On this page</summary><ul>']
    for level, text, slug in items:
        out.append(f'<li class="toc-{level}"><a href="#{slug}">{html.escape(text)}</a></li>')
    out.append("</ul></details>")
    return "\n".join(out)


def crumbs_html(page, secs):
    root = root_prefix(page["out"])
    parts = [f'<a href="{root}index.html">Encyclopedia</a>']
    if page["folder"]:
        label = next(label for folder, label, _ in secs if folder == page["folder"])
        index = next((p for _, _, group in secs for p in group if p["folder"] == page["folder"] and p["is_index"]), None)
        if index and index is not page:
            parts.append(f'<a href="{rel_url(page["out"], index["out"])}">{html.escape(label)}</a>')
        else:
            parts.append(f"<span>{html.escape(label)}</span>")
    if not page["is_index"] or page["folder"]:
        parts.append(f'<span aria-current="page">{html.escape(page["title"])}</span>')
    return " <span class=\"crumb-sep\">›</span> ".join(parts)


def neighbours_html(page, secs):
    group = next((g for folder, _, g in secs if folder == page["folder"]), [])
    i = group.index(page)
    out = []
    if i > 0:
        prev = group[i - 1]
        out.append(f'<a class="enc-prev" href="{rel_url(page["out"], prev["out"])}"><small>Previous</small>{html.escape("Overview" if prev["is_index"] and prev["folder"] else prev["title"])}</a>')
    if i < len(group) - 1:
        nxt = group[i + 1]
        out.append(f'<a class="enc-next" href="{rel_url(page["out"], nxt["out"])}"><small>Next</small>{html.escape(nxt["title"])}</a>')
    return "".join(out)


def render_page(page, pages, secs, template, source, workspace, context, warn):
    env = {"resolve": make_resolver(page, pages, source, workspace, context, warn)}
    body = md.render(page["text"], env)
    headings = env.get("headings", [])
    # "On this page" goes under the page's title (or at the top if it has no "# " heading).
    toc = toc_html(headings)
    body = body.replace("</h1>", "</h1>\n" + toc, 1) if "</h1>" in body else toc + body
    root = root_prefix(page["out"])
    site = root + "../"
    section_label = next((label for folder, label, _ in secs if folder == page["folder"]), "")
    title = page["title"]
    tab_title = "Encyclopedia | Parth" if page["out"] == "index.html" else f"{title} · Encyclopedia | Parth"
    filled = (template
              .replace("{{root}}", root)
              .replace("{{site}}", site)
              .replace("{{tab_title}}", html.escape(tab_title))
              .replace("{{title}}", html.escape(title))
              .replace("{{description}}", html.escape(f"{title}: a page of the parth_project Encyclopedia. Only on the home server."))
              .replace("{{crumbs}}", crumbs_html(page, secs))
              .replace("{{nav}}", nav_html(page, secs))
              .replace("{{content}}", body)
              .replace("{{neighbours}}", neighbours_html(page, secs))
              .replace("{{source}}", html.escape("_workspace/encyclopedia/" + page["rel"]))
              .replace("{{source_note}}", "edit the Markdown, then redeploy the Claude page")
              .replace("{{mermaid}}", f'<script src="{root}mermaid.min.js"></script>' if env.get("mermaid") else ""))
    search = {
        "u": page["out"],
        "t": title,
        "s": section_label,
        "h": [text for level, text, _ in headings if level > 1],
        "b": plain(page["text"])[:SEARCH_BODY_MAX],
    }
    return filled, search


# ---------- Build ----------

def fetch_mermaid(warn):
    target = VENDOR / "mermaid.min.js"
    if target.exists():
        return target
    VENDOR.mkdir(exist_ok=True)
    try:
        print(f"fetching Mermaid {MERMAID_VERSION} once into {target.relative_to(HERE.parent.parent)} (git-ignored)")
        with urllib.request.urlopen(MERMAID_URL, timeout=60) as response:
            data = response.read()
        if len(data) < 1_000_000 or b"mermaid" not in data[:2000]:
            raise OSError("the download doesn't look like mermaid.min.js")
        target.write_bytes(data)
        return target
    except OSError as error:
        warn("encyclopedia", f"couldn't fetch Mermaid ({error}); diagrams will show as their source text")
        return None


def build(source, dest, workspace, context, warn, confluence_spaces=()):
    """source: _workspace/encyclopedia/, dest: dist/encyclopedia/ (page/encyclopedia/ was copied there
    already by build.py's copytree). confluence_spaces: [(KEY, name)] for the sidebar's Confluence
    section (confluence.py writes those pages). Returns the number of pages written."""
    CONFLUENCE_SPACES[:] = list(confluence_spaces)
    if not source.is_dir():
        warn("encyclopedia", f"no folder at {source}, so the tab has no pages")
        return 0
    if not TEMPLATE.exists():
        warn("encyclopedia", f"template missing: {TEMPLATE}")
        return 0
    template = TEMPLATE.read_text(encoding="utf-8")
    pages = collect(source)
    if not pages:
        warn("encyclopedia", f"no Markdown files under {source}")
        return 0
    if not any(p["out"] == "index.html" for p in pages):
        warn("encyclopedia", "no README.md at the top of the encyclopedia, so the tab has no front page")
    secs = sections(pages)

    dest.mkdir(parents=True, exist_ok=True)
    (dest / "_template.html").unlink(missing_ok=True)

    # Images and other files next to the Markdown, as they are.
    for path in source.rglob("*"):
        if path.is_file() and path.suffix.lower() != ".md" and not any(part.startswith(".") for part in path.relative_to(source).parts):
            target = dest / path.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)

    index = []
    for page in pages:
        page_html, search = render_page(page, pages, secs, template, source, workspace, context, warn)
        target = dest / page["out"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(page_html, encoding="utf-8")
        index.append(search)
    (dest / "search.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    css = HtmlFormatter(style="default").get_style_defs(".hl") + "\n" + \
        HtmlFormatter(style="github-dark").get_style_defs(':root[data-theme="dark"] .hl')
    (dest / "pygments.css").write_text(css, encoding="utf-8")

    mermaid = fetch_mermaid(warn)
    if mermaid:
        shutil.copy2(mermaid, dest / "mermaid.min.js")
    return len(pages)
