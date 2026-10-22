# Personal Website Project History System

> Parth's original proposal for the Projects section, written on 21 Oct 2026 and kept here for history. The only change from the original: three work-project names are replaced with "[work project]", because this repo is public.

## Purpose

Create a dedicated **Projects** section for the personal website that focuses heavily on **project history, evolution, reasoning, technical decisions, experiments, dead ends, and lessons learned**.

The goal is not to make a standard portfolio page that only shows finished projects. Instead, the page should act as a **development journal and project archive** showing how ideas changed over time, why technical decisions were made, what failed, what was learned, and what remains unfinished.

GitHub should be treated as one source of evidence, not as the entire project database.

---

## Core Idea

Each project should tell a story.

Instead of only showing:

- project name
- description
- technologies
- GitHub link
- completion percentage

the site should answer:

- Why was this project started?
- What problem was being solved?
- How did the project evolve?
- What technical decisions were made?
- What alternatives were considered?
- What experiments failed?
- What constraints changed the direction?
- What was learned?
- What is the current focus?
- What should happen next?

The strongest principle is:

> **Git shows what changed. The project history explains why it changed.**

---

## Sources of Project History

Each project can combine multiple evidence streams.

### 1. Git History

Git should work for both:

- GitHub-hosted repositories
- purely local repositories

Useful information can include:

- commits
- commit dates
- commit messages
- tags
- branches
- changed files
- release points
- periods of activity or inactivity

Example local command:

```bash
git log --pretty=format:"%H|%ad|%s" --date=iso
```

Git commits should be treated as **evidence**, not necessarily as individual timeline entries.

Several related commits may be grouped into one meaningful project event.

---

### 2. Claude Session Logs

Claude conversation/session logs can provide the **thinking layer** that Git cannot.

Useful information to extract includes:

- architectural discussions
- alternative approaches considered
- debugging hypotheses
- decisions and their reasoning
- mistakes or misunderstandings
- experiments
- scope changes
- constraints discovered
- abandoned approaches
- future ideas
- reasons something was deliberately not implemented

Claude logs are especially useful for reconstructing:

> what I was thinking at the time

rather than only:

> what code changed

---

### 3. Manual Notes

Some important project history may never appear in Git or Claude.

Manual entries should be allowed for:

- milestones
- hardware changes
- offline experiments
- design decisions
- planning
- project pauses
- project resumptions
- lessons learned
- external events that affected development

---

### 4. Screenshots / Demos / Releases

Visual evidence can also be attached to events.

Examples:

- UI screenshots
- hardware prototypes
- working demos
- release builds
- diagrams
- before/after comparisons

---

## Timeline as the Primary Object

The project timeline should be the main historical structure.

Instead of treating every commit as an event, timeline entries should represent meaningful developments.

Suggested event types:

- **Milestone**
- **Decision**
- **Experiment**
- **Problem**
- **Dead End**
- **Refactor**
- **Direction Change**
- **Release**
- **Pause**
- **Resume**

Example:

```text
18 Oct 2026
DECISION — Move Sonic Local to systemd

Context
Sonic was working, but manually restarting the service after failures
was becoming inconvenient.

Options considered
- shell script
- cron/watchdog
- systemd

Decision
Use systemd.

Reasoning
It provides native Linux service management, automatic restart
behaviour, startup on boot, and logging.

Evidence
- Git commit abc123
- Claude session from 18 Oct 2026

Outcome
Sonic now starts automatically and can recover after failure.
```

---

## Do Not Turn the Timeline Into a Git Log

A major design rule:

> **A commit is evidence. A project event is the meaningful unit.**

For example, these commits:

```text
fix API route
change model config
reduce timeout
update requirements
fix startup bug
```

may become one timeline event:

```text
Improved local inference reliability

Problem
Requests were intermittently timing out.

What I tried
- reduced context size
- changed Ollama model
- adjusted API timeout behaviour

Outcome
The smaller model produced more consistent response times.

Related commits
- abc123
- def456
- ghi789
```

---

## Suggested Project Page Structure

Each project page could contain:

### Overview

Short explanation of what the project is and why it exists.

### Current Status

Suggested lifecycle:

