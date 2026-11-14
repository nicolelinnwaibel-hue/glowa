// Run: node game.test.js
const assert = require("assert");
const G = require("./game.js");
const { CHAPTERS, QUESTS, newState, questStatus, completeTask, todayIso,
  profileError, saveProfile, loadState, saveState, STORAGE_KEY } = G;

const FUTURE = "2099-01-01";
const PAST = "2000-01-01";
const TODAY = "2026-06-01";

// Content: 20 to 30 quests in chapters, each with the required fields.
assert.ok(QUESTS.length >= 20 && QUESTS.length <= 30, "20 to 30 quests");
const ids = new Set(QUESTS.map((q) => q.id));
assert.strictEqual(ids.size, QUESTS.length, "quest ids are unique");
for (const q of QUESTS) {
  assert.ok(q.name && q.category && q.description, "name, category, description: " + q.id);
  assert.ok([50, 100, 200].includes(q.xp), "XP is 50, 100 or 200: " + q.id);
  for (const p of q.prereqs || []) assert.ok(ids.has(p), "prerequisite exists: " + q.id + " needs " + p);
}
assert.ok(CHAPTERS.length >= 2 && CHAPTERS.every((c) => c.quests.length > 0), "quests are grouped into chapters");
assert.strictEqual(QUESTS.find((q) => q.id === "book-venue").xp, 100, "book venue stays 100 XP");

// Status rules.
const s = newState();
assert.strictEqual(questStatus(s, QUESTS.find((q) => q.id === "book-caterer"), TODAY), "blocked", "open prerequisite blocks");
assert.strictEqual(questStatus(s, QUESTS.find((q) => q.id === "set-date"), TODAY), "available");
const fakeDue = { id: "x", name: "x", category: "x", xp: 50, due: FUTURE };
assert.strictEqual(questStatus(s, fakeDue, TODAY), "upcoming", "future due date is upcoming");
assert.strictEqual(questStatus(s, { ...fakeDue, due: PAST }, TODAY), "available", "past due date is available");

// Completing a prerequisite makes the dependent quest available; blocked quests cannot be completed.
assert.strictEqual(completeTask(s, "book-caterer"), false, "blocked quest refuses completion");
assert.strictEqual(s.xp, 0);
assert.strictEqual(completeTask(s, "book-venue"), true);
assert.strictEqual(s.xp, 100);
assert.strictEqual(s.arch, true);
assert.strictEqual(questStatus(s, QUESTS.find((q) => q.id === "book-caterer"), TODAY), "available");
assert.strictEqual(questStatus(s, QUESTS.find((q) => q.id === "book-venue"), TODAY), "completed");

// XP is awarded once, no matter how often Complete is triggered.
assert.strictEqual(completeTask(s, "book-venue"), false);
assert.strictEqual(completeTask(s, "book-venue"), false);
assert.strictEqual(s.xp, 100, "XP must not double-count");

// Unknown quest gives nothing.
assert.strictEqual(completeTask(s, "nope"), false);
assert.strictEqual(s.xp, 100);

// Upcoming quest can be completed early.
const up = QUESTS.find((q) => q.id === "send-invitations");
const s2 = newState();
completeTask(s2, "draft-guest-list"); completeTask(s2, "order-invitations");
assert.strictEqual(questStatus(s2, up, todayIso()), "upcoming");
assert.strictEqual(completeTask(s2, "send-invitations"), true);

// Profile: required fields, whole-number guests, edit.
const p = { partnerA: "Ana", partnerB: "Ben", date: "June 2027", theme: "Garden", guests: 80 };
assert.strictEqual(profileError({ ...p, partnerA: " " }), "Please enter both names.");
assert.strictEqual(profileError({ ...p, date: "" }), "Add an approximate date.");
assert.strictEqual(profileError({ ...p, theme: "Space" }), "Pick a theme from the list.");
assert.strictEqual(profileError({ ...p, guests: 2.5 }), "Guest count must be a whole number.");
assert.strictEqual(profileError({ ...p, guests: -1 }), "Guest count must be a whole number.");

const sp = s; // one save holds XP and profile together
assert.strictEqual(saveProfile(sp, { ...p, guests: -3 }), "Guest count must be a whole number.");
assert.strictEqual(sp.profile, null, "invalid profile is not saved");
assert.strictEqual(saveProfile(sp, p), null);
assert.strictEqual(sp.profile.partnerA, "Ana");
assert.strictEqual(saveProfile(sp, { ...p, theme: "Beach", guests: 120 }), null, "edit saves");
assert.strictEqual(sp.profile.theme, "Beach");
assert.strictEqual(sp.profile.guests, 120);

// Save and reload keeps XP, completion, arch and profile.
const store = new Map();
const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
saveState(storage, s);
const r = loadState(storage);
assert.strictEqual(r.xp, 100);
assert.strictEqual(r.done["book-venue"], true);
assert.strictEqual(r.arch, true);
assert.strictEqual(r.profile.guests, 120);
assert.strictEqual(completeTask(r, "book-venue"), false, "reloaded state still blocks double XP");

// A milestone A save (no profile) still loads.
store.set(STORAGE_KEY, JSON.stringify({ xp: 100, done: { "book-venue": true }, arch: true }));
const old = loadState(storage);
assert.strictEqual(old.xp, 100);
assert.strictEqual(old.profile, null);

// Broken save falls back to fresh state.
store.set(STORAGE_KEY, "{not json");
assert.strictEqual(loadState(storage).xp, 0);

console.log("ok: all milestone B tests passed");
