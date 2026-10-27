"""Import ChatGPT/Codex chats about parth_project into _workspace/context/chatgpt/ (the ChatGPT page).

    python tools/claude-timeline/import_chatgpt.py                  # every local Codex chat in parth_project
    python tools/claude-timeline/import_chatgpt.py --chat <id> ...  # only these chats
    python tools/claude-timeline/import_chatgpt.py --chatgpt-export conversations.json --chat <id>
    python tools/claude-timeline/import_chatgpt.py --dry-run        # say what it would do, write nothing

Where chats come from:
- Codex keeps every chat on this laptop as ~/.codex/sessions/YYYY/MM/DD/rollout-…-<id>.jsonl
  (older ones .jsonl.zst, which needs `pip install zstandard`). Those files and Codex's
  databases are only ever read, never changed; a file Codex has locked is reported and skipped.
  Only chats whose folder (cwd) is inside parth_project are imported; the rest are listed as
  skipped. Older chats ran in pre-2026-10-21 paths such as parth_project/PrintPlace: still ours.
  Scripted `codex exec` runs (started by a program, e.g. another assistant testing Codex, not
  typed by Parth in the Codex app) are skipped too, unless --include-scripted or --chat names them.
  The run ends with a "To write up" list: new chats, and chats that went on since last time.
- ChatGPT (chatgpt.com) chats aren't on this laptop. Export the account's data from ChatGPT
  (Settings → Data controls → Export), unzip it, and pass its conversations.json with
  --chatgpt-export and the chat's --chat id. Only the chats named with --chat are taken.

What it writes, per chat (and nothing else):
- sources/<id>.json: the conversation record. Parth's and the assistant's messages in order, with
  their times in Australia/Sydney, attachment names, and a one-line note of the tools used between
  messages (with the files they changed). Never: hidden reasoning, system/developer instructions,
  the environment blocks Codex adds to each turn, tool output, or attachment contents. Obvious
  secrets (-pw values, password:/token= values, API-key shapes) are replaced with [redacted].
- sources/manifest.json: one entry per chat id (title, where it came from, dates, completeness,
  gaps), so running this again updates the same entry instead of adding a second one. Its
  "known_missing" list (chats known about but not readable here) is edited by hand and kept;
  a chat is taken off it once it's imported.
- sessions/<date>-<title>.md: only for a chat with no session file yet (found by chat_id).
  It's a skeleton with the card fields known from the chat filled in; the write-up, summary,
  projects, type and status are left for whoever writes it (the build warns until they're
  there). An existing session file is never touched, so corrections made by hand stay.

The chat's own dates and times are kept (converted from UTC to Australia/Sydney, daylight
saving included); nothing is dated by when it was imported.
"""

import argparse
import datetime
import hashlib
import io
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent.parent.parent.parent          # parth_project/
CHATGPT = WORKSPACE / "_workspace" / "context" / "chatgpt"
CODEX_HOME = Path.home() / ".codex"
LOCAL = ZoneInfo("Australia/Sydney")

ROLLOUT = re.compile(r"rollout-.*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl(\.zst)?$")

# Whole messages Codex adds to a turn that Parth didn't write: <environment_context>…, etc.
WRAPPER = re.compile(r"^\s*<([a-z_]+)\b[^>]*>.*?</\1>\s*", re.S)
SECRETS = [
    (re.compile(r"(-pw\s+)(?![.…<$%{\[])\S+"), r"\1[redacted]"),
    (re.compile(r"(?i)\b((?:pass(?:word|wd)?|token|secret|api[_-]?key|npsso)\s*[:=]\s*)(?![.…<$%{\[])[^\s,;]+"), r"\1[redacted]"),
    (re.compile(r"(?i)(\bsplunk\s+)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"), r"\1[redacted]"),
    (re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b"), "[redacted]"),
    (re.compile(r"\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}\b"), "[redacted]"),  # JWTs
]
# Files an apply_patch call changed. Codex writes the patch raw, or inside a JS string literal
# (in an "exec" call), where a newline is \n and a backslash is \\.
PATCH_FILE_RAW = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$", re.M)
PATCH_FILE_JS = re.compile(r"\*\*\* (?:Add|Update|Delete) File: ((?:\\\\|[^\\\"\n])+)")
FORMAT = 2  # bump when what's kept from a chat changes, so the next run redoes every record


def patched_files(args):
    found = PATCH_FILE_RAW.findall(args) or [p.replace("\\\\", "\\") for p in PATCH_FILE_JS.findall(args)]
    return [relative(p.strip()) for p in found]


def now():
    return datetime.datetime.now(LOCAL).isoformat(timespec="seconds")


def local(stamp):
    """'2026-10-26T23:11:35.274Z' (or epoch seconds) → '2026-10-27T10:11:35+11:00'."""
    if isinstance(stamp, (int, float)):
        when = datetime.datetime.fromtimestamp(stamp, datetime.timezone.utc)
    else:
        when = datetime.datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=datetime.timezone.utc)
    return when.astimezone(LOCAL).replace(microsecond=0).isoformat()


