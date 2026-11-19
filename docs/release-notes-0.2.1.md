Typeleft 0.2.1 is a polish release for the new Milkdown / CodeMirror 6 editor stack.

## Fixes

- **Source mode colours** — the editor's own theme rules were being overridden by
  CodeMirror's built-in styles (the active line looked pale blue in dark mode).
  They now win, and the cursor/selection colours follow the app theme.
- **Code block language picker** — the language menu is styled to match the
  editor instead of rendering as a white native control, keeps unknown languages
  selectable, and gains `js`, `ts`, `py`, `rb`, `yml`, `sh` and more aliases.
- **Front matter on open** — a document starting with front matter (or an image)
  no longer opens with a bright focus ring around that block; the caret starts in
  the first text block.
- **Word count in source mode** — switching to source mode immediately publishes
  the word/character counts and outline instead of waiting for the first edit.

## Testing

`bun run test` now also runs a real-browser regression suite (`devtest/`): the
actual React components are mounted in headless Chrome, checked for front matter,
tables, task lists, KaTeX, line numbers, Mermaid previews, images, Prism tokens,
TOC/word count, then exercised with search and real typing. Any console error
fails the run.
