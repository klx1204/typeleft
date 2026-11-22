# settings.json reference

Typeleft stores every preference in a single JSON file. The Settings window is a
visual editor for it; editing the file by hand is supported and is useful for
settings that have no UI yet.

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/com.typeleft.desktop/settings.json` |
| Windows | `%APPDATA%\com.typeleft.desktop\settings.json` |
| Linux | `~/.config/com.typeleft.desktop/settings.json` |

Open it from **Settings → Advanced → Open settings.json**, then press
**Reload**. A few window-related entries only apply after a restart.

## Editor

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `fontSize` | string/number | `16` | Editor font size, e.g. `16px`. |
| `lineHeight` | number | `1.6` | Line height. |
| `tabSize` | number | `4` | Spaces inserted by Tab (lists, code fences). |
| `editorAreaWidth` | string | `""` | Max width of the text column, e.g. `860px`. Empty uses the built-in value. |
| `typewriter` | boolean | `false` | Keep the caret line vertically centred. |
| `focusMode` | boolean | `false` | Dim everything except the current block. |
| `spellcheckEnabled` | boolean | `false` | WebView spell checking. |
| `spellcheckLang` | string | `""` | Language tag for spell checking. |
| `codeBlockLineNumbers` | boolean | `true` | Show the line-number gutter. |
| `codeBlockWrap` | boolean | `false` | Soft-wrap code fences. |
| `codeBlockDefaultLanguage` | string | `""` | Language assigned to new code fences. |
| `autoPairBracket` | boolean | `true` | Auto-close `()[]{}<>`. |
| `autoPairQuote` | boolean | `true` | Auto-close `"` and `'`. |
| `autoPairMarkdownSyntax` | boolean | `true` | Wrap a selection with `* _ ~ = $ ^ \``. |
| `superSubScript` | boolean | `true` | Parse `^sup^` / `~sub~`. |
| `sourceCode` | boolean | `false` | Start in Markdown source mode. |
| `smartQuotes` | boolean | `true` | Convert straight quotes to curly quotes while typing. |
| `smartDashes` | boolean | `true` | Convert `--` / `---` / `...` to en dash, em dash and ellipsis. |
| `preserveSoftLineBreaks` | boolean | `false` | Keep single newlines as `<br>` in the editor and exports. |
| `autoLink` | boolean | `true` | Link typed URLs automatically; when off, parsed literals stay text. |
| `defaultCopyFormat` | `rich` / `markdown` / `text` | `rich` | What Edit → Copy writes. |
| `customDictionary` | string | `""` | Comma-separated words the spell checker accepts. |

## Typography

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `textDirection` | `ltr` / `rtl` | `ltr` | Writing direction. Code and tables stay LTR in RTL mode. |
| `headingNumbering` | boolean | `false` | CSS-counter heading numbers (`1.`, `1.1`, …). |
| `justifyText` | boolean | `false` | Justify paragraphs and list items. |
| `listMarker` | string | `""` | Bullet style: `disc`, `circle`, `square`. |
| `orderedMarker` | string | `""` | Number style: `decimal`, `lower-alpha`, `lower-roman`, `upper-alpha`, `upper-roman`. |
| `bodyFont` | string | `""` | CSS font family for body text. |
| `codeFont` | string | `""` | CSS font family for code. |
| `editorBackground` | string | `""` | Editor background colour (`#fdf6e3`, `rgb(...)`). |

## Markdown

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `bulletListMarker` | `-` / `*` / `+` | `-` | Marker written when serialising bullet lists. |
| `orderListDelimiter` | `.` / `)` | `.` | Delimiter for ordered lists. |
| `listIndentation` | number / `dfm` | `1` | Spaces per list nesting level. |
| `frontmatterType` | `-` / `+` | `-` | YAML fence style. |
| `preferLooseListItem` | boolean | `true` | Keep blank lines between list items. |
| `trimUnnecessaryCodeBlockEmptyLines` | boolean | `false` | Strip leading/trailing empty lines in fences. |

