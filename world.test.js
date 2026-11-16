// Run: node world.test.js
const assert = require("assert");
const W = require("./world-core.js");
const G = require("./game.js");

// Geometry: the plot centre and its four corners.
assert.deepStrictEqual(W.project(0.5, 0.5), { x: 450, y: 300 }, "plot centre");
assert.deepStrictEqual(W.project(0.5, 1.0), { x: 252, y: 399 }, "gate stands on the front-left edge");
assert.deepStrictEqual(W.project(0, 0), { x: 450, y: 102 });
assert.deepStrictEqual(W.project(1, 1), { x: 450, y: 498 });
for (const t of W.TREES.concat(W.LANTERNS, Object.values(W.OBJECTS))) {
  const p = W.project(t[0], t[1]);
  assert.ok(p.x >= 0 && p.x <= W.PLOT.w && p.y >= 0 && p.y <= W.PLOT.h, "everything stands inside the world");
}

// View: matches the artboard sizes, and the plot is centred.
const desk = W.baseView(1280, 800), phone = W.baseView(390, 844);
assert.strictEqual(desk.mobile, false);
assert.strictEqual(phone.mobile, true);
assert.strictEqual(desk.scale, 1.25, "desktop artboard scale");
assert.ok(Math.abs(phone.scale - 0.72) < 0.005, "phone artboard scale");
const dc = W.camera(desk, W.newCam(), false);
assert.ok(Math.abs(dc.x + 450 * dc.scale - 640) <= 1, "plot centred across on desktop");
const pc = W.camera(phone, W.newCam(), false);
assert.ok(Math.abs(pc.x + 450 * pc.scale - 195) <= 1, "plot centred across on a phone");
for (const [vw, vh] of [[768, 1024], [1280, 800], [1920, 1080]]) {
  const v = W.baseView(vw, vh), c = W.camera(v, W.newCam(), false);
  assert.ok(c.x + 54 * c.scale >= -1 && c.x + 846 * c.scale <= vw + 1, "the whole plot fits across at " + vw + "x" + vh);
}
// On a phone the plot is larger than the screen (as on the artboard) and is panned; the gate and guestbook start in view.
for (const [vw, vh] of [[320, 568], [390, 844], [430, 932]]) {
  const v = W.baseView(vw, vh), c = W.camera(v, W.newCam(), false);
  for (const name of ["gate", "book"]) {
    const p = W.project(W.OBJECTS[name][0], W.OBJECTS[name][1]);
    const x = c.x + p.x * c.scale, y = c.y + p.y * c.scale;
    assert.ok(x > 20 && x < vw - 20 && y > 120 && y < vh - 20, name + " starts in view at " + vw + "x" + vh);
  }
}

// An open Guestbook moves the plot aside (desktop) or up (phone); it never covers all of it.
assert.ok(W.camera(desk, W.newCam(), true).x < dc.x, "desktop: plot slides left");
assert.strictEqual(W.camera(desk, W.newCam(), true).y, dc.y);
assert.ok(W.camera(phone, W.newCam(), true).y < pc.y, "phone: plot slides up");
assert.strictEqual(W.camera(phone, W.newCam(), true).x, pc.x);

// Pan and zoom stay within limits.
let cam = W.newCam();
cam = W.zoomBy(phone, cam, 100);
assert.strictEqual(cam.zoom, W.ZOOM_MAX, "zoom stops at the maximum");
cam = W.zoomBy(phone, cam, 0.0001);
assert.strictEqual(cam.zoom, W.ZOOM_MIN, "zoom stops at the minimum");
cam = W.panBy(phone, W.newCam(), 9999, -9999);
assert.deepStrictEqual([cam.panX, cam.panY], [195, -422], "the plot centre cannot be dragged off screen");
cam = W.panBy(phone, W.newCam(), 30, 12);
assert.deepStrictEqual([cam.panX, cam.panY], [30, 12]);

// Saving: the world keeps only the camera, under its own key, and leaves the planner's save alone.
const store = {};
const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
const planner = G.newState();
G.completeTask(planner, "book-venue");
G.setGuestCount(planner, 80);
G.saveState(fake, planner);
const before = store[G.STORAGE_KEY];
W.saveCam(fake, { zoom: 1.5, panX: 20, panY: -10 });
assert.strictEqual(store[G.STORAGE_KEY], before, "the planner's save is untouched by the world");
assert.notStrictEqual(W.WORLD_KEY, G.STORAGE_KEY);
assert.deepStrictEqual(W.loadCam(fake), { zoom: 1.5, panX: 20, panY: -10 }, "camera survives a reload");
const back = G.loadState(fake);
assert.strictEqual(back.xp, 100, "existing XP still loads");
assert.strictEqual(back.wedding.guestCount, 80, "existing guest count still loads");
store[W.WORLD_KEY] = "{broken";
assert.deepStrictEqual(W.loadCam(fake), W.newCam(), "a broken world save starts fresh");
store[W.WORLD_KEY] = JSON.stringify({ zoom: 99, panX: "x" });
assert.deepStrictEqual(W.loadCam(fake), W.newCam(), "a damaged world save starts fresh");
assert.deepStrictEqual(W.loadCam({ getItem: () => { throw new Error("blocked"); } }), W.newCam(), "blocked storage starts fresh");

