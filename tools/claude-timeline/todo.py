"""The To do page's data: _workspace/context/TODO.yaml plus what git says.

build.py calls make() and writes the result to dist/todo.json. It has two parts:

- The list Parth's sessions keep up to date in TODO.yaml (tests only he can
  run, decisions he owes, parked things, research). Its header says how.
- "Work you could lose", worked out from git on every build: each repo in
  parth_project with uncommitted files, commits that aren't pushed, no remote,
  or a remote that isn't Parth's. The build runs on the dev laptop, so it's
  that laptop's state at build time. Nothing is fetched, so "not pushed" is
  measured against what the laptop last saw of the remote.

Like the rest of dist/, todo.json only goes to the box: TODO.yaml names Coles work.
"""

import datetime
import re
import subprocess

import yaml

CATEGORIES = ["test", "decide", "parked", "research"]
WHERE = ["LEGION", "Phone", "Azure", "Remote box", "This laptop"]
OWNER = "Partypants16"
# Never walked when looking for repos: big, generated, or not code (Coles has no git on purpose).
SKIP = {"node_modules", ".venv", "venv", "_tools", "dist", "build", ".gradle", "__pycache__", "car_music", "Coles"}
# Repo folder → project name on the Claude page, where the folder name isn't enough.
REPO_PROJECTS = {
    "apps/my-website": "Website",
    "ai/cl.ai.re": "Claire",
    "ai/sonic-gaming-archive": "Gaming Archive",
    "games/apex-dash": "Apex Dash",
    "music_singing": "Music",
    "physical_projects": "Physical projects",
}
FILES_SHOWN = 12


