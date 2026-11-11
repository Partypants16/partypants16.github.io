// Movie Tracker (movie-tracker.html): tick off what you've watched in each
// franchise and recommendation list, see your progress, and get the next film
// in watch order.
// Data: FRANCHISES (franchise-data.js, from the spreadsheet) and MOVIE_LISTS
// (movie-lists.js). The spreadsheet's marks are the starting point; ticks made
// here are saved in this browser only (localStorage) and can be reset.
import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { fmt, fold, useStored } from "../shared/util.js";

/* global FRANCHISES, MOVIE_LISTS */
const F = typeof FRANCHISES !== "undefined" ? FRANCHISES : {};
const L = typeof MOVIE_LISTS !== "undefined" ? MOVIE_LISTS : {};

const ME = "__me";
const WATCHED = new Set(["watched", "rewatched"]);
const LABELS = { rewatched: "Rewatched", watched: "Watched", never: "Not watched", wont: "Won't watch", notout: "Not out yet" };

// ---------- Data, prepared once ----------
function prepare() {
  const collections = [];
  let order = 0;
  for (const [key, f] of Object.entries(F)) {
    collections.push({
      key: "f-" + key,
      name: f.name,
      kind: "franchise",
      link: "franchise.html?f=" + encodeURIComponent(key),
      sections: f.sections.map((s) => ({
        name: s.name,
        items: s.titles.map((t) => ({
          id: `f:${key}:${s.name}:${t.title}`,
          title: t.title,
          section: s.name,
          order: order++,
          status: t.status || {},
          thoughts: t.thoughts || {},
          notout: Object.values(t.status || {}).includes("notout"),
          key: fold(t.title),
        })),
      })),
    });
  }
  for (const [key, list] of Object.entries(L)) {
    collections.push({
      key: "l-" + key,
      name: list.name,
      kind: "list",
      link: "movie-list.html?for=" + encodeURIComponent(key),
      sections: [{
        name: null,
        items: list.movies.map((m) => ({
          id: `l:${key}:${m.title}`,
          title: m.title,
          section: null,
          order: order++,
          rating: m.rating || null,
          score: parseFloat(m.rating) || 0,
          comment: m.comment || null,
          status: {},
          thoughts: {},
          notout: false,
          key: fold(m.title),
        })),
      }],
    });
  }
  const people = [];
  for (const f of Object.values(F)) for (const p of f.people) if (!people.includes(p)) people.push(p);
  return { collections, people };
}

const D = prepare();

// Where one title stands for one person: the tick made here wins, else the spreadsheet.
function state(item, who, ticks) {
  const base = who === ME ? undefined : item.status[who];
  const tick = ticks[who] ? ticks[who][item.id] : undefined;
  const fromSheet = WATCHED.has(base);
  const watched = tick === undefined ? fromSheet : tick;
  return {
    base,
    watched,
    changed: tick !== undefined && tick !== fromSheet,
    counts: !item.notout && (watched || base !== "wont"),
  };
}

function progress(items, who, ticks) {
  let done = 0, total = 0;
  for (const item of items) {
    const s = state(item, who, ticks);
    if (!s.counts) continue;
    total++;
    if (s.watched) done++;
  }
  return { done, total };
}

