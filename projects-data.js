// The projects shown on projects.html and project.html (projects.js draws them).
//
// The four stories (PAT-AI, Apex Dash, LOVELESS book, Sonic laptop) are
// simplified versions of their real history (git, session logs and project
// docs). Parth approved the layout on 2026-10-22, so `sample` is off; setting
// it to true brings back the "Sample data" note and badges. Later this file
// will be generated from the project history files (see the 2026-10-21 plan in
// parth_project/_workspace/context/sessions/), and must not be hand-edited then.
//
// Everything here is public: this repo is the public website. Never put Coles
// work, Apex Dash art, LAN addresses or local paths in it.
//
// Project fields:
//   slug, name, icon (emoji), hue (0-360, the project's colour), tagline,
//   summary, status (idea | planning | building | usable | improving | paused |
//   complete | archived), featured, kind, categories, started (YYYY-MM-DD),
//   technologies, repo ({ name, private } or null; a private one can leave out
//   its name), claudeProject (its name on the Claude page, or null). A project
//   with `events` gets a full story page; the others are rows in the archive.
//
// Event fields: id, date, type (milestone | decision | experiment | problem |
//   deadend | refactor | direction | release | pause | resume), title, summary,
//   key (shown under "The big calls"), and optional: context, options
//   ([{ text, chosen, note }]), why, outcome, lesson, sources
//   ([{ type: "git" | "claude" | "note", ref, label }]).

