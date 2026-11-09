"""Build music-data.js (the Music page's data) from Parth's Spotify export.

    python tools/build_music_data.py            (from apps/my-website/)

Reads Spotify's "Extended streaming history" JSON files from _spotify_raw/
(git-ignored: copied from ai/PAT-AI/Parth_Info/Spotify Extended Streaming History/)
and writes music-data.js as `const MUSIC = {...}`.

The raw export has IP addresses, countries, device versions and every play with
its exact time. None of that goes on the public site: music-data.js only holds
totals, top lists, and minutes per day / month / hour.

Rules (keep them in sync with the "How this is counted" note on music.html):
- A play counts once it lasted 30 seconds (Spotify's own rule). Time listened
  counts every second, short plays included.
- Songs are music tracks (audio and music videos). Podcast episodes are counted
  apart and only shown in their own small list.
- Spotify's times are UTC and mark when a play ended. Each play is placed at its
  start, in Melbourne time (Kolkata time for plays made from India).
- A skip is a play Spotify marks as skipped, or one ended with the next button.
- A listening session ends after 30 minutes of nothing playing.
"""

import collections
import datetime as dt
import glob
import json
import os
import sys
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
RAW = os.path.join(SITE, "_spotify_raw")
OUT = os.path.join(SITE, "music-data.js")

MELBOURNE = ZoneInfo("Australia/Melbourne")
ZONES = {"IN": ZoneInfo("Asia/Kolkata")}
MIN_PLAY_MS = 30_000
SESSION_GAP = dt.timedelta(minutes=30)
TOP = 15

# Spotify's "platform" strings, folded into a few device families.
def device(platform):
    p = (platform or "").lower()
    if "playstation" in p or p.startswith("ps"):
        return "PlayStation"
    if p.startswith("ios") or "iphone" in p or "ipad" in p:
        return "iPhone / iPad"
    if "android" in p:
        return "Android"
    if p.startswith("windows") or "windows" in p:
        return "Windows"
    if p.startswith("osx") or "os x" in p or "mac" in p:
        return "Mac"
    if "web" in p or "chrome" in p or "browser" in p:
        return "Web player"
    return "Unknown"

# Why a play started or ended, in plain words.
REASONS = {
    "trackdone": "Previous song finished",
    "clickrow": "Picked it",
    "fwdbtn": "Next button",
    "backbtn": "Back button",
    "playbtn": "Play button",
    "appload": "App opened",
    "remote": "Another device",
    "trackerror": "Playback error",
    "endplay": "Stopped / switched",
    "logout": "Logged out / app closed",
    "unexpected-exit": "App crashed",
    "unexpected-exit-while-paused": "App closed while paused",
}
END_REASONS = dict(REASONS, trackdone="Played to the end")


def load():
    files = sorted(glob.glob(os.path.join(RAW, "Streaming_History_*.json")))
    if not files:
        sys.exit(f"No Streaming_History_*.json files in {RAW}")
    rows = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            rows += json.load(fh)
    return rows


