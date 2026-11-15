// Glowa milestone G: polish and quality pass on milestone F (progress screen, planning, world, milestones, next task),
// on top of the wedding profile, custom tasks, chapters of quests, XP, levels, undo and redo, saved in the browser.
const STORAGE_KEY = "glowa-state-v1";

// Save format version. A save without one (or with missing fields) loads with defaults.
const SAVE_VERSION = 2;

// XP by size of task.
const QUICK = 50;
const STANDARD = 100;
const MAJOR = 200;

// Every 200 XP is one level.
const XP_PER_LEVEL = 200;

const THEMES = ["Garden", "Classic", "Beach", "Rustic", "City"];

// Wedding setup: the setting is the ground of the plot, the venue is a label, and each guest is a drawn avatar.
const SETTINGS = ["beach", "castle", "home"];
const VENUES = ["small-castle", "medium-castle", "large-castle", "home", "outdoor-seating", "restaurant"];
const VENUE_LABELS = {
  "small-castle": "Small castle", "medium-castle": "Medium castle", "large-castle": "Large castle",
  "home": "Home", "outdoor-seating": "Outdoor seating", "restaurant": "Restaurant",
};
const DEFAULT_GUESTS = 120;
const MAX_GUESTS = 300;
const GUEST_NAME_MAX = 40;
const HAIR_COLOURS = ["#3b2a20", "#8a5a2b", "#d9a441", "#b5523b", "#c9c9c9"];
const CLOTHES_COLOURS = ["#5b7fa6", "#c5606b", "#7f9d6a", "#8a6fb0", "#e0a84f", "#3f4b5c"];
const SKIN = "#f2c9a8";

// Save-the-dates: a card style, a short message, and which guests have been sent one.
const CARD_STYLES = ["classic", "floral", "tartan"];
const CARD_LABELS = { classic: "Classic cream", floral: "Pressed flowers", tartan: "Highland tartan" };
const CARD_MESSAGE_MAX = 120;
const DEFAULT_CARD_MESSAGE = "Save the date! Invitation to follow.";

// Engagement shoot: spots depend on the setting; each photo is a spot and a pose. Up to MAX_PHOTOS in the album.
const SHOOT_SPOTS = {
  castle: [{ id: "castle-gate", label: "Castle gate" }, { id: "great-lawn", label: "Great lawn" }, { id: "tower-steps", label: "Tower steps" }],
  beach: [{ id: "shore", label: "Shoreline" }, { id: "dunes", label: "Dunes" }, { id: "pier", label: "Old pier" }],
  home: [{ id: "garden", label: "Garden" }, { id: "front-door", label: "Front door" }, { id: "kitchen", label: "Kitchen table" }],
};
const SHOOT_POSES = [{ id: "hands", label: "Holding hands" }, { id: "dip", label: "The dip" }, { id: "walk", label: "Walking together" }];
const MAX_PHOTOS = 6;

// A quest needs: id, name, category, xp, description. Optional: due (YYYY-MM-DD), prereqs (quest ids).
const CHAPTERS = [
  { id: "ch1", title: "The big decisions", quests: [
    { id: "book-venue", name: "Book venue", category: "Venue", xp: STANDARD,
      description: "Pick a place for the ceremony and reception, then sign the contract." },
    { id: "set-date", name: "Pick the date", category: "Planning", xp: QUICK,
      description: "Agree a day with both families and check it against the venue." },
    { id: "pick-theme", name: "Choose a theme", category: "Style", xp: QUICK,
      description: "Pick one look to guide flowers, decor and colours." },
    { id: "set-budget", name: "Set the budget", category: "Planning", xp: QUICK,
      description: "Agree a total and how much goes to food, venue and clothes." },
    { id: "book-caterer", name: "Book caterer", category: "Food", xp: STANDARD, prereqs: ["book-venue"],
      description: "Taste two or three menus, then sign with one." },
    { id: "draft-guest-list", name: "Draft guest list", category: "Guests", xp: STANDARD,
      description: "Write every name you would like to invite, then trim it together." },
  ] },
  { id: "ch2", title: "Invitations", quests: [
    { id: "save-the-dates", name: "Send save-the-dates", category: "Invitations", xp: QUICK,
      prereqs: ["draft-guest-list", "set-date"], due: "2027-02-01",
      description: "Send a short card or email once the date is fixed." },
    { id: "order-invitations", name: "Order invitations", category: "Invitations", xp: QUICK,
      prereqs: ["draft-guest-list"],
      description: "Choose a design and order a proof before the full run." },
    { id: "send-invitations", name: "Send invitations", category: "Invitations", xp: STANDARD,
      prereqs: ["order-invitations"], due: "2027-04-01",
      description: "Post invitations with reply cards and a clear RSVP date." },
    { id: "track-rsvps", name: "Track RSVPs", category: "Guests", xp: STANDARD,
      prereqs: ["send-invitations"], due: "2027-05-15",
      description: "Log every reply and chase anyone who has not answered." },
  ] },
  { id: "ch3", title: "Look and feel", quests: [
    { id: "book-photographer", name: "Book photographer", category: "Photo", xp: STANDARD,
      prereqs: ["set-date"], description: "Look at portfolios, meet one, and sign for the day." },
    { id: "engagement-shoot", name: "Do the engagement shoot", category: "Photo", xp: STANDARD,
      prereqs: ["book-photographer"], description: "Pick a spot and a pose, take a few photos, and star your favourite." },
    { id: "pick-outfits", name: "Choose outfits", category: "Attire", xp: STANDARD,
      prereqs: ["pick-theme"], description: "Shop for clothes for both of you and book the first fitting." },
    { id: "order-cake", name: "Order cake", category: "Food", xp: QUICK,
      prereqs: ["book-caterer"], description: "Taste flavours and confirm the cake size for your guest count." },
    { id: "book-florist", name: "Book florist", category: "Flowers", xp: STANDARD,
      prereqs: ["pick-theme", "set-budget"], description: "Agree flowers for the arch, tables and bouquets." },
    { id: "book-music", name: "Book music", category: "Music", xp: STANDARD,
      prereqs: ["book-venue"], description: "Choose a band or DJ and check the venue's noise limit." },
    { id: "plan-seating", name: "Plan seating chart", category: "Guests", xp: STANDARD,
      prereqs: ["track-rsvps"], due: "2027-08-01",
      description: "Group guests by table and check no one is left on their own." },
  ] },
  { id: "ch4", title: "The big day", quests: [
    { id: "final-headcount", name: "Confirm final headcount", category: "Food", xp: QUICK,
      prereqs: ["track-rsvps"], due: "2027-08-15",
      description: "Send the final number to the caterer and the venue." },
    { id: "marriage-license", name: "Get marriage license", category: "Paperwork", xp: STANDARD,
      due: "2027-07-01", description: "Check the local rules and file the forms before the wedding." },
    { id: "write-vows", name: "Write vows", category: "Ceremony", xp: QUICK,
      description: "Write a few lines each and read them out loud once." },
    { id: "rehearsal", name: "Plan rehearsal", category: "Ceremony", xp: QUICK,
      prereqs: ["book-venue"], description: "Set a time for the walk-through with the officiant and wedding party." },
    { id: "day-timeline", name: "Make day timeline", category: "Planning", xp: MAJOR,
      prereqs: ["book-caterer", "book-music", "final-headcount"],
      description: "Plan the day hour by hour and share it with every supplier." },
    { id: "wedding-day", name: "Get married", category: "Ceremony", xp: MAJOR,
      prereqs: ["day-timeline", "marriage-license", "rehearsal", "write-vows"],
      description: "Walk down the aisle and celebrate." },
  ] },
];

