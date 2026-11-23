// Glowa venue step: pick a venue type, note a date or a season, and finalise. Rules only (no DOM), so node can
// test them. Finalising is the couple's own decision: nothing here contacts a venue, prices anything, books
// anything or sends anything. It completes the planner's "Book venue" quest once; reopening undoes that.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  else root.GlowaVenue = api;
})(typeof self !== "undefined" ? self : this, function () {
  const VENUE_KEY = "glowa-venue-v1";
  const QUEST_ID = "book-venue";
  const TYPES = [
    { id: "beach", label: "Beach" },
    { id: "winery", label: "Winery" },
    { id: "castle", label: "Castle" },
    { id: "forest", label: "Forest" },
    { id: "desert", label: "Desert" },
  ];
  const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
  const YEAR_MIN = 2025, YEAR_MAX = 2035;
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const typeLabel = (id) => (TYPES.find((t) => t.id === id) || {}).label || "";

  // { type, when: null | { kind: "date", date: "2027-06-12" } | { kind: "season", season: "Autumn", year: 2027 }, finalised }
  function newVenue() {
    return { type: null, when: null, finalised: false };
  }

  // A real calendar date written as YYYY-MM-DD.
  function isDate(text) {
    if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [y, m, d] = text.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= YEAR_MIN && y <= YEAR_MAX;
  }

  // Each change returns an error message, or null. Nothing can change while the venue is finalised.
  const locked = (v) => (v.finalised ? "The venue is finalised. Reopen it to make a change." : null);
  function setType(v, type) {
    if (locked(v)) return locked(v);
    if (!TYPES.some((t) => t.id === type)) return "Pick one of the venue types.";
    v.type = type;
    return null;
  }
  function setDate(v, date) {
    if (locked(v)) return locked(v);
    if (!isDate(date)) return "Use a real date like 2027-06-12, between " + YEAR_MIN + " and " + YEAR_MAX + ".";
    v.when = { kind: "date", date };
    return null;
  }
  function setSeason(v, season, year) {
    if (locked(v)) return locked(v);
    const y = Number(year);
    if (!SEASONS.includes(season)) return "Pick a season.";
    if (!Number.isInteger(y) || y < YEAR_MIN || y > YEAR_MAX) return "Pick a year between " + YEAR_MIN + " and " + YEAR_MAX + ".";
    v.when = { kind: "season", season, year: y };
    return null;
  }
  function clearWhen(v) {
    if (locked(v)) return locked(v);
    v.when = null;
    return null;
  }

  // How the venue is shown: "Castle · Autumn 2027", "Castle · 2027-06-12", "Castle", or "No venue yet".
  function whenLabel(v) {
    if (!v.when) return "";
    return v.when.kind === "date" ? v.when.date : v.when.season + " " + v.when.year;
  }
  function venueLabel(v) {
    if (!v.type) return "No venue yet";
    return [typeLabel(v.type), whenLabel(v)].filter(Boolean).join(" · ");
  }

  // Finalising needs a venue type and a date or season. It completes the "Book venue" quest in the planner
  // (`planner` is the planner's state and `game` its rules, from game.js), which awards its XP once.
  // Returns { error } or { xp } (the XP awarded now: 0 if the quest was already done).
  function finalise(v, planner, game) {
    if (v.finalised) return { error: "The venue is already finalised." };
    if (!v.type) return { error: "Pick a venue type first." };
    if (!v.when) return { error: "Add a date or a season first." };
    if (!game.QUESTS.some((q) => q.id === QUEST_ID)) return { error: "The Book venue quest is missing, so the venue can't be finalised." };
    const before = planner.xp;
    game.completeTask(planner, QUEST_ID);
    v.finalised = true;
    return { xp: planner.xp - before };
  }

  // Reopening undoes the finalise: the quest is reopened and its XP taken back. If a later quest that needs a
  // booked venue is already done, the quest stays done and the reason is given.
  // Returns { error } or { xp } (XP taken back, as a negative number or 0).
  function reopen(v, planner, game) {
    if (!v.finalised) return { error: "The venue isn't finalised." };
    const before = planner.xp;
    if (planner.done[QUEST_ID]) {
      if (!game.canUndo(planner, QUEST_ID)) {
        const later = game.QUESTS.filter((q) => planner.done[q.id] && (q.prereqs || []).includes(QUEST_ID)).map((q) => q.name);
        return { error: "Book venue can't be reopened while " + later.join(" and ") + (later.length > 1 ? " are" : " is") + " done." };
      }
      game.undoTask(planner, QUEST_ID);
    }
    v.finalised = false;
    return { xp: planner.xp - before };
  }

  // ---- saving: its own key; damaged parts fall back to empty ----
  function cleanVenue(s) {
    const v = newVenue();
    if (!isObject(s)) return v;
    if (TYPES.some((t) => t.id === s.type)) v.type = s.type;
    const w = s.when;
    if (isObject(w) && w.kind === "date" && isDate(w.date)) v.when = { kind: "date", date: w.date };
    else if (isObject(w) && w.kind === "season" && SEASONS.includes(w.season) && Number.isInteger(w.year) && w.year >= YEAR_MIN && w.year <= YEAR_MAX) v.when = { kind: "season", season: w.season, year: w.year };
    v.finalised = s.finalised === true && !!v.type && !!v.when;
    return v;
  }
  function loadVenue(storage) {
    let s = null;
    try { s = JSON.parse(storage.getItem(VENUE_KEY)); } catch (e) { /* broken or blocked: start fresh */ }
    const v = cleanVenue(isObject(s) ? s.venue : null);
    const undo = isObject(s) && isObject(s.undo) && typeof s.undo.label === "string" ? { label: s.undo.label.slice(0, 120), venue: cleanVenue(s.undo.venue), reopenQuest: s.undo.reopenQuest === true, redoQuest: s.undo.redoQuest === true } : null;
    return { venue: v, undo };
  }
  function saveVenue(storage, venue, undo) {
    try { storage.setItem(VENUE_KEY, JSON.stringify({ version: 1, venue, undo: undo || null })); return true; } catch (e) { return false; }
  }

  // When the planner says the quest is done or not, the venue follows (for example after the classic planner
  // was used). Returns true if the venue changed.
  function syncWithQuest(v, planner) {
    const done = !!(planner && planner.done && planner.done[QUEST_ID]);
    if (v.finalised && !done) { v.finalised = false; return true; }
    return false;
  }

  return { VENUE_KEY, QUEST_ID, TYPES, SEASONS, YEAR_MIN, YEAR_MAX, newVenue, isDate, setType, setDate, setSeason, clearWhen,
    typeLabel, whenLabel, venueLabel, finalise, reopen, cleanVenue, loadVenue, saveVenue, syncWithQuest };
});
