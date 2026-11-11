"""Install the pre-commit hook that adds the latest car events to every my-website commit.

usage (from apps/my-website/):  python tools/car_events/install_hook.py

Git hooks aren't part of the repo, so run this once per clone. It writes
.git/hooks/pre-commit, which runs pull_car_events.py --stage. That script never fails, so a
commit always goes through, with or without fresh events. If a pre-commit hook already exists
and isn't ours, it stops instead of overwriting it.
"""
import os, stat, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
MARK = "# car-events pre-commit hook (tools/car_events/install_hook.py)"
HOOK = MARK + """
# Adds the latest data/car-events.json from n8n to this commit. Never blocks the commit.
python tools/car_events/pull_car_events.py --stage || py tools/car_events/pull_car_events.py --stage || true
exit 0
"""

hooks = subprocess.run(["git", "rev-parse", "--git-path", "hooks"], cwd=SITE,
                       capture_output=True, text=True, check=True).stdout.strip()
path = os.path.join(SITE, hooks, "pre-commit")
if os.path.exists(path):
    with open(path, encoding="utf-8") as f:
        if MARK not in f.read():
            sys.exit("A different pre-commit hook is already there: %s. Merge by hand." % path)
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write("#!/bin/sh\n" + HOOK)
os.chmod(path, os.stat(path).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
print("installed", path)