def redact(text, counter):
    for pattern, replacement in SECRETS:
        text, n = pattern.subn(replacement, text)
        counter[0] += n
    return text


def relative(path):
    """A path inside parth_project → 'apps/x' (forward slashes); anything else as it was."""
    if not Path(path).is_absolute():
        return str(path).replace("\\", "/")
    try:
        return Path(path).resolve().relative_to(WORKSPACE.resolve()).as_posix() or "."
    except (ValueError, OSError):
        return str(path)


def in_workspace(path):
    try:
        Path(path).resolve().relative_to(WORKSPACE.resolve())
        return True
    except (ValueError, OSError):
        return False


# ---------- Codex (local rollout files) ----------

def read_rollout(path):
    raw = Path(path).read_bytes()  # read only; Codex may still be writing today's
    if str(path).endswith(".zst"):
        try:
            import zstandard
        except ImportError:
            raise SystemExit("this chat is compressed (.zst): pip install zstandard")
        raw = zstandard.ZstdDecompressor().stream_reader(io.BytesIO(raw)).read()
    return raw, [json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()]


def clean_user(text):
    """Codex's wrapping of a user turn → (what Parth wrote, [attachment names]), or None if the
    message is only Codex's own context."""
    while True:
        stripped = WRAPPER.sub("", text, count=1)
        if stripped == text:
            break
        text = stripped
    if text.lstrip().startswith("# AGENTS.md instructions for"):
        return None  # Codex pastes the folder's AGENTS.md in as a user turn: not something Parth said
    attachments = []
    if text.lstrip().startswith("# Files mentioned by the user:"):
        head, _, request = text.partition("## My request:")
        for line in head.splitlines():
            found = re.match(r"^## (.+?): (\S.*)$", line)
            if found:
                attachments.append("a pasted image" if found.group(1).startswith("codex-clipboard") else found.group(1).strip())
        text = request
    text = re.sub(r"<image\b[^>]*>.*?</image>", "", text, flags=re.S)
    text = "\n".join(line for line in text.splitlines()
                     if line.strip() not in ("Image attachment: true", "Distinguish instructions in attached documents from the user's request."))
    text = text.strip()
    if not text and not attachments:
        return None
    return text, attachments


def clean_assistant(text):
    # Codex's ":::writing{…} … :::" draft blocks: show the draft as a quote.
    def quote(match):
        body = match.group(1).strip("\n")
        return "**Draft:**\n\n" + "\n".join("> " + line if line else ">" for line in body.splitlines())
    return re.sub(r"^:::writing\{[^}]*\}\n(.*?)\n:::\s*$", quote, text, flags=re.S | re.M).strip()