// Crowd for the 120-character check: steady, in bounds, and the same every run.
const crowd = W.makeCrowd(120, 7);
assert.strictEqual(crowd.length, 120);
assert.strictEqual(new Set(crowd.map((g) => g.id)).size, 120, "every character has its own id");
assert.deepStrictEqual(W.makeCrowd(120, 7), crowd, "same seed, same crowd");
const r = W.rng(11);
let movedTotal = 0;
for (let step = 0; step < 50; step++) {
  const moved = W.stepCrowd(crowd, r, 0.25);
  movedTotal += moved.length;
  for (const g of moved) assert.ok(g.dur >= 0.4 && g.dur < 6, "a walk takes a sensible time");
}
assert.ok(movedTotal > 1000 && movedTotal < 2000, "about a quarter of the crowd moves each step");
for (const g of crowd) {
  assert.ok(g.u >= W.WALK_MIN && g.u <= W.WALK_MAX && g.v >= W.WALK_MIN && g.v <= W.WALK_MAX, "nobody walks off the plot");
}
// ---- M3: arrivals ----
const Guests = require("./guests-core.js");

// The count: one guest at a time, "n of N", until everyone is in.
{
  const ids = Array.from({ length: 144 }, (_, i) => "guest-" + i);
  const a = W.newArrivals();
  assert.strictEqual(a.active, false);
  assert.strictEqual(W.queueArrivals(a, ids), 144);
  assert.strictEqual(W.arrivalLabel(a), "Guests arriving · 0 of 144");
  assert.strictEqual(a.active, true);
  const seen = [];
  const labels = [];
  for (let id; (id = W.nextArrival(a)); ) {
    seen.push(id);
    W.countArrival(a);
    labels.push(W.arrivalLabel(a));
    assert.strictEqual(a.active, seen.length < 144, "arriving until the last guest is counted");
  }
  assert.deepStrictEqual(seen, ids, "everyone arrives once, in list order");
  assert.strictEqual(labels[0], "Guests arriving · 1 of 144", "the count goes up one at a time");
  assert.strictEqual(labels[51], "Guests arriving · 52 of 144");
  assert.strictEqual(labels[143], "Guests arriving · 144 of 144");
  assert.strictEqual(W.nextArrival(a), null);
  assert.strictEqual(W.countArrival(a), 144, "the count never passes the total");

  // More guests join while others are still arriving: the total grows, and nobody is queued twice.
  const b = W.newArrivals();
  W.queueArrivals(b, ["a", "b", "c"]);
  W.nextArrival(b); W.countArrival(b);
  assert.strictEqual(W.queueArrivals(b, ["c", "d"]), 1, "a guest already waiting is not queued again");
  assert.strictEqual(W.arrivalLabel(b), "Guests arriving · 1 of 4");
  // A guest removed before setting off no longer counts.
  assert.strictEqual(W.dropArrival(b, "d"), true);
  assert.strictEqual(W.dropArrival(b, "nobody"), false);
  assert.strictEqual(W.arrivalLabel(b), "Guests arriving · 1 of 3");
  W.nextArrival(b); W.countArrival(b); W.nextArrival(b); W.countArrival(b);
  assert.strictEqual(b.active, false);
  assert.strictEqual(W.arrivalLabel(b), "Guests arriving · 3 of 3");
  // A later arrival starts its own count.
  W.queueArrivals(b, ["e"]);
  assert.strictEqual(W.arrivalLabel(b), "Guests arriving · 0 of 1");
  // Removing the only guest waiting ends the arrival.
  W.dropArrival(b, "e");
  assert.strictEqual(b.active, false);

  // An arrival interrupted by a reload carries on from where it stopped.
  const c = W.newArrivals();
  W.queueArrivals(c, ids.slice(41), 41);
  assert.strictEqual(W.arrivalLabel(c), "Guests arriving · 41 of 144");
  for (let id; (id = W.nextArrival(c)); ) W.countArrival(c);
  assert.strictEqual(W.arrivalLabel(c), "Guests arriving · 144 of 144");
  assert.strictEqual(c.active, false);
  W.queueArrivals(c, ["late"], 0);
  assert.strictEqual(W.arrivalLabel(c), "Guests arriving · 0 of 1", "a guest added later is their own arrival");

  // Pace: one at a time, quicker for a long list, never a blur and never a crawl.
  assert.strictEqual(W.arrivalGap(1), 350);
  assert.strictEqual(W.arrivalGap(120), 208);
  assert.strictEqual(W.arrivalGap(1000), 90);
  assert.ok(W.arrivalGap(120) * 120 <= 26000, "120 guests are through the gate in under half a minute");
}

