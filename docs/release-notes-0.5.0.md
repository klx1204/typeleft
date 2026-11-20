Typeleft 0.5.0 closes the feature gaps left by the Milkdown migration.

## Editing

- **Marks**: `==highlight==`, `^superscript^` and `~subscript~` now convert while
  you type, and the selection bubble has Highlight / Superscript / Subscript
  buttons.
- **Task lists**: the *Auto Check Task Lists* setting works again — ticking a
  parent ticks its children, and parents follow their children.
- **Rich clipboard**: menu Copy/Cut put HTML and plain text on the clipboard;
  menu Paste prefers HTML (and works in source mode too).
- **Search**: matches can span formatting (`**bo**ld`), and regex replacements
  expand `$1` / `$&`.
- **Front matter**: the YAML/TOML editor highlights keys, values and comments and
  warns about lines that are not `key: value` / `key = value`.
- **Images**: `style="zoom:50%"`, percentage widths and standalone `<img>` blocks
  are understood.
- **Tables**: column resizing is enabled, and widths are written back to the
  document as `<!-- tl-cw: ... -->` so they survive reloads.

## Insert menus

- Emoji picker and table size picker (both from the `/` menu, with search and a
  rows × columns grid).
- Footnote insertion creates the reference and its definition.
- The link button opens a small popover instead of a browser prompt.
- Empty paragraphs show an insert hint.

## Diagrams

- Per-block preview toggle; Mermaid previews render again after toggling.
- Invalid diagram sources show a readable error instead of a placeholder.
- Vega and Vega-Lite specifications render via vega-embed.

## Themes

- Typora themes that use `#write > p` style direct-child selectors now work: the
  selectors are rewritten to the real ProseMirror structure when the theme loads.

## Testing

`bun run test` now runs five suites: engine, round-trip fixtures (5 files),
CodeMirror 6 smoke, search/replace, and the headless-browser suite (which also
covers the pickers, autoCheck, table widths, the diagram toggle and the theme
selector rewrite).