const QUESTS = CHAPTERS.flatMap((c) => c.quests);

// Scene unlocks: each shows in the scene while its quest is completed, and goes away when that quest is undone.
const UNLOCKS = [
  { id: "arch", quest: "book-venue", label: "ceremony arch" },
  { id: "lights", quest: "book-music", label: "string lights" },
  { id: "flowers", quest: "book-florist", label: "flower beds" },
  { id: "tables", quest: "book-caterer", label: "tables and chairs" },
];

// Built-in quests plus the user's custom tasks.
function allQuests(state) {
  return QUESTS.concat(state.custom || []);
}

function findQuest(state, id) {
  return allQuests(state).find((q) => q.id === id);
}

function newState() {
  return { version: SAVE_VERSION, xp: 0, done: {}, arch: false, profile: null, custom: [], wedding: newWedding() };
}

// A quest is blocked while any prerequisite is not complete.
function openPrereqs(state, quest) {
  return (quest.prereqs || []).filter((id) => !state.done[id]);
}

// completed, blocked (a prerequisite is open), or available (unlocked). Due dates never change the status.
function questStatus(state, quest) {
  if (state.done[quest.id]) return "completed";
  if (openPrereqs(state, quest).length > 0) return "blocked";
  return "available";
}

// The scene unlocks that are showing now, derived from completed quests (so none is ever doubled).
function unlocksFor(state) {
  return UNLOCKS.filter((u) => state.done[u.quest]).map((u) => u.id);
}

// Planning progress: how many quests are completed, and the percent of all quests. Separate from XP and the scene.
function completedCount(state) {
  return allQuests(state).filter((q) => state.done[q.id]).length;
}
function progressPercent(state) {
  return Math.round((100 * completedCount(state)) / allQuests(state).length);
}

// Planning progress: quests done, left, and the percent of all quests (custom tasks included).
function planningProgress(state) {
  const total = allQuests(state).length;
  const done = completedCount(state);
  return { done, remaining: total - done, total, percent: progressPercent(state) };
}

// World progress: how many scene unlocks are showing. Kept apart from planning progress.
function worldProgress(state) {
  const shown = UNLOCKS.filter((u) => unlocksFor(state).includes(u.id));
  return { unlocked: shown.length, total: UNLOCKS.length, labels: shown.map((u) => u.label) };
}

// A milestone is a chapter whose quests are all completed.
function milestonesReached(state) {
  return CHAPTERS.filter((c) => c.quests.every((q) => state.done[q.id])).map((c) => c.title);
}

// Suggested route: chapter order, with each quest's prerequisites placed before it. Due dates are never read here.
function suggestedRoute(state) {
  const all = allQuests(state);
  const byId = new Map(all.map((q) => [q.id, q]));
  const placed = new Set();
  const route = [];
  function place(quest) {
    if (placed.has(quest.id)) return;
    placed.add(quest.id);
    for (const id of quest.prereqs || []) if (byId.has(id)) place(byId.get(id));
    route.push(quest);
  }
  all.forEach(place);
  return route;
}

// The number a quest has on the suggested route (1 is first). A suggestion only: any unlocked quest can be picked.
function suggestedNumber(state, quest) {
  return suggestedRoute(state).findIndex((q) => q.id === quest.id) + 1;
}

// The next task: the lowest-numbered quest on the suggested route that is unlocked and not done.
function nextTask(state) {
  return suggestedRoute(state).find((q) => questStatus(state, q) === "available") || null;
}

