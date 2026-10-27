"""Build the Claude page and put it live on the remote box (http://192.168.212.60:8120, LAN only).

usage (from my-website/):  python tools/claude-timeline/deploy.py [--no-build]

Needs PuTTY (plink/pscp). The box password comes from the REMOTE_BOX_PW environment
variable, or is asked for. It is never stored here.

What it does: build.py -> zip dist/ -> upload it with Caddyfile, docker-compose.yml and
update_site.py to ~/claude-timeline/ -> update_site.py swaps the site in place ->
docker compose up (recreated, so a changed Caddyfile is picked up too) -> checks the page
and data.json answer, and that data.json is the one just built; the same for the ChatGPT
page (chatgpt.html + chatgpt-data.json, compared byte for byte) and the Encyclopedia.
dist/ holds the full session logs, so it only ever goes to this private box.

The Encyclopedia's Coles Confluence section (encyclopedia/confluence/, from confluence.py) can
grow to tens of thousands of pages, so it's only sent when it changed: if the box's
encyclopedia/confluence/build-hash.txt matches this build's, the section is left out of the zip
and update_site.py keeps the copy already on the box.
"""
import getpass, json, os, subprocess, sys, tempfile, time, urllib.request, zipfile

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


CONFLUENCE = "encyclopedia/confluence"


def confluence_hash(read):
    try:
        return read().strip()
    except OSError:
        return ""


local_hash = confluence_hash(lambda: open(os.path.join(DIST, *CONFLUENCE.split("/"), "build-hash.txt"), encoding="utf-8").read())
box_hash = confluence_hash(lambda: urllib.request.urlopen(URL + CONFLUENCE + "/build-hash.txt", timeout=10).read().decode())
keep_confluence = bool(local_hash) and local_hash == box_hash

archive = os.path.join(tempfile.gettempdir(), "claude-site.zip")
count = 0
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for folder, _, names in os.walk(DIST):
        for name in names:
            path = os.path.join(folder, name)
            rel = os.path.relpath(path, DIST).replace(os.sep, "/")
            if keep_confluence and rel.startswith(CONFLUENCE + "/"):
                continue
            z.write(path, rel)
            count += 1
print("zipped", count, "files from dist/" + (" (Confluence unchanged, kept on the box)" if keep_confluence else ""))

ssh("mkdir -p " + REMOTE_DIR + "/site")
upload([os.path.join(HERE, n) for n in ("Caddyfile", "docker-compose.yml", "update_site.py")] + [archive])
os.remove(archive)
ssh("python3 %s/update_site.py %s/claude-site.zip%s" % (REMOTE_DIR, REMOTE_DIR, " --keep " + CONFLUENCE if keep_confluence else ""))
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
        # The ChatGPT page: it answers, and its own data file is this build's (same bytes and sessions).
        with urllib.request.urlopen(URL + "chatgpt.html", timeout=15) as response:
            chat_page = response.status
        request = urllib.request.Request(URL + "chatgpt-data.json", headers={"Accept-Encoding": "identity"})
        with urllib.request.urlopen(request, timeout=15) as response:
            live = response.read()
        with open(os.path.join(DIST, "chatgpt-data.json"), "rb") as built:
            local = built.read()
        if live != local:
            sys.exit("chatgpt-data.json on the box (%d bytes) isn't the one just built (%d bytes)" % (len(live), len(local)))
        print("live:", URL + "chatgpt.html", chat_page, "· chatgpt-data.json", len(live), "bytes,",
              len(json.loads(live)["entries"]), "sessions, matches the build")
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
        # The Memory hub (memory.html + memory.json), once the build writes it.
        built_memory = os.path.join(DIST, "memory.json")
        if os.path.isfile(built_memory):
            with urllib.request.urlopen(URL + "memory.html", timeout=15) as response:
                memory_page = response.status
            request = urllib.request.Request(URL + "memory.json", headers={"Accept-Encoding": "identity"})
            with urllib.request.urlopen(request, timeout=15) as response:
                live = response.read()
            with open(built_memory, "rb") as built:
                local = built.read()
            if live != local:
                sys.exit("memory.json on the box (%d bytes) isn't the one just built (%d bytes)" % (len(live), len(local)))
            print("live:", URL + "memory.html", memory_page, "· memory.json", len(live), "bytes, matches the build")
        if local_hash:
            live_hash = confluence_hash(lambda: urllib.request.urlopen(URL + CONFLUENCE + "/build-hash.txt", timeout=15).read().decode())
            if live_hash != local_hash:
                sys.exit("encyclopedia/confluence on the box isn't this build's (hash differs)")
            print("live:", URL + CONFLUENCE + "/", "· build hash matches" + (" (not re-sent)" if keep_confluence else " (sent)"))
        break
    except OSError:
        time.sleep(1)
else:
    sys.exit("the page did not answer at " + URL)
