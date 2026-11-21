<p align="center">
  <img src="src-tauri/app-icon.svg" width="112" height="112" alt="Typeleft icon" />
  <h1 align="center">Typeleft</h1>
  <p align="center">A lightweight, cross-platform Markdown editor built with Rust + Tauri.</p>
</p>

<p align="center"><b>English</b> · <a href="README.zh-CN.md">简体中文</a></p>

Typeleft is a from-scratch cross-platform rewrite of [Typedown](https://github.com/byxiaozhi/Typedown) (originally a Windows-only WinUI editor). The name is a nod to *copyleft*: open, hackable, and no longer tied to a single platform.

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
- **Outline & file tree** sidebars, with file operations (rename, move, copy, delete to trash, new file/folder)
- **Recent files** menu
- **Export** configurations (HTML, CSS / front matter toggles) and **direct printing**
- **Image support**: clipboard paste, local copy, relative paths, and HTTP image hosting upload
- **Themes**: light / dark / system, Mermaid / Sequence / Vega diagram themes
- **Bilingual UI**: English and 简体中文, switchable at runtime
- Native menus, keyboard shortcuts, auto-save and backups

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
```

CI runs these suites on every push and pull request (`.github/workflows/test.yml`).

`test:web` serves `devtest/`, mounts the actual `MilkdownEditor` and
`CodeMirror6` components with a stubbed Tauri IPC layer, checks the rendered
DOM (front matter, tables, task lists, KaTeX, code blocks, diagrams, images,
Prism tokens, outline, word count), drives the search panel and real typing, and
fails on any `console.error`. `?light=1`, `?theme=1`, `?static=1` and `?cm6=1`
switch the page into the other checks.

## License

MIT. Based on [Typedown](https://github.com/byxiaozhi/Typedown) by ZZF (MIT License, Copyright (c) 2022 ZZF).
