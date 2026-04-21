# The Atomic CodeMirror editor

This document describes the philosophy, architecture, and working theory of
Atomic's CodeMirror 6 editor — the editor that replaces Milkdown/ProseMirror
for atom editing, and that currently lives behind the `/editor-harness` route
while we iterate on it.

It is not an inventory of every function. It is the set of decisions you
need to hold in your head before you change anything, because the surface
area is small but each piece is load-bearing.

## Why CM6 at all

Milkdown (ProseMirror under the hood) gave us a polished WYSIWYG surface
but could not virtualize. ProseMirror's state model requires the entire
document tree to be present in memory and mounted as DOM on every render.
For atoms that run to hundreds of pages that is a non-starter — open time
grows linearly with document size, scrolling jitters under layout churn,
and memory pressure becomes real.

CodeMirror 6 virtualizes natively. It renders only the viewport, the
parser (`@lezer/markdown`) is incremental, and the whole system is built
around decorations that compose cleanly. The tradeoff is that CM6 is
a text editor at heart — "WYSIWYG" in CM6 means carefully choreographed
decorations layered over a raw text buffer, not a rich-content model
like ProseMirror's.

## The core invariant: raw markdown is the source of truth

**The document text in `state.doc` is always plain markdown.** Every
decoration is view-only. This is the single rule the whole design follows
from, and it is worth stating twice:

- What you see on screen may differ from the raw text (hidden syntax
  tokens, rendered bullet characters, checkbox widgets, etc.).
- What you copy, what gets saved, what another editor would parse is
  always the underlying markdown.

This invariant is why cross-block selection "just works" (the browser
selection maps to doc positions, and copy reads raw markdown from those
positions), why collaborative editing and diffing can be bolted on later
without rethinking the view layer, and why we can trust that what the
user sees matches what's persisted.

## The second invariant: no layout shifts

This was the lesson of Phase 1 — we briefly shipped a "block" preview
mode that replaced each block with a rendered HTML widget, and every
cursor move between blocks caused a height change as the clicked block
unfolded to raw and the leaving block refolded. Measured at ~0.1 CLS per
10 cursor moves in our Playwright probe; in practice it felt like the UI
was vibrating under the user.

The current mode ("inline live preview") avoids layout shifts by making
line heights depend **only on CSS class**, not on whether syntax tokens
are visible. A heading line styled `.cm-atomic-h1` is ~2em tall whether
the `# ` prefix is currently hidden or revealed. Active and inactive
states toggle token visibility via `Decoration.replace({})`, which removes
characters from flow without changing the enclosing line's measured
height.

Measured CLS for the same 10 cursor-moves test in inline mode: ~0.01,
and essentially all of it is the cursor caret redrawing — the structure
isn't shifting.

## The pieces

```
src/components/editor/AtomicCodeMirrorEditor.tsx   React shell
src/editor/codemirror/
    inline-preview.ts                              decoration engine
    atomic-theme.ts                                theme + highlighting
    code-languages.ts                              fenced-code grammars
src/styles/codemirror-inline-preview.css           rendered-block CSS
src/components/editor-harness/
    EditorHarnessPage.tsx                          isolated dev route
    sample-content.ts                              deterministic fixtures
scripts/test-editor-harness.mjs                    Playwright probes
```

### `AtomicCodeMirrorEditor`

A thin React wrapper. Creates one `EditorView`, destroys it on unmount,
forwards a `markdownSource` prop and an `onMarkdownChange` callback.
Intentionally minimal — no handle ref, no external source sync, no
search panel wiring. Those will come when we integrate into
`AtomReader`; adding them now would make iterating on the editor's core
feel harder for no gain.

Document identity (`documentId ?? markdownSource`) is the key — when
it changes we fully unmount the view, so cursor and undo state from a
previous atom can't bleed into the next one.

### `inline-preview.ts` — the decoration engine

This is where everything interesting happens. Three pieces, each with
a specific reason to exist.

