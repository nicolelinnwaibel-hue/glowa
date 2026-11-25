// Glowa venue screen: pick a venue type (the plot changes to match), note a date or a season, and finalise.
// Finalising completes the planner's "Book venue" quest once. Nothing is contacted, priced, booked or sent.
(function () {
  const V = window.GlowaVenue, UI = window.GlowaUI;
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"), panel = $("venue-panel"), body = $("venue-body"), chip = $("venue-label"), scenery = $("scenery");
  const game = { QUESTS, completeTask, undoTask, canUndo };
  const store = UI.store;
  let { venue, undo } = V.loadVenue(store);
  let whenMode = venue.when && venue.when.kind === "season" ? "season" : "date";
  let note = "";
  let focusNext = null;
  let opener = null;

  // The planner's own save holds the quest and the XP; it is read fresh for every change.
  const readPlanner = () => loadState(store);
  const writePlanner = (p) => { try { saveState(store, p); } catch (e) { note = "Your progress could not be saved on this device."; } };
  if (V.syncWithQuest(venue, readPlanner())) V.saveVenue(store, venue, undo);

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

  // Scenery for each venue type, drawn on the plot. Fixed drawings only.
  const SCENES = {
    castle: '<svg class="scene-castle" width="230" height="170" viewBox="0 0 230 170"><path d="M20 160 V70 H44 V56 H58 V70 H74 V56 H88 V70 H100 V40 H96 V22 H134 V40 H130 V70 H142 V56 H156 V70 H172 V56 H186 V70 H210 V160 Z" fill="#CFC7D8" stroke="#2B2140" stroke-width="4" stroke-linejoin="round"></path><path d="M96 22 L115 2 L134 22 Z" fill="#7A52BC" stroke="#2B2140" stroke-width="3.5" stroke-linejoin="round"></path><path d="M100 160 V128 Q115 108 130 128 V160 Z" fill="#8A5A3C" stroke="#2B2140" stroke-width="3.5"></path><rect x="46" y="92" width="14" height="20" rx="7" fill="#2B2140"></rect><rect x="170" y="92" width="14" height="20" rx="7" fill="#2B2140"></rect><rect x="108" y="50" width="14" height="22" rx="7" fill="#F6BE4A" stroke="#2B2140" stroke-width="2.5"></rect><path d="M115 2 V-14" stroke="#2B2140" stroke-width="3"></path><path d="M115 -14 L134 -8 L115 -2 Z" fill="#E4577A" stroke="#2B2140" stroke-width="2"></path></svg>',
    beach: '<svg class="scene-beach" width="230" height="150" viewBox="0 0 230 150"><path d="M10 140 Q60 120 115 136 T220 132" fill="none" stroke="#7FC8E8" stroke-width="10" stroke-linecap="round"></path><rect x="64" y="40" width="7" height="92" rx="3" fill="#8A5A3C" stroke="#2B2140" stroke-width="2.5" transform="rotate(-8 67 86)"></rect><path d="M30 46 Q66 10 104 46 Q66 30 30 46 Z" fill="#3E9B73" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><path d="M44 30 Q70 0 96 28 Q70 18 44 30 Z" fill="#4E9E63" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><path d="M140 90 L196 90 L168 62 Z" fill="#E4577A" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><rect x="166" y="90" width="4" height="40" fill="#2B2140"></rect></svg>',
    winery: '<svg class="scene-winery" width="230" height="150" viewBox="0 0 230 150"><g stroke="#2B2140" stroke-width="2.5"><rect x="14" y="70" width="200" height="8" rx="4" fill="#6BAF73"></rect><rect x="14" y="96" width="200" height="8" rx="4" fill="#6BAF73"></rect><rect x="14" y="122" width="200" height="8" rx="4" fill="#6BAF73"></rect></g><g fill="#7A52BC" stroke="#2B2140" stroke-width="1.5"><circle cx="40" cy="80" r="5"></circle><circle cx="90" cy="80" r="5"></circle><circle cx="150" cy="106" r="5"></circle><circle cx="70" cy="132" r="5"></circle><circle cx="190" cy="132" r="5"></circle></g><path d="M86 62 V30 H144 V62 Z" fill="#F0DDB0" stroke="#2B2140" stroke-width="3"></path><path d="M80 32 L115 8 L150 32 Z" fill="#B5345A" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"></path><ellipse cx="190" cy="50" rx="16" ry="12" fill="#C9925E" stroke="#2B2140" stroke-width="3"></ellipse></svg>',
    forest: '<svg class="scene-forest" width="230" height="150" viewBox="0 0 230 150"><g stroke="#2B2140" stroke-width="3" stroke-linejoin="round"><path d="M40 10 L66 70 H14 Z" fill="#2F7A55"></path><path d="M100 0 L132 76 H68 Z" fill="#3F8A63"></path><path d="M168 14 L194 74 H142 Z" fill="#2F7A55"></path><path d="M208 30 L226 76 H190 Z" fill="#3F8A63"></path></g><g fill="#8A5A3C" stroke="#2B2140" stroke-width="2.5"><rect x="36" y="70" width="8" height="16"></rect><rect x="96" y="76" width="8" height="18"></rect><rect x="164" y="74" width="8" height="16"></rect></g><circle cx="140" cy="126" r="9" fill="#E4577A" stroke="#2B2140" stroke-width="2.5"></circle><rect x="137" y="126" width="6" height="12" fill="#FFFBF2" stroke="#2B2140" stroke-width="2"></rect></svg>',
    desert: '<svg class="scene-desert" width="230" height="150" viewBox="0 0 230 150"><circle cx="190" cy="34" r="20" fill="#F6BE4A" stroke="#2B2140" stroke-width="3"></circle><g fill="#3E9B73" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"><path d="M56 140 V60 Q56 48 66 48 Q76 48 76 60 V140 Z"></path><path d="M56 96 H40 V76 Q40 70 46 70 Q52 70 52 76 V86 H56"></path><path d="M76 84 H92 V66 Q92 60 98 60 Q104 60 104 66 V94 H76"></path><path d="M150 140 V100 Q150 92 158 92 Q166 92 166 100 V140 Z"></path></g><path d="M0 140 Q60 116 120 138 T230 134" fill="none" stroke="#E2C98F" stroke-width="8" stroke-linecap="round"></path></svg>',
  };

  // Small card icons for each venue type. Fixed drawings only.
  const ICONS = {
    beach: '<svg width="44" height="40" viewBox="0 0 44 40"><path d="M2 34 Q12 28 22 34 T42 34" fill="none" stroke="#3F8FB5" stroke-width="3.5" stroke-linecap="round"></path><rect x="12" y="10" width="3.5" height="22" rx="1.5" fill="#8A5A3C" stroke="#2B2140" stroke-width="1.5" transform="rotate(-8 14 21)"></rect><path d="M3 12 Q14 0 26 12 Q14 7 3 12 Z" fill="#3E9B73" stroke="#2B2140" stroke-width="2" stroke-linejoin="round"></path><circle cx="35" cy="9" r="5" fill="#F6BE4A" stroke="#2B2140" stroke-width="2"></circle></svg>',
    winery: '<svg width="44" height="40" viewBox="0 0 44 40"><path d="M14 4 H30 Q30 20 22 22 Q14 20 14 4 Z" fill="#B5345A" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"></path><path d="M22 22 V33 M15 35 H29" stroke="#2B2140" stroke-width="2.5" stroke-linecap="round"></path><g fill="#7A52BC" stroke="#2B2140" stroke-width="1.5"><circle cx="36" cy="22" r="3.5"></circle><circle cx="40" cy="28" r="3.5"></circle><circle cx="33" cy="29" r="3.5"></circle></g></svg>',
    castle: '<svg width="44" height="40" viewBox="0 0 44 40"><path d="M4 38 V14 H10 V18 H14 V14 H18 V8 H26 V14 H30 V18 H34 V14 H40 V38 Z" fill="#CFC7D8" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"></path><path d="M18 8 L22 2 L26 8 Z" fill="#7A52BC" stroke="#2B2140" stroke-width="2" stroke-linejoin="round"></path><path d="M18 38 V30 Q22 25 26 30 V38 Z" fill="#8A5A3C" stroke="#2B2140" stroke-width="2"></path></svg>',
    forest: '<svg width="44" height="40" viewBox="0 0 44 40"><g stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"><path d="M14 4 L24 26 H4 Z" fill="#2F7A55"></path><path d="M30 8 L40 30 H20 Z" fill="#3F8A63"></path></g><g fill="#8A5A3C" stroke="#2B2140" stroke-width="2"><rect x="12" y="26" width="4" height="8"></rect><rect x="28" y="30" width="4" height="7"></rect></g></svg>',
    desert: '<svg width="44" height="40" viewBox="0 0 44 40"><circle cx="34" cy="9" r="6" fill="#F6BE4A" stroke="#2B2140" stroke-width="2"></circle><path d="M16 38 V14 Q16 10 20 10 Q24 10 24 14 V38 Z M16 26 H10 V18 Q10 15 12.5 15 Q15 15 15 18 V22 H16 M24 22 H30 V16 Q30 13 32.5 13 Q35 13 35 16 V26 H24" fill="#3E9B73" stroke="#2B2140" stroke-width="2.2" stroke-linejoin="round"></path><path d="M2 38 H42" stroke="#E2C98F" stroke-width="3" stroke-linecap="round"></path></svg>',
  };

  function paintScene() {
    stage.dataset.venue = venue.type || "";
    scenery.innerHTML = venue.type ? SCENES[venue.type] : "";
    chip.textContent = venue.type ? V.venueLabel(venue) + (venue.finalised ? " · finalised" : "") : "Pick your venue";
  }

  function save() {
    if (!V.saveVenue(store, venue, undo)) note = "Your venue could not be saved on this device.";
    paintScene();
  }

  // Every change can be undone: the venue as it was, and whether the quest needs reopening or completing again.
  function change(label, fn, questUndo) {
    const before = JSON.parse(JSON.stringify(venue));
    const error = fn();
    if (error) { note = error; draw(); return false; }
    note = "";
    undo = { label, venue: before, reopenQuest: questUndo === "reopen", redoQuest: questUndo === "redo" };
    save();
    draw();
    return true;
  }

  function undoLast() {
    if (!undo) return;
    const u = undo;
    undo = null;
    const planner = readPlanner();
    let msg = u.label + ", undone.";
    if (u.reopenQuest) {
      const r = V.reopen(venue, planner, game);
      if (r.error) msg = r.error; else writePlanner(planner);
    } else if (u.redoQuest) {
      const r = V.finalise(venue, planner, game);
      if (r.error) msg = r.error; else writePlanner(planner);
    } else if (!venue.finalised) {
      venue = V.cleanVenue(u.venue);
    } else msg = "Reopen the venue first.";
    save();
    draw();
    UI.toast("Undone", msg);
  }

  function pickType(type, focusId) {
    if (venue.type === type) return;
    focusNext = focusId;
    if (change(V.typeLabel(type) + " picked", () => V.setType(venue, type))) {
      UI.toast(V.typeLabel(type) + " it is", "Your plot is now " + (type === "castle" ? "the castle grounds." : "set for a " + V.typeLabel(type).toLowerCase() + " wedding."), { label: "Undo", run: undoLast });
    }
  }

  function doFinalise() {
    const planner = readPlanner();
    const before = JSON.parse(JSON.stringify(venue));
    const r = V.finalise(venue, planner, game);
    if (r.error) { note = r.error; focusNext = "venue-finalise"; return draw(); }
    writePlanner(planner);
    note = "";
    undo = { label: "Venue finalised", venue: before, reopenQuest: true, redoQuest: false };
    save();
    focusNext = "venue-reopen";
    draw();
    UI.toast("Venue finalised!", "Book venue is done" + (r.xp > 0 ? ". +" + r.xp + " XP" : ", no new XP (it was already done)") + ". Nothing was booked or sent.", { label: "Undo", run: undoLast });
  }

  function doReopen() {
    const planner = readPlanner();
    const before = JSON.parse(JSON.stringify(venue));
    const r = V.reopen(venue, planner, game);
    if (r.error) { note = r.error; focusNext = "venue-reopen"; return draw(); }
    writePlanner(planner);
    note = "";
    undo = { label: "Venue reopened", venue: before, reopenQuest: false, redoQuest: true };
    save();
    focusNext = "venue-finalise";
    draw();
    UI.toast("Venue reopened", "Book venue is open again" + (r.xp < 0 ? " (" + r.xp + " XP)" : "") + ". You can change it now.", { label: "Undo", run: undoLast });
  }

  function draw() {
    const lockedNow = venue.finalised;
    const years = [];
    for (let y = V.YEAR_MIN; y <= V.YEAR_MAX; y++) years.push(y);
    const season = venue.when && venue.when.kind === "season" ? venue.when : { season: "", year: 2027 };
    const date = venue.when && venue.when.kind === "date" ? venue.when.date : "";
    const kids = [
      note && h("div", { class: "note", role: "alert", text: note }),
      h("div", { class: "venue-card" }, [h("b", { text: V.venueLabel(venue) }), h("span", { class: "sub", text: lockedNow ? "Finalised. This is your own decision: nothing was booked or sent." : "Not finalised yet." })]),
      h("div", { class: "stack", role: "group", "aria-label": "Venue type" }, [
        h("span", { class: "lbl", text: "Venue type" }),
        h("div", { class: "type-cards" }, V.TYPES.map((t) => {
          const card = h("button", { type: "button", id: "venue-type-" + t.id, class: "type-card type-" + t.id + (venue.type === t.id ? " on" : ""), "aria-pressed": String(venue.type === t.id), disabled: lockedNow,
            "aria-label": t.label + ". " + t.line, onclick: () => pickType(t.id, "venue-type-" + t.id) }, [
            h("span", { class: "type-icon", "aria-hidden": "true" }),
            h("b", { text: t.label }),
            h("span", { class: "type-line", text: t.line }),
          ]);
          card.firstChild.innerHTML = ICONS[t.id]; // fixed drawings written in this file only
          return card;
        })),
      ]),
      h("div", { class: "stack", role: "group", "aria-label": "When" }, [
        h("span", { class: "lbl", text: "When" }),
        h("div", { class: "chip-row" }, [
          h("button", { type: "button", id: "when-date", class: "chip" + (whenMode === "date" ? " on" : ""), "aria-pressed": String(whenMode === "date"), disabled: lockedNow, text: "Exact date", onclick: () => { whenMode = "date"; focusNext = "when-date"; draw(); } }),
          h("button", { type: "button", id: "when-season", class: "chip" + (whenMode === "season" ? " on" : ""), "aria-pressed": String(whenMode === "season"), disabled: lockedNow, text: "Season", onclick: () => { whenMode = "season"; focusNext = "when-season"; draw(); } }),
        ]),
        whenMode === "date"
          ? h("div", { class: "stack" }, [
            h("label", { class: "lbl", for: "venue-date", text: "Date" }),
            h("input", { id: "venue-date", type: "date", min: V.YEAR_MIN + "-01-01", max: V.YEAR_MAX + "-12-31", value: date, disabled: lockedNow,
              // While someone is typing, the browser reports half-typed dates (year 0002, 0020...). Redrawing then
              // would wipe the field mid-typing, so only a full, valid date is saved; a bad one is explained on leaving the field.
              onchange: (e) => { const d = e.target.value; if (!d || !V.isDate(d)) return; focusNext = "venue-date"; change("Date set to " + d, () => V.setDate(venue, d)); },
              onblur: (e) => { const d = e.target.value; if (d && !V.isDate(d)) { focusNext = null; change("Date set to " + d, () => V.setDate(venue, d)); } } }),
          ])
          : h("div", { class: "inline" }, [
            h("label", { class: "sr", for: "venue-season", text: "Season" }),
            (() => { const s = h("select", { id: "venue-season", disabled: lockedNow, onchange: (e) => { focusNext = "venue-season"; change("Season set", () => V.setSeason(venue, e.target.value, Number($("venue-year").value))); } });
              s.append(h("option", { value: "", text: "Season" })); V.SEASONS.forEach((x) => s.append(h("option", { value: x, text: x }))); s.value = season.season; return s; })(),
            h("label", { class: "sr", for: "venue-year", text: "Year" }),
            (() => { const s = h("select", { id: "venue-year", disabled: lockedNow, onchange: (e) => { if (!$("venue-season").value) return; focusNext = "venue-year"; change("Season set", () => V.setSeason(venue, $("venue-season").value, Number(e.target.value))); } });
              years.forEach((y) => s.append(h("option", { value: String(y), text: String(y) }))); s.value = String(season.year); return s; })(),
          ]),
      ]),
      lockedNow
        ? h("button", { type: "button", id: "venue-reopen", class: "btn wide", text: "Reopen to make a change", onclick: doReopen })
        : h("button", { type: "button", id: "venue-finalise", class: "go", text: "Finalise venue", onclick: doFinalise }),
      h("span", { class: "sub", text: "Finalising completes the Book venue quest. It is your own decision: Glowa doesn't contact venues, price anything or book anything." }),
      undo && h("div", { class: "last-change", role: "status" }, [h("span", { text: "Last change: " + undo.label + "." }), h("button", { type: "button", id: "venue-undo", class: "btn", text: "Undo", onclick: undoLast })]),
    ];
    body.textContent = "";
    for (const k of kids) if (k) body.append(k);
    const t = focusNext && $(focusNext);
    if (t && !panel.hidden) t.focus({ preventScroll: true });
    focusNext = null;
  }

  function open() {
    if (UI.isOpen()) UI.close();
    UI.hideToast();
    opener = document.activeElement;
    note = "";
    panel.hidden = false;
    UI.setSide(true);
    draw();
    $("venue-title").focus({ preventScroll: true });
  }
  function close() {
    UI.setSide(false);
    panel.hidden = true;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  $("venue-chip").addEventListener("click", open);
  $("venue-close").addEventListener("click", close);
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
  // The Guestbook and the venue panel share the same place on screen: opening one closes the other.
  $("count-chip").addEventListener("click", () => { if (!panel.hidden) panel.hidden = true; }, true);

  window.__glowaVenue = () => ({ venue: JSON.parse(JSON.stringify(venue)), undo: undo && undo.label, planner: (() => { const p = readPlanner(); return { xp: p.xp, done: !!p.done[V.QUEST_ID] }; })() });
  paintScene();
})();
