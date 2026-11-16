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

  // Panning is limited so part of the plot is always on screen: its middle may go at most a quarter of the plot's
  // width past the edge. That is far enough to bring any corner of the plot to the middle of the screen.
  function clampCam(view, cam) {
    const zoom = clamp(cam.zoom, ZOOM_MIN, ZOOM_MAX);
    const limX = view.vw / 2 + 198 * view.scale * zoom, limY = view.vh / 2 + 99 * view.scale * zoom;
    return { zoom, panX: clamp(cam.panX, -limX, limX), panY: clamp(cam.panY, -limY, limY) };
  }
  const panBy = (view, cam, dx, dy) => clampCam(view, { zoom: cam.zoom, panX: cam.panX + dx, panY: cam.panY + dy });
  const zoomBy = (view, cam, factor) => clampCam(view, { zoom: cam.zoom * factor, panX: cam.panX, panY: cam.panY });
  const newCam = () => ({ zoom: 1, panX: 0, panY: 0 });
  // The camera position that puts a spot on the plot where the plot's centre normally sits, which is clear of the
  // open panel. Used to slide over to a guest. The zoom is kept, but never further out than the starting view.
  function camToShow(view, cam, spot) {
    const zoom = Math.max(cam.zoom, 1);
    const p = project(spot.u, spot.v);
    const scale = view.scale * zoom;
    return clampCam(view, { zoom, panX: Math.round((PLOT.cx - p.x) * scale), panY: Math.round((PLOT.cy - p.y) * scale) });
  }
  // Where a spot on the plot is on screen, for a given camera.
  function screenPoint(view, cam, panelOpen, spot) {
    const c = camera(view, cam, panelOpen), p = project(spot.u, spot.v);
    return { x: c.x + p.x * c.scale, y: c.y + p.y * c.scale };
  }

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

  // How long a walk between two spots takes, in seconds, at `speed` logical pixels a second.
  function walkTime(from, to, speed) {
    const a = project(from.u, from.v), b = project(to.u, to.v);
    return Math.max(0.4, Math.hypot(b.x - a.x, b.y - a.y) / speed);
  }
  const WANDER_SPEED = 34;
  const ARRIVE_SPEED = 95;
  // How close a plus-one keeps to their host, in plot units.
  const NEAR = 0.06;
  function nearSpot(spot, r) {
    const angle = r() * Math.PI * 2, d = NEAR * (0.55 + r() * 0.45);
    return { u: clamp(spot.u + Math.cos(angle) * d, WALK_MIN, WALK_MAX), v: clamp(spot.v + Math.sin(angle) * d, WALK_MIN, WALK_MAX) };
  }

  // One step of wandering: about `share` of the crowd each pick a nearby spot and walk to it at a steady pace.
  // Someone with a `hostId` (a plus-one) never wanders off alone: they follow when their host moves, and stay near.
  // Returns the characters that moved; `dur` is how many seconds each walk takes.
  // `held` (optional) is a set of ids who stand still, such as the guest whose card is open. Their host or
  // plus-one waits with them.
  function stepCrowd(crowd, r, share, held) {
    const moved = [];
    const followers = new Map();
    for (const g of crowd) if (g.hostId) followers.set(g.hostId, g);
    const hosts = new Set(crowd.map((g) => g.id));
    for (const g of crowd) {
      if (g.hostId && hosts.has(g.hostId)) continue;
      if (held && (held.has(g.id) || (followers.has(g.id) && held.has(followers.get(g.id).id)))) continue;
      if (r() >= share) continue;
      const to = { u: clamp(g.u + (r() - 0.5) * 0.3, WALK_MIN, WALK_MAX), v: clamp(g.v + (r() - 0.5) * 0.3, WALK_MIN, WALK_MAX) };
      g.dur = walkTime(g, to, WANDER_SPEED);
      g.u = to.u; g.v = to.v;
      moved.push(g);
      const f = followers.get(g.id);
      if (f) {
        const near = nearSpot(to, r);
        f.dur = Math.max(g.dur, walkTime(f, near, WANDER_SPEED));
        f.u = near.u; f.v = near.v;
        moved.push(f);
      }
    }
    return moved;
  }

  // ---- arrivals: guests walk in through the gate one at a time, with a count ----
  // The same guest always heads for the same spot, worked out from their id, so a reload does not shuffle the plot.
  function hashOf(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function homeSpot(id) {
    const r = rng(hashOf(id));
    return { u: WALK_MIN + r() * (WALK_MAX - WALK_MIN), v: WALK_MIN + r() * (WALK_MAX - WALK_MIN) };
  }
  // A plus-one's spot is beside their host's.
  const spotBeside = (hostSpot, id) => nearSpot(hostSpot, rng(hashOf(id)));

  // The walk in: from outside the plot, through the gate, onto the plaza, then to the guest's own spot.
  const ENTRY = { u: 0.5, v: 1.16 };
  const GATE = { u: 0.5, v: 1.0 };
  const PLAZA = { u: 0.5, v: 0.74 };
  function arrivalRoute(spot) {
    const stops = [ENTRY, GATE, PLAZA, spot];
    const legs = [];
    for (let i = 1; i < stops.length; i++) legs.push({ u: stops[i].u, v: stops[i].v, dur: walkTime(stops[i - 1], stops[i], ARRIVE_SPEED) });
    return { start: ENTRY, legs, gateLeg: 0 };
  }

  // Milliseconds between one guest and the next. A long list comes in faster, so 120 take about 25 seconds.
  const arrivalGap = (total) => Math.round(clamp(25000 / Math.max(1, total), 90, 350));

  // The arrival count. `done` goes up as each guest comes through the gate; `total` is how many are in this
  // arrival. A new arrival starts counting from zero again.
  function newArrivals() {
    return { queue: [], done: 0, total: 0, active: false };
  }
  // `alreadyIn` (optional) is how many guests are on the plot already when an interrupted arrival carries on,
  // so the count picks up where it stopped (41 of 144) and does not start again from zero.
  function queueArrivals(a, ids, alreadyIn) {
    if (!a.active) { a.done = alreadyIn || 0; a.total = alreadyIn || 0; }
    let added = 0;
    for (const id of ids) {
      if (a.queue.includes(id)) continue;
      a.queue.push(id);
      added++;
    }
    a.total += added;
    if (a.total > a.done) a.active = true;
    return added;
  }
  // The next guest to set off, or null when nobody is waiting.
  function nextArrival(a) {
    return a.queue.length ? a.queue.shift() : null;
  }
  // Called when a guest has come through the gate.
  function countArrival(a) {
    if (a.done < a.total) a.done++;
    if (a.done >= a.total && a.queue.length === 0) a.active = false;
    return a.done;
  }
  // A guest who was removed before setting off no longer counts.
  function dropArrival(a, id) {
    const i = a.queue.indexOf(id);
    if (i < 0) return false;
    a.queue.splice(i, 1);
    a.total--;
    if (a.done >= a.total && a.queue.length === 0) a.active = false;
    return true;
  }
  const arrivalLabel = (a) => "Guests arriving · " + a.done + " of " + a.total;

  return { PLOT, TREES, LANTERNS, OBJECTS, MOBILE_MAX, ZOOM_MIN, ZOOM_MAX, WALK_MIN, WALK_MAX, LOOKS, WORLD_KEY, WORLD_VERSION,
    project, baseView, camera, clampCam, panBy, zoomBy, newCam, loadCam, saveCam, rng, makeCrowd, stepCrowd,
    NEAR, ENTRY, GATE, PLAZA, walkTime, nearSpot, homeSpot, spotBeside, arrivalRoute, arrivalGap,
    newArrivals, queueArrivals, nextArrival, countArrival, dropArrival, arrivalLabel, camToShow, screenPoint };
});
