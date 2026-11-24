// Glowa Guestbook screens: bring in a real guest list (CSV or Excel), match its columns, settle duplicates, then
// search, add, edit, remove and export the list. Rules live in guests-core.js; this file is the screen only.
// Everything stays on the device: the file is read here and is never uploaded.
(function () {
  const G = window.GlowaGuests, X = window.GlowaXlsx, UI = window.GlowaUI;
  const body = document.getElementById("guestbook-body");
  const sub = document.getElementById("guestbook-sub");
  let book = G.loadBook(UI.store);
  let view = book.guests.length ? "roster" : "start";
  let imp = null;        // the file being matched: { file, sheets, sheet, table, mapping, dup }
  let query = "";
  let editing = null;    // id of the guest being edited
  let note = "";
  let confirmClear = false;
  let focusNext = null;  // id of the control to focus after the next draw

  // Builds an element. Text always goes in as text, never as markup, so a guest's name cannot run code.
  function h(tag, props, kids) {
    const el = document.createElement(tag);
    for (const k of Object.keys(props || {})) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "value") el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of [].concat(kids || [])) if (kid) el.append(kid);
    return el;
  }
  const plural = (n, one, many) => (n === 1 ? "1 " + one : n + " " + many);

  function save() {
    const ok = G.saveBook(UI.store, book);
    if (!ok) note = "Your list could not be saved on this device. Export it now so nothing is lost.";
    const c = G.counts(book);
    UI.setGuestCount(c.onPlot + c.onBench, c.onBench, c.afar);
    UI.setGuests(book.guests.filter(G.inWorld));
    return ok;
  }

  function go(next, focus) {
    if (next !== "edit") commitCard = () => null;
    view = next;
    focusNext = focus || "guestbook-title";
    draw();
  }

  // ---- reading a chosen file ----
  async function takeFile(file) {
    note = "";
    if (!file) return;
    const name = file.name || "your file";
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("That file is larger than 20 MB.");
      let sheets;
      if (/\.xlsx$/i.test(name)) sheets = (await X.readXlsx(await file.arrayBuffer())).sheets;
      else if (/\.xls$/i.test(name)) throw new Error("Old .xls files can't be read here. In Excel choose Save As, pick .xlsx or CSV, and bring that file instead.");
      else sheets = [{ name: "", rows: G.parseCsv(await file.text()) }];
      startMatch(name, sheets);
    } catch (e) {
      note = "Couldn't read " + name + ". " + (e && e.message ? e.message : "Try saving it as CSV.");
      go("start");
    }
  }

  function startMatch(file, sheets) {
    const usable = sheets.filter((s) => s.rows.length > 1);
    if (!usable.length) {
      note = "Couldn't find any guests in " + file + ". It needs a first row of column names, then one guest on each row.";
      return go("start");
    }
    imp = { file, sheets: usable, sheet: 0, dup: "merge" };
    pickSheet(0);
    go("match");
  }

  function pickSheet(i) {
    imp.sheet = i;
    imp.table = G.tableFrom(imp.sheets[i].rows);
    imp.mapping = G.exportMapping(imp.table.headers) || G.guessMapping(imp.table.headers);
  }

  const plan = () => G.planImport(book, imp.table, imp.mapping, imp.dup);

  function confirmImport() {
    const p = plan();
    if (p.adds.length + p.updates.length + p.merges.length === 0) return;
    const sum = G.applyImport(book, p, { file: imp.file, sheet: imp.sheets[imp.sheet].name });
    const saved = save();
    imp = null; query = "";
    const parts = [];
    if (sum.added) parts.push(plural(sum.added, "guest", "guests") + " added");
    if (sum.updated) parts.push(sum.updated + " updated");
    if (sum.plusOnes) parts.push(plural(sum.plusOnes, "plus-one", "plus-ones") + " added");
    if (sum.merged) parts.push(plural(sum.merged, "repeat", "repeats") + " merged");
    if (sum.skipped) parts.push(plural(sum.skipped, "row", "rows") + " skipped");
    // The gates open: the Guestbook closes so the player can watch everyone walk in.
    UI.close();
    if (saved) UI.toast("The gates are open", parts.join(", ") + ".");
  }

  // ---- screens ----
  function drawStart() {
    sub.textContent = "Bring your real list. Everyone on it walks in.";
    const file = h("input", { type: "file", accept: ".csv,.tsv,.txt,.xlsx,.xls", "aria-label": "Choose a CSV or Excel file", onchange: (e) => takeFile(e.target.files[0]) });
    const drop = h("label", { class: "drop" }, [
      svg('<svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#2B2140" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 19 V5 M8 11 L14 5 L20 11 M4 20 V23 H24 V20"></path></svg>'),
      h("span", { class: "drop-title", text: "Drop a CSV or Excel file" }),
      h("span", { class: "sub", text: "Any column names. You match them next. The file stays on this device." }),
      file,
    ]);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });
    const input = h("input", { id: "glowa-add", type: "text", placeholder: "Full name", maxlength: G.NAME_MAX, autocomplete: "off",
      onkeydown: (e) => { if (e.key === "Enter") addByHand(input, "glowa-add"); } });
    return [
      note && h("div", { class: "note", role: "alert", text: note }),
      drop,
      h("button", { type: "button", class: "btn wide", text: "Use the sample list (120 guests, 24 plus-ones)", onclick: () => { const t = G.sampleTable(); startMatch("Sample list", [{ name: "", rows: [t.headers].concat(t.rows) }]); } }),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "glowa-add", text: "Or add a guest by hand" }),
        h("div", { class: "inline" }, [input, h("button", { type: "button", class: "btn", text: "Add", onclick: () => addByHand(input, "glowa-add") })]),
        h("span", { class: "sub", text: book.guests.length ? plural(book.guests.length, "guest is", "guests are") + " on your list." : "They go straight onto your list." }),
      ]),
      book.guests.length > 0 && h("button", { type: "button", class: "btn wide", text: "See your guest list", onclick: () => go("roster") }),
    ];
  }

  function addByHand(input, focusId) {
    const r = G.addGuest(book, input.value);
    if (r.error) { note = r.error; focusNext = focusId; return draw(); }
    note = "";
    save();
    focusNext = focusId;
    draw();
  }

  function mapSelect(id, label, key, allowNone) {
    const select = h("select", { id, onchange: (e) => { imp.mapping = { ...imp.mapping, [key]: Number(e.target.value) }; focusNext = id; draw(); } });
    if (allowNone) select.append(h("option", { value: "-1", text: "None" }));
    imp.table.headers.forEach((name, i) => select.append(h("option", { value: String(i), text: name })));
    select.value = String(imp.mapping[key]);
    return [h("label", { for: id, text: label }), select];
  }

  function drawMatch() {
    sub.textContent = "Tell Glowa which column is which.";
    const p = plan();
    const incoming = p.adds.length;
    const rows = p.adds.concat(p.updates).slice(0, 4);
    const sheetPick = imp.sheets.length > 1 && h("div", { class: "stack" }, [
      h("label", { class: "lbl", for: "glowa-sheet", text: "Which sheet has your guests?" }),
      (() => { const s = h("select", { id: "glowa-sheet", onchange: (e) => { pickSheet(Number(e.target.value)); focusNext = "glowa-sheet"; draw(); } });
        imp.sheets.forEach((sh, i) => s.append(h("option", { value: String(i), text: sh.name + " (" + plural(sh.rows.length - 1, "row", "rows") + ")" })));
        s.value = String(imp.sheet); return s; })(),
    ]);
    const lineBits = [];
    if (incoming) lineBits.push(plural(incoming, "guest", "guests") + " will be added");
    if (p.plusOnes) lineBits.push(plural(p.plusOnes, "plus-one", "plus-ones") + " will join them");
    if (p.updates.length) lineBits.push(p.updates.length + " already on your list will be updated");
    if (p.merges.length) lineBits.push(plural(p.merges.length, "repeat", "repeats") + " merged");
    const nothing = incoming + p.updates.length + p.merges.length === 0;
    return [
      h("div", { class: "file-line" }, [
        h("span", { text: imp.file + " · " + plural(p.total, "row", "rows") }),
        h("button", { type: "button", class: "btn link", text: "Change", onclick: () => { imp = null; go("start"); } }),
      ]),
      sheetPick,
      h("div", { class: "stack" }, [
        h("span", { class: "big", text: "Match your columns" }),
        h("div", { class: "map-grid" }, [].concat(
          mapSelect("glowa-map-name", "Guest name", "name", false),
          mapSelect("glowa-map-last", "Last name, if separate", "last", true),
          mapSelect("glowa-map-comp", "Companion", "comp", true),
          mapSelect("glowa-map-group", "Group", "group", true))),
        h("span", { class: "sub", text: "A companion can be a name, or yes for a plus-one. A plus-one is a guest too: they get their own place on the list and count towards your total." }),
      ]),
      h("div", { class: "stack" }, [
        h("span", { class: "big", text: "Preview" }),
        ...rows.map((r) => h("div", { class: "preview-row" }, [h("b", { text: r.name }), h("span", { text: [r.companion.plusOne ? "+1" : r.companion.name, r.group].filter(Boolean).join(" · ") })])),
        rows.length === 0 && h("span", { class: "sub", text: "No guests found with these columns. Try a different Guest name column." }),
      ]),
      p.skipped.length > 0 && h("div", { class: "note", role: "status", text: plural(p.skipped.length, "row", "rows") + " will be skipped (" + p.skipped[0].reason.toLowerCase() + "): line " + p.skipped.slice(0, 5).map((s) => s.line).join(", ") + (p.skipped.length > 5 ? " and more" : "") + "." }),
      p.duplicateNames.length > 0 && h("div", { class: "dup-box" }, [
        h("span", { class: "lbl", text: plural(p.duplicateNames.length, "name appears", "names appear") + " twice: " + p.duplicateNames.slice(0, 3).join(", ") + (p.duplicateNames.length > 3 ? " and more" : "") }),
        h("div", { class: "inline" }, [
          h("button", { type: "button", id: "dup-merge", class: "chip" + (imp.dup === "merge" ? " on" : ""), "aria-pressed": String(imp.dup === "merge"), text: "Merge them", onclick: () => { imp.dup = "merge"; focusNext = "dup-merge"; draw(); } }),
          h("button", { type: "button", id: "dup-keep", class: "chip" + (imp.dup === "keep" ? " on" : ""), "aria-pressed": String(imp.dup === "keep"), text: "Keep both", onclick: () => { imp.dup = "keep"; focusNext = "dup-keep"; draw(); } }),
        ]),
      ]),
      h("div", { class: "stack" }, [
        h("button", { type: "button", class: "go", text: "Open the gates", disabled: nothing, onclick: confirmImport }),
        h("span", { class: "center-sub", text: nothing ? "Nothing to bring in yet." : lineBits.join(", ") + "." }),
      ]),
    ];
  }

  function exportList() {
    const blob = new Blob(["﻿" + G.exportCsv(book)], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "glowa-guests.csv" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- the bench and undo ----
  // The last change that can be undone. It is saved, so Undo still works after a reload.
  let lastChange = G.loadUndo(UI.store);
  let listFilter = "all";
  const firstName = (name) => (name || "").split(" ")[0] || name;

  function remember(change) {
    lastChange = change;
    G.saveUndo(UI.store, change);
  }
  function undoLast() {
    const change = lastChange;
    if (!change) return;
    const done = G.applyUndo(book, change);
    remember(null);
    save();
    draw();
    UI.toast(done ? "Undone" : "Nothing to undo", done ? change.label + ", undone." : "That change can't be undone any more.");
  }

  // Moves a guest (and the plus-one they brought) to the bench or back to the plot, with Undo.
  function bench(id, on, focusId) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return;
    const ids = G.setBenched(book, id, on);
    if (!ids.length) return;
    const who = ids.length > 1 ? g.name + " and their plus-one" : g.name;
    remember({ kind: "bench", ids, was: !on, label: on ? who + " moved to the bench" : who + " back on the plot" });
    save();
    focusNext = focusId || null;
    draw();
    UI.toast(on ? "On the maybe list, darling." : "Make room!", on ? who + (ids.length > 1 ? " are" : " is") + " on the bench." : who + (ids.length > 1 ? " are" : " is") + " back on the plot.", { label: "Undo", run: undoLast });
  }

  // Removes a guest (and the plus-one they brought): they spin and whoosh away, with Undo.
  function removeGuest(id, focusId) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return;
    const removed = G.deleteGuest(book, id);
    note = "";
    remember({ kind: "delete", removed, label: g.name + (removed.items.length > 1 ? " and their plus-one" : "") + " removed" });
    save();
    focusNext = focusId || null;
    if (view === "roster") draw();
    UI.toast("Off you go, " + firstName(g.name) + "!", removed.items.length > 1 ? "Removed, with their plus-one." : "Removed from your list.", { label: "Undo", run: undoLast });
  }

  // ---- RSVP, the plus-one switch, and guests sending love from afar ----
  const RSVP_LABELS = { pending: "Pending", sent: "Sent", yes: "Yes", no: "No" };
  function rsvpSelect(g) {
    const id = "rsvp-" + g.id;
    const s = h("select", { id, "aria-label": "RSVP for " + g.name, onchange: (e) => setRsvp(g.id, e.target.value, id) });
    for (const k of ["pending", "sent", "yes", "no"]) s.append(h("option", { value: k, text: "RSVP: " + RSVP_LABELS[k] }));
    s.value = g.rsvp;
    return s;
  }
  function setRsvp(id, status, focusId) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return;
    const before = G.setRsvp(book, id, status);
    if (!before) return;
    remember({ kind: "state", before, created: null, label: g.name + " marked " + RSVP_LABELS[status].toLowerCase() });
    if (status === "no") UI.exitAs([id], "cloud");
    if (before[0].rsvp === "no") UI.enterHop([id]);
    save();
    focusNext = status === "no" ? "glowa-search" : focusId;
    draw();
    if (status === "no") UI.toast("Sending you love from afar!", g.name + " is in the No section, not counted.", { label: "Undo", run: undoRestoring });
    else UI.toast("RSVP: " + RSVP_LABELS[status], g.name + (before[0].rsvp === "no" ? " is back on the plot." : " is marked " + RSVP_LABELS[status].toLowerCase() + "."), { label: "Undo", run: undoRestoring });
  }
  // Undo, with the right way back onto (or off) the plot.
  function undoRestoring() {
    if (lastChange && lastChange.kind === "state") {
      for (const s of lastChange.before) {
        const g = book.guests.find((x) => x.id === s.id);
        if (!g) continue;
        const wasIn = !s.paused && s.rsvp !== "no", isIn = G.inWorld(g);
        if (wasIn && !isIn) UI.enterHop([g.id]);
        if (!wasIn && isIn) UI.exitAs([g.id], g.rsvp === "no" ? "fade" : "fade");
      }
      if (lastChange.created) UI.exitAs([lastChange.created], "fade");
    }
    undoLast();
  }
  function plusSwitch(host) {
    const on = G.plusOneOn(book, host);
    const id = "plus-" + host.id;
    return h("button", { type: "button", id, class: "switch", role: "switch", "aria-checked": String(on), "aria-label": "Plus-one for " + host.name,
      onclick: () => togglePlusOne(host.id, !on, id) }, [h("span", { class: "knob", "aria-hidden": "true" }), h("span", { text: "Plus-one" })]);
  }
  function togglePlusOne(hostId, on, focusId) {
    const host = book.guests.find((x) => x.id === hostId);
    const r = host && G.setPlusOne(book, hostId, on);
    if (!r) return;
    const mine = G.plusOneOfHost(book, host);
    if (!on) UI.exitAs([mine.id], "fade");
    remember({ kind: "state", before: r.before, created: r.created, label: host.name + "'s plus-one switched " + (on ? "on" : "off") });
    save();
    focusNext = on && mine && mine.unnamed ? "slot-" + mine.id : focusId;
    draw();
    UI.toast(on ? "Plus-one on" : "Plus-one off", on ? (mine.unnamed ? "Type their name when you know it." : mine.name + " is back, counted again.") : mine.name + " is kept, but not counted.", { label: "Undo", run: undoRestoring });
  }
  function slotInput(p) {
    const id = "slot-" + p.id;
    const host = book.guests.find((x) => x.id === p.plusOneOf);
    const input = h("input", { id, type: "text", placeholder: "Their name", maxlength: G.NAME_MAX, autocomplete: "off",
      onchange: (e) => { if (!e.target.value.trim()) return; const err = G.editGuest(book, p.id, { name: e.target.value, group: p.group }); if (err) { note = err; } save(); draw(); } });
    return h("div", { class: "slot" }, [h("label", { for: id, text: (host ? firstName(host.name) + "'s plus-one" : "Plus-one") + ":" }), input]);
  }
  function afarSection() {
    const afar = book.guests.filter((g) => !g.paused && g.rsvp === "no");
    return h("section", { class: "afar", "aria-label": "No, sending love from afar" }, [
      h("h3", { text: "No, sending love from afar" }),
      afar.length ? null : h("span", { class: "sub", text: "Nobody here. Guests who say no sit on a cloud here, and aren't counted." }),
      ...afar.map((g) => h("div", { class: "afar-row" }, [
        h("span", { class: "cloudlet", "aria-hidden": "true" }),
        h("b", { text: g.name }),
        h("button", { type: "button", id: "yes-" + g.id, class: "quick", text: "Say yes", "aria-label": g.name + " says yes", onclick: () => setRsvp(g.id, "yes", "glowa-search") }),
      ])),
    ]);
  }

  function drawRoster() {
    const c = G.counts(book);
    sub.textContent = "Guest count: " + c.guestCount + " · " + c.onPlot + " on the plot · " + c.onBench + " on the bench";
    const input = h("input", { id: "glowa-new", type: "text", placeholder: "Full name", maxlength: G.NAME_MAX, autocomplete: "off",
      onkeydown: (e) => { if (e.key === "Enter") addByHand(input, "glowa-new"); } });
    const list = h("div", { class: "rows", id: "glowa-rows" });
    const fill = () => {
      list.textContent = "";
      const rows = G.searchGuests(book, query).filter((g) => !g.paused && g.rsvp !== "no" && (listFilter === "all" || (listFilter === "bench" ? g.benched : !g.benched)));
      for (const g of rows) {
        const companion = G.companionLabel(book, g);
        const quickId = "quick-" + g.id;
        list.append(h("div", { class: "row-wrap" + (g.benched ? " benched" : "") }, [
          h("button", { type: "button", class: "row", "aria-label": g.name + (g.benched ? ", on the bench" : "") + ". Find and open their card", onclick: () => showGuest(g.id) }, [
            h("span", { class: "dot", "aria-hidden": "true", style: "background:" + g.look.outfit + ";box-shadow:inset 0 9px 0 " + g.look.hair }),
            h("span", { class: "who" }, [h("b", { text: g.name }), h("span", { text: [g.plusOneOf ? "Plus-one of " + G.hostLabel(book, g) : companion && "with " + companion, g.group].filter(Boolean).join(" · ") || "No group yet" })]),
            h("span", { class: "code", text: g.code }),
          ]),
          h("div", { class: "row-ctrls" }, [
            rsvpSelect(g),
            !g.plusOneOf && !(g.companionId && !G.plusOneOfHost(book, g)) && plusSwitch(g),
            h("button", { type: "button", id: quickId, class: "quick" + (g.benched ? " back" : ""), text: g.benched ? "Back" : "Bench",
              "aria-label": g.benched ? "Bring " + g.name + " back to the plot" : "Move " + g.name + " to the bench",
              onclick: () => bench(g.id, !g.benched, quickId) }),
            h("button", { type: "button", class: "quick remove", text: "Remove", "aria-label": "Remove " + g.name, onclick: () => removeGuest(g.id, "glowa-search") }),
          ]),
          g.plusOneOf && g.unnamed && slotInput(g),
        ]));
      }
      if (!rows.length) list.append(h("span", { class: "sub", role: "status", text: !book.guests.length ? "No guests yet. Add one above or import a list." : listFilter === "bench" && !query ? "Nobody on the bench. Tap Bench beside a guest to put them on the maybe list." : "Nobody matches that." }));
    };
    fill();
    const filter = (key, label, n) => h("button", { type: "button", id: "filter-" + key, class: "chip" + (listFilter === key ? " on" : ""), "aria-pressed": String(listFilter === key), text: label + " (" + n + ")",
      onclick: () => { listFilter = key; focusNext = "filter-" + key; draw(); } });
    return [
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "inline" }, [
        h("button", { type: "button", class: "btn primary", disabled: book.guests.length === 0, onclick: exportList }, [
          svg('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2 V11 M5 7.5 L9 11.5 L13 7.5 M3 13 V15.5 H15 V13"></path></svg>'),
          h("span", { text: "Export CSV" }),
        ]),
        h("button", { type: "button", class: "btn", text: "Import more", onclick: () => { note = ""; go("start"); } }),
      ]),
      lastChange && h("div", { class: "last-change", role: "status" }, [h("span", { text: "Last change: " + lastChange.label + "." }), h("button", { type: "button", id: "undo-last", class: "btn", text: "Undo", onclick: undoRestoring })]),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "glowa-new", text: "Add a guest" }),
        h("div", { class: "inline" }, [input, h("button", { type: "button", class: "btn", text: "Add", onclick: () => addByHand(input, "glowa-new") })]),
      ]),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "glowa-search", text: "Search" }),
        h("input", { id: "glowa-search", type: "search", placeholder: "Name or group", value: query, autocomplete: "off", oninput: (e) => { query = e.target.value; fill(); } }),
      ]),
      h("div", { class: "filters", role: "group", "aria-label": "Show" }, [filter("all", "Everyone", c.guests), filter("plot", "On the plot", c.onPlot), filter("bench", "On the bench", c.onBench)]),
      h("span", { class: "rsvp-counts", role: "status", text: "Guest count: " + c.guestCount + " · Sending love from afar: " + c.afar + " (not counted)" }),
      h("span", { class: "sub", text: "RSVP: " + c.total + " in all · " + c.rsvp.sent + " sent · " + c.rsvp.yes + " yes · " + c.rsvp.no + " no · " + c.rsvp.pending + " pending" }),
      list,
      afarSection(),
      book.guests.length > 0 && (confirmClear
        ? h("div", { class: "dup-box" }, [
          h("span", { class: "lbl", text: "Remove all " + plural(book.guests.length, "guest", "guests") + "? Export first if you want a copy." }),
          h("div", { class: "inline" }, [
            h("button", { type: "button", id: "clear-yes", class: "chip", text: "Remove everyone", onclick: clearAll }),
            h("button", { type: "button", class: "chip on", text: "Keep my list", onclick: () => { confirmClear = false; focusNext = "clear-ask"; draw(); } }),
          ]),
        ])
        : h("button", { type: "button", id: "clear-ask", class: "btn link", text: "Remove everyone and start again", onclick: () => { confirmClear = true; focusNext = "clear-yes"; draw(); } })),
    ];
  }

  function clearAll() {
    const kept = book;
    book = G.newBook();
    book.weddingId = kept.weddingId;
    confirmClear = false; query = "";
    save();
    go("start");
    UI.toast("Guestbook emptied", "Everyone was removed.", { label: "Undo", run: () => { book = kept; save(); go("roster"); } });
  }

  // Keeps whatever is typed in the open card. Called on Enter, when a field loses focus, and before the panel
  // closes, so an edit is never lost by leaving. Returns an error message, or null.
  let commitCard = () => null;

  function showGuest(id, focus) {
    commitCard();
    note = "";
    editing = id;
    UI.select(id);
    go("edit", focus);
  }

  // A row of choices where exactly one is on: colour swatches or word chips.
  function choiceRow(label, options, current, cls, onPick, idBase) {
    return h("div", { class: "stack", role: "group", "aria-label": label }, [
      h("span", { class: "lbl", text: label }),
      h("div", { class: cls === "sw" ? "sw-row" : "chip-row" }, options.map((o, i) => h("button", {
        type: "button", id: idBase + "-" + i, class: cls + (o.value === current ? " on" : ""), "aria-pressed": String(o.value === current),
        "aria-label": cls === "sw" ? o.name : undefined, title: cls === "sw" ? o.name : undefined, text: cls === "sw" ? undefined : o.name,
        style: cls === "sw" ? "background:" + o.value : undefined,
        onclick: () => onPick(o.value, idBase + "-" + i),
      }))),
    ]);
  }

  function portrait(g) {
    const l = g.look;
    const back = l.style === "long" ? h("span", { class: "hl", style: "background:" + l.hair }) : l.style === "bob" ? h("span", { class: "hbob", style: "background:" + l.hair }) : null;
    const top = l.style === "bun" ? [h("span", { class: "hb", style: "background:" + l.hair })] : l.style === "hat" ? [h("span", { class: "ht" }), h("span", { class: "hbr" })] : [];
    return h("span", { class: "portrait", "aria-hidden": "true" }, [h("span", { class: "g" }, [h("span", { class: "gin" }, [h("span", { class: "sh" }), h("span", { class: "bob" }, [
      back, h("span", { class: "bd", style: "background:" + l.outfit }), h("span", { class: "hd", style: "background:" + l.skin }), h("span", { class: "hr", style: "background:" + l.hair }),
      ...top, h("span", { class: "ey e1" }), h("span", { class: "ey e2" }),
    ])])])]);
  }

  function drawEdit() {
    const g = book.guests.find((x) => x.id === editing);
    if (!g) { view = "roster"; commitCard = () => null; return drawRoster(); }
    const host = g.plusOneOf && book.guests.find((x) => x.id === g.plusOneOf);
    const mine = G.plusOneOfHost(book, g);
    sub.textContent = "Guest " + g.code + (host ? " · plus-one of " + host.name : "");
    const name = h("input", { id: "edit-name", type: "text", value: g.name, maxlength: G.NAME_MAX, autocomplete: "off" });
    const group = h("input", { id: "edit-group", type: "text", value: g.group, maxlength: 60, autocomplete: "off", placeholder: "Family, work, school friends" });
    const companion = h("input", { id: "edit-comp", type: "text", value: G.companionLabel(book, g), maxlength: G.NAME_MAX, autocomplete: "off", placeholder: "A name, or +1" });
    const typed = () => name.value !== g.name || group.value !== g.group || (!g.plusOneOf && companion.value !== G.companionLabel(book, g));
    commitCard = () => {
      if (editing !== g.id || !book.guests.includes(g) || !typed()) return null;
      const error = G.editGuest(book, g.id, { name: name.value, group: group.value, companion: g.plusOneOf ? undefined : companion.value });
      if (error) return error;
      save();
      return null;
    };
    // Typing is kept when a field is left or Enter is pressed. A name that cannot be saved is explained, not dropped silently.
    const keep = (focusId) => {
      const had = typed();
      const error = commitCard();
      if (error) { note = error; focusNext = "edit-name"; return draw(); }
      if (had) { note = ""; focusNext = focusId; draw(); }
    };
    // Leaving a field keeps what was typed without redrawing the card: a redraw here would swap the button the
    // player is in the middle of tapping, and the tap would be lost.
    const keepQuietly = () => {
      const error = commitCard();
      if (error) { note = error; focusNext = "edit-name"; return draw(); }
      const head = body.querySelector(".card-head .who b");
      if (head) head.textContent = g.name;
    };
    for (const el of [name, group, companion]) {
      el.addEventListener("change", keepQuietly);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); keep(el.id); } });
    }
    const look = (key) => (value, focusId) => {
      commitCard();
      const error = G.setLook(book, g.id, { [key]: value });
      note = error || "";
      if (!error) save();
      focusNext = focusId;
      draw();
    };
    const choices = G.lookChoices(g);
    return [
      h("button", { type: "button", class: "btn link", text: "Back to the guest list", onclick: () => { const error = commitCard(); if (error) { note = error; focusNext = "edit-name"; return draw(); } note = ""; UI.select(null); go("roster"); } }),
      h("div", { class: "card-head" }, [portrait(g), h("span", { class: "who" }, [h("b", { text: g.name }), h("span", { class: "sub", text: [g.group, g.persona].filter(Boolean).join(" · ") || "No group yet" })])]),
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-name", text: "Name" }), name]),
      choiceRow("Hair", choices.style, g.look.style, "chip", look("style"), "pick-style"),
      choiceRow("Hair colour", choices.hair, g.look.hair, "sw", look("hair"), "pick-hair"),
      choiceRow("Outfit", choices.outfit, g.look.outfit, "sw", look("outfit"), "pick-outfit"),
      choiceRow("Skin tone", choices.skin, g.look.skin, "sw", look("skin"), "pick-skin"),
      choiceRow("Just for fun", G.PERSONAS.map((p) => ({ value: p, name: p })), g.persona, "chip", (value, focusId) => {
        commitCard();
        G.setPersona(book, g.id, g.persona === value ? "" : value);
        save(); focusNext = focusId; draw();
      }, "pick-persona"),
      h("span", { class: "sub", text: "A made-up label for the game. It says nothing real about your guest." }),
      h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-group", text: "Group" }), group]),
      host
        ? h("button", { type: "button", id: "go-host", class: "btn wide row-btn", onclick: () => showGuest(host.id, "guestbook-title") }, [h("b", { text: "Plus-one of " + host.name }), h("span", { text: "Open their card" })])
        : h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-comp", text: "Companion" }), companion,
          h("span", { class: "sub", text: "Type +1 to give them a plus-one, a new name to name their plus-one, or the name of a guest already on the list to link the two. Clear the box and their plus-one comes off the list." })]),
      mine && h("button", { type: "button", id: "go-plus-one", class: "btn wide row-btn", onclick: () => showGuest(mine.id, "guestbook-title") }, [h("b", { text: "Their plus-one: " + mine.name }), h("span", { text: "Open their card" })]),
      h("button", { type: "button", class: "go", text: "Done", onclick: () => { const error = commitCard(); if (error) { note = error; focusNext = "edit-name"; return draw(); } UI.close(); } }),
      h("button", { type: "button", id: "card-bench", class: "btn wide", text: g.benched ? "Back to the plot" : "Move to the bench", onclick: () => bench(g.id, !g.benched, "card-bench") }),
      h("button", { type: "button", class: "btn wide danger", text: "Remove " + g.name + (mine ? " and their plus-one" : ""), onclick: () => { commitCard = () => null; UI.select(null); removeGuest(g.id); go("roster"); } }),
      h("span", { class: "id-line", text: "Guest ID " + g.id }),
    ];
  }

  function svg(markup) {
    const span = document.createElement("span");
    span.style.lineHeight = "0";
    span.innerHTML = markup; // fixed drawings written in this file only, never guest data
    return span.firstChild;
  }

  function draw() {
    const scroll = body.parentNode.scrollTop;
    const kids = view === "match" && imp ? drawMatch() : view === "roster" ? drawRoster() : view === "edit" ? drawEdit() : drawStart();
    body.textContent = "";
    for (const kid of kids) if (kid) body.append(kid);
    const target = focusNext && document.getElementById(focusNext);
    if (focusNext === "guestbook-title") body.parentNode.scrollTop = 0; else body.parentNode.scrollTop = scroll;
    if (target && !document.getElementById("guestbook").hidden) target.focus();
    focusNext = null;
  }

  window.GlowaGuestbook = {
    // Called by the world each time the Guestbook opens: start on the list if there is one.
    // With a guest id (a tap on someone on the plot), it opens on their card.
    opened(guestId) {
      note = ""; confirmClear = false; imp = null;
      const g = guestId && book.guests.find((x) => x.id === guestId);
      if (g) { editing = g.id; view = "edit"; UI.select(g.id); } else view = book.guests.length ? "roster" : "start";
      draw();
    },
    // Called just before the Guestbook closes: keep what was typed in the card.
    closing() { commitCard(); commitCard = () => null; },
  };
  // A tap on a guest on the plot opens their card (or switches to it, if the Guestbook is already open).
  UI.onPick((id) => {
    if (!book.guests.some((g) => g.id === id)) return;
    if (UI.isOpen()) showGuest(id, "guestbook-title");
    else UI.open(null, id);
  });
  // The world says when guests have come through the gate; that is remembered so a reload does not replay it.
  let arrivedTimer = null;
  UI.onArrived((ids) => {
    if (!G.markArrived(book, ids)) return;
    // Saved at most twice a second while guests stream in, and always once more after the last one.
    if (!arrivedTimer) arrivedTimer = setTimeout(() => { arrivedTimer = null; G.saveBook(UI.store, book); }, 500);
  });
  window.addEventListener("pagehide", () => { clearTimeout(arrivedTimer); G.saveBook(UI.store, book); });
  { const c = G.counts(book); UI.setGuestCount(c.onPlot + c.onBench, c.onBench, c.afar); }
  UI.setGuests(book.guests.filter(G.inWorld));
  draw();
})();
