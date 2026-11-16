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
    const plan = { adds: [], updates: [], merges: [], skipped: [], duplicateNames: [], total: table.rows.length };
    table.rows.forEach((row, index) => {
      const line = index + 2; // line 1 is the header
      const name = clean([cellAt(row, mapping.name), cellAt(row, mapping.last)].filter(Boolean).join(" "), NAME_MAX);
      if (!name) { plan.skipped.push({ line, reason: "No name" }); return; }
      const companion = readCompanion(cellAt(row, mapping.comp));
      // An exported list keeps unnamed plus-ones in their own column.
      if (!companion.name && readCompanion(cellAt(row, mapping.plus)).plusOne) companion.plusOne = true;
      const entry = { line, name, group: clean(cellAt(row, mapping.group), GROUP_MAX), companion };
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
    return plan;
  }

  function makeGuest(book, name, group, now) {
    const id = uuid();
    const guest = { id, code: "G-" + String(book.nextCode++).padStart(3, "0"), name, group: group || "", companionId: null, companionName: "", plusOne: false,
      look: lookFor(id), persona: "", createdAt: now, updatedAt: now };
    book.guests.push(guest);
    return guest;
  }

  // Sets who a guest is bringing. A companion who is on the list is linked both ways; one who is not is kept as a
  // name only. Nobody is ever added to the list silently.
  // `aliases` (optional) maps an older name to a guest id, for a guest renamed in the same import.
  function setCompanion(book, guest, companion, aliases) {
    const old = guest.companionId && book.guests.find((g) => g.id === guest.companionId);
    if (old && old.companionId === guest.id) old.companionId = null;
    guest.companionId = null; guest.companionName = ""; guest.plusOne = false;
    if (!companion) return;
    if (companion.plusOne) { guest.plusOne = true; return; }
    if (!companion.name) return;
    const key = nameKey(companion.name);
    const aliasId = aliases && aliases.get(key);
    const other = book.guests.find((g) => g.id !== guest.id && nameKey(g.name) === key) || book.guests.find((g) => g.id !== guest.id && g.id === aliasId);
    if (!other) { guest.companionName = companion.name; return; }
    const theirs = other.companionId && book.guests.find((g) => g.id === other.companionId);
    if (theirs && theirs.id !== guest.id && theirs.companionId === other.id) theirs.companionId = null;
    guest.companionId = other.id;
    other.companionId = guest.id; other.companionName = ""; other.plusOne = false;
  }

  // Carries out a plan from planImport. Returns { added, updated, merged, skipped }.
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
      touched.push([g, e]);
    }
    // A merged duplicate only fills gaps: it never overwrites what the guest already has.
    for (const e of plan.merges) {
      const g = book.guests.find((x) => nameKey(x.name) === nameKey(e.name));
      if (!g) continue;
      if (!g.group && e.group) { g.group = e.group; g.updatedAt = when; }
      const has = g.companionId || g.companionName || g.plusOne;
      if (!has && (e.companion.plusOne || e.companion.name)) touched.push([g, e]);
    }
    // Companions are linked last, so two people in the same file can name each other.
    for (const [g, e] of touched) setCompanion(book, g, e.companion, aliases);
    const summary = { added: plan.adds.length, updated: plan.updates.length, merged: plan.merges.length, skipped: plan.skipped.length };
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
    g.name = name;
    g.group = clean(fields.group, GROUP_MAX);
    if (fields.companion !== undefined) setCompanion(book, g, readCompanion(fields.companion));
    g.updatedAt = now || new Date().toISOString();
    return null;
  }

  // Removes a guest and returns what is needed to put them back exactly (their place, and who they were linked to).
  function deleteGuest(book, id) {
    const index = book.guests.findIndex((x) => x.id === id);
    if (index < 0) return null;
    const guest = book.guests[index];
    const partner = guest.companionId && book.guests.find((g) => g.id === guest.companionId && g.companionId === id);
    if (partner) partner.companionId = null;
    book.guests.splice(index, 1);
    return { guest, index, partnerId: partner ? partner.id : null };
  }

  function undoDelete(book, removed) {
    if (!removed || book.guests.some((g) => g.id === removed.guest.id)) return false;
    book.guests.splice(Math.min(removed.index, book.guests.length), 0, removed.guest);
    const partner = removed.partnerId && book.guests.find((g) => g.id === removed.partnerId);
    if (partner && !partner.companionId) partner.companionId = removed.guest.id;
    else if (!partner) removed.guest.companionId = null;
    return true;
  }

  // The words shown for who a guest is bringing.
  function companionLabel(book, g) {
    if (g.companionId) { const o = book.guests.find((x) => x.id === g.companionId); if (o) return o.name; }
    if (g.companionName) return g.companionName;
    return g.plusOne ? "+1" : "";
  }

  function searchGuests(book, query) {
    const q = nameKey(query);
    if (!q) return book.guests.slice();
    return book.guests.filter((g) => (nameKey(g.name) + " " + nameKey(g.group) + " " + g.code.toLowerCase()).includes(q));
  }

  // guests: people on the list. withCompanion: guests bringing someone. extra: companions who are not on the list
  // (unnamed plus-ones and named companions). headcount: everyone who would turn up.
  function counts(book) {
    let withCompanion = 0, extra = 0;
    for (const g of book.guests) {
      const linked = g.companionId && book.guests.some((x) => x.id === g.companionId);
      if (linked || g.companionName || g.plusOne) withCompanion++;
      if (!linked && (g.companionName || g.plusOne)) extra++;
    }
    return { guests: book.guests.length, withCompanion, extra, headcount: book.guests.length + extra };
  }

  // ---- export ----
  const EXPORT_HEADERS = ["Name", "Group", "Companion", "Plus one", "Guest code", "Guest ID"];
  function csvCell(value) {
    let v = String(value == null ? "" : value);
    // A cell that starts like a formula is given a leading apostrophe so a spreadsheet shows it as text.
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function exportCsv(book) {
    const lines = [EXPORT_HEADERS.join(",")];
    for (const g of book.guests) {
      const companion = g.plusOne ? "" : companionLabel(book, g);
      lines.push([g.name, g.group, companion, g.plusOne ? "Yes" : "", g.code, g.id].map(csvCell).join(","));
    }
    return lines.join("\r\n") + "\r\n";
  }
  // Reading an exported file back: the "Plus one" column folds into the companion column.
  function exportMapping(headers) {
    const at = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (EXPORT_HEADERS.every((h) => at(h) >= 0)) return { name: at("Name"), last: -1, comp: at("Companion"), group: at("Group"), id: at("Guest ID"), plus: at("Plus one") };
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
      companionId: isUuid(g.companionId) ? g.companionId.toLowerCase() : null, companionName: clean(g.companionName, NAME_MAX), plusOne: g.plusOne === true,
      look: { skin: hex(look.skin, base.skin), hair: hex(look.hair, base.hair), outfit: hex(look.outfit, base.outfit), style: LOOKS.style.includes(look.style) ? look.style : base.style },
      persona: clean(g.persona, 40),
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
      if (g.companionId) { g.companionName = ""; g.plusOne = false; }
      else if (g.companionName) g.plusOne = false;
    }
    if (Array.isArray(saved.batches)) book.batches = saved.batches.filter(isObject).slice(-50);
    return book;
  }

  // Returns true when saved. The raw spreadsheet is never stored: only the guests made from it.
  function saveBook(storage, book) {
    try { storage.setItem(GUESTS_KEY, JSON.stringify(book)); return true; } catch (e) { return false; }
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
    newBook, uuid, isUuid, lookFor, nameKey, parseCsv, tableFrom, guessMapping, readCompanion, planImport, applyImport,
    addGuest, editGuest, deleteGuest, undoDelete, setCompanion, companionLabel, searchGuests, counts, exportCsv, exportMapping,
    loadBook, saveBook, sampleTable };
});
