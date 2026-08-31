# Machine Coding Interaction #01 — Command Palette

**[Live demo](https://deyRupak.github.io/machine-coding-interactions/01-command-palette/)** · Standalone HTML/CSS/JS, no build step, no dependencies.

---

> Machine Coding Interaction #01
>
> Build a command palette where arrow keys move selection — but focus never leaves the input.
>
> The hard part isn't filtering the list.
>
> It's keyboard semantics: `aria-activedescendant`, scroll-into-view, and focus restoration on close.
>
> ```js
> function setActive(index) {
>   const opt = options[index];
>   input.setAttribute('aria-activedescendant', opt.id);
>   opt.scrollIntoView({ block: 'nearest' });
>   // focus never moves — the input keeps real DOM focus
> }
> ```
>
> Filtering is a one-liner. Getting the interaction model right is the actual interview question.

---

## The problem

A command palette *looks* like a filtered list with a text box on top. That's the version most tutorials build, and it's also the version that breaks the moment you try to use it with a keyboard: either arrow keys move real DOM focus (so typing stops working the instant you press ↓), or there's no concept of a "current" item at all and Enter does nothing predictable.

The actual interaction has three problems layered on top of each other:

1. **Where does focus live?** It has to stay on the text input for the entire session — that's the only way typing and navigating can happen in the same keystroke stream.
2. **How do you represent "selected" without focus?** You need a virtual cursor: an `aria-activedescendant` pointer plus a visual highlight, kept in sync manually.
3. **What happens when you close it?** Focus has to go back to *exactly* where it was — the button, a link, wherever — or every use of the palette quietly breaks the page's tab order.

None of this shows up in a five-minute demo. It shows up the first time someone tries to drive the thing with a keyboard for ten seconds.

## Engineering decisions

**`aria-activedescendant` over roving `tabindex`.** Roving tabindex (moving real focus between list items) is the more common pattern for things like toolbars, but it's wrong here: it would kick focus out of the input on every arrow press. `aria-activedescendant` lets the input own focus permanently while `aria-selected` and a CSS class track which row is "active." This is also the technically correct ARIA pattern for a combobox with a listbox popup.

**`scrollIntoView({ block: 'nearest' })`, not `'center'` or `'start'`.** `nearest` only scrolls when the active row is actually out of view, and it scrolls the minimum distance to bring it back in — so navigating up and down doesn't cause the list to jump around under the cursor.

**Focus restoration via a captured reference, not `document.body.focus()` or a guess.** `openPalette()` grabs `document.activeElement` *before* moving focus into the input. On close, that's exactly what gets refocused — whether it was the trigger button, a link elsewhere on the page, or nothing at all.

**A trivial focus trap.** Because the input is the only focusable element inside the palette, "trapping" focus is just: intercept `Tab` and call `preventDefault()`. No focus-trap library, no walking the DOM for focusable elements — the constraint that there's only one focusable element makes the general-purpose solution unnecessary.

**Fuzzy match is a plain subsequence scorer.** Characters must appear in order (not necessarily adjacent), with bonus points for runs of consecutive matches and for matches that land on a word boundary. It's around 15 lines and no dependency — good enough for a client-side command list, though a large or async dataset would want a real library or server-side ranking (see the variation below).

**Empty-state vs. grouped-state are different render paths.** With no query, commands render grouped by category (`Navigation`, `Actions`, `Recent`) — the "browse" affordance. Once there's a query, groups disappear and results are a single ranked list — the "search" affordance. Trying to keep both behaviors in one code path made the sorting logic harder to follow than just branching on `query` being empty.

## Harder variations

These are called out as comments in the code too:

- **Async command sources + request cancellation.** Replace the static `COMMANDS` array with a real search endpoint. Now a slow response can resolve *after* a faster, more recent one and overwrite it with stale results — the same race condition that shows up in the Typeahead entry of this series, and it needs the same fix (an `AbortController` per keystroke, or a monotonically increasing request ID that gets checked before rendering).
- **Nested palettes.** Typing `>` (or selecting a command that represents a submenu) drills into a scoped list — e.g. `project > invite member` — with `Backspace` on an empty query popping back a level. This turns the flat list into a small navigation stack, which is its own state machine.
- **Multi-select with a confirm step.** `Tab` or `Space` toggles a checkmark on the active row instead of executing immediately; `Enter` with 2+ rows selected shows a confirmation instead of running each command straight away.

## Running locally

No build step. Clone the repo and open `index.html` directly in a browser, or serve the folder with anything static:

```
npx serve .
```