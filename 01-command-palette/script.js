/* -----------------------------------------------------------
     Data. In a real app, "Recent" would come from local storage
     or an API, and some groups might be loaded asynchronously.

     Harder variation: replace this static array with an async
     command source (e.g. server-side search) and apply the same
     request-cancellation pattern used in the Typeahead entry of
     this series — otherwise a slow, stale response can overwrite
     a newer, faster one and show the wrong results.
  ----------------------------------------------------------- */
const ICONS = {
  dashboard:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  projects:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l3-3h5l2 2h8v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/></svg>',
  team: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="18" cy="8.5" r="2.4"/><path d="M16.5 14.3c2.8.5 4.9 2.5 4.9 5.7"/></svg>',
  billing:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19"/></svg>',
  settings:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.6-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 2.6h-6l-.3 2.4a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 2.4h6l.3-2.4a8 8 0 0 0 1.7-1l2.4 1 2-3.4z"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  invite:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
};

const COMMANDS = [
  {
    id: "nav-dashboard",
    label: "Go to Dashboard",
    group: "Navigation",
    icon: "dashboard",
    shortcut: "G D",
  },
  {
    id: "nav-projects",
    label: "Go to Projects",
    group: "Navigation",
    icon: "projects",
    shortcut: "G P",
  },
  {
    id: "nav-team",
    label: "Go to Team",
    group: "Navigation",
    icon: "team",
    shortcut: "G T",
  },
  {
    id: "nav-billing",
    label: "Go to Billing",
    group: "Navigation",
    icon: "billing",
    shortcut: "G B",
  },
  {
    id: "nav-settings",
    label: "Go to Settings",
    group: "Navigation",
    icon: "settings",
    shortcut: "G S",
  },
  {
    id: "act-new-project",
    label: "Create new project",
    group: "Actions",
    icon: "plus",
  },
  {
    id: "act-new-issue",
    label: "Create new issue",
    group: "Actions",
    icon: "plus",
  },
  {
    id: "act-invite",
    label: "Invite teammate",
    group: "Actions",
    icon: "invite",
  },
  {
    id: "act-theme",
    label: "Toggle dark mode",
    group: "Actions",
    icon: "moon",
  },
  {
    id: "rec-roadmap",
    label: "Q3 roadmap",
    group: "Recent",
    icon: "doc",
    meta: "Opened 2 hours ago",
  },
  {
    id: "rec-audit",
    label: "Design system audit",
    group: "Recent",
    icon: "doc",
    meta: "Opened yesterday",
  },
];

/* -----------------------------------------------------------
     Fuzzy match: subsequence matching with a bonus for
     consecutive characters and for matches at a word boundary.
     Returns null (no match) if the query isn't a subsequence.
  ----------------------------------------------------------- */
function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0,
    score = 0,
    streak = 0;
  const indices = [];
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      streak++;
      score += 1 + streak;
      if (ti === 0 || t[ti - 1] === " ") score += 4;
      qi++;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? { score, indices } : null;
}

function highlight(text, indices) {
  if (!indices.length) return text;
  let out = "";
  let cursor = 0;
  for (const i of indices) {
    out += text.slice(cursor, i) + "<mark>" + text[i] + "</mark>";
    cursor = i + 1;
  }
  return out + text.slice(cursor);
}

