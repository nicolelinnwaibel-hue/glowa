// Run: node venue.test.js
const assert = require("assert");
const V = require("./venue-core.js");
const Game = require("./game.js");
const World = require("./world-core.js");
const Guests = require("./guests-core.js");

// The quest the venue completes exists on this branch.
const quest = Game.QUESTS.find((q) => q.id === V.QUEST_ID);
assert.ok(quest, "the book-venue quest exists");
assert.strictEqual(quest.xp, 100);

// Five venue types, one at a time.
assert.deepStrictEqual(V.TYPES.map((t) => t.id), ["beach", "winery", "castle", "forest", "desert"]);
const v = V.newVenue();
assert.strictEqual(V.venueLabel(v), "No venue yet");
assert.strictEqual(V.setType(v, "palace"), "Pick one of the venue types.");
assert.strictEqual(V.setType(v, "castle"), null);
assert.strictEqual(v.type, "castle");
assert.strictEqual(V.venueLabel(v), "Castle");
assert.strictEqual(V.setType(v, "beach"), null, "changing the type is allowed");
V.setType(v, "castle");

// Date or season is one choice, shown as entered.
assert.strictEqual(V.setDate(v, "2027-06-12"), null);
assert.strictEqual(V.venueLabel(v), "Castle · 2027-06-12", "an exact date shows as 2027-06-12");
assert.strictEqual(V.setSeason(v, "Autumn", 2027), null);
assert.deepStrictEqual(v.when, { kind: "season", season: "Autumn", year: 2027 }, "a season replaces the date");
assert.strictEqual(V.venueLabel(v), "Castle · Autumn 2027", "a season shows as Castle · Autumn 2027");
for (const bad of ["2027-02-30", "2027-6-12", "12/06/2027", "2099-01-01", ""]) assert.ok(V.setDate(v, bad), "refused: " + bad);
assert.ok(V.setSeason(v, "Monsoon", 2027));
assert.ok(V.setSeason(v, "Summer", 1999));
assert.strictEqual(V.venueLabel(v), "Castle · Autumn 2027", "a refused change alters nothing");
V.setDate(v, "2027-06-12");

// Finalise completes the quest once, with its reward; undo (reopen) reopens it; finalise again gives no second reward.
const planner = Game.newState();
assert.strictEqual(V.finalise(V.newVenue(), planner, Game).error, "Pick a venue type first.");
const noWhen = V.newVenue(); V.setType(noWhen, "beach");
assert.strictEqual(V.finalise(noWhen, planner, Game).error, "Add a date or a season first.");
assert.strictEqual(planner.xp, 0, "nothing is awarded for a refused finalise");
let r = V.finalise(v, planner, Game);
assert.deepStrictEqual(r, { xp: 100 }, "finalising completes Book venue with +100 XP");
assert.strictEqual(planner.done[V.QUEST_ID], true);
assert.strictEqual(v.finalised, true);
assert.strictEqual(V.finalise(v, planner, Game).error, "The venue is already finalised.");
assert.strictEqual(planner.xp, 100, "once");
assert.ok(V.setType(v, "beach"), "a finalised venue can't be changed");
assert.ok(V.setDate(v, "2027-07-01"));
assert.strictEqual(V.venueLabel(v), "Castle · 2027-06-12");
r = V.reopen(v, planner, Game);
assert.deepStrictEqual(r, { xp: -100 }, "reopening takes the XP back");
assert.strictEqual(!!planner.done[V.QUEST_ID], false, "the quest is open again");
assert.strictEqual(v.finalised, false);
r = V.finalise(v, planner, Game);
assert.deepStrictEqual(r, { xp: 100 });
assert.strictEqual(planner.xp, 100, "finalise, undo, finalise again: the reward is counted once, not twice");
// A quest done earlier (in the classic planner) gives no new XP when the venue is finalised.
const already = Game.newState(); Game.completeTask(already, V.QUEST_ID);
const v2 = V.newVenue(); V.setType(v2, "forest"); V.setSeason(v2, "Spring", 2028);
assert.deepStrictEqual(V.finalise(v2, already, Game), { xp: 0 });
assert.strictEqual(already.xp, 100);
// Reopening is refused while a later quest that needs a booked venue is done.
Game.completeTask(planner, "book-caterer");
assert.ok(/Book caterer/.test(V.reopen(v, planner, Game).error), "the reason names the quest");
assert.strictEqual(v.finalised, true);
assert.strictEqual(planner.done[V.QUEST_ID], true);
// The venue follows the quest if the quest was reopened elsewhere.
const v3 = V.newVenue(); V.setType(v3, "desert"); V.setDate(v3, "2027-03-03");
const p3 = Game.newState(); V.finalise(v3, p3, Game); Game.undoTask(p3, V.QUEST_ID);
assert.strictEqual(V.syncWithQuest(v3, p3), true);
assert.strictEqual(v3.finalised, false);

// Reload keeps type, date or season, and finalised. Own key; other saves untouched.
const store = {};
const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, val) => { store[k] = val; } };
const book = Guests.newBook();
Guests.saveBook(fake, book); World.saveCam(fake, { zoom: 1.2, panX: 0, panY: 0 }); Game.saveState(fake, planner);
const others = [Guests.GUESTS_KEY, World.WORLD_KEY].map((k) => store[k]);
assert.strictEqual(V.saveVenue(fake, v, { label: "Venue finalised", venue: V.newVenue(), reopenQuest: true, redoQuest: false }), true);
assert.deepStrictEqual([Guests.GUESTS_KEY, World.WORLD_KEY].map((k) => store[k]), others, "the guestbook and world saves are untouched");
assert.strictEqual(new Set([V.VENUE_KEY, Guests.GUESTS_KEY, World.WORLD_KEY, Game.STORAGE_KEY]).size, 4);
const back = V.loadVenue(fake);
assert.deepStrictEqual(back.venue, { type: "castle", when: { kind: "date", date: "2027-06-12" }, finalised: true }, "reload keeps type, date and finalised");
assert.strictEqual(back.undo.label, "Venue finalised", "the last change survives a reload too");
const s2 = V.newVenue(); V.setType(s2, "castle"); V.setSeason(s2, "Autumn", 2027); V.saveVenue(fake, s2, null);
assert.deepStrictEqual(V.loadVenue(fake).venue, { type: "castle", when: { kind: "season", season: "Autumn", year: 2027 }, finalised: false });
// Damaged saves fall back safely.
assert.deepStrictEqual(V.loadVenue({ getItem: () => "{broken" }).venue, V.newVenue());
assert.deepStrictEqual(V.loadVenue({ getItem: () => { throw new Error("blocked"); } }).venue, V.newVenue());
assert.deepStrictEqual(V.loadVenue({ getItem: () => JSON.stringify({ venue: { type: "moon", when: { kind: "date", date: "2027-13-01" }, finalised: true } }) }).venue, V.newVenue(), "nothing finalised without a type and a date");

// Nothing in the venue code reaches outside the device.
const src = require("fs").readFileSync(__dirname + "/venue-core.js", "utf8") + require("fs").readFileSync(__dirname + "/venue.js", "utf8");
for (const word of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "http://", "https://", "mailto:"]) assert.ok(!src.includes(word), "no outside request: " + word);
console.log("ok: venue tests passed");
