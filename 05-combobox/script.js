/* -----------------------------------------------------------
   Data
----------------------------------------------------------- */
const PEOPLE = [
  { id: "1", name: "Priya Patel", role: "Frontend" },
  { id: "2", name: "Marcus Chen", role: "Design" },
  { id: "3", name: "Sarah Kim", role: "Backend" },
  { id: "4", name: "Alex Rivera", role: "Product" },
  { id: "5", name: "Jordan Lee", role: "Frontend" },
  { id: "6", name: "Taylor Brooks", role: "QA" },
  { id: "7", name: "Morgan Reyes", role: "Design" },
  { id: "8", name: "Casey Nguyen", role: "Backend" },
  { id: "9", name: "Riley Foster", role: "DevOps" },
  { id: "10", name: "Sam Okafor", role: "Frontend" },
  { id: "11", name: "Jamie Chow", role: "Product" },
  { id: "12", name: "Drew Malik", role: "Backend" },
  { id: "13", name: "Avery Sinclair", role: "Design" },
  { id: "14", name: "Elena Vasquez", role: "QA" },
];

/* ---------------- DOM refs ---------------- */

const input = document.getElementById("comboInput");
const listbox = document.getElementById("comboListbox");
const stateBadge = document.getElementById("stateBadge");
const logEl = document.getElementById("log");
const logEmptyEl = document.getElementById("logEmpty");

/* -----------------------------------------------------------
   State machine: 'typing' | 'previewing' | 'committed'

   - typing: input reflects exactly what the user has typed
     (plus, possibly, a selected inline ghost suggestion)
   - previewing: an arrow-key highlight has written an option's
     full label into the input WITHOUT committing it
   - committed: the input holds a value the user has explicitly
     accepted (Enter, click, or an exact match on blur)
----------------------------------------------------------- */
let state = "typing";
let typedValue = ""; // what the user actually typed, no ghost suffix, no preview
let filtered = []; // current listbox contents
let activeIndex = -1; // index into `filtered`
let dropdownOpen = false;

/* ---------------- Rendering: listbox ---------------- */

function getFiltered(query) {
  if (!query) return PEOPLE;
  const q = query.toLowerCase();
  return PEOPLE.filter((p) => p.name.toLowerCase().includes(q));
}

function getBestPrefixMatch(query) {
  if (!query) return null;
  const q = query.toLowerCase();
  return PEOPLE.find((p) => p.name.toLowerCase().startsWith(q)) || null;
}

function renderListbox() {
  if (!filtered.length) {
    listbox.innerHTML = `<li class="listbox-empty">No matches</li>`;
    input.setAttribute("aria-activedescendant", "");
    return;
  }
  listbox.innerHTML = filtered
    .map(
      (p, i) => `
      <li class="combo-option" role="option" id="combo-opt-${p.id}" data-index="${i}" aria-selected="${i === activeIndex}">
        <span class="combo-avatar">${escapeHtml(p.name[0])}</span>
        <span class="combo-option-body">
          <span class="combo-option-name">${escapeHtml(p.name)}</span>
          <span class="combo-option-role">${escapeHtml(p.role)}</span>
        </span>
      </li>`,
    )
    .join("");

  listbox.querySelectorAll(".combo-option").forEach((el) => {
    // mousedown (not click) + preventDefault keeps focus on the
    // input, so blur-driven revert/commit logic never fires
    // before the click is actually processed.
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const i = Number(el.dataset.index);
      commit(filtered[i]);
    });
  });

  if (activeIndex >= 0 && filtered[activeIndex]) {
    input.setAttribute(
      "aria-activedescendant",
      "combo-opt-" + filtered[activeIndex].id,
    );
  } else {
    input.setAttribute("aria-activedescendant", "");
  }
}

