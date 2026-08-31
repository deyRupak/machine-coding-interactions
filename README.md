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

More entries land here as they're built: drag & drop, typeahead with request cancellation, undo/redo, resizable panels, virtualized lists, and more from the same series.

## Running any demo locally

No build step needed. Either open a folder's `index.html` directly in a browser, or serve it:

```
npx serve 01-command-palette
```

## Follow along

New interactions are posted as **Machine Coding Interaction #NN** on [X](https://x.com/webcrumbs_), with a short writeup and a code snippet for each one.