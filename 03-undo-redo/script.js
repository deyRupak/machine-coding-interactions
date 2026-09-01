/* -----------------------------------------------------------
   Data
----------------------------------------------------------- */
let items = [
  {
    id: "1",
    sender: "Priya Patel",
    subject: "Q3 roadmap review",
    snippet: "Let's sync before Friday's planning session...",
  },
  {
    id: "2",
    sender: "Marcus Chen",
    subject: "Design system audit",
    snippet: "Found a few inconsistencies in the spacing scale...",
  },
  {
    id: "3",
    sender: "Billing",
    subject: "Invoice #4471",
    snippet: "Your payment has been processed successfully...",
  },
  {
    id: "4",
    sender: "HR",
    subject: "Welcome to the team!",
    snippet: "We're excited to have you join us this week...",
  },
  {
    id: "5",
    sender: "Product Updates",
    subject: "Weekly newsletter",
    snippet: "This week: dark mode, keyboard shortcuts, and...",
  },
  {
    id: "6",
    sender: "Sarah Kim",
    subject: "Re: Budget approval",
    snippet: "Approved — go ahead and move forward with...",
  },
  {
    id: "7",
    sender: "DevOps",
    subject: "Server migration notice",
    snippet: "Scheduled maintenance window this weekend...",
  },
  {
    id: "8",
    sender: "Alex Rivera",
    subject: "Coffee chat?",
    snippet: "Free Thursday afternoon to grab a coffee and...",
  },
  {
    id: "9",
    sender: "Legal",
    subject: "Contract renewal",
    snippet: "Please review the attached amendment before...",
  },
];

const UNDO_WINDOW_MS = 5000;

/* pending: id -> { item, nextId, timer, startedAt, toastEl, fillEl } */
const pending = new Map();
/* order pending deletes were made in, most-recent last — drives ⌘Z target */
const pendingOrder = [];

/* ---------------- DOM refs ---------------- */

const listEl = document.getElementById("inboxList");
const countEl = document.getElementById("itemCount");
const logEl = document.getElementById("log");
const logEmptyEl = document.getElementById("logEmpty");
const toastStack = document.getElementById("toastStack");

/* ---------------- Rendering: inbox ---------------- */

function renderList(enteringId) {
  countEl.textContent =
    items.length + (items.length === 1 ? " message" : " messages");

  if (!items.length) {
    listEl.innerHTML = `<div class="inbox-empty">Inbox is empty.</div>`;
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
      <div class="inbox-item ${item.id === enteringId ? "entering" : ""}" data-id="${item.id}">
        <span class="avatar">${escapeHtml(item.sender[0])}</span>
        <span class="item-body">
          <span class="item-top">
            <span class="item-sender">${escapeHtml(item.sender)}</span>
            <span class="item-time">now</span>
          </span>
          <span class="item-subject">${escapeHtml(item.subject)}</span>
          <span class="item-snippet">${escapeHtml(item.snippet)}</span>
        </span>
        <button class="delete-btn" data-id="${item.id}" aria-label="Delete ${escapeHtml(item.subject)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>`,
    )
    .join("");

  listEl.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(btn.dataset.id));
  });
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

/* -----------------------------------------------------------
   Delete = optimistic UI removal now, real commit later.

   The item leaves `items` (and the DOM) immediately so the UI
   feels instant. The actual "gone for good" moment is a timer
   firing UNDO_WINDOW_MS later — until then it's fully
   recoverable via the toast or ⌘Z.
----------------------------------------------------------- */
function deleteItem(id) {
  const index = items.findIndex((i) => i.id === id);
  if (index === -1) return;

  // Anchor to the *next remaining item's id*, not a numeric index.
  // A raw index breaks the moment a second delete happens before
  // the first is resolved — the list has shifted underneath it.
  const nextId = items[index + 1]?.id ?? null;
  const [item] = items.splice(index, 1);

  const row = document.querySelector(`.inbox-item[data-id="${id}"]`);
  if (row) {
    row.classList.add("removing");
    row.addEventListener("animationend", () => renderList(), { once: true });
  } else {
    renderList();
  }

  const logRow = addLogRow(item.subject);
  const toastEl = addToast(item, id);

  const timer = setTimeout(() => commitDelete(id), UNDO_WINDOW_MS);

  pending.set(id, { item, nextId, timer, logRow, toastEl });
  pendingOrder.push(id);
}