def git(repo, *args):
    """git's output, or None if git isn't there or the command fails."""
    try:
        done = subprocess.run(["git", "-c", "core.quotepath=false", "-C", str(repo), *args],
                              capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return done.stdout if done.returncode == 0 else None


def find_repos(workspace, depth=3):
    found = []

    def walk(folder, level):
        if (folder / ".git").exists():
            found.append(folder)
            return  # nested repos aren't a thing here
        if level == depth:
            return
        try:
            children = sorted(p for p in folder.iterdir() if p.is_dir())
        except OSError:
            return
        for child in children:
            if child.name not in SKIP and not child.name.startswith("."):
                walk(child, level + 1)

    walk(workspace, 0)
    return found


def project_for(folder, projects):
    if folder in REPO_PROJECTS:
        return REPO_PROJECTS[folder]
    name = folder.rsplit("/", 1)[-1].lower()
    return next((p for p in projects if p.lower() == name), "")


def compare_ref(repo, branch):
    """What "pushed" is measured against: the upstream, else the same branch on origin, else origin's main/master."""
    upstream = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if upstream and upstream.strip():
        return upstream.strip()
    for ref in ([f"origin/{branch}"] if branch else []) + ["origin/main", "origin/master"]:
        if git(repo, "rev-parse", "-q", "--verify", f"refs/remotes/{ref}") is not None:
            return ref
    return None


def repo_state(workspace, repo, projects, notes):
    folder = repo.relative_to(workspace).as_posix()
    branch = (git(repo, "branch", "--show-current") or "").strip()
    status = git(repo, "status", "--porcelain", "--untracked-files=normal")
    if status is None:
        return None
    files = [line[3:] for line in status.splitlines() if len(line) > 3]
    remote_url = (git(repo, "remote", "get-url", "origin") or "").strip()
    remote = re.sub(r"^.*github\.com[:/]|\.git$", "", remote_url) if remote_url else ""

    ahead, ref = 0, None
    if remote_url:
        ref = compare_ref(repo, branch)
        if ref:
            ahead = int((git(repo, "rev-list", "--count", f"{ref}..HEAD") or "0").strip() or 0)

    issues = []
    if files:
        issues.append({"kind": "uncommitted", "count": len(files)})
    if not remote_url:
        issues.append({"kind": "noremote"})
    else:
        if ahead:
            issues.append({"kind": "unpushed", "count": ahead, "ref": ref})
        elif not ref:
            issues.append({"kind": "neverpushed"})
        if not remote.lower().startswith(OWNER.lower() + "/"):
            issues.append({"kind": "notyours", "owner": remote.split("/")[0]})

    return {
        "folder": folder,
        "project": project_for(folder, projects),
        "branch": branch,
        "remote": remote,
        "lastCommit": (git(repo, "log", "-1", "--format=%cs") or "").strip(),
        "files": files[:FILES_SHOWN],
        "moreFiles": max(0, len(files) - FILES_SHOWN),
        "issues": issues,
        "note": " ".join(str(notes.get(folder, "")).split()),
    }


def text(value):
    return " ".join(str(value).split()) if value is not None else ""


def item(category, index, raw, projects, sessions, warn):
    where = f"TODO.yaml {category}[{index}]"
    if not isinstance(raw, dict) or not text(raw.get("title")):
        warn(where, "has no title, left out")
        return None
    out = {"title": text(raw["title"]), "detail": text(raw.get("detail")), "project": "", "where": "",
           "effort": text(raw.get("effort")), "since": "", "steps": [], "logs": []}
    project = raw.get("project")
    if project in projects:
        out["project"] = project
    else:
        warn(where, f"project {project!r} isn't on the Claude page's list")
    if raw.get("where"):
        if raw["where"] in WHERE:
            out["where"] = raw["where"]
        else:
            warn(where, f"where {raw['where']!r} isn't one of {', '.join(WHERE)}")
    since = str(raw.get("since") or "")
    if re.match(r"^\d{4}-\d{2}-\d{2}$", since):
        out["since"] = since
    elif since:
        warn(where, f"since {since!r} isn't YYYY-MM-DD")
    out["steps"] = [text(step) for step in (raw.get("steps") or []) if text(step)]
    for name in raw.get("logs") or []:
        name = str(name).removesuffix(".md")
        if name in sessions:
            out["logs"].append({"id": name, "title": sessions[name]["title"], "date": sessions[name]["date"]})
        else:
            warn(where, f"log {name!r} doesn't exist")
    return out


def make(todo_file, workspace, projects, entries, warn):
    """todo.json's contents. `entries` are the Claude page's cards (for log titles, and to spot logs
    newer than the list)."""
    sessions = {entry["id"]: entry for entry in entries}
    data = {}
    if todo_file.exists():
        try:
            data = yaml.safe_load(todo_file.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as error:
            warn("TODO.yaml", "isn't valid YAML: " + str(error).replace("\n", " "))
    else:
        warn("TODO.yaml", f"not found at {todo_file}")
    if not isinstance(data, dict):
        data = {}

    updated = text(data.get("updated"))
    if updated and not re.match(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$", updated):
        warn("TODO.yaml", f"updated {updated!r} isn't 'YYYY-MM-DD HH:MM'")
    start = data.get("start_here") if isinstance(data.get("start_here"), dict) else {}

    sections = {}
    for category in CATEGORIES:
        raw = data.get(category) or []
        if not isinstance(raw, list):
            warn("TODO.yaml", f"{category} should be a list of items, left out")
            raw = []
        items = [item(category, i, entry, projects, sessions, warn) for i, entry in enumerate(raw)]
        sections[category] = [entry for entry in items if entry]

    notes = data.get("repo_notes") if isinstance(data.get("repo_notes"), dict) else {}
    repos = None
    if git(workspace, "--version") is not None:
        states = [repo_state(workspace, repo, projects, notes) for repo in find_repos(workspace)]
        states = [s for s in states if s]
        repos = {"risky": [s for s in states if s["issues"]],
                 "safe": [{"folder": s["folder"], "project": s["project"]} for s in states if not s["issues"]]}
        for folder in notes:
            if folder not in {s["folder"] for s in states}:
                warn("TODO.yaml", f"repo_notes has {folder!r}, which isn't a repo")
    else:
        warn("TODO.yaml", "git isn't available, so the page can't show uncommitted work")

    # Logs written after the list was last updated: what it might be missing.
    newer = []
    if updated:
        mark = updated if " " in updated else updated + " 23:59"
        for entry in entries:
            stamp = entry["date"] + " " + (entry["time"] or "00:00")
            if entry["time"] and stamp > mark:
                newer.append({"id": entry["id"], "title": entry["title"], "date": entry["date"], "time": entry["time"]})

    return {
        "built": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "updated": updated,
        "startHere": {"title": text(start.get("title")), "text": text(start.get("text"))},
        "repos": repos,
        "sections": sections,
        "newer": newer,
    }
