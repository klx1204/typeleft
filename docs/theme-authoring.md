# Theme authoring guide

For people writing **Typeleft themes** or porting a Typora theme.

- Applies to Typeleft **0.9.0**.
- Typeleft is a Tauri app: the editor is a web page, so a theme is still one
  CSS file plus optional fonts/images.
- The design goal is Typora compatibility: the content area keeps `#write`,
  standard tags, `md-*` classes, CSS counters and `@font-face`.
- The React shell (sidebar, dialogs, menus) cannot be restyled structurally;
  only its colours follow the theme through CSS variables.

---

## 1. Install and load a theme

1. Open **Settings → Theme & Diagrams → Open Theme Folder**.
2. Copy the `.css` file (and any fonts/images) into that folder.
3. Pick it in the theme list; changes apply immediately.

Typical folder locations:

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/com.typeleft.desktop/themes/` |
| Windows | `%APPDATA%\com.typeleft.desktop\themes\` |
| Linux | `~/.local/share/com.typeleft.desktop/themes/` |

Any `.css` file in the folder appears in the list; `*.user.css` files are
hidden because they are overrides, not themes. Lowercase-hyphenated names are
recommended.

### Load order

```
your-theme.css
base.user.css            (optional, applies to every theme)
your-theme.user.css      (optional, only for your-theme.css)
```

The file name before `.user.css` must match exactly, including case.

### What gets inlined

- Relative `@import "sub.css"` is inlined (up to 3 levels).
- Relative `url(...)` assets are converted to `data:` URLs, so a theme is
  fully self-contained.
- Supported asset types: `woff2`, `woff`, `otf`, `ttf`, `png`, `jpg`, `jpeg`,
  `gif`, `webp`, `svg`, `bmp`.
- Network URLs (`http:`, `https:`, `//`), absolute paths and paths outside the
  theme folder are **blocked**; blocked `url()` becomes empty and a warning is
  printed in the console.
- Keep every font and image inside the theme folder and reference it
  relatively.

---

## 2. DOM contract

The editor root is:

```html
<div id="write" class="milkdown-write">
  <div class="milkdown-host">
    <div class="milkdown">
      <div class="ProseMirror" contenteditable="true"> … document … </div>
    </div>
  </div>
</div>
```

So `#write > p` in a Typora theme does not match. Typeleft automatically
rewrites every `#write >` selector to `#write .ProseMirror >`, so most Typora
themes work without edits. For new themes prefer:

```css
#write .ProseMirror > p { … }
```

### Blocks and inline elements

| Markdown | DOM |
| --- | --- |
| Heading | `#write .ProseMirror h1` … `h6` with generated `id` |
| Paragraph | `p`; empty ones get `.is-empty` and `data-placeholder` |
| Strong / emphasis / strike | `strong`, `em`, `s` |
| Inline code | `code` |
| Link | `a[href]` |
| Highlight / sup / sub | `mark`, `sup`, `sub` |
| Underline | `u` |
| Blockquote | `blockquote` |
| Lists | `ul`, `ol`, `li` |
| Task list | `li[data-item-type="task"][data-checked="true|false"]` |
| Horizontal rule | `hr` |
| Table | `.tableWrapper > table`; `th`/`td`, `colgroup > col` for widths, `.selectedCell`, `.column-resize-handle` |
| Code block | `.md-fences-wrapper` > `.md-fences-header` (`.md-fences-language`, `.md-fences-actions`), `.md-fences-body` (`.md-fences-gutter`, `pre.md-fences > code.md-fences-content`) |
| Syntax tokens | Prism classes inside the code block, e.g. `.token.keyword`, `.token.function` |
| Math | `.math-node.math-inline` / `.math-node.math-block`, KaTeX inside |
| Mermaid / diagrams | `.diagram-preview.active` |
| Front matter | `pre[data-type="frontmatter"]`; editing uses `.frontmatter-editor`, `.fm-key`, `.fm-section`, `.fm-comment`, `.fm-error` |
| Footnotes | `sup[data-type="footnote_reference"]`, `dl[data-type="footnote_definition"]`, hover preview `.footnote-preview` |
| Page break | `.page-break` |
| Raw HTML | `.md-html-block`, `.md-html-inline` |
| Search | `.typeleft-search-match`, `.typeleft-search-active` |
| Spell check | `.tl-spell-error` |
| Placeholder | `p.is-empty::before { content: attr(data-placeholder) }` |
| Image | `.md-image.image-node > img`, `.image-toolbar`, `.image-resize-handle`, `data-align`, `data-width` |
| Selected node | `.ProseMirror-selectednode` |