1. **`previewFrozenField`** — a boolean `StateField` tracking whether
   decoration rebuilds are paused. Toggled via a `setFrozen` effect
   from the freeze plugin.

2. **`freezeMousePlugin`** — a `ViewPlugin` with a capture-phase
   `pointerdown` listener on `view.dom` and a `pointerup` listener
   on `window`. On pointerdown inside the content DOM, it dispatches
   `setFrozen(true)`. On pointerup, after a ~100ms tail, it dispatches
   `setFrozen(false)`.

   The freeze exists because clicking a heading used to reveal its
   `# ` prefix immediately — which shifted the heading text rightward
   under the user's cursor mid-click, sometimes promoting the click
   into a micro-drag selection. Now the reveal waits until the click
   has fully resolved.

   The capture-phase listener matters: `@codemirror/lang-markdown`'s
   own pointerdown handler runs bubble-phase and dispatches selection
   changes. Without capture, CM6 can rebuild decorations before we
   freeze, and the reveal fires anyway. The content-DOM filter matters
   too: without it, a scrollbar drag engages the freeze and stops
   decoration rebuilds for the whole drag — deep content stays raw
   until mouseup.

3. **`inlinePreviewPlugin`** — a `ViewPlugin` whose `decorations` facet
   drives the display. Rebuilds on doc change, viewport change, or
   selection change, subject to the freeze flag. The build function:

   - Computes `activeLines` from the current selection; any line
     touched by a selection range stays "active" (syntax revealed).
   - Calls `ensureSyntaxTree(state, view.viewport.to, 50)` to push the
     incremental parser through the visible region. This is what fixes
     "content past the initial parse window renders as raw text until
     you click to nudge the parser" — a `StateField` can't see the
     viewport, so decorations built from one never asked for enough
     tree coverage. That's why decoration sourcing is a plugin, not a
     state field.
   - Walks the tree scoped to the viewport (`iterate({from, to, ...})`),
     which also makes the walk O(visible blocks) instead of O(whole doc).
   - Two passes in practice: the first indexes task-list positions and
     expands active lines through fenced code blocks; the second emits
     line classes, inline marks, hide decorations, and widgets.

### What we hide, what we style, what we replace

- **Line classes** (applied unconditionally based on block type):
  `cm-atomic-h1`..`h6`, `cm-atomic-blockquote`, `cm-atomic-fenced-code`,
  `cm-atomic-table-row`, `cm-atomic-table-header`,
  `cm-atomic-table-divider`, `cm-atomic-task-done`. These set font
  size / weight / decoration. No height changes between active and
  inactive states because the class doesn't care about cursor position.

- **Inline content marks** (applied unconditionally to content between
  syntax tokens): `cm-atomic-strong`, `cm-atomic-em`,
  `cm-atomic-inline-code`, `cm-atomic-strike`, `cm-atomic-link`. These
  style the text inside `**…**`, `*…*`, backticks, `~~…~~`,
  `[text](url)`.

- **Hide decorations** (applied only on inactive lines): `HeaderMark`,
  `EmphasisMark`, `CodeMark`, `CodeInfo`, `LinkMark`, `URL`,
  `LinkTitle`, `StrikethroughMark`, `QuoteMark`, single-char
  `TableDelimiter` (the `|` between cells), and the full-line
  `TableDelimiter` (the `|---|---|` separator). These use empty
  `Decoration.replace({})` — the characters vanish from flow without
  resizing their line.

- **Widgets** (always-on replacements): `•` for bullet `ListMark`,
  a checkbox for `TaskMarker`. Widget `ignoreEvent` returns true for
  mouse events on the checkbox so CM6 doesn't fight our toggle handler
  for cursor placement.

### The tight-Enter override

`@codemirror/lang-markdown` ships `insertNewlineContinueMarkup` as its
default Enter handler. It inspects the syntax tree to decide whether the
list it's continuing is "loose" (CommonMark: blank lines between items)
and, if so, inserts a blank line into the continuation to preserve the
loose style.

