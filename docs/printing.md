# Printing and PDF

Typeleft 0.12 adds a print/PDF subsystem with page setup, cover, TOC, running
headers/footers, metadata, CJK fonts, diagram pre-rendering, engine detection
and presets.

- 入口：**File → Print / PDF…**（`Cmd/Ctrl+P`）或命令面板。
- 系统打印始终通过系统打印窗口；预设只影响版式，不改变打印路径。
- PDF 通过 Pandoc + XeLaTeX / Tectonic / WeasyPrint 生成；引擎由用户安装，
  应用只检测，不自动下载。

## Page

| 项目 | 值 |
|---|---|
| 纸张 | A3 / A4 / A5 / B5 / Letter / 自定义（mm） |
| 方向 | 纵向 / 横向 |
| 边距 | 常规 / **中文公文（上下 2.54 cm、左右 3.18 cm）** / 窄 / 适中 / 宽 / 自定义 |
| 默认 | A4 + 中文公文边距 |

## Typography

- 正文字体、标题字体、代码字体、中文字体（留空自动探测 CJK 栈）。
- 字号、行高、段距、首行缩进、两端对齐。
- 标题编号（与编辑器选项或 front matter 的 `heading-numbering` 一致）。
- 图片最大宽度与 `image-resolution` DPI（WeasyPrint / Paged.js 支持）。
- 代码高亮主题（Pandoc `--highlight-style`；HTML 打印沿用 Prism）。
- 表格跨页重复表头，标题不与后文分离，孤行/寡行控制。

## Structure and metadata

- 封面：标题、副标题、作者、日期，可开关。
- 目录：独立页、标题、深度 1–6、可选页码；HTML/WeasyPrint 用
  `target-counter()`，LaTeX 用 Pandoc 自带目录。
- 页眉/页脚各三栏，支持奇偶页不同、首页不同。
- 占位符：`{page}`、`{total}`、`{title}`、`{author}`、`{date}`。
- 页码格式：阿拉伯、大小写罗马、字母；可设置起始页。
- PDF 元数据：标题、作者、主题、关键词。
- PDF 书签：LaTeX 由 Pandoc/hyperref 生成；WeasyPrint 使用
  `bookmark-level`/`bookmark-label`。

## Engines

| 引擎 | 能力 | 说明 |
|---|---|---|
| 系统打印 | @page 纸张/边距/分页；TOC 与封面；页码由系统决定 | 页眉页脚受浏览器限制，UI 明示 |
| Pandoc + XeLaTeX | 封面、目录、编号、页眉页脚、字体、CJK、代码、书签、元数据 | 最完整；需要 TeX 发行版 |
| Pandoc + Tectonic | 同上，按需下载宏包 | 首次编译需要网络 |
| Pandoc + WeasyPrint | CSS paged media、页码、页眉页脚、链接 | 适合 HTML/CSS 版式 |

检测结果显示版本与路径；`printEnginePaths` 可指定可执行文件。缺少引擎时
错误信息区分 `pandoc-not-found`、`engine-not-found:<name>` 与
`engine-path-invalid:<path>`。导出期间可取消（终止子进程）。

## Presets and per-document overrides

- 内置预设：A4 中文公文（默认）、A4 Normal、A5 Booklet、Letter。
- 自定义预设保存在 `printPresets`；当前设置保存在 `printSettings`。
- 导出后默认打开 PDF，可用 `printOpenAfter` 关闭。
- Front matter 覆盖：

```yaml
---
print:
  paper: A5
  orientation: portrait
  marginPreset: narrow
  fontSize: 10.5
  cover:
    enabled: true
    title: 项目报告
  toc:
    enabled: true
    depth: 2
  meta:
    author: 张三
    subject: 季度总结
---
```

## Preview and failure paths

- **Preview** uses Paged.js to paginate the exact print HTML (`@page` size and
  margins, cover, TOC target counters). The browser test asserts the paged
  document markers; a CDP run on 2026-11-22 rendered 2 pages for the test
  document.
- Missing image / failed diagram targets leave their source text; the export
  reports the engine/pandoc error verbatim.
- System printing ignores CSS margin boxes; use WeasyPrint or LaTeX when
  running headers matter.
- Diagrams (Mermaid/flowchart/sequence/Vega) are rendered to PNG assets before
  Pandoc runs; PlantUML without a server is reported and left as code.
- `bun run test:print` builds a cover/TOC/CJK/table/code sample with print CSS
  and prints it through headless Chrome to a PDF (no Pandoc required). It
  asserts at least two page objects and a non-trivial file size.

## Samples

`docs/print-samples/` contains the HTML and a 6-page PDF produced by
`bun run test:print` (cover, TOC, CJK, 48-row table, code, heading numbering).
CI repeats the sample on Ubuntu x64/macOS/Windows with Chrome and on Ubuntu
arm64 with WeasyPrint (`PDF_RENDERER=weasyprint`).

## Known limitations

- Browser/system printing cannot show TOC page numbers (`target-counter` is a
  Paged.js/WeasyPrint feature); use Paged preview or a PDF engine.
- PDF page start applies to LaTeX engines; CSS paged media starts at 1.
- Footnotes follow Pandoc's placement; the browser path keeps inline references.
- Automatic CJK detection uses a platform font stack, not font-file inspection.