```text
Idea → Planning → Building → Usable → Improving → Complete → Archived
```

This is preferable to relying on arbitrary completion percentages.

### Evolution

A short summary of the project's overall journey.

Example:

```text
Original idea
A local version of Sonic running an LLM.

↓

First implementation
Ollama + FastAPI on Ubuntu.

↓

Constraint discovered
Large models were impractical on the target hardware.

↓

Direction changed
Prioritised lightweight inference and reliability.

↓

Current direction
Persistent local assistant with automatic recovery and network access.
```

### Timeline

Full chronological project history.

### Key Decisions

Important architecture or design decisions extracted from the timeline.

### Experiments and Dead Ends

Attempts that failed or were abandoned.

These are valuable because they preserve learning that would otherwise disappear.

### What I Learned

Technical and professional lessons gained from the project.

Example:

```text
- running LLMs on constrained CPU hardware
- Linux service management
- FastAPI fundamentals
- network binding
- SSH tunnelling
- model/resource trade-offs
```

### Current Focus

What is actively being worked on now.

### Next Steps

Specific future work.

### Technologies

Languages, frameworks, platforms, hardware, tools, and services used.

### Sources / Evidence

Links or references to:

- Git commits
- Claude sessions
- screenshots
- notes
- releases

---

## Public vs Detailed History

There should ideally be two conceptual levels of detail.

### Public Project View

Clean and readable.

Contains:

- overview
- major timeline events
- key decisions
- lessons learned
- current status
- screenshots
- GitHub/demo links where appropriate

### Detailed / Personal History

Much richer.

Can contain:

- all project events
- raw Git references
- Claude session references
- experiments
- debugging notes
- dead ends
- private local repository information
- personal notes

This is especially important for work-related or private projects.

Sensitive employer or internal information must not be published.

---

## Project Classification

Each project should have a small amount of structured metadata.

Suggested fields:

```text
Name
Slug
Status
Visibility
Category
Professional / Personal
Started
Last Updated
Technologies
Repository Type
Repository Location
Summary
Current Focus
```

Suggested values:

### Status

- Idea
- Planning
- Building
- Usable
- Improving
- Paused
- Complete
- Archived

### Visibility

- Public
- Private

### Repository Type

- GitHub
- Local Git
- No Repository

### Category

Possible examples:

- Software
- Web
- AI
- Automation
- Azure
- PowerShell
- Hardware
- 3D Printing
- Design
- Experiment

---

## Featured Projects vs Full Archive

Not every project needs a large polished page.

The site should support two levels.

### Featured Projects

Rich pages with:

- screenshots
- detailed timelines
- decisions
- lessons
- demonstrations

### Project Archive

Compact historical index.

Example:

```text
2026
────────────────────────────────────────

Sonic Local                 Active      Python / AI
SkyWardrobe                 Paused      JavaScript / Android
[work project]              Active      Azure / KQL
Nextion Laptop Display      Planning    Hardware
LOVELESS Prop Book          Active      Design / 3D Print
```

This allows many small projects and experiments to be recorded without cluttering the site.

---

## Data Model

The website should not hard-code every project directly into HTML.

Instead, project information should live in structured data files.

Possible format:

```json
{
  "name": "Sonic Local",
  "slug": "sonic-local",
  "status": "improving",
  "visibility": "private",
  "started": "2026-08",
  "updated": "2026-10-18",

  "repository": {
    "type": "local",
    "path": "D:/Projects/Sonic"
  },

  "technologies": [
    "Python",
    "FastAPI",
    "Ollama",
    "Ubuntu"
  ],

  "summary": "A locally hosted personal AI assistant.",

  "currentFocus": "Improving reliability and model performance.",

  "events": [
    {
      "date": "2026-08-06",
      "type": "decision",
      "title": "Expose Sonic over the LAN",
      "summary": "Moved from localhost-only access to LAN availability.",
      "reasoning": "Wanted Sonic accessible from multiple devices without relying on SSH tunnelling.",
      "sources": [
        {
          "type": "claude",
          "session": "Building Local AI Assistant"
        },
        {
          "type": "git",
          "commit": "abc123"
        }
      ]
    }
  ]
}
```

