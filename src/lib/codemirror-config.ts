import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { richMarkdown } from './codemirror-rich-markdown';

/**
 * "Seamless" CodeMirror theme for inline editing.
 * Matches the surrounding prose: same font, same background, no chrome.
 */
export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    fontSize: 'inherit',
    lineHeight: 'inherit',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    fontSize: 'inherit',
  },
  '.cm-content': {
    caretColor: 'var(--color-accent)',
    padding: '0',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
    fontSize: 'inherit',
    color: 'var(--color-text-primary)',
  },
  '.cm-line': {
    padding: '0',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent)',
  },
  // Selection: CM ships its own
  //   `&light.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground
  //      { background: #d7d4f0 }`
  // rule which is *more specific* than a plain `.cm-selectionBackground`
  // override and therefore wins when the editor is focused. On our
  // `#1e1e1e` dark bg that pastel lavender reads as near-opaque light grey,
  // making white text on top unreadable. Match CM's selector depth so our
  // accent actually lands.
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(124, 58, 237, 0.55)',
  },
  '::selection': {
    backgroundColor: 'rgba(124, 58, 237, 0.55)',
    color: 'var(--color-text-primary)',
  },
  '.cm-placeholder': {
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
});

/**
 * Syntax highlighting using CSS variables from the design system.
 */
const highlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'bold', color: 'var(--color-text-primary)' },
  { tag: tags.strong, fontWeight: 'bold', color: 'var(--color-text-primary)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--color-text-primary)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--color-text-secondary)' },
  { tag: tags.link, color: 'var(--color-text-primary)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--color-text-primary)', textDecoration: 'underline' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', color: 'var(--color-accent-light)' },
  { tag: tags.content, color: 'var(--color-text-primary)' },
  { tag: tags.processingInstruction, color: 'var(--color-text-tertiary)' },
  { tag: tags.meta, color: 'var(--color-text-tertiary)' },
  { tag: tags.list, color: 'var(--color-text-secondary)' },
  { tag: tags.quote, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  { tag: tags.angleBracket, color: 'var(--color-text-tertiary)' },
  { tag: tags.tagName, color: 'var(--color-accent-light)' },
  { tag: tags.attributeName, color: 'var(--color-text-secondary)' },
  { tag: tags.attributeValue, color: 'var(--color-accent-light)' },
]);

/** Get CodeMirror extensions for seamless inline markdown editing.
 *
 * Virtualisation is effectively disabled via the `VP.Margin` patch in
 * `patches/@codemirror+view+*.patch` — this makes `EditorView.lineWrapping`
 * + variable-height decorations (heading sizes, paragraph margins, image
 * widgets) stable. Without the patch CM would re-measure lines as they
 * scroll in and the heightmap would drift. */
export function getEditorExtensions() {
  return [
    markdown(),
    editorTheme,
    syntaxHighlighting(highlightStyle),
    richMarkdown(),
    EditorView.lineWrapping,
  ];
}
