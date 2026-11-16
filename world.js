// Glowa world-first screen: draws the plot and handles the camera, the gate, the Invite point and the Guestbook
// overlay. Rules live in world-core.js. This file never reads or writes the planner's save (see classic.html).
(function () {
  const W = window.GlowaWorld;
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"), camEl = $("cam"), worldEl = $("world"), things = $("things"), crowdEl = $("crowd"), marks = $("marks");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let store = null;
  try { store = window.localStorage; } catch (e) { /* storage blocked: the camera just isn't remembered */ }
  const memory = { getItem: () => null, setItem: () => {} };
  let cam = W.loadCam(store || memory);
  let view = W.baseView(window.innerWidth, window.innerHeight);
  let panelOpen = false;
  let opener = null;

  const SVG = {
    round: '<svg width="64" height="86" viewBox="0 0 64 86"><rect x="27" y="52" width="10" height="31" rx="3" fill="#8A5A3C" stroke="#2B2140" stroke-width="3"></rect><circle cx="32" cy="31" r="27" fill="#4E9E63" stroke="#2B2140" stroke-width="3"></circle><circle cx="23" cy="22" r="9" fill="#6BB87A"></circle><circle cx="42" cy="38" r="5" fill="#6BB87A"></circle></svg>',
    pine: '<svg width="64" height="86" viewBox="0 0 64 86"><rect x="28" y="62" width="8" height="21" rx="2" fill="#8A5A3C" stroke="#2B2140" stroke-width="3"></rect><path d="M32 4 L54 40 H42 L58 68 H6 L22 40 H10 Z" fill="#3F8A63" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path></svg>',
    lantern: '<svg width="18" height="38" viewBox="0 0 18 38"><rect x="7.5" y="14" width="3" height="22" fill="#2B2140"></rect><circle class="lamp" cx="9" cy="9" r="7" fill="#F6BE4A" stroke="#2B2140" stroke-width="2.5"></circle></svg>',
    gate: '<svg width="130" height="118" viewBox="0 0 130 118" aria-hidden="true"><path d="M21 52 Q65 -22 109 52" fill="none" stroke="#2B2140" stroke-width="15" stroke-linecap="round"></path><path d="M21 52 Q65 -22 109 52" fill="none" stroke="#C9925E" stroke-width="9" stroke-linecap="round"></path><circle cx="34" cy="30" r="5" fill="#7A52BC" stroke="#2B2140" stroke-width="2"></circle><circle cx="50" cy="19" r="5" fill="#F6BE4A" stroke="#2B2140" stroke-width="2"></circle><circle cx="65" cy="15" r="5" fill="#FFFFFF" stroke="#2B2140" stroke-width="2"></circle><circle cx="80" cy="19" r="5" fill="#7A52BC" stroke="#2B2140" stroke-width="2"></circle><circle cx="96" cy="30" r="5" fill="#F6BE4A" stroke="#2B2140" stroke-width="2"></circle><rect x="8" y="48" width="26" height="66" rx="4" fill="#CFC7D8" stroke="#2B2140" stroke-width="3"></rect><rect x="96" y="48" width="26" height="66" rx="4" fill="#CFC7D8" stroke="#2B2140" stroke-width="3"></rect><rect x="4" y="42" width="34" height="10" rx="3" fill="#E4DEEA" stroke="#2B2140" stroke-width="3"></rect><rect x="92" y="42" width="34" height="10" rx="3" fill="#E4DEEA" stroke="#2B2140" stroke-width="3"></rect><path d="M14 70 H28 M14 90 H28 M102 70 H116 M102 90 H116" stroke="#A79DB8" stroke-width="2.5"></path></svg>',
    book: '<svg width="44" height="56" viewBox="0 0 44 56" aria-hidden="true"><rect x="19" y="24" width="6" height="26" fill="#8A5A3C" stroke="#2B2140" stroke-width="3"></rect><rect x="11" y="48" width="22" height="6" rx="2" fill="#8A5A3C" stroke="#2B2140" stroke-width="3"></rect><path d="M4 12 L22 18 L40 12 V26 L22 32 L4 26 Z" fill="#FFFBF2" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><path d="M22 18 V32" stroke="#2B2140" stroke-width="3"></path><path d="M30 14 V4 L34 7 L38 4 V13" fill="#E4577A" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"></path></svg>',
    album: '<svg width="48" height="58" viewBox="0 0 48 58" aria-hidden="true"><rect x="10" y="26" width="28" height="28" rx="3" fill="#CFC7D8" stroke="#2B2140" stroke-width="3"></rect><rect x="5" y="20" width="38" height="9" rx="3" fill="#E4DEEA" stroke="#2B2140" stroke-width="3"></rect><rect x="11" y="3" width="26" height="19" rx="3" fill="#E4577A" stroke="#2B2140" stroke-width="3"></rect><rect x="17" y="8" width="14" height="9" rx="1.5" fill="#FFFBF2" stroke="#2B2140" stroke-width="2"></rect></svg>',
    bar: '<svg width="76" height="70" viewBox="0 0 76 70" aria-hidden="true"><rect x="8" y="6" width="4" height="40" fill="#2B2140"></rect><rect x="64" y="6" width="4" height="40" fill="#2B2140"></rect><path d="M2 4 H74 V16 Q65 24 56 16 Q47 24 38 16 Q29 24 20 16 Q11 24 2 16 Z" fill="#F6BE4A" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><rect x="24" y="28" width="6" height="14" rx="2" fill="#3E9B73" stroke="#2B2140" stroke-width="2"></rect><rect x="35" y="25" width="6" height="17" rx="2" fill="#E4577A" stroke="#2B2140" stroke-width="2"></rect><rect x="46" y="30" width="6" height="12" rx="2" fill="#7A52BC" stroke="#2B2140" stroke-width="2"></rect><rect x="4" y="42" width="68" height="24" rx="4" fill="#C9925E" stroke="#2B2140" stroke-width="3"></rect><path d="M10 54 H66" stroke="#8A5A3C" stroke-width="3"></path></svg>',
    table: '<svg width="92" height="56" viewBox="0 0 92 56" aria-hidden="true"><rect x="6" y="20" width="14" height="24" rx="4" fill="#C9925E" stroke="#2B2140" stroke-width="3"></rect><rect x="72" y="20" width="14" height="24" rx="4" fill="#C9925E" stroke="#2B2140" stroke-width="3"></rect><rect x="39" y="4" width="14" height="20" rx="4" fill="#C9925E" stroke="#2B2140" stroke-width="3"></rect><rect x="26" y="34" width="5" height="18" fill="#8A5A3C" stroke="#2B2140" stroke-width="2"></rect><rect x="61" y="34" width="5" height="18" fill="#8A5A3C" stroke="#2B2140" stroke-width="2"></rect><ellipse cx="46" cy="28" rx="32" ry="13" fill="#FFFBF2" stroke="#2B2140" stroke-width="3"></ellipse><circle cx="34" cy="27" r="4" fill="#E4DEEA" stroke="#2B2140" stroke-width="2"></circle><circle cx="58" cy="27" r="4" fill="#E4DEEA" stroke="#2B2140" stroke-width="2"></circle><circle cx="46" cy="23" r="3" fill="#E4577A" stroke="#2B2140" stroke-width="2"></circle></svg>',
    lock: '<svg width="12" height="13" viewBox="0 0 12 13"><rect x="1.5" y="6" width="9" height="6" rx="1.5" fill="#2B2140"></rect><path d="M3.5 6 V4 a2.5 2.5 0 0 1 5 0 V6" fill="none" stroke="#2B2140" stroke-width="1.8"></path></svg>',
  };

  // Locked objects are future quests: they can be tapped, and say what is missing.
  const LOCKED = {
    album: { label: "Photo album, locked", w: 48, h: 58, lift: 62, title: "Photo album", body: "Photographer not yet booked." },
    bar: { label: "The bar, locked", w: 76, h: 70, lift: 74, title: "The bar", body: "Not planned yet. Guests will get thirsty." },
    table: { label: "Dining room, locked", w: 92, h: 56, lift: 60, title: "Dining room", body: "No seating chart yet. Guests won't know where to sit." },
  };

  function place(el, uv, w, h) {
    const p = W.project(uv[0], uv[1]);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.zIndex = p.y;
    el.style.width = w + "px";
    el.style.height = h + "px";
    return p;
  }

  function decor(svg, uv, w, h, cls) {
    const el = document.createElement("div");
    el.className = "obj" + (cls ? " " + cls : "");
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = svg;
    place(el, uv, w, h);
    things.append(el);
    return el;
  }

  function thing(svg, uv, w, h, label, onTap, cls) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "obj" + (cls ? " " + cls : "");
    el.setAttribute("aria-label", label);
    el.innerHTML = svg;
    place(el, uv, w, h);
    el.addEventListener("click", () => { if (!dragged) onTap(el); });
    things.append(el);
    return el;
  }

  // ---- build the world ----
  W.TREES.forEach((t, i) => {
    const el = decor(SVG[t[2]], t, 64, 86, "tree");
    el.firstChild.style.animationDelay = -(i * 0.7) + "s";
  });
  W.LANTERNS.forEach((l) => decor(SVG.lantern, l, 18, 38));
  const gate = thing(SVG.gate, W.OBJECTS.gate, 130, 118, "Entrance gate. Invite your guests", openGuestbook);
  const book = thing(SVG.book, W.OBJECTS.book, 44, 56, "Guestbook. Invite your guests", openGuestbook);
  for (const key of Object.keys(LOCKED)) {
    const o = LOCKED[key];
    thing(SVG[key], W.OBJECTS[key], o.w, o.h, o.label, () => showToast(o.title, o.body), "locked");
  }

  // Marks sit above the world at screen size (they do not shrink when the view zooms out).
  const prompt = document.createElement("button");
  prompt.type = "button";
  prompt.className = "prompt";
  prompt.textContent = "Invite your guests";
  prompt.addEventListener("click", () => { if (!dragged) openGuestbook(prompt); });
  marks.append(prompt);
  const locks = Object.keys(LOCKED).map((key) => {
    const el = document.createElement("span");
    el.className = "lock";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = SVG.lock;
    marks.append(el);
    return { el, key };
  });

  function over(uv, lift, scale) {
    const p = W.project(uv[0], uv[1]);
    return { x: Math.round(p.x * scale), y: Math.round((p.y - lift) * scale) };
  }

  function render() {
    const c = W.camera(view, cam, panelOpen);
    stage.classList.toggle("mb", view.mobile);
    stage.classList.toggle("dk", !view.mobile);
    camEl.style.transform = "translate(" + c.x + "px, " + c.y + "px)";
    worldEl.style.transform = "scale(" + c.scale + ")";
    worldEl.style.setProperty("--s", c.scale);
    const p = over(W.OBJECTS.book, 62, c.scale);
    prompt.style.left = p.x + "px";
    prompt.style.top = p.y + "px";
    prompt.hidden = panelOpen || benchOn;
    for (const l of locks) {
      const q = over(W.OBJECTS[l.key], LOCKED[l.key].lift, c.scale);
      l.el.style.left = q.x + "px";
      l.el.style.top = q.y + "px";
    }
  }

  // ---- camera: drag to pan, pinch or wheel to zoom, buttons and keys for everyone else ----
  const pointers = new Map();
  let dragged = false;
  let pinchDist = 0;
  let saveTimer = null;
  function changed(next) {
    cam = next;
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => W.saveCam(store || memory, cam), 300);
  }
  const inUi = (target) => !!target.closest(".panel, .hud-left, .cam-tools, .toast, .classic-link, .hud-box");

  stage.addEventListener("pointerdown", (e) => {
    if (inUi(e.target)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (pointers.size === 1) dragged = false;
    if (pointers.size === 2) pinchDist = spread();
  });
  stage.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) {
      const d = spread();
      if (pinchDist > 0 && d > 0) changed(W.zoomBy(view, cam, d / pinchDist));
      pinchDist = d;
      dragged = true;
      return;
    }
    if (!dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8) return;
    if (!dragged) { dragged = true; stage.classList.add("dragging"); }
    changed(W.panBy(view, cam, dx, dy));
  });
  function lift(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      stage.classList.remove("dragging");
      // Let the click that ends a drag be ignored, then accept taps again.
      setTimeout(() => { dragged = false; }, 0);
    }
  }
  stage.addEventListener("pointerup", lift);
  stage.addEventListener("pointercancel", lift);
  function spread() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  stage.addEventListener("wheel", (e) => {
    if (inUi(e.target)) return;
    e.preventDefault();
    changed(W.zoomBy(view, cam, e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });

  $("zoom-in").addEventListener("click", () => changed(W.zoomBy(view, cam, 1.25)));
  $("zoom-out").addEventListener("click", () => changed(W.zoomBy(view, cam, 0.8)));
  $("recentre").addEventListener("click", () => changed(W.newCam()));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (panelOpen) closeGuestbook(); else hideToast(); return; }
    if (e.target.closest("input, select, textarea, .panel")) return;
    const step = 60;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) { e.preventDefault(); changed(W.panBy(view, cam, moves[e.key][0], moves[e.key][1])); }
    if (e.key === "+" || e.key === "=") changed(W.zoomBy(view, cam, 1.25));
    if (e.key === "-") changed(W.zoomBy(view, cam, 0.8));
  });
  window.addEventListener("resize", () => {
    view = W.baseView(window.innerWidth, window.innerHeight);
    cam = W.clampCam(view, cam);
    render();
  });

  // ---- the Guestbook overlay ----
  const panel = $("guestbook");
  function openGuestbook(from) {
    hideToast();
    opener = from || document.activeElement;
    panelOpen = true;
    panel.hidden = false;
    render();
    $("guestbook-title").focus();
  }
  function closeGuestbook() {
    panelOpen = false;
    panel.hidden = true;
    render();
    if (opener && opener.focus && !opener.hidden) opener.focus(); else book.focus();
  }
  $("guestbook-close").addEventListener("click", closeGuestbook);
  $("count-chip").addEventListener("click", () => openGuestbook($("count-chip")));
  // Keep keyboard focus inside the open Guestbook.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const stops = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex]")].filter((el) => el.tabIndex >= 0 || el === document.activeElement);
    const first = $("guestbook-close"), last = stops[stops.length - 1] || first;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === $("guestbook-title"))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---- toast for locked objects ----
  function showToast(title, body) {
    if (panelOpen) closeGuestbook();
    $("toast-title").textContent = title;
    $("toast-body").textContent = body;
    $("toast").hidden = false;
  }
  function hideToast() { $("toast").hidden = true; }
  $("toast-close").addEventListener("click", hideToast);

  // ---- characters (used by the 120-character check now; real guests arrive in a later step) ----
  function sprite(g) {
    const el = document.createElement("div");
    el.className = "g";
    el.setAttribute("aria-hidden", "true");
    const hairBack = g.style === "long" ? '<span class="hl" style="background:' + g.hair + '"></span>' : g.style === "bob" ? '<span class="hbob" style="background:' + g.hair + '"></span>' : "";
    const top = g.style === "bun" ? '<span class="hb" style="background:' + g.hair + '"></span>' : g.style === "hat" ? '<span class="ht"></span><span class="hbr"></span>' : "";
    el.innerHTML = '<span class="gin"><span class="sh"></span><span class="bob" style="animation-delay:' + g.delay.toFixed(2) + 's">' + hairBack
      + '<span class="bd" style="background:' + g.outfit + '"></span><span class="hd" style="background:' + g.skin + '"></span><span class="hr" style="background:' + g.hair + '"></span>'
      + top + '<span class="ey e1"></span><span class="ey e2"></span></span></span>';
    return el;
  }
  function stand(el, g, seconds) {
    const p = W.project(g.u, g.v);
    el.style.transition = seconds ? "transform " + seconds.toFixed(2) + "s linear" : "none";
    el.style.transform = "translate(" + p.x + "px, " + p.y + "px)";
    el.style.zIndex = p.y;
  }

  // The performance check: index.html?bench=120 fills the plot with 120 wandering test characters and shows the
  // frame rate. They are test characters, not guests, and nothing about them is saved.
  let benchOn = false;
  const benchN = Math.min(400, Math.max(0, parseInt(new URLSearchParams(location.search).get("bench"), 10) || 0));
  if (benchN > 0) {
    benchOn = true;
    const crowd = W.makeCrowd(benchN, 20261115);
    const r = W.rng(4242);
    const els = new Map();
    for (const g of crowd) {
      const el = sprite(g);
      stand(el, g, 0);
      crowdEl.append(el);
      els.set(g.id, el);
    }
    $("count-label").textContent = benchN + " test characters";
    const timers = new Map();
    // A handful of standing characters sway, and the handful changes every few seconds.
    const SWAYERS = 12;
    let swaying = [];
    function pickSwayers() {
      for (const el of swaying) el.classList.remove("sway");
      swaying = [];
      for (let i = 0; i < Math.min(SWAYERS, crowd.length); i++) {
        const el = els.get(crowd[Math.floor(r() * crowd.length)].id);
        el.classList.add("sway");
        swaying.push(el);
      }
    }
    if (!reduceMotion) { pickSwayers(); setInterval(pickSwayers, 5200); }
    if (!reduceMotion) setInterval(() => {
      for (const g of W.stepCrowd(crowd, r, 0.12)) {
        const el = els.get(g.id);
        stand(el, g, g.dur);
        el.classList.add("walk");
        clearTimeout(timers.get(g.id));
        timers.set(g.id, setTimeout(() => el.classList.remove("walk"), g.dur * 1000));
      }
    }, 400);
    // Frame rate over the last second, plus the slowest frame, for the report.
    const box = $("bench-box");
    box.hidden = false;
    let frames = 0, last = performance.now(), prev = last, worst = 0;
    const stats = window.__glowaBench = { fps: [], worst: [] };
    (function tick(now) {
      frames++;
      worst = Math.max(worst, now - prev);
      prev = now;
      if (now - last >= 1000) {
        const fps = Math.round((frames * 1000) / (now - last));
        stats.fps.push(fps); stats.worst.push(Math.round(worst));
        box.textContent = "Speed check: " + benchN + " test characters · " + fps + " frames a second";
        frames = 0; worst = 0; last = now;
      }
      requestAnimationFrame(tick);
    })(last);
  }

  render();
})();
