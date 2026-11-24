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
  let guestCount = 0;

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
    prompt.hidden = panelOpen || benchOn || guestCount > 0;
    for (const l of locks) {
      const q = over(W.OBJECTS[l.key], LOCKED[l.key].lift, c.scale);
      l.el.style.left = q.x + "px";
      l.el.style.top = q.y + "px";
    }
    if (typeof placeTag === "function") placeTag();
    if (typeof drawBubbles === "function" && typeof mood !== "undefined") drawBubbles();
    worldEl.style.setProperty("--g", W.avatarScale(view.mobile, typeof people !== "undefined" ? people.size : 0));
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
  const inUi = (target) => !!target.closest(".panel, .hud-left, #venue-panel, .cam-tools, .toast, .classic-link, .hud-box, .banner-pill, .mood");

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

  // The stage never scrolls: the camera moves the world. Keyboard focus on an object near the edge would
  // otherwise make the browser scroll the whole screen sideways and cut off the top bar.
  const unscroll = () => { if (stage.scrollLeft || stage.scrollTop) stage.scrollTo(0, 0); if (window.scrollX || window.scrollY) window.scrollTo(0, 0); };
  stage.addEventListener("scroll", unscroll);
  window.addEventListener("scroll", unscroll);
  document.addEventListener("focusin", () => requestAnimationFrame(unscroll));

  // ---- the Guestbook overlay ----
  const panel = $("guestbook");
  function openGuestbook(from, guestId) {
    hideToast();
    const vp = document.getElementById("venue-panel");
    if (vp) vp.hidden = true;
    opener = from || document.activeElement;
    panelOpen = true;
    panel.hidden = false;
    render();
    if (window.GlowaGuestbook) window.GlowaGuestbook.opened(guestId);
    $("guestbook-title").focus({ preventScroll: true });
  }
  function closeGuestbook() {
    // Anything typed in the card is kept before the panel goes away.
    if (window.GlowaGuestbook) window.GlowaGuestbook.closing();
    if (typeof select === "function") select(null);
    panelOpen = false;
    panel.hidden = true;
    render();
    // preventScroll: the browser must not scroll the stage to bring an object on the plot into view.
    if (opener && opener.focus && !opener.hidden && document.contains(opener)) opener.focus({ preventScroll: true }); else book.focus({ preventScroll: true });
  }
  $("guestbook-close").addEventListener("click", closeGuestbook);
  $("count-chip").addEventListener("click", () => openGuestbook($("count-chip")));
  // Keep keyboard focus inside the open Guestbook.
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const stops = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), [tabindex]")].filter((el) => el.tabIndex >= 0 || el === document.activeElement);
    const first = $("guestbook-close"), last = stops.filter((el) => el.offsetParent !== null).pop() || first;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === $("guestbook-title"))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---- toast for locked objects ----
  // `action` is optional: { label, run }. Without one, a locked object shows "Quest coming later".
  let toastTimer = null;
  function showToast(title, body, action, keepPanel) {
    if (panelOpen && !keepPanel) closeGuestbook();
    clearTimeout(toastTimer);
    $("toast-title").textContent = title;
    $("toast-body").textContent = body;
    $("toast-soon").hidden = !!action || !!keepPanel;
    const btn = $("toast-action");
    btn.hidden = !action;
    if (action) {
      btn.textContent = action.label;
      btn.onclick = () => { hideToast(); action.run(); };
      // An undo offer stays for a while, then goes; a locked object's note stays until dismissed.
      toastTimer = setTimeout(hideToast, 8000); // an Undo offer stays 8 seconds
    }
    // A plain note from the guestbook goes away by itself, so it does not sit over the zoom buttons on a phone.
    if (!action && keepPanel) toastTimer = setTimeout(hideToast, 6000);
    $("toast").hidden = false;
  }
  function hideToast() { clearTimeout(toastTimer); $("toast").hidden = true; }
  $("toast-close").addEventListener("click", hideToast);

  // What the guestbook screen (guestbook.js) needs from the world.
  window.GlowaUI = {
    store: store || memory,
    toast: (title, body, action) => showToast(title, body, action, true),
    hideToast,
    close: closeGuestbook,
    // The top pill: "On the plot 142 · Maybe list 2" once there are guests.
    setGuestCount(n, onBench) {
      guestCount = n;
      const bench = onBench || 0;
      if (!benchOn) $("count-label").textContent = n === 0 ? "No guests yet" : "On the plot " + (n - bench) + " · Maybe list " + bench;
      render();
    },
  };

  // ---- characters ----
  // A real guest is a button (tap to open their card). Test characters for the speed check are plain drawings.
  // Guests are left out of the Tab order: 144 stops would bury the other controls, and the guest list in the
  // Guestbook gives keyboard and screen-reader users the same card for every guest.
  function sprite(g, guest) {
    const el = document.createElement(guest ? "button" : "div");
    el.className = "g";
    if (guest) {
      el.type = "button";
      el.tabIndex = -1;
      el.setAttribute("aria-label", guest.name);
      el.addEventListener("click", () => { if (!dragged) pick(guest.id, el); });
    } else el.setAttribute("aria-hidden", "true");
    paint(el, g);
    return el;
  }
  // Colours come only from a fixed list or a checked #rrggbb value, never from free text.
  const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#CFC7D8");
  function paint(el, g) {
    const hair = hex(g.hair), outfit = hex(g.outfit), skin = hex(g.skin);
    const hairBack = g.style === "long" ? '<span class="hl" style="background:' + hair + '"></span>' : g.style === "bob" ? '<span class="hbob" style="background:' + hair + '"></span>' : "";
    const top = g.style === "bun" ? '<span class="hb" style="background:' + hair + '"></span>' : g.style === "hat" ? '<span class="ht"></span><span class="hbr"></span>' : "";
    el.innerHTML = '<span class="gin"><span class="ring"></span><span class="sh"></span><span class="bob" style="animation-delay:' + (g.delay || 0).toFixed(2) + 's">' + hairBack
      + '<span class="bd" style="background:' + outfit + '"></span><span class="hd" style="background:' + skin + '"></span><span class="hr" style="background:' + hair + '"></span>'
      + top + '<span class="ey e1"></span><span class="ey e2"></span></span></span>';
    el.dataset.look = [g.skin, g.hair, g.outfit, g.style].join();
  }
  function stand(el, g, seconds) {
    const p = W.project(g.u, g.v);
    el.style.transition = seconds ? "transform " + seconds.toFixed(2) + "s linear, opacity .4s linear" : "none";
    el.style.transform = "translate(" + p.x + "px, " + p.y + "px)";
    el.style.zIndex = p.y;
  }

  // Everyone standing on the plot: { id, u, v, hostId, el, state }. state is "waiting" (not yet set off),
  // "walking" (coming in through the gate) or "in" (on the plot, free to wander).
  const people = new Map();
  const walkTimers = new Map();
  const r = W.rng(4242);

  // Guests with a speech bubble stand still until it goes, so the bubble stays above them.
  const speaking = new Set();
  function startWalk(p, seconds) {
    p.walkUntil = performance.now() + seconds * 1000;
    stand(p.el, p, seconds);
    p.el.classList.add("walk");
    clearTimeout(walkTimers.get(p.id));
    walkTimers.set(p.id, setTimeout(() => p.el.classList.remove("walk"), seconds * 1000));
  }

  // A handful of standing characters sway, and the handful changes every few seconds. Swaying all of them at once
  // costs about a fifth of the frame rate (see docs/rebuild/M0-report.md).
  const SWAYERS = 12;
  let swaying = [];
  function pickSwayers() {
    for (const el of swaying) el.classList.remove("sway");
    swaying = [];
    const standing = [...people.values()].filter((p) => p.state === "in");
    for (let i = 0; i < Math.min(SWAYERS, standing.length); i++) {
      const el = standing[Math.floor(r() * standing.length)].el;
      el.classList.add("sway");
      swaying.push(el);
    }
  }
  if (!reduceMotion) {
    setInterval(pickSwayers, 5200);
    setInterval(() => {
      if (mood.paused) return;
      const standing = [...people.values()].filter((p) => p.state === "in");
      const still = speaking.size ? new Set([...held, ...speaking]) : held;
      for (const p of W.stepCrowd(standing, r, 0.12, still)) startWalk(p, p.dur);
    }, 400);
  }

  // ---- arrivals ----
  const arrivals = W.newArrivals();
  const banner = $("arrival"), bannerText = $("arrival-text"), bannerPill = banner.firstElementChild;
  let arrivalTimer = null, bannerTimer = null;
  let onArrived = () => {};
  const legTimers = new Map();

  function showCount() {
    clearTimeout(bannerTimer);
    bannerText.textContent = W.arrivalLabel(arrivals);
    $("arrival-skip").hidden = false;
    bannerPill.classList.remove("done");
    banner.hidden = false;
  }
  function finishCount() {
    if (arrivals.active || banner.hidden) return;
    bannerText.textContent = arrivals.total === 1 ? "1 guest has arrived" : "All " + arrivals.total + " guests have arrived";
    $("arrival-skip").hidden = true;
    bannerPill.classList.add("done");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; drawMood(); }, 3500);
  }

  let lane = 0;
  // Sends one guest in: outside the plot, through the gate (where they are counted), across the plaza, to their spot.
  function walkIn(p) {
    const route = W.arrivalRoute(p.home, lane++);
    p.state = "walking";
    p.u = route.start.u; p.v = route.start.v;
    p.el.classList.add("out");
    stand(p.el, p, 0);
    void p.el.offsetWidth; // let the starting place apply before the walk begins
    p.el.classList.remove("out");
    let leg = 0;
    const step = () => {
      if (!people.has(p.id) || p.state !== "walking") return;
      if (leg === route.gateLeg + 1) { p.counted = true; W.countArrival(arrivals); onArrived([p.id]); showCount(); finishCount(); }
      if (leg >= route.legs.length) { p.state = "in"; legTimers.delete(p.id); return; }
      const l = route.legs[leg++];
      p.u = l.u; p.v = l.v;
      startWalk(p, l.dur);
      legTimers.set(p.id, setTimeout(step, l.dur * 1000));
    };
    step();
  }

  function settle(p) {
    clearTimeout(legTimers.get(p.id));
    legTimers.delete(p.id);
    p.state = "in";
    p.u = p.home.u; p.v = p.home.v;
    p.el.classList.remove("out", "walk");
    stand(p.el, p, 0);
  }

  // Puts everyone still waiting or walking straight onto the plot, and counts them.
  function skipArrivals() {
    const ids = [];
    for (const p of people.values()) {
      if (p.state === "in") continue;
      settle(p);
      ids.push(p.id);
    }
    while (W.nextArrival(arrivals)) { /* empty the queue */ }
    arrivals.done = arrivals.total;
    arrivals.active = false;
    clearInterval(arrivalTimer); arrivalTimer = null;
    if (ids.length) onArrived(ids);
    showCount();
    finishCount();
  }
  $("arrival-skip").addEventListener("click", skipArrivals);

  function runArrivals() {
    if (arrivalTimer || !arrivals.queue.length) return;
    showCount();
    if (reduceMotion) return skipArrivals();
    const send = () => {
      const id = W.nextArrival(arrivals);
      const p = id && people.get(id);
      if (p) walkIn(p);
      if (!arrivals.queue.length) { clearInterval(arrivalTimer); arrivalTimer = null; }
    };
    send();
    if (arrivals.queue.length) arrivalTimer = setInterval(send, W.arrivalGap(arrivals.total));
  }

  // ---- the bench ----
  let benchOrder = [];
  const moveTimers = new Map();
  // Puts everyone on the bench in their seat. Guests already sitting shuffle along if the seats change.
  function placeBench() {
    benchOrder.forEach((id, i) => {
      const p = people.get(id);
      if (!p) return;
      const seat = W.benchSpot(i, benchOrder.length);
      p.seat = seat;
      if (p.state !== "bench") return;
      const moved = p.u !== seat.u || p.v !== seat.v;
      p.u = seat.u; p.v = seat.v;
      stand(p.el, p, moved && p.el.style.transform ? 0.35 : 0);
    });
  }
  // A move with its own walk style: sashay to the bench, hop back. With Reduce Motion: fade out, move, fade in.
  function moveTo(p, spot, cls, then) {
    clearTimeout(moveTimers.get(p.id));
    clearTimeout(walkTimers.get(p.id));
    clearTimeout(legTimers.get(p.id)); legTimers.delete(p.id);
    p.el.classList.remove("walk", "sway", "sashay", "hop", "out", "whoosh");
    if (reduceMotion) {
      p.el.classList.add("fading");
      moveTimers.set(p.id, setTimeout(() => {
        p.u = spot.u; p.v = spot.v;
        stand(p.el, p, 0);
        p.el.classList.remove("fading");
        then();
      }, 260));
      return;
    }
    const seconds = Math.min(2.6, W.walkTime(p, spot, W.BENCH_SPEED));
    p.u = spot.u; p.v = spot.v;
    p.el.classList.add(cls);
    stand(p.el, p, seconds);
    moveTimers.set(p.id, setTimeout(() => { p.el.classList.remove(cls); then(); }, seconds * 1000));
  }
  function toBench(p) {
    // Someone still waiting at the gate leaves the queue; someone walking in is counted where they stand.
    if (p.state === "waiting") { W.dropArrival(arrivals, p.id); p.el.classList.remove("out"); stand(p.el, { u: W.ENTRY.u, v: W.ENTRY.v }, 0); }
    else if (p.state === "walking" && !p.counted) { W.countArrival(arrivals); onArrived([p.id]); }
    if (p.id === selected) { held.delete(p.id); }
    speaking.delete(p.id);
    p.state = "toBench";
    const seat = p.seat || W.benchSpot(0, 1);
    moveTo(p, seat, "sashay", () => { p.state = "bench"; placeBench(); finishCount(); drawMood(); });
  }
  function backToPlot(p) {
    p.state = "toPlot";
    moveTo(p, p.home, "hop", () => { p.state = "in"; onArrived([p.id]); drawMood(); });
  }

  let firstSync = true;
  // Brings the plot into line with the guest list. `guests` are records from the guestbook, in list order.
  // New guests who have not walked in yet are queued for the gate; guests who left are taken off the plot.
  function setGuests(guests) {
    if (benchOn) return;
    const keep = new Set(guests.map((g) => g.id));
    for (const p of [...people.values()]) {
      if (keep.has(p.id)) continue;
      clearTimeout(legTimers.get(p.id)); legTimers.delete(p.id);
      clearTimeout(walkTimers.get(p.id)); walkTimers.delete(p.id);
      clearTimeout(moveTimers.get(p.id)); moveTimers.delete(p.id);
      W.dropArrival(arrivals, p.id);
      people.delete(p.id);
      // Spin and whoosh away (with Reduce Motion, a quick fade), then go.
      const el = p.el;
      el.classList.remove("walk", "sway", "sel", "sashay", "hop");
      el.classList.add("whoosh");
      setTimeout(() => el.remove(), reduceMotion ? 260 : 680);
    }
    const fresh = [];
    for (const g of guests) {
      const look = { skin: g.look.skin, hair: g.look.hair, outfit: g.look.outfit, style: g.look.style, delay: -((parseInt(g.id.slice(0, 4), 16) % 26) / 10) };
      let p = people.get(g.id);
      if (p) {
        // Same guest, possibly with a new look or a new host.
        if (p.el.dataset.look !== [look.skin, look.hair, look.outfit, look.style].join()) paint(p.el, look);
        if (p.el.getAttribute("aria-label") !== g.name) p.el.setAttribute("aria-label", g.name);
        p.hostId = g.plusOneOf || null;
        p.name = g.name;
        const onBench = p.state === "bench" || p.state === "toBench";
        if (g.benched && !onBench) toBench(p);
        else if (!g.benched && onBench) backToPlot(p);
        continue;
      }
      // A plus-one's spot is beside their host's, so they arrive together and stay together.
      const host = g.plusOneOf && people.get(g.plusOneOf);
      const home = host ? W.spotBeside(host.home, g.id) : W.homeSpot(g.id);
      p = { id: g.id, hostId: g.plusOneOf || null, home, u: home.u, v: home.v, el: sprite(look, g), state: g.benched ? "bench" : g.arrived ? "in" : "waiting" };
      p.name = g.name;
      people.set(g.id, p);
      if (g.benched) { crowdEl.append(p.el); continue; } // placed on the bench below, and never walks in
      if (g.arrived) stand(p.el, p, 0);
      else { p.el.classList.add("out"); stand(p.el, { u: W.ENTRY.u, v: W.ENTRY.v }, 0); fresh.push(g.id); }
      crowdEl.append(p.el);
    }
    benchOrder = guests.filter((g) => g.benched).map((g) => g.id);
    placeBench();
    // On the first look at the list after a reload, guests who had already walked in count towards the total.
    const alreadyIn = firstSync ? guests.filter((g) => !g.benched).length - fresh.length : 0;
    firstSync = false;
    if (fresh.length) { W.queueArrivals(arrivals, fresh, alreadyIn); runArrivals(); }
    else if (!arrivals.active) finishCount();
    if (!reduceMotion && !swaying.length) pickSwayers();
    if (selected && !people.has(selected)) select(null);
    else placeTag();
    // Guests are drawn smaller on a phone as the list grows.
    worldEl.style.setProperty("--g", W.avatarScale(view.mobile, people.size));
    drawMood();
    drawBubbles();
  }

  // ---- selecting a guest: a ring under them, their name above them, and the camera slides over ----
  let selected = null;
  const held = new Set();
  let onPick = () => {};
  const tag = document.createElement("div");
  tag.className = "name-tag";
  tag.hidden = true;
  marks.append(tag);

  function placeTag() {
    const p = selected && people.get(selected);
    tag.hidden = !p;
    if (!p) return;
    const c = W.camera(view, cam, panelOpen);
    const at = W.project(p.u, p.v);
    tag.textContent = p.name;
    tag.style.left = Math.round(at.x * c.scale) + "px";
    tag.style.top = Math.round((at.y - (46 * W.avatarScale(view.mobile, people.size) + 8)) * c.scale) + "px";
  }

  // A guest still on their way in is brought straight to their spot (and counted) when they are picked.
  function bringIn(p) {
    if (p.state === "in" || p.state === "bench" || p.state === "toBench" || p.state === "toPlot") return;
    if (p.state === "waiting") W.dropArrival(arrivals, p.id);
    else if (!p.counted) W.countArrival(arrivals);
    settle(p);
    onArrived([p.id]);
    if (!banner.hidden) { showCount(); finishCount(); }
  }

  // Selects a guest on the plot (or nobody, with null) and slides the camera to them. Returns false if they are
  // not on the plot.
  function select(id) {
    const old = selected && people.get(selected);
    if (old) old.el.classList.remove("sel");
    held.clear();
    selected = null;
    const p = id && people.get(id);
    if (!p) { placeTag(); return false; }
    bringIn(p);
    selected = id;
    held.add(id);
    // Stop where they stand, so the name stays above them.
    clearTimeout(walkTimers.get(id));
    p.el.classList.remove("walk", "sway");
    const now = getComputedStyle(p.el).transform;
    if (now && now !== "none") { p.el.style.transition = "none"; p.el.style.transform = now; }
    const m = /matrix\(([^)]+)\)/.exec(now || "");
    if (m) {
      // Work back from where they are on screen to plot units, so wandering carries on from here later.
      const parts = m[1].split(",").map(Number), x = parts[4], y = parts[5];
      const du = (x - W.PLOT.cx) / 396, dv = (y - W.PLOT.cy) / 198 + 1;
      p.u = (dv + du) / 2; p.v = (dv - du) / 2;
      p.el.style.zIndex = Math.round(y);
    }
    p.el.classList.add("sel");
    changed(W.camToShow(view, cam, p));
    placeTag();
    return true;
  }

  // A tap on a guest: tell the guestbook, which opens their card.
  function pick(id, el) {
    opener = el;
    onPick(id);
  }
  window.GlowaUI.select = select;
  window.GlowaUI.onPick = (fn) => { onPick = fn; };
  window.GlowaUI.open = (from, guestId) => openGuestbook(from, guestId);
  window.GlowaUI.isOpen = () => panelOpen;
  window.GlowaUI.setGuests = setGuests;
  window.GlowaUI.onArrived = (fn) => { onArrived = fn; };
  // For checks: what the plot is showing right now.
  window.__glowaPlot = () => ({ selected, bench: [...people.values()].filter((p) => p.state === "bench" || p.state === "toBench").length, onPlot: people.size, in: [...people.values()].filter((p) => p.state === "in").length, done: arrivals.done, total: arrivals.total, active: arrivals.active });

  // ---- M5: mood, pause, snacks and speech bubbles ----
  const PAUSE_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4.5" height="14" rx="1.5" fill="#2B2140"></rect><rect x="10.5" y="2" width="4.5" height="14" rx="1.5" fill="#2B2140"></rect></svg>';
  const PLAY_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2 L15 9 L4 16 Z" fill="#2B2140"></path></svg>';
  const mood = W.loadMood(store || memory);
  let bubbles = [];
  const bubbleEls = new Map();
  const guestsIn = () => { let n = 0; for (const p of people.values()) if (p.state === "in") n++; return n; };

  function drawMood() {
    const v = W.moodView(mood, benchOn ? 0 : guestsIn());
    // The meter waits until an arrival has finished, so it never competes with the arrival count.
    const show = v.show && !arrivals.active;
    $("mood").hidden = !show;
    stage.classList.toggle("has-mood", show);
    stage.classList.toggle("paused", mood.paused);
    if (!show) return;
    $("mood-label").textContent = v.label;
    $("mood-cause").textContent = v.cause;
    $("mood-fill").style.width = v.pct + "%";
    $("mood-bar").setAttribute("aria-label", "Guest mood " + v.pct + " percent. " + v.cause);
    const pause = $("mood-pause");
    if (pause.dataset.paused !== String(mood.paused)) {
      pause.dataset.paused = String(mood.paused);
      pause.innerHTML = mood.paused ? PLAY_ICON : PAUSE_ICON;
      pause.setAttribute("aria-label", mood.paused ? "Resume the party" : "Pause the party");
      pause.setAttribute("aria-pressed", String(mood.paused));
    }
  }

  function drawBubbles() {
    const c = W.camera(view, cam, panelOpen);
    const g = W.avatarScale(view.mobile, people.size);
    const live = new Set(bubbles.map((b) => b.id));
    for (const [id, el] of bubbleEls) if (!live.has(id)) { el.remove(); bubbleEls.delete(id); held.delete("bubble:" + id); speaking.delete(id); }
    for (const b of bubbles) {
      const p = people.get(b.id);
      if (!p) continue;
      let el = bubbleEls.get(b.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "bub";
        el.setAttribute("aria-hidden", "true");
        el.textContent = b.text;
        marks.append(el);
        bubbleEls.set(b.id, el);
        speaking.add(b.id);
      }
      const at = W.project(p.u, p.v);
      el.style.left = Math.round(at.x * c.scale) + "px";
      el.style.top = Math.round((at.y - (46 * g + 12)) * c.scale) + "px";
    }
  }

  // Guests who may speak now: standing still on the plot, not being edited, and placed so that a bubble above
  // them covers none of the plot's buttons.
  function speakers() {
    const c = W.camera(view, cam, panelOpen);
    const g = W.avatarScale(view.mobile, people.size);
    const now = performance.now();
    const out = [];
    for (const p of people.values()) {
      if (p.state !== "in" || p.id === selected || (p.walkUntil || 0) > now) {
        if (speaking.has(p.id) && p.state === "in" && p.id !== selected) out.push(p.id);
        continue;
      }
      if (W.bubbleFits(p, c.scale, g, view.mobile)) out.push(p.id);
    }
    return out;
  }

  let moodTicks = 0;
  function second() {
    if (document.hidden || benchOn) return;
    const n = guestsIn();
    if (!mood.paused && n > 0 && !arrivals.active) {
      W.tickMood(mood, 1, n);
      bubbles = W.stepBubbles(bubbles, mood.clock, speakers(), r, W.isFed(mood));
      if (++moodTicks % 10 === 0) W.saveMood(store || memory, mood);
    }
    drawMood();
    drawBubbles();
  }
  setInterval(second, 1000);
  window.addEventListener("pagehide", () => W.saveMood(store || memory, mood));

  $("mood-pause").addEventListener("click", () => {
    mood.paused = !mood.paused;
    W.saveMood(store || memory, mood);
    drawMood();
  });
  $("mood-snacks").addEventListener("click", () => {
    W.serveSnacks(mood);
    // The hungry lines go at once; nobody should still be asking for food after it is served.
    bubbles = bubbles.filter((b) => !W.LINES.hungry.includes(b.text));
    W.saveMood(store || memory, mood);
    drawMood();
    drawBubbles();
  });
  window.__glowaMood = () => ({ ...mood, view: W.moodView(mood, guestsIn()), bubbles: bubbles.map((b) => ({ ...b })) });

  // The performance check: index.html?bench=120 fills the plot with 120 wandering test characters and shows the
  // frame rate. They are test characters, not guests, and nothing about them is saved.
  let benchOn = false;
  const benchN = Math.min(400, Math.max(0, parseInt(new URLSearchParams(location.search).get("bench"), 10) || 0));
  if (benchN > 0) {
    for (const g of W.makeCrowd(benchN, 20261115)) {
      const p = { id: g.id, hostId: null, home: { u: g.u, v: g.v }, u: g.u, v: g.v, el: sprite(g), state: "in" };
      stand(p.el, p, 0);
      crowdEl.append(p.el);
      people.set(p.id, p);
    }
    benchOn = true;
    $("count-label").textContent = benchN + " test characters";
    if (!reduceMotion) pickSwayers();
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