function openDropdown() {
  dropdownOpen = true;
  listbox.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function closeDropdown() {
  dropdownOpen = false;
  listbox.hidden = true;
  activeIndex = -1;
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-activedescendant", "");
}

function escapeHtml(str) {
  return str.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

/* ---------------- State badge + log ---------------- */

function setState(next) {
  state = next;
  stateBadge.className = "state-badge " + next;
  stateBadge.textContent = next;
}

function logEvent(text, status) {
  logEmptyEl.style.display = "none";
  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML = `
    <span class="log-text">${escapeHtml(text)}</span>
    <span class="status-badge ${status}">${status}</span>
  `;
  logEl.appendChild(row);
}

/* -----------------------------------------------------------
   Typing: this is real user input, so the browser has already
   handled replacing any selected ghost suffix natively — we
   just read the resulting value, filter, and (maybe) append a
   fresh inline suggestion as a new selected range.
----------------------------------------------------------- */
/* -----------------------------------------------------------
   Typing: this is real user input, so the browser has already
   handled replacing any selected ghost suffix natively — we
   just read the resulting value, filter, and (maybe) append a
   fresh inline suggestion as a new selected range.

   Deletions are handled differently from insertions: if a
   ghost suggestion is selected and the user presses Backspace,
   the browser deletes just that selection, leaving the typed
   prefix untouched. If we then re-suggested the same match
   immediately, the field would look unchanged and Backspace
   would appear to do nothing. So a new inline suggestion is
   only offered on insertion — deletions just shrink the field.
----------------------------------------------------------- */
input.addEventListener("input", (e) => {
  typedValue = input.value;
  setState("typing");
  activeIndex = -1;

  if (!typedValue) {
    filtered = [];
    closeDropdown();
    return;
  }

  filtered = getFiltered(typedValue);
  openDropdown();
  renderListbox();

  const isDeleting = e.inputType && e.inputType.startsWith("delete");
  const match = isDeleting ? null : getBestPrefixMatch(typedValue);

  if (match && match.name.toLowerCase() !== typedValue.toLowerCase()) {
    input.value = typedValue + match.name.slice(typedValue.length);
    input.setSelectionRange(typedValue.length, input.value.length);
    logEvent(`"${typedValue}" → suggesting "${match.name}"`, "typing");
  } else {
    logEvent(`"${typedValue}"`, "typing");
  }
});

/* ---------------- Keyboard ---------------- */

input.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!dropdownOpen) {
        filtered = getFiltered(typedValue);
        openDropdown();
      }
      if (!filtered.length) return;
      if (state !== "previewing") typedValue = trueTypedValue();
      activeIndex = Math.min(filtered.length - 1, activeIndex + 1);
      previewOption(filtered[activeIndex]);
      break;

    case "ArrowUp":
      e.preventDefault();
      if (!dropdownOpen || !filtered.length) return;
      if (state !== "previewing") typedValue = trueTypedValue();
      activeIndex = Math.max(0, activeIndex - 1);
      previewOption(filtered[activeIndex]);
      break;

    case "Enter":
      e.preventDefault();
      if (state === "previewing" && filtered[activeIndex]) {
        commit(filtered[activeIndex]);
      } else {
        const exact = PEOPLE.find(
          (p) => p.name.toLowerCase() === input.value.toLowerCase(),
        );
        if (exact) commit(exact);
      }
      break;

    case "Escape":
      if (state === "previewing") {
        e.preventDefault();
        revertPreview();
      } else if (dropdownOpen) {
        e.preventDefault();
        closeDropdown();
      }
      break;

    case "Tab":
      // Tab should just leave — commit-or-revert is handled by
      // the blur handler below, same as clicking away.
      break;
  }
});

// If the input currently has a selected ghost suffix, the "real"
// typed portion is everything before the selection start.
function trueTypedValue() {
  if (input.selectionStart !== input.selectionEnd) {
    return input.value.slice(0, input.selectionStart);
  }
  return typedValue;
}

/* -----------------------------------------------------------
   Preview: write an option's label into the input WITHOUT
   committing it. `typedValue` is preserved as whatever the user
   actually typed before arrowing, so Escape can restore it
   exactly.
----------------------------------------------------------- */
function previewOption(option) {
  setState("previewing");
  input.value = option.name;
  input.setSelectionRange(option.name.length, option.name.length);
  renderListbox();
  logEvent(`previewing "${option.name}" (↑↓)`, "previewing");
}

function revertPreview() {
  input.value = typedValue;
  input.setSelectionRange(typedValue.length, typedValue.length);
  setState("typing");
  activeIndex = -1;
  filtered = getFiltered(typedValue);
  renderListbox();
  logEvent(`reverted to "${typedValue}"`, "reverted");
}

/* -----------------------------------------------------------
   Commit: the only path that produces a genuinely selected
   value. Anything short of this — typing, previewing — is
   provisional.
----------------------------------------------------------- */
let committedValue = "";

function commit(option) {
  input.value = option.name;
  input.setSelectionRange(option.name.length, option.name.length);
  committedValue = option.name;
  typedValue = option.name;
  setState("committed");
  closeDropdown();
  logEvent(`committed "${option.name}"`, "committed");
}

/* -----------------------------------------------------------
   Blur: never leave the field holding a value that's neither a
   real selection nor exactly what the user typed. An exact
   (case-insensitive) match commits; anything else reverts to
   the last real commitment, or clears if there wasn't one.
----------------------------------------------------------- */
input.addEventListener("blur", () => {
  closeDropdown();

  if (state === "committed") return;

  const exact = PEOPLE.find(
    (p) => p.name.toLowerCase() === input.value.toLowerCase(),
  );
  if (exact) {
    commit(exact);
    return;
  }

  input.value = committedValue;
  typedValue = committedValue;
  setState(committedValue ? "committed" : "typing");
  if (input.value)
    logEvent(
      `blurred with no match → reverted to "${committedValue}"`,
      "reverted",
    );
});

input.addEventListener("focus", () => {
  filtered = getFiltered(typedValue);
  if (filtered.length) {
    openDropdown();
    renderListbox();
  }
});

/* -----------------------------------------------------------
   Harder variation: multi-select (tags/chips). Committing an
   option adds a chip instead of replacing the input, then
   clears the input for the next entry; Backspace on an empty
   input removes the most recently added chip. The state machine
   here stays mostly the same — it just commits into a list
   instead of a single value.

   Harder variation: combine this with #02's async pattern — the
   listbox options come from a debounced network call (with
   request cancellation and stale-response guarding) while the
   inline ghost-text completion still needs to feel instant,
   which usually means it can only complete against options
   already fetched, not ones still in flight.

   Harder variation: grouped/sectioned suggestions (e.g. by
   role) where ArrowUp/ArrowDown skip over group-label rows
   instead of landing on them.
----------------------------------------------------------- */