### State classes

- `#write.focus-mode` — focus mode is on.
- `body.code-block-no-line-numbers` — hide `.md-fences-gutter` if the user turned
  line numbers off.
- `body.code-block-wrap` — code blocks soft-wrap.
- `#write.typewriter` — typewriter mode.
- `.ProseMirror-focused` — editor has focus.
- `window.actualTheme` is `"light"` or `"dark"`.

### Source mode

The CodeMirror 6 editor is a **separate surface**, not inside `#write`:

```
.cm-editor, .cm-content, .cm-gutters, .cm-activeLine,
.cm-selectionBackground, .cm-cursor
```

A content theme does not automatically style source mode. Add explicit
`.cm-*` rules if you care about it, and test it: CodeMirror injects its own
styles, so you may need higher specificity.

### Not part of the theme contract

Sidebar, settings dialog, menus, search bar, pickers, link popover and image
toolbar structure are React UI. Their layout is not themeable; their colours
follow the variables below. Do not rely on their internal class names.

---

## 3. Cascade and specificity

- Typeleft's own editor styles live in `@layer typeleft-base`.
- A theme is injected into `<style id="typeleft-user-theme">` and is
  **unlayered**, so normal theme rules win over the base layer.
- Do not wrap your theme in `@layer` unless you intend to compete with the
  base layer; a later/earlier layer can change who wins.
- `!important` is normally unnecessary. Use it only for source-mode rules if
  CodeMirror overrides you.

---

## 4. Colour variables provided by the app

Use these instead of hard-coding the accent:

```css
:root {
  --themeColor: …;      /* accent */
  --themeColor10 … --themeColor90; /* accent at 10–90% alpha */
  --editorColor: …;     /* main text */
  --editorColor80/60/50/40/30/10/06/04/02;
  --editorColor00: …;   /* surface */
  --app-bg-color: …;
  --editorBgColor: …;
  --sideBarBgColor: …;
  --floatBgColor: …;
  --floatBorderColor: …;
}
```

Typeleft also bridges common Typora variables into the shell:

| Typora variable | Effect |
| --- | --- |
| `text-color` | `--editorColor*` |
| `bg-color` | background / surface variables |
| `primary-color` | `--themeColor` |
| `side-bar-bg-color` | sidebar background |
| `window-border-color` | floating border colour |

So a theme that only sets these five still gets a coherent shell:

```css
:root {
  --bg-color: #fdf6e3;
  --text-color: #3b3a36;
  --primary-color: #b58900;
  --side-bar-bg-color: #f5efdc;
  --window-border-color: #e5dcc3;
}
```

---

## 5. Settings tokens (0.9+)

**Settings → Typography** and theme CSS cooperate through design tokens. Each
setting has three states: follow the theme (default), the built-in default, or
an explicit value. Only explicit values emit CSS, so a theme keeps control
until the user changes something.

Variables:

```css
--tl-body-font
--tl-code-font
--tl-editor-bg
--tl-line-height
--tl-paragraph-gap
--tl-list-marker
--tl-ordered-marker
--tl-focus-dim        /* reserved for focus intensity */
```

Planned attributes on `#write`:

```html
data-direction="ltr|rtl"
data-heading-numbering="true|false"
```

Precedence:

1. If the user has not changed a setting, **the theme wins** (no override is
   emitted).
2. If the user explicitly changes it, Typeleft emits a targeted override.
3. Themes should consume tokens with a fallback so both cases look right:

```css
#write {
  font-family: var(--tl-body-font, "Theme Serif", serif);
  background: var(--tl-editor-bg, #fdf6e3);
  line-height: var(--tl-line-height, 1.7);
}

#write p { margin-bottom: var(--tl-paragraph-gap, 1em); }

#write[data-direction="rtl"] { direction: rtl; text-align: right; }

#write[data-heading-numbering="true"] h1::before {
  content: counter(h1) " ";
}
```

