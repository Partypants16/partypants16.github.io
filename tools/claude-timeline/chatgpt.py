"""The ChatGPT page's extras: what build.py adds to a session from _workspace/context/chatgpt/.

The ChatGPT page is the Claude page's twin (same cards, filters and write-ups), for work done
with ChatGPT or Codex. Its sessions use the same card fields as the Claude logs, plus these,
which say where each one came from:

    source: Codex                         Codex or ChatGPT (the page is called ChatGPT either way)
    chat_id: 01a00000-0000-7000-…         the chat it's about
    chat_title: "Fix the login page"     the chat's own title
    record: Historical import             Historical import (written afterwards from the chat) or
                                          Maintained (written during the session, like Claude's)
    imported: "2026-10-27T10:55:00+11:00" when import_chatgpt.py first read the chat
    completeness: Complete                Complete, Partial or Not available: how much of the
                                          conversation the record below has
    gaps: "Attachments are named but …"   what's known to be missing, in words
    conversation: true                    show sources/<chat_id>.json as "Show conversation record"

sources/ holds the whole normalised record of each chat (import_chatgpt.py writes it). Only a
session that says `conversation: true` puts its record on the page, and only the messages:
the provenance fields in the record itself (origin file, checksums) stay in sources/.
"""

import json

SOURCES = ["Codex", "ChatGPT"]
RECORDS = ["Historical import", "Maintained"]
COMPLETENESS = ["Complete", "Partial", "Not available"]


def provenance(name, meta, folder, render, warn):
    """A ChatGPT session's extra card fields, its conversation record and that record's search text."""
    info = {}
    for key, allowed in (("source", SOURCES), ("record", RECORDS), ("completeness", COMPLETENESS)):
        value = meta.get(key)
        if value in allowed:
            info[key] = value
        else:
            warn(name, f"{key} {value!r} isn't one of {', '.join(allowed)}")
            info[key] = ""
    chat_id = str(meta.get("chat_id") or "")
    if info["record"] == "Historical import" and not chat_id:
        warn(name, "a historical import needs the chat_id it came from")
    info["chatId"] = chat_id
    info["chatTitle"] = str(meta.get("chat_title") or "")
    info["imported"] = str(meta.get("imported") or "")
    info["gaps"] = " ".join(str(meta.get("gaps") or "").split())

    conversation, text = [], []
    if meta.get("conversation") is True:
        path = folder / "sources" / f"{chat_id}.json"
        if not chat_id or not path.exists():
            warn(name, f"conversation: true, but there's no sources/{chat_id or '<chat_id>'}.json")
        else:
            record = json.loads(path.read_text(encoding="utf-8"))
            speaker = info["source"] or record.get("source") or "Assistant"
            for message in record.get("messages", []):
                if message.get("role") == "tools":
                    conversation.append({"role": "tools", "time": message.get("time", ""),
                                         "count": message.get("count", 0), "files": message.get("files", [])})
                    continue
                conversation.append({
                    "role": message["role"],
                    "who": "Parth" if message["role"] == "user" else speaker,
                    "time": message.get("time", ""),
                    "html": render(message.get("text", "")),
                    "attachments": message.get("attachments", []),
                })
                text.append(message.get("text", ""))
    elif meta.get("conversation") not in (None, False):
        warn(name, f"conversation {meta.get('conversation')!r} isn't true or false")
    if info["completeness"] in ("Complete", "Partial") and not conversation:
        warn(name, f"completeness is {info['completeness']} but no conversation record is shown")
    info["conversation"] = conversation
    info["searchConvo"] = " ".join(" ".join(text).split()).lower()
    return info


def missing(folder):
    """Chats known about but not imported (sources/manifest.json's known_missing), for the page."""
    path = folder / "sources" / "manifest.json"
    if not path.exists():
        return []
    manifest = json.loads(path.read_text(encoding="utf-8"))
    return [{"title": m.get("title", ""), "source": m.get("source", ""), "reason": m.get("reason", "")}
            for m in manifest.get("known_missing", [])]