In inline live-preview mode loose and tight lists look identical, so the
distinction doesn't earn its weight. Worse, lezer often classifies a
newly-typed list item as loose when it sits near an existing list — the
user ends up with a spurious blank line between their two new items.

`insertTightListItem` in `inline-preview.ts` overrides Enter at
`Prec.highest`. Bound behavior:

- Inside a `BulletList`, always emit `\n<indent><marker> ` (tight).
- Inside a task item, emit `\n<indent><marker> [ ] ` — fresh tasks
  start unchecked, even if you pressed Enter on a checked item.
- On an empty continuation (`- ` with nothing after, or `- [ ] ` with
  nothing after), replace the line with just its indent, which exits
  the list the user expects.

### `atomic-theme.ts`

Two CM6 extensions:
- An `EditorView.theme()` with visual/selection/scrollbar styling tied
  to the app's CSS custom properties (`--color-*`, `--font-*`). This
  means the editor follows the reader theme without any JS bridge.
- A `HighlightStyle` + `syntaxHighlighting` pairing that colors markdown
  tokens via `@lezer/highlight` tags. Syntax coloring is deliberately
  muted — the big visual weight comes from the line classes in
  inline-preview, not from token color.

### `code-languages.ts`

The language registry for fenced-code blocks. Each language's `load()`
is a dynamic import so Rollup splits each grammar into its own chunk and
users only download the ones they open. Shared between the CM6 editor
and Milkdown (while the latter is still around).

## The harness

`/editor-harness` is not a pretty UI — it's a dev surface. It exists so
we can test the editor against very large documents without touching
`AtomReader` or the rest of the app. The sample content generator
(`sample-content.ts`) is deterministic (seeded mulberry32), so
screenshots and probe outputs are stable across runs.

`scripts/test-editor-harness.mjs` drives Chromium through Playwright and
measures things the eye can't easily reason about: CLS during idle,
scroll, click, typing, and cursor ping-pong; selection and copy
behavior; freeze timing; task-list interaction. When iterating on the
editor, run it after every change — it catches regressions in under ten
seconds.

## Next steps

These are the pieces we know we need but haven't yet tackled. Listed
roughly in order of how load-bearing they are for getting the CM6 editor
into `AtomReader` as the default.

### 1. Wire into `AtomReader`

Right now the editor is reachable only via `/editor-harness`. The
production atom reader still mounts `AtomicMilkdownEditor`. Integrating
means:

- Add an `AtomicCodeMirrorEditorHandle` with the surface the reader
  depends on: `focus`, `undo`, `redo`, `openSearch(query?)`,
  `closeSearch`, `getMarkdown`, `getContentDOM`. Match the Milkdown
  handle's method shapes so `AtomReader` needs only an import swap.
- Re-add user-edit detection so `onMarkdownChange` fires only after
  genuine typing — see `hasUserEditRef` in the Milkdown editor for
  prior art. The current CM6 editor fires `onMarkdownChange` on any
  doc mutation; that would cause spurious dirty flags during
  programmatic sync.
- Handle `blurEditorOnMount` (Milkdown has "scrub focus" logic for
  this — we can probably just not call `view.focus()`).
- Handle `initialSearchText`.

### 2. Tables as a WYSIWYG widget

The current table support hides `|` separators and styles rows, but
cells are still character-aligned within each row's `.cm-line`. Columns
don't line up across rows because the DOM for row 1 doesn't know
anything about row 2.

Obsidian gives up on the "source-as-DOM" invariant for tables and
renders the whole block as a WYSIWYG HTML table widget. Implementation
shape:

- Switch the decoration source for `Table` nodes back to a `StateField`
  (block widgets can't be provided by a `ViewPlugin`, per CM6 rules).
- `Decoration.replace({ widget: new TableWidget(tableSource), block: true })`
  covering the entire `Table` range.
- The widget renders an editable `<table>`, with each `<td>` as a
  contenteditable region. Cell input dispatches a targeted change
  rewriting just that cell's slice of the source markdown.
- Cursor-atomic behavior is the whole point: clicks target cells, not
  doc positions. Backspace at a cell edge doesn't eat into the
  markdown syntax. Deleting the table selects it as a unit and
  replaces with nothing.
- Tab / Shift-Tab to move between cells. Enter to go down a row.
  Cmd+Return (or similar) to add a new row below.
- Add/remove column and row affordances as hover controls.
- Cell-to-source position mapping is the non-trivial part. The widget
  needs to map `(row, col, caret offset within cell)` → a doc position,
  which means carrying the source ranges per cell and keeping them
  stable across edits.

Estimated: probably a focused day of work to get the core right, more
for edge-case polish.

### 3. Image handling

`![alt](url)` today just renders as hidden link marks — the image
itself isn't displayed. Shape of a proper implementation:

- Detect `Image` nodes (they're a subtype of `Link` in lezer-markdown;
  the distinguishing feature is a `!` at the start).
- On inactive lines, replace with an inline `<img>` widget. Images are
  block-sized in practice, so the widget likely wants `block: true` —
  which means, again, the decoration source for these is a
  `StateField`.
- Lazy-load off-screen images (`loading="lazy"`) since atom docs can
  have many.
- Handle errors cleanly — an image failing to load shouldn't blank
  out the whole widget; show the alt text.
- Click behaviors: click-to-open in lightbox? Shift-click to select
  the node? Decide with the user.

Estimated: half-day for a first pass that handles the common case
(`![alt](url)`), longer if we want lightbox / clipboard paste / drag
to upload.

### 4. Search integration

CM6 ships `@codemirror/search`, which gives us a functional search
panel for free. The Milkdown editor has a custom-styled
`AtomicSearchPanel` with next/prev and inline highlights; porting it
means:

- Enable the CM6 `search({ top: true })` extension, style its default
  panel to match the Atomic palette via `EditorView.theme()`.
- Or: write a React-mounted search panel and drive CM6's search state
  via `openSearchPanel` / `setSearchQuery` from `@codemirror/search`.
- Handle the `initialSearchText` prop — currently not plumbed.
- Respect the "highlight text" affordance used by cross-atom navigation
  (the reader opens an atom with a highlight query).

### 5. Selection toolbar and link/image popovers

Milkdown had a floating toolbar on text selection (bold, italic, code,
link) and popover editors for link hrefs and images. These are not
essential for the MVP CM6 editor but are expected by users who relied
on them. Port them when integrating into `AtomReader`; they compose
naturally as view plugins that read the current selection.

### 6. Handling paste

Right now pasting HTML into the editor inserts raw HTML tags into the
source. We probably want to convert pasted HTML to markdown (Milkdown
used Turndown for this) so a copy from a web page yields clean
markdown rather than embedded `<p>` tags. Implementation point: CM6's
`EditorView.domEventHandlers({ paste })` lets us intercept and rewrite
the clipboard content before it hits the doc.

### 7. Mobile touch support

Capacitor / mobile needs investigation. CM6 supports touch natively,
but the freeze-on-mousedown pattern uses pointer events which should
handle touch too. The click-inside-widget behavior for the checkbox
widget specifically may need a touch-equivalent path.

### 8. Removing Milkdown

Last step: once CM6 is wired in and battle-tested, the cleanup commit.
`@milkdown/*`, `@milkdown/theme-nord`, `prosemirror-*` can all come out
of `package.json`. Crepe-specific CSS (`crepe-atomic-theme.css`)
and the `src/editor/milkdown/` directory go with them. The shared
fenced-code registry (`src/editor/codemirror/code-languages.ts`) was
extracted precisely so this removal doesn't ripple.

Expect this to delete hundreds of lines of editor code without regressing
user-visible behavior — that was the point of building the replacement
behind a harness, rather than behind feature flags that couple the two
editors' lifecycles.