/* Real removal is a no-op on `items` (already spliced out) — it
   just closes the books: clear pending state, mark the log/toast
   as permanently committed. */
function commitDelete(id) {
  const entry = pending.get(id);
  if (!entry) return;
  setLogStatus(entry.logRow, "committed");
  removeToast(entry.toastEl);
  pending.delete(id);
  removeFromPendingOrder(id);
}

/* Undo = cancel the pending timer and splice the item back in
   next to where it actually was — anchored to `nextId`, so it's
   correct even if other deletes/restores happened in between. */
function undoDelete(id) {
  const entry = pending.get(id);
  if (!entry) return;

  clearTimeout(entry.timer);

  let insertAt = items.length;
  if (entry.nextId) {
    const idx = items.findIndex((i) => i.id === entry.nextId);
    if (idx !== -1) insertAt = idx;
  }
  items.splice(insertAt, 0, entry.item);

  setLogStatus(entry.logRow, "restored");
  removeToast(entry.toastEl);
  pending.delete(id);
  removeFromPendingOrder(id);
  renderList(id);
}

function removeFromPendingOrder(id) {
  const i = pendingOrder.indexOf(id);
  if (i !== -1) pendingOrder.splice(i, 1);
}

/* ---------------- Keyboard: ⌘Z / Ctrl+Z undoes the most recent pending delete ---------------- */

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "z") {
    if (!pendingOrder.length) return;
    e.preventDefault();
    undoDelete(pendingOrder[pendingOrder.length - 1]);
  }
});

/* ---------------- Rendering: activity log ---------------- */

function addLogRow(subject) {
  logEmptyEl.style.display = "none";
  const row = document.createElement("div");
  row.className = "log-row";
  row.innerHTML = `
    <span class="log-label">"${escapeHtml(subject)}"</span>
    <span class="status-badge pending"><span class="pulse-dot"></span>pending</span>
  `;
  logEl.appendChild(row);
  return row;
}

function setLogStatus(row, status) {
  const badge = row.querySelector(".status-badge");
  badge.className = "status-badge " + status;
  badge.textContent = status === "committed" ? "deleted" : "restored";
}

/* ---------------- Rendering: toasts ---------------- */

function addToast(item, id) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <div class="toast-row">
      <span class="toast-text">Deleted "${escapeHtml(item.subject)}"</span>
      <button class="toast-undo">Undo</button>
    </div>
    <div class="toast-progress-track"><div class="toast-progress-fill"></div></div>
  `;
  toastStack.appendChild(toast);

  const fill = toast.querySelector(".toast-progress-fill");
  // Kick off the drain animation on the next frame so the browser
  // registers the starting state (100% width) before transitioning.
  requestAnimationFrame(() => {
    fill.style.transition = `transform ${UNDO_WINDOW_MS}ms linear`;
    fill.style.transform = "scaleX(0)";
  });

  toast
    .querySelector(".toast-undo")
    .addEventListener("click", () => undoDelete(id));

  return toast;
}

function removeToast(toastEl) {
  if (!toastEl || !toastEl.isConnected) return;
  toastEl.classList.add("leaving");
  toastEl.addEventListener("animationend", () => toastEl.remove(), {
    once: true,
  });
}

/* ---------------- Init ---------------- */

renderList();

/* -----------------------------------------------------------
   Harder variation: this only undoes deletes. A full undo/redo
   stack would track every mutation type (edit, reorder, delete)
   as entries in a single history array with a pointer, so
   ⌘Z / ⌘⇧Z walk backward and forward through it — redo re-applies
   an entry the same way undo reverses it, instead of being a
   separate code path.

   Harder variation: what happens if the real backend commit
   (which this demo simulates as a no-op timer) can fail? The
   undo window closes, the client considers it "deleted", and
   *then* the server rejects it — the UI now needs to reconcile
   an item that's supposedly gone but isn't, likely by
   re-inserting it with an error toast rather than pretending
   the delete succeeded.

   Harder variation: batch delete — select multiple items, one
   delete action, one toast, one Undo restores the whole group.
   Requires tracking a pending *group* (ids + their individual
   anchors) instead of a single id per timer.
----------------------------------------------------------- */