def parse(rows):
    plays, episodes = [], []
    for r in rows:
        ms = r.get("ms_played") or 0
        if ms <= 0:
            continue
        end = dt.datetime.strptime(r["ts"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
        start = end - dt.timedelta(milliseconds=ms)
        local = start.astimezone(ZONES.get(r.get("conn_country"), MELBOURNE))
        if r.get("episode_name"):
            episodes.append({"show": r.get("episode_show_name") or "Unknown show", "ms": ms, "local": local})
            continue
        track = r.get("master_metadata_track_name")
        artist = r.get("master_metadata_album_artist_name")
        if not track or not artist:
            continue
        plays.append({
            "track": track,
            "artist": artist,
            "album": r.get("master_metadata_album_album_name") or "",
            "ms": ms,
            "start": start,
            "end": end,
            "local": local,
            "device": device(r.get("platform")),
            "start_reason": r.get("reason_start") or "unknown",
            "end_reason": r.get("reason_end") or "unknown",
            "shuffle": bool(r.get("shuffle")),
            "skip": bool(r.get("skipped")) or r.get("reason_end") == "fwdbtn",
        })
    plays.sort(key=lambda p: p["start"])
    return plays, episodes


def h(ms):
    return round(ms / 3_600_000, 2)


def m(ms):
    return round(ms / 60_000)


def streak(dates):
    """Longest run of consecutive days, as (length, first day, last day)."""
    best = (0, None, None)
    run, first, prev = 0, None, None
    for d in sorted(dates):
        if prev and d - prev == dt.timedelta(days=1):
            run += 1
        else:
            run, first = 1, d
        if run > best[0]:
            best = (run, first, d)
        prev = d
    return best


def sessions(plays):
    """Longest listening session: plays with gaps under 30 minutes."""
    best = None
    s_start = s_end = None
    s_ms = 0
    for p in plays:
        if s_end is None or p["start"] - s_end > SESSION_GAP:
            s_start, s_ms = p, 0
            s_end = p["end"]
        s_ms += p["ms"]
        s_end = max(s_end, p["end"])
        if best is None or s_ms > best[0]:
            best = (s_ms, s_start["local"])
    return best


def ranked(counter, n):
    return [k for k, _ in counter.most_common(n)]


def view(plays, daily=True):
    """Everything one year (or all time) shows."""
    counted = [p for p in plays if p["ms"] >= MIN_PLAY_MS]
    total = sum(p["ms"] for p in plays)

    artist_ms = collections.Counter()
    artist_n = collections.Counter()
    song_n = collections.Counter()
    song_ms = collections.Counter()
    album_ms = collections.Counter()
    for p in plays:
        artist_ms[p["artist"]] += p["ms"]
        song_ms[(p["track"], p["artist"])] += p["ms"]
        if p["album"]:
            album_ms[(p["album"], p["artist"])] += p["ms"]
    for p in counted:
        artist_n[p["artist"]] += 1
        song_n[(p["track"], p["artist"])] += 1

    heat = [[0] * 24 for _ in range(7)]  # Monday first
    month_ms = [0] * 12
    day_ms = collections.Counter()
    device_ms = collections.Counter()
    for p in plays:
        loc = p["local"]
        heat[loc.weekday()][loc.hour] += p["ms"]
        month_ms[loc.month - 1] += p["ms"]
        day_ms[loc.date()] += p["ms"]
        device_ms[p["device"]] += p["ms"]

    starts = collections.Counter(REASONS.get(p["start_reason"], "Other") for p in counted)
    ends = collections.Counter(END_REASONS.get(p["end_reason"], "Other") for p in plays)

    # The song played most times in one day.
    per_day_song = collections.Counter((p["local"].date(), p["track"], p["artist"]) for p in counted)
    rep = per_day_song.most_common(1)
    big_day = day_ms.most_common(1)
    run = streak(day_ms.keys())
    sess = sessions(plays)

    out = {
        "stats": {
            "hours": h(total),
            "plays": len(counted),
            "artists": len({p["artist"] for p in counted}),
            "songs": len({(p["track"], p["artist"]) for p in counted}),
            "albums": len({(p["album"], p["artist"]) for p in counted if p["album"]}),
            "days": len(day_ms),
            "minPerDay": round(total / 60_000 / max(1, len(day_ms))),
            "skipRate": round(100 * sum(p["skip"] for p in plays) / max(1, len(plays)), 1),
            "shuffle": round(100 * sum(p["shuffle"] for p in plays) / max(1, len(plays)), 1),
            "streak": {"days": run[0], "from": str(run[1]), "to": str(run[2])} if run[0] else None,
            "bigDay": {"date": str(big_day[0][0]), "min": m(big_day[0][1])} if big_day else None,
            "session": {"date": str(sess[1].date()), "min": m(sess[0])} if sess else None,
            "repeat": {"date": str(rep[0][0][0]), "track": rep[0][0][1], "artist": rep[0][0][2], "n": rep[0][1]} if rep else None,
        },
        "artists": [[a, h(artist_ms[a]), artist_n[a]] for a in ranked(artist_ms, TOP)],
        "songs": [[t, a, song_n[(t, a)], h(song_ms[(t, a)])] for (t, a) in ranked(song_n, TOP)],
        "albums": [[al, a, h(album_ms[(al, a)])] for (al, a) in ranked(album_ms, 10)],
        "heat": [[m(v) for v in row] for row in heat],
        "months": [m(v) for v in month_ms],
        "devices": [[d, h(v)] for d, v in device_ms.most_common()],
        "starts": starts.most_common(),
        "ends": ends.most_common(),
    }
    if daily:
        out["days"] = {d.isoformat(): m(v) for d, v in sorted(day_ms.items()) if m(v) > 0}
    return out


def all_time(plays, episodes, years):
    by_year = collections.defaultdict(list)
    for p in plays:
        by_year[p["local"].year].append(p)

    # Month by month, across every year.
    monthly = collections.OrderedDict()
    first, last = plays[0]["local"], plays[-1]["local"]
    y, mo = first.year, first.month
    while (y, mo) <= (last.year, last.month):
        monthly[f"{y}-{mo:02d}"] = {"ms": 0, "plays": 0, "skips": 0}
        y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
    for p in plays:
        b = monthly[p["local"].strftime("%Y-%m")]
        b["ms"] += p["ms"]
        b["plays"] += 1
        b["skips"] += p["skip"]

    # Year by year: totals, discovery, variety.
    seen_artists = set()
    yearly = []
    artist_year_ms = collections.defaultdict(collections.Counter)
    for yr in years:
        ps = by_year[yr]
        a_ms = collections.Counter()
        s_n = collections.Counter()
        for p in ps:
            a_ms[p["artist"]] += p["ms"]
            if p["ms"] >= MIN_PLAY_MS:
                s_n[(p["track"], p["artist"])] += 1
        artist_year_ms[yr] = a_ms
        total = sum(a_ms.values())
        new = {a for a in a_ms if a not in seen_artists}
        new_ms = sum(a_ms[a] for a in new)
        seen_artists |= set(a_ms)
        top_song = s_n.most_common(1)
        yearly.append({
            "year": yr,
            "hours": h(total),
            "plays": sum(1 for p in ps if p["ms"] >= MIN_PLAY_MS),
            "artists": len(a_ms),
            "newArtists": len(new),
            "newShare": round(100 * new_ms / max(1, total), 1),
            "top10Share": round(100 * sum(v for _, v in a_ms.most_common(10)) / max(1, total), 1),
            "topArtist": a_ms.most_common(1)[0][0] if a_ms else None,
            "topSong": [top_song[0][0][0], top_song[0][0][1]] if top_song else None,
        })

    # Where the all-time top 8 artists ranked each year.
    total_ms = collections.Counter()
    for p in plays:
        total_ms[p["artist"]] += p["ms"]
    bump_artists = ranked(total_ms, 8)
    ranks = {}
    for a in bump_artists:
        row = []
        for yr in years:
            order = ranked(artist_year_ms[yr], 50)
            row.append(order.index(a) + 1 if a in order else None)
        ranks[a] = row

    # Artists heard in the most different years.
    artist_years = collections.defaultdict(set)
    for p in plays:
        if p["ms"] >= MIN_PLAY_MS:
            artist_years[p["artist"]].add(p["local"].year)
    loyal = sorted(artist_years, key=lambda a: (-len(artist_years[a]), -total_ms[a]))[:10]

    show_ms = collections.Counter()
    show_n = collections.Counter()
    for e in episodes:
        show_ms[e["show"]] += e["ms"]
        show_n[e["show"]] += 1

    return {
        "monthly": [[k, h(v["ms"]), v["plays"], round(100 * v["skips"] / v["plays"], 1) if v["plays"] else None]
                    for k, v in monthly.items()],
        "yearly": yearly,
        "bump": {"artists": bump_artists, "ranks": ranks},
        "loyal": [[a, sorted(artist_years[a]), h(total_ms[a])] for a in loyal],
        "podcasts": {
            "hours": h(sum(show_ms.values())),
            "episodes": len(episodes),
            "shows": [[s, h(show_ms[s]), show_n[s]] for s in ranked(show_ms, 8)],
        },
    }


def main():
    plays, episodes = parse(load())
    years = sorted({p["local"].year for p in plays})
    data = {
        "meta": {
            "from": plays[0]["local"].date().isoformat(),
            "to": plays[-1]["local"].date().isoformat(),
            "built": dt.date.today().isoformat(),
            "years": years,
        },
        "views": {"all": view(plays, daily=False)},
        "allTime": all_time(plays, episodes, years),
    }
    for yr in years:
        data["views"][str(yr)] = view([p for p in plays if p["local"].year == yr])

    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("// Made by tools/build_music_data.py from Parth's Spotify export. Don't edit by hand.\n")
        fh.write("// Totals and top lists only: no raw plays, IP addresses, countries or devices' details.\n")
        fh.write("const MUSIC = " + body + ";\n")
    s = data["views"]["all"]["stats"]
    print(f"Wrote {OUT} ({len(body) // 1024} KB): {s['hours']} h, {s['plays']} plays, "
          f"{s['artists']} artists, {s['songs']} songs, {data['meta']['from']} to {data['meta']['to']}")


if __name__ == "__main__":
    main()
