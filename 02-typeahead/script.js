/* -----------------------------------------------------------
   Data. A static list stands in for a real search endpoint —
   see the "harder variation" notes at the bottom for what
   changes with a real, non-deterministic backend.
----------------------------------------------------------- */
const CATALOG = [
  "React",
  "Vue",
  "Svelte",
  "Angular",
  "SolidJS",
  "Qwik",
  "Preact",
  "Redux",
  "Zustand",
  "Recoil",
  "MobX",
  "Jotai",
  "XState",
  "Tailwind CSS",
  "Chakra UI",
  "Material UI",
  "Styled Components",
  "Radix UI",
  "Vite",
  "Webpack",
  "Rollup",
  "esbuild",
  "Turbopack",
  "Parcel",
  "Jest",
  "Vitest",
  "Playwright",
  "Cypress",
  "Testing Library",
  "Storybook",
  "Next.js",
  "Remix",
  "Astro",
  "SvelteKit",
  "Nuxt",
  "Qwik City",
  "TypeScript",
  "ESLint",
  "Prettier",
  "Biome",
];

/* -----------------------------------------------------------
   Simulated network call. Random latency (300–1800ms) and an
   occasional failure, so race conditions and errors both show
   up naturally during normal typing — no need to force them.
----------------------------------------------------------- */
function fakeSearch(query, signal) {
  return new Promise((resolve, reject) => {
    const latency = 300 + Math.random() * 1500;
    const timer = setTimeout(() => {
      if (Math.random() < 0.08) {
        reject(
          Object.assign(new Error("Network error"), { name: "SearchError" }),
        );
        return;
      }
      const results = CATALOG.filter((item) =>
        item.toLowerCase().includes(query.toLowerCase()),
      );
      resolve({ results, latency: Math.round(latency) });
    }, latency);

    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    });
  });
}

/* ---------------- DOM refs ---------------- */

const input = document.getElementById("searchInput");
const spinner = document.getElementById("spinner");
const resultsWrap = document.getElementById("resultsWrap");
const timeline = document.getElementById("timeline");
const timelineEmpty = document.getElementById("timelineEmpty");
const guardToggle = document.getElementById("guardToggle");
const guardState = document.getElementById("guardState");

let guardEnabled = true;
let requestId = 0;
let controller = null;
let debounceTimer = null;
let spinnerTimer = null;

/* ---------------- Guard toggle ---------------- */

guardToggle.addEventListener("click", () => {
  guardEnabled = !guardEnabled;
  guardToggle.setAttribute("aria-checked", String(guardEnabled));
  guardState.textContent = guardEnabled
    ? "ON — requests are cancelled and stale responses ignored"
    : "OFF — every response renders, even if it arrives out of order";
});

/* ---------------- Debounced input ---------------- */

input.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const query = input.value.trim();

  if (!query) {
    controller?.abort();
    showHint();
    return;
  }

  debounceTimer = setTimeout(() => runSearch(query), 250);
});

/* -----------------------------------------------------------
   The core interaction: a monotonically increasing request id
   guards against stale responses regardless of arrival order,
   and AbortController cancels the in-flight call outright so
   it doesn't do wasted work. Toggling `guardEnabled` off skips
   both — reproducing the exact bug this pattern prevents.
----------------------------------------------------------- */
async function runSearch(query) {
  const id = ++requestId;

  if (guardEnabled) controller?.abort();
  controller = new AbortController();

  const row = addTimelineRow(query);
  clearTimeout(spinnerTimer);
  spinnerTimer = setTimeout(() => (spinner.hidden = false), 150);

  try {
    const { results, latency } = await fakeSearch(query, controller.signal);

    if (guardEnabled && id !== requestId) {
      setRowStatus(row, "stale", latency);
      return; // a newer request already started — ignore this one
    }

    setRowStatus(row, "resolved", latency);
    clearTimeout(spinnerTimer);
    spinner.hidden = true;
    renderResults(results, query);
  } catch (err) {
    if (err.name === "AbortError") {
      setRowStatus(row, "cancelled");
      return;
    }
    setRowStatus(row, "error");
    if (id === requestId) {
      clearTimeout(spinnerTimer);
      spinner.hidden = true;
      renderError(query);
    }
  }
}

/* ---------------- Rendering: results panel ---------------- */

function showHint() {
  clearTimeout(spinnerTimer);
  spinner.hidden = true;
  resultsWrap.innerHTML = `<div class="hint-state">Results simulate a real network — 300–1800ms latency per request, occasionally out of order.</div>`;
}

function renderResults(results, query) {
  if (!results.length) {
    resultsWrap.innerHTML = `<div class="empty-state">No tools match "${escapeHtml(query)}"</div>`;
    return;
  }
  resultsWrap.innerHTML = results
    .map(
      (name) => `
      <div class="result-item">
        <span class="result-icon">${escapeHtml(name[0])}</span>
        <span class="result-body">
          <span class="result-label">${escapeHtml(name)}</span>
        </span>
      </div>`,
    )
    .join("");
}

function renderError(query) {
  resultsWrap.innerHTML = `
    <div class="error-state">
      Search failed for "${escapeHtml(query)}".
      <div><button class="retry-btn" id="retryBtn">Try again</button></div>
    </div>`;
  document
    .getElementById("retryBtn")
    ?.addEventListener("click", () => runSearch(query));
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

/* ---------------- Rendering: timeline panel ---------------- */

function addTimelineRow(query) {
  timelineEmpty.style.display = "none";
  const row = document.createElement("div");
  row.className = "timeline-row";
  row.innerHTML = `
    <span class="timeline-query">"${escapeHtml(query)}"</span>
    <span class="timeline-latency"></span>
    <span class="status-badge pending"><span class="pulse-dot"></span>sent</span>
  `;
  timeline.appendChild(row);
  return row;
}

function setRowStatus(row, status, latency) {
  const badge = row.querySelector(".status-badge");
  const latencyEl = row.querySelector(".timeline-latency");
  if (latency) latencyEl.textContent = latency + "ms";

  badge.className = "status-badge " + status;
  const labels = {
    resolved: "resolved",
    stale: "ignored — stale",
    cancelled: "cancelled",
    error: "failed",
  };
  badge.textContent = labels[status] || status;
}

/* -----------------------------------------------------------
   Harder variation: this demo's "network" is a local Promise,
   so cancellation is purely cooperative — clearTimeout stands
   in for aborting a real fetch. With an actual API, pass the
   same AbortController's signal into fetch() (`{ signal }`)
   so the browser tears down the in-flight HTTP request too,
   not just the local bookkeeping.

   Harder variation: cache-and-revalidate — on a repeated query,
   render the last cached results for it instantly (stale-but-
   fast), then replace them if a fresh response for that exact
   query resolves. This trades correctness-during-flight for
   perceived speed, and needs its own invalidation story.

   Harder variation: in a real component (React, etc.), the
   AbortController must also be aborted in a cleanup function
   (e.g. useEffect's return, or onDisconnect) — otherwise a
   component that unmounts mid-request can still try to update
   state that no longer exists.
----------------------------------------------------------- */