function getResults(query) {
  if (!query) {
    return COMMANDS.map((c) => ({ cmd: c, indices: [] }));
  }
  const scored = [];
  for (const cmd of COMMANDS) {
    const m = fuzzyMatch(query, cmd.label);
    if (m) scored.push({ cmd, score: m.score, indices: m.indices });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/* ---------------- Palette controller ---------------- */

const backdrop = document.getElementById("backdrop");
const input = document.getElementById("paletteInput");
const listEl = document.getElementById("paletteListbox");
const trigger = document.getElementById("trigger");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

let isOpen = false;
let results = [];
let activeIndex = 0;
let triggerEl = null; // element focus returns to on close

function render(query) {
  results = getResults(query);
  listEl.innerHTML = "";

  if (results.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No commands match “${escapeHtml(query)}”</div>`;
    input.setAttribute("aria-activedescendant", "");
    return;
  }

  let lastGroup = null;
  results.forEach((r, i) => {
    if (!query && r.cmd.group !== lastGroup) {
      lastGroup = r.cmd.group;
      const label = document.createElement("div");
      label.className = "group-label";
      label.textContent = lastGroup;
      listEl.appendChild(label);
    }

    const opt = document.createElement("div");
    opt.className = "option";
    opt.id = "opt-" + r.cmd.id;
    opt.setAttribute("role", "option");
    opt.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
    opt.dataset.index = i;

    opt.innerHTML = `
        <span class="option-icon">${ICONS[r.cmd.icon] || ""}</span>
        <span class="option-body">
          <span class="option-label">${highlight(escapeHtml(r.cmd.label), r.indices)}</span>
          ${r.cmd.meta ? `<span class="option-meta">${escapeHtml(r.cmd.meta)}</span>` : ""}
        </span>
        ${r.cmd.shortcut ? `<span class="option-shortcut">${r.cmd.shortcut}</span>` : ""}
      `;

    opt.addEventListener("mouseenter", () => setActive(i, false));
    opt.addEventListener("click", () => executeCommand(r.cmd));

    listEl.appendChild(opt);
  });

  setActive(Math.min(activeIndex, results.length - 1), true);
}

/* -----------------------------------------------------------
     The core interaction insight of this whole demo:

     Arrow keys move a *virtual* selection — aria-activedescendant
     on the input — instead of moving real DOM focus to each row.
     Focus never leaves the text input, so typing keeps working
     mid-navigation, screen readers announce the active option
     correctly, and we still fully control the highlighted state.
  ----------------------------------------------------------- */
function setActive(index, scroll) {
  activeIndex = index;
  const opts = listEl.querySelectorAll('[role="option"]');
  opts.forEach((el, i) =>
    el.setAttribute("aria-selected", i === index ? "true" : "false"),
  );
  const activeEl = opts[index];
  if (activeEl) {
    input.setAttribute("aria-activedescendant", activeEl.id);
    if (scroll) activeEl.scrollIntoView({ block: "nearest" });
  }
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

function openPalette() {
  if (isOpen) return;
  isOpen = true;
  triggerEl = document.activeElement; // remember exactly what to restore focus to
  backdrop.classList.add("open");
  input.value = "";
  activeIndex = 0;
  render("");
  // Real DOM focus goes to the input, and stays there for the
  // entire session — this is the only element that ever receives it.
  input.focus();
}

function closePalette() {
  if (!isOpen) return;
  isOpen = false;
  backdrop.classList.remove("open");
  if (triggerEl && typeof triggerEl.focus === "function") {
    triggerEl.focus(); // restore focus to wherever the user was before opening
  }
}

function executeCommand(cmd) {
  closePalette();
  showToast(`Executed “${cmd.label}”`);
}

let toastTimer = null;
function showToast(msg) {
  toastText.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------------- Event wiring ---------------- */

trigger.addEventListener("click", openPalette);

backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closePalette();
});

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "k") {
    e.preventDefault();
    isOpen ? closePalette() : openPalette();
  }
});

input.addEventListener("input", () => {
  activeIndex = 0;
  render(input.value);
});

input.addEventListener("keydown", (e) => {
  if (!results.length && e.key !== "Escape" && e.key !== "Tab") return;

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      setActive((activeIndex + 1) % results.length, true);
      break;
    case "ArrowUp":
      e.preventDefault();
      setActive((activeIndex - 1 + results.length) % results.length, true);
      break;
    case "Enter":
      e.preventDefault();
      if (results[activeIndex]) executeCommand(results[activeIndex].cmd);
      break;
    case "Escape":
      e.preventDefault();
      closePalette();
      break;
    case "Tab":
      // Focus trap: the input is the only focusable element inside
      // the palette, so Tab has nowhere legitimate to go.
      e.preventDefault();
      break;
  }
});

/* -----------------------------------------------------------
     Harder variation: turn this into a *nested* palette — typing
     ">" drills into a submenu (e.g. "project > invite member"),
     with Backspace on an empty query popping back up a level and
     a breadcrumb replacing the placeholder. That adds a real
     navigation-stack state machine on top of the flat list here.

     Harder variation: add multi-select — Tab or Space toggles a
     checkmark on the active row instead of executing immediately,
     and Enter with 2+ selected rows shows a confirm step. That
     turns "select one" into "build a set, then commit."
  ----------------------------------------------------------- */
