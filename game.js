// Glowa milestone F: a progress screen (planning, world, milestones, next task) on top of milestone E's wedding
// profile, custom tasks, chapters of quests, XP, levels, undo and redo, saved in the browser.
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
  return { version: SAVE_VERSION, xp: 0, done: {}, arch: false, profile: null, custom: [] };
}

// A quest is blocked while any prerequisite is not complete.
function openPrereqs(state, quest) {
  return (quest.prereqs || []).filter((id) => !state.done[id]);
}

// completed, blocked (a prerequisite is open), upcoming (due date still ahead), or available.
function questStatus(state, quest, today) {
  if (state.done[quest.id]) return "completed";
  if (openPrereqs(state, quest).length > 0) return "blocked";
  if (quest.due && quest.due > today) return "upcoming";
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

// The next task: the first quest in chapter order, then custom tasks, that is neither completed nor blocked.
function nextTask(state, today) {
  return allQuests(state).find((q) => ["available", "upcoming"].includes(questStatus(state, q, today))) || null;
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
  const error = profileError(p);
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
  return {
    version: SAVE_VERSION,
    xp: Number.isFinite(saved.xp) && saved.xp >= 0 ? saved.xp : 0,
    done,
    arch: saved.arch === true,
    profile: validProfile(saved.profile) ? saved.profile : null,
    custom,
  };
}

function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

if (typeof module !== "undefined") {
  module.exports = {
    CHAPTERS, QUESTS, UNLOCKS, THEMES, XP_PER_LEVEL, newState, questStatus, levelFor, completeTask, canUndo, undoTask, todayIso,
    unlocksFor, completedCount, progressPercent, planningProgress, worldProgress, milestonesReached, nextTask, SAVE_VERSION,
    profileError, saveProfile, loadState, saveState, STORAGE_KEY,
    allQuests, customError, saveCustom, deleteCustom,
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
    const p = state.profile || { partnerA: "", partnerB: "", date: "", theme: THEMES[0], guests: "" };
    $("partner-a").value = p.partnerA;
    $("partner-b").value = p.partnerB;
    $("date").value = p.date;
    $("theme").value = p.theme;
    $("guests").value = p.guests;
  }

  function makeButton(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function questItem(quest, today) {
    const status = questStatus(state, quest, today);
    const li = document.createElement("li");
    li.className = status;

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = quest.name;
    const meta = document.createElement("small");
    const parts = [quest.category, quest.xp + " XP", status];
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
    const next = nextTask(state, todayIso());
    const chapter = next && CHAPTERS.find((c) => c.quests.includes(next));
    $("next-task").textContent = next
      ? next.name + " · " + (chapter ? chapter.title : "Your tasks") + " · " + next.xp + " XP"
      : "Every quest is done";
  }

  function render() {
    renderProgress();
    const unlocked = new Set(unlocksFor(state));
    for (const u of UNLOCKS) {
      for (const el of document.querySelectorAll('[data-unlock="' + u.id + '"]')) {
        el.classList.toggle("hidden", !unlocked.has(u.id));
      }
    }
    const today = todayIso();
    chapterList.innerHTML = "";
    for (const chapter of CHAPTERS) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = chapter.title;
      const ul = document.createElement("ul");
      ul.className = "quests";
      for (const quest of chapter.quests) ul.append(questItem(quest, today));
      section.append(heading, ul);
      chapterList.append(section);
    }
    customList.innerHTML = "";
    for (const quest of state.custom) customList.append(questItem(quest, today));
  }

  function onUndo(quest) {
    if (!undoTask(state, quest.id)) return;
    saveState(localStorage, state);
    render();
  }

  function onComplete(quest) {
    const levelBefore = levelFor(state.xp);
    const scenBefore = new Set(unlocksFor(state));
    if (!completeTask(state, quest.id)) return;
    saveState(localStorage, state);
    render();
    const levelUp = levelFor(state.xp) > levelBefore;
    const news = UNLOCKS.filter((u) => !scenBefore.has(u.id) && unlocksFor(state).includes(u.id));
    celebration.textContent = (quest.id === "book-venue" ? "Venue booked!" : quest.name + " done!")
      + " +" + quest.xp + " XP"
      + (levelUp ? " · Level up! Now level " + levelFor(state.xp) : "")
      + (news.length ? " · New in your world: " + news.map((u) => u.label).join(", ") : "");
    celebration.hidden = false;
    celebration.style.animation = "none";
    void celebration.offsetWidth; // restart the animation
    celebration.style.animation = "";
    setTimeout(() => { celebration.hidden = true; }, 2000);
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

  openForm(null);
  renderProfile();
  render();
}
