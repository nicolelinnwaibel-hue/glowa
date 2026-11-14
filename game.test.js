// Run: node game.test.js
const assert = require("assert");
const { newState, completeTask, loadState, saveState, STORAGE_KEY } = require("./game.js");

// XP is awarded once, no matter how often Complete is triggered.
const s = newState();
assert.strictEqual(completeTask(s, "book-venue"), true);
assert.strictEqual(s.xp, 100);
assert.strictEqual(s.arch, true);
assert.strictEqual(completeTask(s, "book-venue"), false);
assert.strictEqual(completeTask(s, "book-venue"), false);
assert.strictEqual(s.xp, 100, "XP must not double-count");

// Unknown task gives nothing.
assert.strictEqual(completeTask(s, "nope"), false);
assert.strictEqual(s.xp, 100);

// Save and reload keeps XP, completion and arch.
const store = new Map();
const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
saveState(storage, s);
const r = loadState(storage);
assert.strictEqual(r.xp, 100);
assert.strictEqual(r.done["book-venue"], true);
assert.strictEqual(r.arch, true);
assert.strictEqual(completeTask(r, "book-venue"), false, "reloaded state still blocks double XP");

// Broken save falls back to fresh state.
store.set(STORAGE_KEY, "{not json");
assert.strictEqual(loadState(storage).xp, 0);

console.log("ok: all XP logic tests passed");