The editor applies explicit settings through `#write[data-*]` selectors; HTML
and print exports receive the same tokens as direct CSS. Pandoc formats only
map the values that the target format understands (font/size), not the whole
CSS theme.

For a theme that wants to respect settings, use `var()` with a fallback; a
theme that ignores the tokens still wins when the user has not overridden a
setting.

---

## 6. Typora compatibility notes

**Works well**

- `#write` + tag selectors (`p`, `h1`, `blockquote`, `table`, `pre`, …).
- `#write > x` (rewritten automatically).
- CSS counters for heading numbering.
- `@font-face` and relative fonts/images.
- `base.user.css` / `{theme}.user.css`.
- `prefers-color-scheme` media queries.

**Needs care**

- Code blocks: Typora's `pre.md-fences` is preserved, but Typeleft adds a header,
  line-number gutter and actions. Rules that assume `pre` is the whole block
  may need `.md-fences-wrapper` adjustments.
- `md-*` classes: only the ones documented above are stable. Typora classes for
  TOC, definition lists or its editor chrome may not exist.
- UI: a Typora theme's sidebar/titlebar rules won't style the React shell.
- External fonts/images are blocked by design; bundle them locally.
- VLOOK and other heavily restructured themes may need selector fixes.

---

## 7. Debugging checklist

1. Open **View → Toggle Developer Tools** (available in release builds).
2. Inspect `#write` and `.ProseMirror`; check computed font, colour, background.
3. Verify `@font-face` actually loaded in the Network/Computed panel.
4. Test light and dark mode; one custom theme is active at a time.
5. Test source mode (`.cm-*`) if you styled it.
6. Test a heading, table, code block, task list, image and footnote.
7. Reselect the theme after editing the file; no restart needed.
8. Watch the console: blocked external resources are reported.

**Export limitation (0.8.0):** HTML/print export uses the built-in export
stylesheet, not the custom theme CSS. Do not promise print/PDF fidelity yet.

---

## 8. Minimal example

```css
:root {
  --bg-color: #fdf6e3;
  --text-color: #3b3a36;
  --primary-color: #b58900;
  --side-bar-bg-color: #f5efdc;
  --window-border-color: #e5dcc3;
}

#write .ProseMirror {
  max-width: 780px;
  margin: 0 auto;
  padding: 32px 24px 80px;
  font-family: "LXGW WenKai", "Source Han Serif", serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--text-color);
  background: var(--bg-color);
}

#write .ProseMirror h1,
#write .ProseMirror h2,
#write .ProseMirror h3 {
  color: #8b5e00;
  letter-spacing: 0.01em;
}

#write .ProseMirror blockquote {
  margin: 1.2em 0;
  padding: 0.2em 1em;
  border-left: 3px solid var(--primary-color);
  background: rgba(181, 137, 0, 0.06);
}

#write .ProseMirror pre.md-fences {
  background: #2b2b2b;
  color: #f8f8f2;
  border-radius: 4px;
}

#write .ProseMirror pre.md-fences .token.keyword { color: #ff79c6; }
#write .ProseMirror pre.md-fences .token.function { color: #8be9fd; }

#write .ProseMirror table {
  border-collapse: collapse;
}

#write .ProseMirror th,
#write .ProseMirror td {
  border: 1px solid #ddd;
  padding: 6px 10px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #1e1e1e;
    --text-color: #d4d4d4;
    --side-bar-bg-color: #252526;
    --window-border-color: #3c3c3c;
  }
}
```

---

## 9. Contract stability

Consider these stable:

- `#write`, `.ProseMirror`, and standard HTML tags.
- The documented `md-*` content classes.
- The `.token.*` Prism classes.
- `@layer typeleft-base` + unlayered theme precedence.

These may change without notice:

- Toolbar/popover/picker internals.
- Exact wrapper nesting inside code blocks and tables beyond what is documented.
- Sidebar and dialog DOM.

If a theme is shared publicly, mention the Typeleft version it targets. There is
no in-app theme marketplace yet; publish it with a repository link and open an
issue/discussion so it can be listed.