// ---------- Pieces ----------
function Progress({ done, total, big }) {
  const pct = total ? Math.round((100 * done) / total) : 0;
  return (
    <div className={"mt-progress" + (big ? " is-big" : "")}>
      <div className="mt-progress-text">
        <span>{`${fmt(done)} of ${fmt(total)} watched`}</span>
        <span>{`${pct}%`}</span>
      </div>
      <div className="mt-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done} aria-label="Watched">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Item({ item, s, onToggle, showSection, isNext }) {
  const thoughts = Object.entries(item.thoughts);
  const badge = item.notout ? "notout" : !s.watched && s.base === "wont" ? "wont" : s.watched && s.base === "rewatched" && !s.changed ? "rewatched" : null;
  return (
    <li className={"mt-item" + (s.watched ? " is-watched" : "") + (item.notout ? " is-notout" : "") + (isNext ? " is-next" : "")}>
      <label className="mt-check">
        <input type="checkbox" checked={s.watched} disabled={item.notout} onChange={() => onToggle(item, !s.watched)} />
        <span className="mt-title" translate="no">{item.title}</span>
      </label>
      <span className="mt-tags">
        {isNext ? <span className="mt-tag is-next">Next up</span> : null}
        {badge ? <span className={"mt-tag st-" + badge}>{LABELS[badge]}</span> : null}
        {s.changed ? <span className="mt-tag is-changed" title="You changed this here. It's saved in this browser only.">Changed here</span> : null}
        {item.rating ? <span className="mt-tag is-rating">{item.rating}</span> : null}
      </span>
      {showSection && item.section ? <span className="mt-section-name" translate="no">{item.section}</span> : null}
      {item.comment ? <p className="mt-comment" translate="no">{item.comment}</p> : null}
      {thoughts.length ? (
        <details className="mt-thoughts">
          <summary>{thoughts.length === 1 ? "1 thought" : `${thoughts.length} thoughts`}</summary>
          <ul>
            {thoughts.map(([person, text]) => (
              <li key={person}><b translate="no">{person}</b> <span translate="no">{text}</span></li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

// ---------- The page ----------
const SORTS = {
  order: "Watch order",
  title: "Title A to Z",
  todo: "Not watched first",
  rating: "Highest rated",
};

function App() {
  const [saved, setSaved] = useStored("movie-tracker", { who: D.people.includes("Parth") ? "Parth" : ME, tab: null, ticks: {} });
  const who = saved.who === ME || D.people.includes(saved.who) ? saved.who : ME;
  const ticks = saved.ticks || {};
  const collection = D.collections.find((c) => c.key === saved.tab) || D.collections[0];
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("order");
  const [show, setShow] = useState("all");

  const update = (change) => setSaved((old) => ({ ...old, ...change }));
  const toggle = (item, value) =>
    setSaved((old) => {
      const mine = { ...((old.ticks || {})[who] || {}) };
      const fromSheet = who !== ME && WATCHED.has(item.status[who]);
      if (value === fromSheet) delete mine[item.id];
      else mine[item.id] = value;
      return { ...old, ticks: { ...(old.ticks || {}), [who]: mine } };
    });
  const changedCount = Object.keys(ticks[who] || {}).length;
  const reset = () => {
    if (window.confirm("Undo every tick you made here for this person, and go back to the spreadsheet's marks?")) {
      setSaved((old) => {
        const next = { ...(old.ticks || {}) };
        delete next[who];
        return { ...old, ticks: next };
      });
    }
  };

  const items = useMemo(() => collection.sections.flatMap((s) => s.items), [collection]);
  const all = progress(items, who, ticks);
  const next = items.find((item) => {
    const s = state(item, who, ticks);
    return s.counts && !s.watched;
  });

  const q = fold(query.trim());
  const visible = (item) => {
    if (q && !item.key.includes(q)) return false;
    const s = state(item, who, ticks);
    if (show === "todo") return s.counts && !s.watched;
    if (show === "watched") return s.watched;
    return true;
  };
  const sorted = (list) => {
    const out = list.filter(visible);
    if (sort === "title") out.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "todo") out.sort((a, b) => Number(state(a, who, ticks).watched) - Number(state(b, who, ticks).watched) || a.order - b.order);
    if (sort === "rating") out.sort((a, b) => b.score - a.score || a.order - b.order);
    return out;
  };
  const grouped = sort === "order";
  const sortKeys = Object.keys(SORTS).filter((k) => k !== "rating" || collection.kind === "list");
  const activeSort = sortKeys.includes(sort) ? sort : "order";
  const flat = grouped ? null : sorted(items);
  const shownCount = grouped ? items.filter(visible).length : flat.length;

  return (
    <>
      <section className="rx-hero">
        <span className="rx-eyebrow">Franchises and recommendation lists</span>
        <h1>Movie Tracker</h1>
        <p className="rx-lead">Tick off what you've watched, see how far through each series you are, and find the next film in watch order.</p>
      </section>

      <div className="rx-card mt-controls">
        <label className="rx-select">
          <span>Tracking for</span>
          <select value={who} onChange={(e) => update({ who: e.target.value })}>
            {D.people.map((p) => <option key={p} value={p} translate="no">{p}</option>)}
            <option value={ME}>Me (start from nothing)</option>
          </select>
        </label>
        <p className="rx-note">
          {who === ME
            ? "Everything starts unticked. Your ticks are saved in this browser only."
            : "Starts from the marks in our shared spreadsheet. Ticks you change here are saved in this browser only."}
        </p>
        {changedCount ? <button type="button" className="rx-button" onClick={reset}>{`Undo my ${changedCount === 1 ? "1 change" : changedCount + " changes"}`}</button> : null}
      </div>

      <div className="rx-tabs" role="tablist" aria-label="Franchise or list">
        {D.collections.map((c) => {
          const p = progress(c.sections.flatMap((s) => s.items), who, ticks);
          return (
            <button key={c.key} type="button" role="tab" aria-selected={c === collection} onClick={() => { update({ tab: c.key }); setQuery(""); }}>
              <span translate="no">{c.name}</span>
              <small>{`${p.done}/${p.total}`}</small>
            </button>
          );
        })}
      </div>

      <div className="mt-top">
        <section className="rx-card">
          <span className="rx-eyebrow">{collection.kind === "franchise" ? "Franchise" : "Recommendation list"}</span>
          <h2 className="rx-detail-title" translate="no">{collection.name}</h2>
          <Progress done={all.done} total={all.total} big />
          {collection.sections.length > 1 ? (
            <ul className="mt-section-bars">
              {collection.sections.map((s) => {
                const p = progress(s.items, who, ticks);
                return (
                  <li key={s.name}>
                    <span translate="no">{s.name}</span>
                    <Progress done={p.done} total={p.total} />
                  </li>
                );
              })}
            </ul>
          ) : null}
          <a className="rx-link" href={collection.link}>{collection.kind === "franchise" ? "See everyone's marks" : "Open the full list"}</a>
        </section>
        <section className="rx-card mt-next">
          <span className="rx-eyebrow">Next up</span>
          {next ? (
            <>
              <h2 className="rx-detail-title" translate="no">{next.title}</h2>
              {next.section ? <p className="mt-section-name" translate="no">{next.section}</p> : null}
              {next.comment ? <p className="mt-comment" translate="no">{next.comment}</p> : null}
              <button type="button" className="rx-button is-primary" onClick={() => toggle(next, true)}>Mark as watched</button>
            </>
          ) : (
            <>
              <h2 className="rx-detail-title">All caught up</h2>
              <p className="rx-note">Everything that's out has been watched.</p>
            </>
          )}
        </section>
      </div>

      <div className="rx-toolbar mt-toolbar">
        <label className="rx-search">
          <span className="rx-sr">Search titles</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles" autoComplete="off" />
        </label>
        <div className="rx-pills" role="group" aria-label="Show">
          {[["all", "All"], ["todo", "To watch"], ["watched", "Watched"]].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
        <label className="rx-select">
          <span>Sort</span>
          <select value={activeSort} onChange={(e) => setSort(e.target.value)}>
            {sortKeys.map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
          </select>
        </label>
      </div>

      {shownCount === 0 ? <section className="rx-card"><p className="rx-empty">Nothing matches.</p></section> : null}

      {grouped ? (
        collection.sections.map((s) => {
          const list = s.items.filter(visible);
          if (!list.length) return null;
          const p = progress(s.items, who, ticks);
          return (
            <section className="rx-card mt-group" key={s.name || "all"}>
              {s.name ? (
                <div className="mt-group-head">
                  <h3 translate="no">{s.name}</h3>
                  <span className="rx-meta">{`${p.done} of ${p.total}`}</span>
                </div>
              ) : null}
              <ol className="mt-items">
                {list.map((item) => <Item key={item.id} item={item} s={state(item, who, ticks)} onToggle={toggle} isNext={item === next} />)}
              </ol>
            </section>
          );
        })
      ) : flat.length ? (
        <section className="rx-card mt-group">
          <ol className="mt-items">
            {flat.map((item) => <Item key={item.id} item={item} s={state(item, who, ticks)} onToggle={toggle} showSection isNext={item === next} />)}
          </ol>
        </section>
      ) : null}
    </>
  );
}

const root = document.getElementById("rx-root");
if (!D.collections.length) {
  root.innerHTML = '<p class="rx-empty">The movie lists didn\'t load. Try refreshing the page.</p>';
} else {
  createRoot(root).render(<App />);
}
