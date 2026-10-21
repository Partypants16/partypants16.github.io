// The projects shown on projects.html and project.html (projects.js draws them).
//
// SAMPLE DATA, for getting the layout right. PAT-AI's story is a simplified
// version of its real history (git + session logs), but nobody has reviewed it
// yet, and the pages say so while `sample` is true. Later this file will be
// generated from the project history files (see the 2026-10-21 plan in
// parth_project/_workspace/context/sessions/), and must not be hand-edited then.
//
// Everything here is public: this repo is the public website. Never put Coles
// work, Apex Dash art, LAN addresses or local paths in it.
//
// Project fields:
//   slug, name, icon (emoji), hue (0-360, the project's colour), tagline,
//   summary, status (idea | planning | building | usable | improving | paused |
//   complete | archived), featured, kind, categories, started (YYYY-MM-DD),
//   technologies, repo ({ name, private } or null), claudeProject (its name on
//   the Claude page, or null). A project with `events` gets a full story page;
//   the others are rows in the archive.
//
// Event fields: id, date, type (milestone | decision | experiment | problem |
//   deadend | refactor | direction | release | pause | resume), title, summary,
//   key (shown under "The big calls"), and optional: context, options
//   ([{ text, chosen, note }]), why, outcome, lesson, sources
//   ([{ type: "git" | "claude" | "note", ref, label }]).

