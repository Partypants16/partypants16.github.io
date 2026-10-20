"""Runs ON the remote box: replace ~/claude-timeline/site with the contents of a zip of dist/.

usage: python3 update_site.py <site.zip>

The container bind-mounts ./site, so the folder itself is kept and only its contents are
swapped (renaming the folder would leave the container serving the old, deleted one).
The new build is extracted next to it first, so a bad zip never leaves the site half-empty.
(Same as Apex Dash's GameDevelopment/deploy/update_site.py.)
"""
import os, shutil, sys, zipfile

here = os.path.dirname(os.path.abspath(__file__))
site = os.path.join(here, "site")
staging = os.path.join(here, "site.new")
archive = sys.argv[1]

shutil.rmtree(staging, ignore_errors=True)
with zipfile.ZipFile(archive) as z:
    z.extractall(staging)
for needed in ("index.html", "data.json"):
    if not os.path.isfile(os.path.join(staging, needed)):
        sys.exit("zip has no %s at its top level, site left unchanged" % needed)

os.makedirs(site, exist_ok=True)
for name in os.listdir(site):
    path = os.path.join(site, name)
    shutil.rmtree(path) if os.path.isdir(path) and not os.path.islink(path) else os.remove(path)
for name in os.listdir(staging):
    shutil.move(os.path.join(staging, name), os.path.join(site, name))
os.rmdir(staging)
os.remove(archive)

files = sum(len(f) for _, _, f in os.walk(site))
print("site updated:", files, "files")
