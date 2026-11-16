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
console.log("ok: world tests passed");
