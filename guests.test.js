// Run: node guests.test.js
const assert = require("assert");
const fs = require("fs");
const G = require("./guests-core.js");
const X = require("./xlsx-lite.js");
const Game = require("./game.js");
const World = require("./world-core.js");

const NOW = "2026-11-16T00:00:00.000Z";
const table = (text) => G.tableFrom(G.parseCsv(text));
const bring = (book, text, dup) => { const t = table(text); return G.applyImport(book, G.planImport(book, t, G.exportMapping(t.headers) || G.guessMapping(t.headers), dup || "merge"), { file: "test.csv" }, NOW); };

(async () => {
  // ---- CSV reading ----
  assert.deepStrictEqual(G.parseCsv('﻿Name,Group\r\n"Smith, Jo","Bride\'s ""A"" team"\r\n\r\n  ,  \r\nAl,\n'),
    [["Name", "Group"], ["Smith, Jo", 'Bride\'s "A" team'], ["Al", ""]], "quotes, commas in quotes, doubled quotes, blank lines, byte-order mark");
  assert.deepStrictEqual(G.parseCsv('a,"line one\nline two",c'), [["a", "line one\nline two", "c"]], "a line break inside quotes stays in the cell");
  assert.deepStrictEqual(G.parseCsv("Name;Side\nAna;Bride"), [["Name", "Side"], ["Ana", "Bride"]], "semicolon files");
  assert.deepStrictEqual(G.parseCsv("Name\tSide\nAna\tBride"), [["Name", "Side"], ["Ana", "Bride"]], "tab files");
  assert.deepStrictEqual(G.parseCsv(""), []);
  assert.deepStrictEqual(G.tableFrom([["Name", ""], ["Ana", "x", "y"]]).headers, ["Name", "Column 2", "Column 3"], "unnamed columns get a name");

  // ---- column guessing: any column names ----
  assert.deepStrictEqual(G.guessMapping(["Full Name", "Plus one", "Side"]), { name: 0, last: -1, comp: 1, group: 2, id: -1 });
  assert.deepStrictEqual(G.guessMapping(["Email", "First Name", "Last Name", "Partner", "Household"]), { name: 1, last: 2, comp: 3, group: 4, id: -1 });
  assert.strictEqual(G.guessMapping(["Email", "Guest Name", "Bringing", "Household"]).comp, 2, "\"Bringing\" is read as the companion column");
  assert.deepStrictEqual(G.guessMapping(["Guest", "Table"]), { name: 0, last: -1, comp: -1, group: 1, id: -1 });
  assert.strictEqual(G.guessMapping(["Who", "Notes"]).name, 0, "with no clue, the first column is offered as the name");

  // ---- companions: never an extra named guest by surprise ----
  assert.deepStrictEqual(G.readCompanion(" yes "), { plusOne: true, name: "" });
  assert.deepStrictEqual(G.readCompanion("+1"), { plusOne: true, name: "" });
  assert.deepStrictEqual(G.readCompanion("No"), { plusOne: false, name: "" });
  assert.deepStrictEqual(G.readCompanion(""), { plusOne: false, name: "" });
  assert.deepStrictEqual(G.readCompanion("Sam Lee"), { plusOne: false, name: "Sam Lee" });

  // ---- import: ids, companions, counts ----
  const book = G.newBook();
  let sum = bring(book, "Full Name,Plus one,Side\nAna Ruiz,yes,Bride\nBen Cole,Cara Dunn,Groom\nCara Dunn,Ben Cole,Groom\nDev Shah,Zed Not-Listed,Work\n,yes,Nobody\nEve Park,,\n");
  assert.deepStrictEqual(sum, { added: 5, updated: 0, merged: 0, skipped: 1 }, "the row with no name is skipped, not guessed");
  const [ana, ben, cara, dev, eve] = book.guests;
  assert.ok(book.guests.every((g) => G.isUuid(g.id)), "every guest has a unique id");
  assert.strictEqual(new Set(book.guests.map((g) => g.id)).size, 5);
  assert.deepStrictEqual(book.guests.map((g) => g.code), ["G-001", "G-002", "G-003", "G-004", "G-005"]);
  assert.strictEqual(ana.plusOne, true, "an unnamed plus-one is a flag on the guest");
  assert.strictEqual(ben.companionId, cara.id, "two guests who name each other are linked");
  assert.strictEqual(cara.companionId, ben.id);
  assert.strictEqual(dev.companionName, "Zed Not-Listed", "a companion who is not on the list is kept as a name only");
  assert.strictEqual(book.guests.length, 5, "no guest was created for a plus-one or an unlisted companion");
  assert.deepStrictEqual(G.counts(book), { guests: 5, withCompanion: 4, extra: 2, headcount: 7 });
  assert.strictEqual(G.companionLabel(book, ben), "Cara Dunn");
  assert.strictEqual(G.companionLabel(book, ana), "+1");
  assert.strictEqual(G.companionLabel(book, eve), "");
  assert.deepStrictEqual(ana.look, G.lookFor(ana.id), "a guest's look comes from their id");
  assert.strictEqual(book.batches.length, 1);
  assert.ok(!JSON.stringify(book).includes("Nobody"), "nothing from a skipped row is kept");

  // ---- duplicates: merge or keep both ----
  const dupText = "Name,Group\nana  RUIZ,Bride's family\nFay Wong,Work\nFay Wong,Work\n";
  const t2 = table(dupText);
  let plan = G.planImport(book, t2, G.guessMapping(t2.headers), "merge");
  assert.deepStrictEqual(plan.duplicateNames, ["ana RUIZ", "Fay Wong"], "found against the book and inside the file, ignoring case and spacing");
  assert.strictEqual(plan.adds.length, 1);
  assert.strictEqual(plan.merges.length, 2);
  plan = G.planImport(book, t2, G.guessMapping(t2.headers), "keep");
  assert.strictEqual(plan.adds.length, 3, "keep both adds every row");
  assert.strictEqual(book.guests.length, 5, "planning changes nothing");
  bring(book, dupText, "merge");
  assert.strictEqual(book.guests.length, 6);
  assert.strictEqual(ana.group, "Bride", "merging never overwrites what a guest already has");
  assert.strictEqual(ana.name, "Ana Ruiz");
  bring(book, "Name,Group\nEve Park,Neighbours\n", "merge");
  assert.strictEqual(eve.group, "Neighbours", "merging fills a gap");
  assert.strictEqual(G.nameKey("José  Díaz"), G.nameKey("jose diaz"), "accents and spacing do not make a different person");

  // ---- roster: add, edit, search, delete, undo ----
  assert.strictEqual(G.addGuest(book, "   ").error, "Type a name first.");
  const gil = G.addGuest(book, "  Gil   Moss ", NOW).guest;
  assert.strictEqual(gil.name, "Gil Moss");
  assert.strictEqual(gil.code, "G-007");
  assert.strictEqual(G.editGuest(book, gil.id, { name: "", group: "x" }), "A guest needs a name.");
  assert.strictEqual(G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "eve park" }, NOW), null);
  assert.strictEqual(gil.companionId, eve.id, "typing a listed guest's name links them");
  assert.strictEqual(eve.companionId, gil.id);
  assert.strictEqual(G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "" }), null);
  assert.strictEqual(eve.companionId, null, "clearing a companion unlinks both");
  assert.strictEqual(G.editGuest(book, "nope", { name: "x" }), "That guest is no longer on the list.");
  assert.deepStrictEqual(G.searchGuests(book, "GROOM").map((g) => g.name), ["Ben Cole", "Cara Dunn"], "search by group");
  assert.deepStrictEqual(G.searchGuests(book, "moss").map((g) => g.name), ["Gil Moss-Park"], "search by name");
  assert.deepStrictEqual(G.searchGuests(book, "g-003").map((g) => g.name), ["Cara Dunn"], "search by code");
  assert.strictEqual(G.searchGuests(book, "").length, 7);
  const benId = ben.id, benLook = { ...ben.look };
  const removed = G.deleteGuest(book, benId);
  assert.strictEqual(book.guests.length, 6);
  assert.strictEqual(cara.companionId, null, "deleting a guest unlinks their companion");
  assert.strictEqual(G.deleteGuest(book, benId), null);
  assert.strictEqual(G.undoDelete(book, removed), true);
  assert.strictEqual(book.guests[1].id, benId, "undo puts the guest back in the same place");
  assert.deepStrictEqual(book.guests[1].look, benLook);
  assert.strictEqual(cara.companionId, benId, "and restores the link");
  assert.strictEqual(G.undoDelete(book, removed), false, "undo works once");

  // ---- export, and bringing an export back in ----
  ana.look.outfit = "#39405F"; // a customisation that must survive
  G.editGuest(book, dev.id, { name: "=cmd()", group: "Work" }, NOW);
  const csv = G.exportCsv(book);
  const out = G.parseCsv(csv);
  assert.deepStrictEqual(out[0], G.EXPORT_HEADERS);
  assert.strictEqual(out.length, 8, "one line per guest");
  assert.deepStrictEqual(out[1], ["Ana Ruiz", "Bride", "", "Yes", "G-001", ana.id]);
  assert.deepStrictEqual(out[2].slice(0, 4), ["Ben Cole", "Groom", "Cara Dunn", ""]);
  assert.strictEqual(out[4][0], "'=cmd()", "a name that looks like a formula is exported as text");
  const idsBefore = book.guests.map((g) => g.id);
  sum = bring(book, csv.replace("Ben Cole,Groom", "Benjamin Cole,Groom side"));
  assert.deepStrictEqual(sum, { added: 0, updated: 7, merged: 0, skipped: 0 }, "an exported list updates the same guests");
  assert.deepStrictEqual(book.guests.map((g) => g.id), idsBefore, "ids are kept through export and import");
  assert.strictEqual(ben.name, "Benjamin Cole", "an edit made in the spreadsheet comes back");
  assert.strictEqual(ben.group, "Groom side");
  assert.strictEqual(ana.look.outfit, "#39405F", "customisations are kept");
  assert.strictEqual(ana.plusOne, true);
  assert.strictEqual(dev.name, "=cmd()", "the protective apostrophe is removed on the way back in");
  assert.strictEqual(ben.companionId, cara.id, "a renamed guest stays linked, though the other row still used the old name");
  assert.strictEqual(cara.companionId, ben.id);
  assert.strictEqual(G.exportCsv(book), csv.replace("Ben Cole,Groom", "Benjamin Cole,Groom side").replace("Groom,Ben Cole", "Groom,Benjamin Cole"), "export, import, export gives the same list with the new name everywhere");

  // ---- saving: own key, survives reload, damage is contained ----
  const store = {};
  const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const planner = Game.newState();
  Game.completeTask(planner, "book-venue");
  Game.saveState(fake, planner);
  World.saveCam(fake, { zoom: 1.2, panX: 5, panY: 6 });
  const plannerBefore = store[Game.STORAGE_KEY], worldBefore = store[World.WORLD_KEY];
  assert.strictEqual(G.saveBook(fake, book), true);
  assert.strictEqual(new Set([G.GUESTS_KEY, Game.STORAGE_KEY, World.WORLD_KEY]).size, 3, "three separate saves");
  assert.strictEqual(store[Game.STORAGE_KEY], plannerBefore, "the planner's save is untouched");
  assert.strictEqual(store[World.WORLD_KEY], worldBefore, "the world's save is untouched");
  assert.deepStrictEqual(G.loadBook(fake), book, "the guestbook survives a reload exactly");
  assert.ok(!store[G.GUESTS_KEY].includes("test.csv,") && !store[G.GUESTS_KEY].includes("Full Name"), "the raw spreadsheet is not stored");
  assert.strictEqual(G.loadBook({ getItem: () => "{broken" }).guests.length, 0, "a broken save starts fresh");
  assert.strictEqual(G.loadBook({ getItem: () => { throw new Error("blocked"); } }).guests.length, 0);
  assert.strictEqual(G.saveBook({ setItem: () => { throw new Error("full"); } }, book), false, "a failed save is reported");
  const idA = G.uuid(), idB = G.uuid();
  const hurt = G.loadBook({ getItem: () => JSON.stringify({ guests: [
    { id: idA, name: "Kept One", code: "G-004", companionId: idB, look: { hair: "nope", style: "mohawk" } },
    { id: idA, name: "Same id again" }, { id: "not-an-id", name: "Bad id" }, { id: G.uuid(), name: "   " }, null,
    { id: idB, name: "Kept Two", code: "G-004", companionId: G.uuid() },
  ] }) });
  assert.deepStrictEqual(hurt.guests.map((g) => g.name), ["Kept One", "Kept Two"], "damaged guests are dropped one by one");
  assert.deepStrictEqual(hurt.guests.map((g) => g.code), ["G-004", "G-005"], "codes stay unique");
  assert.strictEqual(hurt.guests[1].companionId, null, "a link to nobody is cleared");
  assert.strictEqual(hurt.guests[0].companionId, null, "a one-way link is cleared when the other guest points elsewhere");
  assert.deepStrictEqual(hurt.guests[0].look, G.lookFor(idA), "a damaged look falls back to the guest's own");

  // ---- the sample list and the size limit ----
  const sample = G.sampleTable();
  const sb = G.newBook();
  const sp = G.planImport(sb, sample, G.guessMapping(sample.headers), "merge");
  assert.strictEqual(sp.adds.length, 120, "120 different sample guests");
  G.applyImport(sb, sp, { file: "sample" }, NOW);
  assert.deepStrictEqual(G.counts(sb), { guests: 120, withCompanion: 24, extra: 24, headcount: 144 });
  const big = { headers: ["Name"], rows: Array.from({ length: G.MAX_GUESTS + 30 }, (_, i) => ["Person " + i]) };
  const bp = G.planImport(sb, big, { name: 0, last: -1, comp: -1, group: -1, id: -1 }, "merge");
  assert.strictEqual(bp.adds.length, G.MAX_GUESTS - 120, "the guestbook stops at its limit");
  assert.strictEqual(bp.skipped.length, 150);

  // ---- Excel files ----
  const wb = await X.readXlsx(fs.readFileSync("test-files/guests.xlsx"));
  assert.deepStrictEqual(wb.sheets.map((s) => s.name), ["Guests", "Venue costs"], "sheets are listed, empty ones left out");
  assert.deepStrictEqual(wb.sheets[0].rows[1], ["Ana", "García & Co", "Yes", "Bride's family", "Vegetarian"], "accents, & and apostrophes read correctly");
  assert.deepStrictEqual(wb.sheets[0].rows[3], ["Carla", "Díaz", "Ben O'Neil", "Groom's family", "a < b"]);
  assert.strictEqual(wb.sheets[0].rows.length, 6, "the blank row is dropped");
  assert.strictEqual(wb.sheets[0].rows[4][4], "42", "numbers come through as text");
  const xt = G.tableFrom(wb.sheets[0].rows);
  const xm = G.guessMapping(xt.headers);
  assert.deepStrictEqual(xm, { name: 0, last: 1, comp: 2, group: 3, id: -1 }, "first and last name columns are joined");
  const xb = G.newBook();
  const xp = G.planImport(xb, xt, xm, "merge");
  assert.deepStrictEqual(xp.duplicateNames, ["Ana García & Co"]);
  G.applyImport(xb, xp, { file: "guests.xlsx", sheet: "Guests" }, NOW);
  assert.deepStrictEqual(xb.guests.map((g) => g.name), ["Ana García & Co", "Ben O'Neil", "Carla Díaz", "Dev Shah"]);
  assert.strictEqual(xb.guests[1].companionId, xb.guests[2].id, "companions link from an Excel file too");
  assert.deepStrictEqual(G.counts(xb), { guests: 4, withCompanion: 3, extra: 1, headcount: 5 });
  await assert.rejects(X.readXlsx(new TextEncoder().encode("Name,Group\nAna,Bride\n")), /does not look like an Excel file/, "a file that is not Excel gives a clear message");

  console.log("ok: guestbook tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
