// Run: node dress.test.js
const assert = require("assert");
const D = require("./dress-core.js");
const Game = require("./game.js");
const V = require("./venue-core.js");
const Guests = require("./guests-core.js");

const quest = Game.QUESTS.find((q) => q.id === D.QUEST_ID);
assert.ok(quest && quest.name === "Choose outfits", "the existing Choose outfits quest");
assert.strictEqual(quest.xp, 100);

// Five styles, one at a time.
assert.deepStrictEqual(D.STYLES.map((s) => s.label), ["A-line", "Ball gown", "Mermaid", "Sheath", "Jumpsuit"]);
const d = D.newDress();
assert.strictEqual(D.label(d), "Pick your dress");
assert.strictEqual(D.setStyle(d, "tutu"), "Pick one of the styles.");
assert.strictEqual(D.setStyle(d, "mermaid"), null);
assert.strictEqual(D.setStyle(d, "aline"), null, "trying on another style is allowed");
assert.strictEqual(D.label(d), "A-line");

// The price is a note: kept as typed, never added up.
D.setPrice(d, "  £1,800  incl. alterations ");
assert.strictEqual(d.price, "£1,800 incl. alterations");
D.setPrice(d, "x".repeat(100));
assert.strictEqual(d.price.length, D.PRICE_MAX);
D.setPrice(d, "£1,800");
assert.ok(!/total|sum|budget/i.test(Object.keys(d).join(" ")), "no running total is kept");

// Mark purchased completes Choose outfits once; undo reverses it; again gives no second reward.
const planner = Game.newState();
assert.strictEqual(D.markPurchased(D.newDress(), planner, Game).error, "Pick a style first.");
Game.completeTask(planner, "pick-theme"); // Choose outfits needs Choose a theme first
const xp0 = planner.xp;
let r = D.markPurchased(d, planner, Game);
assert.deepStrictEqual(r, { xp: 100, waitingFor: [] }, "+100 XP once");
assert.strictEqual(planner.done[D.QUEST_ID], true);
assert.strictEqual(D.label(d), "A-line · purchased");
assert.strictEqual(D.markPurchased(d, planner, Game).error, "Already marked purchased.");
assert.ok(D.setStyle(d, "sheath"), "a purchased dress can't be swapped without undoing first");
assert.strictEqual(planner.xp, xp0 + 100);
r = D.unmarkPurchased(d, planner, Game);
assert.deepStrictEqual(r, { xp: -100 }, "undo reverses it");
assert.strictEqual(!!planner.done[D.QUEST_ID], false);
D.markPurchased(d, planner, Game);
assert.strictEqual(planner.xp, xp0 + 100, "mark, undo, mark: rewarded once");

// Before Choose a theme is done, the purchase is kept and the quest completes as soon as it can.
const fresh = Game.newState();
const d2 = D.newDress(); D.setStyle(d2, "ballgown");
r = D.markPurchased(d2, fresh, Game);
assert.deepStrictEqual(r, { xp: 0, waitingFor: ["Choose a theme"] });
assert.strictEqual(d2.purchased, true);
assert.strictEqual(!!fresh.done[D.QUEST_ID], false);
assert.deepStrictEqual(D.catchUp(d2, fresh, Game), { xp: 0, waitingFor: ["Choose a theme"] });
Game.completeTask(fresh, "pick-theme");
assert.deepStrictEqual(D.catchUp(d2, fresh, Game), { xp: 100, waitingFor: [] }, "completes once the theme is done");
assert.deepStrictEqual(D.catchUp(d2, fresh, Game), { xp: 0, waitingFor: [] }, "and only once");
// Undo of a purchase whose quest never completed just clears the mark.
const fresh2 = Game.newState(); const d3 = D.newDress(); D.setStyle(d3, "sheath"); D.markPurchased(d3, fresh2, Game);
assert.deepStrictEqual(D.unmarkPurchased(d3, fresh2, Game), { xp: 0 });
assert.strictEqual(d3.purchased, false);

// Reload keeps style, purchased and price; own key; other saves untouched.
const store = {};
const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
Guests.saveBook(fake, Guests.newBook()); V.saveVenue(fake, V.newVenue(), null); Game.saveState(fake, planner);
const others = [Guests.GUESTS_KEY, V.VENUE_KEY, Game.STORAGE_KEY].map((k) => store[k]);
D.saveDress(fake, d, { label: "Dress marked purchased", dress: D.newDress(), unpurchase: true });
assert.deepStrictEqual([Guests.GUESTS_KEY, V.VENUE_KEY, Game.STORAGE_KEY].map((k) => store[k]), others, "other saves untouched");
const back = D.loadDress(fake);
assert.deepStrictEqual(back.dress, { style: "aline", purchased: true, price: "£1,800" });
assert.strictEqual(back.undo.unpurchase, true, "the last change survives a reload");
assert.deepStrictEqual(D.loadDress({ getItem: () => "{broken" }).dress, D.newDress());
assert.deepStrictEqual(D.cleanDress({ style: "cape", purchased: true, price: 5 }), { style: null, purchased: false, price: "5" });

// Nothing is bought or sent.
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/dress-core.js", "utf8") + fs.readFileSync(__dirname + "/dress.js", "utf8");
for (const w of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "http://", "https://", "mailto:"]) assert.ok(!src.includes(w), "no outside request: " + w);
console.log("ok: dress tests passed");
