// Glowa guestbook core: the real guest list (no DOM here, so node can test it).
// Guests are saved under their own key. This file never reads or writes the planner's save or the world's camera save.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  else root.GlowaGuests = api;
})(typeof self !== "undefined" ? self : this, function () {
  const GUESTS_KEY = "glowa-guests-v1";
  const GUESTS_VERSION = 1;
  const MAX_GUESTS = 1000;
  const MAX_ROWS = 5000;
  const NAME_MAX = 80;
  const GROUP_MAX = 60;

  const LOOKS = {
    skin: ["#F6D3B3", "#E8B48C", "#C98D62", "#9A6240", "#6B4226"],
    hair: ["#2B2140", "#5A3A22", "#A8632B", "#E0B050", "#C9C3D6", "#D2553F"],
    outfit: ["#7A52BC", "#F6BE4A", "#E4577A", "#3F8FB5", "#3E9B73", "#F08A4B", "#F4F0E6", "#39405F"],
    style: ["short", "bob", "long", "bun", "hat"],
  };
  // The names shown for each colour and style, for labels and screen readers.
  const LOOK_NAMES = {
    skin: ["Skin tone 1", "Skin tone 2", "Skin tone 3", "Skin tone 4", "Skin tone 5"],
    hair: ["Black", "Brown", "Auburn", "Blonde", "Silver", "Red"],
    outfit: ["Heather", "Marigold", "Rose", "Loch blue", "Moss", "Tangerine", "Ivory", "Navy"],
    style: ["Short", "Bob", "Long", "Bun", "Top hat"],
  };
  // Playful labels a player can give a guest. They are made up for fun and say nothing real about anyone.
  const PERSONAS = ["Life of the party", "Happy crier", "Dance floor menace", "Snack scout", "Early to bed", "Speech heckler"];
  // A plus-one's outfit starts in this colour, which no other guest starts with, so they are easy to spot.
  const PLUS_ONE_OUTFIT = "#8FD3C8";

  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  // Names are compared without case, accents or extra spaces: "José  Díaz" and "jose diaz" are the same person.
  const nameKey = (name) => clean(name, NAME_MAX).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.map((n) => n.toString(16).padStart(2, "0")).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  // A guest's starting look comes from their id, so it is the same on every device and after every reload.
  function lookFor(id) {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    const pick = (list, shift) => list[((h >>> shift) & 0xff) % list.length];
    return { skin: pick(LOOKS.skin, 0), hair: pick(LOOKS.hair, 8), outfit: pick(LOOKS.outfit, 16), style: pick(LOOKS.style, 24) };
  }

  function newBook() {
    return { version: GUESTS_VERSION, weddingId: uuid(), nextCode: 1, guests: [], batches: [] };
  }

  // ---- reading spreadsheets ----
  // CSV text to rows of cells. Handles quoted cells, commas and line breaks inside quotes, doubled quotes,
  // Windows line endings, a byte-order mark, and semicolon or tab separated files.
  function parseCsv(text) {
    let t = String(text || "");
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    const firstLine = t.split(/\r?\n/, 1)[0] || "";
    const count = (ch) => firstLine.split(ch).length - 1;
    const sep = count("\t") > count(",") && count("\t") >= count(";") ? "\t" : count(";") > count(",") ? ";" : ",";
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (quoted) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += ch;
      } else if (ch === '"' && cell === "") quoted = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && t[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        rows.push(row); row = [];
      } else cell += ch;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== "")).slice(0, MAX_ROWS + 1);
  }

  // Splits rows into a header row and the rest. Empty header cells get a name like "Column 3".
  function tableFrom(rows) {
    if (!rows.length) return { headers: [], rows: [] };
    const width = Math.max(...rows.map((r) => r.length));
    const headers = Array.from({ length: width }, (_, i) => clean(rows[0][i], 60) || "Column " + (i + 1));
    return { headers, rows: rows.slice(1) };
  }

  // Best guess at which column is which. -1 means "none". Any column names are accepted; the player can change these.
  function guessMapping(headers) {
    const find = (re, skip) => headers.findIndex((h, i) => re.test(h) && !(skip || []).includes(i));
    const id = find(/^(guest\s*)?id$|glowa/i);
    const first = find(/first|given|forename/i);
    const last = find(/last|surname|family\s*name/i);
    let name = find(/^(full\s*)?name$|guest\s*name|full\s*name|^guest$/i);
    if (name < 0 && first < 0) name = find(/name/i, [id]);
    const comp = find(/plus|\+\s*1|companion|partner|spouse|bringing|date$/i, [name, first, last]);
    const group = find(/side|group|household|family|party|table|relationship|category/i, [name, first, last, comp]);
    return { name: name >= 0 ? name : (first >= 0 ? first : 0), last: name >= 0 ? -1 : (first >= 0 ? last : -1), comp, group, id };
  }

  // What a companion cell means: nobody, an unnamed plus-one, or a named person.
  function readCompanion(value) {
    const v = clean(value, NAME_MAX).replace(/^'(?=[=+\-@])/, "");
    if (!v || /^(no|n|none|false|0|-|n\/a|na)$/i.test(v)) return { plusOne: false, name: "" };
    if (/^(yes|y|true|1|\+\s*1|plus\s*one|plus\s*1|guest|\+1 guest|tbc|tbd)$/i.test(v)) return { plusOne: true, name: "" };
    return { plusOne: false, name: v };
  }

  const cellAt = (row, i) => (i >= 0 && i < row.length ? clean(row[i], 200).replace(/^'(?=[=+\-@])/, "") : "");

  // Works out what an import would do, without changing anything. `duplicates` is "merge" or "keep".
  // Returns { adds, updates, merges, skipped, duplicateNames, total }.
  function planImport(book, table, mapping, duplicates) {
    const byKey = new Map(book.guests.map((g) => [nameKey(g.name), g]));
    const byId = new Map(book.guests.map((g) => [g.id, g]));
    const seen = new Map();
    const plan = { adds: [], updates: [], merges: [], skipped: [], duplicateNames: [], plusOnes: 0, total: table.rows.length };
    table.rows.forEach((row, index) => {
      const line = index + 2; // line 1 is the header
      const name = clean([cellAt(row, mapping.name), cellAt(row, mapping.last)].filter(Boolean).join(" "), NAME_MAX);
      if (!name) { plan.skipped.push({ line, reason: "No name" }); return; }
      const companion = readCompanion(cellAt(row, mapping.comp));
      // An exported list says whose plus-one a guest is.
      const entry = { line, name, group: clean(cellAt(row, mapping.group), GROUP_MAX), companion, plusOf: clean(cellAt(row, mapping.plus), NAME_MAX) };
      // A row that carries the id of a guest already in the book updates that guest: this is how an exported list comes back in.
      const id = cellAt(row, mapping.id);
      if (isUuid(id) && byId.has(id.toLowerCase())) { plan.updates.push({ ...entry, id: id.toLowerCase() }); seen.set(nameKey(name), true); return; }
      const key = nameKey(name);
      const clash = byKey.has(key) || seen.has(key);
      if (clash) {
        if (!plan.duplicateNames.includes(name)) plan.duplicateNames.push(name);
        if (duplicates !== "keep") { plan.merges.push(entry); return; }
      }
      seen.set(key, true);
      plan.adds.push(entry);
    });
    const room = MAX_GUESTS - book.guests.length;
    if (plan.adds.length > room) {
      for (const e of plan.adds.splice(Math.max(0, room))) plan.skipped.push({ line: e.line, reason: "The guestbook holds " + MAX_GUESTS + " guests" });
    }
    // How many plus-ones this import would create: one for each "yes", and one for each companion named in the
    // file who is not a guest already and has no row of their own.
    const listed = new Set(book.guests.map((g) => nameKey(g.name)));
    for (const e of plan.adds.concat(plan.updates)) listed.add(nameKey(e.name));
    const brings = (e) => e.companion.plusOne || (!!e.companion.name && !listed.has(nameKey(e.companion.name)));
    const hasPlusOne = (g) => book.guests.some((x) => x.plusOneOf === g.id);
    for (const e of plan.adds) if (brings(e)) plan.plusOnes++;
    for (const e of plan.updates) if (brings(e) && !hasPlusOne(byId.get(e.id))) plan.plusOnes++;
    for (const e of plan.merges) { const g = byKey.get(nameKey(e.name)); if (g && !g.companionId && brings(e)) plan.plusOnes++; }
    plan.plusOnes = Math.max(0, Math.min(plan.plusOnes, MAX_GUESTS - book.guests.length - plan.adds.length));
    return plan;
  }

  function makeGuest(book, name, group, now) {
    const id = uuid();
    const guest = { id, code: "G-" + String(book.nextCode++).padStart(3, "0"), name, group: group || "", companionId: null, plusOneOf: null, unnamed: false,
      look: lookFor(id), persona: "", arrived: false, createdAt: now, updatedAt: now };
    book.guests.push(guest);
    return guest;
  }

  const byGuestId = (book, id) => (id ? book.guests.find((g) => g.id === id) || null : null);
  const plusOneName = (host) => clean(host.name + "'s plus-one", NAME_MAX);
  // The plus-one a guest brought, if they have one. A plus-one is a guest too: own id, own avatar, in the count.
  const plusOneOfHost = (book, host) => book.guests.find((g) => g.plusOneOf === host.id) || null;

  function unlink(book, guest) {
    const other = byGuestId(book, guest.companionId);
    if (other && other.companionId === guest.id) other.companionId = null;
    guest.companionId = null;
  }
  function link(book, a, b) {
    if (a.companionId !== b.id) unlink(book, a);
    if (b.companionId !== a.id) unlink(book, b);
    a.companionId = b.id; b.companionId = a.id;
  }

  // Adds a plus-one for a host, placed straight after them in the list. Returns the new guest, or null when full.
  function createPlusOne(book, host, name, now) {
    if (book.guests.length >= MAX_GUESTS) return null;
    const g = makeGuest(book, name || plusOneName(host), host.group, now);
    g.plusOneOf = host.id;
    g.unnamed = !name;
    g.look.outfit = PLUS_ONE_OUTFIT;
    book.guests.splice(book.guests.indexOf(host) + 1, 0, book.guests.pop());
    link(book, host, g);
    return g;
  }

  function removeGuestOnly(book, guest) {
    unlink(book, guest);
    const i = book.guests.indexOf(guest);
    if (i >= 0) book.guests.splice(i, 1);
  }

  // Sets who a guest is bringing. `companion` is { plusOne, name } from readCompanion.
  // - nobody: the link is cleared, and a plus-one this guest brought is taken off the list with it.
  // - "yes" or "+1": the guest gets a plus-one, who is a guest in their own right.
  // - a name on the list: the two guests are linked.
  // - a name not on the list: that person becomes this guest's plus-one (or names the plus-one they already have).
  // `aliases` (optional) maps an older name to a guest id, for a guest renamed in the same import.
  // Returns the plus-one created, if one was.
  function setCompanion(book, guest, companion, aliases, now) {
    if (guest.plusOneOf) return null; // a plus-one stays with their host
    const when = now || new Date().toISOString();
    const mine = plusOneOfHost(book, guest);
    const wants = companion || { plusOne: false, name: "" };
    if (!wants.plusOne && !wants.name) {
      if (mine) removeGuestOnly(book, mine);
      unlink(book, guest);
      return null;
    }
    if (wants.plusOne) {
      if (mine) { link(book, guest, mine); return null; }
      return createPlusOne(book, guest, "", when);
    }
    const key = nameKey(wants.name);
    const aliasId = aliases && aliases.get(key);
    const other = book.guests.find((g) => g.id !== guest.id && nameKey(g.name) === key) || book.guests.find((g) => g.id !== guest.id && g.id === aliasId) || null;
    if (other && other === mine) { link(book, guest, mine); return null; }
    // A listed guest who is not somebody else's plus-one: link the two.
    if (other && !other.plusOneOf) {
      if (mine) removeGuestOnly(book, mine);
      link(book, guest, other);
      return null;
    }
    if (mine) { mine.name = clean(wants.name, NAME_MAX); mine.unnamed = false; mine.updatedAt = when; link(book, guest, mine); return null; }
    return createPlusOne(book, guest, clean(wants.name, NAME_MAX), when);
  }

  // An unnamed plus-one is called after their host, so the name follows the host's.
  function syncPlusOneName(book, host) {
    const mine = plusOneOfHost(book, host);
    if (mine && mine.unnamed) mine.name = plusOneName(host);
  }

  // Carries out a plan from planImport. Returns { added, updated, merged, skipped, plusOnes }.
  function applyImport(book, plan, meta, now) {
    const when = now || new Date().toISOString();
    const touched = [];
    const aliases = new Map();
    for (const e of plan.adds) touched.push([makeGuest(book, e.name, e.group, when), e]);
    for (const e of plan.updates) {
      const g = book.guests.find((x) => x.id === e.id);
      // If this guest is renamed here, another row may still name them the old way as a companion.
      if (nameKey(g.name) !== nameKey(e.name)) aliases.set(nameKey(g.name), g.id);
      g.name = e.name; g.group = e.group; g.updatedAt = when;
      if (g.plusOneOf) { const host = byGuestId(book, g.plusOneOf); g.unnamed = !!host && g.name === plusOneName(host); }
      touched.push([g, e]);
    }
    // A merged duplicate only fills gaps: it never overwrites what the guest already has.
    for (const e of plan.merges) {
      const g = book.guests.find((x) => nameKey(x.name) === nameKey(e.name));
      if (!g) continue;
      if (!g.group && e.group) { g.group = e.group; g.updatedAt = when; }
      if (!g.companionId && (e.companion.plusOne || e.companion.name)) touched.push([g, e]);
    }
    const find = (name) => book.guests.find((g) => nameKey(g.name) === nameKey(name)) || byGuestId(book, aliases.get(nameKey(name)));
    // Rows that say whose plus-one they are (an exported list coming back) are attached to that host first.
    for (const [g, e] of touched) {
      const host = e.plusOf && find(e.plusOf);
      if (!host || host.id === g.id || host.plusOneOf) continue;
      const already = plusOneOfHost(book, host);
      if (already && already !== g) continue;
      g.plusOneOf = host.id;
      g.unnamed = g.name === plusOneName(host);
      if (!plan.updates.some((u) => u.id === g.id)) g.look.outfit = PLUS_ONE_OUTFIT;
      link(book, host, g);
    }
    // Companions are linked last, so two people in the same file can name each other.
    let plusOnes = 0;
    for (const [g, e] of touched) {
      if (g.plusOneOf) continue;
      if (setCompanion(book, g, e.companion, aliases, when)) plusOnes++;
      syncPlusOneName(book, g);
    }
    const summary = { added: plan.adds.length, updated: plan.updates.length, merged: plan.merges.length, skipped: plan.skipped.length, plusOnes };
    book.batches.push({ id: uuid(), at: when, file: clean(meta && meta.file, 120), sheet: clean(meta && meta.sheet, 60), ...summary });
    return summary;
  }

  // ---- the roster ----
  // Returns { error } or { guest }.
  function addGuest(book, name, now) {
    const n = clean(name, NAME_MAX);
    if (!n) return { error: "Type a name first." };
    if (book.guests.length >= MAX_GUESTS) return { error: "The guestbook holds " + MAX_GUESTS + " guests." };
    return { guest: makeGuest(book, n, "", now || new Date().toISOString()) };
  }

  // Changes a guest's name, group or companion. `companion` is free text: empty, "+1", or a name.
  function editGuest(book, id, fields, now) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return "That guest is no longer on the list.";
    const name = clean(fields.name, NAME_MAX);
    if (!name) return "A guest needs a name.";
    const when = now || new Date().toISOString();
    if (g.plusOneOf && name !== g.name) g.unnamed = false;
    g.name = name;
    g.group = clean(fields.group, GROUP_MAX);
    if (fields.companion !== undefined && !g.plusOneOf) {
      if (book.guests.length >= MAX_GUESTS && !g.companionId && readCompanion(fields.companion).plusOne) return "The guestbook holds " + MAX_GUESTS + " guests.";
      setCompanion(book, g, readCompanion(fields.companion), null, when);
    }
    syncPlusOneName(book, g);
    g.updatedAt = when;
    return null;
  }

  // Removes a guest. A plus-one they brought leaves with them; removing a plus-one leaves the host on the list.
  // Returns what is needed to put everyone back exactly, or null if the guest is not on the list.
  function deleteGuest(book, id) {
    const guest = book.guests.find((x) => x.id === id);
    if (!guest) return null;
    const leaving = [guest].concat(book.guests.filter((g) => g.plusOneOf === id));
    const gone = new Set(leaving.map((g) => g.id));
    const items = leaving.map((g) => ({ guest: g, index: book.guests.indexOf(g), companionId: g.companionId })).sort((a, b) => a.index - b.index);
    // Someone staying on the list who was linked to a guest who is leaving.
    const partners = book.guests.filter((g) => !gone.has(g.id) && gone.has(g.companionId)).map((g) => ({ id: g.id, companionId: g.companionId }));
    for (const p of partners) byGuestId(book, p.id).companionId = null;
    book.guests = book.guests.filter((g) => !gone.has(g.id));
    return { items, partners };
  }

  function undoDelete(book, removed) {
    if (!removed || removed.items.some((it) => book.guests.some((g) => g.id === it.guest.id))) return false;
    if (book.guests.length + removed.items.length > MAX_GUESTS) return false;
    for (const it of removed.items) {
      it.guest.companionId = it.companionId;
      book.guests.splice(Math.min(it.index, book.guests.length), 0, it.guest);
    }
    for (const p of removed.partners) { const g = byGuestId(book, p.id); if (g && !g.companionId) g.companionId = p.companionId; }
    // Any link that no longer points both ways is cleared.
    for (const g of book.guests) { const o = byGuestId(book, g.companionId); if (g.companionId && (!o || o.companionId !== g.id)) g.companionId = null; }
    return true;
  }

  // The name of who a guest is with, or "".
  function companionLabel(book, g) {
    const o = byGuestId(book, g.companionId);
    return o ? o.name : "";
  }
  // For a plus-one, their host's name; otherwise "".
  function hostLabel(book, g) {
    const o = byGuestId(book, g.plusOneOf);
    return o ? o.name : "";
  }

  function searchGuests(book, query) {
    const q = nameKey(query);
    if (!q) return book.guests.slice();
    return book.guests.filter((g) => (nameKey(g.name) + " " + nameKey(g.group) + " " + g.code.toLowerCase()).includes(q));
  }

  // guests: everyone on the list, plus-ones included. plusOnes: how many of them came as somebody's plus-one.
  // withCompanion: guests (not counting plus-ones) who are with someone.
  function counts(book) {
    let plusOnes = 0, withCompanion = 0;
    for (const g of book.guests) {
      if (g.plusOneOf) plusOnes++;
      else if (g.companionId) withCompanion++;
    }
    return { guests: book.guests.length, plusOnes, withCompanion };
  }

  // ---- export ----
  const EXPORT_HEADERS = ["Name", "Group", "Companion", "Plus one of", "Guest code", "Guest ID"];
  function csvCell(value) {
    let v = String(value == null ? "" : value);
    // A cell that starts like a formula is given a leading apostrophe so a spreadsheet shows it as text.
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCsv(book) {
    const lines = [EXPORT_HEADERS.join(",")];
    for (const g of book.guests) {
      lines.push([g.name, g.group, companionLabel(book, g), hostLabel(book, g), g.code, g.id].map(csvCell).join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }
  // Reading an exported file back: its columns are known, so nothing needs guessing.
  function exportMapping(headers) {
    const at = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (EXPORT_HEADERS.every((h) => at(h) >= 0)) return { name: at("Name"), last: -1, comp: at("Companion"), group: at("Group"), id: at("Guest ID"), plus: at("Plus one of") };
    return null;
  }

  // ---- saving ----
  function cleanGuest(g, codes) {
    if (!isObject(g) || !isUuid(g.id)) return null;
    const name = clean(g.name, NAME_MAX);
    if (!name) return null;
    const base = lookFor(g.id.toLowerCase());
    const look = isObject(g.look) ? g.look : {};
    const hex = (v, d) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
    let code = typeof g.code === "string" && /^G-\d{3,}$/.test(g.code) && !codes.has(g.code) ? g.code : null;
    return {
      id: g.id.toLowerCase(), code, name, group: clean(g.group, GROUP_MAX),
      companionId: isUuid(g.companionId) ? g.companionId.toLowerCase() : null, plusOneOf: isUuid(g.plusOneOf) ? g.plusOneOf.toLowerCase() : null, unnamed: g.unnamed === true,
      // From the first M2 build, where a plus-one was a note on the guest. Turned into a guest when loaded.
      oldPlusOne: g.plusOne === true, oldCompanionName: clean(g.companionName, NAME_MAX),
      look: { skin: hex(look.skin, base.skin), hair: hex(look.hair, base.hair), outfit: hex(look.outfit, isUuid(g.plusOneOf) ? PLUS_ONE_OUTFIT : base.outfit), style: LOOKS.style.includes(look.style) ? look.style : base.style },
      persona: PERSONAS.includes(g.persona) ? g.persona : "",
      // Whether this guest has already walked in through the gate, so a reload does not replay their arrival.
      arrived: g.arrived === true,
      createdAt: typeof g.createdAt === "string" ? g.createdAt : "", updatedAt: typeof g.updatedAt === "string" ? g.updatedAt : "",
    };
  }

  // Reads the saved guestbook. Anything missing or damaged falls back to a safe default, guest by guest.
  function loadBook(storage) {
    let saved = null;
    try { saved = JSON.parse(storage.getItem(GUESTS_KEY)); } catch (e) { /* broken or blocked: start fresh */ }
    if (!isObject(saved) || !Array.isArray(saved.guests)) return newBook();
    const book = newBook();
    if (isUuid(saved.weddingId)) book.weddingId = saved.weddingId;
    const ids = new Set(), codes = new Set();
    for (const raw of saved.guests.slice(0, MAX_GUESTS)) {
      const g = cleanGuest(raw, codes);
      if (!g || ids.has(g.id)) continue;
      ids.add(g.id);
      if (g.code) codes.add(g.code);
      book.guests.push(g);
    }
    let next = Number.isInteger(saved.nextCode) && saved.nextCode > 0 ? saved.nextCode : 1;
    for (const c of codes) next = Math.max(next, parseInt(c.slice(2), 10) + 1);
    book.nextCode = next;
    for (const g of book.guests) {
      if (!g.code) g.code = "G-" + String(book.nextCode++).padStart(3, "0");
      // A link is kept only when both guests exist and point at each other.
      const other = g.companionId && book.guests.find((x) => x.id === g.companionId);
      if (!other || other.id === g.id) g.companionId = null;
      else if (other.companionId !== g.id) { if (!other.companionId) other.companionId = g.id; else g.companionId = null; }
    }
    for (const g of book.guests.slice()) {
      // A plus-one needs a host who is on the list and is not a plus-one themselves; otherwise they are a plain guest.
      const host = g.plusOneOf && book.guests.find((x) => x.id === g.plusOneOf);
      if (g.plusOneOf && (!host || host.id === g.id || host.plusOneOf)) { g.plusOneOf = null; g.unnamed = false; }
      if (g.unnamed && !g.plusOneOf) g.unnamed = false;
      const old = { plusOne: g.oldPlusOne, name: g.oldCompanionName };
      delete g.oldPlusOne; delete g.oldCompanionName;
      if (!g.companionId && !g.plusOneOf && (old.plusOne || old.name)) createPlusOne(book, g, old.name, g.updatedAt || g.createdAt);
    }
    if (Array.isArray(saved.batches)) book.batches = saved.batches.filter(isObject).slice(-50);
    return book;
  }

  // Returns true when saved. The raw spreadsheet is never stored: only the guests made from it.
  function saveBook(storage, book) {
    try { storage.setItem(GUESTS_KEY, JSON.stringify(book)); return true; } catch (e) { return false; }
  }

  // The choices offered for a guest's look. A plus-one can also go back to plus-one mint.
  function lookChoices(guest) {
    const outfit = LOOKS.outfit.map((value, i) => ({ value, name: LOOK_NAMES.outfit[i] }));
    if (guest && guest.plusOneOf) outfit.unshift({ value: PLUS_ONE_OUTFIT, name: "Plus-one mint" });
    const list = (key) => LOOKS[key].map((value, i) => ({ value, name: LOOK_NAMES[key][i] }));
    return { style: list("style"), hair: list("hair"), outfit, skin: list("skin") };
  }

  // Changes part of a guest's look: any of skin, hair, outfit, style. Only the offered choices are accepted.
  // Returns an error message, or null when saved. The look belongs to the guest's id, so it survives renames,
  // sorting, reloads and re-imports.
  function setLook(book, id, changes, now) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return "That guest is no longer on the list.";
    const choices = lookChoices(g);
    const next = { ...g.look };
    for (const key of Object.keys(changes || {})) {
      if (!choices[key]) return "That is not part of a guest's look.";
      if (!choices[key].some((c) => c.value === changes[key])) return "Pick one of the choices shown.";
      next[key] = changes[key];
    }
    g.look = next;
    g.updatedAt = now || new Date().toISOString();
    return null;
  }

  // Sets or clears (with "") a guest's playful label.
  function setPersona(book, id, persona, now) {
    const g = book.guests.find((x) => x.id === id);
    if (!g) return "That guest is no longer on the list.";
    if (persona !== "" && !PERSONAS.includes(persona)) return "Pick one of the choices shown.";
    g.persona = persona;
    g.updatedAt = now || new Date().toISOString();
    return null;
  }

  // Marks guests as having walked in. Returns how many changed.
  function markArrived(book, ids) {
    const set = new Set(ids);
    let n = 0;
    for (const g of book.guests) if (set.has(g.id) && !g.arrived) { g.arrived = true; n++; }
    return n;
  }

  // The sample list: 120 made-up guests, the same every time.
  function sampleTable() {
    const first = ["Maya", "Tom", "Priya", "Callum", "Aisha", "Ewan", "Sofia", "Jack", "Isla", "Rohan", "Grace", "Finn", "Lena", "Mateo", "Ruby", "Hamish", "Zoe", "Omar", "Elsie", "Theo",
      "Nora", "Kai", "Freya", "Luca", "Iris", "Angus", "Mei", "Noah", "Tess", "Arjun", "Clara", "Rory", "Ada", "Jonah", "Skye", "Felix", "Hana", "Blair", "June", "Marco"];
    const last = ["Chen", "Baker", "Patel", "Fraser", "Khan", "Murray", "Rossi", "Hughes", "Stewart", "Mehta", "Lee", "Doyle", "Novak", "Garcia", "Bell", "MacLeod", "Park", "Hassan", "Reid", "Brooks",
      "Lind", "Okafor", "Grant", "Romano", "Shaw", "Kerr", "Tanaka", "Cole", "Wynn", "Dubois"];
    const groups = ["Family", "School friends", "Work", "University", "Neighbours", "Family friends"];
    const rows = [];
    for (let i = 0; i < 120; i++) {
      const name = first[i % first.length] + " " + last[(i * 7 + Math.floor(i / first.length)) % last.length];
      rows.push([name, i % 5 === 0 ? "Yes" : "", groups[(i * 5) % groups.length]]);
    }
    return { headers: ["Full Name", "Plus one", "Side"], rows };
  }

  return { GUESTS_KEY, GUESTS_VERSION, MAX_GUESTS, MAX_ROWS, NAME_MAX, LOOKS, EXPORT_HEADERS,
    PLUS_ONE_OUTFIT, newBook, uuid, isUuid, lookFor, nameKey, parseCsv, tableFrom, guessMapping, readCompanion, planImport, applyImport,
    addGuest, editGuest, deleteGuest, undoDelete, setCompanion, companionLabel, hostLabel, plusOneOfHost, searchGuests, counts, exportCsv, exportMapping,
    loadBook, saveBook, sampleTable, markArrived, LOOK_NAMES, PERSONAS, lookChoices, setLook, setPersona };
});
