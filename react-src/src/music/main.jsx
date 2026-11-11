// Music Explorer (music-explorer.html): pick a year, click an artist or song to
// dig in, compare two years, search everything played since 2017.
// Data: MUSIC_X (music-explorer-data.js) for every artist and song, MUSIC
// (music-data.js) for the yearly totals. Both are made by tools/build_music_data.py.
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { fmt, plural, fold, niceDate, readHash, writeHash } from "../shared/util.js";

/* global MUSIC_X, MUSIC */
const X = typeof MUSIC_X !== "undefined" ? MUSIC_X : null;
const M = typeof MUSIC !== "undefined" ? MUSIC : null;

// ---------- Data, prepared once ----------
function prepare(x) {
  const years = x.meta.years;
  const months = x.meta.months;
  const monthYear = months.map((k) => years.indexOf(Number(k.slice(0, 4))));
  const artists = x.artists.map(([name, min, plays, first, last, flat], i) => {
    const perYear = years.map(() => 0);
    const perMonth = months.map(() => 0);
    for (let k = 0; k < flat.length; k += 2) {
      perMonth[flat[k]] = flat[k + 1];
      perYear[monthYear[flat[k]]] += flat[k + 1];
    }
    return { kind: "artist", i, name, min, plays, first, last, perYear, perMonth, songs: [], key: fold(name) };
  });
  const songs = x.songs.map(([title, a, min, perYear], j) => {
    const song = { kind: "song", j, title, artist: artists[a], min, perYear, plays: perYear.reduce((s, n) => s + n, 0), key: fold(title) };
    artists[a].songs.push(song);
    return song;
  });
  songs.forEach((s, rank) => (s.rank = rank + 1)); // already sorted by plays
  return { years, months, monthYear, artists, songs };
}

const D = X ? prepare(X) : null;

const playsIn = (thing, y) => (y === null ? thing.plays : thing.perYear[y]);

function ranked(list, y, n) {
  const out = list.filter((t) => playsIn(t, y) > 0);
  out.sort((a, b) => playsIn(b, y) - playsIn(a, y));
  return n ? out.slice(0, n) : out;
}

const hours = (min) => (min / 60 >= 10 ? fmt(Math.round(min / 60)) : (min / 60).toFixed(1));

// ---------- Small pieces ----------
function Bar({ value, max }) {
  return (
    <span className="rx-bar" aria-hidden="true">
      <span style={{ width: `${Math.max(2, (100 * value) / Math.max(1, max))}%` }} />
    </span>
  );
}

function ArtistRow({ artist, y, max, rank, onPick, active, note }) {
  const n = playsIn(artist, y);
  return (
    <li>
      <button type="button" className={"rx-row" + (active ? " is-active" : "")} onClick={() => onPick(artist)} aria-pressed={active}>
        <span className="rx-rank">{rank}</span>
        <span className="rx-row-main">
          <span className="rx-row-title" translate="no">{artist.name}</span>
          <Bar value={n} max={max} />
        </span>
        {note ? <span className={"rx-move " + note.cls}>{note.text}</span> : null}
        <span className="rx-row-num">{plural(n, "play")}</span>
      </button>
    </li>
  );
}

function SongRow({ song, y, max, rank, onPick, active, note, showArtist = true }) {
  const n = playsIn(song, y);
  return (
    <li>
      <button type="button" className={"rx-row" + (active ? " is-active" : "")} onClick={() => onPick(song)} aria-pressed={active}>
        <span className="rx-rank">{rank}</span>
        <span className="rx-row-main">
          <span className="rx-row-title" translate="no">{song.title}</span>
          {showArtist ? <span className="rx-row-sub" translate="no">{song.artist.name}</span> : null}
          <Bar value={n} max={max} />
        </span>
        {note ? <span className={"rx-move " + note.cls}>{note.text}</span> : null}
        <span className="rx-row-num">{plural(n, "play")}</span>
      </button>
    </li>
  );
}

function YearPills({ year, setYear, label = "Pick a year" }) {
  return (
    <div className="rx-pills" role="group" aria-label={label}>
      <button type="button" aria-pressed={year === null} onClick={() => setYear(null)}>All time</button>
      {D.years.map((yr, k) => (
        <button type="button" key={yr} aria-pressed={year === k} onClick={() => setYear(k)}>{String(yr)}</button>
      ))}
    </div>
  );
}