// Level from total XP: 0-199 is level 1, 200-399 is level 2, and so on.
function levelFor(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

// Marks a quest complete once. Returns true only when XP was actually awarded.
// A blocked quest cannot be completed yet.
function completeTask(state, id) {
  const quest = findQuest(state, id);
  if (!quest || state.done[id] || openPrereqs(state, quest).length > 0) return false;
  state.done[id] = true;
  state.xp += quest.xp;
  if (id === "book-venue") state.arch = true;
  return true;
}

// A completed quest can be undone unless a completed quest still needs it.
function canUndo(state, id) {
  return !!state.done[id] && !allQuests(state).some((q) => state.done[q.id] && (q.prereqs || []).includes(id));
}

// Takes back a completed quest's XP and its arch. Returns true only when it was undone.
function undoTask(state, id) {
  if (!canUndo(state, id)) return false;
  state.xp -= findQuest(state, id).xp;
  delete state.done[id];
  if (id === "book-venue") state.arch = false;
  return true;
}

// Custom tasks: a name, a category, an XP reward (one of the three sizes), an optional due date and an optional prerequisite.
const CUSTOM_SIZES = [QUICK, STANDARD, MAJOR];

// True when quest `from` needs quest `target`, directly or through other quests.
function needs(state, from, target, seen = new Set()) {
  const quest = findQuest(state, from);
  if (!quest || seen.has(from)) return false;
  seen.add(from);
  return (quest.prereqs || []).some((p) => p === target || needs(state, p, target, seen));
}

// Returns an error message, or null when the task can be saved. ownId is the task being edited, if any.
function customError(state, c, ownId) {
  if (!c.name.trim()) return "Give the task a name.";
  if (!c.category.trim()) return "Add a category.";
  if (!CUSTOM_SIZES.includes(c.xp)) return "Pick quick, standard or major.";
  if (c.due && !/^\d{4}-\d{2}-\d{2}$/.test(c.due)) return "Use a date like 2027-06-01.";
  if (c.prereq && c.prereq === ownId) return "A task cannot need itself.";
  if (c.prereq && !findQuest(state, c.prereq)) return "Pick a prerequisite from the list.";
  if (c.prereq && ownId && needs(state, c.prereq, ownId)) return "That task needs this one already.";
  return null;
}

// Adds a custom task, or replaces the one with ownId. Returns an error message, or null when saved.
function saveCustom(state, c, ownId) {
  const error = customError(state, c, ownId);
  if (error) return error;
  const fields = { name: c.name.trim(), category: c.category.trim(), xp: c.xp };
  if (c.due) fields.due = c.due;
  if (c.prereq) fields.prereqs = [c.prereq];
  if (!ownId) {
    state.custom.push({ id: "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...fields });
    return null;
  }
  // Editing a completed task moves its XP to the new size.
  if (state.done[ownId]) state.xp += c.xp - findQuest(state, ownId).xp;
  state.custom = state.custom.map((q) => (q.id === ownId ? { id: ownId, ...fields } : q));
  return null;
}

// Deletes a custom task. A completed one takes its XP with it, and a task that needed it no longer does.
function deleteCustom(state, id) {
  if (!state.custom.some((q) => q.id === id)) return false;
  if (state.done[id]) state.xp -= findQuest(state, id).xp;
  delete state.done[id];
  state.custom = state.custom.filter((q) => q.id !== id).map((q) => {
    if (!(q.prereqs || []).includes(id)) return q;
    const { prereqs, ...rest } = q;
    return rest;
  });
  return true;
}

// Today's date as YYYY-MM-DD in local time, to compare with quest due dates.
function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Returns an error message, or null when the profile can be saved.
function profileError(p) {
  if (!p.partnerA.trim() || !p.partnerB.trim()) return "Please enter both names.";
  if (!p.date.trim()) return "Add an approximate date.";
  if (!THEMES.includes(p.theme)) return "Pick a theme from the list.";
  if (!Number.isInteger(p.guests) || p.guests < 0) return "Guest count must be a whole number.";
  return null;
}

// Saves the profile (new or edited). Returns an error message, or null when saved.
function saveProfile(state, p) {
  const error = profileError(p) || setGuestCount(state, p.guests);
  if (error) return error;
  state.profile = { ...p, partnerA: p.partnerA.trim(), partnerB: p.partnerB.trim(), date: p.date.trim() };
  return null;
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Keeps a custom task only if its name, category and reward are usable; a bad date or prerequisite is dropped.
function cleanCustom(q) {
  if (!isObject(q) || typeof q.id !== "string" || typeof q.name !== "string" || typeof q.category !== "string" || !CUSTOM_SIZES.includes(q.xp)) return null;
  const task = { id: q.id, name: q.name, category: q.category, xp: q.xp };
  if (typeof q.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.due)) task.due = q.due;
  if (Array.isArray(q.prereqs) && typeof q.prereqs[0] === "string") task.prereqs = [q.prereqs[0]];
  return task;
}

const validProfile = (p) => isObject(p) && ["partnerA", "partnerB", "date"].every((k) => typeof p[k] === "string") && profileError(p) === null;

// Reads the saved state. A missing or damaged field falls back to its default, so an old or broken save still loads.
function loadState(storage) {
  let saved = null;
  try { saved = JSON.parse(storage.getItem(STORAGE_KEY)); } catch (e) { /* broken JSON: start fresh */ }
  if (!isObject(saved)) return newState();
  const done = {};
  if (isObject(saved.done)) for (const id of Object.keys(saved.done)) if (saved.done[id] === true) done[id] = true;
  let custom = Array.isArray(saved.custom) ? saved.custom.map(cleanCustom).filter(Boolean) : [];
  // A task may only need a quest that exists (and not itself).
  const known = new Set(allQuests({ custom }).map((q) => q.id));
  custom = custom.map((q) => {
    if (!q.prereqs || (known.has(q.prereqs[0]) && q.prereqs[0] !== q.id)) return q;
    const { prereqs, ...rest } = q;
    return rest;
  });
  const state = {
    version: SAVE_VERSION,
    xp: Number.isFinite(saved.xp) && saved.xp >= 0 ? saved.xp : 0,
    done,
    arch: saved.arch === true,
    profile: validProfile(saved.profile) ? saved.profile : null,
    custom,
    wedding: loadWedding(saved.wedding),
  };
  return syncGuestCount(state);
}

// One guest count after loading. A confirmed setup count wins; otherwise a usable profile number is adopted
// (the player typed it, so it counts as confirmed).
function syncGuestCount(state) {
  const p = state.profile;
  if (!p) return state;
  if (!state.wedding.guestsConfirmed && Number.isInteger(p.guests) && p.guests >= 1 && p.guests <= MAX_GUESTS) setGuestCount(state, p.guests);
  else p.guests = state.wedding.guestCount;
  return state;
}

// The reward shown when a quest is completed: which quest it sits beside, what it says, and how long it stays.
const REWARD_MS = 6000;
function rewardFor(state, quest, before) {
  const levelUp = levelFor(state.xp) > before.level;
  const news = UNLOCKS.filter((u) => !before.unlocks.includes(u.id) && unlocksFor(state).includes(u.id));
  const text = (quest.id === "book-venue" ? "Venue booked!" : quest.name + " done!")
    + " +" + quest.xp + " XP"
    + (levelUp ? " · Level up! Now level " + levelFor(state.xp) : "")
    + (news.length ? " · New in your world: " + news.map((u) => u.label).join(", ") : "");
  return { questId: quest.id, text, ms: REWARD_MS };
}
// What rewardFor needs to know from before the quest was completed.
const rewardBefore = (state) => ({ level: levelFor(state.xp), unlocks: unlocksFor(state) });

// ---- wedding setup: setting, venue, guest count, and the guests drawn on the plot ----
const guestName = (i) => "Guest " + (i + 1);
const defaultGuest = (i) => ({ name: guestName(i), hair: HAIR_COLOURS[i % HAIR_COLOURS.length], clothes: CLOTHES_COLOURS[i % CLOTHES_COLOURS.length] });
const isHex = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function newWedding() {
  return { setting: null, venue: null, guestCount: DEFAULT_GUESTS, guestsConfirmed: false, guests: Array.from({ length: DEFAULT_GUESTS }, (_, i) => defaultGuest(i)), card: newCard(), shoot: newShoot() };
}

function newCard() {
  return { style: null, message: DEFAULT_CARD_MESSAGE, sent: [] };
}

// ---- save-the-dates: design one card, then post it to the guests on the plot ----
// Returns an error message, or null when the card is saved.
function designCard(state, { style, message }) {
  if (!CARD_STYLES.includes(style)) return "Pick a card style.";
  const clean = typeof message === "string" ? message.trim() : "";
  if (!clean) return "Write a short message for the card.";
  if (clean.length > CARD_MESSAGE_MAX) return "Keep the message to " + CARD_MESSAGE_MAX + " characters.";
  state.wedding.card.style = style;
  state.wedding.card.message = clean;
  return null;
}

// True when guest i (shown on the plot) has been sent a card.
function hasCard(state, i) {
  return state.wedding.card.sent.includes(i);
}

// Guests on the plot who have a card, and how many are still waiting.
function cardProgress(state) {
  const total = guestsShown(state).length;
  const sent = state.wedding.card.sent.filter((i) => i < total).length;
  return { sent, waiting: total - sent, total };
}

// Posts a card to one guest. Returns an error message, or null when sent.
function sendCard(state, i) {
  if (!state.wedding.card.style) return "Design the card first.";
  if (!Number.isInteger(i) || i < 0 || i >= guestsShown(state).length) return "No such guest.";
  if (!hasCard(state, i)) state.wedding.card.sent.push(i);
  return null;
}

// Posts a card to every guest on the plot. When every guest has one, the "Send save-the-dates" quest is completed
// (once, through completeTask, so the usual XP and prerequisite rules apply).
// Returns { error, completed }.
function sendAllCards(state) {
  if (!state.wedding.card.style) return { error: "Design the card first.", completed: false };
  if (!state.wedding.guestsConfirmed) return { error: "Confirm your guest count first.", completed: false };
  for (let i = 0; i < state.wedding.guestCount; i++) sendCard(state, i);
  return { error: null, completed: finishSaveTheDates(state) };
}

// Completes the quest when every guest on the plot has a card. Returns true only when XP was awarded.
function finishSaveTheDates(state) {
  if (!state.wedding.guestsConfirmed || cardProgress(state).waiting > 0) return false;
  return completeTask(state, "save-the-dates");
}

// ---- engagement shoot: take photos at a spot in your setting, then star a favourite ----
function newShoot() {
  return { photos: [], favourite: null };
}

const spotsFor = (setting) => SHOOT_SPOTS[setting] || [];

// Takes a photo. Returns an error message, or null when it is added to the album.
function takePhoto(state, { spot, pose }) {
  const setting = state.wedding.setting;
  if (!setting) return "Pick your wedding setting first.";
  if (!spotsFor(setting).some((s) => s.id === spot)) return "Pick a spot for the photo.";
  if (!SHOOT_POSES.some((p) => p.id === pose)) return "Pick a pose.";
  if (state.wedding.shoot.photos.length >= MAX_PHOTOS) return "The album holds " + MAX_PHOTOS + " photos. Remove one first.";
  state.wedding.shoot.photos.push({ spot, pose });
  return null;
}

// Removes photo i. The favourite moves with the album, or is cleared if it was the one removed.
function removePhoto(state, i) {
  const shoot = state.wedding.shoot;
  if (!Number.isInteger(i) || i < 0 || i >= shoot.photos.length) return false;
  shoot.photos.splice(i, 1);
  if (shoot.favourite === i) shoot.favourite = null;
  else if (shoot.favourite !== null && shoot.favourite > i) shoot.favourite -= 1;
  return true;
}

// Stars photo i as the favourite and completes the shoot quest (once, with the usual prerequisite rules).
// Returns { error, completed }.
function starPhoto(state, i) {
  const shoot = state.wedding.shoot;
  if (!Number.isInteger(i) || i < 0 || i >= shoot.photos.length) return { error: "No such photo.", completed: false };
  shoot.favourite = i;
  return { error: null, completed: completeTask(state, "engagement-shoot") };
}

function loadShoot(saved) {
  if (!isObject(saved) || !Array.isArray(saved.photos)) return newShoot();
  const spots = new Set(Object.values(SHOOT_SPOTS).flat().map((s) => s.id));
  const poses = new Set(SHOOT_POSES.map((p) => p.id));
  const photos = saved.photos.filter((p) => isObject(p) && spots.has(p.spot) && poses.has(p.pose))
    .slice(0, MAX_PHOTOS).map((p) => ({ spot: p.spot, pose: p.pose }));
  const fav = Number.isInteger(saved.favourite) && saved.favourite >= 0 && saved.favourite < photos.length ? saved.favourite : null;
  return { photos, favourite: photos.length === saved.photos.length ? fav : null };
}

function loadCard(saved, guestCount) {
  if (!isObject(saved)) return newCard();
  const message = typeof saved.message === "string" && saved.message.trim() && saved.message.trim().length <= CARD_MESSAGE_MAX
    ? saved.message.trim() : DEFAULT_CARD_MESSAGE;
  const sent = Array.isArray(saved.sent)
    ? [...new Set(saved.sent.filter((i) => Number.isInteger(i) && i >= 0 && i < MAX_GUESTS))] : [];
  return { style: CARD_STYLES.includes(saved.style) ? saved.style : null, message, sent };
}

// Returns an error message, or null when chosen.
function chooseSetting(state, setting) {
  if (!SETTINGS.includes(setting)) return "Pick beach, castle or home.";
  state.wedding.setting = setting;
  return null;
}

function chooseVenue(state, venue) {
  if (!VENUES.includes(venue)) return "Pick a venue from the list.";
  state.wedding.venue = venue;
  return null;
}

// Guests are kept once made, so lowering the count hides guests without losing their names or colours.
function setGuestCount(state, n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_GUESTS) return "Guest count must be a whole number from 1 to " + MAX_GUESTS + ".";
  const w = state.wedding;
  while (w.guests.length < n) w.guests.push(defaultGuest(w.guests.length));
  w.guestCount = n;
  w.guestsConfirmed = true;
  // One guest count: the profile shows the same number.
  if (state.profile) state.profile.guests = n;
  return null;
}

// The guests on the plot now: none until the player confirms a guest count, then the first guestCount of them.
// (120 stays in the field as a suggestion until then.)
function guestsShown(state) {
  if (!state.wedding.guestsConfirmed) return [];
  return state.wedding.guests.slice(0, state.wedding.guestCount);
}

function renameGuest(state, i, name) {
  const clean = typeof name === "string" ? name.trim() : "";
  if (!clean) return "Add a name.";
  if (clean.length > GUEST_NAME_MAX) return "Keep the name to " + GUEST_NAME_MAX + " characters.";
  const g = state.wedding.guests[i];
  if (!g) return "No such guest.";
  g.name = clean;
  return null;
}

function recolourGuest(state, i, { hair, clothes }) {
  const g = state.wedding.guests[i];
  if (!g) return "No such guest.";
  if (!isHex(hair) || !isHex(clothes)) return "Pick a colour for hair and clothes.";
  g.hair = hair;
  g.clothes = clothes;
  return null;
}

// Reads the saved wedding. A missing or damaged part falls back to its default.
function loadWedding(saved) {
  if (!isObject(saved)) return newWedding();
  const setting = SETTINGS.includes(saved.setting) ? saved.setting : null;
  const venue = VENUES.includes(saved.venue) ? saved.venue : null;
  const guestCount = Number.isInteger(saved.guestCount) && saved.guestCount >= 1 && saved.guestCount <= MAX_GUESTS ? saved.guestCount : DEFAULT_GUESTS;
  const list = Array.isArray(saved.guests) ? saved.guests.slice(0, MAX_GUESTS) : [];
  const guests = [];
  for (let i = 0; i < Math.max(guestCount, list.length); i++) {
    const d = defaultGuest(i);
    const g = isObject(list[i]) ? list[i] : {};
    const name = typeof g.name === "string" ? g.name.trim() : "";
    guests.push({
      name: name && name.length <= GUEST_NAME_MAX ? name : d.name,
      hair: isHex(g.hair) ? g.hair : d.hair,
      clothes: isHex(g.clothes) ? g.clothes : d.clothes,
    });
  }
  // A save from before this flag counts as confirmed once a venue was chosen (the count field was on screen).
  const guestsConfirmed = saved.guestsConfirmed === true || (saved.guestsConfirmed === undefined && venue !== null);
  return { setting, venue, guestCount, guestsConfirmed, guests, card: loadCard(saved.card, guestCount), shoot: loadShoot(saved.shoot) };
}

function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

if (typeof module !== "undefined") {
  module.exports = {
    CHAPTERS, QUESTS, UNLOCKS, THEMES, XP_PER_LEVEL, newState, questStatus, levelFor, completeTask, canUndo, undoTask, todayIso,
    unlocksFor, completedCount, progressPercent, planningProgress, worldProgress, milestonesReached, nextTask, SAVE_VERSION,
    profileError, saveProfile, loadState, saveState, STORAGE_KEY,
    allQuests, customError, saveCustom, deleteCustom, suggestedRoute, suggestedNumber,
    SETTINGS, VENUES, VENUE_LABELS, DEFAULT_GUESTS, MAX_GUESTS, HAIR_COLOURS, CLOTHES_COLOURS,
    CARD_STYLES, CARD_LABELS, CARD_MESSAGE_MAX, DEFAULT_CARD_MESSAGE, newCard, designCard, hasCard, cardProgress, sendCard, sendAllCards,
    finishSaveTheDates, loadCard,
    SHOOT_SPOTS, SHOOT_POSES, MAX_PHOTOS, newShoot, spotsFor, takePhoto, removePhoto, starPhoto, loadShoot,
    syncGuestCount, REWARD_MS, rewardFor, rewardBefore,
    newWedding, chooseSetting, chooseVenue, setGuestCount, guestsShown, renameGuest, recolourGuest, loadWedding,
  };
}

// ---- browser UI (skipped under node tests) ----
if (typeof document !== "undefined") {
  const state = loadState(localStorage);
  const $ = (id) => document.getElementById(id);
  const chapterList = $("chapters");
  const celebration = $("celebration");
  const customList = $("custom-list");
  const customForm = $("custom-form");
  let editingId = null;

  function renderProfile() {
    const p = state.profile || { partnerA: "", partnerB: "", date: "", theme: THEMES[0] };
    $("partner-a").value = p.partnerA;
    $("partner-b").value = p.partnerB;
    $("date").value = p.date;
    $("theme").value = p.theme;
    $("guests").value = state.wedding.guestCount;
  }

  function makeButton(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function questItem(quest) {
    const status = questStatus(state, quest);
    const li = document.createElement("li");
    li.className = status;
    li.dataset.quest = quest.id;

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = quest.name;
    const meta = document.createElement("small");
    const parts = ["#" + suggestedNumber(state, quest), quest.category, quest.xp + " XP", status];
    if (quest.due) parts.push("due " + quest.due);
    meta.textContent = parts.join(" · ");
    const desc = document.createElement("p");
    desc.textContent = quest.description;
    info.append(title, meta, desc);
    if (status === "blocked") {
      const need = document.createElement("small");
      need.textContent = "Needs: " + openPrereqs(state, quest).map((id) => findQuest(state, id).name).join(", ");
      info.append(need);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    if (status === "completed") {
      btn.textContent = "Undo";
      btn.disabled = !canUndo(state, quest.id);
      btn.title = btn.disabled ? "Undo the quests that need this one first" : "";
      btn.addEventListener("click", () => onUndo(quest));
    } else {
      btn.textContent = "Complete";
      btn.disabled = status === "blocked";
      btn.addEventListener("click", () => onComplete(quest));
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(btn);
    if (state.custom.some((q) => q.id === quest.id)) {
      actions.append(makeButton("Edit", () => onEdit(quest)), makeButton("Delete", () => onDelete(quest)));
    }
    // Screen readers hear which quest each button acts on, not just "Edit" or "Complete".
    for (const b of actions.querySelectorAll("button")) b.setAttribute("aria-label", b.textContent + ": " + quest.name);
    li.append(info, actions);
    return li;
  }

  // Progress screen: planning and world are separate measures; the next task follows chapter order.
  function renderProgress() {
    const planning = planningProgress(state);
    const world = worldProgress(state);
    $("xp").textContent = state.xp;
    $("level").textContent = levelFor(state.xp);
    $("next-level").textContent = (XP_PER_LEVEL - (state.xp % XP_PER_LEVEL)) + " XP to level " + (levelFor(state.xp) + 1);
    $("progress-text").textContent = planning.percent + "%";
    $("progress-count").textContent = planning.done + " done · " + planning.remaining + " left of " + planning.total + " quests";
    $("progress-fill").style.width = planning.percent + "%";
    $("world-count").textContent = world.unlocked + " of " + world.total + " unlocked";
    $("world-list").textContent = world.labels.join(", ") || "Nothing yet";
    $("milestones").textContent = milestonesReached(state).join(", ") || "None yet";
    const next = nextTask(state);
    const chapter = next && CHAPTERS.find((c) => c.quests.includes(next));
    $("next-task").textContent = next
      ? next.name + " · " + (chapter ? chapter.title : "Your tasks") + " · " + next.xp + " XP"
      : "Every quest is done";
  }

  function render() {
    renderWedding();
    renderProgress();
    const unlocked = new Set(unlocksFor(state));
    for (const u of UNLOCKS) {
      for (const el of document.querySelectorAll('[data-unlock="' + u.id + '"]')) {
        el.classList.toggle("hidden", !unlocked.has(u.id));
      }
    }
    chapterList.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = chapter.title;
      const ul = document.createElement("ul");
      ul.className = "quests";
      for (const quest of chapter.quests) ul.append(questItem(quest));
      section.append(heading, ul);
      chapterList.append(section);
    }
    customList.innerHTML = "";
    for (const quest of state.custom) customList.append(questItem(quest));
    placeReward();
  }

  function onUndo(quest) {
    if (!undoTask(state, quest.id)) return;
    saveState(localStorage, state);
    render();
  }

  // The reward sits inside the quest that was just completed and stays for REWARD_MS, even if the list is redrawn.
  let activeReward = null;
  let rewardTimer = null;
  function placeReward() {
    if (!activeReward) { celebration.hidden = true; return; }
    const li = document.querySelector('li[data-quest="' + activeReward.questId + '"]');
    if (!li) return;
    if (celebration.parentNode !== li.firstElementChild) li.firstElementChild.append(celebration);
    celebration.textContent = activeReward.text;
    celebration.hidden = false;
  }
  function showReward(reward) {
    activeReward = reward;
    clearTimeout(rewardTimer);
    placeReward();
    celebration.style.animation = "none";
    void celebration.offsetWidth; // restart the animation
    celebration.style.animation = "";
    celebration.scrollIntoView({ block: "nearest", behavior: "smooth" });
    rewardTimer = setTimeout(() => { activeReward = null; celebration.hidden = true; }, reward.ms);
  }

  function onComplete(quest) {
    const before = rewardBefore(state);
    if (!completeTask(state, quest.id)) return;
    saveState(localStorage, state);
    render();
    showReward(rewardFor(state, quest, before));
  }

  // Fills the form for a new task (quest is null) or for editing one.
  function openForm(quest) {
    editingId = quest ? quest.id : null;
    const select = $("custom-prereq");
    select.innerHTML = "";
    select.append(new Option("Nothing", ""));
    for (const q of allQuests(state)) select.append(new Option(q.name, q.id));
    $("custom-name").value = quest ? quest.name : "";
    $("custom-category").value = quest ? quest.category : "";
    $("custom-xp").value = String(quest ? quest.xp : STANDARD);
    $("custom-due").value = quest && quest.due ? quest.due : "";
    select.value = quest && quest.prereqs ? quest.prereqs[0] : "";
    $("custom-submit").textContent = quest ? "Save task" : "Add task";
    $("custom-cancel").hidden = !quest;
    $("custom-status").textContent = "";
  }

  function onEdit(quest) {
    openForm(quest);
    customForm.scrollIntoView({ behavior: "smooth" });
  }

  function onDelete(quest) {
    if (!deleteCustom(state, quest.id)) return;
    saveState(localStorage, state);
    if (editingId === quest.id) openForm(null);
    render();
  }

  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const error = saveCustom(state, {
      name: $("custom-name").value,
      category: $("custom-category").value,
      xp: Number($("custom-xp").value),
      due: $("custom-due").value,
      prereq: $("custom-prereq").value,
    }, editingId);
    if (error) {
      $("custom-status").textContent = error;
      return;
    }
    saveState(localStorage, state);
    openForm(null);
    render();
  });

  $("custom-cancel").addEventListener("click", () => openForm(null));

  $("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const error = saveProfile(state, {
      partnerA: $("partner-a").value,
      partnerB: $("partner-b").value,
      date: $("date").value,
      theme: $("theme").value,
      guests: Number($("guests").value),
    });
    if (error) {
      $("profile-status").textContent = error;
      return;
    }
    saveState(localStorage, state);
    $("profile-status").textContent = "Saved.";
    render();
  });

  for (const theme of THEMES) {
    const option = document.createElement("option");
    option.textContent = theme;
    $("theme").append(option);
  }

  document.getElementById("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "glowa-save.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---- wedding setup and plot: setting as ground, venue as a label, guests as drawn avatars ----
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SETTING_GROUND = { beach: "#f6e2b3", castle: "#bfe29c", home: "#d8ecc4" };
  let selectedGuest = null;

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
    if (parent) parent.append(el);
    return el;
  }

  function renderPlot() {
    const svg = $("plot");
    svg.innerHTML = "";
    const setting = state.wedding.setting;
    if (!setting) return;
    svgEl("rect", { x: 0, y: 0, width: 400, height: 260, fill: SETTING_GROUND[setting] }, svg);
    const label = svgEl("text", { x: 12, y: 24, "font-size": 13, fill: "#5a4640" }, svg);
    label.textContent = setting[0].toUpperCase() + setting.slice(1) + " plot" + (state.wedding.venue ? " · " + VENUE_LABELS[state.wedding.venue] : "");
    const shown = guestsShown(state);
    const cols = Math.min(12, shown.length);
    if (cols === 0) return;
    const rows = Math.ceil(shown.length / cols);
    const dy = Math.min(17, 190 / rows);
    shown.forEach((g, i) => {
      const cx = 20 + (360 / cols) * ((i % cols) + 0.5);
      const cy = 70 + Math.floor(i / cols) * dy;
      const grp = svgEl("g", { class: "guest", "data-guest": i, role: "button", tabindex: 0 }, svg);
      svgEl("title", {}, grp).textContent = g.name + (hasCard(state, i) ? " (save-the-date sent)" : "");
      svgEl("path", { d: "M" + (cx - 4.5) + " " + (cy + 6) + " L" + (cx - 3) + " " + (cy - 2) + " Q" + cx + " " + (cy - 4) + " " + (cx + 3) + " " + (cy - 2) + " L" + (cx + 4.5) + " " + (cy + 6) + " Z", fill: g.clothes }, grp);
      svgEl("circle", { cx: cx, cy: cy - 8, r: 4, fill: g.hair }, grp);
      svgEl("circle", { cx: cx, cy: cy - 7, r: 2.8, fill: SKIN }, grp);
      if (hasCard(state, i)) {
        svgEl("rect", { x: cx + 3, y: cy - 1, width: 6, height: 4, fill: "#fffdf6", stroke: "#b87262", "stroke-width": 0.6 }, grp);
        svgEl("path", { d: "M" + (cx + 3) + " " + (cy - 1) + " L" + (cx + 6) + " " + (cy + 1.2) + " L" + (cx + 9) + " " + (cy - 1), fill: "none", stroke: "#b87262", "stroke-width": 0.6 }, grp);
      }
      grp.addEventListener("click", () => selectGuest(i));
      grp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectGuest(i); } });
    });
  }

  function selectGuest(i) {
    selectedGuest = i;
    renderPanel();
  }

  function renderPanel() {
    const g = selectedGuest === null ? null : guestsShown(state)[selectedGuest];
    $("guest-panel").hidden = !g;
    if (!g) return;
    $("guest-title").textContent = "Guest " + (selectedGuest + 1);
    $("guest-name").value = g.name;
    $("guest-hair").value = g.hair;
    $("guest-clothes").value = g.clothes;
    $("guest-status").textContent = "";
    $("guest-send").hidden = !state.wedding.card.style;
    $("guest-send").disabled = hasCard(state, selectedGuest);
    $("guest-send").textContent = hasCard(state, selectedGuest) ? "Save-the-date sent" : "Send their save-the-date";
  }

  // Card designer: a style, a message, and a preview with the couple's names and date from the profile.
  function renderCard() {
    const c = state.wedding.card;
    $("card-section").hidden = !(state.wedding.setting && state.wedding.venue && state.wedding.guestsConfirmed);
    for (const b of document.querySelectorAll("[data-card-style]")) b.setAttribute("aria-pressed", String(b.dataset.cardStyle === c.style));
    if (document.activeElement !== $("card-message")) $("card-message").value = c.message;
    const preview = $("card-preview");
    preview.className = "card-preview " + (c.style || "none");
    const p = state.profile;
    $("card-names").textContent = p ? p.partnerA + " & " + p.partnerB : "Your names here";
    $("card-date").textContent = p ? p.date : "Add your date in the wedding profile";
    $("card-text").textContent = c.message;
    const prog = cardProgress(state);
    $("card-count").textContent = prog.sent + " of " + prog.total + " guests have their card";
    $("card-send-all").disabled = !c.style || prog.waiting === 0;
  }

  function renderWedding() {
    const w = state.wedding;
    for (const b of document.querySelectorAll("[data-setting]")) b.setAttribute("aria-pressed", String(b.dataset.setting === w.setting));
    $("venue-section").hidden = !w.setting;
    $("guests-section").hidden = !(w.setting && w.venue);
    $("plot-section").hidden = !w.setting;
    $("venue").value = w.venue || "";
    if (document.activeElement !== $("guest-count")) $("guest-count").value = w.guestCount;
    if (document.activeElement !== $("guests")) $("guests").value = w.guestCount;
    $("guest-confirm").textContent = w.guestsConfirmed ? "Update guest count" : "Confirm guest count";
    $("plot-hint").textContent = w.guestsConfirmed ? "Tap a guest to change their name and colours."
      : "Your guests arrive once you confirm the guest count.";
    renderPlot();
    renderPanel();
    renderCard();
    renderShoot();
  }

  for (const b of document.querySelectorAll("[data-setting]")) {
    b.addEventListener("click", () => {
      if (chooseSetting(state, b.dataset.setting)) return;
      saveState(localStorage, state);
      render();
    });
  }

  $("venue").append(new Option("Pick a venue", ""));
  for (const v of VENUES) $("venue").append(new Option(VENUE_LABELS[v], v));
  $("venue").addEventListener("change", () => {
    const error = chooseVenue(state, $("venue").value);
    $("setup-status").textContent = error || "";
    if (error) return;
    saveState(localStorage, state);
    render();
  });

  // The count is confirmed by the button (or Enter), so the suggested 120 is never applied by itself.
  function confirmGuests() {
    const error = setGuestCount(state, Number($("guest-count").value));
    $("setup-status").textContent = error || "Guest count confirmed: " + state.wedding.guestCount + ".";
    if (error) return;
    saveState(localStorage, state);
    $("guest-count").blur();
    render();
  }
  $("guest-confirm").addEventListener("click", confirmGuests);
  $("guest-count").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmGuests(); } });

  $("guest-name").addEventListener("input", () => {
    if (selectedGuest === null) return;
    const error = renameGuest(state, selectedGuest, $("guest-name").value);
    $("guest-status").textContent = error || "Saved.";
    if (error) return;
    saveState(localStorage, state);
    renderPlot();
  });

  for (const id of ["guest-hair", "guest-clothes"]) {
    $(id).addEventListener("input", () => {
      if (selectedGuest === null) return;
      const error = recolourGuest(state, selectedGuest, { hair: $("guest-hair").value, clothes: $("guest-clothes").value });
      $("guest-status").textContent = error || "Saved.";
      if (error) return;
      saveState(localStorage, state);
      renderPlot();
    });
  }

  // ---- engagement shoot ----
  const spotLabel = (id) => (Object.values(SHOOT_SPOTS).flat().find((s) => s.id === id) || {}).label || id;
  const poseLabel = (id) => (SHOOT_POSES.find((p) => p.id === id) || {}).label || id;
  const SPOT_BACKDROP = {
    "castle-gate": ["#9aa3ad", "#c9cfd4"], "great-lawn": ["#bfe3f2", "#a8d48a"], "tower-steps": ["#d6d0c4", "#a89f8f"],
    shore: ["#bfe3f2", "#f6e2b3"], dunes: ["#fde9d9", "#e8cf98"], pier: ["#a9d3e8", "#8c6f63"],
    garden: ["#d8ecc4", "#9cc97f"], "front-door": ["#f3e3d3", "#b5523b"], kitchen: ["#fbf3e6", "#d9b98f"],
  };

  // Draws the couple at a spot in a pose, in a small square SVG.
  function photoSvg(photo) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 80 80");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", poseLabel(photo.pose) + " at the " + spotLabel(photo.spot));
    const [sky, ground] = SPOT_BACKDROP[photo.spot] || ["#eee", "#ccc"];
    svgEl("rect", { x: 0, y: 0, width: 80, height: 80, fill: sky }, svg);
    svgEl("rect", { x: 0, y: 52, width: 80, height: 28, fill: ground }, svg);
    const tilt = photo.pose === "dip" ? 22 : 0;
    const shift = photo.pose === "walk" ? 8 : 0;
    const person = (x, clothes, angle) => {
      const g = svgEl("g", { transform: "rotate(" + angle + " " + x + " 62)" }, svg);
      svgEl("path", { d: "M" + (x - 6) + " 64 L" + (x - 4) + " 44 L" + (x + 4) + " 44 L" + (x + 6) + " 64 Z", fill: clothes }, g);
      svgEl("circle", { cx: x, cy: 38, r: 5, fill: SKIN }, g);
    };
    person(32 + shift, "#3f4b5c", 0);
    person(48 + shift, "#fffdf6", tilt);
    if (photo.pose === "hands") svgEl("line", { x1: 36, y1: 54, x2: 44, y2: 54, stroke: SKIN, "stroke-width": 2.5, "stroke-linecap": "round" }, svg);
    return svg;
  }

  function renderShoot() {
    const w = state.wedding;
    $("shoot-section").hidden = !(w.setting && w.venue);
    if (!w.setting) return;
    const spot = $("shoot-spot");
    const keep = spot.value;
    spot.innerHTML = "";
    for (const s of spotsFor(w.setting)) spot.append(new Option(s.label, s.id));
    if (spotsFor(w.setting).some((s) => s.id === keep)) spot.value = keep;
    const album = $("shoot-album");
    album.innerHTML = "";
    w.shoot.photos.forEach((photo, i) => {
      const li = document.createElement("li");
      if (w.shoot.favourite === i) li.className = "favourite";
      const caption = document.createElement("small");
      caption.textContent = (w.shoot.favourite === i ? "Favourite · " : "") + poseLabel(photo.pose) + ", " + spotLabel(photo.spot);
      const star = makeButton(w.shoot.favourite === i ? "Starred" : "Star", () => onStar(i));
      star.disabled = w.shoot.favourite === i;
      star.setAttribute("aria-label", "Star photo " + (i + 1) + " as favourite");
      const del = makeButton("Remove", () => { removePhoto(state, i); saveState(localStorage, state); render(); });
      del.setAttribute("aria-label", "Remove photo " + (i + 1));
      li.append(photoSvg(photo), caption, star, del);
      album.append(li);
    });
    $("shoot-count").textContent = w.shoot.photos.length + " of " + MAX_PHOTOS + " photos";
    $("shoot-take").disabled = w.shoot.photos.length >= MAX_PHOTOS;
  }

  function onStar(i) {
    const before = rewardBefore(state);
    const { error, completed } = starPhoto(state, i);
    if (error) { $("shoot-status").textContent = error; return; }
    $("shoot-status").textContent = state.done["engagement-shoot"] ? "Favourite starred."
      : "Favourite starred. Book your photographer to complete the shoot quest.";
    saveState(localStorage, state);
    render();
    if (completed) {
      const reward = rewardFor(state, QUESTS.find((x) => x.id === "engagement-shoot"), before);
      $("shoot-status").textContent = reward.text;
      showReward(reward);
    }
  }

  for (const p of SHOOT_POSES) $("shoot-pose").append(new Option(p.label, p.id));
  $("shoot-take").addEventListener("click", () => {
    const error = takePhoto(state, { spot: $("shoot-spot").value, pose: $("shoot-pose").value });
    $("shoot-status").textContent = error || "Click! Added to the album.";
    if (error) return;
    saveState(localStorage, state);
    render();
  });

  // ---- save-the-dates ----
  function afterCards(completed, before) {
    saveState(localStorage, state);
    render();
    if (completed) {
      const reward = rewardFor(state, QUESTS.find((x) => x.id === "save-the-dates"), before);
      $("card-status").textContent = "Every guest has a save-the-date! " + reward.text;
      showReward(reward);
    }
  }

  for (const b of document.querySelectorAll("[data-card-style]")) {
    b.addEventListener("click", () => {
      const error = designCard(state, { style: b.dataset.cardStyle, message: $("card-message").value });
      $("card-status").textContent = error || "Card saved.";
      if (error) return;
      saveState(localStorage, state);
      render();
    });
  }

  $("card-message").addEventListener("input", () => {
    const style = state.wedding.card.style;
    if (!style) { $("card-status").textContent = "Pick a card style."; return; }
    const error = designCard(state, { style, message: $("card-message").value });
    $("card-status").textContent = error || "Card saved.";
    if (error) return;
    saveState(localStorage, state);
    renderCard();
  });

  $("card-send-all").addEventListener("click", () => {
    const before = rewardBefore(state);
    const { error, completed } = sendAllCards(state);
    if (error) { $("card-status").textContent = error; return; }
    $("card-status").textContent = state.done["save-the-dates"] ? "Posted to every guest."
      : "Posted to every guest. Finish " + ["draft-guest-list", "set-date"].filter((id) => !state.done[id]).map((id) => QUESTS.find((q) => q.id === id).name).join(" and ") + " to complete the quest.";
    afterCards(completed, before);
  });

  $("guest-send").addEventListener("click", () => {
    if (selectedGuest === null) return;
    const before = rewardBefore(state);
    const error = sendCard(state, selectedGuest);
    $("guest-status").textContent = error || "Sent.";
    if (error) return;
    afterCards(finishSaveTheDates(state), before);
  });

  openForm(null);
  renderProfile();
  render();
}
