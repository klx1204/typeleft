Typeleft 0.3.0 adds the last formatting features of the Milkdown migration.

## New

- **Highlight, superscript, subscript** — `==text==`, `^sup^` and `~sub~` are
  rendered and survive round-trips byte-for-byte. To make `~x~` mean subscript,
  GFM's single-tilde strikethrough is disabled; `~~x~~` still works.
- **Image alignment and resizing** — hover an image for left/center/right
  buttons and drag the corner handle to set a width. Layout is stored the same
  way Muya/Typora store it, as inline HTML:
  `<img src="..." alt="..." width="320px" data-align="center">`, and is parsed
  back into an editable image node. Plain `![alt](src)` images stay untouched.

## Also in this release

- 0.2.1's fixes: menu commands, slash menu, Typora theme surfaces, CodeMirror 6
  colours, code block language picker, initial selection, source-mode word count.

## Testing

`bun run test` covers parsing/serialisation round-trips (now including an
image-layout fixture), the CodeMirror 6 smoke test, and the headless-browser
suite that asserts `<mark>`, `<sup>`, `<sub>`, image layout attributes and the
image toolbar.
