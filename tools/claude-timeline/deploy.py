"""Build the Claude page and put it live on the remote box (http://192.168.212.60:8120, LAN only).

usage (from my-website/):  python tools/claude-timeline/deploy.py [--no-build]

Needs PuTTY (plink/pscp). The box password comes from the REMOTE_BOX_PW environment
variable, or is asked for. It is never stored here.

What it does: build.py -> zip dist/ -> upload it with Caddyfile, docker-compose.yml and
update_site.py to ~/claude-timeline/ -> update_site.py swaps the site in place ->
docker compose up (recreated, so a changed Caddyfile is picked up too) -> checks the page
and data.json answer, and that data.json is the one just built.
dist/ holds the full session logs, so it only ever goes to this private box.
"""
import getpass, os, subprocess, sys, tempfile, time, urllib.request, zipfile

HOST = "parth@192.168.212.60"
REMOTE_DIR = "/home/parth/claude-timeline"
URL = "http://192.168.212.60:8120/"
PUTTY = r"C:\Program Files\PuTTY"
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")

if "--no-build" not in sys.argv:
    subprocess.run([sys.executable, os.path.join(HERE, "build.py")], check=True)

password = os.environ.get("REMOTE_BOX_PW") or getpass.getpass("Password for %s: " % HOST)


def ssh(command):
    print("box>", command)
    subprocess.run([os.path.join(PUTTY, "plink.exe"), "-ssh", "-batch", "-pw", password, HOST, command], check=True)


def upload(paths):
    subprocess.run([os.path.join(PUTTY, "pscp.exe"), "-batch", "-q", "-pw", password, *paths, HOST + ":" + REMOTE_DIR + "/"], check=True)


archive = os.path.join(tempfile.gettempdir(), "claude-site.zip")
count = 0
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for folder, _, names in os.walk(DIST):
        for name in names:
            path = os.path.join(folder, name)
            z.write(path, os.path.relpath(path, DIST).replace(os.sep, "/"))
            count += 1
print("zipped", count, "files from dist/")

ssh("mkdir -p " + REMOTE_DIR + "/site")
upload([os.path.join(HERE, n) for n in ("Caddyfile", "docker-compose.yml", "update_site.py")] + [archive])
os.remove(archive)
ssh("python3 %s/update_site.py %s/claude-site.zip" % (REMOTE_DIR, REMOTE_DIR))
ssh("docker compose -f %s/docker-compose.yml up -d --force-recreate" % REMOTE_DIR)

expected = os.path.getsize(os.path.join(DIST, "data.json"))
for attempt in range(10):  # Caddy takes a moment to start after the recreate
    try:
        with urllib.request.urlopen(URL, timeout=15) as response:
            page = response.status
        request = urllib.request.Request(URL + "data.json", headers={"Accept-Encoding": "identity"})
        with urllib.request.urlopen(request, timeout=15) as response:
            size = len(response.read())
        if size != expected:
            sys.exit("data.json on the box is %d bytes, expected %d" % (size, expected))
        print("live:", URL, page, "· data.json", size, "bytes, matches the build")
        # The Encyclopedia tab: its front page and search index answer, and the index is this build's.
        search = os.path.join(DIST, "encyclopedia", "search.json")
        if os.path.isfile(search):
            request = urllib.request.Request(URL + "encyclopedia/search.json", headers={"Accept-Encoding": "identity"})
            with urllib.request.urlopen(request, timeout=15) as response:
                got = len(response.read())
            with urllib.request.urlopen(URL + "encyclopedia/", timeout=15) as response:
                front = response.status
            if got != os.path.getsize(search):
                sys.exit("encyclopedia/search.json on the box is %d bytes, expected %d" % (got, os.path.getsize(search)))
            print("live:", URL + "encyclopedia/", front, "· search.json", got, "bytes, matches the build")
        break
    except OSError:
        time.sleep(1)
else:
    sys.exit("the page did not answer at " + URL)
