// Glowa milestone A: one task, XP, an arch reward, saved in the browser.
const STORAGE_KEY = "glowa-state-v1";

const TASKS = [
  { id: "book-venue", title: "Book venue", xp: 100 },
];

function newState() {
  return { xp: 0, done: {}, arch: false };
}

// Marks a task complete once. Returns true only when XP was actually awarded.
function completeTask(state, id) {
  const task = TASKS.find((t) => t.id === id);
  if (!task || state.done[id]) return false;
  state.done[id] = true;
  state.xp += task.xp;
  if (id === "book-venue") state.arch = true;
  return true;
}

function loadState(storage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (saved && typeof saved.xp === "number") return { ...newState(), ...saved };
  } catch (e) { /* no or broken save: start fresh */ }
  return newState();
}

function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

if (typeof module !== "undefined") {
  module.exports = { TASKS, newState, completeTask, loadState, saveState, STORAGE_KEY };
}

// ---- browser UI (skipped under node tests) ----
if (typeof document !== "undefined") {
  const state = loadState(localStorage);
  const list = document.getElementById("task-list");
  const xpEl = document.getElementById("xp");
  const arch = document.getElementById("arch");
  const celebration = document.getElementById("celebration");

  function render() {
    xpEl.textContent = state.xp;
    arch.classList.toggle("hidden", !state.arch);
    list.innerHTML = "";
    for (const task of TASKS) {
      const li = document.createElement("li");
      const done = !!state.done[task.id];
      li.className = done ? "done" : "";
      const label = document.createElement("span");
      label.textContent = task.title + " (" + task.xp + " XP)";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = done ? "Done" : "Complete";
      btn.disabled = done;
      btn.addEventListener("click", () => onComplete(task.id));
      li.append(label, btn);
      list.append(li);
    }
  }

  function onComplete(id) {
    if (!completeTask(state, id)) return;
    saveState(localStorage, state);
    render();
    celebration.hidden = false;
    celebration.style.animation = "none";
    void celebration.offsetWidth; // restart the animation
    celebration.style.animation = "";
    setTimeout(() => { celebration.hidden = true; }, 2000);
  }

  document.getElementById("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "glowa-save.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
}
