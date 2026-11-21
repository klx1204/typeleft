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
- **大纲与文件树**侧栏，支持重命名、移动、复制、删除到回收站、新建文件/文件夹
- **最近文件**菜单
- **导出配置**（HTML、CSS / Front Matter 开关）与**直接打印**
- **图片**：剪贴板粘贴、本地复制、相对路径、HTTP 图床上传
- **排版选项**：文字方向（RTL）、标题自动编号、两端对齐、列表符号/编号、正文字体/代码字体、编辑区背景色
- **主题**：明亮 / 暗色 / 跟随系统，Mermaid / Sequence / Vega 图表主题
- **双语界面**：English 与简体中文，运行时切换
- 原生菜单、快捷键、自动保存与备份

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
```

每次 push 与 pull request 都会运行这些套件（`.github/workflows/test.yml`）。

`test:web` 会启动 `devtest/`，用 Tauri IPC stub 挂载真实的
`MilkdownEditor` 与 `CodeMirror6` 组件，断言渲染出的 DOM（Front Matter、表格、任务列表、KaTeX、代码块、图表、图片、Prism token、大纲、字数），并驱动搜索面板与真实输入；任何 `console.error` 都会导致失败。`?light=1`、`?theme=1`、`?static=1`、`?cm6=1` 可切换到其他检查。

## 许可证

MIT。基于 ZZF 的 [Typedown](https://github.com/byxiaozhi/Typedown)（MIT License，Copyright (c) 2022 ZZF）。
