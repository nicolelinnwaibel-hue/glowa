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

  // ---- what a companion cell means ----
  assert.deepStrictEqual(G.readCompanion(" yes "), { plusOne: true, name: "" });
  assert.deepStrictEqual(G.readCompanion("+1"), { plusOne: true, name: "" });
  assert.deepStrictEqual(G.readCompanion("No"), { plusOne: false, name: "" });
  assert.deepStrictEqual(G.readCompanion(""), { plusOne: false, name: "" });
  assert.deepStrictEqual(G.readCompanion("Sam Lee"), { plusOne: false, name: "Sam Lee" });

  // ---- import: ids, companions, and plus-ones as guests (Nicole's decision: a plus-one counts as a guest) ----
  const book = G.newBook();
  const firstText = "Full Name,Plus one,Side\nAna Ruiz,yes,Bride\nBen Cole,Cara Dunn,Groom\nCara Dunn,Ben Cole,Groom\nDev Shah,Zed Not-Listed,Work\n,yes,Nobody\nEve Park,,\n";
  const ft = table(firstText);
  assert.strictEqual(G.planImport(book, ft, G.guessMapping(ft.headers), "merge").plusOnes, 2, "the plan says how many plus-ones will be made");
  let sum = bring(book, firstText);
  assert.deepStrictEqual(sum, { added: 5, updated: 0, merged: 0, skipped: 1, plusOnes: 2 }, "the row with no name is skipped, not guessed");
  const byName = (n) => book.guests.find((g) => g.name === n);
  const ana = byName("Ana Ruiz"), ben = byName("Ben Cole"), cara = byName("Cara Dunn"), dev = byName("Dev Shah"), eve = byName("Eve Park");
  const anaPlus = byName("Ana Ruiz's plus-one"), zed = byName("Zed Not-Listed");
  assert.deepStrictEqual(book.guests.map((g) => g.name), ["Ana Ruiz", "Ana Ruiz's plus-one", "Ben Cole", "Cara Dunn", "Dev Shah", "Zed Not-Listed", "Eve Park"], "a plus-one sits straight after their host");
  assert.ok(book.guests.every((g) => G.isUuid(g.id)), "every guest, plus-ones included, has a unique id");
  assert.strictEqual(new Set(book.guests.map((g) => g.id)).size, 7);
  assert.strictEqual(new Set(book.guests.map((g) => g.code)).size, 7, "and a code of their own");
  assert.strictEqual(anaPlus.plusOneOf, ana.id, "an unnamed plus-one is a guest attached to their host");
  assert.strictEqual(anaPlus.unnamed, true);
  assert.strictEqual(ana.companionId, anaPlus.id);
  assert.strictEqual(anaPlus.companionId, ana.id);
  assert.strictEqual(anaPlus.group, "Bride", "a plus-one starts in their host's group");
  assert.strictEqual(anaPlus.look.outfit, G.PLUS_ONE_OUTFIT, "a plus-one has a distinct colour");
  assert.ok(!G.LOOKS.outfit.includes(G.PLUS_ONE_OUTFIT), "which no other guest starts with");
  assert.strictEqual(zed.plusOneOf, dev.id, "a companion who is named but not on the list becomes that guest's plus-one");
  assert.strictEqual(zed.unnamed, false);
  assert.strictEqual(ben.companionId, cara.id, "two listed guests who name each other are linked");
  assert.strictEqual(cara.companionId, ben.id);
  assert.strictEqual(ben.plusOneOf, null, "and neither is a plus-one");
  assert.deepStrictEqual(G.counts(book), { guests: 7, plusOnes: 2, withCompanion: 4 }, "plus-ones are in the guest count");
  assert.strictEqual(G.companionLabel(book, ben), "Cara Dunn");
  assert.strictEqual(G.companionLabel(book, ana), "Ana Ruiz's plus-one");
  assert.strictEqual(G.hostLabel(book, anaPlus), "Ana Ruiz");
  assert.strictEqual(G.companionLabel(book, eve), "");
  assert.deepStrictEqual(ana.look, G.lookFor(ana.id), "a guest's look comes from their id");
  assert.strictEqual(book.batches.length, 1);
  assert.ok(!JSON.stringify(book).includes("Nobody"), "nothing from a skipped row is kept");

  // ---- duplicates: merge or keep both ----
  const dupText = "Name,Group,Plus one\nana  RUIZ,Bride's family,yes\nFay Wong,Work,\nFay Wong,Work,\n";
  const t2 = table(dupText);
  let plan = G.planImport(book, t2, G.guessMapping(t2.headers), "merge");
  assert.deepStrictEqual(plan.duplicateNames, ["ana RUIZ", "Fay Wong"], "found against the book and inside the file, ignoring case and spacing");
  assert.strictEqual(plan.adds.length, 1);
  assert.strictEqual(plan.merges.length, 2);
  assert.strictEqual(plan.plusOnes, 0, "a guest who already has a plus-one does not get a second");
  plan = G.planImport(book, t2, G.guessMapping(t2.headers), "keep");
  assert.strictEqual(plan.adds.length, 3, "keep both adds every row");
  assert.strictEqual(book.guests.length, 7, "planning changes nothing");
  bring(book, dupText, "merge");
  assert.strictEqual(book.guests.length, 8);
  assert.strictEqual(ana.group, "Bride", "merging never overwrites what a guest already has");
  assert.strictEqual(ana.name, "Ana Ruiz");
  assert.strictEqual(book.guests.filter((g) => g.plusOneOf === ana.id).length, 1, "still one plus-one");
  bring(book, "Name,Group\nEve Park,Neighbours\n", "merge");
  assert.strictEqual(eve.group, "Neighbours", "merging fills a gap");
  assert.strictEqual(G.nameKey("José  Díaz"), G.nameKey("jose diaz"), "accents and spacing do not make a different person");

  // ---- roster: add, edit, search ----
  assert.strictEqual(G.addGuest(book, "   ").error, "Type a name first.");
  const gil = G.addGuest(book, "  Gil   Moss ", NOW).guest;
  assert.strictEqual(gil.name, "Gil Moss");
  assert.strictEqual(G.editGuest(book, gil.id, { name: "", group: "x" }), "A guest needs a name.");
  assert.strictEqual(G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "eve park" }, NOW), null);
  assert.strictEqual(gil.companionId, eve.id, "typing a listed guest's name links them");
  assert.strictEqual(eve.companionId, gil.id);
  assert.strictEqual(book.guests.length, 9, "linking two listed guests adds nobody");
  assert.strictEqual(G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "" }), null);
  assert.strictEqual(eve.companionId, null, "clearing a companion unlinks both");
  assert.strictEqual(G.editGuest(book, "nope", { name: "x" }), "That guest is no longer on the list.");
  assert.deepStrictEqual(G.searchGuests(book, "GROOM").map((g) => g.name), ["Ben Cole", "Cara Dunn"], "search by group");
  assert.deepStrictEqual(G.searchGuests(book, "moss").map((g) => g.name), ["Gil Moss-Park"], "search by name");
  assert.deepStrictEqual(G.searchGuests(book, cara.code).map((g) => g.name), ["Cara Dunn"], "search by code");
  assert.deepStrictEqual(G.searchGuests(book, "plus-one").map((g) => g.name), ["Ana Ruiz's plus-one"], "a plus-one can be found like any guest");
  assert.strictEqual(G.searchGuests(book, "").length, 9);

  // ---- plus-ones behave like any guest: add, name, rename host, remove, undo ----
  G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "+1" }, NOW);
  const gilPlus = G.plusOneOfHost(book, gil);
  assert.ok(gilPlus && G.isUuid(gilPlus.id) && gilPlus.id !== gil.id, "typing +1 gives the guest a plus-one with their own id");
  assert.strictEqual(gilPlus.name, "Gil Moss-Park's plus-one");
  assert.strictEqual(book.guests.length, 10);
  assert.strictEqual(book.guests.indexOf(gilPlus), book.guests.indexOf(gil) + 1);
  G.editGuest(book, gil.id, { name: "Gil Moss-Park", group: "Work", companion: "+1" }, NOW);
  assert.strictEqual(book.guests.length, 10, "saving again does not add a second plus-one");
  G.editGuest(book, gil.id, { name: "Gil Park", group: "Work", companion: "+1" }, NOW);
  assert.strictEqual(gilPlus.name, "Gil Park's plus-one", "an unnamed plus-one follows their host's name");
  G.editGuest(book, gil.id, { name: "Gil Park", group: "Work", companion: "Rio Vega" }, NOW);
  assert.strictEqual(gilPlus.name, "Rio Vega", "typing a name names the plus-one they already have");
  assert.strictEqual(book.guests.length, 10);
  assert.strictEqual(gilPlus.unnamed, false);
  G.editGuest(book, gil.id, { name: "Gil Parker", group: "Work", companion: "Rio Vega" }, NOW);
  assert.strictEqual(gilPlus.name, "Rio Vega", "a named plus-one keeps their name when the host is renamed");
  assert.strictEqual(G.editGuest(book, gilPlus.id, { name: "Rio de la Vega", group: "Friends", companion: "Somebody Else" }, NOW), null);
  assert.strictEqual(gilPlus.plusOneOf, gil.id, "a plus-one stays attached to their host");
  assert.strictEqual(gilPlus.companionId, gil.id);
  // removing just the plus-one
  let removed = G.deleteGuest(book, gilPlus.id);
  assert.strictEqual(book.guests.length, 9, "a plus-one can be removed on their own");
  assert.ok(book.guests.includes(gil), "the host stays");
  assert.strictEqual(gil.companionId, null);
  assert.deepStrictEqual(G.counts(book), { guests: 9, plusOnes: 2, withCompanion: 4 });
  assert.strictEqual(G.undoDelete(book, removed), true);
  assert.strictEqual(book.guests.indexOf(gilPlus), book.guests.indexOf(gil) + 1, "undo puts the plus-one back in the same place");
  assert.strictEqual(gil.companionId, gilPlus.id, "and back with their host");
  assert.strictEqual(G.undoDelete(book, removed), false, "undo works once");
  // removing the host
  const order = book.guests.map((g) => g.id);
  removed = G.deleteGuest(book, ana.id);
  assert.ok(!book.guests.includes(ana) && !book.guests.includes(anaPlus), "removing a host removes the plus-one they brought");
  assert.strictEqual(book.guests.length, 8);
  assert.strictEqual(G.undoDelete(book, removed), true);
  assert.deepStrictEqual(book.guests.map((g) => g.id), order, "undo puts both back where they were");
  assert.strictEqual(ana.companionId, anaPlus.id);
  assert.strictEqual(anaPlus.plusOneOf, ana.id);
  // removing one of two listed guests
  const benId = ben.id, benLook = { ...ben.look };
  removed = G.deleteGuest(book, benId);
  assert.ok(book.guests.includes(cara), "a linked guest who is not a plus-one stays on the list");
  assert.strictEqual(cara.companionId, null, "deleting a guest unlinks their companion");
  assert.strictEqual(G.deleteGuest(book, benId), null);
  assert.strictEqual(G.undoDelete(book, removed), true);
  assert.deepStrictEqual(book.guests.map((g) => g.id), order);
  assert.deepStrictEqual(ben.look, benLook);
  assert.strictEqual(cara.companionId, benId, "and undo restores the link");
  // clearing the companion box removes the plus-one they brought
  G.editGuest(book, gil.id, { name: "Gil Parker", group: "Work", companion: "" }, NOW);
  assert.ok(!book.guests.includes(gilPlus), "clearing a host's companion takes their plus-one off the list");
  assert.strictEqual(book.guests.length, 9);
  // choosing a listed guest instead replaces a plus-one
  G.editGuest(book, dev.id, { name: "Dev Shah", group: "Work", companion: "Fay Wong" }, NOW);
  assert.ok(!book.guests.includes(zed), "linking to a listed guest replaces the plus-one");
  assert.strictEqual(dev.companionId, byName("Fay Wong").id);
  assert.strictEqual(byName("Fay Wong").plusOneOf, null);
  G.editGuest(book, dev.id, { name: "Dev Shah", group: "Work", companion: "Zed Not-Listed" }, NOW);
  const zed2 = G.plusOneOfHost(book, dev);
  assert.strictEqual(zed2.name, "Zed Not-Listed");
  assert.strictEqual(byName("Fay Wong").companionId, null);
  // one guest cannot take another guest's plus-one
  G.editGuest(book, eve.id, { name: "Eve Park", group: "Neighbours", companion: "Zed Not-Listed" }, NOW);
  assert.strictEqual(zed2.plusOneOf, dev.id, "a plus-one is not taken from their host");
  assert.strictEqual(G.plusOneOfHost(book, eve).name, "Zed Not-Listed", "the second guest gets a plus-one of their own");
  G.deleteGuest(book, G.plusOneOfHost(book, eve).id);
  assert.deepStrictEqual(G.counts(book), { guests: 9, plusOnes: 2, withCompanion: 4 });

  // ---- export, and bringing an export back in ----
  ana.look.outfit = "#39405F"; // a customisation that must survive
  G.editGuest(book, eve.id, { name: "=cmd()", group: "Neighbours" }, NOW);
  const csv = G.exportCsv(book);
  const out = G.parseCsv(csv);
  assert.deepStrictEqual(out[0], G.EXPORT_HEADERS);
  assert.strictEqual(out.length, 10, "one line per guest, plus-ones included");
  assert.deepStrictEqual(out[1], ["Ana Ruiz", "Bride", "Ana Ruiz's plus-one", "", ana.code, ana.id]);
  assert.deepStrictEqual(out[2], ["Ana Ruiz's plus-one", "Bride", "Ana Ruiz", "Ana Ruiz", anaPlus.code, anaPlus.id], "a plus-one's line says whose plus-one they are");
  assert.deepStrictEqual(out[3].slice(0, 4), ["Ben Cole", "Groom", "Cara Dunn", ""]);
  assert.ok(out.some((r) => r[0] === "'=cmd()"), "a name that looks like a formula is exported as text");
  const snapshot = () => book.guests.map((g) => [g.id, g.code, g.companionId, g.plusOneOf, g.unnamed].join());
  const before = snapshot();
  const edited = csv.replace("Ben Cole,Groom", "Benjamin Cole,Groom side");
  sum = bring(book, edited);
  assert.deepStrictEqual(sum, { added: 0, updated: 9, merged: 0, skipped: 0, plusOnes: 0 }, "an exported list updates the same guests and makes no new plus-ones");
  assert.deepStrictEqual(snapshot(), before, "ids, codes, links and plus-ones are kept through export and import");
  assert.strictEqual(ben.name, "Benjamin Cole", "an edit made in the spreadsheet comes back");
  assert.strictEqual(ben.group, "Groom side");
  assert.strictEqual(ana.look.outfit, "#39405F", "customisations are kept");
  assert.strictEqual(anaPlus.look.outfit, G.PLUS_ONE_OUTFIT);
  assert.strictEqual(eve.name, "=cmd()", "the protective apostrophe is removed on the way back in");
  assert.strictEqual(ben.companionId, cara.id, "a renamed guest stays linked, though the other row still used the old name");
  assert.strictEqual(G.exportCsv(book), edited.replace("Groom,Ben Cole", "Groom,Benjamin Cole"), "export, import, export gives the same list with the new name everywhere");
  // the same export into an empty guestbook (a new device): plus-ones come back as plus-ones, not doubled
  const fresh = G.newBook();
  sum = bring(fresh, csv);
  assert.deepStrictEqual(sum, { added: 9, updated: 0, merged: 0, skipped: 0, plusOnes: 0 });
  assert.deepStrictEqual(G.counts(fresh), { guests: 9, plusOnes: 2, withCompanion: 4 });
  const fPlus = fresh.guests.find((g) => g.name === "Ana Ruiz's plus-one");
  assert.strictEqual(fPlus.plusOneOf, fresh.guests.find((g) => g.name === "Ana Ruiz").id);
  assert.strictEqual(fPlus.unnamed, true);
  assert.strictEqual(fPlus.look.outfit, G.PLUS_ONE_OUTFIT);

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
  assert.deepStrictEqual(G.loadBook(fake), book, "the guestbook, plus-ones included, survives a reload exactly");
  assert.ok(!store[G.GUESTS_KEY].includes("Full Name"), "the raw spreadsheet is not stored");
  assert.strictEqual(G.loadBook({ getItem: () => "{broken" }).guests.length, 0, "a broken save starts fresh");
  assert.strictEqual(G.loadBook({ getItem: () => { throw new Error("blocked"); } }).guests.length, 0);
  assert.strictEqual(G.saveBook({ setItem: () => { throw new Error("full"); } }, book), false, "a failed save is reported");
  const idA = G.uuid(), idB = G.uuid(), idC = G.uuid(), idD = G.uuid();
  const hurt = G.loadBook({ getItem: () => JSON.stringify({ guests: [
    { id: idA, name: "Kept One", code: "G-004", companionId: idB, look: { hair: "nope", style: "mohawk" } },
    { id: idA, name: "Same id again" }, { id: "not-an-id", name: "Bad id" }, { id: G.uuid(), name: "   " }, null,
    { id: idB, name: "Kept Two", code: "G-004", companionId: G.uuid() },
    { id: idC, name: "Lost Plus-One", plusOneOf: G.uuid(), unnamed: true },
    { id: idD, name: "Older Save", plusOne: true },
  ] }) });
  assert.deepStrictEqual(hurt.guests.map((g) => g.name), ["Kept One", "Kept Two", "Lost Plus-One", "Older Save", "Older Save's plus-one"], "damaged guests are dropped one by one");
  assert.strictEqual(new Set(hurt.guests.map((g) => g.code)).size, 5, "codes stay unique");
  assert.strictEqual(hurt.guests[1].companionId, null, "a link to nobody is cleared");
  assert.strictEqual(hurt.guests[0].companionId, null, "a one-way link is cleared when the other guest points elsewhere");
  assert.deepStrictEqual(hurt.guests[0].look, G.lookFor(idA), "a damaged look falls back to the guest's own");
  assert.strictEqual(hurt.guests[2].plusOneOf, null, "a plus-one whose host is gone becomes a plain guest");
  assert.strictEqual(hurt.guests[4].plusOneOf, idD, "a plus-one noted the older way becomes a guest when loaded");

  // ---- the sample list and the size limit ----
  const sample = G.sampleTable();
  const sb = G.newBook();
  const sp = G.planImport(sb, sample, G.guessMapping(sample.headers), "merge");
  assert.strictEqual(sp.adds.length, 120, "120 different sample guests");
  assert.strictEqual(sp.plusOnes, 24);
  G.applyImport(sb, sp, { file: "sample" }, NOW);
  assert.deepStrictEqual(G.counts(sb), { guests: 144, plusOnes: 24, withCompanion: 24 }, "120 guests and their 24 plus-ones make 144");
  const big = { headers: ["Name", "Plus one"], rows: Array.from({ length: G.MAX_GUESTS + 30 }, (_, i) => ["Person " + i, "yes"]) };
  const bp = G.planImport(sb, big, { name: 0, last: -1, comp: 1, group: -1, id: -1 }, "merge");
  assert.strictEqual(bp.adds.length, G.MAX_GUESTS - 144, "the guestbook stops at its limit");
  assert.strictEqual(bp.plusOnes, 0, "and plus-ones count towards it");
  G.applyImport(sb, bp, { file: "big" }, NOW);
  assert.strictEqual(sb.guests.length, G.MAX_GUESTS, "never more than the limit, plus-ones included");

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
  assert.strictEqual(xb.guests.find((g) => g.name === "Ben O'Neil").companionId, xb.guests.find((g) => g.name === "Carla Díaz").id, "companions link from an Excel file too");
  assert.deepStrictEqual(xb.guests.map((g) => g.name), ["Ana García & Co", "Ana García & Co's plus-one", "Ben O'Neil", "Carla Díaz", "Dev Shah"], "the Excel plus-one is a guest too");
  assert.deepStrictEqual(G.counts(xb), { guests: 5, plusOnes: 1, withCompanion: 3 });
  await assert.rejects(X.readXlsx(new TextEncoder().encode("Name,Group\nAna,Bride\n")), /does not look like an Excel file/, "a file that is not Excel gives a clear message");

  console.log("ok: guestbook tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