## Search

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `searchIsCaseSensitive` | boolean | `false` | Case-sensitive search. |
| `searchIsRegexp` | boolean | `false` | Treat the query as a regular expression. |
| `searchIsWholeWord` | boolean | `false` | Whole-word matching. |

## Files and windows

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `defaultFileExtension` | string | `md` | Extension offered when creating a file in the sidebar. |
| `fileStartupAction` | `""` / `openLast` / `new` | `""` | Blank page, restore the last file, or start a new document. |
| `dragDropAction` | `open` / `insert-link` / `ignore` | `open` | What dropping a file on the window does. |
| `recentFilesLimit` | number | `10` | Entries kept in File → Recent Files (1–30). |
| `fileStartupAction` | string | `none` | Action applied to a single file passed on startup. |
| `folderStartupAction` | `none` / `openLast` | `openLast` | Reopen the last folder on launch. |
| `pinnedFolders` | string[] | `[]` | Folders pinned in the sidebar. |
| `recentFolders` | string[] | `[]` | Recently opened folders (managed by the app). |
| `sidePaneWidth` | number | `240` | Sidebar width in pixels. |
| `statusBarOpen` | boolean | `true` | Show the status bar. |
| `wordCountMethod` | `0` / `1` | `0` | 0 = words, 1 = characters. |
| `zoom` | number | `1` | Window zoom (0.5–2). |

## Appearance and diagrams

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `themeMode` | `system` / `light` / `dark` | `system` | Base colour scheme. |
| `customTheme` | string | `""` | Theme file name inside the theme folder. |
| `mermaidTheme` | string | `default` | Mermaid theme name. |
| `sequenceTheme` | `simple` / `hand` | `simple` | Sequence-diagram theme. |
| `vegaTheme` | string | `latimes` | Vega-Lite theme. |
| `animationEnable` | boolean | `true` | UI transitions. |
| `compactMode` | boolean | `false` | Compact chrome. |
| `alwaysOnTop` | boolean | `false` | Keep the window above others. |
| `windowState` | object | — | Last window position and size. |
| `lang` | `en` / `zh` | `en` | UI language. |

## Images and export

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `insertLocalImageAction` | `none` / `copyToPath` / `upload` | `none` | What happens when a local image is inserted. |
| `insertWebImageAction` | same | `none` | Same, for remote images. |
| `insertClipboardImageAction` | same | `none` | Same, for pasted images. |
| `preferRelativeImagePaths` | boolean | `false` | Write relative image paths. |
| `autoEncodeImageURL` | boolean | `true` | Percent-encode image URLs. |
| `exportConfigs` | array | `[]` | Saved export presets (managed by the dialog). |
| `imageCopyDir` | string | `images` | Folder for copied/pasted images, relative to the document or absolute. |
| `dotSlashImagePaths` | boolean | `true` | Prefix relative image paths with `./`. |
| `pandocPath` | string | `""` | Pandoc executable; empty means auto-detect. |
| `customExportCommand` | string | `""` | Command template for the Custom export format (`{input}`, `{output}`, `{title}`). |

## Per-document export

A document can override the export dialog through front matter:

```yaml
---
export:
  fileName: release-notes.html
  outputDir: ~/site
  includeCss: true
  includeToc: false
  includeFrontmatter: false
  postAction: open-file   # none | open-file | open-folder
---
```

The values above override the selected preset for that export only.

## Export formats

The export dialog can produce HTML itself, or delegate to Pandoc for PDF,
Word (`.docx`), ODT, ePub, LaTeX, RST, RTF, OPML, Reveal.js, Markdown
(GFM/CommonMark) and plain text. PDF additionally needs a TeX engine
(`tectonic` / `xelatex`) or `weasyprint`. Without Pandoc the dialog shows where
to configure it; nothing fails silently.

Import (File → Import Document…) uses the same Pandoc installation for docx,
odt, ePub, RST and HTML; media is extracted to `<name>_files/` next to the
source document.
