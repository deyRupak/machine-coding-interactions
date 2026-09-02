/* -----------------------------------------------------------
   Data: 10,000 log rows with variable heights. ~15% are
   "expanded" entries with extra detail lines (like a stack
   trace) — their exact height depends on how many extra lines
   they got, which is randomized per row and NOT knowable just
   from the row's type. That's what makes uniform-row-height
   virtualization insufficient here.
----------------------------------------------------------- */
const ROW_COUNT = 10000;
const OVERSCAN = 6;
const ESTIMATE_COMPACT = 44;
const ESTIMATE_EXPANDED = 96; // a guess — actual expanded rows vary above/below this

const SEVERITIES = ["INFO", "INFO", "INFO", "DEBUG", "WARN", "ERROR"];
const MESSAGES = [
  "Request completed successfully",
  "Cache miss, falling back to origin",
  "Connection pool exhausted, queuing request",
  "Retrying after transient failure",
  "Rate limit threshold reached for client",
  "Scheduled job started",
  "Scheduled job finished",
  "Configuration reloaded from disk",
  "Session token refreshed",
  "Slow query detected",
  "Background sync completed",
  "Webhook delivered",
  "Webhook delivery failed, will retry",
  "Memory usage above threshold",
  "New connection accepted",
];
const STACK_LINES = [
  "at Object.handleRequest (/app/src/server.js:142:19)",
  "at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
  "at Layer.handle (/app/node_modules/router/lib/layer.js:95:5)",
  "at async Promise.all (index 3)",
  "at Connection.query (/app/src/db/connection.js:58:12)",
  "at Timeout._onTimeout (/app/src/jobs/scheduler.js:33:7)",
];

function generateRows() {
  const rows = new Array(ROW_COUNT);
  const base = Date.now() - ROW_COUNT * 4000;
  for (let i = 0; i < ROW_COUNT; i++) {
    const isExpanded = Math.random() < 0.15;
    const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
    const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    let extraLines = null;
    if (isExpanded) {
      const n = 2 + Math.floor(Math.random() * 3); // 2–4 lines
      extraLines = Array.from(
        { length: n },
        () => STACK_LINES[Math.floor(Math.random() * STACK_LINES.length)],
      );
    }
    rows[i] = {
      id: i,
      time: new Date(base + i * 4000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19),
      severity,
      message,
      extraLines,
    };
  }
  return rows;
}

const rows = generateRows();

/* -----------------------------------------------------------
   Fenwick tree (binary indexed tree): O(log n) update and
   prefix-sum query over row heights. This is what makes
   "which row is at scroll offset X" and "what's the total
   scrollable height" both fast even as individual row heights
   get corrected one at a time during scrolling — no O(n) walk
   over all 10,000 rows on every scroll event.
----------------------------------------------------------- */
class FenwickTree {
  constructor(n) {
    this.n = n;
    this.tree = new Float64Array(n + 1);
  }
  update(i, delta) {
    for (let x = i + 1; x <= this.n; x += x & -x) this.tree[x] += delta;
  }
  prefixSum(i) {
    // sum of heights of rows [0, i)
    let sum = 0;
    for (let x = i; x > 0; x -= x & -x) sum += this.tree[x];
    return sum;
  }
  totalSum() {
    return this.prefixSum(this.n);
  }
  // Returns the row index whose span contains offset `target`.
  findIndex(target) {
    let idx = 0;
    let bitMask = 1;
    while (bitMask * 2 <= this.n) bitMask *= 2;
    for (; bitMask > 0; bitMask >>= 1) {
      const next = idx + bitMask;
      if (next <= this.n && this.tree[next] <= target) {
        idx = next;
        target -= this.tree[next];
      }
    }
    return idx;
  }
}

const fenwick = new FenwickTree(ROW_COUNT);
const storedHeights = new Float64Array(ROW_COUNT);
const measured = new Uint8Array(ROW_COUNT);

for (let i = 0; i < ROW_COUNT; i++) {
  const est = rows[i].extraLines ? ESTIMATE_EXPANDED : ESTIMATE_COMPACT;
  storedHeights[i] = est;
  fenwick.update(i, est);
}

function updateHeight(i, newHeight) {
  const delta = newHeight - storedHeights[i];
  if (Math.abs(delta) > 0.5) {
    fenwick.update(i, delta);
    storedHeights[i] = newHeight;
  }
}

/* ---------------- DOM refs ---------------- */

const viewport = document.getElementById("viewport");
const spacer = document.getElementById("spacer");
const statNodes = document.getElementById("statNodes");
const statTime = document.getElementById("statTime");
const toggle = document.getElementById("virtToggle");
const toggleState = document.getElementById("virtState");
const jumpInput = document.getElementById("jumpInput");
const jumpBtn = document.getElementById("jumpBtn");

let virtualized = true;
let rafScheduled = false;
let highlightId = null;

/* ---------------- Row markup ---------------- */

