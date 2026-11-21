#!/usr/bin/env python3
"""Checks Parth's self-hosted services and publishes whether they're up to a
GitHub Gist. The home page (service-status.js) reads that gist to show
Online / Offline on each card.

Runs on the remote box (parth-Surface-Book) from cron every 5 minutes; see
README.md next to this file. Python standard library only.

    python3 check_services.py            # what cron runs (quiet)
    python3 check_services.py -v         # print each result
    python3 check_services.py -v --force # publish now, even if nothing changed

Files:
    ~/.config/service-status/github-token  token that can edit gists (you add it)
    ~/.config/service-status/gist-id       made on the first publish
    ~/service-status/status.json           latest check result
    ~/service-status/published.json        what was last sent to the gist
    ~/service-status/status.log            status changes and errors
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

# id (matches data-service on the home page card), URL the card links to
# (or docker:<container> for something with no web page)
SERVICES = [
    ("staysafe", "http://192.168.212.60:8100/"),
    ("skywardrobe", "http://192.168.212.60:3000/"),
    ("immich", "http://192.168.212.160:2283/"),
    ("navidrome", "http://192.168.212.60:4533/"),
    ("khane", "http://192.168.212.60:8095/"),
    ("vikunja", "http://192.168.212.60:3456/"),
    ("katha", "http://192.168.212.60:8090/"),
    ("crosspaste", "http://192.168.212.60/"),
    ("codeserver", "http://192.168.212.60:8080/"),
    ("netdata", "http://192.168.212.60:19999/"),
    ("n8n", "http://192.168.212.60:5678/"),
    ("searxng", "http://192.168.212.60:8081/"),
    ("apexdash", "http://192.168.212.60:8110/"),
    ("scanrunner", "http://192.168.212.60:8113/"),
    ("portfolio", "http://192.168.212.60:8112/"),
    # No web port: up while its Docker container is running (shown on the home
    # page as a small line, not a card).
    ("discordbot", "docker:personal-automation-bot"),
]

TIMEOUT_SECONDS = 5
RETRY_DELAY_SECONDS = 3
# Publish when something changes, and otherwise at least this often, so the
# page can tell "nothing changed" apart from "the box has stopped reporting".
HEARTBEAT_MINUTES = 15
CHECK_EVERY_MINUTES = 5
LOG_MAX_LINES = 1000

HOME = Path.home()
CONFIG_DIR = HOME / ".config" / "service-status"
TOKEN_FILE = CONFIG_DIR / "github-token"
GIST_ID_FILE = CONFIG_DIR / "gist-id"
DATA_DIR = HOME / "service-status"
STATUS_FILE = DATA_DIR / "status.json"
PUBLISHED_FILE = DATA_DIR / "published.json"
LOG_FILE = DATA_DIR / "status.log"

GIST_FILENAME = "status.json"
# Melbourne's weather for the website's clock-and-weather (since 2026-11-21): fetched from
# OpenWeatherMap with SkyWardrobe's key, read from its .env on this box each run so the key
# never leaves the box (the website is public and can't hold a key). Only the numbers are
# published, as weather.json in the same gist.
WEATHER_GIST_FILENAME = "weather.json"
WEATHER_FILE = DATA_DIR / "weather.json"
WEATHER_ENV = HOME / "Desktop" / "SkyWardrobe" / "SkyWardrobe-Docker" / ".env"
WEATHER_EVERY_MINUTES = 15
MELBOURNE = (-37.8136, 144.9631)
GIST_DESCRIPTION = "Service status for partypants16.github.io, updated by the home server every few minutes."


class NoRedirect(urllib.request.HTTPRedirectHandler):
    # A redirect means the service answered; following it could land on an
    # HTTPS name this box can't verify (CrossPaste) and look like an outage.
    def redirect_request(self, *args, **kwargs):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def log(message):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = LOG_FILE.read_text(encoding="utf-8").splitlines() if LOG_FILE.exists() else []
    lines.append(stamp + "  " + message)
    LOG_FILE.write_text("\n".join(lines[-LOG_MAX_LINES:]) + "\n", encoding="utf-8")


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def container_running(name):
    """True if the Docker container is running and not stuck restarting."""
    docker = shutil.which("docker") or "/usr/bin/docker"  # cron's PATH is short
    try:
        result = subprocess.run([docker, "inspect", "-f", "{{.State.Running}} {{.State.Restarting}}", name],
                                capture_output=True, text=True, timeout=TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return False
    return result.returncode == 0 and result.stdout.split() == ["true", "false"]


def probe(url):
    """True if the service answers with any HTTP status below 500
    (or, for docker:<name>, if that container is running)."""
    if url.startswith("docker:"):
        return container_running(url[len("docker:"):])
    try:
        with OPENER.open(urllib.request.Request(url, method="GET"), timeout=TIMEOUT_SECONDS) as response:
            return response.status < 500
    except urllib.error.HTTPError as error:  # 3xx (not followed) and 4xx still mean it's running
        return error.code < 500
    except (urllib.error.URLError, OSError, ValueError):
        return False


def check(url):
    # One retry, so a single dropped connection doesn't flip a card to Offline.
    if probe(url):
        return True
    time.sleep(RETRY_DELAY_SECONDS)
    return probe(url)


def github(method, url, token, body=None):
    request = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "parth-service-status",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def openweather_key():
    try:
        for line in WEATHER_ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENWEATHER_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def iso_from_unix(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch_weather(verbose):
    """Melbourne's current weather from OpenWeatherMap, or None. Never logs the URL (it holds the key)."""
    key = openweather_key()
    if not key:
        log("Weather: no OPENWEATHER_KEY in %s" % WEATHER_ENV)
        return None
    query = urllib.parse.urlencode({"lat": MELBOURNE[0], "lon": MELBOURNE[1], "units": "metric", "appid": key})
    try:
        with urllib.request.urlopen("https://api.openweathermap.org/data/2.5/weather?" + query, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
        main, sky, sys_info = data["main"], data["weather"][0], data["sys"]
        return {
            "fetched_at": now_iso(),
            "place": "Melbourne",
            "source": "OpenWeatherMap",
            "temp": round(main["temp"], 1),
            "feels_like": round(main["feels_like"], 1),
            "temp_min": round(main["temp_min"], 1),
            "temp_max": round(main["temp_max"], 1),
            "humidity": main.get("humidity"),
            "wind_kmh": round(data.get("wind", {}).get("speed", 0) * 3.6),
            "main": sky.get("main"),
            "description": sky.get("description"),
            "icon": sky.get("icon"),
            "is_day": str(sky.get("icon", "")).endswith("d"),
            "sunrise": iso_from_unix(sys_info["sunrise"]),
            "sunset": iso_from_unix(sys_info["sunset"]),
        }
    except urllib.error.HTTPError as error:
        log("Weather: OpenWeatherMap answered HTTP %d" % error.code)
    except (urllib.error.URLError, OSError, ValueError, KeyError, IndexError) as error:
        log("Weather: %s" % type(error).__name__)
    if verbose:
        print("Weather: couldn't fetch it (see the log).")
    return None


def publish(payload, verbose, weather=None):
    """Sends the payload (and fresh weather, if any) to the gist (making the gist the first time).
    Returns True on success."""
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        token = ""
    if not token:
        if verbose:
            print("No token in %s yet, so nothing was published." % TOKEN_FILE)
        return False

    files = {GIST_FILENAME: {"content": json.dumps(payload, indent=2) + "\n"}}
    if weather:
        files[WEATHER_GIST_FILENAME] = {"content": json.dumps(weather, indent=2) + "\n"}
    gist_id = GIST_ID_FILE.read_text(encoding="utf-8").strip() if GIST_ID_FILE.exists() else ""
    try:
        if gist_id:
            github("PATCH", "https://api.github.com/gists/" + gist_id, token, {"files": files})
        else:
            gist = github("POST", "https://api.github.com/gists", token,
                          {"description": GIST_DESCRIPTION, "public": False, "files": files})
            gist_id = gist["id"]
            CONFIG_DIR.mkdir(parents=True, exist_ok=True)
            GIST_ID_FILE.write_text(gist_id + "\n", encoding="utf-8")
            raw_url = "https://gist.githubusercontent.com/%s/%s/raw/%s" % (gist["owner"]["login"], gist_id, GIST_FILENAME)
            log("Made the status gist. Page URL: " + raw_url)
            print("Made the status gist. Put this in service-status.js as STATUS_URL:\n  " + raw_url)
    except urllib.error.HTTPError as error:
        hint = {401: " (token missing, wrong or expired)", 403: " (token can't edit gists)",
                404: " (gist not found: deleted? remove %s to make a new one)" % GIST_ID_FILE}.get(error.code, "")
        log("Publishing failed: HTTP %d%s" % (error.code, hint))
        if verbose:
            print("Publishing failed: HTTP %d%s" % (error.code, hint))
        return False
    except (urllib.error.URLError, OSError, ValueError, KeyError) as error:
        log("Publishing failed: %s" % error)
        if verbose:
            print("Publishing failed: %s" % error)
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Check the home services and publish their status.")
    parser.add_argument("-v", "--verbose", action="store_true", help="print each result")
    parser.add_argument("--force", action="store_true", help="publish even if nothing changed")
    args = parser.parse_args()

    checked_at = now_iso()
    with ThreadPoolExecutor(max_workers=len(SERVICES)) as pool:
        results = dict(zip([s[0] for s in SERVICES], pool.map(check, [s[1] for s in SERVICES])))

    # "since" = when the current state was first seen. Unknown (null) until the
    # state has changed at least once while this script was watching.
    previous = (read_json(STATUS_FILE) or {}).get("services", {})
    services = {}
    for service_id, up in results.items():
        before = previous.get(service_id)
        if before is None:
            since = None
        elif before.get("up") == up:
            since = before.get("since")
        else:
            since = checked_at
            log("%s is now %s" % (service_id, "up" if up else "DOWN"))
        services[service_id] = {"up": up, "since": since}

    payload = {"checked_at": checked_at, "check_every_minutes": CHECK_EVERY_MINUTES,
               "heartbeat_minutes": HEARTBEAT_MINUTES, "services": services}
    write_json(STATUS_FILE, payload)

    if args.verbose:
        for service_id, info in services.items():
            print("  %-12s %s" % (service_id, "up" if info["up"] else "DOWN"))

    # Weather every WEATHER_EVERY_MINUTES (a free OpenWeatherMap key allows far more).
    weather = None
    saved = read_json(WEATHER_FILE) or {}
    try:
        weather_age = (parse_iso(checked_at) - parse_iso(saved["fetched_at"])).total_seconds() / 60
    except (KeyError, ValueError):
        weather_age = float("inf")
    if args.force or weather_age >= WEATHER_EVERY_MINUTES - 1:
        weather = fetch_weather(args.verbose)
        if weather:
            write_json(WEATHER_FILE, weather)
            if args.verbose:
                print("  weather      %s C, %s" % (weather["temp"], weather["description"]))

    published = read_json(PUBLISHED_FILE) or {}
    changed = {k: v["up"] for k, v in published.get("services", {}).items()} != {k: v["up"] for k, v in services.items()}
    try:
        age_minutes = (parse_iso(checked_at) - parse_iso(published["checked_at"])).total_seconds() / 60
    except (KeyError, ValueError):
        age_minutes = float("inf")

    if args.force or changed or weather or age_minutes >= HEARTBEAT_MINUTES - 1:
        if publish(payload, args.verbose, weather):
            write_json(PUBLISHED_FILE, payload)
            if args.verbose:
                print("Published.")
    elif args.verbose:
        print("Nothing changed and the last publish was %d min ago, so not published." % age_minutes)


if __name__ == "__main__":
    sys.exit(main())
