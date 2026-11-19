Typeleft 0.2.0 replaces the editor core.

## What's new

- **Milkdown editor engine** (ProseMirror + remark) is now the default WYSIWYG editor.
  The previous Muya engine is still bundled and can be selected in
  **Settings → Editor → Editor Engine**.
- **CodeMirror 6** replaces CodeMirror 5 for source mode, with markdown
  highlighting, search/replace, line numbers and cursor/scroll hand-off between
  the two modes.
- **Math** — inline `$...$` and block `$$...$$` rendered with KaTeX; double-click
  a formula to edit it.
- **Diagrams** — Mermaid, Flowchart, Sequence, PlantUML and Vega(-Lite) code
  blocks show a live preview under the code, using the themes configured in
  Settings.
- **Front matter** — YAML (`---`) and TOML (`+++`) are preserved verbatim, with
  double-click editing.
- **Task lists**, GFM tables with a floating table toolbar, images resolved from
  relative paths, footnotes.
- **Formatting bubble** on text selection (bold, italic, code, strike, link).
- **Automatic fallback**: documents larger than 200K characters open with the
  Muya engine, because ProseMirror has no virtualised rendering. A notice is
  shown at the top of the editor.
- Typora themes keep working: the editor renders inside `#write` and keeps the
  `pre.md-fences` / `.md-image` hooks; base styles live in a low-priority CSS
  layer so theme rules always win.

## Markdown fidelity

Saving a document **without editing** writes the file unchanged. After editing,
the document is re-serialised, which normalises cosmetic Markdown syntax:

- unordered list markers become `-` (follows the *Bullet List Marker* setting)
- Setext headings become ATX (`#`)
- indented code blocks and `~~~` fences become triple-backtick fences
- thematic breaks become `---`
- table cells are padded to align columns (idempotent)
- hard breaks `␠␠` become `\`

Round-trip fixtures and the harness live in `scripts/` (`bun run test:roundtrip`).

## Known issues

- Input methods (IME) and large-document typing feel still need more real-world
  testing; if anything misbehaves, switch the engine back to **Muya** in
  Settings.
- A lone `<br>` as the final block of a document is dropped.
- Slash-command menu, `==highlight==`, super/subscript and image resize handles
  are not implemented yet.
