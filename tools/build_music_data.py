"""Build the Music pages' data from each person's Spotify export.

    python tools/build_music_data.py            (from apps/my-website/: everyone)
    python tools/build_music_data.py aaron      (just one person)

One entry in PEOPLE per person. Each reads Spotify's "Extended streaming
history" JSON files from that person's raw folder and writes:
- music-data<suffix>.js           `const MUSIC = {...}` for music.html
- music-explorer-data<suffix>.js  `const MUSIC_X = {...}` for music-explorer.html
then music-people.js (`const MUSIC_PEOPLE = [...]`: who there is, which files
are theirs, and a few totals for the picker page and the Media card). That one
is made from whichever data files exist, so building one person keeps the rest.

Raw folders (never in the repo):
- Everyone, Parth included: ../../_workspace/spotify-exports/<key>/ (outside
  the repo; Aaron and Henry since 2026-11-24, Parth's moved there the same day
  from the git-ignored _spotify_raw/. His original is in ai/PAT-AI/Parth_Info/
  Spotify Extended Streaming History/)

Adding someone: unzip their export into _workspace/spotify-exports/<key>/, add
a line to PEOPLE, run this, add their Hinglish lines if any text is new, and
commit the new data files and music-people.js.

The raw export has IP addresses, countries, device versions and every play with
its exact time. None of that goes on the public site: the data files only hold
totals, top lists, and minutes per day / month / hour.

Rules (keep them in sync with the "How this is counted" note on music.html):
- A play counts once it lasted 30 seconds (Spotify's own rule). Time listened
  counts every second, short plays included.
- Songs are music tracks (audio and music videos). Podcast episodes are counted
  apart and only shown in their own small list.
- Spotify's times are UTC and mark when a play ended. Each play is placed at its
  start, in the time zone of the country it was played from (ZONES), and in
  Melbourne time for Australia and any country not in ZONES (unknown, or with
  several zones, like the US). Parth's and Henry's are Melbourne (and Kolkata).
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
WORKSPACE = os.path.dirname(os.path.dirname(SITE))  # parth_project/
EXPORTS = os.path.join(WORKSPACE, "_workspace", "spotify-exports")

# In the order the picker shows them. "self" is the site's owner: his pages say
# "I" and "my"; everyone else's use their name.
PEOPLE = {
    "parth": {"name": "Parth", "self": True, "raw": os.path.join(EXPORTS, "parth"), "suffix": ""},
    "aaron": {"name": "Aaron", "self": False, "raw": os.path.join(EXPORTS, "aaron"), "suffix": "-aaron"},
    "henry": {"name": "Henry", "self": False, "raw": os.path.join(EXPORTS, "henry"), "suffix": "-henry"},
}
OUT_PEOPLE = os.path.join(SITE, "music-people.js")

MELBOURNE = ZoneInfo("Australia/Melbourne")
# Countries with one time zone (Spotify's conn_country). Others use Melbourne.
ZONES = {c: ZoneInfo(z) for c, z in {
    "AU": "Australia/Melbourne", "IN": "Asia/Kolkata", "BW": "Africa/Gaborone",
    "ZA": "Africa/Johannesburg", "MZ": "Africa/Maputo", "KE": "Africa/Nairobi",
    "ET": "Africa/Addis_Ababa", "NG": "Africa/Lagos", "GB": "Europe/London",
    "NL": "Europe/Amsterdam", "DE": "Europe/Berlin", "FR": "Europe/Paris",
    "CH": "Europe/Zurich", "CZ": "Europe/Prague", "TR": "Europe/Istanbul",
    "AE": "Asia/Dubai", "QA": "Asia/Qatar", "SG": "Asia/Singapore",
    "MY": "Asia/Kuala_Lumpur", "TH": "Asia/Bangkok", "PH": "Asia/Manila",
    "JP": "Asia/Tokyo", "KR": "Asia/Seoul", "NZ": "Pacific/Auckland",
    "UY": "America/Montevideo",
}.items()}
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


def load(raw):
    files = sorted(glob.glob(os.path.join(raw, "Streaming_History_*.json")))
    if not files:
        sys.exit(f"No Streaming_History_*.json files in {raw}")
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
            "country": r.get("conn_country") or "",
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


def explorer(plays, years):
    """The Music Explorer's data (music-explorer-data.js): every artist and song
    with counted plays, plays per year for each song, and plays per month for
    each artist. Still no raw plays or exact times: dates are whole days."""
    counted = [p for p in plays if p["ms"] >= MIN_PLAY_MS]
    first, last = plays[0]["local"], plays[-1]["local"]
    months = []
    y, mo = first.year, first.month
    while (y, mo) <= (last.year, last.month):
        months.append(f"{y}-{mo:02d}")
        y, mo = (y + 1, 1) if mo == 12 else (y, mo + 1)
    month_index = {k: i for i, k in enumerate(months)}
    year_index = {yr: i for i, yr in enumerate(years)}

    artist_ms = collections.Counter()
    song_ms = collections.Counter()
    for p in plays:
        artist_ms[p["artist"]] += p["ms"]
        song_ms[(p["track"], p["artist"])] += p["ms"]

    artist_n = collections.Counter()
    artist_month = collections.defaultdict(collections.Counter)
    artist_days = {}
    song_years = collections.defaultdict(lambda: [0] * len(years))
    for p in counted:
        a, day = p["artist"], p["local"].date()
        artist_n[a] += 1
        artist_month[a][month_index[p["local"].strftime("%Y-%m")]] += 1
        lo, hi = artist_days.get(a, (day, day))
        artist_days[a] = (min(lo, day), max(hi, day))
        song_years[(p["track"], a)][year_index[p["local"].year]] += 1

    order = sorted(artist_n, key=lambda a: (-artist_ms[a], a))
    index = {a: i for i, a in enumerate(order)}
    artists = []
    for a in order:
        flat = []
        for i, n in sorted(artist_month[a].items()):
            flat += [i, n]
        artists.append([a, m(artist_ms[a]), artist_n[a], str(artist_days[a][0]), str(artist_days[a][1]), flat])
    songs = sorted(song_years, key=lambda k: (-sum(song_years[k]), k))
    return {
        "meta": {"from": first.date().isoformat(), "to": last.date().isoformat(),
                 "built": dt.date.today().isoformat(), "years": years, "months": months},
        # [name, minutes, plays, first day, last day, [month index, plays, ...]]
        "artists": artists,
        # [title, artist index, minutes, plays per year (same order as meta.years)]
        "songs": [[t, index[a], m(song_ms[(t, a)]), song_years[(t, a)]] for (t, a) in songs],
    }


def build(key):
    person = PEOPLE[key]
    plays, episodes = parse(load(person["raw"]))
    years = sorted({p["local"].year for p in plays})
    who = {"person": key, "name": person["name"], "self": person["self"]}
    data = {
        "meta": dict(who, **{
            "from": plays[0]["local"].date().isoformat(),
            "to": plays[-1]["local"].date().isoformat(),
            "built": dt.date.today().isoformat(),
            "years": years,
            # Share of play time outside Australia and India: the page says
            # "local time" instead of "Melbourne time" when it's more than a little.
            "abroad": round(100 * sum(p["ms"] for p in plays if p["country"] not in ("AU", "IN"))
                            / max(1, sum(p["ms"] for p in plays)), 1),
        }),
        "views": {"all": view(plays, daily=False)},
        "allTime": all_time(plays, episodes, years),
    }
    for yr in years:
        data["views"][str(yr)] = view([p for p in plays if p["local"].year == yr])

    whose = person["name"] + "'s"
    out = os.path.join(SITE, f"music-data{person['suffix']}.js")
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"// Made by tools/build_music_data.py from {whose} Spotify export. Don't edit by hand.\n")
        fh.write("// Totals and top lists only: no raw plays, IP addresses, countries or devices' details.\n")
        fh.write("const MUSIC = " + body + ";\n")
    st = data["views"]["all"]["stats"]
    print(f"{person['name']}: wrote {os.path.basename(out)} ({len(body) // 1024} KB): {st['hours']} h, "
          f"{st['plays']} plays, {st['artists']} artists, {st['songs']} songs, "
          f"{data['meta']['from']} to {data['meta']['to']}, {data['meta']['abroad']}% abroad")

    x = explorer(plays, years)
    x["meta"].update(who)
    out = os.path.join(SITE, f"music-explorer-data{person['suffix']}.js")
    body = json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"// Made by tools/build_music_data.py from {whose} Spotify export. Don't edit by hand.\n")
        fh.write("// For music-explorer.html: every artist and song with play counts per year / month.\n")
        fh.write("// No raw plays, exact times, IP addresses, countries or devices.\n")
        fh.write("const MUSIC_X = " + body + ";\n")
    print(f"{person['name']}: wrote {os.path.basename(out)} ({len(body) // 1024} KB): "
          f"{len(x['artists'])} artists, {len(x['songs'])} songs")


def write_people():
    """music-people.js, from the data files that exist (built now or before)."""
    people = []
    for key, person in PEOPLE.items():
        data_file = f"music-data{person['suffix']}.js"
        path = os.path.join(SITE, data_file)
        if not os.path.exists(path):
            print(f"{person['name']}: no {data_file} yet, left off the picker")
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        start = text.index("const MUSIC = ") + len("const MUSIC = ")
        data = json.loads(text[start:].rstrip().rstrip(";"))
        st = data["views"]["all"]["stats"]
        top = data["views"]["all"]["artists"]
        people.append({
            "key": key,
            "name": person["name"],
            "self": person["self"],
            "data": data_file,
            "explorer": f"music-explorer-data{person['suffix']}.js",
            "from": data["meta"]["from"],
            "to": data["meta"]["to"],
            "years": len(data["meta"]["years"]),
            "hours": st["hours"],
            "plays": st["plays"],
            "artists": st["artists"],
            "topArtist": top[0][0] if top else None,
        })
    body = json.dumps(people, ensure_ascii=False, indent=1)
    with open(OUT_PEOPLE, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("// Made by tools/build_music_data.py. Don't edit by hand.\n")
        fh.write("// Whose Spotify history the Music pages have: their data files and a few totals.\n")
        fh.write("const MUSIC_PEOPLE = " + body + ";\n")
    print(f"Wrote music-people.js: {', '.join(p['name'] for p in people)}")


def main():
    keys = sys.argv[1:] or list(PEOPLE)
    for key in keys:
        if key not in PEOPLE:
            sys.exit(f"Unknown person {key!r}. Known: {', '.join(PEOPLE)}")
    for key in keys:
        build(key)
    write_people()


if __name__ == "__main__":
    main()