// The walk in: from outside the plot, through the gate, across the plaza, to the guest's own spot.
{
  const spot = W.homeSpot("3f2b0c1e-0000-4000-8000-000000000001");
  assert.deepStrictEqual(W.homeSpot("3f2b0c1e-0000-4000-8000-000000000001"), spot, "a guest's spot is the same every time");
  assert.notDeepStrictEqual(W.homeSpot("3f2b0c1e-0000-4000-8000-000000000002"), spot);
  assert.ok(spot.u >= W.WALK_MIN && spot.u <= W.WALK_MAX && spot.v >= W.WALK_MIN && spot.v <= W.WALK_MAX);
  const route = W.arrivalRoute(spot);
  assert.ok(route.start.v > 1, "they start outside the plot");
  assert.deepStrictEqual([route.legs[0].u, route.legs[0].v], W.OBJECTS.gate, "the first stop is the gate");
  assert.strictEqual(route.gateLeg, 0);
  assert.deepStrictEqual([route.legs[2].u, route.legs[2].v], [spot.u, spot.v], "the last stop is their own spot");
  const total = route.legs.reduce((t, l) => t + l.dur, 0);
  assert.ok(route.legs.every((l) => l.dur >= 0.4) && total < 12, "the walk in takes a few seconds, not a minute");
}

// Plus-ones: mint on the avatar, beside their host on arrival, and near their host while wandering.
{
  const book = Guests.newBook();
  const t = Guests.sampleTable();
  Guests.applyImport(book, Guests.planImport(book, t, Guests.guessMapping(t.headers), "merge"), { file: "sample" });
  const plusOnes = book.guests.filter((g) => g.plusOneOf);
  assert.strictEqual(plusOnes.length, 24);
  assert.ok(plusOnes.every((g) => g.look.outfit === Guests.PLUS_ONE_OUTFIT), "every plus-one's avatar outfit is mint");
  assert.strictEqual(Guests.PLUS_ONE_OUTFIT, "#8FD3C8");
  assert.ok(book.guests.filter((g) => !g.plusOneOf).every((g) => g.look.outfit !== Guests.PLUS_ONE_OUTFIT), "no other guest is mint");
  assert.ok(book.guests.every((g) => g.arrived === false), "nobody has walked in before the gates open");

  // The plot is set up the way world.js does it: hosts at their own spot, plus-ones beside them.
  const dist = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
  const homes = new Map();
  const crowd = [];
  for (const g of book.guests) {
    const home = g.plusOneOf ? W.spotBeside(homes.get(g.plusOneOf), g.id) : W.homeSpot(g.id);
    homes.set(g.id, home);
    crowd.push({ id: g.id, hostId: g.plusOneOf || null, u: home.u, v: home.v });
  }
  const byId = new Map(crowd.map((c) => [c.id, c]));
  for (const c of crowd) if (c.hostId) assert.ok(dist(c, byId.get(c.hostId)) <= W.NEAR + 1e-9, "a plus-one arrives beside their host");
  const r2 = W.rng(99);
  let followed = 0;
  for (let step = 0; step < 200; step++) {
    const moved = W.stepCrowd(crowd, r2, 0.12);
    const movedIds = new Set(moved.map((m) => m.id));
    for (const c of crowd) {
      if (!c.hostId) continue;
      assert.ok(dist(c, byId.get(c.hostId)) <= W.NEAR + 1e-9, "a plus-one stays near their host while wandering");
      assert.strictEqual(movedIds.has(c.id), movedIds.has(c.hostId), "a plus-one moves when their host moves, and only then");
      if (movedIds.has(c.id)) followed++;
    }
    for (const c of crowd) assert.ok(c.u >= W.WALK_MIN && c.u <= W.WALK_MAX && c.v >= W.WALK_MIN && c.v <= W.WALK_MAX, "nobody walks off the plot");
  }
  assert.ok(followed > 200, "plus-ones did follow their hosts around");
  // A plus-one whose host is not on the plot (not arrived yet) can wander by themselves.
  const alone = [{ id: "p", hostId: "missing-host", u: 0.5, v: 0.5 }];
  let movedAlone = 0;
  for (let i = 0; i < 100; i++) movedAlone += W.stepCrowd(alone, r2, 0.5).length;
  assert.ok(movedAlone > 20);

  // Arrivals are remembered, so a reload does not replay them.
  assert.strictEqual(Guests.markArrived(book, book.guests.slice(0, 50).map((g) => g.id)), 50);
  assert.strictEqual(Guests.markArrived(book, [book.guests[0].id, "nobody"]), 0, "counted once");
  const store = {};
  const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  Guests.saveBook(fake, book);
  const back = Guests.loadBook(fake);
  assert.strictEqual(back.guests.filter((g) => g.arrived).length, 50, "who has arrived survives a reload");
  assert.deepStrictEqual(back, book);
  assert.ok(!Guests.exportCsv(book).includes("arrived"), "arrival is game state and is not in the exported list");
}

console.log("ok: world tests passed");
