// Glowa dress picker: choose one of five styles (your avatar wears it), mark it purchased, and note the price.
// Rules only (no DOM). Nothing is bought or sent; the price is a note, never added up. Marking purchased
// completes the planner's "Choose outfits" quest once; undo reverses it.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  else root.GlowaDress = api;
})(typeof self !== "undefined" ? self : this, function () {
  const DRESS_KEY = "glowa-dress-v1";
  const QUEST_ID = "pick-outfits";
  const STYLES = [
    { id: "aline", label: "A-line", line: "Fitted top, soft flare" },
    { id: "ballgown", label: "Ballgown", line: "Full skirt, big entrance" },
    { id: "mermaid", label: "Mermaid", line: "Close fit, flared hem" },
    { id: "tealength", label: "Tea-length", line: "Full skirt, mid-calf hem" },
    { id: "boho", label: "Boho", line: "Loose, flowy, lace sleeves" },
  ];
  const PRICE_MAX = 40;
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const styleLabel = (id) => (STYLES.find((s) => s.id === id) || {}).label || "";
  // The price is kept exactly as typed (a note), trimmed, with control characters removed.
  const cleanPrice = (p) => String(p == null ? "" : p).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, PRICE_MAX);

  function newDress() {
    return { style: null, purchased: false, price: "" };
  }

  // Each change returns an error message, or null.
  function setStyle(d, style) {
    if (d.purchased) return "This dress is marked purchased. Undo that to pick another style.";
    if (!STYLES.some((s) => s.id === style)) return "Pick one of the styles.";
    d.style = style;
    return null;
  }
  function setPrice(d, price) {
    d.price = cleanPrice(price);
    return null;
  }

  // Marks the dress purchased and completes "Choose outfits" in the planner if its earlier quests are done.
  // If they aren't yet, the purchase is kept and the quest completes later (see catchUp).
  // Returns { error } or { xp, waitingFor } (waitingFor: names of the quests still needed first).
  function markPurchased(d, planner, game) {
    if (d.purchased) return { error: "Already marked purchased." };
    if (!d.style) return { error: "Pick a style first." };
    const quest = game.QUESTS.find((q) => q.id === QUEST_ID);
    if (!quest) return { error: "The Choose outfits quest is missing, so the dress can't be marked purchased." };
    d.purchased = true;
    return catchUp(d, planner, game);
  }
  // Completes the quest for a purchased dress once it is allowed. Returns { xp, waitingFor }.
  function catchUp(d, planner, game) {
    const quest = game.QUESTS.find((q) => q.id === QUEST_ID);
    if (!d.purchased || !quest || planner.done[QUEST_ID]) return { xp: 0, waitingFor: [] };
    const open = (quest.prereqs || []).filter((id) => !planner.done[id]);
    if (open.length) return { xp: 0, waitingFor: open.map((id) => (game.QUESTS.find((q) => q.id === id) || {}).name || id) };
    const before = planner.xp;
    game.completeTask(planner, QUEST_ID);
    return { xp: planner.xp - before, waitingFor: [] };
  }
  // Undoes the purchase: the quest is reopened and its XP taken back, unless a later quest that needs it is done.
  // Returns { error } or { xp } (XP taken back, as a negative number or 0).
  function unmarkPurchased(d, planner, game) {
    if (!d.purchased) return { error: "It isn't marked purchased." };
    const before = planner.xp;
    if (planner.done[QUEST_ID]) {
      if (!game.canUndo(planner, QUEST_ID)) return { error: "Choose outfits can't be reopened while a later quest that needs it is done." };
      game.undoTask(planner, QUEST_ID);
    }
    d.purchased = false;
    return { xp: planner.xp - before };
  }

  function label(d) {
    if (!d.style) return "Pick your dress";
    return styleLabel(d.style) + (d.purchased ? " · purchased" : "");
  }

  function cleanDress(s) {
    const d = newDress();
    if (!isObject(s)) return d;
    if (STYLES.some((x) => x.id === s.style)) d.style = s.style;
    d.purchased = s.purchased === true && !!d.style;
    d.price = cleanPrice(s.price);
    return d;
  }
  function loadDress(storage) {
    let s = null;
    try { s = JSON.parse(storage.getItem(DRESS_KEY)); } catch (e) { /* broken or blocked: start fresh */ }
    const dress = cleanDress(isObject(s) ? s.dress : null);
    const undo = isObject(s) && isObject(s.undo) && typeof s.undo.label === "string" ? { label: s.undo.label.slice(0, 120), dress: cleanDress(s.undo.dress), unpurchase: s.undo.unpurchase === true, repurchase: s.undo.repurchase === true } : null;
    return { dress, undo };
  }
  function saveDress(storage, dress, undo) {
    try { storage.setItem(DRESS_KEY, JSON.stringify({ version: 1, dress, undo: undo || null })); return true; } catch (e) { return false; }
  }

  return { DRESS_KEY, QUEST_ID, STYLES, PRICE_MAX, newDress, setStyle, setPrice, markPurchased, catchUp, unmarkPurchased, styleLabel, label, cleanDress, loadDress, saveDress };
});