const PROJECTS_DATA = {
  sample: true,
  projects: [
    {
      slug: "pat-ai",
      name: "PAT-AI",
      icon: "📓",
      hue: 262,
      tagline: "Notebook pages in, organised notes out, all on my own laptop.",
      summary: "I write a lot in paper notebooks, and none of it was searchable. PAT-AI takes a photo of a page, reads my handwriting with a local vision model, and files each section into the right topic in my notes. Nothing leaves the laptop.",
      status: "usable",
      featured: true,
      kind: "Personal",
      categories: ["AI"],
      started: "2026-09-14",
      technologies: ["Python", "Ollama", "Qwen3-VL", "SQLite", "Obsidian"],
      repo: { name: "Partypants16/PAT-AI", private: true },
      claudeProject: "PAT-AI",
      commits: 17,
      sessions: 4,

      evolution: [
        { label: "The idea", text: "Photograph a notebook page and have it sorted into my notes by itself." },
        { label: "First build", text: "Local models read the page. The AI suggests new topics, and I approve each one." },
        { label: "What got in the way", text: "Judging each section on its own filed things in the wrong place, and the GPU only has 8 GB." },
        { label: "Change of direction", text: "One bigger model looks at a whole batch of photos together, and creates topics without asking." },
        { label: "Now", text: "Runs on my RTX 5070 laptop. New topics appear by themselves, and I fix the odd mistake after." }
      ],

      events: [
        {
          id: "local-only",
          date: "2026-09-14",
          type: "decision",
          key: true,
          title: "Keep everything on my own laptop",
          summary: "The notebooks are personal, so the reading and the thinking both run on local models.",
          context: "The obvious route was a cloud vision API: better handwriting recognition, no GPU needed. But these pages are my own plans and thoughts.",
          options: [
            { text: "Cloud vision + LLM APIs", chosen: false, note: "Most accurate, but every page would leave my laptop." },
            { text: "Local models through Ollama", chosen: true, note: "Private, free to run, and my laptop has an RTX 5070." }
          ],
          why: "Privacy wasn't something to trade for a few points of accuracy. If the local models turned out too weak, a bigger local model was the fallback, not the cloud.",
          outcome: "Everything runs offline. That rule shaped every later decision, including the model upgrade.",
          sources: [
            { type: "git", ref: "7ba3ad9", label: "Initial scaffold" },
            { type: "claude", ref: "2026-09-14-pat-ai-design-and-scaffold", label: "Design and scaffold" }
          ]
        },
        {
          id: "scaffold",
          date: "2026-09-14",
          type: "milestone",
          title: "The first version",
          summary: "Photo in, transcription, then each section filed into an \"area\": a project or any topic I take notes about.",
          context: "Projects and open-ended topics (career, fitness, ideas) were going to be separate. They behave the same way, so they became one thing: Areas of Interest.",
          why: "One model for everything I write about kept the filing logic simple. New areas were suggested by the AI but needed my approval, to stop it inventing junk folders.",
          sources: [
            { type: "git", ref: "7ba3ad9", label: "Initial scaffold" }
          ]
        },
        {
          id: "isolation",
          date: "2026-09-20",
          type: "problem",
          title: "The first real run filed things in odd places",
          summary: "Four real photos. One part of a birthday plan landed in a brand-new area called \"j\", and one page turned into 16 review items.",
          context: "Each section of a page was judged on its own, with no idea what the rest of the page was about. A heading like \"Activity\" means nothing by itself.",
          outcome: "It wasn't a bad model, it was missing context. That pointed at how the classifier was fed, not at which model it was.",
          lesson: "Four real photos found what every mocked test had missed.",
          sources: [
            { type: "git", ref: "d96eadb", label: "First test data" },
            { type: "claude", ref: "2026-09-20-pat-ai-classification-fix", label: "Classification fix" }
          ]
        },
        {
          id: "page-at-once",
          date: "2026-09-20",
          type: "experiment",
          title: "Classify a whole page at once",
          summary: "Sections from the same page now stay together. It half worked.",
          context: "If a page is judged as a whole, its sections should land in the same place.",
          outcome: "Same-page sections stayed together, but the page still went to the wrong area: nothing on that photo said what it was about, and the other photos in the same run weren't considered.",
          lesson: "Fixing one level of missing context just moved the problem up a level.",
          sources: [
            { type: "git", ref: "aaa241a", label: "Classify a whole page at once" },
            { type: "git", ref: "f19cebe", label: "Second test data" }
          ]
        },
        {
          id: "batch",
          date: "2026-09-20",
          type: "decision",
          key: true,
          title: "Look at the whole batch, with a bigger model",
          summary: "Every photo in a run is classified together, by a 30B model instead of a 14B one.",
          context: "Photos taken in one sitting usually belong together. The smaller model also made poor calls even when it had the whole page.",
          options: [
            { text: "Keep the 14B model, tune the prompt", chosen: false, note: "Cheap, but it was already failing with good context." },
            { text: "A cloud model", chosen: false, note: "Ruled out by the keep-it-local rule." },
            { text: "A 30B local model, whole batch at once", chosen: true, note: "Slower, but it sees how the photos relate." }
          ],
          why: "Slower but right beats fast but wrong for something that runs in the background. The prompt also says photos in one batch are not assumed related just for being in it, so unrelated pages don't get merged.",
          outcome: "Cross-photo filing worked in tests, without merging pages that had nothing to do with each other.",
          sources: [
            { type: "git", ref: "299e1f1", label: "Classify a whole batch together" },
            { type: "claude", ref: "2026-09-20-pat-ai-classification-fix", label: "Classification fix" }
          ]
        },
        {
          id: "one-model",
          date: "2026-09-20",
          type: "decision",
          title: "One model for reading and thinking",
          summary: "The same 30B vision model now does the handwriting too, so the GPU never swaps between two models.",
          context: "Reading used a small 8B model and thinking used the 30B one. With 8 GB of VRAM, Ollama threw one out to load the other on every step.",
          options: [
            { text: "Keep two models", chosen: false, note: "Fast reading, but a model swap every step." },
            { text: "One model for reading and thinking", chosen: true, note: "No swaps. Each photo reads slower." },
            { text: "Fold the search embeddings in too", chosen: false, note: "A chat model searches worse than a small model trained for it, and that one fits anyway." }
          ],
          why: "The swapping cost more than the slower reading. The embedding model was tiny and never fighting for memory, so merging it would only have made search worse.",
          sources: [
            { type: "git", ref: "d23b463", label: "Consolidate vision and reasoning onto one model" }
          ]
        },
        {
          id: "autonomy",
          date: "2026-09-20",
          type: "direction",
          key: true,
          title: "Let the AI create new areas itself",
          summary: "Human approval for new areas was removed, reversing the rule from day one.",
          context: "After a third test run, a movie list was still being filed under the wrong topic. Every run also stopped and waited for me to approve new areas, so nothing got filed until I looked.",
          options: [
            { text: "Keep approving every new area", chosen: false, note: "Safe, but the tool waits on me all the time." },
            { text: "The AI decides and creates areas", chosen: true, note: "A wrong call becomes a real folder before I see it." }
          ],
          why: "I knew the risk and took it on purpose: a tool I have to babysit is a tool I stop using. Mistakes get fixed afterwards with a correct command instead of being blocked up front.",
          outcome: "Areas now appear by themselves. The first real run on the gaming laptop created 6 of them with no problems.",
          sources: [
            { type: "git", ref: "a209bcb", label: "Remove human review for new areas" },
            { type: "git", ref: "c84e0cb", label: "Third test data" },
            { type: "claude", ref: "2026-09-20-pat-ai-classification-fix", label: "Classification fix" }
          ]
        },
        {
          id: "review-queue",
          date: "2026-09-20",
          type: "deadend",
          title: "The review queue",
          summary: "The approval queue for new areas was deleted six days after it was built: the module, its database tables and its command.",
          context: "Built on day one as a safety net, before I'd used the tool on a single real page.",
          outcome: "Removed completely, then the whole codebase was searched to make sure nothing still used it.",
          lesson: "A safety net designed before real use guessed the wrong risk. The real problem was waiting, not bad folders.",
          sources: [
            { type: "git", ref: "a209bcb", label: "Remove human review for new areas" }
          ]
        },
        {
          id: "vram",
          date: "2026-09-21",
          type: "problem",
          title: "A 20 GB model on an 8 GB GPU",
          summary: "Ollama was running partly on the CPU. That turned out to be expected, not a bug.",
          context: "The 30B model needs about 20 GB, more than twice the laptop's VRAM, so some of it always spills to the CPU.",
          options: [
            { text: "Force more layers onto the GPU", chosen: false, note: "Risks hard out-of-memory crashes." },
            { text: "Free VRAM with flash attention and a smaller cache", chosen: true, note: "Ollama fits more layers by itself, safely." }
          ],
          why: "The safe settings get most of the benefit without the crash risk. The docs now explain what a normal CPU/GPU split looks like, so it doesn't look broken next time.",
          sources: [
            { type: "git", ref: "55710a7", label: "Ollama GPU tuning script" },
            { type: "claude", ref: "2026-09-21-pat-ai-gpu-utilization", label: "GPU utilisation" }
          ]
        },
        {
          id: "hardening",
          date: "2026-09-22",
          type: "refactor",
          title: "Hardening after the first real runs",
          summary: "Six small fixes from using it for real: ID collisions, interrupted runs, batch size and near-duplicate areas.",
          context: "Real use found the edges: an interrupted run skipped photos as duplicates, IDs collided across areas, and similar areas got created twice.",
          outcome: "Existing areas are reused instead of near-copies, and there's a script to re-file anything that went wrong.",
          sources: [
            { type: "git", ref: "6ddec1c", label: "Fix false-duplicate skip" },
            { type: "git", ref: "03af759", label: "Fix ID collision" },
            { type: "git", ref: "7c5826b", label: "Cap batches at 4" },
            { type: "git", ref: "a17dcda", label: "Reuse existing areas" }
          ]
        },
        {
          id: "real-run",
          date: "2026-09-22",
          type: "release",
          key: false,
          title: "First real run on the gaming laptop",
          summary: "12 photos over 3 runs. The AI created 6 new areas by itself, with no crashes.",
          outcome: "One photo failed to read, and it was set aside on its own exactly as designed while the rest of the batch carried on. Retrying it is just moving it back.",
          sources: [
            { type: "claude", ref: "2026-09-22-pat-ai-first-real-world-run", label: "First real-world run" }
          ]
        }
      ],

      lessons: [
        { title: "Context beats cleverness", text: "The wrong filing was fixed by showing the model more of the picture, not by a smarter prompt." },
        { title: "Real data early", text: "Four real photos found what every mocked test missed." },
        { title: "Don't guess the risk", text: "The review queue protected against bad folders. The real problem was waiting on me." },
        { title: "Know what normal looks like", text: "CPU spill-over with a 20 GB model on 8 GB is expected. Knowing that saved a risky \"fix\"." }
      ],

      focus: "Using it every week and watching where the AI's filing goes wrong, before changing anything else.",
      next: [
        "Decide what to do with the leftover example area",
        "Check a month of real pages for misfiled sections",
        "Try a faster model for reading, now that filing is reliable"
      ]
    },

    {
      slug: "website",
      name: "Parth's Palace",
      icon: "🏰",
      hue: 210,
      tagline: "This website: home-server cards, wallpapers, Hinglish, and this page.",
      status: "improving",
      kind: "Personal",
      categories: ["Web"],
      started: "2026-03-04",
      technologies: ["HTML", "CSS", "JavaScript", "GitHub Pages"],
      repo: { name: "Partypants16/partypants16.github.io", private: false },
      claudeProject: "Website"
    },
    {
      slug: "skywardrobe",
      name: "SkyWardrobe",
      icon: "🌦️",
      hue: 195,
      tagline: "Tells you what to wear from the weather forecast. Web, Docker and Android.",
      status: "usable",
      kind: "Personal",
      categories: ["Web", "Android"],
      started: "2026-08-07",
      technologies: ["Node.js", "SQLite", "Docker", "Android"],
      repo: { name: "Partypants16/SkyWardrobe", private: false },
      claudeProject: "SkyWardrobe"
    },
    {
      slug: "crosspaste",
      name: "CrossPaste",
      icon: "📋",
      hue: 150,
      tagline: "A shared clipboard for text and files across devices on the home network.",
      status: "usable",
      kind: "Personal",
      categories: ["Web"],
      started: "2026-08-06",
      technologies: ["Node.js", "Caddy", "Docker"],
      repo: { name: "Partypants16/CrossPaste", private: false },
      claudeProject: "CrossPaste"
    },
    {
      slug: "printplace",
      name: "PrintPlace",
      icon: "🧊",
      hue: 25,
      tagline: "See a 3D print on your real desk in AR before you print it.",
      status: "building",
      kind: "Personal",
      categories: ["Android", "3D printing"],
      started: "2026-08-07",
      technologies: ["Kotlin", "Jetpack Compose", "Filament", "ARCore"],
      repo: { name: "Partypants16/PrintPlace", private: false },
      claudeProject: "PrintPlace"
    },
    {
      slug: "novadiagnostics",
      name: "NovaDiagnostics",
      icon: "📊",
      hue: 330,
      tagline: "A dashboard for what an Android phone is doing under the hood.",
      status: "paused",
      kind: "Personal",
      categories: ["Android"],
      started: "2026-08-07",
      technologies: ["Kotlin", "Jetpack Compose", "Material 3"],
      repo: { name: "Partypants16/NovaDiagnostics", private: false },
      claudeProject: "NovaDiagnostics"
    },
    {
      slug: "loveless",
      name: "LOVELESS book",
      icon: "📖",
      hue: 40,
      tagline: "A hand-bound copy of the play from Crisis Core, with every illustration drawn in code.",
      status: "complete",
      kind: "Personal",
      categories: ["Design", "Physical"],
      started: "2026-09-29",
      technologies: ["Python", "Typesetting", "Bookbinding"],
      repo: null,
      claudeProject: "Physical projects"
    },
    {
      slug: "smart-watch",
      name: "Smart watch",
      icon: "⌚",
      hue: 280,
      tagline: "My own smart watch. Still comparing hackable watches.",
      status: "idea",
      kind: "Personal",
      categories: ["Hardware"],
      started: "2026-09-29",
      technologies: ["ESP32"],
      repo: null,
      claudeProject: "Physical projects"
    }
  ]
};
