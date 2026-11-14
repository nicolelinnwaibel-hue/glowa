// Run: node game.test.js
const assert = require("assert");
const G = require("./game.js");
const { CHAPTERS, QUESTS, UNLOCKS, unlocksFor, completedCount, progressPercent, newState, questStatus, levelFor, completeTask, canUndo, undoTask, XP_PER_LEVEL, todayIso,
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

// ---- milestone C: levels, undo, redo, repeat completion ----
assert.strictEqual(XP_PER_LEVEL, 200, "every 200 XP is one level");
assert.deepStrictEqual([0, 199, 200, 399, 400].map(levelFor), [1, 1, 2, 2, 3], "level thresholds");

const c = newState();
const venue = "book-venue", guests = "draft-guest-list", caterer = "book-caterer";
assert.strictEqual(completeTask(c, venue), true);
assert.strictEqual(c.xp, 100, "complete venue: 100 XP");
assert.strictEqual(levelFor(c.xp), 1, "level 1 after 100 XP");
assert.strictEqual(c.arch, true, "venue unlocks the arch");

assert.strictEqual(completeTask(c, guests), true);
assert.strictEqual(c.xp, 200, "complete guest list: 200 XP");
assert.strictEqual(levelFor(c.xp), 2, "level up at 200 XP");

assert.strictEqual(completeTask(c, guests), false, "repeat completion gives nothing");
assert.strictEqual(c.xp, 200, "repeat completion: still 200 XP");

assert.strictEqual(undoTask(c, guests), true, "undo guest list");
assert.strictEqual(c.xp, 100, "undo guest list: back to 100 XP");
assert.strictEqual(levelFor(c.xp), 1, "level drops back below 200 XP");
assert.strictEqual(undoTask(c, guests), false, "cannot undo twice");
assert.strictEqual(c.xp, 100, "second undo: still 100 XP");

// A quest cannot be undone while a completed quest still needs it.
assert.strictEqual(completeTask(c, caterer), true);
assert.strictEqual(c.xp, 200, "complete caterer: 200 XP");
assert.strictEqual(canUndo(c, venue), false, "venue is needed by caterer");
assert.strictEqual(undoTask(c, venue), false, "undo refused while caterer is done");
assert.strictEqual(c.xp, 200, "refused undo keeps XP");
assert.strictEqual(undoTask(c, caterer), true);
assert.strictEqual(c.xp, 100, "undo caterer: 100 XP");

// Undoing the venue takes back its XP and removes the arch.
assert.strictEqual(undoTask(c, venue), true);
assert.strictEqual(c.xp, 0, "undo venue: 0 XP");
assert.strictEqual(c.arch, false, "undo venue removes the arch");
assert.strictEqual(levelFor(c.xp), 1);

// Redo gives the XP and arch back once, with no duplicate reward.
assert.strictEqual(completeTask(c, venue), true);
assert.strictEqual(c.xp, 100, "redo venue: 100 XP, not 200");
assert.strictEqual(c.arch, true, "redo venue brings the arch back");
assert.strictEqual(completeTask(c, venue), false, "redo then repeat gives nothing");
assert.strictEqual(c.xp, 100);

// After a refresh (save and reload), state and undo still work.
saveState(storage, c);
const back = loadState(storage);
assert.strictEqual(back.xp, 100, "refresh keeps XP");
assert.strictEqual(back.arch, true, "refresh keeps arch");
assert.strictEqual(back.done[venue], true, "refresh keeps completion");
assert.strictEqual(undoTask(back, venue), true);
assert.strictEqual(back.xp, 0, "undo after refresh: 0 XP");
assert.strictEqual(back.arch, false, "undo after refresh removes arch");

// ---- milestone D: scene unlocks tied to quests, planning progress ----
const byId = (id) => QUESTS.find((q) => q.id === id);
assert.ok(UNLOCKS.length >= 4, "at least 4 unlocks");
assert.strictEqual(new Set(UNLOCKS.map((u) => u.id)).size, UNLOCKS.length, "unlock ids unique");
assert.strictEqual(new Set(UNLOCKS.map((u) => u.quest)).size, UNLOCKS.length, "each unlock tied to its own quest");
for (const u of UNLOCKS) assert.ok(byId(u.quest), "unlock quest exists: " + u.id);
assert.deepStrictEqual(unlocksFor(newState()), [], "fresh world shows no unlocks");

// Completing a quest and its prerequisites in order.
function completeWithPrereqs(st, id) {
  for (const p of byId(id).prereqs || []) if (!st.done[p]) completeWithPrereqs(st, p);
  assert.strictEqual(completeTask(st, id), true, "complete " + id);
}

// Each unlock appears only at its quest, goes away on undo, and comes back on redo with no duplicate XP.
for (const u of UNLOCKS) {
  const w = newState();
  completeWithPrereqs(w, u.quest);
  assert.ok(unlocksFor(w).includes(u.id), u.id + " appears when its quest is done");
  const xpDone = w.xp;
  assert.strictEqual(undoTask(w, u.quest), true, "undo " + u.quest);
  assert.ok(!unlocksFor(w).includes(u.id), u.id + " goes away on undo");
  assert.strictEqual(completeTask(w, u.quest), true, "redo " + u.quest);
  assert.ok(unlocksFor(w).includes(u.id), u.id + " comes back on redo");
  assert.strictEqual(w.xp, xpDone, u.id + ": redo gives no duplicate XP");
  assert.strictEqual(unlocksFor(w).filter((x) => x === u.id).length, 1, u.id + " shows once");
  assert.strictEqual(completeTask(w, u.quest), false, u.id + ": repeat completion gives nothing");
}

// An unlock does not show before its quest, even with other quests done.
const pre = newState();
completeWithPrereqs(pre, "book-florist");
assert.ok(unlocksFor(pre).includes("flowers"));
assert.ok(!unlocksFor(pre).includes("tables"), "tables wait for the caterer");
assert.ok(!unlocksFor(pre).includes("lights"), "lights wait for the music");

// Planning progress: percent of quests completed, separate from XP.
const pr = newState();
assert.strictEqual(progressPercent(pr), 0);
assert.strictEqual(completedCount(pr), 0);
completeWithPrereqs(pr, "book-venue");
assert.strictEqual(completedCount(pr), 1);
assert.strictEqual(progressPercent(pr), Math.round(100 / QUESTS.length), "one quest is its share of all quests");
assert.strictEqual(pr.xp, 100, "progress is not XP");
completeWithPrereqs(pr, "set-date");
completeWithPrereqs(pr, "pick-theme");
assert.strictEqual(completedCount(pr), 3);
assert.strictEqual(progressPercent(pr), Math.round(300 / QUESTS.length));
assert.strictEqual(pr.xp, 100 + 50 + 50, "XP still counts by quest XP, not percent");
undoTask(pr, "pick-theme");
assert.strictEqual(completedCount(pr), 2, "undo lowers progress");
assert.strictEqual(progressPercent(pr), Math.round(200 / QUESTS.length));
const all = newState();
for (const q of QUESTS) if (!all.done[q.id]) completeWithPrereqs(all, q.id);
assert.strictEqual(progressPercent(all), 100, "all quests done is 100%");

// Unlocks and progress survive a refresh (save and reload).
const store2 = new Map();
const st2 = { getItem: (k) => (store2.has(k) ? store2.get(k) : null), setItem: (k, v) => store2.set(k, String(v)) };
const keep = newState();
completeWithPrereqs(keep, "book-caterer");
saveState(st2, keep);
const back2 = loadState(st2);
assert.deepStrictEqual(unlocksFor(back2), unlocksFor(keep), "refresh keeps unlocks");
assert.strictEqual(progressPercent(back2), progressPercent(keep), "refresh keeps progress");

// ---- milestone E: custom tasks ----
const { allQuests, saveCustom, deleteCustom, customError } = G;
const mine = (over) => ({ name: "Book the bus", category: "Transport", xp: 100, due: "", prereq: "", ...over });

// A save from before custom tasks loads with none.
store.set(STORAGE_KEY, JSON.stringify({ xp: 0, done: {}, arch: false, profile: null }));
assert.deepStrictEqual(loadState(storage).custom, [], "old save loads with no custom tasks");

// Validation: name, category, reward size, date and prerequisite are checked; nothing is saved on error.
const v = newState();
assert.strictEqual(saveCustom(v, mine({ name: " " })), "Give the task a name.");
assert.strictEqual(saveCustom(v, mine({ category: "" })), "Add a category.");
assert.strictEqual(saveCustom(v, mine({ xp: 75 })), "Pick quick, standard or major.");
assert.strictEqual(saveCustom(v, mine({ due: "June" })), "Use a date like 2027-06-01.");
assert.strictEqual(saveCustom(v, mine({ prereq: "nope" })), "Pick a prerequisite from the list.");
assert.strictEqual(customError(v, mine({ xp: 200 })), null, "valid task passes");
assert.strictEqual(v.custom.length, 0, "invalid task is not saved");

// Add a custom task: name is trimmed, it gets its own id, and an empty due date is left out.
assert.strictEqual(saveCustom(v, mine({ name: "  Book the bus  ", xp: 50 })), null);
assert.strictEqual(v.custom.length, 1);
assert.strictEqual(v.custom[0].name, "Book the bus", "name is trimmed");
assert.strictEqual(v.custom[0].xp, 50);
assert.ok(v.custom[0].id.startsWith("custom-"), "custom task gets its own id");
assert.strictEqual(v.custom[0].due, undefined, "no due date when left empty");

// A custom task can need a built-in quest, and stays blocked until it is done.
assert.strictEqual(saveCustom(v, mine({ name: "Pay the bus firm", xp: 200, due: FUTURE, prereq: "set-date" })), null);
const pay = v.custom[1];
assert.strictEqual(questStatus(v, pay, TODAY), "blocked", "custom task waits for its prerequisite");
assert.strictEqual(completeTask(v, pay.id), false, "blocked custom task refuses completion");
completeTask(v, "set-date");
assert.strictEqual(questStatus(v, pay, TODAY), "upcoming", "custom task with a future due date is upcoming");

// Complete, undo and redo work exactly like a built-in task.
const xp0 = v.xp;
const bus = v.custom[0];
assert.strictEqual(completeTask(v, bus.id), true, "custom task completes");
assert.strictEqual(v.xp, xp0 + 50, "custom task gives its XP");
assert.strictEqual(completeTask(v, bus.id), false, "custom task gives XP once");
assert.strictEqual(v.xp, xp0 + 50);
assert.strictEqual(undoTask(v, bus.id), true, "custom task undoes");
assert.strictEqual(v.xp, xp0, "undo takes the XP back");
assert.strictEqual(undoTask(v, bus.id), false, "cannot undo twice");
assert.strictEqual(completeTask(v, bus.id), true, "custom task redoes");
assert.strictEqual(v.xp, xp0 + 50, "redo gives XP once");

// A major custom task moves the level like a built-in one.
const lv = newState();
saveCustom(lv, mine({ name: "Honeymoon", xp: 200 }));
completeTask(lv, lv.custom[0].id);
assert.strictEqual(levelFor(lv.xp), 2, "200 XP custom task reaches level 2");

// Custom tasks count in the planning progress total.
const pg = newState();
saveCustom(pg, mine({ name: "Seat cards", xp: 50 }));
assert.strictEqual(allQuests(pg).length, QUESTS.length + 1, "custom task is in the total");
assert.strictEqual(progressPercent(pg), 0);
completeTask(pg, pg.custom[0].id);
assert.strictEqual(completedCount(pg), 1, "custom completion counts");
assert.strictEqual(progressPercent(pg), Math.round(100 / (QUESTS.length + 1)), "its share of all tasks");

// Editing: fields change, the count stays, and a completed task's XP follows its new size.
assert.strictEqual(saveCustom(pg, mine({ name: "Seat cards and place names", category: "Guests", xp: 200 }), pg.custom[0].id), null, "edit saves");
assert.strictEqual(pg.custom.length, 1, "edit does not add a task");
assert.strictEqual(pg.custom[0].name, "Seat cards and place names");
assert.strictEqual(pg.custom[0].category, "Guests");
assert.strictEqual(pg.xp, 200, "completed task's XP follows its new size");
assert.strictEqual(completedCount(pg), 1, "still completed after edit");

// Two custom tasks cannot need each other, or themselves.
saveCustom(pg, mine({ name: "Table plan", xp: 50 }));
const seat = pg.custom[0], table = pg.custom[1];
assert.strictEqual(saveCustom(pg, mine({ name: "Seat cards and place names", xp: 200, prereq: seat.id }), seat.id), "A task cannot need itself.");
assert.strictEqual(saveCustom(pg, mine({ name: "Table plan", xp: 50, prereq: seat.id }), table.id), null, "table needs seat cards");
assert.strictEqual(saveCustom(pg, mine({ name: "Seat cards and place names", xp: 200, prereq: table.id }), seat.id), "That task needs this one already.");

// Deleting a completed custom task removes its XP; a task that needed it is no longer blocked by it.
assert.strictEqual(deleteCustom(pg, seat.id), true, "delete seat cards");
assert.strictEqual(pg.xp, 0, "deleting a completed custom task removes its XP");
assert.strictEqual(completedCount(pg), 0, "deleted task no longer counts");
assert.strictEqual(pg.custom.length, 1);
assert.strictEqual(pg.custom[0].prereqs, undefined, "table no longer needs the deleted task");
assert.strictEqual(questStatus(pg, pg.custom[0], TODAY), "available");
assert.strictEqual(deleteCustom(pg, seat.id), false, "cannot delete twice");

// Custom tasks and their completion survive a refresh, and still undo after it.
const store4 = new Map();
const st4 = { getItem: (k) => (store4.has(k) ? store4.get(k) : null), setItem: (k, v) => store4.set(k, String(v)) };
const keep2 = newState();
saveCustom(keep2, mine({ name: "Cake tasting", xp: 100, due: "2027-03-01", prereq: "set-date" }));
completeTask(keep2, "set-date");
completeTask(keep2, keep2.custom[0].id);
saveState(st4, keep2);
const back4 = loadState(st4);
assert.strictEqual(JSON.stringify(back4.custom), JSON.stringify(keep2.custom), "refresh keeps custom tasks");
assert.strictEqual(back4.xp, keep2.xp, "refresh keeps XP");
assert.strictEqual(completedCount(back4), 2, "refresh keeps completion");
assert.strictEqual(undoTask(back4, back4.custom[0].id), true, "custom task undoes after refresh");
assert.strictEqual(back4.xp, keep2.xp - 100, "undo after refresh takes XP back");

console.log("ok: all milestone B, C, D and E tests passed");
