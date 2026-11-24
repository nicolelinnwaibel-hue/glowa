// Glowa dress picker screen, and "you" on the plot wearing the dress. Nothing is bought or sent.
(function () {
  const D = window.GlowaDress, UI = window.GlowaUI;
  const $ = (id) => document.getElementById(id);
  const panel = $("dress-panel"), body = $("dress-body"), chip = $("dress-label"), you = $("you");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const game = { QUESTS, completeTask, undoTask, canUndo };
  const store = UI.store;
  let { dress, undo } = D.loadDress(store);
  let note = "", focusNext = null, opener = null;
  const readPlanner = () => loadState(store);
  const writePlanner = (p) => { try { saveState(store, p); } catch (e) { note = "Your progress could not be saved on this device."; } };

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

  // You, on the plot: wears the chosen style. A small twirl and sparkle for the fitting (none with Reduce Motion).
  function paintYou(fitting) {
    you.className = "obj you" + (dress.style ? " dress-" + dress.style : "");
    you.setAttribute("aria-label", "You" + (dress.style ? ", in the " + D.styleLabel(dress.style) + " dress" : "") + ". Choose your dress");
    chip.textContent = D.label(dress);
    if (fitting && !reduceMotion) {
      you.classList.add("fitting");
      setTimeout(() => you.classList.remove("fitting"), 1300);
    }
  }
  // If the dress was purchased before "Choose a theme" was done, the quest completes as soon as it can.
  function catchUp() {
    const planner = readPlanner();
    const r = D.catchUp(dress, planner, game);
    if (r.xp > 0) { writePlanner(planner); UI.toast("Choose outfits done!", "+" + r.xp + " XP for the dress you bought."); }
  }
  function save() {
    if (!D.saveDress(store, dress, undo)) note = "Your dress could not be saved on this device.";
    paintYou(false);
  }

  function undoLast() {
    if (!undo) return;
    const u = undo;
    undo = null;
    const planner = readPlanner();
    let msg = u.label + ", undone.";
    if (u.unpurchase) { const r = D.unmarkPurchased(dress, planner, game); if (r.error) msg = r.error; else writePlanner(planner); }
    else if (u.repurchase) { const r = D.markPurchased(dress, planner, game); if (r.error) msg = r.error; else writePlanner(planner); }
    else if (!dress.purchased) dress = D.cleanDress(u.dress);
    else msg = "Undo the purchase first.";
    save(); draw(); paintYou(true);
    UI.toast("Undone", msg);
  }

  function pick(style, focusId) {
    if (dress.style === style) return;
    const before = JSON.parse(JSON.stringify(dress));
    const error = D.setStyle(dress, style);
    if (error) { note = error; focusNext = focusId; return draw(); }
    note = "";
    undo = { label: D.styleLabel(style) + " picked", dress: before };
    save(); focusNext = focusId; draw(); paintYou(true);
    UI.toast("The fitting", "You're trying on the " + D.styleLabel(style) + ".", { label: "Undo", run: undoLast });
  }

  function purchase() {
    const planner = readPlanner();
    const before = JSON.parse(JSON.stringify(dress));
    const r = D.markPurchased(dress, planner, game);
    if (r.error) { note = r.error; focusNext = "dress-buy"; return draw(); }
    writePlanner(planner);
    note = "";
    undo = { label: "Dress marked purchased", dress: before, unpurchase: true };
    save(); focusNext = "dress-unbuy"; draw();
    UI.toast("Marked purchased!", r.waitingFor.length ? "Saved. Choose outfits completes once " + r.waitingFor.join(" and ") + " is done." : r.xp > 0 ? "Choose outfits is done. +" + r.xp + " XP. Nothing was bought or sent." : "Choose outfits was already done.", { label: "Undo", run: undoLast });
  }
  function unpurchase() {
    const planner = readPlanner();
    const before = JSON.parse(JSON.stringify(dress));
    const r = D.unmarkPurchased(dress, planner, game);
    if (r.error) { note = r.error; focusNext = "dress-unbuy"; return draw(); }
    writePlanner(planner);
    note = "";
    undo = { label: "Purchase undone", dress: before, repurchase: true };
    save(); focusNext = "dress-buy"; draw();
    UI.toast("Not purchased", "Choose outfits is open again" + (r.xp < 0 ? " (" + r.xp + " XP)" : "") + ".", { label: "Undo", run: undoLast });
  }

  function draw() {
    const kids = [
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "venue-card" }, [h("b", { text: dress.style ? D.styleLabel(dress.style) : "No dress picked yet" }), h("span", { class: "sub", text: dress.purchased ? "Marked purchased" + (dress.price ? " · " + dress.price : "") + "." : "Not purchased yet." })]),
      h("div", { class: "stack", role: "group", "aria-label": "Dress style" }, [
        h("span", { class: "lbl", text: "Style" }),
        h("div", { class: "type-cards dress-cards" }, D.STYLES.map((s) => h("button", { type: "button", id: "dress-" + s.id, class: "type-card type-" + s.id + (dress.style === s.id ? " on" : ""), "aria-pressed": String(dress.style === s.id), disabled: dress.purchased,
          "aria-label": s.label + ". " + s.line, onclick: () => pick(s.id, "dress-" + s.id) }, [
          h("span", { class: "type-icon mini-you dress-" + s.id, "aria-hidden": "true" }, [h("span", { class: "md" }), h("span", { class: "mh" })]),
          h("b", { text: s.label }), h("span", { class: "type-line", text: s.line }),
        ]))),
      ]),
      h("div", { class: "stack" }, [
        h("label", { class: "lbl", for: "dress-price", text: "Price (a note for you)" }),
        h("input", { id: "dress-price", type: "text", maxlength: D.PRICE_MAX, placeholder: "e.g. £1,800", value: dress.price, autocomplete: "off",
          onchange: (e) => { D.setPrice(dress, e.target.value); save(); focusNext = "dress-price"; draw(); } }),
        h("span", { class: "sub", text: "Kept as a note. It isn't added to a total." }),
      ]),
      dress.purchased
        ? h("button", { type: "button", id: "dress-unbuy", class: "btn wide", text: "Undo purchased", onclick: unpurchase })
        : h("button", { type: "button", id: "dress-buy", class: "go", text: "Mark purchased", onclick: purchase }),
      h("span", { class: "sub", text: "Marking purchased completes the Choose outfits quest. Glowa doesn't buy anything or send anything." }),
      undo && h("div", { class: "last-change", role: "status" }, [h("span", { text: "Last change: " + undo.label + "." }), h("button", { type: "button", id: "dress-undo", class: "btn", text: "Undo", onclick: undoLast })]),
    ];
    body.textContent = "";
    for (const k of kids) if (k) body.append(k);
    const t = focusNext && $(focusNext);
    if (t && !panel.hidden) t.focus({ preventScroll: true });
    focusNext = null;
  }

  function open() {
    if (UI.isOpen()) UI.close();
    const vp = $("venue-panel"); if (vp) vp.hidden = true;
    UI.hideToast();
    opener = document.activeElement;
    note = "";
    panel.hidden = false;
    UI.setSide(true);
    catchUp();
    draw();
    $("dress-title").focus({ preventScroll: true });
  }
  function close() {
    UI.setSide(false); panel.hidden = true; if (opener && opener.focus) opener.focus({ preventScroll: true }); }
  $("dress-chip").addEventListener("click", open);
  you.addEventListener("click", open);
  $("dress-close").addEventListener("click", close);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  for (const id of ["count-chip", "venue-chip"]) $(id).addEventListener("click", () => { panel.hidden = true; }, true);

  window.__glowaDress = () => ({ dress: JSON.parse(JSON.stringify(dress)), undo: undo && undo.label, you: you.className, planner: (() => { const p = readPlanner(); return { xp: p.xp, done: !!p.done[D.QUEST_ID] }; })() });
  catchUp();
  paintYou(false);
})();
