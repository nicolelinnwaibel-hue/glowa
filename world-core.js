// Glowa world core: pure rules for the world-first screen (no DOM here, so node can test it).
// Layers, per the rebuild PRD: guest data and quests stay in game.js; this file is world geometry, camera and
// crowd movement; world.js is the renderer and UI. The renderer can be replaced without touching this file's callers.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  else root.GlowaWorld = api;
})(typeof self !== "undefined" ? self : this, function () {
  // The plot is drawn in a 900 x 600 logical space. (u, v) run 0..1 along the two sides of the diamond.
  const PLOT = { w: 900, h: 600, cx: 450, cy: 300 };
  function project(u, v) {
    return { x: Math.round(PLOT.cx + (u - v) * 396), y: Math.round(PLOT.cy + (u + v - 1) * 198) };
  }

  // Where things stand on the plot, as [u, v]. Taken from the Guest Arrival artboard.
  const TREES = [[0.06, 0.07, "round"], [0.24, 0.05, "pine"], [0.76, 0.06, "round"], [0.94, 0.08, "pine"], [0.05, 0.26, "pine"],
    [0.05, 0.62, "round"], [0.08, 0.93, "pine"], [0.94, 0.94, "round"], [0.95, 0.74, "pine"]];
  const LANTERNS = [[0.42, 0.72], [0.58, 0.72], [0.42, 0.9], [0.58, 0.9]];
  const OBJECTS = { gate: [0.5, 1.0], book: [0.66, 0.9], album: [0.15, 0.4], bar: [0.9, 0.5], table: [0.55, 0.15] };

  const MOBILE_MAX = 700;
  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 2.5;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // The scale that fits the plot to the screen. Matches the artboard: 1.25 at 1280 x 800, 0.72 at 390 x 844.
  function baseView(vw, vh) {
    const mobile = vw < MOBILE_MAX;
    const scale = clamp(mobile ? vw / 542 : Math.min(vw / 1024, vh / 640), 0.45, 1.6);
    return { vw, vh, mobile, scale };
  }

  // Where the world layer sits on screen. The plot centre is held near the screen centre; an open panel moves the
  // plot aside (desktop) or up (phone) so the panel never covers all of it.
  function camera(view, cam, panelOpen) {
    const scale = view.scale * cam.zoom;
    const anchorX = view.vw / 2 - (!view.mobile && panelOpen ? 170 : 0);
    const anchorY = view.vh / 2 + (view.mobile ? (panelOpen ? -182 : -30) : 9);
    return { scale, x: Math.round(anchorX - PLOT.cx * scale + cam.panX), y: Math.round(anchorY - PLOT.cy * scale + cam.panY) };
  }

  // Panning is limited so the middle of the plot can never leave the screen.
  function clampCam(view, cam) {
    return {
      zoom: clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX),
      panX: clamp(cam.panX, -view.vw / 2, view.vw / 2),
      panY: clamp(cam.panY, -view.vh / 2, view.vh / 2),
    };
  }
  const panBy = (view, cam, dx, dy) => clampCam(view, { zoom: cam.zoom, panX: cam.panX + dx, panY: cam.panY + dy });
  const zoomBy = (view, cam, factor) => clampCam(view, { zoom: cam.zoom * factor, panX: cam.panX, panY: cam.panY });
  const newCam = () => ({ zoom: 1, panX: 0, panY: 0 });

  // The world keeps its own small save (the camera). It never reads or writes the planner's save.
  const WORLD_KEY = "glowa-world-v1";
  const WORLD_VERSION = 1;
  function loadCam(storage) {
    let saved = null;
    try { saved = JSON.parse(storage.getItem(WORLD_KEY)); } catch (e) { /* broken or blocked: start fresh */ }
    const ok = saved && typeof saved === "object" && [saved.zoom, saved.panX, saved.panY].every(Number.isFinite);
    return ok ? { zoom: clamp(saved.zoom, ZOOM_MIN, ZOOM_MAX), panX: saved.panX, panY: saved.panY } : newCam();
  }
  function saveCam(storage, cam) {
    try { storage.setItem(WORLD_KEY, JSON.stringify({ version: WORLD_VERSION, zoom: cam.zoom, panX: cam.panX, panY: cam.panY })); } catch (e) { /* storage full or blocked */ }
  }

  // A small seeded random source, so a crowd is the same every run.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      let t = (s += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const LOOKS = {
    skin: ["#F6D3B3", "#E8B48C", "#C98D62", "#9A6240", "#6B4226"],
    hair: ["#2B2140", "#5A3A22", "#A8632B", "#E0B050", "#C9C3D6", "#D2553F"],
    outfit: ["#7A52BC", "#F6BE4A", "#E4577A", "#3F8FB5", "#3E9B73", "#F08A4B", "#F4F0E6", "#39405F"],
    style: ["short", "bob", "long", "bun", "hat"],
  };
  const WALK_MIN = 0.1;
  const WALK_MAX = 0.9;

  // Test characters for the performance check. They are not guests and are never saved.
  function makeCrowd(n, seed) {
    const r = rng(seed);
    const pick = (list) => list[Math.floor(r() * list.length)];
    const crowd = [];
    for (let i = 0; i < n; i++) {
      crowd.push({
        id: "test-" + (i + 1), u: WALK_MIN + r() * (WALK_MAX - WALK_MIN), v: WALK_MIN + r() * (WALK_MAX - WALK_MIN),
        skin: pick(LOOKS.skin), hair: pick(LOOKS.hair), outfit: pick(LOOKS.outfit), style: pick(LOOKS.style),
        delay: -(r() * 2.6), dur: 0,
      });
    }
    return crowd;
  }

  // One step of wandering: about `share` of the crowd each pick a nearby spot and walk to it at a steady pace.
  // Returns the characters that moved; `dur` is how many seconds each walk takes.
  function stepCrowd(crowd, r, share) {
    const moved = [];
    for (const g of crowd) {
      if (r() >= share) continue;
      const u = clamp(g.u + (r() - 0.5) * 0.3, WALK_MIN, WALK_MAX);
      const v = clamp(g.v + (r() - 0.5) * 0.3, WALK_MIN, WALK_MAX);
      const a = project(g.u, g.v), b = project(u, v);
      g.dur = Math.max(0.4, Math.hypot(b.x - a.x, b.y - a.y) / 34);
      g.u = u; g.v = v;
      moved.push(g);
    }
    return moved;
  }

  return { PLOT, TREES, LANTERNS, OBJECTS, MOBILE_MAX, ZOOM_MIN, ZOOM_MAX, WALK_MIN, WALK_MAX, LOOKS, WORLD_KEY, WORLD_VERSION,
    project, baseView, camera, clampCam, panBy, zoomBy, newCam, loadCam, saveCam, rng, makeCrowd, stepCrowd };
});
