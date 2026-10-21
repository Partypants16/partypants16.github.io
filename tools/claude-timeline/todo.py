"""The To do page's text: _workspace/context/TODO.md, with section 1 written from git.

build.py calls make() and writes the result to dist/todo.json. TODO.md is a
short plain-text summary of what's waiting on Parth, which every session
rewrites (its header note says how). Where it has a {{git}} line, this puts a
line per repo that has work only on this laptop: uncommitted files, commits
that aren't pushed, no remote, or a remote that isn't Parth's. The build runs
on the dev laptop, so it's that laptop's state when the page was built.
Nothing is fetched, so "not pushed" is measured against what the laptop last
saw of the remote.

Like the rest of dist/, todo.json only goes to the box: TODO.md names Coles work.
"""

import datetime
import re
import subprocess

MARKER = "{{git}}"
OWNER = "Partypants16"
# Never walked when looking for repos: big, generated, or not code (Coles has no git on purpose).
SKIP = {"node_modules", ".venv", "venv", "_tools", "dist", "build", ".gradle", "__pycache__", "car_music", "Coles"}
# Repo folder → the name Parth knows it by, where the folder name isn't it.
NAMES = {
    "apps/my-website": "Website",
    "ai/cl.ai.re": "Claire (cl.ai.re)",
    "games/apex-dash": "Apex Dash",
}


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


def compare_ref(repo, branch):
    """What "pushed" is measured against: the upstream, else the same branch on origin, else origin's main/master."""
    upstream = git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if upstream and upstream.strip():
        return upstream.strip()
    for ref in ([f"origin/{branch}"] if branch else []) + ["origin/main", "origin/master"]:
        if git(repo, "rev-parse", "-q", "--verify", f"refs/remotes/{ref}") is not None:
            return ref
    return None


def plural(count, one, many):
    return f"{count} {one if count == 1 else many}"


def repo_line(workspace, repo):
    """One line of Markdown about a repo, or None if nothing in it could be lost."""
    folder = repo.relative_to(workspace).as_posix()
    status = git(repo, "status", "--porcelain", "--untracked-files=normal")
    if status is None:
        return None
    files = [line[3:].strip().strip('"') for line in status.splitlines() if len(line) > 3]
    branch = (git(repo, "branch", "--show-current") or "").strip()
    remote_url = (git(repo, "remote", "get-url", "origin") or "").strip()
    remote = re.sub(r"^.*github\.com[:/]|\.git$", "", remote_url)

    parts = []
    if files:
        shown = " (" + ", ".join(f"`{name}`" for name in files) + ")" if len(files) <= 2 else ""
        parts.append(plural(len(files), "file isn't", "files aren't") + " committed" + shown + ".")
    if not remote_url:
        parts.append("There's no remote, so it only exists on this laptop.")
    else:
        ref = compare_ref(repo, branch)
        if ref:
            ahead = int((git(repo, "rev-list", "--count", f"{ref}..HEAD") or "0").strip() or 0)
            if ahead:
                parts.append(plural(ahead, "commit isn't", "commits aren't") + " pushed.")
        else:
            parts.append(f"Branch `{branch}` was never pushed." if branch else "Nothing was ever pushed.")
        owner = remote.split("/")[0]
        if owner.lower() != OWNER.lower():
            parts.append(f"The remote is {owner}'s repo, so it needs a fork of your own before you can push.")
    if not parts:
        return None
    name = NAMES.get(folder, folder.rsplit("/", 1)[-1])
    return f"- **{name}:** " + " ".join(parts)


def git_section(workspace):
    if git(workspace, "--version") is None:
        return "Git wasn't available when this page was built, so this couldn't be checked."
    lines = [line for line in (repo_line(workspace, repo) for repo in find_repos(workspace)) if line]
    if not lines:
        return "Nothing: every repo is committed and pushed."
    return "\n".join(lines)


def make(todo_file, workspace, entries, render, warn):
    """todo.json's contents: the text as HTML, when it was written and built, and any session
    logged after the text was last written (it may be missing what they left)."""
    built = datetime.datetime.now().astimezone()
    if not todo_file.exists():
        warn("TODO.md", f"not found at {todo_file}")
        return {"built": built.isoformat(timespec="seconds"), "written": "", "html": "", "newer": []}

    text = todo_file.read_text(encoding="utf-8").replace("\r\n", "\n").lstrip("﻿")
    text = re.sub(r"^\s*<!--.*?-->\s*", "", text, count=1, flags=re.S)  # the note for whoever edits it
    if MARKER in text:
        text = text.replace(MARKER, git_section(workspace))
    else:
        warn("TODO.md", f"has no {MARKER} line, so the git part isn't shown")

    written = datetime.datetime.fromtimestamp(todo_file.stat().st_mtime).astimezone()
    mark = written.strftime("%Y-%m-%d %H:%M")
    newer = [{"id": e["id"], "title": e["title"]} for e in entries
             if e["time"] and f"{e['date']} {e['time']}" > mark]

    return {
        "built": built.isoformat(timespec="seconds"),
        "written": written.isoformat(timespec="seconds"),
        # Links to session logs open their card on the Claude page next door.
        "html": render(text).replace('href="#', 'href="./#'),
        "newer": newer,
    }