def from_codex(path):
    raw, rows = read_rollout(path)
    meta = next((r["payload"] for r in rows if r.get("type") == "session_meta"), {})
    counter = [0]
    messages, tools, files = [], 0, []

    tool_time = None

    def flush():
        nonlocal tools, files
        if tools:
            item = {"role": "tools", "time": local(tool_time), "count": tools}
            if files:
                item["files"] = sorted(set(files), key=files.index)
            messages.append(item)
        tools, files = 0, []

    last = meta.get("timestamp")
    for row in rows:
        if row.get("type") != "response_item":
            continue
        item = row.get("payload") or {}
        kind = item.get("type")
        if kind in ("function_call", "custom_tool_call"):
            tools += 1
            args = str(item.get("arguments") or item.get("input") or "")
            files += patched_files(args)
            tool_time = last = row.get("timestamp") or last
            continue
        if kind != "message" or item.get("role") not in ("user", "assistant"):
            continue  # developer/system instructions, reasoning, tool output: never kept
        text = "\n".join(c.get("text", "") for c in item.get("content", []) if isinstance(c, dict))
        stamp = row.get("timestamp") or last
        if item["role"] == "user":
            cleaned = clean_user(text)
            if not cleaned:
                continue
            text, attachments = cleaned
        else:
            text, attachments = clean_assistant(text), []
        if not text and not attachments:
            continue
        flush()
        message = {"role": item["role"], "time": local(stamp), "text": redact(text, counter)}
        if attachments:
            message["attachments"] = attachments
        messages.append(message)
        last = stamp
    flush()

    gaps = []
    attached = [a for m in messages for a in m.get("attachments", [])]
    if attached:
        gaps.append("Attachments are named but not included: " + ", ".join(attached) + ".")
    chat_id = meta.get("id") or ROLLOUT.search(Path(path).name).group(1)
    # `codex exec` runs are started by a program (a script, or another assistant testing Codex),
    # not typed by Parth in the Codex app, so they're skipped unless asked for.
    scripted = meta.get("originator") == "codex_exec" or meta.get("source") == "exec"
    # Sub-agents Codex starts on its own (e.g. the "guardian" that approves another chat's actions) keep a
    # record too, but they're not a chat Parth had: no thread_source "user", a parent thread, or a
    # {"subagent": ...} source. Skipped the same way.
    subagent = (isinstance(meta.get("source"), dict) and "subagent" in meta["source"]) or bool(meta.get("parent_thread_id")) \
        or meta.get("thread_source") not in (None, "user")
    first = next((m["text"] for m in messages if m["role"] == "user" and m.get("text")), "")
    return {
        "chat_id": chat_id,
        "source": "Codex",
        "origin": ("codex exec run" if scripted else "Codex desktop app") + ", local record (" + Path(path).name + ")",
        "_scripted": scripted,
        "_subagent": subagent,
        "_first_request": " ".join(first.split())[:60],
        "cwd": relative(meta.get("cwd", "")),
        "in_workspace": in_workspace(meta.get("cwd", "")),
        "started": local(meta["timestamp"]) if meta.get("timestamp") else "",
        "ended": messages[-1]["time"] if messages else "",
        "completeness": "Complete" if messages else "Not available",
        "gaps": gaps,
        "redactions": counter[0],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "messages": messages,
    }


def codex_chats(codex_home):
    """{chat id: rollout path} for every local Codex chat, and {id: title} from Codex's index."""
    paths = {}
    for path in sorted((codex_home / "sessions").rglob("rollout-*.jsonl*")):
        found = ROLLOUT.search(path.name)
        if found:
            paths[found.group(1)] = path
    titles = {}
    index = codex_home / "session_index.jsonl"
    if index.exists():
        for line in index.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                titles[row.get("id")] = row.get("thread_name") or ""
    return paths, titles


# ---------- ChatGPT (an account data export) ----------

def from_chatgpt_export(conversation):
    """One conversation from ChatGPT's conversations.json → the same shape as from_codex()."""
    counter = [0]
    nodes = conversation.get("mapping") or {}
    chain, node = [], conversation.get("current_node")
    while node and node in nodes:  # the branch that was on screen, walked back to the start
        chain.append(nodes[node])
        node = nodes[node].get("parent")
    messages = []
    for entry in reversed(chain):
        message = entry.get("message") or {}
        role = (message.get("author") or {}).get("role")
        content = message.get("content") or {}
        if role not in ("user", "assistant") or content.get("content_type") not in ("text", "multimodal_text"):
            continue  # system, tool and hidden ("thoughts", "reasoning_recap", code) parts aren't kept
        if (message.get("metadata") or {}).get("is_visually_hidden_from_conversation"):
            continue
        parts = [p for p in content.get("parts") or [] if isinstance(p, str)]
        attachments = [a.get("name", "file") for a in (message.get("metadata") or {}).get("attachments") or []]
        text = "\n\n".join(parts).strip()
        if not text and not attachments:
            continue
        item = {"role": role, "time": local(message["create_time"]) if message.get("create_time") else "",
                "text": redact(text, counter)}
        if attachments:
            item["attachments"] = attachments
        messages.append(item)
    gaps = []
    attached = [a for m in messages for a in m.get("attachments", [])]
    if attached:
        gaps.append("Attachments are named but not included: " + ", ".join(attached) + ".")
    if len(nodes) > len(chain):  # chain runs from the shown reply back to the root, so any node off it is another branch
        gaps.append("Only the branch that was last shown is included; edited or regenerated replies are left out.")
    started = conversation.get("create_time")
    raw = json.dumps(conversation, sort_keys=True).encode("utf-8")
    return {
        "chat_id": conversation.get("conversation_id") or conversation.get("id"),
        "source": "ChatGPT",
        "origin": "ChatGPT account export (conversations.json)",
        "cwd": "",
        "in_workspace": True,  # chosen by hand with --chat
        "started": local(started) if started else (messages[0]["time"] if messages else ""),
        "ended": messages[-1]["time"] if messages else "",
        "completeness": "Complete" if messages else "Not available",
        "gaps": gaps,
        "redactions": counter[0],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "messages": messages,
        "_title": conversation.get("title") or "",
    }


