/* Skate System dashboard — read-only client renderer */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const navEl = $("#nav");
  const articleEl = $("#article");
  const searchEl = $("#search");
  const mainEl = $("#main");
  const navFoot = $("#navFoot");

  let DATA = null;
  const byId = new Map();

  // ── Load data ─────────────────────────────────────────────
  fetch("data.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((data) => {
      DATA = data;
      data.sections.forEach((s) => byId.set(s.id, s));
      buildNav(data.groups);
      const foot = new Date(data.generated);
      navFoot.textContent =
        data.sections.length +
        " sections · snapshot " +
        (isNaN(foot) ? "" : foot.toISOString().slice(0, 10));
      route();
    })
    .catch((err) => {
      articleEl.innerHTML =
        "<h1>Could not load data</h1><p>" + escapeHtml(String(err)) + "</p>";
    });

  // ── Navigation ────────────────────────────────────────────
  function buildNav(groups) {
    const frag = document.createDocumentFragment();
    groups.forEach((g) => {
      const label = document.createElement("div");
      label.className = "nav-group-label";
      label.textContent = g.name;
      label.dataset.group = g.name;
      frag.appendChild(label);
      g.items.forEach((it) => {
        const a = document.createElement("a");
        a.href = "#" + it.id;
        a.textContent = it.title;
        a.dataset.id = it.id;
        a.dataset.title = it.title.toLowerCase();
        frag.appendChild(a);
      });
    });
    navEl.innerHTML = "";
    navEl.appendChild(frag);
  }

  function setActive(id) {
    navEl.querySelectorAll("a").forEach((a) => {
      a.classList.toggle("active", a.dataset.id === id);
    });
  }

  // ── Rendering ─────────────────────────────────────────────
  function render(id) {
    const sec = byId.get(id);
    if (!sec) {
      const first = DATA && DATA.sections[0];
      if (first) return render(first.id);
      return;
    }
    const meta = [];
    meta.push('<span class="pill">' + escapeHtml(sec.group) + "</span>");
    if (sec.updated)
      meta.push('<span class="pill">updated ' + escapeHtml(sec.updated) + "</span>");

    articleEl.innerHTML =
      '<div class="section-meta">' + meta.join("") + "</div>" + sec.html;

    enhance(articleEl);
    setActive(id);
    document.title = sec.title + " · Skate System";
    mainEl.scrollTop = 0;
    window.scrollTo(0, 0);
    mainEl.focus({ preventScroll: true });
  }

  // wrap tables, colorize status cells
  function enhance(root) {
    root.querySelectorAll("table").forEach((t) => {
      if (!t.parentElement.classList.contains("table-wrap")) {
        const w = document.createElement("div");
        w.className = "table-wrap";
        t.parentNode.insertBefore(w, t);
        w.appendChild(t);
      }
      t.querySelectorAll("td").forEach((td) => {
        const txt = td.textContent;
        if (/✅|owned/i.test(txt) && !/want|🎯/.test(txt)) td.classList.add("st-owned");
        else if (/🔧/.test(txt)) td.classList.add("st-learning");
        else if (/🎯/.test(txt)) td.classList.add("st-want");
        else if (/⬜/.test(txt)) td.classList.add("st-notyet");
      });
    });
    // make gallery photos keyboard-operable
    root.querySelectorAll("img.gallery-img").forEach((img) => {
      img.tabIndex = 0;
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "View photo" + (img.alt ? ": " + img.alt : ""));
    });
    // open external links in a new tab
    root.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  }

  // ── Routing ───────────────────────────────────────────────
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    render(id || (DATA && DATA.sections[0] && DATA.sections[0].id));
    closeNav();
  }
  window.addEventListener("hashchange", route);

  // ── Search ────────────────────────────────────────────────
  let searchTimer = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 90);
  });
  function runSearch() {
    const q = searchEl.value.trim().toLowerCase();
    const links = navEl.querySelectorAll("a");
    const labels = navEl.querySelectorAll(".nav-group-label");
    navEl.querySelector(".no-results")?.remove();

    if (!q) {
      links.forEach((a) => {
        a.hidden = false;
        if (a.dataset._t) a.textContent = a.dataset._t;
      });
      labels.forEach((l) => (l.hidden = false));
      return;
    }

    let any = false;
    links.forEach((a) => {
      if (!a.dataset._t) a.dataset._t = a.textContent;
      const sec = byId.get(a.dataset.id);
      const inTitle = a.dataset.title.includes(q);
      const inBody = sec && sec.text && sec.text.toLowerCase().includes(q);
      const match = inTitle || inBody;
      a.hidden = !match;
      if (match) {
        any = true;
        a.innerHTML = highlight(a.dataset._t, q);
      }
    });
    // hide group labels with no visible items
    labels.forEach((l) => {
      let n = l.nextElementSibling;
      let visible = false;
      while (n && n.tagName === "A") {
        if (!n.hidden) visible = true;
        n = n.nextElementSibling;
      }
      l.hidden = !visible;
    });
    if (!any) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = "No matches for “" + searchEl.value.trim() + "”";
      navEl.appendChild(p);
    }
  }
  function highlight(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, i)) +
      "<mark>" +
      escapeHtml(text.slice(i, i + q.length)) +
      "</mark>" +
      escapeHtml(text.slice(i + q.length))
    );
  }

  // ── Mobile drawer ─────────────────────────────────────────
  const menuBtn = $("#menuBtn");
  const scrim = $("#scrim");
  function openNav() {
    document.body.classList.add("nav-open");
    menuBtn.setAttribute("aria-expanded", "true");
    scrim.hidden = false;
  }
  function closeNav() {
    document.body.classList.remove("nav-open");
    menuBtn.setAttribute("aria-expanded", "false");
    scrim.hidden = true;
  }
  menuBtn.addEventListener("click", () =>
    document.body.classList.contains("nav-open") ? closeNav() : openNav(),
  );
  scrim.addEventListener("click", closeNav);

  // ── Lightbox ──────────────────────────────────────────────
  const lb = $("#lightbox");
  const lbImg = $("#lightboxImg");
  const lbCap = $("#lightboxCap");
  const lbClose = lb.querySelector(".lightbox-close");
  let lbOpener = null;

  function openLightbox(img) {
    lbOpener = img;
    lbImg.src = img.src;
    lbImg.alt = img.alt || "";
    lbCap.textContent = img.alt || "";
    lb.hidden = false;
    lbClose.focus();
  }
  function closeLb() {
    lb.hidden = true;
    lbImg.src = "";
    if (lbOpener && document.contains(lbOpener)) lbOpener.focus();
    lbOpener = null;
  }
  articleEl.addEventListener("click", (e) => {
    const img = e.target.closest("img.gallery-img");
    if (img) openLightbox(img);
  });
  articleEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const img = e.target.closest("img.gallery-img");
    if (img) {
      e.preventDefault();
      openLightbox(img);
    }
  });
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target.classList.contains("lightbox-close")) closeLb();
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.hidden) {
      if (e.key === "Escape") closeLb();
      else if (e.key === "Tab") {
        // trap focus inside the dialog (only the close button is focusable)
        e.preventDefault();
        lbClose.focus();
      }
      return;
    }
    if (e.key === "Escape") closeNav();
  });

  // ── utils ─────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
