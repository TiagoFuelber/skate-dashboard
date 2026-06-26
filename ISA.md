---
project: skate-dashboard
task: Read-only responsive web dashboard for the skate system, hosted on GitHub Pages
effort: E3
phase: build
progress: 0/30
mode: algorithm
started: 2026-06-26
updated: 2026-06-26
---

## Problem

Tiago's skateboarding system is a rich, interlinked markdown knowledge base in `~/.claude/PAI/USER/SKATEBOARDING/` (trick map, wisdom, assessment, trick matrix, sessions, spots with photo galleries, sources, journal). It is only browsable as raw files in an editor — there's no pleasant way to read it on a laptop or phone, away from the terminal.

## Vision

Open a URL on phone or laptop and *browse my own skate brain* — the trick map, where I'm at, the spots with their photos — in something that feels like a clean, fast docs site. Cross-links work. Photos open big. Skill status (owned / learning / want) reads at a glance. It feels like a product, not a file dump.

## Out of Scope

No editing — strictly read-only (no auth, no write-back, no forms). No backend or database — pure static files. No live sync to the source markdown beyond a re-run of the build script. No analytics, comments, or third-party trackers. Not a generic markdown viewer — it is shaped to *this* skate system's structure.

## Principles

- The source markdown is the system of record; the dashboard is a generated read-only view (snapshot baked at build time).
- Progressive disclosure: nav groups mirror how the system actually fits together (Map → Wisdom → Assessment → Sessions → Spots → Sources → Journal).
- Mobile is a first-class target, not an afterthought — Tiago checks this at the spot, on his phone.
- Relative asset paths only — the site is served from a `/skate-dashboard/` subpath.

## Constraints

- Bun + TypeScript for the build; no npm/npx.
- Static output only — must run on GitHub Pages with zero server.
- Deploy via GitHub Actions uploading a committed `dist/` (CI cannot read the private source data, so the build runs locally and the snapshot is committed).
- All internal `.md` links and image references must resolve inside the SPA.

## Goal

A static, responsive, read-only single-page dashboard — generated from the skate markdown by `bun run build` — that renders every section with working cross-links and photo galleries, is usable on phone and laptop, and is deployed live at `https://tiagofuelber.github.io/skate-dashboard/`.

## Criteria

- [ ] ISC-1: `build.ts` exists and `bun run build` exits 0
- [ ] ISC-2: `dist/index.html`, `dist/app.js`, `dist/styles.css`, `dist/data.json` all produced
- [ ] ISC-3: data.json contains a section for every source `.md` (README, TRICKS, WISDOM, ASSESSMENT, TRICKMATRIX, SESSIONS, SPOTS, SPOTS-ORLA, SPOTS-IAPI, SOURCES, MINING)
- [ ] ISC-4: data.json includes each JOURNAL/*.md entry as a section
- [ ] ISC-5: data.json includes each Sessions/*.md log as a section
- [ ] ISC-6: every section object has non-empty `id`, `title`, `group`, `html`
- [ ] ISC-7: YAML frontmatter is stripped from rendered html (no leading `---` block visible)
- [ ] ISC-8: internal `.md` links are rewritten to `#<section-id>` hrefs (no raw `.md` hrefs remain in html)
- [ ] ISC-9: image `src` paths point to copied `assets/Attachments/...` and the files exist in dist
- [ ] ISC-10: all 31 ORLA + 24 IAPI photos copied into `dist/assets/Attachments/`
- [ ] ISC-11: sidebar nav renders grouped sections in the intended order
- [ ] ISC-12: clicking a nav item routes via `#id` and renders that section's html
- [ ] ISC-13: hashchange (back/forward, deep link) renders the correct section
- [ ] ISC-14: search box filters/finds sections by title and body text
- [ ] ISC-15: clicking a photo opens a lightbox overlay; dismiss returns to content
- [ ] ISC-16: skill-status tables are colorized by status (owned/learning/want/not-yet)
- [ ] ISC-17: layout is single-column with an off-canvas drawer at phone width (≤640px)
- [ ] ISC-18: layout is sidebar + content at laptop width (≥1024px)
- [ ] ISC-19: all asset/link paths are relative (no leading `/`), so it works under `/skate-dashboard/`
- [ ] ISC-20: `.github/workflows/deploy.yml` exists and uploads `./dist` as a Pages artifact
- [ ] ISC-21: public repo `TiagoFuelber/skate-dashboard` created and pushed
- [ ] ISC-22: GitHub Pages enabled (build_type workflow) and deploy workflow run succeeds
- [ ] ISC-23: live URL returns HTTP 200
- [ ] ISC-24: live site renders the dashboard (Interceptor screenshot shows nav + content)
- [ ] ISC-25: live site renders correctly at phone viewport (Interceptor mobile screenshot)
- [ ] ISC-26: a spot photo gallery renders images on the live site
- [ ] ISC-27: README.md documents build + redeploy steps
- [ ] ISC-28: Anti: no editing/write controls or forms appear anywhere in the UI
- [ ] ISC-29: Anti: no raw markdown link syntax (`](`...`.md)`) leaks into rendered output
- [ ] ISC-30: Anti: no console errors on the live page load (Interceptor console check)

## Test Strategy

| isc | type | check | threshold | tool |
|-----|------|-------|-----------|------|
| ISC-1 | build | exit code | 0 | Bash |
| ISC-2..6 | file/data | inspect dist + data.json | all present | Read/Bash jq |
| ISC-7..9 | transform | grep rendered html | 0 leaks | Bash/Grep |
| ISC-10 | assets | count files in dist | 55 photos | Bash |
| ISC-12..18 | UI | live interaction | works | Interceptor |
| ISC-23 | deploy | curl live URL | 200 | Bash curl |
| ISC-24..26,30 | live UI | screenshot + console | renders, no errors | Interceptor |

## Features

| name | satisfies | depends_on | parallelizable |
|------|-----------|------------|----------------|
| build pipeline (build.ts) | ISC-1..10 | — | no |
| app shell + routing (index.html, app.js) | ISC-11..14 | build pipeline | yes (Forge) |
| styling + responsive + lightbox (styles.css) | ISC-15..19 | app shell | yes (Forge) |
| deploy (workflow, repo, Pages) | ISC-20..23 | build output | no |
| live verification | ISC-24..26,30 | deploy | no |
| docs (README) | ISC-27 | — | yes |

## Decisions

- 2026-06-26: User informed of public-exposure risk (all data publish:false, includes spot locations near home); user chose "Public GitHub Pages, full data". Proceeding with full public deploy per explicit instruction.
- 2026-06-26: Style = clean light / minimal docs (user choice).
- 2026-06-26: dist/ committed (not CI-built) because CI cannot access the private source markdown under ~/.claude. Workflow only uploads the prebuilt artifact.
- 2026-06-26: Delegation soft-floor (E3 ≥2): Forge invoked for frontend hardening. Second delegation slot covered by Interceptor live-verification skill rather than a redundant code agent — single-author pipeline; show-your-math: a second code agent would add merge noise on a ~600-line static app.
