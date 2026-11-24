// Run: node guests.test.js
const assert = require("assert");
const fs = require("fs");
const G = require("./guests-core.js");
const X = require("./xlsx-lite.js");
const Game = require("./game.js");
const World = require("./world-core.js");

const NOW = "2026-11-16T00:00:00.000Z";
// The counts from before the bench, for the older checks below.
const cnt = (b) => { const c = G.counts(b); return { guests: c.guests, plusOnes: c.plusOnes, withCompanion: c.withCompanion }; };
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
  assert.deepStrictEqual(cnt(book), { guests: 7, plusOnes: 2, withCompanion: 4 }, "plus-ones are in the guest count");
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
  assert.deepStrictEqual(cnt(book), { guests: 9, plusOnes: 2, withCompanion: 4 });
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
  assert.deepStrictEqual(cnt(book), { guests: 9, plusOnes: 2, withCompanion: 4 });

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
  assert.deepStrictEqual(cnt(fresh), { guests: 9, plusOnes: 2, withCompanion: 4 });
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
  assert.deepStrictEqual(cnt(sb), { guests: 144, plusOnes: 24, withCompanion: 24 }, "120 guests and their 24 plus-ones make 144");
  const big = { headers: ["Name", "Plus one"], rows: Array.from({ length: G.MAX_GUESTS + 30 }, (_, i) => ["Person " + i, "yes"]) };
  const bp = G.planImport(sb, big, { name: 0, last: -1, comp: 1, group: -1, id: -1 }, "merge");
  assert.strictEqual(bp.adds.length, G.MAX_GUESTS - 144, "the guestbook stops at its limit");
  assert.strictEqual(bp.plusOnes, 0, "and plus-ones count towards it");
  G.applyImport(sb, bp, { file: "big" }, NOW);
  assert.strictEqual(sb.guests.length, G.MAX_GUESTS, "never more than the limit, plus-ones included");

  // ---- M4: a guest's look and playful label ----
  {
    const lb = G.newBook();
    bring(lb, "Name,Plus one\nOmar Dubois,yes\nIris Kerr,\n");
    const omar = lb.guests.find((g) => g.name === "Omar Dubois"), plus = G.plusOneOfHost(lb, omar), iris = lb.guests.find((g) => g.name === "Iris Kerr");
    const startLook = { ...omar.look };
    // Every offered choice has a name, for labels and screen readers.
    const ch = G.lookChoices(omar);
    assert.deepStrictEqual(ch.style.map((c) => c.name), ["Short", "Bob", "Long", "Bun", "Top hat"]);
    assert.strictEqual(ch.hair.length, 6);
    assert.strictEqual(ch.outfit.length, 8);
    assert.strictEqual(ch.skin.length, 5);
    assert.ok([ch.style, ch.hair, ch.outfit, ch.skin].every((list) => list.every((c) => c.name && c.value)));
    assert.ok(!ch.outfit.some((c) => c.value === G.PLUS_ONE_OUTFIT), "plus-one mint is not offered to other guests");
    assert.strictEqual(G.lookChoices(plus).outfit[0].value, G.PLUS_ONE_OUTFIT, "a plus-one can always go back to mint");
    // Changing one thing leaves the rest alone.
    assert.strictEqual(G.setLook(lb, omar.id, { style: "hat" }, NOW), null);
    assert.deepStrictEqual(omar.look, { ...startLook, style: "hat" });
    assert.strictEqual(G.setLook(lb, omar.id, { hair: "#D2553F", outfit: "#39405F", skin: "#9A6240" }, NOW), null);
    assert.deepStrictEqual(omar.look, { skin: "#9A6240", hair: "#D2553F", outfit: "#39405F", style: "hat" });
    // Only the offered choices are accepted, and a refused change alters nothing.
    assert.strictEqual(G.setLook(lb, omar.id, { hair: "#123456" }), "Pick one of the choices shown.");
    assert.strictEqual(G.setLook(lb, omar.id, { style: "mohawk" }), "Pick one of the choices shown.");
    assert.strictEqual(G.setLook(lb, omar.id, { outfit: "red; background:url(x)" }), "Pick one of the choices shown.");
    assert.strictEqual(G.setLook(lb, omar.id, { outfit: "#F6BE4A", shoes: "boots" }), "That is not part of a guest's look.");
    assert.strictEqual(G.setLook(lb, omar.id, { outfit: G.PLUS_ONE_OUTFIT }), "Pick one of the choices shown.", "only a plus-one can wear mint");
    assert.deepStrictEqual(omar.look, { skin: "#9A6240", hair: "#D2553F", outfit: "#39405F", style: "hat" });
    assert.strictEqual(G.setLook(lb, "nobody", { style: "bob" }), "That guest is no longer on the list.");
    // A plus-one is edited like any guest, and can change out of mint and back.
    assert.strictEqual(G.setLook(lb, plus.id, { outfit: "#E4577A", style: "bun" }, NOW), null);
    assert.strictEqual(plus.look.outfit, "#E4577A");
    assert.strictEqual(plus.plusOneOf, omar.id, "changing a plus-one's outfit does not detach them");
    assert.strictEqual(G.setLook(lb, plus.id, { outfit: G.PLUS_ONE_OUTFIT }, NOW), null);
    G.setLook(lb, plus.id, { outfit: "#E4577A" }, NOW);
    // The playful label.
    assert.strictEqual(G.PERSONAS.length, 6);
    assert.strictEqual(G.setPersona(lb, omar.id, "Dance floor menace", NOW), null);
    assert.strictEqual(omar.persona, "Dance floor menace");
    assert.strictEqual(G.setPersona(lb, omar.id, "Secretly rich"), "Pick one of the choices shown.");
    assert.strictEqual(omar.persona, "Dance floor menace");
    assert.strictEqual(G.setPersona(lb, iris.id, "Snack scout", NOW), null);
    assert.strictEqual(G.setPersona(lb, iris.id, "", NOW), null, "the label can be cleared");
    assert.strictEqual(iris.persona, "");
    // The look belongs to the guest's id: it survives a rename, a reload, an export and re-import, and search.
    const omarId = omar.id;
    G.editGuest(lb, omarId, { name: "Omar D. Dubois", group: "Groom", companion: G.companionLabel(lb, omar) }, NOW);
    assert.deepStrictEqual(omar.look, { skin: "#9A6240", hair: "#D2553F", outfit: "#39405F", style: "hat" }, "a rename keeps the look");
    assert.strictEqual(G.plusOneOfHost(lb, omar), plus, "and the plus-one");
    const st = {};
    const fk = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = v; } };
    G.saveBook(fk, lb);
    const re = G.loadBook(fk);
    assert.deepStrictEqual(re, lb, "looks and labels survive a reload exactly");
    assert.strictEqual(re.guests.find((g) => g.id === plus.id).look.outfit, "#E4577A", "a plus-one's chosen outfit is not reset to mint on reload");
    bring(lb, G.exportCsv(lb).replace("Iris Kerr", "Iris Kerr-Shaw"));
    assert.strictEqual(lb.guests.find((g) => g.id === omarId).look.style, "hat", "a re-import keeps the look");
    assert.strictEqual(lb.guests.find((g) => g.id === omarId).persona, "Dance floor menace");
    assert.strictEqual(plus.look.outfit, "#E4577A");
    assert.strictEqual(G.searchGuests(lb, "omar")[0].look.outfit, "#39405F");
    assert.ok(!G.exportCsv(lb).includes("Dance floor menace"), "the playful label stays in the game and is not exported");
    const odd = G.loadBook({ getItem: () => JSON.stringify({ guests: [{ id: omarId, name: "X", persona: "<b>bold</b>" }] }) });
    assert.strictEqual(odd.guests[0].persona, "", "a label that is not on the list is dropped when loading");
  }

  // ---- the bench (the maybe list), delete, and undo that survives a reload ----
  {
    const bb = G.newBook();
    bring(bb, "Name,Plus one,Group\nCleo Hart,yes,Friends\nDev Shah,,Work\nEve Park,Fay Wong,Family\nFay Wong,Eve Park,Family\n");
    const by = (n) => bb.guests.find((g) => g.name === n);
    const cleo = by("Cleo Hart"), cleoPlus = G.plusOneOfHost(bb, cleo), dev = by("Dev Shah"), eve = by("Eve Park"), fay = by("Fay Wong");
    assert.ok(bb.guests.every((g) => g.benched === false), "new guests start on the plot");
    const pb = (b) => { const c = G.counts(b); return { guests: c.guests, plusOnes: c.plusOnes, withCompanion: c.withCompanion, onPlot: c.onPlot, onBench: c.onBench }; };
    assert.deepStrictEqual(pb(bb), { guests: 5, plusOnes: 1, withCompanion: 3, onPlot: 5, onBench: 0 });
    // One tap to the bench; a host takes the plus-one they brought.
    assert.deepStrictEqual(G.setBenched(bb, cleo.id, true, NOW), [cleo.id, cleoPlus.id]);
    assert.ok(cleo.benched && cleoPlus.benched);
    assert.deepStrictEqual(pb(bb), { guests: 5, plusOnes: 1, withCompanion: 3, onPlot: 3, onBench: 2 }, "counts for each list");
    assert.deepStrictEqual(G.setBenched(bb, cleo.id, true), [], "benching twice changes nothing");
    // A plus-one moves alone; a linked guest who is not a plus-one stays where they are.
    assert.deepStrictEqual(G.setBenched(bb, cleoPlus.id, false, NOW), [cleoPlus.id]);
    assert.strictEqual(cleo.benched, true, "the host stays on the bench");
    assert.deepStrictEqual(G.setBenched(bb, eve.id, true, NOW), [eve.id], "Fay is Eve's companion, not her plus-one, so she stays");
    assert.strictEqual(fay.benched, false);
    // One tap back.
    assert.deepStrictEqual(G.setBenched(bb, cleo.id, false, NOW).sort(), [cleo.id].sort(), "back to the plot (the plus-one is already there)");
    assert.deepStrictEqual(G.setBenched(bb, "nobody", true), []);
    // Benching keeps everything else about a guest: look, links, code, arrival.
    G.markArrived(bb, [dev.id]);
    const devBefore = JSON.stringify({ ...dev, benched: null, updatedAt: null });
    G.setBenched(bb, dev.id, true, NOW); G.setBenched(bb, dev.id, false, NOW);
    assert.strictEqual(JSON.stringify({ ...dev, benched: null, updatedAt: null }), devBefore, "a trip to the bench and back changes nothing else");
    // Undo a bench move.
    const ids = G.setBenched(bb, dev.id, true, NOW);
    assert.strictEqual(G.applyUndo(bb, { kind: "bench", ids, was: false, label: "Dev moved to the bench" }), true);
    assert.strictEqual(dev.benched, false, "undo puts them back");
    assert.strictEqual(G.applyUndo(bb, { kind: "bench", ids, was: false, label: "x" }), false, "undo twice does nothing");
    // Undo a delete, after a reload: the change is saved under its own key and read back.
    const store = {};
    const fake = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    G.setBenched(bb, cleo.id, true, NOW);
    const order = bb.guests.map((g) => g.id);
    const removed = G.deleteGuest(bb, cleo.id);
    assert.ok(!bb.guests.includes(cleo) && !bb.guests.includes(cleoPlus), "delete removes the guest and the plus-one they brought");
    assert.strictEqual(G.saveUndo(fake, { kind: "delete", removed, label: "Cleo Hart and their plus-one removed" }), true);
    G.saveBook(fake, bb);
    const reloaded = G.loadBook(fake);
    const change = G.loadUndo(fake);
    assert.ok(change && change.kind === "delete" && change.label === "Cleo Hart and their plus-one removed", "the change survives a reload");
    assert.strictEqual(G.applyUndo(reloaded, change), true, "undo works after a reload");
    assert.deepStrictEqual(reloaded.guests.map((g) => g.id), order, "both come back in their places");
    const back = reloaded.guests.find((g) => g.id === cleo.id);
    assert.strictEqual(back.benched, true, "still on the bench, as they were");
    assert.deepStrictEqual(back.look, cleo.look);
    assert.strictEqual(G.plusOneOfHost(reloaded, back).id, cleoPlus.id, "with their plus-one");
    G.saveUndo(fake, { kind: "bench", ids: [dev.id], was: false, label: "Dev Shah moved to the bench" });
    assert.deepStrictEqual(G.loadUndo(fake), { kind: "bench", ids: [dev.id], was: false, label: "Dev Shah moved to the bench" });
    G.saveUndo(fake, null);
    assert.strictEqual(G.loadUndo(fake), null, "a used undo is cleared");
    // Damaged undo saves are ignored, never applied.
    for (const bad of ["{broken", JSON.stringify({ kind: "bench", ids: ["x"], label: "a" }), JSON.stringify({ kind: "delete", removed: { items: [{ guest: { id: "nope" } }], partners: [] }, label: "a" }), JSON.stringify({ kind: "wipe", label: "a" })]) {
      store[G.UNDO_KEY] = bad;
      assert.strictEqual(G.loadUndo(fake), null);
    }
    assert.strictEqual(G.loadUndo({ getItem: () => { throw new Error("blocked"); } }), null);
    // The bench survives a reload, and new guests from an import go to the plot.
    G.setBenched(reloaded, dev.id, true, NOW);
    G.saveBook(fake, reloaded);
    const again = G.loadBook(fake);
    assert.strictEqual(again.guests.find((g) => g.id === dev.id).benched, true, "the bench survives a reload");
    bring(again, "Name\nGil Moss\n");
    assert.strictEqual(again.guests.find((g) => g.name === "Gil Moss").benched, false);
    // Re-importing an export does not move anyone off the bench.
    bring(again, G.exportCsv(again));
    assert.strictEqual(again.guests.find((g) => g.id === dev.id).benched, true);
  }

  // ---- plus-one switch, RSVP, and guests sending love from afar ----
  {
    const rb = G.newBook();
    bring(rb, "Name,Plus one\nAna Ruiz,\nBen Cole,yes\nCara Dunn,\n");
    const by = (n) => rb.guests.find((g) => g.name === n);
    const ana = by("Ana Ruiz"), ben = by("Ben Cole"), cara = by("Cara Dunn"), benPlus = G.plusOneOfHost(rb, ben);
    // The counts always add up: sent + yes + no + pending = total, at every step.
    const addsUp = (why) => {
      const c = G.counts(rb);
      assert.strictEqual(c.rsvp.sent + c.rsvp.yes + c.rsvp.no + c.rsvp.pending, c.total, "RSVP counts add up: " + why);
      assert.strictEqual(c.guestCount + c.afar, c.total, "guest count + sending love from afar = total: " + why);
      assert.strictEqual(c.onPlot + c.onBench, c.guestCount, "plot + bench = guest count: " + why);
      return c;
    };
    let c = addsUp("start");
    assert.ok(rb.guests.every((g) => g.rsvp === "pending" && !g.paused), "everyone starts pending");
    assert.deepStrictEqual([c.total, c.guestCount, c.afar, c.rsvp.pending], [4, 4, 0, 4]);
    assert.strictEqual(G.plusOneOn(rb, ana), false, "the plus-one switch is off by default");
    assert.strictEqual(G.plusOneOn(rb, ben), true, "a plus-one from the imported list is on");
    // Plus-one switch on: an empty slot under the host.
    let r = G.setPlusOne(rb, ana.id, true, NOW);
    const anaPlus = G.plusOneOfHost(rb, ana);
    assert.ok(anaPlus && anaPlus.unnamed && anaPlus.plusOneOf === ana.id, "switching on makes an empty plus-one slot");
    assert.strictEqual(r.created, anaPlus.id);
    assert.strictEqual(rb.guests.indexOf(anaPlus), rb.guests.indexOf(ana) + 1, "the slot sits under the host");
    assert.strictEqual(addsUp("plus-one on").total, 5);
    G.editGuest(rb, anaPlus.id, { name: "Rio Vega", group: "" }, NOW);
    // Off: kept, not counted. On again: back with name and status.
    G.setRsvp(rb, anaPlus.id, "yes", NOW);
    r = G.setPlusOne(rb, ana.id, false, NOW);
    assert.strictEqual(anaPlus.paused, true);
    assert.ok(rb.guests.includes(anaPlus), "switching off keeps the plus-one");
    c = addsUp("plus-one off");
    assert.deepStrictEqual([c.total, c.rsvp.yes, c.paused], [4, 0, 1], "a switched-off plus-one is not counted");
    assert.strictEqual(G.inWorld(anaPlus), false, "and is not on the plot");
    assert.strictEqual(G.applyUndo(rb, { kind: "state", before: r.before, created: null, label: "x" }), true, "undo switches them back on");
    assert.strictEqual(anaPlus.paused, false);
    G.setPlusOne(rb, ana.id, false, NOW);
    G.setPlusOne(rb, ana.id, true, NOW);
    assert.deepStrictEqual([anaPlus.name, anaPlus.rsvp, anaPlus.paused], ["Rio Vega", "yes", false], "on again restores name and status");
    assert.strictEqual(G.setPlusOne(rb, ana.id, true, NOW), null, "on twice changes nothing");
    assert.strictEqual(G.setPlusOne(rb, anaPlus.id, true, NOW), null, "a plus-one has no plus-one switch");
    // Undo of switching on a new slot removes the slot.
    r = G.setPlusOne(rb, cara.id, true, NOW);
    assert.strictEqual(addsUp("cara slot").total, 6);
    assert.strictEqual(G.applyUndo(rb, { kind: "state", before: r.before, created: r.created, label: "x" }), true);
    assert.strictEqual(G.plusOneOfHost(rb, cara), null, "undo removes the new empty slot");
    addsUp("cara undo");
    // RSVP: each change undoable; saying no sends them to the clouds, not counted.
    for (const st of ["sent", "yes", "pending", "sent"]) { assert.ok(G.setRsvp(rb, cara.id, st, NOW)); addsUp("cara " + st); }
    assert.strictEqual(G.setRsvp(rb, cara.id, "sent", NOW), null, "the same status twice changes nothing");
    assert.strictEqual(G.setRsvp(rb, cara.id, "maybe", NOW), null, "only the four statuses");
    G.setBenched(rb, ben.id, true, NOW);
    const before = G.setRsvp(rb, ben.id, "no", NOW);
    c = addsUp("ben no");
    assert.strictEqual(ben.benched, false, "saying no takes them off the bench, to the clouds");
    assert.strictEqual(G.inWorld(ben), false, "and off the plot");
    assert.deepStrictEqual([c.guestCount, c.afar, c.total], [4, 1, 5], "not counted in the guest count");
    assert.strictEqual(benPlus.rsvp, "pending", "a plus-one keeps their own RSVP");
    assert.strictEqual(G.applyUndo(rb, { kind: "state", before, created: null, label: "x" }), true);
    assert.deepStrictEqual([ben.rsvp, ben.benched], ["pending", true], "undo puts them back where they were, on the bench");
    addsUp("ben undo");
    G.setRsvp(rb, ben.id, "no", NOW);
    G.setRsvp(rb, ben.id, "yes", NOW);
    assert.strictEqual(G.inWorld(ben), true, "saying yes brings them back to the plot");
    addsUp("ben yes");
    // RSVP and switch survive a reload, as does an undo of either.
    const st = {};
    const fk = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = v; }, removeItem: (k) => { delete st[k]; } };
    G.setRsvp(rb, cara.id, "no", NOW);
    const b4 = G.setPlusOne(rb, ana.id, false, NOW);
    G.saveBook(fk, rb);
    G.saveUndo(fk, { kind: "state", before: b4.before, created: null, label: "Ana's plus-one switched off" });
    const back = G.loadBook(fk);
    assert.deepStrictEqual(back, rb, "RSVP and the plus-one switch survive a reload");
    const u = G.loadUndo(fk);
    assert.strictEqual(u.kind, "state");
    assert.strictEqual(G.applyUndo(back, u), true, "undo works after a reload");
    assert.strictEqual(back.guests.find((g) => g.id === anaPlus.id).paused, false);
    assert.strictEqual(G.loadBook({ getItem: () => JSON.stringify({ guests: [{ id: G.uuid(), name: "X", rsvp: "declined" }] }) }).guests[0].rsvp, "pending", "an unknown status falls back to pending");
    // Nothing is sent and no contact details are kept.
    assert.ok(!/phone|email|e-mail/i.test(JSON.stringify(back)), "no phone or email stored");
  }
  // The words: gentle, never judging.
  {
    const fs2 = require("fs");
    const ui = fs2.readFileSync(__dirname + "/guestbook.js", "utf8") + fs2.readFileSync(__dirname + "/guests-core.js", "utf8");
    const shown = (ui.match(/"[^"\n]*"/g) || []).join(" ").toLowerCase();
    for (const bad of ["declined", "rejected", "absent", "missing"]) assert.ok(!shown.includes(bad), "never \"" + bad + "\"");
    assert.ok(shown.includes("sending love from afar") && shown.includes("not counted"));
  }

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
  assert.deepStrictEqual(cnt(xb), { guests: 5, plusOnes: 1, withCompanion: 3 });
  await assert.rejects(X.readXlsx(new TextEncoder().encode("Name,Group\nAna,Bride\n")), /does not look like an Excel file/, "a file that is not Excel gives a clear message");

  console.log("ok: guestbook tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
