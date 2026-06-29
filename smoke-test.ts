#!/usr/bin/env bun
/** Runtime smoke test: execute the client SPA against the real built data in a DOM. */
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = join(import.meta.dir, "docs");
const html = readFileSync(join(DIST, "index.html"), "utf8");
const appJs = readFileSync(join(DIST, "app.js"), "utf8");
const data = JSON.parse(readFileSync(join(DIST, "data.json"), "utf8"));

const win = new Window({ url: "http://localhost/" });
const doc = win.document;
doc.write(html);

// stub fetch → return built data.json
(win as any).fetch = async () => ({ ok: true, status: 200, json: async () => data });

const results: { name: string; pass: boolean; info?: string }[] = [];
const check = (name: string, pass: boolean, info = "") => results.push({ name, pass, info });

// execute app.js with the DOM globals wired into scope
const g = globalThis as any;
g.window = win;
g.document = win.document;
g.location = win.location;
g.fetch = (win as any).fetch;
g.Event = win.Event;
g.navigator = win.navigator;
(0, eval)(appJs);

await new Promise((r) => setTimeout(r, 60)); // let fetch().then resolve

const navLinks = doc.querySelectorAll("#nav a");
check("nav renders a link per section", navLinks.length === data.sections.length, `${navLinks.length}/${data.sections.length}`);

const article = doc.querySelector("#article");
check("default section rendered", !!article && article.innerHTML.length > 200, `${article?.innerHTML.length} chars`);

// route to a gallery section → obstacles render as a skimmable spot list
win.location.hash = "#spots-orla";
win.dispatchEvent(new win.Event("hashchange"));
await new Promise((r) => setTimeout(r, 30));
const spotItems = doc.querySelectorAll("#article .spot-item");
check("spot list renders one item per obstacle", spotItems.length >= 31, `${spotItems.length} items`);
const firstItem = spotItems[0] as any;
check("spot item is a native button", firstItem?.tagName === "BUTTON" && firstItem?.getAttribute("type") === "button");
check("spot item carries name + full image", !!firstItem?.dataset.name && !!firstItem?.dataset.full);
const firstThumb = doc.querySelector("#article .spot-item .spot-thumb") as any;
check("spot thumb src points at assets/", (firstThumb?.getAttribute("src") || "").includes("assets/Attachments/"), firstThumb?.getAttribute("src"));

// route to assessment, check status colorization
win.location.hash = "#assessment";
win.dispatchEvent(new win.Event("hashchange"));
await new Promise((r) => setTimeout(r, 30));
const statusCells = doc.querySelectorAll("#article td.st-owned, #article td.st-learning, #article td.st-want, #article td.st-notyet");
check("status cells colorized", statusCells.length > 0, `${statusCells.length} cells`);

// search filters nav
const search = doc.querySelector("#search") as any;
search.value = "kickflip";
search.dispatchEvent(new win.Event("input"));
await new Promise((r) => setTimeout(r, 140));
const visible = [...doc.querySelectorAll("#nav a")].filter((a: any) => !a.hidden);
check("search filters nav", visible.length > 0 && visible.length < data.sections.length, `${visible.length} visible`);
// reset
search.value = "";
search.dispatchEvent(new win.Event("input"));
await new Promise((r) => setTimeout(r, 140));
const afterReset = [...doc.querySelectorAll("#nav a")].filter((a: any) => !a.hidden);
check("search reset restores all", afterReset.length === data.sections.length, `${afterReset.length}`);

// clicking a spot opens the full-screen popup with details
win.location.hash = "#spots-iapi";
win.dispatchEvent(new win.Event("hashchange"));
await new Promise((r) => setTimeout(r, 30));
const spot = doc.querySelector("#article .spot-item") as any;
spot.dispatchEvent(new win.Event("click", { bubbles: true }));
const lb = doc.querySelector("#lightbox") as any;
check("lightbox opens on spot click", lb.hidden === false);
const lbTitle = doc.querySelector("#lightboxTitle") as any;
check("lightbox shows obstacle details", !lbTitle.hidden && lbTitle.textContent.length > 0, lbTitle.textContent);

// no raw markdown link syntax leaked into any section html
const leak = data.sections.some((s: any) => /\]\([^)]*\.md\)/.test(s.html));
check("no raw .md link syntax in html", !leak);

// report
let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? "✓" : "✗"} ${r.name}${r.info ? "  (" + r.info + ")" : ""}`);
}
console.log(allPass ? "\nALL PASS" : "\nFAILURES PRESENT");
process.exit(allPass ? 0 : 1);