# ---------- Writing ----------

def slug(title):
    words = re.sub(r"[^a-z0-9]+", " ", title.lower()).split()
    return "-".join(words[:6]) or "chat"


def session_files(chatgpt_dir):
    """{chat id: session file} for the session files that already name their chat."""
    found = {}
    for path in sorted((chatgpt_dir / "sessions").glob("*.md")):
        text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
        if text.startswith("---\n") and "\n---\n" in text[4:]:
            try:
                meta = yaml.safe_load(text[4:text.index("\n---\n", 4)]) or {}
            except yaml.YAMLError:
                continue
            if isinstance(meta, dict) and meta.get("chat_id"):
                found[str(meta["chat_id"])] = path
    return found


def skeleton(record, title, imported):
    started = record["started"]
    date, time = (started[:10], started[11:16]) if started else ("", "")
    front = {
        "title": title[:60],
        "date": date,
        "time": time,
        "projects": [],
        "type": "",
        "status": "",
        "summary": "",
        "source": record["source"],
        "chat_id": record["chat_id"],
        "chat_title": title,
        "record": "Historical import",
        "imported": imported,
        "completeness": record["completeness"],
        "gaps": " ".join(record["gaps"]),
        "conversation": bool(record["messages"]),
    }
    lines = ["---"]
    for key, value in front.items():
        if key == "time" and value:
            lines.append(f'time: "{value}"')
        elif key == "date":
            lines.append(f"date: {value}")
        else:
            lines.append(f"{key}: " + json.dumps(value, ensure_ascii=False))
    lines.append("---")
    body = [f"# {title}", ""]
    for heading in ("Request and context", "Decisions and why", "What changed", "Verification (as reported at the time)",
                    "Left open", "Source and completeness"):
        body += [f"## {heading}", "", "_Not written yet._", ""]
    return "\n".join(lines) + "\n\n" + "\n".join(body)