function rowHTML(row) {
  const extra = row.extraLines
    ? `<div class="row-extra">${row.extraLines.map((l) => `<div>${escapeHtml(l)}</div>`).join("")}</div>`
    : "";
  return `
    <span class="severity ${row.severity}">${row.severity}</span>
    <span class="row-body">
      <span class="row-top">
        <span class="row-time">${row.time}</span>
        <span class="row-message">${escapeHtml(row.message)}</span>
      </span>
      ${extra}
    </span>
  `;
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
   Virtualized render: figure out the visible index range from
   scrollTop via the Fenwick tree, render just that (+overscan)
   slice as absolutely-positioned rows, then measure what was
   actually rendered and correct any rows whose real height
   didn't match the estimate used to position them.
----------------------------------------------------------- */
function renderVirtualized() {
  const t0 = performance.now();

  const scrollTop = viewport.scrollTop;
  const viewportHeight = viewport.clientHeight;

  spacer.style.height = fenwick.totalSum() + "px";

  let start = Math.max(0, fenwick.findIndex(scrollTop) - OVERSCAN);
  let end = Math.min(
    ROW_COUNT - 1,
    fenwick.findIndex(scrollTop + viewportHeight) + OVERSCAN,
  );

  paintRange(start, end);
  const changed = measureRange(start, end);

  // Heights may have shifted after measuring — reposition once more.
  // Already-measured rows are skipped this pass, so this terminates.
  if (changed) {
    spacer.style.height = fenwick.totalSum() + "px";
    start = Math.max(0, fenwick.findIndex(viewport.scrollTop) - OVERSCAN);
    end = Math.min(
      ROW_COUNT - 1,
      fenwick.findIndex(viewport.scrollTop + viewportHeight) + OVERSCAN,
    );
    paintRange(start, end);
  }

  const t1 = performance.now();
  statNodes.textContent = (end - start + 1).toLocaleString();
  statTime.textContent = (t1 - t0).toFixed(1) + "ms";
}

function paintRange(start, end) {
  const html = [];
  for (let i = start; i <= end; i++) {
    const top = fenwick.prefixSum(i);
    const highlightClass = rows[i].id === highlightId ? " jump-highlight" : "";
    html.push(
      `<div class="log-row${highlightClass}" data-i="${i}" style="transform:translateY(${top}px)">${rowHTML(rows[i])}</div>`,
    );
  }
  spacer.innerHTML = html.join("");
  if (highlightId !== null) highlightId = null; // one-shot flash
}

function measureRange(start, end) {
  let changed = false;
  const els = spacer.querySelectorAll(".log-row");
  els.forEach((el) => {
    const i = Number(el.dataset.i);
    if (measured[i]) return;
    const actual = el.getBoundingClientRect().height;
    if (Math.abs(actual - storedHeights[i]) > 0.5) {
      updateHeight(i, actual);
      changed = true;
    }
    measured[i] = 1;
  });
  return changed;
}

function scheduleRender() {
  if (rafScheduled) return;
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    if (virtualized) renderVirtualized();
  });
}

/* -----------------------------------------------------------
   Naive render: every row, all at once, in normal document
   flow. No measurement, no positioning math — and no ability
   to only pay for what's on screen. This is the comparison
   case: watch statTime and try scrolling.
----------------------------------------------------------- */
function renderNaive() {
  const t0 = performance.now();
  const html = rows
    .map((row) => `<div class="log-row static-flow">${rowHTML(row)}</div>`)
    .join("");
  spacer.style.height = "auto";
  spacer.innerHTML = html;
  const t1 = performance.now();
  statNodes.textContent = ROW_COUNT.toLocaleString();
  statTime.textContent = (t1 - t0).toFixed(1) + "ms";
}

/* ---------------- Mode toggle ---------------- */

toggle.addEventListener("click", () => {
  virtualized = !virtualized;
  toggle.setAttribute("aria-checked", String(virtualized));
  toggleState.textContent = virtualized
    ? "ON — only rows near the viewport exist in the DOM"
    : "OFF — all 10,000 rows are rendered at once";
  viewport.scrollTop = 0;
  if (virtualized) {
    renderVirtualized();
  } else {
    renderNaive();
  }
});

viewport.addEventListener("scroll", () => {
  if (virtualized) scheduleRender();
});

/* ---------------- Jump to row ---------------- */

jumpBtn.addEventListener("click", jumpToRow);
jumpInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") jumpToRow();
});

function jumpToRow() {
  const n = Number(jumpInput.value);
  if (!Number.isFinite(n) || n < 1 || n > ROW_COUNT) return;
  const index = n - 1;

  if (!virtualized) {
    // Switch back to virtualized mode to make "jump" meaningful —
    // scrolling to an arbitrary row in a 10,000-node naive list
    // is just native scroll, nothing interesting to demonstrate.
    virtualized = true;
    toggle.setAttribute("aria-checked", "true");
    toggleState.textContent =
      "ON — only rows near the viewport exist in the DOM";
  }

  highlightId = rows[index].id;
  // Position is an estimate for any not-yet-measured rows between
  // here and wherever we scrolled from — it self-corrects on the
  // very next render once those rows are actually measured.
  viewport.scrollTop = fenwick.prefixSum(index);
  renderVirtualized();
}

/* ---------------- Init ---------------- */

renderVirtualized();

/* -----------------------------------------------------------
   Harder variation: bidirectional infinite loading. Prepending
   rows above the current scroll position (e.g. "load older
   logs") must NOT visually shift whatever's currently on
   screen — that means adjusting scrollTop by exactly the
   height of what got inserted above it, in the same frame,
   before the browser paints.

   Harder variation: grid virtualization — virtualize both axes
   for a spreadsheet-like view, so a viewport only ever holds
   visible_rows × visible_columns cells, not the full row or
   column.

   Harder variation: sticky group headers (e.g. "Today",
   "Yesterday") that stay pinned to the top of the viewport
   while their section scrolls past, and get swapped out as
   virtualized rows carrying the next header enter view.

   Note: this demo re-renders the visible slice's HTML on every
   scroll frame for clarity. Production virtualization libraries
   (react-window, TanStack Virtual, etc.) pool and reuse actual
   DOM nodes instead of recreating them, avoiding repeated
   layout/style recalculation — a meaningful optimization on top
   of everything here.
----------------------------------------------------------- */
