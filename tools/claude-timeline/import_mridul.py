"""Catch up Mridul's Claude Code chats into _workspace/context/mridul/ (his Claude page, since 2026-11-01).

    python tools/claude-timeline/import_mridul.py            # from my-website/
    python tools/claude-timeline/import_mridul.py --dry-run  # say what it would do, write nothing

Mridul uses Claude Code on this laptop for his own projects (personal_projects/, Downloads, …).
His workspaces have no session-log rule, so his page is written afterwards from the chats
themselves, the way the ChatGPT page is from Codex's.

Where chats come from: Claude Code keeps every chat as ~/.claude/projects/<folder>/<id>.jsonl,
and deletes one 30 days after it was last touched. Those files are only ever read. A chat is
Mridul's when the folder it ran in (cwd) is outside parth_project (those are Parth's) and isn't
a temporary folder (test runs, e.g. Eunomia's restore test).

What it writes, per chat:
- sources/<id>.json: the readable record. Mridul's and Claude's messages in order, with their
  times in Australia/Sydney, the chat's titles, and a one-line note of the tools used between
  messages (with the files they changed). Never: hidden reasoning, tool output, images, or the
  reminder blocks Claude Code adds to a turn. Obvious secrets are replaced with [redacted].
  A record is kept after Claude Code deletes its chat (that's the point: the chats don't last).
- sources/manifest.json: one line per chat (where it ran, first and last message, titles).

Nothing on the page comes from sources/ directly: each card is a hand-written session file in
sessions/ (same card fields as Claude's, see build.py) with `chat_id` and `covered_to` (the time of
the last message it covers). The run ends with a "To write up" list: chats with messages after
the newest `covered_to` among their session files. One long chat can have several session files.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

from import_chatgpt import local, redact, now  # same redaction and times as the ChatGPT import

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent.parent.parent.parent          # parth_project/
MRIDUL = WORKSPACE / "_workspace" / "context" / "mridul"
CLAUDE_PROJECTS = Path.home() / ".claude" / "projects"
TEMP = Path.home() / "AppData" / "Local" / "Temp"

# Blocks Claude Code adds to a user turn that Mridul didn't type.
WRAPPERS = re.compile(r"<(system-reminder|ide_opened_file|ide_selection|ide_diagnostics|command-message|"
                      r"local-command-stdout|local-command-stderr|local-command-caveat|user-prompt-submit-hook)\b[^>]*>.*?</\1>", re.S)
COMMAND = re.compile(r"<command-name>(.*?)</command-name>.*?(?:<command-args>(.*?)</command-args>)?", re.S)
EDIT_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}


def inside(path, folder):
    try:
        Path(path).resolve().relative_to(folder.resolve())
        return True
    except (ValueError, OSError):
        return False


def clean(text):
    command = COMMAND.search(text)
    text = WRAPPERS.sub("", COMMAND.sub("", text)).strip()
    if command:
        text = (f"{command.group(1).strip()} {(command.group(2) or '').strip()}".strip() + "\n\n" + text).strip()
    return text


def read_chat(path, counter):
    """One transcript → (cwd, titles, messages), or None if it has no conversation."""
    cwd, titles, messages, tools, files = None, [], [], 0, []

    def flush_tools(time):
        nonlocal tools, files
        if tools:
            messages.append({"role": "tools", "time": time, "count": tools, "files": sorted(set(files))})
        tools, files = 0, []

    for line in path.open(encoding="utf-8", errors="replace"):
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        kind = record.get("type")
        if kind == "ai-title" and record.get("aiTitle") and record["aiTitle"] not in titles:
            titles.append(record["aiTitle"])
        if kind not in ("user", "assistant") or record.get("isSidechain") or record.get("isMeta"):
            continue
        cwd = cwd or record.get("cwd")
        time = local(record["timestamp"]) if record.get("timestamp") else ""
        content = record.get("message", {}).get("content")
        blocks = [{"type": "text", "text": content}] if isinstance(content, str) else (content or [])
        text = []
        for block in blocks:
            if block.get("type") == "text":
                text.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tools += 1
                if block.get("name") in EDIT_TOOLS:
                    target = (block.get("input") or {}).get("file_path") or (block.get("input") or {}).get("notebook_path")
                    if target:
                        files.append(target)
        text = "\n\n".join(t for t in text if t)
        if kind == "user":
            if record.get("isCompactSummary"):
                continue  # Claude Code's own summary when a long chat is compacted, not Mridul's words
            text = clean(text)
        text = redact(text.strip(), counter)
        if not text:
            continue
        flush_tools(time)
        role = "user" if kind == "user" else "assistant"
        if messages and messages[-1]["role"] == role == "assistant":
            messages[-1]["text"] += "\n\n" + text  # one reply split around tool calls reads as one
        else:
            messages.append({"role": role, "time": time, "text": text})
    if not cwd or not any(m["role"] == "user" for m in messages):
        return None
    return cwd, titles, messages


def written_up():
    """chat id → the newest covered_to among its session files."""
    covered = {}
    for path in sorted((MRIDUL / "sessions").glob("*.md")):
        text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
        if not text.startswith("---\n"):
            continue
        meta = yaml.safe_load(text[4:text.find("\n---\n", 4)]) or {}
        chat, until = str(meta.get("chat_id") or ""), str(meta.get("covered_to") or "")
        if chat and until > covered.get(chat, ""):
            covered[chat] = until
    return covered


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sources = MRIDUL / "sources"
    manifest_path = sources / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"chats": {}}

    skipped = 0
    for path in sorted(CLAUDE_PROJECTS.glob("*/*.jsonl")):
        counter = [0]
        chat = read_chat(path, counter)
        if not chat:
            continue
        cwd, titles, messages = chat
        if inside(cwd, WORKSPACE) or inside(cwd, TEMP):
            skipped += 1
            continue
        chat_id = path.stem
        old = sources / f"{chat_id}.json"
        if old.exists():
            kept = json.loads(old.read_text(encoding="utf-8"))
            if len(kept["messages"]) > len(messages):
                continue  # never replace a fuller record with a shorter one
        times = [m["time"] for m in messages if m.get("time")]
        record = {"chat_id": chat_id, "cwd": cwd, "titles": titles, "first": times[0], "last": times[-1],
                  "read": now(), "redactions": counter[0], "messages": messages}
        manifest["chats"][chat_id] = {k: record[k] for k in ("cwd", "titles", "first", "last", "read")}
        manifest["chats"][chat_id]["messages"] = sum(m["role"] != "tools" for m in messages)
        if not args.dry_run:
            sources.mkdir(parents=True, exist_ok=True)
            old.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    if not args.dry_run:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    covered = written_up()
    print(f"{len(manifest['chats'])} chats of Mridul's kept in {sources.relative_to(WORKSPACE).as_posix()}/"
          f" ({skipped} of Parth's or test runs skipped){' [dry run]' if args.dry_run else ''}")
    todo = []
    for chat_id, info in sorted(manifest["chats"].items(), key=lambda item: item[1]["first"]):
        since = covered.get(chat_id, "")
        if info["last"] > since:
            todo.append((chat_id, info, since))
    print("\nTo write up:" if todo else "\nTo write up: nothing, every chat is covered.")
    for chat_id, info, since in todo:
        where = Path(info["cwd"]).name
        print(f"  {chat_id}  {where}  {info['first'][:10]} → {info['last'][:10]}"
              + (f"  (new since {since[:16]})" if since else "  (new chat)"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
