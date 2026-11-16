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
{
  const c0 = W.camera(phone, cam, false);
  const left = c0.x + 54 * c0.scale, bottom = c0.y + 498 * c0.scale;
  assert.ok(left < 390 && bottom > 0, "part of the plot is always on screen, however far it is dragged");
  assert.ok(Math.abs(cam.panX - (195 + 198 * phone.scale)) < 1e-9 && Math.abs(cam.panY + (422 + 99 * phone.scale)) < 1e-9);
}
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
  assert.strictEqual(W.arrivalGap(1000), 160, "never so fast that guests overlap at the gate");
  assert.ok(W.arrivalGap(120) * 120 <= 26000, "120 guests are through the gate in under half a minute");
}

// The walk in: from outside the plot, through the gate, across the plaza, to the guest's own spot.
{
  const spot = W.homeSpot("3f2b0c1e-0000-4000-8000-000000000001");
  assert.deepStrictEqual(W.homeSpot("3f2b0c1e-0000-4000-8000-000000000001"), spot, "a guest's spot is the same every time");
  assert.notDeepStrictEqual(W.homeSpot("3f2b0c1e-0000-4000-8000-000000000002"), spot);
  assert.ok(spot.u >= W.WALK_MIN && spot.u <= W.WALK_MAX && spot.v >= W.WALK_MIN && spot.v <= W.WALK_MAX);
  const route = W.arrivalRoute(spot, 1); // the middle lane
  assert.ok(route.start.v > 1, "they start outside the plot");
  assert.deepStrictEqual([route.legs[0].u, route.legs[0].v], W.OBJECTS.gate, "the first stop is the gate");
  assert.strictEqual(route.gateLeg, 0);
  assert.strictEqual(route.legs.length, 2, "from the gate they go straight to their own spot");
  assert.deepStrictEqual([route.legs[1].u, route.legs[1].v], [spot.u, spot.v], "the last stop is their own spot");
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

// ---- M4: finding a guest on the plot ----
{
  // The camera slides so the guest stands where the plot's centre normally is: clear of the open Guestbook.
  for (const [vw, vh] of [[1280, 800], [390, 844], [320, 568]]) {
    const v = W.baseView(vw, vh);
    for (const spot of [{ u: 0.1, v: 0.1 }, { u: 0.9, v: 0.9 }, { u: 0.9, v: 0.12 }, { u: 0.5, v: 0.5 }, W.homeSpot("some-guest")]) {
      const c2 = W.camToShow(v, W.newCam(), spot);
      const at = W.screenPoint(v, c2, true, spot);
      const centre = W.screenPoint(v, W.newCam(), true, { u: 0.5, v: 0.5 });
      assert.ok(Math.abs(at.x - centre.x) <= 2 && Math.abs(at.y - centre.y) <= 2, "the guest is brought to the clear part of the screen at " + vw + "x" + vh);
      assert.ok(at.x > 0 && at.x < vw && at.y > 0 && at.y < vh, "and is on screen");
      if (v.mobile) assert.ok(at.y < vh * 0.4, "above the bottom sheet on a phone");
      else assert.ok(at.x < vw - 396, "left of the panel on a laptop");
    }
    assert.strictEqual(W.camToShow(v, { zoom: 2, panX: 0, panY: 0 }, { u: 0.5, v: 0.5 }).zoom, 2, "a closer zoom is kept");
    assert.strictEqual(W.camToShow(v, { zoom: 0.6, panX: 0, panY: 0 }, { u: 0.5, v: 0.5 }).zoom, 1, "a far-out view zooms back in to show the guest");
  }

  // The guest whose card is open stands still, and so does their host or plus-one.
  const crowd = [{ id: "host", hostId: null, u: 0.5, v: 0.5 }, { id: "plus", hostId: "host", u: 0.52, v: 0.5 }, { id: "solo", hostId: null, u: 0.3, v: 0.3 }, { id: "other", hostId: null, u: 0.7, v: 0.7 }];
  let seedNo = 100;
  const still = (ids, held) => {
    const before = crowd.map((c) => [c.u, c.v].join());
    const r3 = W.rng(++seedNo); // a new sequence each time, so two runs cannot end in the same place by chance
    for (let i = 0; i < 200; i++) W.stepCrowd(crowd, r3, 0.5, held);
    return ids.every((id) => before[crowd.findIndex((c) => c.id === id)] === [crowd.find((c) => c.id === id).u, crowd.find((c) => c.id === id).v].join());
  };
  assert.ok(still(["solo"], new Set(["solo"])), "a selected guest stands still");
  assert.ok(!still(["other"], new Set(["solo"])), "everyone else carries on");
  assert.ok(still(["host", "plus"], new Set(["host"])), "a selected host and their plus-one both wait");
  assert.ok(still(["host", "plus"], new Set(["plus"])), "a selected plus-one and their host both wait");
  assert.ok(!still(["host"], new Set()), "nobody is held when nobody is selected");
}

// ---- M5: the gate on a phone ----
{
  // Guests take three lanes through the gate in turn, and are spaced out along each lane.
  const spot = { u: 0.3, v: 0.4 };
  const lanes = [0, 1, 2, 3].map((n) => W.arrivalRoute(spot, n));
  const gateX = lanes.map((l) => W.project(l.legs[0].u, l.legs[0].v).x);
  assert.strictEqual(new Set(gateX.slice(0, 3)).size, 3, "three different lanes through the gate");
  assert.strictEqual(gateX[3], gateX[0], "the fourth guest takes the first lane again");
  for (const l of lanes) {
    const g = W.project(l.legs[0].u, l.legs[0].v), centre = W.project(W.GATE.u, W.GATE.v);
    assert.ok(Math.abs(g.x - centre.x) <= 30, "every lane is inside the gate opening");
    assert.deepStrictEqual([l.legs[1].u, l.legs[1].v], [spot.u, spot.v], "and leads to the guest's own spot");
  }
  for (const n of [1, 30, 120, 144, 300, 1000]) {
    assert.ok(W.gateSpacing(n) >= 24, "guests in a row are at least 24 plot pixels apart at the gate with " + n + " guests");
    // Guests in the same lane are three guests apart, so three times that distance.
    assert.ok(W.gateSpacing(n) * 3 >= 36 * 1.5, "guests in the same lane do not overlap even at the largest phone size");
  }
  // Guests are drawn smaller on a phone as the list grows; never on a laptop.
  assert.strictEqual(W.avatarScale(false, 144), 1);
  assert.strictEqual(W.avatarScale(true, 10), 1.5, "a small party keeps the artboard's size");
  assert.strictEqual(W.avatarScale(true, 80), 1.25);
  assert.strictEqual(W.avatarScale(true, 144), 1.1);
  assert.ok(36 * W.avatarScale(true, 144) * W.baseView(390, 844).scale >= 26, "and are still easy to see");
}

// ---- M5: mood ----
{
  const m = W.newMood();
  assert.deepStrictEqual(m, { level: 100, clock: 0, fedUntil: 0, paused: false });
  // No guests on the plot: nothing to be hungry, the meter is hidden and nothing changes.
  W.tickMood(m, 1, 0);
  assert.deepStrictEqual(m, W.newMood());
  assert.strictEqual(W.moodView(m, 0).show, false);
  // With guests in and no snacks, the mood falls slowly.
  for (let i = 0; i < 60; i++) W.tickMood(m, 1, 144);
  assert.strictEqual(m.clock, 60);
  assert.ok(Math.abs(m.level - 90) < 1e-9, "ten points a minute");
  assert.deepStrictEqual(W.moodView(m, 144), { show: true, pct: 90, label: "Content", cause: "Guests will want a snack soon.", fed: false });
  for (let i = 0; i < 120; i++) W.tickMood(m, 1, 144);
  assert.strictEqual(W.moodView(m, 144).label, "Getting peckish");
  assert.strictEqual(W.moodView(m, 144).cause, "Guests are getting peckish. Serve snacks to cheer them up.", "the cause is shown in words, with the fix");
  // It never falls past the floor: there is no losing.
  for (let i = 0; i < 5000; i++) W.tickMood(m, 1, 144);
  assert.strictEqual(m.level, W.MOOD_FLOOR);
  assert.strictEqual(W.MOOD_FLOOR, 30);
  assert.strictEqual(W.moodView(m, 144).label, "Hungry");
  assert.strictEqual(W.moodView(m, 144).cause, "Guests are hungry. Serve snacks and they perk right up.");
  // Serving snacks restores it at once, and it holds while the snacks last.
  W.serveSnacks(m);
  assert.strictEqual(m.level, 100, "snacks restore the mood");
  assert.deepStrictEqual(W.moodView(m, 144), { show: true, pct: 100, label: "Happy", cause: "Snacks are out. Everyone is happy.", fed: true });
  for (let i = 0; i < W.SNACK_SECONDS; i++) W.tickMood(m, 1, 144);
  assert.strictEqual(m.level, 100, "the mood does not fall while the need is met");
  assert.strictEqual(W.isFed(m), false, "the snacks run out after three minutes");
  W.tickMood(m, 1, 144);
  assert.ok(m.level < 100 && m.level > 99.8, "then it starts to fall again, slowly");
  // Paused: nothing moves, however long it lasts.
  m.paused = true;
  const frozen = { ...m };
  for (let i = 0; i < 100000; i++) W.tickMood(m, 1, 144);
  assert.deepStrictEqual(m, frozen, "the mood never falls while paused");
  assert.deepStrictEqual(W.moodView(m, 144).label, "Paused");
  assert.strictEqual(W.moodView(m, 144).cause, "Paused. Nothing changes until you press play.");
  m.paused = false;
  W.tickMood(m, 1, 144);
  assert.ok(m.level < frozen.level, "and carries on when resumed");
  // A single tick never counts for more than a second, so a sleeping tab or a long gap cannot drain the mood.
  const gap = W.newMood();
  W.tickMood(gap, 86400, 144);
  assert.strictEqual(gap.clock, 1);
  assert.ok(gap.level > 99.8, "a day-long gap counts as one second");
  W.tickMood(gap, -5, 144); W.tickMood(gap, NaN, 144);
  assert.strictEqual(gap.clock, 1, "odd time steps are ignored");

  // While the game is closed nothing is ticked, and the save holds no time of day to catch up from.
  const store = {};
  const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  W.saveCam(fake, { zoom: 1.5, panX: 10, panY: 20 });
  const mm = W.newMood();
  for (let i = 0; i < 300; i++) W.tickMood(mm, 1, 50);
  W.saveMood(fake, mm);
  assert.deepStrictEqual(Object.keys(JSON.parse(store[W.WORLD_KEY]).mood).sort(), ["clock", "fedUntil", "level", "paused"], "the mood save holds the game clock only, no date");
  assert.ok(!/\d{4}-\d\d-\d\d/.test(store[W.WORLD_KEY]) && Object.values(JSON.parse(store[W.WORLD_KEY]).mood).every((n) => typeof n !== "number" || n < 1e9), "no date or time of day is stored");
  assert.deepStrictEqual(W.loadMood(fake), mm, "the mood is the same after the game is closed and opened again");
  assert.deepStrictEqual(W.loadCam(fake), { zoom: 1.5, panX: 10, panY: 20 }, "saving the mood keeps the camera");
  W.saveCam(fake, { zoom: 2, panX: 0, panY: 0 });
  assert.deepStrictEqual(W.loadMood(fake), mm, "and saving the camera keeps the mood");
  // Damaged saves fall back safely.
  assert.deepStrictEqual(W.loadMood({ getItem: () => "{broken" }), W.newMood());
  const odd = W.loadMood({ getItem: () => JSON.stringify({ mood: { level: -500, clock: -3, fedUntil: 1e12, paused: "yes" } }) });
  assert.deepStrictEqual(odd, { level: 30, clock: 0, fedUntil: W.SNACK_SECONDS, paused: false }, "a damaged mood is brought back inside its limits");
  // Nothing in the words blames the player.
  const words = [0, 100, 80, 60, 40, 30].map((lvl) => { const x = W.newMood(); x.level = lvl; return W.moodView(x, 5).cause + " " + W.moodView(x, 5).label; }).join(" ").toLowerCase();
  for (const bad of ["fail", "bad", "angry", "you forgot", "your fault", "late", "overdue", "wrong", "should have", "disappoint"]) assert.ok(!words.includes(bad), "the mood words never include \"" + bad + "\"");
}

// ---- M5: speech bubbles ----
{
  const speakers = Array.from({ length: 144 }, (_, i) => "g" + i);
  const r5 = W.rng(77);
  let bubbles = [], most = 0, total = 0;
  const seenHungry = new Set(), seenFed = new Set();
  for (let clock = 1; clock <= 3000; clock++) {
    const fed = clock > 1500;
    const before = bubbles.length;
    bubbles = W.stepBubbles(bubbles, clock, speakers, r5, fed);
    most = Math.max(most, bubbles.length);
    if (bubbles.length > before) total++;
    assert.ok(bubbles.length <= 3, "never more than three bubbles at once");
    assert.ok(bubbles.length - before <= 1, "at most one new bubble a second");
    assert.strictEqual(new Set(bubbles.map((b) => b.id)).size, bubbles.length, "a guest has one bubble at a time");
    assert.strictEqual(new Set(bubbles.map((b) => b.text)).size, bubbles.length, "the same line is not shown twice at once");
    for (const b of bubbles) {
      assert.ok(b.until > clock && b.until <= clock + W.BUBBLE_SECONDS, "a bubble lasts a few seconds");
      (fed ? seenFed : seenHungry).add(b.text);
    }
  }
  assert.strictEqual(most, 3, "up to three do appear");
  assert.ok(total > 300, "bubbles keep coming");
  assert.strictEqual(W.BUBBLE_MAX, 3);
  for (const line of ["I'm hungry!", "Where's the bar?", "Let's party!", "I wanna get crunk!"]) assert.ok(seenHungry.has(line), "guests say \"" + line + "\"");
  // New bubbles after snacks are never about being hungry (ones already showing are cleared by the snack button).
  assert.deepStrictEqual(W.bubbleLines(true).filter((t) => W.LINES.hungry.includes(t)), [], "nobody asks for food once snacks are out");
  assert.ok(W.bubbleLines(true).includes("Yum!") && W.bubbleLines(true).includes("Let's party!"));
  // Nobody available to speak: no bubbles. A speaker who leaves loses their bubble.
  assert.deepStrictEqual(W.stepBubbles([], 5, [], W.rng(1), false), []);
  const one = [{ id: "gone", text: "Yum!", until: 99 }, { id: "g1", text: "Cheers!", until: 99 }];
  assert.deepStrictEqual(W.stepBubbles(one, 5, ["g1"], () => 0.99, true).map((b) => b.id), ["g1"]);
  // Paused: the clock does not move, so the same bubbles simply stay (world.js does not call stepBubbles at all).

  // Bubbles stay off the plot's buttons.
  const overlaps = (b, t) => b.left < t.right && b.right > t.left && b.top < t.bottom && b.bottom > t.top;
  for (const [vw, vh, count] of [[1280, 800, 144], [390, 844, 144], [390, 844, 20], [320, 568, 144]]) {
    const v = W.baseView(vw, vh), g = W.avatarScale(v.mobile, count);
    for (const zoom of [0.6, 1, 2]) {
      const scale = v.scale * zoom;
      const things = W.thingBoxes();
      assert.deepStrictEqual(things.map((t) => t.key), ["gate", "book", "album", "bar", "table"], "every button on the plot is covered by the check");
      const r6 = W.rng(vw + count + zoom * 10);
      let ok = 0;
      for (let i = 0; i < 400; i++) {
        const spot = { u: W.WALK_MIN + r6() * 0.8, v: W.WALK_MIN + r6() * 0.8 };
        const box = W.bubbleBox(spot, scale, g, v.mobile);
        const fits = W.bubbleFits(spot, scale, g, v.mobile);
        assert.strictEqual(fits, !things.some((t) => overlaps(box, t)), "a guest may speak only if their bubble covers no button");
        if (fits) ok++;
      }
      assert.ok(ok >= 24, "enough guests can still speak at " + vw + "px, zoom " + zoom + " (" + ok + " of 400)");
    }
    // A guest standing just in front of the gate, the guestbook or a locked object may not speak.
    const scale = v.scale;
    for (const key of ["gate", "book", "album", "bar", "table"]) {
      const [u, vv] = W.OBJECTS[key];
      const front = { u: Math.min(0.95, u + 0.04), v: Math.min(0.99, vv + 0.04) };
      assert.strictEqual(W.bubbleFits(front, scale, g, v.mobile), false, "no bubble over the " + key + " at " + vw + "px");
    }
  }
}

console.log("ok: world tests passed");
