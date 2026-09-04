/* -----------------------------------------------------------
   Layout model: Files and Inspector have explicit pixel widths
   (flex-basis). Editor is flex: 1 1 auto and simply absorbs
   whatever space is left — which is what guarantees that
   dragging one divider never touches the panel on the far side
   of it. There's no "redistribute across all panels" logic to
   get wrong, because only one panel is ever flexible.
----------------------------------------------------------- */
const DIVIDER_WIDTH = 9; // px — must match .divider's flex-basis in CSS
const EDITOR_MIN = 280; // the flexible panel still needs a floor

const FILES = { min: 160, max: 320, default: 220 };
const INSPECTOR = { min: 200, max: 420, default: 280 };

let filesWidth = FILES.default;
let inspectorWidth = INSPECTOR.default;

/* ---------------- DOM refs ---------------- */

const shell = document.getElementById("shell");
const filesPanel = document.getElementById("filesPanel");
const inspectorPanel = document.getElementById("inspectorPanel");
const dividerFiles = document.getElementById("dividerFiles");
const dividerInspector = document.getElementById("dividerInspector");
const filesReadout = document.getElementById("filesWidthReadout");
const editorReadout = document.getElementById("editorWidthReadout");
const inspectorReadout = document.getElementById("inspectorWidthReadout");
const dragBadge = document.getElementById("dragBadge");

function shellWidth() {
  return shell.getBoundingClientRect().width;
}

/* -----------------------------------------------------------
   Clamping isn't just "stay within this panel's own min/max" —
   it also can't let the *editor* get squeezed below its own
   floor. That upper bound depends on the current container
   width and the other fixed panel's current width, so it's
   recomputed on every drag frame rather than being a static
   constant.
----------------------------------------------------------- */
function clampFiles(candidate) {
  const editorCeiling =
    shellWidth() - inspectorWidth - DIVIDER_WIDTH * 2 - EDITOR_MIN;
  const upper = Math.min(FILES.max, editorCeiling);
  return Math.round(Math.max(FILES.min, Math.min(upper, candidate)));
}

function clampInspector(candidate) {
  const editorCeiling =
    shellWidth() - filesWidth - DIVIDER_WIDTH * 2 - EDITOR_MIN;
  const upper = Math.min(INSPECTOR.max, editorCeiling);
  return Math.round(Math.max(INSPECTOR.min, Math.min(upper, candidate)));
}

function applyWidths() {
  filesPanel.style.flexBasis = filesWidth + "px";
  inspectorPanel.style.flexBasis = inspectorWidth + "px";

  const editorWidth = Math.round(
    shellWidth() - filesWidth - inspectorWidth - DIVIDER_WIDTH * 2,
  );

  filesReadout.textContent = filesWidth + "px";
  inspectorReadout.textContent = inspectorWidth + "px";
  editorReadout.textContent = editorWidth + "px";

  dividerFiles.setAttribute("aria-valuenow", filesWidth);
  dividerFiles.setAttribute("aria-valuemin", FILES.min);
  dividerFiles.setAttribute("aria-valuemax", FILES.max);
  dividerFiles.setAttribute("aria-valuetext", filesWidth + " pixels");

  dividerInspector.setAttribute("aria-valuenow", inspectorWidth);
  dividerInspector.setAttribute("aria-valuemin", INSPECTOR.min);
  dividerInspector.setAttribute("aria-valuemax", INSPECTOR.max);
  dividerInspector.setAttribute("aria-valuetext", inspectorWidth + " pixels");
}

/* -----------------------------------------------------------
   Generic drag wiring for one divider. `dirSign` accounts for
   the fact that dragging right GROWS Files (it's on the left,
   anchored to the left edge) but SHRINKS Inspector (it's on
   the right, anchored to the right edge) — same pointer delta,
   opposite effect on width.
----------------------------------------------------------- */
function wireDivider(divider, { getWidth, setWidth, clamp, dirSign, config }) {
  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  divider.addEventListener("pointerdown", (e) => {
    dragging = true;
    divider.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startWidth = getWidth();
    divider.classList.add("active");
    document.body.classList.add("resizing");
    showBadge(e, startWidth);
  });

  divider.addEventListener("pointermove", (e) => {
    if (!dragging || !divider.hasPointerCapture(e.pointerId)) return;
    const delta = (e.clientX - startX) * dirSign;
    const next = clamp(startWidth + delta);
    setWidth(next);
    applyWidths();
    showBadge(e, next);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    divider.releasePointerCapture(e.pointerId);
    divider.classList.remove("active");
    document.body.classList.remove("resizing");
    hideBadge();
  }
  divider.addEventListener("pointerup", endDrag);
  divider.addEventListener("pointercancel", endDrag);

  divider.addEventListener("dblclick", () => {
    setWidth(clamp(config.default));
    applyWidths();
  });

  divider.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 24 : 12;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth(clamp(getWidth() - step * dirSign));
      applyWidths();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(clamp(getWidth() + step * dirSign));
      applyWidths();
    } else if (e.key === "Home") {
      e.preventDefault();
      setWidth(clamp(dirSign > 0 ? config.min : config.max));
      applyWidths();
    } else if (e.key === "End") {
      e.preventDefault();
      setWidth(clamp(dirSign > 0 ? config.max : config.min));
      applyWidths();
    }
  });
}

function showBadge(e, value) {
  dragBadge.hidden = false;
  dragBadge.textContent = value + "px";
  dragBadge.style.left = e.clientX + "px";
  dragBadge.style.top = e.clientY + "px";
}
function hideBadge() {
  dragBadge.hidden = true;
}

wireDivider(dividerFiles, {
  getWidth: () => filesWidth,
  setWidth: (v) => (filesWidth = v),
  clamp: clampFiles,
  dirSign: 1, // drag right → Files grows
  config: FILES,
});

wireDivider(dividerInspector, {
  getWidth: () => inspectorWidth,
  setWidth: (v) => (inspectorWidth = v),
  clamp: clampInspector,
  dirSign: -1, // drag right → Inspector shrinks (anchored to the right edge)
  config: INSPECTOR,
});

/* Re-clamp on window resize so a shrinking viewport can't leave
   the editor panel squeezed below its own minimum. */
window.addEventListener("resize", () => {
  filesWidth = clampFiles(filesWidth);
  inspectorWidth = clampInspector(inspectorWidth);
  applyWidths();
});

applyWidths();

/* -----------------------------------------------------------
   Harder variation: persist panel sizes across reloads
   (localStorage), restoring them before first paint to avoid a
   layout flash.

   Harder variation: nested splits — e.g. the Editor panel
   itself split vertically into Code/Console. Each level of
   nesting needs its own independent min/max clamping against
   its own flexible sibling, the same way this demo's outer
   shell does against Editor.

   Harder variation: a collapse threshold — dragging a panel
   below some fraction of its own min snaps it fully closed
   (width 0, hidden) instead of clamping at min, the way VS
   Code's sidebar collapses when dragged far enough past its
   floor.
----------------------------------------------------------- */
