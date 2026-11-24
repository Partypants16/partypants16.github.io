"""Refuse a commit that adds a 3D model file outside the folders meant for them.

usage: python tools/model_guard.py            (checks what's staged; exit 1 = blocked)

This repo is public. The 3D Scan Viewer and Avatar Lab open people's own scans and
avatars in the browser, and Parth's are private (a body scan of him), so a model file
must never be committed by accident. Allowed: the public games' car models in play/,
and vendored library files in vendor/. Anything else (.glb .vrm .fbx .obj .stl ...)
stops the commit with a message. Run by the pre-commit hook
(tools/car_events/install_hook.py installs both).
"""
import subprocess
import sys

EXTS = (".glb", ".gltf", ".vrm", ".fbx", ".obj", ".usdz", ".usd", ".usdc", ".usda", ".ply", ".stl",
        ".3mf", ".blend", ".dae", ".bvh", ".task")
ALLOWED = ("play/", "vendor/")

out = subprocess.run(["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
                     capture_output=True, text=True, encoding="utf-8").stdout.split("\n")
bad = [p for p in out if p.lower().endswith(EXTS) and not p.startswith(ALLOWED)]
if bad:
    print("model_guard: these 3D model files would go into the PUBLIC repo:")
    for p in bad:
        print("   ", p)
    print("Unstage them (git restore --staged <file>). If one really belongs here, put it in")
    print("play/ or vendor/, or edit ALLOWED in tools/model_guard.py.")
    sys.exit(1)
