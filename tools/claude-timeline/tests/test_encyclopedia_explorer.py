"""Checks for the Encyclopedia's visual overview (explorer.json + explorer.html), on a made-up
encyclopedia only (nothing real here).

    python -m unittest discover -s tools/claude-timeline/tests      # from my-website/
"""

import importlib
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
encyclopedia = importlib.import_module("encyclopedia")

PAGES = {
    "README.md": "# Encyclopedia\n\nThe front page.\n\n*Last checked: 2026-10-22.*\n",
    "03-services/README.md": "# Services\n\nEvery service.\n\n*Last checked: 2026-10-22.*\n",
    "03-services/music.md": (
        "# Music\n\nThe box's **music** server. Status: **running, in use** (VERIFIED, 2026-10-22).\n\n"
        "## Where it runs\n\nIn [Containers](../02-infrastructure/containers.md). VERIFIED. INFERRED.\n\n"
        "```bash\n# [not a link](../02-infrastructure/nowhere.md)\n```\n\n"
        "## See also\n\n- [Backups](../04-operations/backups.md)\n\n"
        "*Last checked: 2026-10-22 (box snapshot).*\n"),
    "02-infrastructure/containers.md": (
        "# Containers\n\nDocker on the box.\n\n## See also\n\n- [Music](../03-services/music.md)\n\n"
        "*Last checked: 2026-10-23.*\n"),
    "04-operations/backups.md": "# Backups\n\nWhat's backed up.\n\n*Last checked: 2026-10-24.*\n",
    "09-plans-and-parked/relay.md": "# Relay\n\nA plan for a relay, design only.\n\n*Last checked: 2026-10-25.*\n",
    "12-projects/work.md": "# Work\n\nThe work folder.\n\n## Secret-ish heading\n\n[Music](../03-services/music.md)\n\n*Last checked: 2026-10-25.*\n",
}

YAML = """
areas:
  - id: box
    title: The box
    blurb: Where things run.
    page: 03-services/music.md
    groups:
      - title: Apps
        pages: [03-services/music.md, 03-services/missing.md]
tours:
  - id: fix
    title: Fix it
    steps:
      - id: start
        page: 03-services/music.md
        choices:
          - {label: Down, go: down}
          - {label: Lost, go: nowhere}
      - id: down
        page: 02-infrastructure/containers.md
        end: true
relations:
  - [03-services/music.md, runs in, 02-infrastructure/containers.md]
status:
  04-operations/backups.md: Finished
summary_only:
  - 12-projects/work.md
"""


class ExplorerBuild(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.source = self.tmp / "encyclopedia"
        for rel, text in PAGES.items():
            path = self.source / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        (self.source / "_explorer").mkdir()
        (self.source / "_explorer" / "explorer.yaml").write_text(YAML, encoding="utf-8")
        self.dest = self.tmp / "dist" / "encyclopedia"
        (self.tmp / "context" / "sessions").mkdir(parents=True)
        self.warnings = []
        encyclopedia.fetch_mermaid = lambda warn: None  # no download in tests
        encyclopedia.build(self.source, self.dest, self.tmp, self.tmp / "context",
                           lambda where, text: self.warnings.append(f"{where}: {text}"))
        self.data = json.loads((self.dest / "explorer.json").read_text(encoding="utf-8"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_page_facts_come_from_the_page(self):
        music = self.data["pages"]["03-services/music.html"]
        self.assertEqual(music["t"], "Music")
        self.assertEqual(music["s"], "Services")
        self.assertTrue(music["sum"].startswith("The box's music server."))
        self.assertNotIn("**", music["sum"])
        self.assertEqual(music["st"], "Running")  # from "Status:", not the bold "music"
        self.assertEqual((music["lc"], music["ln"]), ("2026-10-22", "box snapshot"))
        self.assertEqual([h for h, _ in music["h"]], ["Where it runs"])  # no "See also"
        self.assertEqual(music["c"], {"v": 2, "i": 1, "r": 0, "u": 0})  # one in the summary

    def test_links_and_backlinks(self):
        music = self.data["pages"]["03-services/music.html"]
        self.assertEqual(music["to"], ["02-infrastructure/containers.html", "04-operations/backups.html"])
        self.assertEqual(music["see"], ["04-operations/backups.html"])
        self.assertIn("03-services/music.html", self.data["pages"]["02-infrastructure/containers.html"]["from"])
        self.assertFalse(any("nowhere.md" in w for w in self.warnings))  # links in code don't count

    def test_status_overrides_and_folder_default(self):
        self.assertEqual(self.data["pages"]["04-operations/backups.html"]["st"], "Finished")
        self.assertEqual(self.data["pages"]["09-plans-and-parked/relay.html"]["st"], "Parked")
        self.assertEqual(self.data["pages"]["index.html"]["st"], "")

    def test_summary_only_pages_keep_no_detail(self):
        work = self.data["pages"]["12-projects/work.html"]
        self.assertEqual(set(work), {"t", "s", "f", "sum", "st", "lc", "ln"})
        self.assertNotIn("12-projects/work.html", self.data["pages"]["03-services/music.html"].get("from", []))

    def test_yaml_names_are_checked(self):
        self.assertEqual(self.data["areas"][0]["groups"][0]["pages"], ["03-services/music.html"])
        self.assertTrue(any("03-services/missing.md" in w for w in self.warnings))
        self.assertTrue(any("nowhere" in w for w in self.warnings))
        self.assertEqual(self.data["rel"], [["03-services/music.html", "runs in", "02-infrastructure/containers.html"]])

    def test_page_and_links(self):
        page = (self.dest / "explorer.html").read_text(encoding="utf-8")
        self.assertIn('<script src="explorer.js"></script>', page)
        self.assertIn('href="explorer.css"', page)
        self.assertIn('<div class="enc-body ex-body">', page)  # translatable, unlike article pages
        self.assertNotIn("{{", page)
        self.assertFalse((self.dest / "_explorer").exists())  # the YAML isn't shipped
        self.assertFalse((self.dest / "_explorer.html").exists())
        front = (self.dest / "index.html").read_text(encoding="utf-8")
        self.assertIn('class="enc-visual-cta"', front)
        other = (self.dest / "03-services" / "music.html").read_text(encoding="utf-8")
        self.assertIn('href="../explorer.html"', other)


if __name__ == "__main__":
    unittest.main()
