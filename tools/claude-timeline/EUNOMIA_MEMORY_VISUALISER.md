# Eunomia Memory visualiser

Created 2026-11-01 by Codex as a proposal. Cleaned up and **v1 built by Claude the same day**,
after checking what Eunomia actually holds. Kept at the workspace root until Parth was done with
it, then moved here (2026-11-01), next to the code that builds the page.

## What exists now (v1, 2026-11-01)

A third card on the private Memory page, **Eunomia · Shared knowledge**, opens
`http://192.168.212.60:8120/eunomia.html` (public gateway: `eunomia.html` on the website, LAN only
like the other Memory pages). It lists every memory from the project vaults with:

- totals and **Last refreshed** at the top, with a warning once the snapshot is over 7 days old;
- search, plus filters for project (vault), saved by (Claude / Codex / Imported), status and kind
  (Fact / Session note / Observation), and a "Show historical facts" toggle (off by default);
- facts grouped by project, then by subject (the entity each memory is about);
- a Details panel per fact: source (session logs link to their timeline card; other paths are
  plain text), seen date, who saved it, status, kind, subject, project, written / last changed,
  version and id.

How to refresh, and how it works: `apps/my-website/tools/claude-timeline/README.md` ("The Eunomia
page") and `_workspace/eunomia/OPERATIONS.md`. In short: run
`python _workspace/eunomia/scripts/eunomia.py snapshot` on the laptop, then deploy the Claude page.

## What Eunomia actually holds (checked 2026-11-01)

The first draft guessed at the data. These are the facts the design now rests on:

| The draft assumed | Actually |
|---|---|
| A relationship map from recorded relationships | **No relationships exist.** Every vault's entity graph has 0 edges and every entity has `relations: []`. So v1 has no map. |
| Author and status as fields | Eunomia's `status` field is empty on every memory and there's no author field. Both live only in the tag at the start of the text: `[src: … \| seen: … \| by: … \| status: …]`. The snapshot splits it out. All 102 memories had a tag. |
| Recorded/observed dates available | `occurred_at` isn't returned by the entity routes (only by recall), so the tag's `seen:` date is the date shown, plus `created_at` / `updated_at`. |
| An export still to be designed | `collect_memories` in `_workspace/eunomia/scripts/eunomia.py` already reads everything exhaustively (entity by entity, not ranked recall). It read every vault, including Personal and `zz-backup-canary`. `snapshot` reuses it with a vault allowlist and extra fields; the `export`/backup output is unchanged. |
| Engine-tracked superseded facts | Auto-superseding needs a model, and none is configured. Replaced facts are rewritten by hand as `status: historical` (6 of them). The page treats both that and an engine `superseded` as historical. |
| Facts around services and machines | A flat list of subject entities per vault: kinds project (26), rule (15), service (7), machine (4), decision (4), task (3), plus file and person. Some names repeat across kinds (e.g. `my-website` is both a project and a rule), so the page shows the kind next to each subject. |

Numbers on 2026-11-01: 16 vaults (workspace + the 15 projects in `workspace-map.yaml`), 102
memories (69 imported, 27 by Claude, 5 by Codex); 74 documented, 18 verified, 6 historical,
3 tentative.

## Decisions

Made by Claude while building v1. Parth can change any of them.

- **Snapshot, not live.** Eunomia stays loopback-only, and no new port or service was added. The
  page works with the laptop off. A failed snapshot keeps the last good one.
- **Refresh at deploy.** `deploy.py` retakes the snapshot when it's over a day old (Parth, 2026-11-01), so each session close keeps it fresh. No timer.
- **Only the mapped vaults.** Personal and the canary are never read for the page.
- **Security notes left out.** A memory that names a credential *and* a weakness is dropped, and
  only its count is shown. On 2026-11-01 that was 1 (the box-password note). Plain rules that only
  mention credentials ("they live in auto-memory") stay.
- **Read-only.** No editing or deleting from the website.
- The snapshot and built data are git-ignored (`tools/claude-timeline/.cache/`, `dist/`). Only the
  page code is in the public repo.

## Still open

- **The map:** worth building only if relationships start being recorded (`code_relate` or
  similar). Until then, grouping by project and subject is what the data supports.
- **Entity tidy-up in Eunomia:** the duplicate-name subjects (project vs rule) could be merged.
  That's a memory change, not a page change, so it needs Parth's go-ahead.
