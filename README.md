<p align="center">
  <h1 align="center">Typeleft</h1>
  <p align="center">A lightweight, cross-platform Markdown editor built with Rust + Tauri.</p>
</p>

Typeleft is a from-scratch cross-platform rewrite of [Typedown](https://github.com/byxiaozhi/Typedown) (originally a Windows-only WinUI editor). The name is a nod to *copyleft*: open, hackable, and no longer tied to a single platform.

## Features

- **WYSIWYG Markdown editing** powered by Muya (the editor engine from MarkText)
- **Cross-platform**: macOS (Intel / Apple Silicon), Windows, Linux
- **Source mode** with CodeMirror and its own search bar
- **Find & replace** with case-sensitive / regex / whole-word options
- **Undo / redo** with a debounced snapshot history
- **Outline & file tree** sidebars, with file operations (rename, move, copy, delete to trash, new file/folder)
- **Recent files** menu
- **Export** configurations (HTML, CSS / front matter toggles) and **direct printing**
- **Image support**: clipboard paste, local copy, relative paths, and HTTP image hosting upload
- **Themes**: light / dark / system, Mermaid / Sequence / Vega diagram themes
- **Bilingual UI**: English and 简体中文, switchable at runtime
- Native menus, keyboard shortcuts, auto-save and backups

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

## License

MIT. Based on [Typedown](https://github.com/byxiaozhi/Typedown) by ZZF (MIT License, Copyright (c) 2022 ZZF).
