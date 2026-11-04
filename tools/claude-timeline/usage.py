"""Keep a running record of Claude Code usage, split by person, for the Usage tab (Parth, 2026-11-04).

usage (from my-website/):  python tools/claude-timeline/usage.py

Claude Code deletes a chat 30 days after it was last used, and ccusage can only count chats
that still exist. So every run asks ccusage (pinned below, run with npx) for daily usage per
chat folder and merges it into a ledger that keeps every day for good:
  parth_project/_workspace/context/usage/daily.json   (outside this public repo; LAN page only)
A day/folder already in the ledger is replaced only by a bigger total, so a day whose chats
were partly deleted keeps the fuller count it had before.

Who's who, by the folder a chat ran in (the same rule as import_mridul.py):
  inside parth_project -> Parth;  a temporary folder (test runs) -> Other;  anything else -> Mridul.
Both use one Windows account and one Claude login, so this splits by folder, not by person.

Runs at every /close-session and from a weekly Windows task (so Mridul's chats are kept even when
nobody closes a session). Costs are API-equivalent estimates from ccusage, not a bill.
"""
import datetime, json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

CCUSAGE = "ccusage@20.0.40"  # pinned 2026-11-04 (released 2026-10-21)
HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent.parent.parent.parent
LEDGER = WORKSPACE / "_workspace" / "context" / "usage" / "daily.json"
TIMEZONE = "Australia/Sydney"
FIELDS = ("inputTokens", "outputTokens", "cacheCreationTokens", "cacheReadTokens", "totalTokens", "totalCost")


def person(folder):
    """ccusage's project key is the chat folder with every / \\ : . replaced by '-'."""
    if "-AppData-Local-Temp-" in folder:
        return "Other"
    if re.match(r"(?i)^c--Users-[^-]+-Github-parth-project(-|$)", folder):
        return "Parth"
    return "Mridul"


def label(folder, who):
    if who == "Parth":
        rest = re.sub(r"(?i)^c--Users-[^-]+-Github-parth-project-?", "", folder)
        return rest or "parth_project"
    if who == "Other":
        return "Test runs"
    # his folder name as words: "family-tree" -> "Family Tree", "43-kanban" -> "Kanban"
    rest = re.sub(r"(?i)^c--Users-[^-]+-(Github-)?(personal-projects-)?", "", folder)
    words = [w for w in rest.split("-") if w and not w.isdigit()]
    return " ".join(w[:1].upper() + w[1:] for w in words) or folder


def run_ccusage():
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        sys.exit("npx not found (install Node.js)")
    base = [npx, "-y", CCUSAGE, "claude", "daily", "--json", "--instances", "--breakdown", "--timezone", TIMEZONE]
    # run from a temp folder: npx must not pick up a package.json in the workspace
    with tempfile.TemporaryDirectory() as tmp:
        for extra in ([], ["--offline"]):  # online pricing first; cached pricing if that fails
            r = subprocess.run(base + extra, cwd=tmp, capture_output=True, text=True, encoding="utf-8",
                               errors="replace", env={**os.environ, "NO_COLOR": "1"})
            if r.returncode == 0 and r.stdout.strip().startswith("{"):
                return json.loads(r.stdout), bool(extra)
    sys.exit("ccusage failed:\n" + (r.stdout + r.stderr)[-1500:])


def merge(ledger, report):
    changed = 0
    for folder, days in report.get("projects", {}).items():
        who = person(folder)
        for d in days:
            row = {"person": who, "project": label(folder, who), **{k: d.get(k, 0) for k in FIELDS},
                   "models": {m["modelName"]: {"tokens": sum(m.get(k, 0) for k in FIELDS[:4]), "cost": m.get("cost", 0)}
                              for m in d.get("modelBreakdowns", [])}}
            old = ledger["days"].setdefault(d["date"], {}).get(folder)
            if old is None or row["totalTokens"] > old["totalTokens"]:
                ledger["days"][d["date"]][folder] = row
                changed += 1
    return changed


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ledger = json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.is_file() else {"version": 1, "days": {}}
    report, offline = run_ccusage()
    changed = merge(ledger, report)
    ledger.update(updated=datetime.datetime.now().astimezone().isoformat(timespec="seconds"), ccusage=CCUSAGE,
                  timezone=TIMEZONE, pricing="cached (offline)" if offline else "online")
    ledger["days"] = dict(sorted(ledger["days"].items()))
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, indent=1, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, LEDGER)
    days = ledger["days"]
    totals = {}
    for rows in days.values():
        for row in rows.values():
            totals[row["person"]] = totals.get(row["person"], 0) + row["totalTokens"]
    print(f"Usage: {changed} day/folder row(s) added or grown; ledger has {len(days)} days"
          f" ({min(days, default='-')} to {max(days, default='-')}) → {LEDGER.relative_to(WORKSPACE).as_posix()}")
    print("  " + ", ".join(f"{who} {n / 1e6:,.1f}M tokens" for who, n in sorted(totals.items())))


def page_data():
    """What build.py ships as usage-data.json: the ledger's rows, flat. None if there's no ledger yet."""
    if not LEDGER.is_file():
        return None
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    rows = [{"date": date, **{k: row[k] for k in ("person", "project", *FIELDS, "models")}}
            for date, folders in ledger["days"].items() for row in folders.values()]
    return {"updated": ledger.get("updated"), "ccusage": ledger.get("ccusage"), "timezone": ledger.get("timezone"),
            "pricing": ledger.get("pricing"), "rows": rows}


if __name__ == "__main__":
    main()