// ---------- Explore: top lists ----------
function TopLists({ y, selected, pick }) {
  const artists = useMemo(() => ranked(D.artists, y, 25), [y]);
  const songs = useMemo(() => ranked(D.songs, y, 25), [y]);
  const scope = y === null ? "of all time" : `in ${D.years[y]}`;
  return (
    <div className="rx-two">
      <section className="rx-card">
        <h2>{`Top artists ${scope}`}</h2>
        <ol className="rx-list">
          {artists.map((a, k) => (
            <ArtistRow key={a.i} artist={a} y={y} max={playsIn(artists[0], y)} rank={k + 1} onPick={pick} active={selected === a} />
          ))}
        </ol>
      </section>
      <section className="rx-card">
        <h2>{`Top songs ${scope}`}</h2>
        <ol className="rx-list">
          {songs.map((s, k) => (
            <SongRow key={s.j} song={s} y={y} max={playsIn(songs[0], y)} rank={k + 1} onPick={pick} active={selected === s} />
          ))}
        </ol>
      </section>
    </div>
  );
}

// ---------- Explore: search ----------
function Search({ query, y, selected, pick }) {
  const q = fold(query.trim());
  const { artists, songs } = useMemo(() => {
    const a = D.artists.filter((t) => t.key.includes(q));
    const s = D.songs.filter((t) => t.key.includes(q) || t.artist.key.includes(q));
    const order = (list) => list.sort((p, r) => playsIn(r, y) - playsIn(p, y) || r.plays - p.plays);
    return { artists: order(a).slice(0, 8), songs: order(s).slice(0, 40) };
  }, [q, y]);
  if (!artists.length && !songs.length) {
    return <section className="rx-card"><p className="rx-empty">{`Nothing matches “${query.trim()}”.`}</p></section>;
  }
  const maxA = Math.max(1, ...artists.map((t) => playsIn(t, y)));
  const maxS = Math.max(1, ...songs.map((t) => playsIn(t, y)));
  return (
    <div className="rx-stack">
      {artists.length ? (
        <section className="rx-card">
          <h2>Artists</h2>
          <ol className="rx-list">
            {artists.map((a, k) => <ArtistRow key={a.i} artist={a} y={y} max={maxA} rank={k + 1} onPick={pick} active={selected === a} />)}
          </ol>
        </section>
      ) : null}
      {songs.length ? (
        <section className="rx-card">
          <h2>Songs</h2>
          <ol className="rx-list">
            {songs.map((s, k) => <SongRow key={s.j} song={s} y={y} max={maxS} rank={k + 1} onPick={pick} active={selected === s} />)}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

// ---------- Explore: the detail panel ----------
function Timeline({ artist, y }) {
  const W = 8, H = 90, GAP = 2;
  const max = Math.max(1, ...artist.perMonth);
  const width = D.months.length * W;
  return (
    <figure className="rx-timeline">
      <svg viewBox={`0 0 ${width} ${H + 16}`} preserveAspectRatio="none" role="img" aria-label="Plays per month">
        {artist.perMonth.map((n, k) => {
          const h = n ? Math.max(2, (H * n) / max) : 0;
          const on = y === null || D.monthYear[k] === y;
          return (
            <rect key={k} x={k * W + GAP / 2} y={H - h} width={W - GAP} height={h} rx="1.5" className={on ? "on" : "off"}>
              <title>{`${niceDate(D.months[k])}: ${plural(n, "play")}`}</title>
            </rect>
          );
        })}
        {D.months.map((k, i) => (k.endsWith("-01") || i === 0 ? <line key={k} x1={i * W} x2={i * W} y1="0" y2={H} className="rx-tick" /> : null))}
      </svg>
      <div className="rx-timeline-years" aria-hidden="true">
        {D.years.map((yr, k) => {
          const first = D.monthYear.indexOf(k);
          const count = D.monthYear.filter((v) => v === k).length;
          return <span key={yr} style={{ width: `${(100 * count) / D.months.length}%` }} className={y === k ? "is-on" : ""}>{count >= 4 ? String(yr) : ""}</span>;
        })}
      </div>
      <figcaption>Plays each month. Point at a bar for the number.</figcaption>
    </figure>
  );
}

function YearBars({ song, y }) {
  const max = Math.max(1, ...song.perYear);
  return (
    <div className="rx-yearbars" role="img" aria-label="Plays each year">
      {D.years.map((yr, k) => (
        <div key={yr} className={"rx-yearbar" + (y === k ? " is-on" : "")} title={`${yr}: ${plural(song.perYear[k], "play")}`}>
          <span className="rx-yearbar-n">{song.perYear[k] ? fmt(song.perYear[k]) : ""}</span>
          <span className="rx-yearbar-col"><span style={{ height: `${(100 * song.perYear[k]) / max}%` }} /></span>
          <span className="rx-yearbar-label">{`’${String(yr).slice(2)}`}</span>
        </div>
      ))}
    </div>
  );
}

function ArtistDetail({ artist, y, pick }) {
  const songs = ranked(artist.songs, y, 15);
  const active = artist.perYear.filter(Boolean).length;
  return (
    <>
      <span className="rx-eyebrow">Artist</span>
      <h2 className="rx-detail-title" translate="no">{artist.name}</h2>
      <ul className="rx-chips">
        <li>{plural(artist.plays, "play")}</li>
        <li>{`${hours(artist.min)} hours`}</li>
        <li>{plural(active, "year")}</li>
        {y !== null ? <li className="is-accent">{`${plural(artist.perYear[y], "play")} in ${D.years[y]}`}</li> : null}
      </ul>
      <p className="rx-dates">{`First played ${niceDate(artist.first)} · last played ${niceDate(artist.last)}`}</p>
      <Timeline artist={artist} y={y} />
      <h3>{y === null ? "Top songs" : `Top songs in ${D.years[y]}`}</h3>
      {songs.length ? (
        <ol className="rx-list">
          {songs.map((s, k) => <SongRow key={s.j} song={s} y={y} max={playsIn(songs[0], y)} rank={k + 1} onPick={pick} showArtist={false} />)}
        </ol>
      ) : (
        <p className="rx-empty">{`No plays in ${D.years[y]}.`}</p>
      )}
    </>
  );
}

function SongDetail({ song, y, pick }) {
  return (
    <>
      <span className="rx-eyebrow">Song</span>
      <h2 className="rx-detail-title" translate="no">{song.title}</h2>
      <p className="rx-by">
        <span>by </span>
        <button type="button" className="rx-link" onClick={() => pick(song.artist)} translate="no">{song.artist.name}</button>
      </p>
      <ul className="rx-chips">
        <li>{plural(song.plays, "play")}</li>
        <li>{`${fmt(song.min)} minutes`}</li>
        <li>{`#${fmt(song.rank)} of ${fmt(D.songs.length)} songs`}</li>
      </ul>
      <h3>Plays each year</h3>
      <YearBars song={song} y={y} />
    </>
  );
}

function Detail({ selected, y, pick, close }) {
  if (!selected) {
    return (
      <aside className="rx-card rx-detail rx-detail-empty">
        <p>Pick an artist or song to see when I played it.</p>
      </aside>
    );
  }
  return (
    <aside className="rx-card rx-detail" aria-live="polite">
      <button type="button" className="rx-close" onClick={close} aria-label="Close">×</button>
      {selected.kind === "artist" ? <ArtistDetail artist={selected} y={y} pick={pick} /> : <SongDetail song={selected} y={y} pick={pick} />}
    </aside>
  );
}

// ---------- Compare ----------
function rankMap(list, y) {
  const map = new Map();
  ranked(list, y).forEach((t, k) => map.set(t, k + 1));
  return map;
}

function move(thing, rank, other, otherYear) {
  if (playsIn(thing, otherYear) === 0) return { cls: "is-new", text: "new" };
  const was = other.get(thing);
  if (was === rank) return { cls: "is-same", text: "=" };
  return was > rank ? { cls: "is-up", text: `▲${was - rank}` } : { cls: "is-down", text: `▼${rank - was}` };
}

function Stat({ label, a, b, unit = "" }) {
  const change = a ? Math.round((100 * (b - a)) / a) : null;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{fmt(a) + unit}</td>
      <td>{fmt(b) + unit}</td>
      <td className={change > 0 ? "is-up" : change < 0 ? "is-down" : ""}>{change === null ? "" : `${change > 0 ? "+" : ""}${change}%`}</td>
    </tr>
  );
}

function YearSelect({ value, onChange, label }) {
  return (
    <label className="rx-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {D.years.map((yr, k) => <option key={yr} value={k}>{String(yr)}</option>)}
      </select>
    </label>
  );
}

function Compare({ a, b, setA, setB, open }) {
  const ya = D.years[a], yb = D.years[b];
  const data = useMemo(() => {
    // "To" shows how each one moved since "From"; "From" only marks what vanished.
    const side = (y, other, arrows) => {
      const artistRanks = rankMap(D.artists, other);
      const songRanks = rankMap(D.songs, other);
      const note = (t, k, ranks) =>
        arrows ? move(t, k + 1, ranks, other) : playsIn(t, other) === 0 ? { cls: "is-gone", text: "gone" } : null;
      return {
        artists: ranked(D.artists, y, 10).map((t, k) => ({ t, note: note(t, k, artistRanks) })),
        songs: ranked(D.songs, y, 10).map((t, k) => ({ t, note: note(t, k, songRanks) })),
      };
    };
    const yearOf = (iso) => Number(iso.slice(0, 4));
    const discovered = ranked(D.artists, b).filter((t) => yearOf(t.first) === yb).slice(0, 8);
    const faded = ranked(D.artists, a, 25).filter((t) => playsIn(t, b) === 0).slice(0, 8);
    return { A: side(a, b, false), B: side(b, a, true), discovered, faded };
  }, [a, b, yb]);
  const sa = M && M.views[ya] ? M.views[ya].stats : null;
  const sb = M && M.views[yb] ? M.views[yb].stats : null;
  const partial = (yr) => yr === D.years[D.years.length - 1] || yr === D.years[0];

  const column = (side, y, yr) => (
    <section className="rx-card">
      <h2>{String(yr)}</h2>
      <h3>Top artists</h3>
      <ol className="rx-list">
        {side.artists.map(({ t, note }, k) => <ArtistRow key={t.i} artist={t} y={y} max={playsIn(side.artists[0].t, y)} rank={k + 1} note={note} onPick={() => open(t, y)} />)}
      </ol>
      <h3>Top songs</h3>
      <ol className="rx-list">
        {side.songs.map(({ t, note }, k) => <SongRow key={t.j} song={t} y={y} max={playsIn(side.songs[0].t, y)} rank={k + 1} note={note} onPick={() => open(t, y)} />)}
      </ol>
    </section>
  );

  return (
    <div className="rx-stack">
      <section className="rx-card rx-compare-head">
        <div className="rx-compare-pick">
          <YearSelect value={a} onChange={setA} label="From" />
          <button type="button" className="rx-swap" onClick={() => { setA(b); setB(a); }} aria-label="Swap the years" title="Swap the years">⇄</button>
          <YearSelect value={b} onChange={setB} label="To" />
        </div>
        {sa && sb ? (
          <table className="rx-table">
            <thead>
              <tr><th scope="col"><span className="rx-sr">Measure</span></th><th scope="col">{String(ya)}</th><th scope="col">{String(yb)}</th><th scope="col">Change</th></tr>
            </thead>
            <tbody>
              <Stat label="Hours listened" a={Math.round(sa.hours)} b={Math.round(sb.hours)} />
              <Stat label="Plays" a={sa.plays} b={sb.plays} />
              <Stat label="Artists" a={sa.artists} b={sb.artists} />
              <Stat label="Songs" a={sa.songs} b={sb.songs} />
              <Stat label="Minutes a day" a={sa.minPerDay} b={sb.minPerDay} />
            </tbody>
          </table>
        ) : null}
        {partial(ya) || partial(yb) ? <p className="rx-note">My Spotify history starts in late 2017 and ends in September 2026, so those two years are only part of a year.</p> : null}
        <p className="rx-note">{`The arrows show how many places each one moved from ${ya} to ${yb}. “new” wasn't played at all in ${ya}; “gone” wasn't played at all in ${yb}.`}</p>
      </section>
      <div className="rx-two">
        {column(data.A, a, ya)}
        {column(data.B, b, yb)}
      </div>
      <div className="rx-two">
        <section className="rx-card">
          <h2>{`First heard in ${yb}`}</h2>
          {data.discovered.length ? (
            <ol className="rx-list">
              {data.discovered.map((t, k) => <ArtistRow key={t.i} artist={t} y={b} max={playsIn(data.discovered[0], b)} rank={k + 1} onPick={() => open(t, b)} />)}
            </ol>
          ) : <p className="rx-empty">No new artists that year.</p>}
        </section>
        <section className="rx-card">
          <h2>{`Big in ${ya}, gone in ${yb}`}</h2>
          {data.faded.length ? (
            <ol className="rx-list">
              {data.faded.map((t, k) => <ArtistRow key={t.i} artist={t} y={a} max={playsIn(data.faded[0], a)} rank={k + 1} onPick={() => open(t, a)} />)}
            </ol>
          ) : <p className="rx-empty">{`Every big artist from ${ya} was still played in ${yb}.`}</p>}
        </section>
      </div>
    </div>
  );
}

// ---------- The page ----------
function fromHash() {
  const h = readHash();
  const yearIndex = (v) => {
    const k = D.years.indexOf(Number(v));
    return k === -1 ? null : k;
  };
  let selected = null;
  if (h.artist) selected = D.artists.find((t) => t.name === h.artist) || null;
  if (h.song) {
    const s = D.songs[Number(h.song)];
    if (s && fold(s.title) === fold(h.title || s.title)) selected = s;
  }
  const n = D.years.length;
  return {
    mode: h.view === "compare" ? "compare" : "explore",
    year: yearIndex(h.year),
    selected,
    a: yearIndex(h.a) ?? Math.max(0, n - 3),
    b: yearIndex(h.b) ?? Math.max(0, n - 2),
  };
}

function App() {
  const start = useMemo(fromHash, []);
  const [mode, setMode] = useState(start.mode);
  const [year, setYear] = useState(start.year);
  const [selected, setSelected] = useState(start.selected);
  const [query, setQuery] = useState("");
  const [a, setA] = useState(start.a);
  const [b, setB] = useState(start.b);

  useEffect(() => {
    writeHash(mode === "compare"
      ? { view: "compare", a: D.years[a], b: D.years[b] }
      : {
          year: year === null ? null : D.years[year],
          artist: selected && selected.kind === "artist" ? selected.name : null,
          song: selected && selected.kind === "song" ? selected.j : null,
          title: selected && selected.kind === "song" ? selected.title : null,
        });
  }, [mode, year, selected, a, b]);

  const pick = (thing) => {
    setSelected(thing);
    // On a phone the panel sits above the lists: bring it into view.
    if (window.matchMedia("(max-width: 900px)").matches) {
      requestAnimationFrame(() => document.getElementById("rx-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };
  const openFromCompare = (thing, y) => {
    setMode("explore");
    setYear(y);
    setQuery("");
    pick(thing);
  };

  return (
    <>
      <section className="rx-hero">
        <span className="rx-eyebrow">Spotify listening history</span>
        <h1>Music Explorer</h1>
        <p className="rx-lead">Dig into everything I've played since 2017: pick a year, click an artist or a song, or compare two years.</p>
        <p className="rx-meta">{`${fmt(D.artists.length)} artists · ${fmt(D.songs.length)} songs · ${niceDate(X.meta.from)} to ${niceDate(X.meta.to)}`}</p>
      </section>

      <div className="rx-tabs" role="tablist" aria-label="View">
        <button type="button" role="tab" aria-selected={mode === "explore"} onClick={() => setMode("explore")}>Explore</button>
        <button type="button" role="tab" aria-selected={mode === "compare"} onClick={() => setMode("compare")}>Compare years</button>
      </div>

      {mode === "explore" ? (
        <>
          <div className="rx-toolbar">
            <YearPills year={year} setYear={setYear} />
            <label className="rx-search">
              <span className="rx-sr">Search songs and artists</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any song or artist" autoComplete="off" />
            </label>
          </div>
          <div className="rx-layout">
            <div id="rx-detail" className="rx-side">
              <Detail selected={selected} y={year} pick={pick} close={() => setSelected(null)} />
            </div>
            <div className="rx-main">
              {query.trim().length >= 2 ? <Search query={query} y={year} selected={selected} pick={pick} /> : <TopLists y={year} selected={selected} pick={pick} />}
            </div>
          </div>
        </>
      ) : (
        <Compare a={a} b={b} setA={setA} setB={setB} open={openFromCompare} />
      )}

      <p className="rx-footnote">A play counts once a song has played for 30 seconds, the same rule Spotify uses. Rankings here are by plays.</p>
    </>
  );
}

const root = document.getElementById("rx-root");
if (!D) {
  root.innerHTML = '<p class="rx-empty">The listening data didn\'t load. Try refreshing the page.</p>';
} else {
  createRoot(root).render(<App />);
}
