<p align="center">
  <img src="src-tauri/app-icon.svg" width="112" height="112" alt="Typeleft icon" />
  <h1 align="center">Typeleft</h1>
  <p align="center">基于 Rust + Tauri 的轻量级跨平台 Markdown 编辑器。</p>
</p>

<p align="center"><a href="README.md">English</a> · <b>简体中文</b></p>

Typeleft 是 [Typedown](https://github.com/byxiaozhi/Typedown)（原 Windows 专用 WinUI 编辑器）的跨平台重写版。名字取自 *copyleft*：开放、可改造，不再绑定单一平台。

## 功能

- **所见即所得 Markdown 编辑**，基于 Milkdown（ProseMirror + remark）
- **跨平台**：macOS（Intel / Apple Silicon）、Windows、Linux
- **源码模式**：CodeMirror 6，自带搜索栏
- **数学公式**（KaTeX，行内与块级）、**图表**（Mermaid / Flowchart / Sequence / PlantUML / Vega）、**Front Matter**（YAML / TOML）
- **大文档**（> 200 KB）自动以源码模式打开（CodeMirror 6 虚拟滚动）；按 Shift+F 可强制切换富文本
- **查找替换**：大小写 / 正则 / 全词，支持跨格式匹配与 `$1` 捕获组
- **撤销 / 重做**、斜杠命令菜单（标题、列表、emoji、表格尺寸、脚注）、格式气泡与表格工具条
- **表格列宽**、任务列表自动勾选、富文本剪贴板（HTML + 纯文本）
- **高亮 / 上标 / 下标**（`==高亮==`、`^上标^`、`~下标~`）、图片对齐与拖拽缩放
- **大纲与文件树**侧栏（大纲过滤、固定/最近文件夹），支持重命名、移动、复制、删除到回收站、新建文件/文件夹
- **最近文件**菜单，数量可配置
- **代码块**：行号、自动换行、默认语言、```` ```math ```` KaTeX 预览、复制代码块、Tab / Shift+Tab 缩进
- **富 HTML**：HTML 块与行内标记、`<u>`、`<video>`/`<audio>`、沙箱 `<iframe>`，源码往返保真
- **表格**：增删行列、列宽、对齐，以及拖动行/列排序
- **导出配置**（排序、CSS / 大纲 / Front Matter 开关、导出后动作、文档 Front Matter 覆盖）与**直接打印**
- **Pandoc 导出**：PDF、Word、ODT、ePub、LaTeX、RST、RTF、OPML、Reveal.js、Markdown 转换与自定义命令
- **Pandoc 导入**：docx / odt / ePub / RST（媒体文件解压到源文件旁）
- **写作辅助**：智能引号与破折号、自动链接、复制为 Markdown/HTML/纯文本、带自定义词典的拼写检查
- **窗口**：缩放（菜单或 Cmd/Ctrl + 滚轮）、全屏
- **选中文本网页搜索**、错误日志面板，以及 **CLI**（`typeleft <文件>`、`--new`、`--folder`）
- **图片**：剪贴板粘贴、本地复制、相对路径、HTTP 图床上传
- **排版选项**：文字方向（RTL）、标题自动编号、两端对齐、列表符号/编号、正文字体/代码字体、编辑区背景色
- **主题**：明亮 / 暗色 / 跟随系统，Mermaid / Sequence / Vega 图表主题
- **双语界面**：English 与简体中文，运行时切换
- 原生菜单、快捷键、自动保存与备份

## 命令行

```bash
typeleft notes.md          # 打开文件
typeleft --new             # 新建空文档
typeleft --folder ~/vault  # 在侧栏打开文件夹
typeleft --help
```

文档导入/导出格式需要 [Pandoc](https://pandoc.org/installing.html)；PDF 还需要 TeX 引擎
（`tectonic` 或 `xelatex`）或 `weasyprint`。可在“设置 → 导入导出”中指定路径。

## 主题

Typeleft 可直接加载 Typora 的 `.css` 主题。

- **主题目录**：macOS 为 `~/Library/Application Support/com.typeleft.desktop/themes`，Windows 为 `%APPDATA%\com.typeleft.desktop\themes`，Linux 为 `~/.local/share/com.typeleft.desktop/themes`。
- 从 **视图 → 主题...**（或设置 → 主题与图表）打开目录，把主题 `.css`（连同字体/图片）复制进去，刷新后选择。
- 加载顺序：主题 CSS → `base.user.css` → `{theme}.user.css`。
- 支持：排版、配色、标题、列表、表格、引用块、代码块、任务列表、背景图、`@font-face` 字体、CSS 计数器（自动编号）、侧栏配色、`#write > …` 直接子选择器。
- 不支持：原生菜单样式（由系统绘制）、TOC 块。
- 相对 `url()` 与 `@import` 会被内联（资源转为 `data:` URL，导入的 CSS 转为文本），且不能越出主题目录；外部 `http(s)` 引用会被拦截。

## 下载

前往 [Releases](../../releases) 获取对应平台的最新版本。

| 平台 | 产物 |
| --- | --- |
| macOS（Apple Silicon / Intel） | `.dmg` |
| Windows 10+ | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` |

> macOS 构建未签名。首次启动请右键应用并选择 **打开**。

## 开发

```bash
bun install
bun run tauri dev
```

要求：Rust 工具链、Bun（或 npm），以及 [Tauri 前置依赖](https://tauri.app/start/prerequisites/) 中列出的平台依赖。

## 构建

```bash
bun run tauri build
```

## 测试

```bash
bun run test           # 运行下面全部测试
bun run test:engine    # 引擎/源码模式判定（含 200K 阈值）
bun run test:roundtrip # Markdown 解析 ↔ 序列化保真度
bun run test:cm6       # CodeMirror 6 冒烟测试
bun run test:search    # 跨节点搜索与 $1 替换
bun run test:web       # 无头 Chrome 中挂载真实组件
bun run test:rust      # CLI 参数解析（cargo test）
```

每次 push 与 pull request 都会运行这些套件（`.github/workflows/test.yml`）。

`test:web` 会启动 `devtest/`，用 Tauri IPC stub 挂载真实的
`MilkdownEditor` 与 `CodeMirror6` 组件，断言渲染出的 DOM（Front Matter、表格、任务列表、KaTeX、代码块、图表、图片、Prism token、大纲、字数），并驱动搜索面板与真实输入；任何 `console.error` 都会导致失败。`?theme=1`、`?layout=1`、`?codeblock=1`、
`?sidebar=1`、`?folders=1`、`?exportdialog=1`、`?settings=1`、`?searchmenu=1`、
`?pickers=1` 可切换到其他检查。

所有偏好都保存在同一个 JSON 文件中，完整键名见 [`docs/settings.md`](docs/settings.md)（也可从“设置 → 高级”打开）。

## 许可证

MIT。基于 ZZF 的 [Typedown](https://github.com/byxiaozhi/Typedown)（MIT License，Copyright (c) 2022 ZZF）。
