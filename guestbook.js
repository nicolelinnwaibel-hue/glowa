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
    UI.setGuestCount(book.guests.length);
    return ok;
  }

  function go(next, focus) {
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
    go("roster");
    if (saved) UI.toast("Your guestbook is filled in", parts.join(", ") + ". Guests walk in through the gate in the next step of the build.");
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

  function drawRoster() {
    const c = G.counts(book);
    sub.textContent = plural(c.guests, "guest", "guests") + (c.plusOnes ? ", " + plural(c.plusOnes, "plus-one", "plus-ones") + " included" : "");
    const input = h("input", { id: "glowa-new", type: "text", placeholder: "Full name", maxlength: G.NAME_MAX, autocomplete: "off",
      onkeydown: (e) => { if (e.key === "Enter") addByHand(input, "glowa-new"); } });
    const found = G.searchGuests(book, query);
    const list = h("div", { class: "rows", id: "glowa-rows" });
    const fill = () => {
      list.textContent = "";
      const rows = G.searchGuests(book, query);
      for (const g of rows) {
        const companion = G.companionLabel(book, g);
        list.append(h("button", { type: "button", class: "row", "aria-label": "Edit " + g.name, onclick: () => { editing = g.id; go("edit"); } }, [
          h("span", { class: "dot", "aria-hidden": "true", style: "background:" + g.look.outfit + ";box-shadow:inset 0 9px 0 " + g.look.hair }),
          h("span", { class: "who" }, [h("b", { text: g.name }), h("span", { text: [g.plusOneOf ? "Plus-one of " + G.hostLabel(book, g) : companion && "with " + companion, g.group].filter(Boolean).join(" · ") || "No group yet" })]),
          h("span", { class: "code", text: g.code }),
        ]));
      }
      if (!rows.length) list.append(h("span", { class: "sub", role: "status", text: book.guests.length ? "Nobody matches that search." : "No guests yet. Add one above or import a list." }));
    };
    fill();
    void found;
    return [
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "inline" }, [
        h("button", { type: "button", class: "btn primary", disabled: book.guests.length === 0, onclick: exportList }, [
          svg('<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2 V11 M5 7.5 L9 11.5 L13 7.5 M3 13 V15.5 H15 V13"></path></svg>'),
          h("span", { text: "Export CSV" }),
        ]),
        h("button", { type: "button", class: "btn", text: "Import more", onclick: () => { note = ""; go("start"); } }),
      ]),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "glowa-new", text: "Add a guest" }),
        h("div", { class: "inline" }, [input, h("button", { type: "button", class: "btn", text: "Add", onclick: () => addByHand(input, "glowa-new") })]),
      ]),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "glowa-search", text: "Search" }),
        h("input", { id: "glowa-search", type: "search", placeholder: "Name or group", value: query, autocomplete: "off", oninput: (e) => { query = e.target.value; fill(); } }),
      ]),
      list,
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

  function drawEdit() {
    const g = book.guests.find((x) => x.id === editing);
    if (!g) { view = "roster"; return drawRoster(); }
    sub.textContent = "Guest " + g.code;
    const name = h("input", { id: "edit-name", type: "text", value: g.name, maxlength: G.NAME_MAX, autocomplete: "off" });
    const group = h("input", { id: "edit-group", type: "text", value: g.group, maxlength: 60, autocomplete: "off", placeholder: "Family, work, school friends" });
    const companion = h("input", { id: "edit-comp", type: "text", value: G.companionLabel(book, g), maxlength: G.NAME_MAX, autocomplete: "off", placeholder: "A name, or +1" });
    const saveEdit = () => {
      const error = G.editGuest(book, g.id, { name: name.value, group: group.value, companion: companion.value });
      if (error) { note = error; focusNext = "edit-name"; return draw(); }
      note = "";
      save();
      go("roster");
    };
    for (const el of [name, group, companion]) el.addEventListener("keydown", (e) => { if (e.key === "Enter") saveEdit(); });
    return [
      h("button", { type: "button", class: "btn link", text: "Back to the guest list", onclick: () => { note = ""; go("roster"); } }),
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-name", text: "Name" }), name]),
      h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-group", text: "Group" }), group]),
      g.plusOneOf
        ? h("div", { class: "note", text: "Plus-one of " + G.hostLabel(book, g) + ". They stay with their host, and you can rename or remove them here." })
        : h("div", { class: "stack" }, [h("label", { class: "lbl", for: "edit-comp", text: "Companion" }), companion,
          h("span", { class: "sub", text: "Type +1 to give them a plus-one, a new name to name their plus-one, or the name of a guest already on the list to link the two. Clear the box and their plus-one comes off the list." })]),
      h("button", { type: "button", class: "go", text: "Save changes", onclick: saveEdit }),
      h("button", { type: "button", class: "btn wide danger", text: "Remove " + g.name + (G.plusOneOfHost(book, g) ? " and their plus-one" : ""), onclick: () => {
        const removed = G.deleteGuest(book, g.id);
        note = "";
        save();
        go("roster");
        UI.toast(g.name + " removed", removed.items.length > 1 ? "Their plus-one left with them." : "They are off your list.", { label: "Undo", run: () => { if (G.undoDelete(book, removed)) { save(); draw(); } } });
      } }),
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
    opened() { note = ""; confirmClear = false; imp = null; view = book.guests.length ? "roster" : "start"; draw(); },
  };
  UI.setGuestCount(book.guests.length);
  draw();
})();
