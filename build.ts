#!/usr/bin/env bun
/**
 * skate-dashboard build
 * Reads the skate markdown knowledge base, renders it to a static read-only SPA.
 *
 * Source of record: ~/.claude/PAI/USER/SKATEBOARDING/ (override with SKATE_SRC).
 * Output: ./dist  (committed; GitHub Pages serves it via the deploy workflow).
 */
import { marked } from "marked";
import { homedir } from "node:os";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";

const SRC = process.env.SKATE_SRC || join(homedir(), ".claude/PAI/USER/SKATEBOARDING");
const ROOT = import.meta.dir;
const SRC_STATIC = join(ROOT, "src");
// Output to docs/ so GitHub Pages can serve it directly from the main branch
// (deploy-from-branch needs no `workflow` token scope).
const DIST = join(ROOT, "docs");

if (!existsSync(SRC)) {
  console.error(`✗ source not found: ${SRC}`);
  process.exit(1);
}

// ── Section metadata: filename → nav placement ──────────────────────────────
type Meta = { title: string; group: string; order: number; id?: string };
const META: Record<string, Meta> = {
  "README.md": { title: "Overview", group: "Overview", order: 0, id: "overview" },
  "TRICKS.md": { title: "Trick Map", group: "The Map", order: 10 },
  "TRICKMATRIX.md": { title: "Trick Matrix", group: "The Map", order: 11 },
  "WISDOM.md": { title: "Wisdom", group: "Wisdom", order: 20 },
  "ASSESSMENT.md": { title: "Assessment", group: "Assessment", order: 30 },
  "SESSIONS.md": { title: "Session Planning", group: "Sessions", order: 40 },
  "SPOTS.md": { title: "Spots", group: "Spots", order: 50 },
  "SPOTS-ORLA.md": { title: "Orla — Photos", group: "Spots", order: 51 },
  "SPOTS-IAPI.md": { title: "IAPI — Photos", group: "Spots", order: 52 },
  "SOURCES.md": { title: "Sources", group: "Sources", order: 60 },
  "MINING.md": { title: "Mining Method", group: "Sources", order: 61 },
};
const GROUP_ORDER = [
  "Overview",
  "The Map",
  "Wisdom",
  "Assessment",
  "Sessions",
  "Spots",
  "Sources",
  "Journal",
];

type Section = {
  id: string;
  title: string;
  group: string;
  order: number;
  updated: string | null;
  html: string;
  text: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[\/\\]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parse simple flat YAML frontmatter; return { fields, body }.
function parseFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fields: {}, body: raw };
  const fields: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { fields, body: raw.slice(m[0].length) };
}

function titleFromBody(body: string, fallback: string): string {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].replace(/\s*—.*$/, "").trim() || fallback;
  return fallback;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Collect source markdown ─────────────────────────────────────────────────
type RawFile = { rel: string; abs: string };
const files: RawFile[] = [];

for (const name of readdirSync(SRC)) {
  if (name.endsWith(".md") && statSync(join(SRC, name)).isFile()) {
    files.push({ rel: name, abs: join(SRC, name) });
  }
}
for (const sub of ["JOURNAL", "Sessions"]) {
  const dir = join(SRC, sub);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (name.endsWith(".md")) files.push({ rel: `${sub}/${name}`, abs: join(dir, name) });
    }
  }
}

// First pass: assign ids so links can be rewritten in the second pass.
const linkMap: Record<string, string> = {}; // basename(lower) → id
const planned: {
  rf: RawFile;
  id: string;
  title: string;
  group: string;
  order: number;
  fields: Record<string, string>;
  body: string;
}[] = [];