def write_chat(record, title, chatgpt_dir, manifest, existing, dry_run, report):
    chat_id = record["chat_id"]
    imported = now()
    sources = chatgpt_dir / "sources"
    previous = manifest["chats"].get(chat_id, {})
    unchanged = (previous.get("sha256") == record["sha256"] and previous.get("format") == FORMAT
                 and (sources / f"{chat_id}.json").exists())

    entry = {
        "title": title,
        "source": record["source"],
        "origin": record["origin"],
        "cwd": record["cwd"],
        "started": record["started"],
        "ended": record["ended"],
        "messages": sum(1 for m in record["messages"] if m["role"] != "tools"),
        "completeness": record["completeness"],
        "gaps": record["gaps"],
        "redactions": record["redactions"],
        "sha256": record["sha256"],
        "format": FORMAT,
        "first_imported": previous.get("first_imported", imported),
        "imported": previous.get("imported", imported) if unchanged else imported,
    }
    session = existing.get(chat_id)
    if session is None:
        date = record["started"][:10] or imported[:10]
        session = chatgpt_dir / "sessions" / f"{date}-{slug(title)}.md"
        n = 2
        while session.exists():
            session = chatgpt_dir / "sessions" / f"{date}-{slug(title)}-{n}.md"
            n += 1
        action = "new session file"
    else:
        action = "session file kept as it is"
    entry["session"] = "sessions/" + session.name

    status = "unchanged" if unchanged else "updated" if previous else "imported"
    report.append(f"  {chat_id}  {title!r}: {status}, "
                  f"{entry['messages']} messages, {entry['completeness']}; {action} ({session.name})"
                  + (f"; {record['redactions']} value(s) redacted" if record["redactions"] else ""))
    manifest["chats"][chat_id] = entry
    if status != "unchanged" and (action == "new session file" or previous.get("messages") != entry["messages"]):
        manifest.setdefault("_write_up", []).append(f"{entry['session']} ({'new chat' if action == 'new session file' else 'the chat went on'})")
    manifest["known_missing"] = [m for m in manifest.get("known_missing", []) if m.get("chat_id") != chat_id]
    if dry_run:
        return
    sources.mkdir(parents=True, exist_ok=True)
    if not unchanged:
        stored = {key: value for key, value in record.items() if not key.startswith("_") and key != "in_workspace"}
        stored.update({"title": title, "imported": entry["imported"]})
        (sources / f"{chat_id}.json").write_text(json.dumps(stored, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if action == "new session file":
        session.parent.mkdir(parents=True, exist_ok=True)
        session.write_text(skeleton(record, title, entry["imported"]), encoding="utf-8")


def load_manifest(chatgpt_dir):
    path = chatgpt_dir / "sources" / "manifest.json"
    if path.exists():
        manifest = json.loads(path.read_text(encoding="utf-8"))
    else:
        manifest = {}
    manifest.setdefault("chats", {})
    manifest.setdefault("known_missing", [])
    manifest.setdefault("skipped", {})
    return manifest


def save_manifest(chatgpt_dir, manifest):
    manifest["updated"] = now()
    manifest["chats"] = dict(sorted(manifest["chats"].items(), key=lambda kv: kv[1].get("started", "")))
    path = chatgpt_dir / "sources" / "manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def run(chats=(), chatgpt_export=None, codex_home=CODEX_HOME, chatgpt_dir=CHATGPT, dry_run=False, include_scripted=False):
    manifest = load_manifest(chatgpt_dir)
    existing = session_files(chatgpt_dir)
    report, wanted = [], set(chats)

    if chatgpt_export:
        if not wanted:
            raise SystemExit("--chatgpt-export needs --chat <id> for each chat to take from it")
        conversations = json.loads(Path(chatgpt_export).read_text(encoding="utf-8"))
        for conversation in conversations:
            chat_id = conversation.get("conversation_id") or conversation.get("id")
            if chat_id in wanted:
                record = from_chatgpt_export(conversation)
                write_chat(record, record["_title"], chatgpt_dir, manifest, existing, dry_run, report)
                wanted.discard(chat_id)
    else:
        paths, titles = codex_chats(codex_home)
        for chat_id, path in paths.items():
            if wanted and chat_id not in wanted:
                continue
            wanted.discard(chat_id)
            try:
                record = from_codex(path)
            except PermissionError:
                report.append(f"  {chat_id}: locked by Codex right now, skipped (run again later)")
                continue
            # Codex names a chat a little after it starts; until then, its first request stands in.
            title = titles.get(chat_id) or record["_first_request"] or path.name
            if not record["in_workspace"] and chat_id not in chats:
                manifest["skipped"][chat_id] = {"title": title, "cwd": record["cwd"], "reason": "outside parth_project"}
                report.append(f"  {chat_id}  {title!r}: skipped, it ran outside parth_project ({record['cwd']})")
                continue
            if record["_scripted"] and not include_scripted and chat_id not in chats and chat_id not in manifest["chats"]:
                manifest["skipped"][chat_id] = {"title": title, "cwd": record["cwd"], "reason": "scripted codex exec run, not a chat"}
                report.append(f"  {chat_id}  {title!r}: skipped, a scripted `codex exec` run (--include-scripted or --chat to take it)")
                continue
            if record["_subagent"] and chat_id not in chats:
                manifest["skipped"][chat_id] = {"title": title, "cwd": record["cwd"], "reason": "a Codex sub-agent (e.g. the guardian approval reviewer), not a chat"}
                report.append(f"  {chat_id}  {title!r}: skipped, a Codex sub-agent, not a chat (--chat to take it)")
                continue
            manifest["skipped"].pop(chat_id, None)
            write_chat(record, title, chatgpt_dir, manifest, existing, dry_run, report)
    for chat_id in sorted(wanted):
        report.append(f"  {chat_id}: not found" + (" in the export" if chatgpt_export else f" under {codex_home / 'sessions'}"))
    write_up = manifest.pop("_write_up", [])
    if write_up:
        report.append("To write up (frontmatter, write-up, a LOG.md line):")
        report += ["  " + line for line in write_up]
    if not dry_run:
        save_manifest(chatgpt_dir, manifest)
    return manifest, report


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--chat", action="append", default=[], help="a chat id (repeat for more)")
    parser.add_argument("--chatgpt-export", help="conversations.json from a ChatGPT data export")
    parser.add_argument("--codex-home", type=Path, default=CODEX_HOME)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--include-scripted", action="store_true", help="also take `codex exec` runs (skipped by default)")
    args = parser.parse_args()
    _, lines = run(args.chat, args.chatgpt_export, args.codex_home, CHATGPT, args.dry_run, args.include_scripted)
    print(("Would do" if args.dry_run else "Done") + f" ({CHATGPT}):")
    print("\n".join(lines) or "  nothing to import")