const PROJECTS_DATA = {
  sample: false,
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
      tagline: "A hand-bound copy of the poem from Crisis Core, with every illustration drawn in code.",
      summary: "LOVELESS is the poem Genesis keeps quoting in Crisis Core. I wanted a copy he could plausibly carry: an old, plain literary book, not a fan book. It's 64 A5 pages with both versions of the text, and every illustration is drawn by code as an old-style line engraving. Printed, folded and stapled by hand.",
      status: "complete",
      featured: true,
      kind: "Personal",
      categories: ["Design", "Physical"],
      started: "2026-09-29",
      technologies: ["Python", "Typesetting", "Bookbinding"],
      repo: null,
      claudeProject: "Physical projects",
      commits: 4,
      sessions: 4,

      evolution: [
        { label: "The idea", text: "An in-universe copy of LOVELESS, the kind Genesis could carry, bound by hand." },
        { label: "First build", text: "A 16-page Word draft with both versions of the text, and no pictures." },
        { label: "What got in the way", text: "Image generation refused the illustrations, and 16 pages is too thin to bind." },
        { label: "Change of direction", text: "The whole book generated by code: 64 A5 pages and 24 engravings, rebuilt in about a minute." },
        { label: "Now", text: "Printed, folded into one booklet with a patterned soft cover, and stapled down the spine. Done." }
      ],

      events: [
        {
          id: "word-draft",
          date: "2026-09-29",
          type: "milestone",
          title: "Where it started: a 16-page Word draft",
          summary: "Cover, an edition note, both versions of LOVELESS, act headings and a FINIS page, at A5.",
          context: "There are two versions of the text: a prose \"Interpreted\" one that stops after Act III, and a \"Poem\" one whose Act V is Genesis's own ending. The draft keeps them apart on purpose.",
          why: "Merging them would have made a neater book but a wrong one. The wording is fixed, and the only change was restoring \"shattered soul\", which the transcription had censored.",
          outcome: "A good text, but only 16 pages. The plan said a bound book needs about 64, and there was no artwork yet.",
          sources: [
            { type: "note", ref: "LOVELESS_Project_Handoff.md", label: "Project handoff" },
            { type: "claude", ref: "2026-09-29-physical-projects-setup", label: "Physical projects setup" }
          ]
        },
        {
          id: "art-in-code",
          date: "2026-09-29",
          type: "decision",
          key: true,
          title: "Draw the artwork in code",
          summary: "Every illustration is a line engraving drawn by a small Python engine, not a generated image.",
          context: "The first try at generating the illustrations was rejected by the image generator, so nothing got made. No image tool was available for a second try either.",
          options: [
            { text: "Retry image generation, one scene at a time", chosen: false, note: "What the plan suggested, but there was no tool to do it with." },
            { text: "Use art from the game", chosen: false, note: "Screenshots and logos would turn it back into a fan book." },
            { text: "Draw engravings in code", chosen: true, note: "Slow to get right, but fully under my control and fits an old book." }
          ],
          why: "An old literary book would have copperplate engravings anyway. The engine turns a shading map into lines that swell in shadow and fade in light, like a real engraving. The scenes are symbolic: the Goddess is faceless and veiled, people are small cloaked figures, and nothing is taken from the game.",
          outcome: "24 illustrations: 12 full plates, 5 role medallions, and 5 vignettes plus a tailpiece. There's no page background, so the paper gives the colour.",
          sources: [
            { type: "git", ref: "32b66c1", label: "Initial commit" },
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" }
          ]
        },
        {
          id: "code-edition",
          date: "2026-09-29",
          type: "direction",
          key: true,
          title: "From a Word file to a book built by code",
          summary: "The 64-page A5 PDFs became the master. The Word draft is kept only for reference.",
          context: "The plan was to grow the Word document to 64 pages by hand: plates, role pages, Banora tablets, a theatre programme, appendices.",
          options: [
            { text: "Keep expanding the Word document", chosen: false, note: "Familiar, but every page move means fixing layout by hand." },
            { text: "Generate the whole book from code", chosen: true, note: "Text, plates and page order in one place, rebuilt with one command." }
          ],
          why: "A book that gets folded needs exact page sizes, exact page order and print sheets laid out for folding. Code gets those right every time, and changing one plate is a rebuild, not an afternoon in Word.",
          outcome: "One command makes the A5 reading copy, the A4 sheets for folding, and a cover label and endpaper sheet, in about a minute. Every LOVELESS line was checked against the master text.",
          sources: [
            { type: "git", ref: "32b66c1", label: "Initial commit" },
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" },
            { type: "note", ref: "LOVELESS_Project_Handoff.md", label: "Project handoff" }
          ]
        },
        {
          id: "in-universe",
          date: "2026-09-29",
          type: "decision",
          title: "Keep the front of the book in-universe",
          summary: "The game credit moved from the title page to the colophon at the very back.",
          context: "Opening the book should feel like opening a real edition of LOVELESS, not a fan print.",
          options: [
            { text: "Game credit on the title page", chosen: false, note: "Honest, but it breaks the illusion on page one." },
            { text: "Game credit in the colophon", chosen: true, note: "Still credited, just where printers' details normally go." }
          ],
          why: "The credit is still there, just at the back. The new writing (notes on the characters, the Banora tablets, a theatre programme, readings of the Gift) is labelled in the edition note as added interpretation, and quotes only the two real versions.",
          outcome: "Every act opens on a right-hand page with its plate facing it, and the black-feather page sits just before Genesis's Act V.",
          sources: [
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" }
          ]
        },
        {
          id: "bow-wrong-way",
          date: "2026-09-29",
          type: "problem",
          title: "The bow faced the wrong way",
          summary: "On the Act IV plate, the bow bent the wrong way for the arrow's flight.",
          context: "Every spread had been checked on screen, and it still got through. I spotted it looking at the plate.",
          outcome: "Fixed: the bow now bulges toward the target with the string on the archer's side. All the PDFs were rebuilt.",
          lesson: "Code checks page sizes and fonts. Only looking at the picture catches a picture that's wrong.",
          sources: [
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" }
          ]
        },
        {
          id: "loose-leaves",
          date: "2026-09-29",
          type: "deadend",
          title: "Loose A5 pages, glued",
          summary: "I tried switching to single A5 pages glued at the spine. It was dropped the same day.",
          context: "I liked the A5 pages and wanted to print from them directly, instead of folded A4 sheets.",
          outcome: "Printing A5 turned out awkward, so I went back to the A4 sheets. The steps are kept in the printing doc, marked as dropped.",
          lesson: "The format that's nicest on screen isn't always the one that's easy to print.",
          sources: [
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" },
            { type: "note", ref: "PRINTING_AND_BINDING.md", label: "Printing and binding" }
          ]
        },
        {
          id: "one-booklet",
          date: "2026-09-29",
          type: "decision",
          key: true,
          title: "One booklet, folded once and stapled",
          summary: "Instead of four sewn sections in a hardback, the whole book prints as 16 sheets that fold into one booklet.",
          context: "I wanted to print it myself on a self-serve copier, and those can only staple a corner or an edge, not down a fold.",
          options: [
            { text: "4 sewn sections in a hardback case", chosen: false, note: "The proper way, and the original plan, but a lot of work." },
            { text: "Loose A5 pages, glued", chosen: false, note: "Already tried and dropped." },
            { text: "One 16-sheet booklet, stapled on the fold", chosen: true, note: "Prints anywhere, folds in one go. 16 sheets is about the limit." }
          ],
          why: "It's the route I'd actually finish. The book's code only needed a new page layout for one big fold, and the sewn version stays there as the proper route.",
          outcome: "A third print file, where the middle of the stack opens on pages 32 and 33. That's the one I printed.",
          sources: [
            { type: "git", ref: "32b66c1", label: "Initial commit" },
            { type: "claude", ref: "2026-09-29-loveless-print-edition", label: "Print-ready edition" }
          ]
        },
        {
          id: "staples-buckled",
          date: "2026-09-29",
          type: "problem",
          title: "The staples buckled",
          summary: "A normal stapler couldn't get cleanly through the fold of 16 sheets.",
          context: "It printed on white paper, not the ivory I'd planned, which was fine because the pages have no background colour. Folded, it was too thick: three staples crumpled beside the fold instead of sitting in it. I had no long-reach stapler and didn't want to sew it.",
          options: [
            { text: "Sew it with a simple 3-hole stitch", chosen: false, note: "Strong, but I didn't want to sew." },
            { text: "Glue each sheet along its fold", chosen: false, note: "Works, but fiddly with 16 sheets." },
            { text: "Keep it stapled, and work out a better way", chosen: true, note: "Staples were the plan, so find the right method." }
          ],
          why: "I'd also made a patterned soft cover (black damask on kraft), and the hardback went on hold. The question became how to staple booklet and cover into one thing, and I wrote it up for the friend I share the project with.",
          outcome: "The open question was written up with the tool, staple size, cover size and order all spelled out, plus photos.",
          sources: [
            { type: "git", ref: "4b3f6b3", label: "Photos and the stapling question" },
            { type: "claude", ref: "2026-09-29-physical-projects-repo-restructure", label: "Repo setup and photos" }
          ]
        },
        {
          id: "finished",
          date: "2026-10-06",
          type: "release",
          title: "Finished: stapled down the spine",
          summary: "I stapled it down the middle of the spine fold, and the book was done.",
          context: "The stapling question had been open for a week.",
          outcome: "The book is complete. The hardback case stays on hold indefinitely, and the project moved to the finished pile.",
          sources: [
            { type: "git", ref: "eb3e80f", label: "LOVELESS book finished" },
            { type: "claude", ref: "2026-10-06-latest-android-apks", label: "Physical projects tidy-up" }
          ]
        }
      ],

      lessons: [
        { title: "Change the medium, not the goal", text: "When image generation said no, drawing the engravings in code got a better fit for an old book anyway." },
        { title: "Build for the printer you have", text: "The copier couldn't staple down a fold, so the book was laid out again for one big fold." },
        { title: "Look at the real thing", text: "A backwards bow and buckled staples only showed up by looking at the plate and holding the book." },
        { title: "Finished beats perfect", text: "The hardback is on hold. A stapled booklet I actually have beats a case I never build." }
      ],

      focus: "Nothing. The book is finished, and the hardback case is on hold indefinitely.",
      next: [
        "If there's ever a second edition, redraw the two weakest plates: the Act III tree and the Wanderer medallion",
        "Maybe a proper hardback case one day"
      ]
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
    },
    {
      slug: "sonic-laptop",
      name: "Sonic laptop",
      icon: "💍",
      hue: 220,
      tagline: "An old Dell laptop turned into a Sonic show piece, themed from boot screen to terminal. A lid display and LED underglow are next.",
      summary: "I have a 2013 Dell Latitude that I keep for one reason: it looks cool. It runs MX Linux, and it's now a Sonic machine from the boot menu to the terminal, with a live Green Hill wallpaper behind it all. Next is a small screen on the lid and LED underglow under it, both planned but not bought yet.",
      status: "building",
      featured: true,
      kind: "Personal",
      categories: ["Hardware", "Linux"],
      started: "2026-09-28",
      technologies: ["MX Linux", "Bash", "Python", "QML", "ESP32-S3"],
      repo: null,
      claudeProject: "Physical projects",
      commits: 3,
      sessions: 4,

      evolution: [
        { label: "The idea", text: "A cheap colour screen taped to the back of an old laptop's lid, playing loops." },
        { label: "First build", text: "The laptop itself: key-click sounds, a screen that never sleeps and Sonic games, all set up over SSH." },
        { label: "What got in the way", text: "My plans assumed Windows. The laptop runs MX Linux with no systemd, and lots of tools don't work on Wayland." },
        { label: "Change of direction", text: "It became a whole Sonic machine, with the lid display and an underglow as parts of one project." },
        { label: "Now", text: "Theme items 1 to 18 are live. The lid display and underglow are one planned order, nothing bought yet." }
      ],

      events: [
        {
          id: "lid-screen-idea",
          date: "2026-09-28",
          type: "decision",
          title: "A cheap screen for the back of the lid",
          summary: "The first idea: a small colour screen taped to the lid, playing loops. Cheap, no soldering, and visible wires are fine.",
          context: "It's decoration, not a second monitor. Low cost and a cool effect mattered more than a clean build.",
          options: [
            { text: "A Nextion display", chosen: false, note: "The ones that can play animation cost too much, and it needs its own USB adapter." },
            { text: "An ESP32 \"Cheap Yellow Display\"", chosen: false, note: "Board and screen in one, but I don't need its touchscreen or SD card." },
            { text: "An ESP32-S3 SuperMini and a separate 2.8\" screen", chosen: true, note: "Cheapest on paper, small, and the board has native USB." }
          ],
          why: "Cheap and simple came first. Buying parts with the pins already fitted keeps it solder-free: just jumper wires.",
          sources: [
            { type: "note", ref: "lid_display/Laptop_Lid_Looping_Display_Project_Handoff.md", label: "My original brief" }
          ]
        },
        {
          id: "stream-not-store",
          date: "2026-09-29",
          type: "decision",
          key: true,
          title: "Keep the S3 even when the all-in-one got cheaper",
          summary: "Shipping from three stores took A$17 of parts to about A$33. The all-in-one board was now about A$29, and I stayed with the S3 anyway.",
          context: "Checking every listing live showed the shipping almost doubled the cost. That broke my own rule to re-compare once it went over A$30.",
          options: [
            { text: "Switch to the Cheap Yellow Display", chosen: false, note: "A few dollars less. Its USB chip is too slow to stream, so clips would have to live on an SD card." },
            { text: "Stay with the S3 and stream from the laptop", chosen: true, note: "A bit dearer, but native USB lets the laptop send frames as it plays." }
          ],
          why: "With streaming, the laptop does the decoding and compression, and the board just shows what it's sent. New animations never need the board reflashed. That's worth a few dollars.",
          outcome: "\"Smart laptop, dumb board\" became the rule for the whole project, and the underglow uses it too. USB speed is the expected limit, around 5 frames a second before compression. That's still an estimate until the parts arrive.",
          lesson: "Compare delivered prices, not item prices.",
          sources: [
            { type: "claude", ref: "2026-09-29-laptop-lid-display-hardware-and-plan", label: "Lid display parts and plan" },
            { type: "note", ref: "lid_display/Laptop_Lid_Display_Design_Plan.md", label: "Lid display design plan" }
          ]
        },
        {
          id: "wrong-os",
          date: "2026-09-29",
          type: "problem",
          title: "The plan was written for the wrong OS",
          summary: "My brief assumed Windows. The laptop actually runs MX Linux, with no systemd and Python locked down.",
          context: "I turned SSH on so the laptop could be checked from my main laptop. It uses sysvinit instead of systemd, KDE Plasma runs on Wayland, Python packages have to come from apt, and a modem service grabs any new serial device, which is known to break ESP32 uploads.",
          outcome: "Only the laptop side of the plan changed. Autostart is a cron job at boot with a restart loop instead of Task Scheduler, every package comes from apt, and a udev rule keeps the modem service off the board. The boards and wiring stayed the same.",
          sources: [
            { type: "claude", ref: "2026-09-29-laptop-lid-display-mx-linux-host", label: "Lid display on MX Linux" }
          ]
        },
        {
          id: "undo-log",
          date: "2026-09-29",
          type: "decision",
          key: true,
          title: "Every change gets an undo",
          summary: "Everything on the laptop is set up over SSH, and every change goes in one doc: what it is, where it lives, whether it's checked, and how to undo it.",
          context: "I wasn't sitting at the laptop while most of it was changed, and some changes touch boot files and system settings.",
          options: [
            { text: "Just make the changes", chosen: false, note: "Faster, but after a day of tweaks nobody knows what was touched." },
            { text: "Log each change with how to undo it", chosen: true, note: "Slower, but anything can be rolled back." }
          ],
          why: "It's the only way to trust a setup I mostly didn't watch happen. It also keeps the trade-offs written down where I'll see them later.",
          outcome: "The machine handoff lists every change. Each one is marked as checked from the command line, or still waiting for me to look or listen. Every theme part backs up the originals and has its own uninstall script.",
          sources: [
            { type: "note", ref: "machine/Machine_Handoff.md", label: "Machine handoff" },
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" }
          ]
        },
        {
          id: "key-clicks",
          date: "2026-09-29",
          type: "deadend",
          title: "Key-click sounds that couldn't hear the keys",
          summary: "The packaged mechanical-keyboard sound app only works on X11. On my Wayland desktop it would have stayed silent in almost every app.",
          context: "It was installed, found to be the wrong build, and removed again.",
          outcome: "I built the same app from source with a backend that reads the keyboard directly, so it works on Wayland, X11 and the text console. The catch: reading the keyboard directly needs extra permissions. Fine on a show laptop, never on one with anything personal.",
          lesson: "On Wayland, check that a tool actually works there before installing it.",
          sources: [
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" },
            { type: "note", ref: "machine/Machine_Handoff.md", label: "Machine handoff" }
          ]
        },
        {
          id: "art-stays-local",
          date: "2026-09-29",
          type: "decision",
          key: true,
          title: "The Sonic art never leaves the laptop",
          summary: "The theme is built on the laptop itself, from a Sonic fan game installed there. The repo only holds the code.",
          context: "The theme needed real Sonic sprites, fonts and sounds. Sonic Robo Blast 2 was already installed on the laptop, and its files have all of them.",
          options: [
            { text: "Copy the art into the repo", chosen: false, note: "Simplest, but it's SEGA's art and the repo is shared with a friend." },
            { text: "Draw everything in code", chosen: false, note: "No rights issues, but it would never look or sound like the game." },
            { text: "Draw the scenery, pull the rest from the game at build time", chosen: true, note: "Real sprites and sounds, and the repo stays clean." }
          ],
          why: "The characters aren't mine to share. Keeping only the extraction code in the repo means the laptop can rebuild everything, and nothing copyrighted gets passed around.",
          outcome: "Green Hill scenery is pixel art drawn in code. Sonic, the rings, the HUD digits, the title-card font and every sound come out of the game files on the laptop.",
          sources: [
            { type: "note", ref: "theme/Sonic_Theme_Plan.md", label: "Sonic theme plan" },
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" }
          ]
        },
        {
          id: "lock-screen-wallpaper",
          date: "2026-09-29",
          type: "decision",
          title: "The lock screen is really a wallpaper",
          summary: "One animated wallpaper plugin draws both the desktop and the lock screen's \"CONTINUE?\" scene.",
          context: "I wanted a lock screen to match the login screen, and a desktop that changes from day to sunset to night with the real sunrise and sunset times.",
          options: [
            { text: "A custom lock screen", chosen: false, note: "Plasma only loads one in test mode. Forcing it means replacing the whole desktop shell, which breaks on updates." },
            { text: "A timed script that swaps wallpaper images", chosen: false, note: "Works, but needs something running in the background all the time." },
            { text: "One animated wallpaper plugin with two modes", chosen: true, note: "Supported by Plasma, can animate, and if it breaks the lock screen still works." }
          ],
          why: "Using the supported hook means it survives Plasma updates, and a broken wallpaper can't lock me out.",
          sources: [
            { type: "note", ref: "theme/README.md", label: "Theme README" },
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" }
          ]
        },
        {
          id: "reboot-surprises",
          date: "2026-09-29",
          type: "problem",
          title: "The first reboots broke two things",
          summary: "After one reboot the internet was gone. After another, the key-click sounds didn't come back.",
          context: "A VPN profile that was already on the laptop connected by itself at boot to a server that never answered, and sent all traffic into it. The home network still worked, so SSH could find it. Later, an unplanned reboot showed the key-click app was starting before the sound system was ready, then giving up.",
          outcome: "The VPN's autoconnect is off and the profile is kept. The key-click autostart now waits and retries, with the sound itself unchanged. After the next reboot, the key clicks, the idle screen and the system monitor all came back by themselves.",
          lesson: "A reboot is a test. Some problems only show up on the first boot after a change.",
          sources: [
            { type: "note", ref: "machine/Machine_Handoff.md", label: "Machine handoff" },
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" }
          ]
        },
        {
          id: "theme-live",
          date: "2026-09-29",
          type: "milestone",
          title: "The whole machine goes Sonic",
          summary: "In one day: boot menu, boot splash, login, desktop, sounds, system monitor, browser, terminal and an idle attract mode. 18 of the 21 theme items.",
          context: "Each boot screen is a different time of day, so starting up reads as a sequence. The login screen shows each password character as a spinning ring. Notifications play the ring sound, plugging in a USB stick plays the 1-up, and after 3 idle minutes Sonic taps his foot full-screen.",
          outcome: "Later that afternoon the wallpaper went live: clouds drift, the water shimmers, a bird flies over, and Sonic dashes across the grass on a loop. Everything steps at 10 frames a second in 2-pixel jumps, to stay light on a 2013 laptop with 4 GB of RAM. Each piece was tried in a throwaway desktop on a virtual screen before going live.",
          sources: [
            { type: "note", ref: "theme/README.md", label: "Theme README" },
            { type: "claude", ref: "2026-09-29-mx-aura-laptop-setup", label: "Laptop setup and Sonic theme" }
          ]
        },
        {
          id: "one-project",
          date: "2026-09-29",
          type: "refactor",
          title: "Two projects, one laptop",
          summary: "The laptop setup and the lid display were separate folders. They're the same machine, so they became one project, shared as a private repo with a friend.",
          context: "I wanted a friend to read it and help with questions and ideas, so it had to make sense to a newcomer.",
          outcome: "One folder per part (machine, theme, lid display, underglow, phone control), one shared hardware list, and a front page that says what's done and where ideas would help. Private details moved to a file git ignores. No game art is in the repo.",
          sources: [
            { type: "git", ref: "32b66c1", label: "Initial commit" },
            { type: "claude", ref: "2026-09-29-physical-projects-repo-restructure", label: "Shared repo restructure" }
          ]
        },
        {
          id: "base-plate",
          date: "2026-09-29",
          type: "direction",
          key: true,
          title: "The cover stays off, so the underglow moves to a base plate",
          summary: "The laptop keeps its bottom cover and screen bezel off for good. The LED strip now goes under a clear acrylic plate the laptop sits on.",
          context: "Earlier that day I planned an LED strip under the laptop, driven by a second ESP32-S3 so no wires flex across the hinge. That plan stuck the strip to the bottom cover. The cover isn't going back on, and the open underside was sitting straight on carpet.",
          options: [
            { text: "Strip under the bottom cover", chosen: false, note: "The first plan. There's no cover any more." },
            { text: "Strip along the laptop's side walls", chosen: false, note: "Edge glow, not underglow. The ports are there, and it does nothing for the open underside." },
            { text: "A clear acrylic plate the laptop sits on", chosen: true, note: "Nothing stuck to the laptop, the fan keeps its air, and the open insides get lit from below." }
          ],
          why: "One plate fixes two problems: the exposed board stops sitting on carpet, and the internals become part of the show. It also lets the strip run as a full loop instead of a U round the back ports.",
          outcome: "Planned only. The lid display and underglow are one order of about A$61, plus an acrylic sheet cut locally. Nothing is bought yet.",
          sources: [
            { type: "git", ref: "4b3f6b3", label: "Underglow on a base plate" },
            { type: "note", ref: "underglow/Underglow_Plan.md", label: "Underglow plan" },
            { type: "claude", ref: "2026-09-29-physical-projects-repo-restructure", label: "Shared repo restructure" }
          ]
        }
      ],

      lessons: [
        { title: "Write down the undo", text: "Logging every change with how to reverse it is what makes an SSH-only setup something I can trust." },
        { title: "Check Wayland first", text: "Lots of classic Linux eye candy is X11-only. The packaged key-click app would have been silent." },
        { title: "Delivered price, not item price", text: "Shipping from three stores nearly doubled A$17 of parts." },
        { title: "Use the supported hook", text: "The lock screen is a wallpaper plugin because that's what survives updates, and fails safe." }
      ],

      focus: "Ordering the lid display and underglow parts together, then getting the lid screen working on the bench before anything gets taped down.",
      next: [
        "Order the parts (about A$61) and get a clear acrylic sheet cut",
        "Get a first animation on the lid screen and measure the real USB speed",
        "Finish the last theme items: matching lid content and some physical touches"
      ]
    },
    {
      slug: "book-computer",
      name: "Book computer",
      icon: "📚",
      hue: 95,
      tagline: "A small Linux tablet hidden in a cardboard book: touchscreen on one page, computer and battery in the other.",
      status: "idea",
      kind: "Personal",
      categories: ["Hardware"],
      started: "2026-09-29",
      technologies: ["Raspberry Pi", "Linux"],
      repo: null,
      claudeProject: "Physical projects"
    },
    {
      slug: "smart-glasses",
      name: "Smart glasses",
      icon: "👓",
      hue: 175,
      tagline: "See-through text HUD glasses driven by my assistant, Sonic, on a hard A$100 budget. Still researching.",
      status: "idea",
      kind: "Personal",
      categories: ["Hardware", "AI"],
      started: "2026-10-01",
      technologies: ["ESP32"],
      repo: null,
      claudeProject: "Physical projects"
    },
    {
      slug: "claire",
      name: "Claire",
      icon: "💜",
      hue: 345,
      tagline: "A local AI companion with her own memory, a voice and a 3D avatar. Nothing leaves my laptop.",
      status: "improving",
      kind: "Personal",
      categories: ["AI"],
      started: "2026-09-21",
      technologies: ["Python", "Ollama", "Flask", "faster-whisper", "Kokoro", "VRM"],
      repo: { private: true },
      claudeProject: "Claire"
    },
    {
      slug: "iris",
      name: "Iris",
      icon: "🎙️",
      hue: 300,
      tagline: "A real-time voice assistant: you talk, she answers out loud, and you can cut her off mid-sentence. Runs fully offline.",
      status: "usable",
      kind: "Personal",
      categories: ["AI"],
      started: "2026-09-23",
      technologies: ["Python", "Pipecat", "Whisper", "Ollama", "Kokoro"],
      repo: { private: true },
      claudeProject: "Iris"
    },
    {
      slug: "sonic",
      name: "Sonic",
      icon: "🦔",
      hue: 240,
      tagline: "My own assistant on the home server. It wakes up when I open it and goes back to sleep after ten idle minutes.",
      status: "usable",
      kind: "Personal",
      categories: ["AI"],
      started: "2026-09-20",
      technologies: ["Python", "FastAPI", "Ollama", "systemd"],
      repo: null,
      claudeProject: "Sonic"
    },
    {
      slug: "gaming-archive",
      name: "SONIC Gaming Archive",
      icon: "🎮",
      hue: 120,
      tagline: "My PS5 streams, transcribed and summarised overnight by the home server into a gaming journal.",
      status: "paused",
      kind: "Personal",
      categories: ["AI", "Gaming"],
      started: "2026-10-21",
      technologies: ["Python", "faster-whisper", "RapidOCR", "Ollama"],
      repo: null,
      claudeProject: "Gaming Archive"
    },
    {
      slug: "apex-dash",
      name: "Apex Dash",
      icon: "🏎️",
      hue: 8,
      tagline: "An arcade racer built from scratch in the browser: ten drivers, ten circuits, no power-ups, just grip and drift boosts.",
      summary: "I wanted an arcade racer of my own. Apex Dash has ten circuits and ten drivers in proper cars, with no power-ups: drifting, drift boosts and a good start do the work. It runs in the browser, as an Android app, and on my home server. Some of the art isn't mine, so the game stays private.",
      status: "building",
      featured: true,
      kind: "Personal",
      categories: ["Game", "Web", "Android"],
      started: "2026-10-13",
      technologies: ["TypeScript", "Three.js", "Vite", "Kotlin"],
      repo: null,
      claudeProject: "Apex Dash",
      commits: 8,
      sessions: 5,

      evolution: [
        { label: "The idea", text: "A simple arcade racer of my own: proper cars, ten circuits, ten drivers, no power-ups." },
        { label: "First build", text: "Flat tracks drawn in real 3D in the browser. Playable on the first day, with 41 automated tests." },
        { label: "What got in the way", text: "Some of the art isn't mine, so it can't go public. And nobody has judged the feel by hand yet." },
        { label: "Beyond the PC", text: "The same code became an Android app, and a copy runs on my home server for the home Wi-Fi." },
        { label: "Now", text: "Playable on PC, phone and the home network. Waiting on a real feel test and a fix for the AI start." }
      ],

      events: [
        {
          id: "cars-no-power-ups",
          date: "2026-10-13",
          type: "decision",
          key: true,
          title: "Proper cars, and no power-ups",
          summary: "A simple arcade racer: ten circuits, ten drivers, and winning comes from driving, not items.",
          context: "Kart racers usually mean small karts and random items. I wanted something simpler, with real cars.",
          options: [
            { text: "Karts with power-ups", chosen: false, note: "The usual mix, but more random and a lot more to build." },
            { text: "Proper cars, no power-ups", chosen: true, note: "Racing comes down to grip, drifting and the start." }
          ],
          why: "Without items, the only ways to get ahead are driving well, charging drift boosts and nailing the start. That keeps the game easy to understand.",
          outcome: "The cars are ten free Kenney models (CC0), repainted in each driver's colours. Drifting charges a three-level boost. Pressing the accelerator in the last half-second before GO gives a rocket start; too early and you stall.",
          sources: [
            { type: "git", ref: "a4347dd", label: "Asset pipeline, tracks, core simulation" },
            { type: "claude", ref: "2026-10-13-gamedevelopment-arcade-racer-feasibility", label: "Feasibility and first build" }
          ]
        },
        {
          id: "real-3d",
          date: "2026-10-13",
          type: "decision",
          key: true,
          title: "Real 3D instead of a 2D engine",
          summary: "The plan said Phaser, a 2D engine. The game was built in Three.js, with the tracks and physics still flat.",
          context: "I wanted it to look newer and fancier than a retro racer: glossy cars, real lighting, shadows and reflections.",
          options: [
            { text: "Phaser with a fake-3D road, as planned", chosen: false, note: "Simpler, but no real lighting, shadows or 3D cars." },
            { text: "Three.js, real 3D with flat tracks", chosen: true, note: "Modern lighting and bloom, while the physics stays simple and 2D." }
          ],
          why: "The look I asked for needs a real 3D renderer, and Phaser would have meant building one. Keeping the tracks flat kept the driving model simple.",
          outcome: "A chase camera, bloom, weather and a theme per circuit, from seaside to snow to a space station. Headless tests ran it at 41 to 61 fps on a laptop with only built-in graphics.",
          sources: [
            { type: "git", ref: "d0bcc87", label: "3D renderer, UI, audio, menus" },
            { type: "claude", ref: "2026-10-13-gamedevelopment-arcade-racer-feasibility", label: "Feasibility and first build" }
          ]
        },
        {
          id: "track-shapes",
          date: "2026-10-13",
          type: "deadend",
          title: "Tracks that wouldn't close",
          summary: "Two ways of describing the circuits bent their shapes, so both were dropped.",
          context: "The first tracks were described turn by turn. Small errors meant the loop didn't quite meet its start, so the error was spread around the lap, and then a best-fit was used to close it. Both distorted the shapes.",
          outcome: "Each track is now a closed shape with a radius at every corner, so it always closes exactly. A script writes the tracks as plain data files, and tests check corner radius, the gap between parts of the track, and length.",
          lesson: "If a shape has to close, build it closed instead of patching it afterwards.",
          sources: [
            { type: "git", ref: "a4347dd", label: "Asset pipeline, tracks, core simulation" },
            { type: "claude", ref: "2026-10-13-gamedevelopment-arcade-racer-feasibility", label: "Feasibility and first build" }
          ]
        },
        {
          id: "first-build",
          date: "2026-10-13",
          type: "milestone",
          title: "Playable on the first day",
          summary: "Ten circuits, ten drivers, Grand Prix, Quick Race and Time Trial, with AI rivals and a full test suite.",
          context: "The AI follows a racing line with braking points and rubber-banding to keep races close. One rule from the start: the AI doesn't judge the feel of the driving, I do. Every handling number lives in one config file, with live sliders in a race.",
          outcome: "41 automated tests, including a full 8-car AI race on every track. All ten cars are within 1.6% of each other on average lap time. Screenshots of every screen found bloom washing everything out, headlight beams turning night roads white, oversized tyre smoke and result dialogs hidden under the HUD. All fixed.",
          lesson: "Screenshots caught what the unit tests couldn't see.",
          sources: [
            { type: "git", ref: "a4347dd", label: "Asset pipeline, tracks, core simulation" },
            { type: "git", ref: "d0bcc87", label: "3D renderer, UI, audio, menus" },
            { type: "git", ref: "a646d6c", label: "Docs, launcher, UI polish" }
          ]
        },
        {
          id: "docs",
          date: "2026-10-14",
          type: "milestone",
          title: "Written down so I can come back to it",
          summary: "Architecture notes, how-to recipes and a roadmap, including the traps found so far.",
          context: "The README covered playing and testing. Nothing explained how the code fits together, or traps like the track select assuming exactly ten tracks.",
          outcome: "There are now recipes for tuning the feel, editing or adding a track, and checking a change. There's also one for replacing the art that isn't mine, in case the game ever needs to go public.",
          sources: [
            { type: "git", ref: "b8cb90c", label: "Developer docs" },
            { type: "claude", ref: "2026-10-14-apex-dash-docs", label: "Developer docs" }
          ]
        },
        {
          id: "android",
          date: "2026-10-17",
          type: "decision",
          key: true,
          title: "Android: wrap the same game, don't rewrite it",
          summary: "The Android app is a thin wrapper that runs the browser game, so there is only one copy of the game.",
          context: "I wanted to play it on my phone. The game was already a browser game.",
          options: [
            { text: "A separate native Android game", chosen: false, note: "A second copy of the game that would drift apart from the PC one." },
            { text: "An app that runs the web game inside it", chosen: true, note: "One codebase: every fix or new track lands in both." }
          ],
          why: "Keeping one game mattered more than squeezing out native speed. Touch controls and the phone layout live in the shared code and only switch on for touch screens, so the PC version didn't change.",
          outcome: "A floating steering stick (or buttons, or tilt), GAS, BRAKE and DRIFT pads a thumb can slide between, and auto-accelerate from GO. Menus scale down to fit a phone. The app works fully offline, with no internet permission.",
          sources: [
            { type: "git", ref: "ccec783", label: "Touch controls and phone layout" },
            { type: "git", ref: "fd1925b", label: "Android app" },
            { type: "claude", ref: "2026-10-17-apex-dash-android", label: "Android build" }
          ]
        },
        {
          id: "phone-bugs",
          date: "2026-10-17",
          type: "problem",
          title: "Taps that went nowhere",
          summary: "Two bugs only showed up in phone mode, and the emulator couldn't say how fast it really runs.",
          context: "The touch controls layer shared a class name with the page itself, so its styles hit the whole page and swallowed every tap. On the Android emulator, the pause and arrow symbols also drew wrongly with Android's fonts.",
          outcome: "The class was renamed and the symbols became drawn icons. The emulator only managed about 7 fps with software graphics, which says nothing about a real phone, so speed on my phone is still untested.",
          lesson: "Each new screen needs its own check. Both bugs were invisible on the PC.",
          sources: [
            { type: "git", ref: "fd1925b", label: "Android app" },
            { type: "claude", ref: "2026-10-17-apex-dash-android", label: "Android build" }
          ]
        },
        {
          id: "trailer",
          date: "2026-10-20",
          type: "milestone",
          title: "A three-minute trailer",
          summary: "The menus and every circuit in 1080p at 60 fps, with captions and the game's own sound, without changing the game.",
          context: "I wanted a video good enough to show people. It has the same art as the game, so it stays private too.",
          outcome: "The laptop renders slower than real time, so the page's clock was stepped one frame at a time and each frame captured. That gives smooth 60 fps however slow the rendering is. Sound can't be recorded that way, so every sound the game played was logged and mixed again afterwards. The mix was checked by levels only, not by ear yet.",
          lesson: "If the machine can't keep up, control the clock instead of fighting the frame rate.",
          sources: [
            { type: "claude", ref: "2026-10-20-apex-dash-trailer", label: "Trailer" }
          ]
        },
        {
          id: "ai-stall",
          date: "2026-10-20",
          type: "problem",
          title: "Every AI car stalls at the start",
          summary: "Found while making the trailer: all seven AI cars stall at every race start. Not fixed yet.",
          context: "Pressing the accelerator too early before GO stalls your car. The AI holds full throttle through the whole countdown, so it stalls every time, for 0.7 seconds.",
          outcome: "Any player who doesn't stall leads by the first corner. The fix idea is for the AI to press the accelerator at a random moment in the last second or so. Also found: a car right behind mine can hide it from the chase camera.",
          lesson: "The tests ran full AI races on every track and never flagged it, because every AI car stalled equally. Watching closely found it.",
          sources: [
            { type: "claude", ref: "2026-10-20-apex-dash-trailer", label: "Trailer" }
          ]
        },
        {
          id: "home-server",
          date: "2026-10-21",
          type: "decision",
          key: true,
          title: "On the home network, not the public site",
          summary: "The game runs on my home server and the website links to it. No game files go on the website.",
          context: "I asked whether Apex Dash could run inside my website. Technically that's easy: it builds to plain static files. But the website is public, and some of the art in the game isn't mine.",
          options: [
            { text: "Put the game on the website", chosen: false, note: "Easiest, but it would publish art that isn't mine." },
            { text: "Replace that art and sound so it can be public", chosen: false, note: "A big job, and the game would look and sound different." },
            { text: "Host it on the home server, link to it from the website", chosen: true, note: "About half an hour, and the game stays as it is." }
          ],
          why: "Keeping the game as it is mattered more than making it public. Showing it inside a website page wasn't possible anyway: the website is HTTPS and the home server is plain HTTP, so browsers block it.",
          outcome: "It loads and races with no errors, and the website card shows whether it's online. Tilt steering doesn't work through the link, because browsers hide motion sensors from plain-HTTP pages. The stick and buttons work, and the Android app still has tilt.",
          sources: [
            { type: "git", ref: "43c8cc6", label: "Host the game on the home server" },
            { type: "claude", ref: "2026-10-21-apex-dash-on-home-server", label: "On the home server" }
          ]
        }
      ],

      lessons: [
        { title: "One game, many places", text: "Wrapping the browser game for Android, instead of rewriting it, means every fix lands everywhere." },
        { title: "Look at it", text: "Screenshots found the washed-out bloom, white night roads and hidden dialogs that no unit test could." },
        { title: "Build it right by design", text: "Tracks made as closed shapes always close. Patching the error afterwards only bent them." },
        { title: "Equal bugs hide", text: "Every AI car stalling at the start never failed a test, because it hit all of them the same." }
      ],

      focus: "Playing it myself, on the PC and on my phone, to judge the feel before changing any numbers.",
      next: [
        "Fix the AI cars stalling at every race start",
        "Try it on my real phone: frame rate, and how the stick and tilt feel",
        "Teach the AI to drift, so hard difficulty is a real challenge"
      ]
    },
    {
      slug: "staysafe",
      name: "StaySafe",
      icon: "🛡️",
      hue: 55,
      tagline: "Predicted crime risk and live incident reports across Victoria, built as a team. I added a version that runs fully offline.",
      status: "usable",
      kind: "Team",
      categories: ["Web"],
      started: "2026-03-14",
      technologies: ["React", "Vite", "Leaflet", "Docker"],
      repo: { name: "Vidunixel/StaySafe", private: false },
      claudeProject: "StaySafe"
    },
    {
      slug: "music",
      name: "Singing and music",
      icon: "🎤",
      hue: 315,
      tagline: "Covers of Hindi songs over backing tracks I make myself, and now my first songs of my own.",
      status: "improving",
      kind: "Personal",
      categories: ["Music"],
      started: "2026-09-26",
      technologies: ["Audacity", "LMMS", "Python", "PowerShell"],
      repo: { name: "Partypants16/music_singing", private: true },
      claudeProject: "Music"
    }
  ]
};