The website should render from this project data rather than manually duplicating project information throughout the HTML.

---

## Proposed Ingestion Pipeline

Long term, the project history could be partially automated.

```text
Git History ────────────┐
                        │
Claude Session Logs ────┤
                        │
Manual Notes ───────────┼──> Project History Processor
                        │
Screenshots / Releases ─┤
                        │
Project Metadata ───────┘
           ↓
      project.json
           ↓
      Personal Website
```

The processor could:

1. read local or GitHub Git history
2. parse Claude session logs
3. identify candidate milestones and decisions
4. group related commits
5. generate suggested timeline events
6. link events back to original sources
7. output structured project data

Manual review should remain part of the process.

---

## Important Historical Integrity Rule

AI-generated summaries should never silently become the historical source of truth.

There should be a clear distinction between:

### Source Material

What was actually:

- said
- committed
- tested
- written
- recorded

### Generated Interpretation

A concise summary created from that evidence.

Every generated event should ideally retain references to the underlying evidence.

Example:

```text
Sources

Git
- abc123
- def456

Claude
- Session: Building Local AI Assistant
- 6 Aug 2026
```

This makes it possible to revisit the original context later.

---

## Possible Website Navigation

```text
Home
About
Projects
Certificates
Gaming
Sports
...
```

Inside Projects:

```text
Projects
│
├── Overview / Statistics
├── Filters
├── Featured Projects
├── All Projects / Archive
└── Project Page
     ├── Overview
     ├── Evolution
     ├── Status
     ├── Technologies
     ├── Timeline
     ├── Key Decisions
     ├── Experiments / Dead Ends
     ├── What I Learned
     ├── Current Focus
     ├── Next Steps
     ├── Screenshots
     └── Sources
```

---

## Possible Homepage / Projects Dashboard

Example:

```text
PROJECTS

A record of things I've built, experimented with,
abandoned, completed and continued improving.

12 Projects        3 Active        6 Completed        3 Paused

[ All ] [ Active ] [ Completed ] [ Paused ] [ Archived ]
```

---

## Projects That Could Benefit From This Format

Potential examples include:

- Sonic Local
- StaySafe
- SkyWardrobe
- Personal Website
- [work project]
- [work project]
- [work project]
- Nextion laptop display project
- LOVELESS prop book
- PowerShell experiments
- 3D printing projects
- small local software experiments

Work-related projects should only include information that is safe and appropriate to publish.

---

## Why This Approach Is Valuable

This system serves several purposes at once.

### Personal Project Memory

Makes it easy to remember:

- where a project was left
- what was tried
- why a decision was made
- what still needs to happen

### Professional Development

Creates a historical record of:

- technical growth
- problem solving
- architecture decisions
- debugging
- experimentation
- lessons learned

### Portfolio

Shows more than finished output.

It demonstrates:

- reasoning
- iteration
- persistence
- technical judgement
- ability to learn from failed approaches

### Resume / Interview Preparation

The history becomes useful material for questions such as:

- Tell me about a difficult technical problem.
- Tell me about a project that changed direction.
- Describe a technical decision you made.
- Tell me about something that failed.
- What did you learn from a project?

---

## Current Direction

The strongest current direction is:

> **Make the timeline the primary object. Use Git history, local commits, Claude sessions, manual notes, screenshots, and releases as evidence feeding that timeline.**

The project should behave more like a **technical development journal** than a traditional portfolio gallery.

---

## Next Steps

When continuing this idea, the recommended order is:

1. **Define the project/event schema**
   - decide exactly what information every project and timeline event can contain

2. **Create one prototype project**
   - Sonic Local is likely a good first candidate because it already has Git history, Claude discussions, technical decisions, hardware constraints, and clear evolution

3. **Test history extraction**
   - export Git history
   - inspect Claude session logs
   - manually build a first timeline

4. **Design the Projects page UI**
   - archive view
   - project page
   - timeline
   - evolution section

5. **Build ingestion automation later**
   - Git parser
   - Claude log parser
   - timeline generation
   - evidence linking

Avoid building the automation before the data model and project page structure are proven useful.

---

## Working Principle

> **The website should preserve not only what was built, but how the project became what it is.**
