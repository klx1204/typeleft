<p align="center">
  <img src="src-tauri/app-icon.svg" width="112" height="112" alt="Typeleft icon" />
  <h1 align="center">Typeleft</h1>
  <p align="center">A lightweight, cross-platform Markdown editor built with Rust + Tauri.</p>
</p>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">简体中文</a></p>

Typeleft is a cross-platform rewrite of [Typedown](https://github.com/byxiaozhi/Typedown) (originally a Windows-only WinUI editor). The name is a nod to *copyleft*: open, hackable, and no longer tied to a single platform.

## Features

- **WYSIWYG Markdown editing** powered by Milkdown (ProseMirror + remark)
- **Cross-platform**: macOS (Intel / Apple Silicon), Windows, Linux
- **Source mode** with CodeMirror 6 and its own search bar
- **Math** (KaTeX, inline and block), **diagrams** (Mermaid / Flowchart / Sequence / PlantUML / Vega) and **front matter** (YAML / TOML)
- **Large documents** (> 200 KB) automatically open in source mode (CodeMirror 6 is virtualised); Shift+F forces rich text
- **Find & replace** with case-sensitive / regex / whole-word options, matches across formatting and `$1` captures
- **Undo / redo**, slash-command menu (headings, lists, emoji, table size picker, footnote), formatting bubble and table toolbar
- **Table column widths**, auto-check task lists, rich-text clipboard (HTML + plain text)
- **Highlight / superscript / subscript** (`==mark==`, `^sup^`, `~sub~`), image alignment and drag-to-resize
- **Outline & file tree** sidebars (outline filter, pinned/recent folders), with file operations (rename, move, copy, delete to trash, new file/folder)
- **Recent files** menu and a configurable recent-files limit
- **Code fences**: line numbers, soft wrap, default language, KaTeX preview for ```` ```math ````, copy block, Tab / Shift+Tab indent
- **Rich HTML**: raw HTML blocks and inline markup, `<u>`, `<video>`/`<audio>` and sandboxed `<iframe>` embeds, with round-trip preservation
- **Document structure**: live `[TOC]` blocks, GitHub Alerts (`> [!NOTE]`), Mermaid 11, `\(...\)` / `\[...\]` math delimiters, file links, emoji shortcodes and strict GFM mode
- **Tables**: insert/delete rows and columns, resize, align, and drag rows/columns to reorder
- **Export** presets (reorder, CSS / outline / front-matter switches, post-export actions, per-document front-matter overrides) and **direct printing**
- **Pandoc export**: PDF, Word, ODT, ePub, LaTeX, RST, RTF, OPML, Reveal.js, Markdown conversion and custom commands
- **Pandoc import**: docx / odt / ePub / RST (media extracted next to the source)
- **Writing aids**: smart quotes and dashes, auto-linking, copy as Markdown/HTML/text, spell checking with a custom dictionary
- **Window**: zoom (menu or Cmd/Ctrl + wheel), full screen
- **Selected-text web search**, error-log panel, and a **CLI** (`typeleft <file>`, `--new`, `--folder`)
- **Image support**: clipboard paste, local copy, relative paths, and HTTP image hosting upload
- **Typography options**: RTL, heading auto-numbering, justified text, list markers, body/code fonts, editor background; each setting follows the theme until overridden
- **Themes**: light / dark / system, Mermaid / Sequence / Vega diagram themes; Typora-compatible CSS and a [theme authoring guide](docs/theme-authoring.md)
- **Bilingual UI**: English and 简体中文, switchable at runtime
- Native menus, keyboard shortcuts, auto-save and backups

## Command line

```bash
typeleft notes.md          # open a file
typeleft --new             # start with an empty document
typeleft --folder ~/vault  # open a folder in the sidebar
typeleft --help
```

Document import/export formats need [Pandoc](https://pandoc.org/installing.html); PDF also needs a TeX engine
(`tectonic` or `xelatex`) or `weasyprint`. Set a custom path in
Settings → Import & Export.

## Themes

Typeleft loads Typora `.css` themes directly.

- **Theme folder**: `~/Library/Application Support/com.typeleft.desktop/themes` on macOS, `%APPDATA%\com.typeleft.desktop\themes` on Windows, `~/.local/share/com.typeleft.desktop/themes` on Linux.
- Open it from **View → Themes...** (or Settings → Theme & Diagrams), copy the theme `.css` files (plus any fonts/images), refresh and select.
- Load order: theme CSS → `base.user.css` → `{theme}.user.css`.
- Supported: typography, colours, headings, lists, tables, blockquotes, code blocks, task lists, background images, `@font-face` fonts, CSS counters (auto numbering), side bar colours, `#write > …` direct-child selectors.
- Not supported: native menu styling (drawn by the OS), TOC blocks.
- Relative `url()` and `@import` references are inlined (assets as `data:` URLs, imported CSS as text) and cannot escape the theme folder; external `http(s)` references are blocked.

## Download

Grab the latest build for your platform from [Releases](../../releases).

| Platform | Artifact |
| --- | --- |
| macOS (Apple Silicon / Intel) | `.dmg` |
| Windows 10+ | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` |

> macOS builds are unsigned. On first launch, right-click the app and choose **Open**.

## Development

```bash
bun install
bun run tauri dev
```

Requirements: Rust toolchain, Bun (or npm), and the platform dependencies listed in the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Build

```bash
bun run tauri build
```

## Testing

```bash
bun run test           # everything below
bun run test:engine    # engine / source-mode decision (incl. the 200K limit)
bun run test:roundtrip # markdown parse ↔ serialize fidelity
bun run test:cm6       # CodeMirror 6 smoke test
bun run test:search    # cross-node search and $1 replacements
bun run test:web       # real components in headless Chrome
bun run test:rust      # CLI argument parsing (cargo test)
```

CI runs these suites on every push and pull request (`.github/workflows/test.yml`).

`test:web` serves `devtest/`, mounts the actual `MilkdownEditor` and
`CodeMirror6` components with a stubbed Tauri IPC layer, checks the rendered
DOM (front matter, tables, task lists, KaTeX, code blocks, diagrams, images,
Prism tokens, outline, word count), drives the search panel and real typing, and
fails on any `console.error`. `?theme=1`, `?layout=1`, `?codeblock=1`, `?sidebar=1`, `?folders=1`,
`?exportdialog=1`, `?settings=1`, `?settingstype=1`, `?searchmenu=1`,
`?softbreak=1`, `?spell=1`, `?media=1`, `?exporttheme=1`, `?strict=1`,
`?filelink=1` and `?pickers=1` switch the page into the other checks.

Every preference lives in one JSON file; see [`docs/settings.md`](docs/settings.md)
for the full key reference (also reachable from Settings → Advanced).

## License

GPL-3.0-or-later. Typeleft is based on [Typedown](https://github.com/byxiaozhi/Typedown) by ZZF
(MIT License, Copyright (c) 2022 ZZF); the historical MIT parts remain under
the MIT license — see [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
