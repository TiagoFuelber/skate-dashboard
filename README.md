# 🛹 Skate System Dashboard

A read-only, responsive web view of my skateboarding knowledge base — trick map, wisdom,
assessment, session planning, spots (with photo galleries), sources, and journal. Browse it
on a laptop or phone instead of opening raw markdown in an editor.

**Live:** https://tiagofuelber.github.io/skate-dashboard/

> ⚠️ This site is **public**. It is a generated snapshot of `~/.claude/PAI/USER/SKATEBOARDING/`,
> which is marked `publish: false` and includes spot locations and a personal skill assessment.
> Publishing was a deliberate choice. To take it down: make the repo private *and* disable Pages
> (a private repo alone does **not** hide the published site on non-Enterprise plans), or delete the repo.

## How it works

- **Source of record:** the markdown lives in `~/.claude/PAI/USER/SKATEBOARDING/` — never edited here.
- **`build.ts`** (Bun) reads that markdown, renders it to HTML with `marked`, rewrites internal
  `.md` links to in-app `#hash` routes, copies the photo galleries, and writes a static `dist/`.
- **`dist/`** is committed. GitHub Pages serves it via `.github/workflows/deploy.yml`
  (CI only uploads the prebuilt snapshot — it has no access to the private source files).
- The frontend is a tiny dependency-free SPA: `index.html` + `app.js` + `styles.css`.

## Rebuild after updating the skate notes

```bash
cd ~/Projects/skate-dashboard
bun install        # first time only
bun run build      # regenerates dist/ from ~/.claude/PAI/USER/SKATEBOARDING/
git add -A && git commit -m "rebuild snapshot" && git push
```

The push triggers the Pages deploy. Point at a different source with `SKATE_SRC=/path bun run build`.

## Local preview

```bash
bun run build
cd dist && bunx serve   # or: python3 -m http.server
```
