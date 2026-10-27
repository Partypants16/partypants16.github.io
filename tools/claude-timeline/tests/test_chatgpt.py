"""Checks for the ChatGPT page's importer and build, on made-up chats only (nothing real here).

    python -m unittest discover -s tools/claude-timeline/tests      # from my-website/
"""

import importlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import_chatgpt = importlib.import_module("import_chatgpt")
build = importlib.import_module("build")
chatgpt = importlib.import_module("chatgpt")

CHAT_ID = "01a00000-0000-7000-8000-000000000001"
OUTSIDE_ID = "01a00000-0000-7000-8000-000000000002"


def row(stamp, kind, payload):
    return {"timestamp": stamp, "type": kind, "payload": payload}


def message(stamp, role, text):
    kind = "input_text" if role in ("user", "developer") else "output_text"
    return row(stamp, "response_item", {"type": "message", "role": role, "content": [{"type": kind, "text": text}]})


def fake_rollout(cwd, chat_id=CHAT_ID, start="2026-08-10T11:58:53.000Z", originator="codex_work_desktop"):
    """A small Codex chat with everything the importer must keep or drop."""
    patch_call = 'text(await tools.apply_patch("*** Begin Patch\\n*** Update File: C:\\\\demo\\\\app\\\\Main.kt\\n@@\\n-a\\n+b\\n*** End Patch"));'
    return [
        row(start, "session_meta", {"id": chat_id, "timestamp": start, "cwd": str(cwd), "originator": originator,
                                    "base_instructions": {"text": "SYSTEM PROMPT, never shown"}}),
        message("2026-08-10T11:58:54.000Z", "developer", "DEVELOPER INSTRUCTIONS, never shown"),
        message("2026-08-10T11:58:55.000Z", "user", "<environment_context>\n  <cwd>C:\\x</cwd>\n</environment_context>"),
        message("2026-08-10T11:58:55.500Z", "user", "# AGENTS.md instructions for C:\\x\n\n<INSTRUCTIONS>\nAGENTS TEXT, never shown\n</INSTRUCTIONS>"),
        message("2026-08-10T11:58:56.000Z", "user",
                "\n# Files mentioned by the user:\n\n## handoff notes…: C:\\Users\\x\\.codex/attachments/1/pasted-text.txt\n\n"
                "## My request:\nPlease carry on. The box is `plink -pw hunter2` and token=abc123secret\n"),
        row("2026-08-10T11:58:57.000Z", "response_item", {"type": "reasoning", "summary": [{"text": "HIDDEN REASONING"}]}),
        message("2026-08-10T11:59:00.000Z", "assistant", "Looking now. <script>alert(1)</script> [bad](javascript:alert(1))"),
        row("2026-08-10T11:59:01.000Z", "response_item", {"type": "custom_tool_call", "name": "exec", "input": patch_call}),
        row("2026-08-10T11:59:02.000Z", "response_item", {"type": "custom_tool_call_output", "output": "TOOL OUTPUT, never shown"}),
        message("2026-08-10T11:59:30.000Z", "assistant", "Done:\n\n:::writing{variant=\"standard\" id=\"1\"}\n# Draft\nText\n:::"),
    ]


class ImporterTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.codex = self.tmp / "codex"
        self.out = self.tmp / "chatgpt"
        day = self.codex / "sessions" / "2026" / "08" / "10"
        day.mkdir(parents=True)
        inside = import_chatgpt.WORKSPACE / "apps" / "demo-app"
        self.rollout = day / f"rollout-2026-08-10T21-58-53-{CHAT_ID}.jsonl"
        self.rollout.write_text("\n".join(json.dumps(r) for r in fake_rollout(inside)) + "\n", encoding="utf-8")
        (day / f"rollout-2026-08-10T22-00-00-{OUTSIDE_ID}.jsonl").write_text(
            "\n".join(json.dumps(r) for r in fake_rollout(self.tmp / "elsewhere", OUTSIDE_ID)) + "\n", encoding="utf-8")
        (self.codex / "session_index.jsonl").write_text(
            json.dumps({"id": CHAT_ID, "thread_name": "Demo chat"}) + "\n", encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_import(self, **kw):
        return import_chatgpt.run(codex_home=self.codex, chatgpt_dir=self.out, **kw)

    def test_keeps_only_what_was_said(self):
        self.run_import()
        record = json.loads((self.out / "sources" / f"{CHAT_ID}.json").read_text(encoding="utf-8"))
        roles = [m["role"] for m in record["messages"]]
        self.assertEqual(roles, ["user", "assistant", "tools", "assistant"])
        text = json.dumps(record)
        for hidden in ("SYSTEM PROMPT", "DEVELOPER INSTRUCTIONS", "HIDDEN REASONING", "TOOL OUTPUT", "environment_context", "AGENTS TEXT"):
            self.assertNotIn(hidden, text)
        user = record["messages"][0]
        self.assertEqual(user["attachments"], ["handoff notes…"])
        self.assertNotIn("Files mentioned", user["text"])
        self.assertEqual(record["messages"][2]["files"], ["C:\\demo\\app\\Main.kt"])
        self.assertIn("> # Draft", record["messages"][3]["text"])
        self.assertEqual(record["completeness"], "Complete")
        self.assertTrue(record["gaps"], "a named attachment is a gap")

    def test_secrets_redacted(self):
        self.run_import()
        record = json.loads((self.out / "sources" / f"{CHAT_ID}.json").read_text(encoding="utf-8"))
        text = record["messages"][0]["text"]
        self.assertNotIn("hunter2", text)
        self.assertNotIn("abc123secret", text)
        self.assertEqual(record["redactions"], 2)

    def test_times_in_sydney_with_daylight_saving(self):
        self.assertEqual(import_chatgpt.local("2026-08-10T11:58:53.000Z"), "2026-08-10T21:58:53+10:00")  # AEST
        self.assertEqual(import_chatgpt.local("2026-10-26T23:00:06.526Z"), "2026-10-27T10:00:06+11:00")  # AEDT
        self.run_import()
        session = next((self.out / "sessions").glob("*.md")).read_text(encoding="utf-8")
        self.assertIn("date: 2026-08-10", session)
        self.assertIn('time: "21:58"', session)
        self.assertIn(f'chat_id: "{CHAT_ID}"', session)

    def test_outside_workspace_skipped(self):
        manifest, _ = self.run_import()
        self.assertIn(CHAT_ID, manifest["chats"])
        self.assertNotIn(OUTSIDE_ID, manifest["chats"])
        self.assertIn(OUTSIDE_ID, manifest["skipped"])

    def test_rerun_no_duplicates_and_keeps_hand_edits(self):
        self.run_import()
        session = next((self.out / "sessions").glob("*.md"))
        session.write_text(session.read_text(encoding="utf-8").replace('summary: ""', 'summary: "Fixed by hand"'), encoding="utf-8")
        manifest, report = self.run_import()
        self.assertEqual(len(list((self.out / "sessions").glob("*.md"))), 1)
        self.assertEqual(list(manifest["chats"]), [CHAT_ID])
        self.assertIn("unchanged", report[0])
        self.assertIn("Fixed by hand", session.read_text(encoding="utf-8"))
        # The chat goes on: the record is updated, the write-up still isn't touched.
        with self.rollout.open("a", encoding="utf-8") as f:
            f.write(json.dumps(message("2026-08-10T12:30:00.000Z", "user", "One more thing")) + "\n")
        manifest, report = self.run_import()
        self.assertIn("updated", report[0])
        self.assertEqual(manifest["chats"][CHAT_ID]["messages"], 4)
        self.assertEqual(len(list((self.out / "sessions").glob("*.md"))), 1)
        self.assertIn("Fixed by hand", session.read_text(encoding="utf-8"))

    def test_known_missing_cleared_once_imported(self):
        (self.out / "sources").mkdir(parents=True)
        (self.out / "sources" / "manifest.json").write_text(json.dumps(
            {"chats": {}, "known_missing": [{"chat_id": CHAT_ID, "title": "Demo"}, {"chat_id": "other", "title": "Other"}]}),
            encoding="utf-8")
        manifest, _ = self.run_import()
        self.assertEqual([m["chat_id"] for m in manifest["known_missing"]], ["other"])

    def test_scripted_runs_skipped_unless_asked(self):
        scripted = "01a00000-0000-7000-8000-000000000003"
        inside = import_chatgpt.WORKSPACE / "apps" / "demo-app"
        (self.rollout.parent / f"rollout-2026-08-10T23-00-00-{scripted}.jsonl").write_text(
            "\n".join(json.dumps(r) for r in fake_rollout(inside, scripted, originator="codex_exec")) + "\n", encoding="utf-8")
        manifest, _ = self.run_import()
        self.assertNotIn(scripted, manifest["chats"])
        self.assertIn("scripted", manifest["skipped"][scripted]["reason"])
        manifest, _ = self.run_import(include_scripted=True)
        self.assertIn(scripted, manifest["chats"])
        self.assertTrue(manifest["chats"][scripted]["origin"].startswith("codex exec run"))

    def test_subagent_records_skipped(self):
        # Codex's "guardian" approval reviewer keeps its own record; it isn't a chat Parth had
        guardian = "01a00000-0000-7000-8000-000000000004"
        inside = import_chatgpt.WORKSPACE / "apps" / "demo-app"
        rows = fake_rollout(inside, guardian)
        rows[0]["payload"].update(source={"subagent": {"other": "guardian"}}, thread_source="guardian_review",
                                  parent_thread_id=CHAT_ID)
        (self.rollout.parent / f"rollout-2026-08-10T23-30-00-{guardian}.jsonl").write_text(
            "\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
        manifest, _ = self.run_import()
        self.assertNotIn(guardian, manifest["chats"])
        self.assertIn("sub-agent", manifest["skipped"][guardian]["reason"])
        self.assertIn(CHAT_ID, manifest["chats"])          # the chat it reviewed is still imported

    def test_title_falls_back_to_first_request(self):
        (self.codex / "session_index.jsonl").write_text("", encoding="utf-8")  # Codex hasn't named it yet
        manifest, _ = self.run_import()
        self.assertTrue(manifest["chats"][CHAT_ID]["title"].startswith("Please carry on."), manifest["chats"][CHAT_ID]["title"])

    def test_write_up_list(self):
        _, report = self.run_import()
        self.assertIn("(new chat)", "\n".join(report))
        _, report = self.run_import()
        self.assertNotIn("To write up", "\n".join(report))
        with self.rollout.open("a", encoding="utf-8") as f:
            f.write(json.dumps(message("2026-08-10T12:30:00.000Z", "user", "One more thing")) + "\n")
        _, report = self.run_import()
        self.assertIn("(the chat went on)", "\n".join(report))

    def test_dry_run_writes_nothing(self):
        self.run_import(dry_run=True)
        self.assertFalse(self.out.exists())

    def test_compressed_rollout(self):
        try:
            import zstandard
        except ImportError:
            self.skipTest("zstandard not installed")
        raw = self.rollout.read_bytes()
        self.rollout.with_name(self.rollout.name + ".zst").write_bytes(zstandard.ZstdCompressor().compress(raw))
        self.rollout.unlink()
        manifest, _ = self.run_import()
        self.assertEqual(manifest["chats"][CHAT_ID]["messages"], 3)


class ChatGPTExportTest(unittest.TestCase):
    def test_current_branch_only(self):
        def node(id, parent, role, text, kind="text", hidden=False):
            meta = {"is_visually_hidden_from_conversation": True} if hidden else {}
            return {"id": id, "parent": parent, "message": {
                "author": {"role": role}, "create_time": 1786363200, "metadata": meta,
                "content": {"content_type": kind, "parts": [text]}}}
        mapping = {
            "root": {"id": "root", "parent": None, "message": None},
            "s": node("s", "root", "system", "SYSTEM"),
            "u": node("u", "s", "user", "Hello"),
            "t": node("t", "u", "assistant", "THOUGHTS", kind="thoughts"),
            "a1": node("a1", "t", "assistant", "First answer"),
            "a2": node("a2", "t", "assistant", "Regenerated answer"),
        }
        record = import_chatgpt.from_chatgpt_export({"conversation_id": "c1", "title": "T", "create_time": 1786363200,
                                                     "mapping": mapping, "current_node": "a2"})
        self.assertEqual([m["text"] for m in record["messages"]], ["Hello", "Regenerated answer"])
        self.assertEqual(record["source"], "ChatGPT")
        self.assertTrue(any("branch" in g for g in record["gaps"]))


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.claude_dir = self.tmp / "sessions"
        self.chat_dir = self.tmp / "chatgpt"
        (self.chat_dir / "sessions").mkdir(parents=True)
        (self.chat_dir / "sources").mkdir()
        self.claude_dir.mkdir()
        (self.claude_dir / "2026-01-01-claude-one.md").write_text("x", encoding="utf-8")
        (self.chat_dir / "sessions" / "2026-01-02-chat-one.md").write_text("x", encoding="utf-8")
        self.saved = build.SESSION_DIRS
        build.SESSION_DIRS = {"claude": self.claude_dir, "chatgpt": self.chat_dir / "sessions"}

    def tearDown(self):
        build.SESSION_DIRS = self.saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_links_go_to_the_right_page(self):
        base = self.chat_dir / "sessions"
        on_chatgpt = build.render("[c](2026-01-02-chat-one.md) [k](../../sessions/2026-01-01-claude-one.md)",
                                  "x", "chatgpt", base)
        self.assertIn('href="#2026-01-02-chat-one" class="session-link" data-session="2026-01-02-chat-one"', on_chatgpt)
        self.assertIn('href="./#2026-01-01-claude-one" class="session-link session-link--other"', on_chatgpt)
        on_claude = build.render("[c](../chatgpt/sessions/2026-01-02-chat-one.md) [k](2026-01-01-claude-one.md)",
                                 "x", "claude", self.claude_dir)
        self.assertIn('href="chatgpt.html#2026-01-02-chat-one"', on_claude)
        self.assertIn('href="#2026-01-01-claude-one" class="session-link" data-session', on_claude)

    def test_conversation_is_escaped(self):
        (self.chat_dir / "sources" / "c1.json").write_text(json.dumps({"source": "Codex", "messages": [
            {"role": "assistant", "time": "2026-01-02T10:00:00+11:00",
             "text": "<script>alert(1)</script> <img src=x onerror=alert(1)> [bad](javascript:alert(1))"}]}),
            encoding="utf-8")
        meta = {"source": "Codex", "record": "Historical import", "completeness": "Complete",
                "chat_id": "c1", "conversation": True}
        warned = []
        info = chatgpt.provenance("t", meta, self.chat_dir, lambda text: build.render(text, "t", "chatgpt"),
                                  lambda *a: warned.append(a))
        html = info["conversation"][0]["html"]
        self.assertNotIn("<script", html)
        self.assertNotIn("<img", html)
        self.assertNotIn('href="javascript', html)
        self.assertIn("&lt;script&gt;", html)
        self.assertEqual(info["conversation"][0]["who"], "Codex")
        self.assertEqual(warned, [])

    def test_provenance_checked(self):
        warned = []
        chatgpt.provenance("t", {"source": "Gemini", "record": "Historical import", "completeness": "Partial"},
                           self.chat_dir, str, lambda name, text: warned.append(text))
        self.assertTrue(any("source" in w for w in warned))
        self.assertTrue(any("chat_id" in w for w in warned))
        self.assertTrue(any("no conversation record" in w for w in warned))


if __name__ == "__main__":
    unittest.main()
