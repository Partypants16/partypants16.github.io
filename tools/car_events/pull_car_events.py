"""Fetch the latest car-events.json from n8n and put it where the website serves it.

usage (from apps/my-website/):
    python tools/car_events/pull_car_events.py            # fetch + write
    python tools/car_events/pull_car_events.py --stage    # ...and `git add` it (the pre-commit hook)

n8n's "Car Events - Scraper" workflow refreshes the list every morning on the home server, and
its "Car Events - File" workflow hands it out over the home network. This script copies it to:
  - data/car-events.json                       (what car-events.html shows; committed, public)
  - ../n8n-home/car-events/car-events.json     (the laptop copy, so it's in every box sync)

The address of n8n is a home-network one, so it is NOT in this public repo: it comes from the
CAR_EVENTS_URL environment variable, or from tools/car_events/source_url.txt (git-ignored).

It never fails a commit: if n8n can't be reached, or the reply doesn't look right, it prints
one line, leaves both files as they are and exits 0. Standard library only.
"""
import json, os, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
TARGET = os.path.join(SITE, "data", "car-events.json")
LAPTOP_COPY = os.path.normpath(os.path.join(SITE, "..", "n8n-home", "car-events", "car-events.json"))
URL_FILE = os.path.join(HERE, "source_url.txt")


def say(msg):
    print("car-events: " + msg)


def source_url():
    url = os.environ.get("CAR_EVENTS_URL", "").strip()
    if not url and os.path.exists(URL_FILE):
        with open(URL_FILE, encoding="utf-8") as f:
            url = f.read().strip()
    return url


def looks_right(d):
    if not isinstance(d, dict) or not isinstance(d.get("events"), list) or not isinstance(d.get("sources"), list):
        return "no events/sources lists"
    if not d.get("generatedAt"):
        return "no generatedAt"
    for e in d["events"]:
        if not all(e.get(k) for k in ("id", "name", "start", "links")):
            return "an event is missing id/name/start/links"
    return None


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


def main():
    stage = "--stage" in sys.argv[1:]
    url = source_url()
    if not url:
        say("no CAR_EVENTS_URL or source_url.txt, skipped")
        return
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:  # off the home Wi-Fi, n8n down, workflow not published...
        say("couldn't fetch the list (%s), kept the current file" % e.__class__.__name__)
        return
    problem = looks_right(data)
    if problem:
        say("the list didn't look right (%s), kept the current file" % problem)
        return
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    old = None
    if os.path.exists(TARGET):
        with open(TARGET, encoding="utf-8") as f:
            old = f.read()
    write(LAPTOP_COPY, text)
    if old == text:
        say("already up to date (%d events)" % len(data["events"]))
    else:
        write(TARGET, text)
        say("updated: %d events, refreshed %s" % (len(data["events"]), data["generatedAt"]))
    if stage:
        subprocess.run(["git", "add", "data/car-events.json"], cwd=SITE, check=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never block a commit
        say("skipped (%s: %s)" % (e.__class__.__name__, e))
    sys.exit(0)
