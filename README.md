# Machine Coding Interactions

Tiny, standalone frontend demos built around one advanced interaction each: drag & drop, command palettes, virtualization, optimistic UI, and the like. Written for people prepping for frontend machine-coding rounds, or anyone who wants to see how these interactions actually work under the hood.

Every entry is:
- **Vanilla HTML/CSS/JS** — no framework, no build step, no dependencies to install
- **One folder, fully self-contained** — clone it or just open `index.html`
- **Live on GitHub Pages** — click through and try it before reading any code
- **Documented** — each folder's `README.md` explains the underlying engineering problem, the specific decisions made, and harder interview variations to try yourself

The goal isn't a full app. It's isolating the one part of each interaction that's actually hard, and making that part obvious.

## Interactions

| # | Interaction | The hard part isn't X — it's Y | Demo | Code |
|---|---|---|---|---|
| 01 | Command Palette | Filtering the list — it's keyboard semantics: `aria-activedescendant`, scroll-into-view, and focus restoration | [Live](https://deyrupak.github.io/machine-coding-interactions/01-command-palette/) | [Folder](./01-command-palette) |
| 02 | Typeahead | Debouncing — it's cancelling in-flight requests and guarding against out-of-order responses | [Live](https://deyrupak.github.io/machine-coding-interactions/02-typeahead/) | [Folder](./02-typeahead) |
| 03 | Undo/Redo (Optimistic Delete) | The "Undo" toast — it's delaying the real mutation until the undo window closes | [Live](https://deyrupak.github.io/machine-coding-interactions/03-undo-redo/) | [Folder](./03-undo-redo) |
| 04 | Virtualized List | Rendering fewer DOM nodes — it's keeping scroll position, scrollbar size, and jump-to-row math correct with variable row heights | [Live](https://deyrupak.github.io/machine-coding-interactions/04-virtualized-list/) | [Folder](./04-virtualized-list) |
| 05 | Combobox | Filtering — it's keeping "previewing" and "committed" as genuinely different states | [Live](https://deyrupak.github.io/machine-coding-interactions/05-combobox/) | [Folder](./05-combobox) |
| 06 | Resizable Panels | `mousemove` — it's `setPointerCapture`, and clamping to min/max without disturbing the panel you're not touching | [Live](https://deyrupak.github.io/machine-coding-interactions/06-resizable-panels/) | [Folder](./06-resizable-panels) |

More entries land here as they're built: drag & drop, typeahead with request cancellation, undo/redo, resizable panels, virtualized lists, and more from the same series.

## Running any demo locally

No build step needed. Either open a folder's `index.html` directly in a browser, or serve it:

```
npx serve 01-command-palette
```

## Follow along

New interactions are posted as **Machine Coding Interaction #NN** on [X](https://x.com/webcrumbs_), with a short writeup and a code snippet for each one.