for (const rf of files) {
  const raw = readFileSync(rf.abs, "utf8");
  const { fields, body } = parseFrontmatter(raw);
  const base = basename(rf.rel);
  // META only applies to root-level files (avoid JOURNAL/README.md colliding with README.md)
  const meta = rf.rel.includes("/") ? undefined : META[base];

  let group: string;
  let order: number;
  let id: string;
  let title: string;

  if (meta) {
    group = meta.group;
    order = meta.order;
    id = meta.id || slugify(base);
    title = meta.title;
  } else if (rf.rel.startsWith("JOURNAL/")) {
    if (base.toLowerCase() === "readme.md") {
      group = "Journal";
      order = 70;
      id = "journal-about";
      title = "Journal — About";
    } else {
      group = "Journal";
      order = 100 + planned.filter((p) => p.group === "Journal").length;
      id = slugify(rf.rel);
      title = titleFromBody(body, base.replace(/\.md$/, ""));
    }
  } else if (rf.rel.startsWith("Sessions/")) {
    group = "Sessions";
    order = 45;
    id = slugify(rf.rel);
    title = "Log — " + base.replace(/\.md$/, "");
  } else {
    group = "Other";
    order = 900;
    id = slugify(rf.rel);
    title = titleFromBody(body, base.replace(/\.md$/, ""));
  }

  // root-level files own their basename link target; subdir files only fill gaps
  const key = base.toLowerCase();
  if (!rf.rel.includes("/") || !(key in linkMap)) linkMap[key] = id;
  linkMap[rf.rel.toLowerCase()] = id; // also index by full relative path
  planned.push({ rf, id, title, group, order, fields, body });
}

// Order Sessions logs and Journal entries newest-first within their tail order.
const sessionLogs = planned.filter((p) => p.rf.rel.startsWith("Sessions/"));
sessionLogs.sort((a, b) => b.rf.rel.localeCompare(a.rf.rel));
sessionLogs.forEach((p, i) => (p.order = 45 + i));
const journalEntries = planned.filter(
  (p) => p.rf.rel.startsWith("JOURNAL/") && p.id !== "journal-about",
);
journalEntries.sort((a, b) => b.rf.rel.localeCompare(a.rf.rel));
journalEntries.forEach((p, i) => (p.order = 71 + i));

// ── Render + rewrite ────────────────────────────────────────────────────────
marked.setOptions({ gfm: true, breaks: false });

function rewrite(html: string): string {
  // internal .md links → in-app hash routes
  html = html.replace(
    /href="([^":]+?\.md)(#[^"]*)?"/g,
    (full, file: string) => {
      const target = linkMap[basename(file).toLowerCase()];
      return target ? `href="#${target}"` : full;
    },
  );
  // image + link paths into Attachments → copied assets (relative)
  html = html.replace(/(src|href)="(\.\/)?Attachments\//g, '$1="assets/Attachments/');
  // mark photo-gallery images for the lightbox
  html = html.replace(/<img /g, '<img loading="lazy" class="gallery-img" ');
  return html;
}

const sections: Section[] = planned.map((p) => {
  const html = rewrite(marked.parse(p.body) as string);
  return {
    id: p.id,
    title: p.title,
    group: p.group,
    order: p.order,
    updated: p.fields.last_updated || null,
    html,
    text: stripHtml(html),
  };
});

sections.sort((a, b) => {
  const ga = GROUP_ORDER.indexOf(a.group);
  const gb = GROUP_ORDER.indexOf(b.group);
  if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb);
  return a.order - b.order;
});

// ── Emit dist ───────────────────────────────────────────────────────────────
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// copy static shell
for (const f of ["index.html", "app.js", "styles.css"]) {
  cpSync(join(SRC_STATIC, f), join(DIST, f));
}

// copy photo attachments
const attSrc = join(SRC, "Attachments");
let photoCount = 0;
if (existsSync(attSrc)) {
  const attDst = join(DIST, "assets", "Attachments");
  mkdirSync(attDst, { recursive: true });
  cpSync(attSrc, attDst, {
    recursive: true,
    filter: (s) => {
      if (statSync(s).isFile()) {
        if (/\.(jpe?g|png|webp|gif)$/i.test(s)) {
          photoCount++;
          return true;
        }
        return false;
      }
      return true;
    },
  });
}

const groups = GROUP_ORDER.filter((g) => sections.some((s) => s.group === g)).map((g) => ({
  name: g,
  items: sections.filter((s) => s.group === g).map((s) => ({ id: s.id, title: s.title })),
}));

const data = {
  generated: new Date().toISOString(),
  groups,
  sections,
};
writeFileSync(join(DIST, "data.json"), JSON.stringify(data));
writeFileSync(join(DIST, ".nojekyll"), "");

console.log(
  `✓ built ${sections.length} sections, ${photoCount} photos → docs/  (${groups.length} groups)`,
);
