# Typora 功能梳理与 Typeleft 对比

- 整理日期：2026-11-14
- Typora 文档来源：<https://support.typora.io/>（共抓取 98 个页面：Quick Start 21 篇、How-To 48 篇、What's New 29 篇）
- Typeleft 代码基线：`b05abc1`（v0.1.0，Tauri 2 + React + Muya）
- 抓取方式：经本地 HTTP 代理串行抓取，每页间隔约 1.2 秒，未触发站点限流。

## 阅读说明

- **来源列** 均链接到 Typora 官方支持站对应页面，括号内为页面所属栏目。
- **Typeleft 状态** 基于源码静态检查（菜单、设置页、Rust command、Muya 引擎能力），不代表所有运行时细节；标 `🟡` 的条目表示“引擎/后端有部分能力，但 UI 或配置未完整暴露”。
- 图例：`✅ 已支持`、`🟡 部分支持`、`❌ 未支持`、`➖ 不适用`。
- Typora 的很多“功能”实际是通过 **自定义 CSS** 实现的（自动编号、字体、背景、行距、RTL、分页等）。这类条目在 Typeleft 侧统一视为“未提供对应扩展机制”，因为 Typeleft 目前没有主题文件夹和自定义 CSS 入口。

## 结论速览

本次共梳理出 **177 项可对比功能**：Typeleft 已支持 **59 项（33%）**、部分支持 **38 项（21%）**、未支持 **78 项（44%）**、不适用 **2 项**。

1. **Typeleft 已具备 Typora 的核心编辑闭环**：实时预览、GFM 语法、源码模式、查找替换、大纲、文件树、任务列表、代码块、表格、数学、脚注、上下标、Emoji、专注/打字机模式、自动保存、拼写检查、多窗口、明暗主题。
2. **差距最大的是“工作区级能力”**：Typora 有跨文件搜索、Open Quickly 模糊找文件、文件列表视图、排序/分组/过滤、文件变更监听、最近/固定文件夹、文件操作撤销；Typeleft 基本只有一棵需要手动刷新的文件树。
3. **第二差距是“导出与发布”**：Typora 内置 PDF/HTML/HTML(无样式)/图片，并通过 Pandoc 支持 Word、ePub、LaTeX、RTF、ODT、OPML、RevealJS 等，还有完整导出配置与后置动作；Typeleft 只有 HTML 导出（可开关 CSS/front matter）和系统打印。
4. **第三差距是“可定制外观”**：Typora 有主题文件夹、第三方主题、`base.user.css`、代码块样式、字体、背景、列表样式、行距、自动编号等一整套 CSS 扩展；Typeleft 只有内置 `default.css` 和明暗/图表主题选择。
5. **Typeleft 也有 Typora 没有的东西**：命令面板、PlantUML、Vega/Vega-Lite 图表、紧凑模式、窗口置顶、自定义 HTTP 图床、开源免费跨平台。

## 1. 编辑与输入

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 1 | 实时预览（Live Preview） | 行内样式输入即渲染；块级标记在块渲染后隐藏 | [Quick Start](https://support.typora.io/Quick-Start/) | ✅ | Muya 的所见即所得编辑 |
| 2 | GitHub Flavored Markdown | 以 GFM 为基准，另有扩展语法 | [Quick Start](https://support.typora.io/Quick-Start/) · [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | Muya 解析 GFM + 扩展 |
| 3 | 源码模式 | 菜单/快捷键在混合视图与源码模式间切换 | [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) | ✅ | CodeMirror 源码模式（含搜索栏） |
| 4 | 切换模式保持滚动位置 | 1.13 起源码/混合模式切换保留滚动位置 | [What's New 1.13](https://support.typora.io/What's-New-1.13/) | ✅ | 两套编辑器各自保存 `scrollTop` 并恢复 |
| 5 | 专注模式 | 淡化当前行/块之外的内容 | [Focus and Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode/) | ✅ | 设置项 `focusMode`，Muya `setFocusMode` |
| 6 | 打字机模式 | 输入时滚动文档使光标固定在屏幕中部 | [Focus and Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode/) | ✅ | 设置项 `typewriter` |
| 7 | 普通自动配对 | 自动配对括号与引号 | [Auto Pair](https://support.typora.io/Auto-Pair/) | ✅ | `autoPairBracket`、`autoPairQuote` |
| 8 | Markdown 扩展字符自动配对 | 对 `*`、`~`、反引号、`_` 等配对；开启相应语法后扩展到 `=`、`$`、`^` | [Auto Pair](https://support.typora.io/Auto-Pair/) | ✅ | `autoPairMarkdownSyntax`；受上下标/数学设置影响 |
| 9 | 智能引号（Smart Quotes） | `'`、`"` 转换为弯引号，可设置转换时机 | [SmartyPants](https://support.typora.io/SmartyPants/) | ❌ | 无智能标点设置 |
| 10 | 智能破折号/省略号 | `--`→en dash、`---`→em dash、`...`→`…` | [SmartyPants](https://support.typora.io/SmartyPants/) | ❌ | 无 |
| 11 | 严格模式 | 更严格遵循 GFM（如 `#` 后必须有空格、列表缩进） | [Strict Mode](https://support.typora.io/Strict-Mode/) | ❌ | 无开关 |
| 12 | 单行换行保留选项 | 可配置编辑/导出时是否保留软换行 | [Whitespace and Line Breaks](https://support.typora.io/Line-Break/) | ❌ | 无相关设置 |
| 13 | 删除范围命令 | 删除段落/块、行/句、样式范围、单词 | [Delete Range](https://support.typora.io/Delete-Range/) | ❌ | 仅系统默认的退格/删除行为 |
| 14 | 撤销/重做 | 完整撤销栈 | [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) | ✅ | Muya 100/50 步撤销 + 菜单 |
| 15 | 当前文件查找替换 | 大小写、全词、正则、匹配计数与替换 | [Search](https://support.typora.io/Search/) | ✅ | Muya/CodeMirror 搜索栏，设置项齐全 |
| 16 | 跨文件搜索 | 在整个文件夹中搜索，支持正则/全词/大小写 | [Search](https://support.typora.io/Search/) · [File Management](https://support.typora.io/File-Management/) | ❌ | 无 |
| 17 | Open Quickly 模糊找文件 | `Cmd/Ctrl+Shift+O` 或 `Ctrl+P` 模糊搜索当前文件夹/最近文件 | [Quick Start](https://support.typora.io/Quick-Start/) · [Search](https://support.typora.io/Search/) | ❌ | 命令面板只能执行命令或弹出系统文件对话框 |
| 18 | 自动保存 | 定时保存到原文件 | [Auto Save](https://support.typora.io/Auto-Save/) | ✅ | 每 5 秒保存（默认开启） |
| 19 | 未保存草稿恢复 | 崩溃/误退出后可恢复草稿 | [Auto Save](https://support.typora.io/Auto-Save/) · [Version Control](https://support.typora.io/Version-Control/) | 🟡 | 每 30 秒写 `.filename.backup`，仅状态栏提示 “Backup found”，无恢复 UI |
| 20 | 版本控制与恢复 | macOS 原生版本浏览；Windows/Linux 草稿恢复 | [Version Control](https://support.typora.io/Version-Control/) | ❌ | 无版本历史 |
| 21 | 拼写检查 | 系统/内置词典，多语言，学习单词 | [Spellcheck](https://support.typora.io/Spellcheck/) | 🟡 | 有开关和语言设置，使用 WebView 原生拼写检查；无词典管理/学习单词 |
| 22 | RTL（实验性） | 通过自定义 CSS `direction: rtl` 实现 | [RTL](https://support.typora.io/RTL/) | ❌ | 无自定义 CSS 入口 |
| 23 | 缩放 | 菜单缩放、触控板捏合、`Cmd/Ctrl+滚轮` | [Zoom](https://support.typora.io/Zoom/) | ❌ | 无视图缩放 |
| 24 | 全屏 | 原生全屏 | [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) | ❌ | 无菜单项 |
| 25 | 窗口置顶 / 紧凑模式 | Typora 无置顶；Typeleft 有 | — | ✅ | Typeleft 额外能力（View/Window 菜单） |
| 26 | 命令面板 | Typora 无 | — | ✅ | Typeleft 额外能力（`Cmd/Ctrl+Shift+P`） |

## 2. Markdown 块级元素

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 27 | 标题 H1–H6 | ATX/Setext，菜单与快捷键 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/命令面板/快速插入 |
| 28 | 段落与换行 | 软换行、硬换行（`<br/>`、行尾空格） | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | Muya 支持 |
| 29 | 引用块 | `>`，可嵌套 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/快速插入 |
| 30 | 无序/有序列表 | 支持标记与分隔符配置 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 设置可配置 bullet marker、分隔符、缩进 |
| 31 | 任务列表 | `- [ ]`/`- [x]`，可点击切换 | [Task List](https://support.typora.io/Task-List/) | ✅ | 菜单/快速插入；`autoCheck` 设置 |
| 32 | 代码围栏 | 三个反引号或 `~~~`，语言高亮 | [Code Fences](https://support.typora.io/Code-Fences/) | ✅ | Prism 高亮 + 语言选择器 |
| 33 | 代码块行号 | 可显示/隐藏行号 | [Code Fences](https://support.typora.io/Code-Fences/) | ❌ | 内部有行号渲染代码但未启用/无设置 |
| 34 | 代码块自动换行 | 可配置换行或横向滚动 | [Code Fences](https://support.typora.io/Code-Fences/) | 🟡 | 由 CSS 决定，无设置项 |
| 35 | 代码块默认语言 | 新建代码块自动套用默认/上次语言 | [Code Fences](https://support.typora.io/Code-Fences/) | ❌ | 无 |
| 36 | 代码块操作 | 复制代码内容、自动缩进、Shift+Tab 行为 | [Code Fences](https://support.typora.io/Code-Fences/) | 🟡 | 可选中复制、Tab 缩进；无“复制代码内容”菜单 |
| 37 | 数学块 `$$` | LaTeX 显示公式，编辑态浮层 | [Math](https://support.typora.io/Math/) | ✅ | KaTeX 渲染 |
| 38 | 行内数学 `$…$` | 可开关，含 Pandoc 风格分隔符规则 | [Math](https://support.typora.io/Math/) | ✅ | Muya 行内数学 |
| 39 | Code Block Math | 以 `math` 为语言的代码围栏 | [What's New 1.9](https://support.typora.io/What's-New-1.9/) | ❌ | 无专门处理 |
| 40 | LaTeX 分隔符 | `\(...\)`、`\[...\]`，可开关 | [What's New 1.11](https://support.typora.io/What's-New-1.11/) | ❌ | 仅 `$`/`$$` |
| 41 | MathJax 扩展能力 | physics 包、mhchem 化学式、自定义宏 | [Math](https://support.typora.io/Math/) | 🟡 | KaTeX 基础命令可用；无 physics/mhchem 专用开关 |
| 42 | 公式自动编号 | AMS 规则或全部编号 | [Math](https://support.typora.io/Math/) | ❌ | 无 |
| 43 | 公式交叉引用 | `\label`/`\ref` | [Math](https://support.typora.io/Math/) | ❌ | 无 |
| 44 | 表格 | 插入/编辑表格 | [Table Editing](https://support.typora.io/Table-Editing/) | ✅ | 表格选择器插入 |
| 45 | 表格增删行列 | 菜单、右键、快捷键、Tab 新增行 | [Table Editing](https://support.typora.io/Table-Editing/) | 🟡 | 引擎有增删逻辑；表格浮动工具条消息无消费者，UI 不完整 |
| 46 | 表格列宽调整 | 拖动表格工具提示缩放 | [Table Editing](https://support.typora.io/Table-Editing/) | 🟡 | 支持拖拽列宽，缺完整工具条 |
| 47 | 表格列对齐 | 左/中/右，写入 GFM 对齐 | [Table Editing](https://support.typora.io/Table-Editing/) | 🟡 | 引擎有对齐逻辑，缺菜单入口 |
| 48 | 表格行列拖动排序 | 拖拽行/列边缘移动 | [Table Editing](https://support.typora.io/Table-Editing/) | ❌ | 无 |
| 49 | 脚注 | `[^id]`，悬浮预览 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | FootnoteTool + 设置 `footnote` |
| 50 | 水平线 | `***`/`---`/`___` | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/快速插入 |
| 51 | YAML Front Matter | 文档元数据，导出时使用 | [YAML Front Matter](https://support.typora.io/YAML/) | 🟡 | 可编辑/渲染 front matter；导出时可选择剔除；不读取元数据 |
| 52 | TOC 块 | `[toc]` 自动生成目录并随文档更新 | [TOC](https://support.typora.io/TOC/) | ❌ | 编辑态 `updateParagraph('toc')` 为空实现；仅导出 HTML 时 marked 可把 `[toc]` 替换为计算的目录 |
| 53 | GitHub Alerts / Callouts | `> [!NOTE]` 等 5 种提示块 | [What's New 1.8](https://support.typora.io/What's-New-1.8/) · [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ❌ | 无 |
| 54 | HTML 块 | 原样渲染/预览 HTML 块 | [HTML Support](https://support.typora.io/HTML/) | ✅ | Muya HTML 块 |
| 55 | Mermaid | 流程图、时序图、甘特、类图、状态图、饼图、思维导图、时间线、象限图、桑基图、看板、架构图、雷达图、矩形树图、Venn、Ishikawa 等 | [Draw Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) · [What's New 1.10](https://support.typora.io/What's-New-1.10/) · [What's New 1.11](https://support.typora.io/What's-New-1.11/) · [What's New 1.13](https://support.typora.io/What's-New-1.13/) | 🟡 | Mermaid 8.13；基础图可用，新图类型缺失 |
| 56 | 流程图（flowchart.js） | 独立 flowchart 语法 | [Draw Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) | ✅ | Muya flowchart 容器块 |
| 57 | 时序图 | 独立 sequence 语法 | [Draw Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) | ✅ | Muya sequence 容器块 |
| 58 | PlantUML | Typora 无原生容器块；仅能用 gravizo 图片链接间接渲染 | [What's New 0.9.54](https://support.typora.io/What's-New-0.9.54/) | ✅ | Typeleft 额外能力（容器块 + 快速插入） |
| 59 | Vega / Vega-Lite | Typora 文档只列 Mermaid、flowchart、sequence，无 Vega | [Draw Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) | ✅ | Typeleft 额外能力（含 vega 主题设置） |
| 60 | 视频/音频嵌入 | `<video>`/`<audio>`，拖入视频自动插入 | [Media](https://support.typora.io/Media/) | 🟡 | HTML 块可渲染；无拖入自动插入 |
| 61 | iframe / 网页嵌入 | 粘贴 iframe 嵌入网页 | [Media](https://support.typora.io/Media/) | 🟡 | HTML 块渲染；取决于 WebView 安全策略 |
| 62 | 分页 | 打印/PDF 自动或强制分页（CSS） | [Page Breaks](https://support.typora.io/Page-Breaks/) | ❌ | 无分页标记/打印 CSS 支持 |

## 3. 行内元素与剪贴板

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 63 | 粗体 / 斜体 | `**`/`*`，菜单与快捷键 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/命令面板/浮层 |
| 64 | 行内代码 | 反引号 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/浮层 |
| 65 | 删除线 | `~~text~~` | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 菜单/浮层 |
| 66 | 链接（内联/引用/自动） | 三种写法，自动识别 URL | [Links](https://support.typora.io/Links/) | ✅ | 插入/编辑/自动识别可用；`Cmd/Ctrl+点击`用系统默认程序打开外链 |
| 67 | 内部锚点链接 | 标题锚点跳转 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 链接弹层可跳转锚点（依赖浏览器锚点） |
| 68 | 文件链接 | 链接到本地文件/文件夹，目标不存在可一键创建 | [File Management](https://support.typora.io/File-Management/) | ❌ | 不解析本地文件链接 |
| 69 | 图片 | Markdown 图片语法 | [Images](https://support.typora.io/Images/) | ✅ | 插入/粘贴/拖拽 |
| 70 | Emoji | `:smile:` 自动补全，系统 Emoji 面板 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | EmojiPicker + 行内 emoji 解析 |
| 71 | 下标 / 上标 | `~x~`、`^x^`，可开关 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ✅ | 设置项 `superSubScript` |
| 72 | 高亮 | `==highlight==`，可开关 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | ❌ | 解析规则与设置均无 |
| 73 | 下划线 | `<u>text</u>` | [Markdown Reference](https://support.typora.io/Markdown-Reference/) | 🟡 | 依赖 HTML 渲染；无专门语法/按钮 |
| 74 | 行内 HTML 样式 | `<span style=...>` 等 | [HTML Support](https://support.typora.io/HTML/) | ✅ | 可渲染（可全局关闭 HTML 渲染） |
| 75 | 自动链接开关 | 可关闭 URL/邮箱自动识别 | [What's New 1.6](https://support.typora.io/What's-New-1.6/) | 🟡 | 默认开启，无设置开关 |
| 76 | 复制为 Markdown / HTML / 纯文本 | 菜单/快捷键复制不同格式 | [Copy and Paste](https://support.typora.io/Copy-and-Paste/) | 🟡 | Muya 内部实现多格式复制，无用户菜单/快捷键；复制默认写 HTML+Markdown 文本 |
| 77 | 智能粘贴 | 粘贴 HTML 自动转 Markdown；纯文本粘贴 | [Copy and Paste](https://support.typora.io/Copy-and-Paste/) | 🟡 | 引擎有 HTML→Markdown 粘贴逻辑，但菜单粘贴只读取纯文本/图片，实际不会转换 HTML |
| 78 | 默认复制行为可配置 | 可选“复制 Markdown 源码为纯文本” | [Copy and Paste](https://support.typora.io/Copy-and-Paste/) | ❌ | 无设置 |

## 4. 文件、文件夹与工作区

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 79 | 打开文件 / 打开文件夹 | 文件对话框；打开文件自动载入父文件夹 | [File Management](https://support.typora.io/File-Management/) | ✅ | 打开文件/文件夹 |
| 80 | 文件树侧栏 | 层级展示当前文件夹 | [Quick Start](https://support.typora.io/Quick-Start/) | ✅ | 文件树 |
| 81 | 文件列表视图 | 平铺文件列表，可与文件树切换 | [File Management](https://support.typora.io/File-Management/) | ❌ | 只有文件树 |
| 82 | 大纲面板 | 文档标题树，点击跳转、高亮当前标题 | [Outline](https://support.typora.io/Outline/) | ✅ | 大纲面板 |
| 83 | 大纲过滤/搜索 | 按关键词过滤标题 | [Outline](https://support.typora.io/Outline/) | ❌ | 无 |
| 84 | 大纲折叠/扁平切换 | 两种显示模式 | [Outline](https://support.typora.io/Outline/) | ❌ | 仅默认展示 |
| 85 | 文件树键盘导航 | 1.14 支持方向键浏览 | [What's New 1.14](https://support.typora.io/What's-New-1.14/) | ❌ | 鼠标操作 |
| 86 | 侧栏文件过滤 | 1.14 可显示隐藏文件、非 Markdown 文件或自定义 | [What's New 1.14](https://support.typora.io/What's-New-1.14/) | ❌ | 无 |
| 87 | 文件排序 / 分组 | 名称、自然序、修改/创建时间，按文件夹分组 | [File Management](https://support.typora.io/File-Management/) | ❌ | 固定顺序 |
| 88 | 文件操作 | 新建、重命名、移动、复制、删除到回收站 | [File Management](https://support.typora.io/File-Management/) | ✅ | 侧栏右键菜单 |
| 89 | 拖拽移动文件 | 文件树内拖拽移动，支持从 Finder/Explorer 拖入 | [File Management](https://support.typora.io/File-Management/) | ❌ | 拖入文件是“打开”，不是移动 |
| 90 | 拖入文件可配置 | 1.6 起可选“打开/导入”或“插入文件链接” | [What's New 1.6](https://support.typora.io/What's-New-1.6/) | ❌ | 固定为打开文件 |
| 91 | 撤销文件操作 | 撤销上一次移动/重命名/删除 | [File Management](https://support.typora.io/File-Management/) | ❌ | 无 |
| 92 | 固定文件夹 / 最近文件夹 | 侧栏最近位置，可固定、移除 | [File Management](https://support.typora.io/File-Management/) · [What's New 1.7](https://support.typora.io/What's-New-1.7/) | 🟡 | 后端有 recent folders 命令；侧栏无最近/固定列表 |
| 93 | 最近文件 | 菜单打开最近文件，可清空 | [File Management](https://support.typora.io/File-Management/) | ✅ | File → Recent Files |
| 94 | 文件变更监听 | 外部改动后自动刷新文件树/列表 | [File Management](https://support.typora.io/File-Management/) | ❌ | 手动刷新按钮 |
| 95 | 标签搜索 | 不支持 `#tag` 语法，但全局搜索 `#tag` 可找文件 | [File Management](https://support.typora.io/File-Management/) | ❌ | 无全局搜索 |
| 96 | 启动行为 | 新建/恢复上次文件夹/恢复上次文件/打开指定文件夹 | [Launch Options](https://support.typora.io/Launch-Options/) | 🟡 | 可“恢复上次文件/文件夹”，无自定义文件夹/新建选项 |
| 97 | 右键新建 Markdown（Windows） | 资源管理器“新建 → Markdown” | [New File in Context](https://support.typora.io/New-File-in-Context/) | ❌ | 未注册 |
| 98 | Windows JumpList | 任务栏最近/固定文件 | [Typora on Windows](https://support.typora.io/Typora-on-Windows/) | ❌ | 无 |
| 99 | macOS 文档型 App / Quick Look / Share | 系统级文档集成、快速预览、分享 | [Typora on macOS](https://support.typora.io/Typora-on-macOS/) | ❌ | 无 |
| 100 | 多窗口 | 打开新窗口/在新窗口打开文件 | [File Management](https://support.typora.io/File-Management/) · [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) | ✅ | 菜单 New Window（不含“在新窗口打开文件”） |
| 101 | 文件双开/标签页 | Typora 为单文档窗口，无标签页 | — | ➖ | 两者均无标签页 |

## 5. 搜索、导航与统计

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 102 | 当前文档查找 | `Cmd/Ctrl+F` | [Search](https://support.typora.io/Search/) | ✅ | 搜索栏 |
| 103 | 当前文档替换 | `Cmd/Ctrl+H`，支持正则替换组 | [Search](https://support.typora.io/Search/) | ✅ | 替换/全部替换 |
| 104 | 匹配计数 | 显示当前匹配序号/总数 | [What's New 1.3](https://support.typora.io/What's-New-1.3/) | ✅ | 搜索栏显示 matches |
| 105 | 跨文件搜索 | 侧栏搜索整个文件夹 | [Search](https://support.typora.io/Search/) | ❌ | 无 |
| 106 | 文件名模糊搜索 | Open Quickly | [Search](https://support.typora.io/Search/) | ❌ | 无 |
| 107 | 字数统计 | 悬停/常显；选中文本单独统计 | [Word Count](https://support.typora.io/Word-Count/) | ✅ | 状态栏字数/字符数；两种统计方式 |
| 108 | 大纲导航 | 点击标题跳转，滚动时高亮当前位置 | [Outline](https://support.typora.io/Outline/) | ✅ | 大纲点击跳转 |
| 109 | 文档内锚点跳转 | 链接跳转到标题 | [Links](https://support.typora.io/Links/) | ✅ | 依赖锚点滚动 |

## 6. 图片与媒体

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 110 | 插入图片（菜单/拖拽/粘贴） | 支持多图拖入、剪贴板图片、本地选择 | [Images](https://support.typora.io/Images/) | ✅ | 三种方式均支持 |
| 111 | 插入本地图片时复制到指定文件夹 | 按文档 YAML 或全局设置复制 | [Images](https://support.typora.io/Images/) | 🟡 | `insertLocalImageAction=copyToPath` 固定复制到 `<文档目录>/images`，不能自定义目标文件夹 |
| 112 | 图片相对路径 | 可优先使用相对路径、`./` 前缀 | [Images](https://support.typora.io/Images/) | 🟡 | 有 `preferRelativeImagePaths`；无 `./` 前缀选项 |
| 113 | 图片 URL 编码 | 自动转义含空格等字符的路径 | [Images](https://support.typora.io/Images/) | 🟡 | `autoEncodeImageURL` 仅对 `http(s)` URL 生效，本地路径不转义 |
| 114 | 图片根路径 `typora-root-url` | YAML 指定预览根路径 | [Images](https://support.typora.io/Images/) | ❌ | 无 |
| 115 | 上传图片到图床 | 插入时/批量上传 | [Upload Images](https://support.typora.io/Upload-Image/) | 🟡 | 仅自定义 HTTP 上传（host/port/token/baseUrl） |
| 116 | 图床工具生态 | iPic、uPic、PicGo-Core、PicGo.app、PicList、Picsee、Upgit、自定义命令 | [Upload Images](https://support.typora.io/Upload-Image/) | ❌ | 不支持第三方上传器/自定义命令 |
| 117 | 全部图片上传/下载 | 把所有本地图片上传或把远程图片下载到本地 | [Images](https://support.typora.io/Images/) | ❌ | 无批量操作 |
| 118 | 移动/复制全部图片 | 整理图片目录并更新引用 | [Images](https://support.typora.io/Images/) | ❌ | 无 |
| 119 | 重命名/移动/复制单张图片 | 右键操作并更新 Markdown 路径 | [Images](https://support.typora.io/Images/) | ❌ | 无 |
| 120 | 删除图片同时删除磁盘文件 | 右键 Delete Image | [Images](https://support.typora.io/Images/) | ❌ | 无 |
| 121 | 图片对齐 | 左/中/右（写入 `data-align`） | [Images](https://support.typora.io/Images/) | 🟡 | 引擎有 `data-align` 更新逻辑，工具栏 UI 未接入 |
| 122 | 图片缩放 | 拖拽调整尺寸（写入 HTML width/height） | [Resize Images](https://support.typora.io/Resize-Image/) | ❌ | 无 |
| 123 | 媒体相对路径 | 视频/音频跟随图片路径规则 | [Media](https://support.typora.io/Media/) | 🟡 | HTML 媒体可渲染，无专门路径处理 |
| 124 | 拖入视频自动插入 | 拖入视频文件生成 `<video>` | [Media](https://support.typora.io/Media/) | ❌ | 拖入会被当作 Markdown 文件打开 |

## 7. 外观、主题与排版

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 125 | 明暗主题切换 | 主题 + 明暗模式分别配置 | [About Themes](https://support.typora.io/About-Themes/) · [Dark Mode](https://support.typora.io/Dark-Mode/) | ✅ | light/dark/system |
| 126 | 第三方/自定义主题 | 主题文件夹安装 CSS 主题 | [About Themes](https://support.typora.io/About-Themes/) | ❌ | 仅内置 `default.css` |
| 127 | 打开主题文件夹 | 菜单打开主题目录 | [About Themes](https://support.typora.io/About-Themes/) | ❌ | 无 |
| 128 | 自定义 CSS（`base.user.css`） | 全局/单主题追加 CSS | [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/) | ❌ | 无自定义 CSS 入口 |
| 129 | 代码块样式 | 自定义代码块主题 CSS | [Code Block Styles](https://support.typora.io/Code-Block-Styles/) | ❌ | 固定样式 |
| 130 | 自定义字体 | CSS 设置正文字体/代码字体/字号 | [Custom Fonts](https://support.typora.io/Custom-Font/) | 🟡 | 仅字号 `fontSize`，无字体族设置 |
| 131 | 背景 | 自定义编辑区背景 | [Change Background](https://support.typora.io/Backgound/) | ❌ | 随主题固定 |
| 132 | 行距/段距 | CSS 调整行高与段间距 | [Line Spacing](https://support.typora.io/Line-Spacing/) | 🟡 | 有行高 `lineHeight`，无段距 |
| 133 | 编辑区宽度 | 设置写作区宽度 | [Width of Writing Area](https://support.typora.io/Width-of-Writing-Area/) | ✅ | `editorAreaWidth` |
| 134 | 列表样式 | 自定义项目符号/编号样式 | [List Style](https://support.typora.io/List-Style/) | ❌ | 固定样式 |
| 135 | 标题自动编号 | CSS counter 实现 | [Auto Numbering](https://support.typora.io/Auto-Numbering/) | ❌ | 无自定义 CSS |
| 136 | 专注模式样式 | 自定义淡化效果 | [Change Styles in Focus Mode](https://support.typora.io/Change-Styles-in-Focus-Mode/) | ❌ | 固定样式 |
| 137 | 主题调试 | 开发者工具/调试 CSS | [Debug Themes](https://support.typora.io/Debug-Themes/) | ❌ | 无内置调试入口 |
| 138 | CSS 排版 | 大写标题、小型大写、连字、两端/居中/右对齐、竖排 | [Typeset](https://support.typora.io/Typeset/) | ❌ | 无自定义 CSS |
| 139 | VLOOK 主题/插件 | 第三方增强主题套件 | [Install and Use VLOOK](https://support.typora.io/Install-and-Use-VLOOK/) | ❌ | 无 |

## 8. 导出、打印与导入

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 140 | 导出 HTML | 含主题样式、可带大纲侧栏 | [Export](https://support.typora.io/Export/) | ✅ | HTML 导出，可含 CSS/front matter |
| 141 | 导出 HTML（无样式） | 纯 HTML，不带主题 | [Export](https://support.typora.io/Export/) | 🟡 | 通过关闭 “Include CSS” 近似实现 |
| 142 | 导出 PDF | 页面大小、边距、页眉页脚、元数据、独立主题 | [Export](https://support.typora.io/Export/) | 🟡 | 走系统打印对话框生成 PDF，无导出配置 |
| 143 | 导出图片 | PNG/JPEG 等图片格式 | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 144 | 导出 Word (.docx) | 通过 Pandoc，可指定样式参考文档 | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 145 | 导出 ODT / RTF / ePub / LaTeX | 通过 Pandoc | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 146 | 导出 Wiki / RST / Textile / OPML | 通过 Pandoc | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 147 | 导出 RevealJS 演示 | 通过 Pandoc | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 148 | Pandoc 集成 | 自动检测/手动配置 pandoc 路径 | [Install and Use Pandoc](https://support.typora.io/Install-and-Use-Pandoc/) | ❌ | 无 |
| 149 | 自定义导出命令 | 任意命令行工具 + 变量 | [Export](https://support.typora.io/Export/) | ❌ | 无 |
| 150 | 导出配置管理 | 新增/改名/删除/排序导出项 | [Export](https://support.typora.io/Export/) | 🟡 | 可保存多套 HTML 导出配置，仅 HTML |
| 151 | 导出位置/后置动作 | 默认目录、导出后打开文件/目录 | [Export](https://support.typora.io/Export/) | 🟡 | 可设输出目录；无后置动作 |
| 152 | 每文档导出配置 | YAML 覆盖导出设置 | [YAML Front Matter](https://support.typora.io/YAML/) | ❌ | 无 |
| 153 | HTML 导出大纲 | 可选是否带目录侧栏 | [Export](https://support.typora.io/Export/) | 🟡 | 生成 HTML 时计算了 TOC 数据，UI 无开关 |
| 154 | 打印 | 原生打印 | [Export](https://support.typora.io/Export/) | ✅ | 菜单 Print |
| 155 | 导入非 Markdown 文件 | Pandoc 导入 docx/rtf 等 | [Export](https://support.typora.io/Export/) | 🟡 | 仅导入 HTML 并转 Markdown |
| 156 | Markdown 格式转换/重排 | 通过 Pandoc 导出为其他 Markdown 规范 | [Markdown Export](https://support.typora.io/Markdown-Export/) | ❌ | 无 |

## 9. 偏好设置与自动化

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 157 | 图形化偏好设置 | 编辑器/图片/文件/Markdown/导出/外观等分组 | [Quick Start](https://support.typora.io/Quick-Start/) · [Export](https://support.typora.io/Export/) | ✅ | 设置页含 Editor/Search/Markdown/Auto Pair/Extensions/Theme/Image/Other |
| 158 | 自动保存开关 | 可关闭自动保存 | [Auto Save](https://support.typora.io/Auto-Save/) | ✅ | `autoSave` |
| 159 | 自动配对开关 | 普通配对/扩展配对分别开关 | [Auto Pair](https://support.typora.io/Auto-Pair/) | ✅ | 三个独立开关 |
| 160 | Markdown 语法开关 | 上下标、脚注、GitLab 兼容、数学、自动链接等 | [Markdown Reference](https://support.typora.io/Markdown-Reference/) · [What's New 1.6](https://support.typora.io/What's-New-1.6/) | 🟡 | 有上下标/脚注/GitLab/HTML 开关；无自动链接、数学、Alerts 开关 |
| 161 | 文件设置组 | 默认扩展名、拖放行为、最近记录 | [What's New 1.6](https://support.typora.io/What's-New-1.6/) | ❌ | 无 |
| 162 | 高级配置文件 | `conf.user.json` 深度配置 | [Advanced Config](https://support.typora.io/Advance-Config/) | 🟡 | 设置存 JSON，但无文档化高级配置入口 |
| 163 | 自定义快捷键 | macOS/Windows 分别改键 | [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) | ❌ | 固定快捷键 |
| 164 | 文本片段/替换 | 不支持内置，依赖系统/第三方 | [Text Snippets](https://support.typora.io/Text-Snippet/) | ❌ | 两者均无内置 |
| 165 | 添加搜索服务 | 右键用自定义搜索引擎搜索选中文本 | [Add Search Service](https://support.typora.io/Add-Search-Service/) | ❌ | 无 |
| 166 | 日志 | 导出/查看日志用于报错 | [Get Logs](https://support.typora.io/Get-Logs/) | 🟡 | 仅 stderr 输出，无日志面板/导出 |
| 167 | 自动更新 | 内置更新检查 | [What's New 1.0](https://support.typora.io/What's-New-1.0/) | ❌ | 无 updater 插件 |
| 168 | 多语言 UI | 多语言界面，1.13 新增爱尔兰语 | [Languages Support](https://support.typora.io/Languages-Support/) · [What's New 1.13](https://support.typora.io/What's-New-1.13/) | 🟡 | 英文/简体中文，运行时切换 |

## 10. 系统集成与平台特性

| # | Typora 功能 | Typora 行为说明 | 来源 | Typeleft 状态 | Typeleft 现状 |
|---|---|---|---|---|---|
| 169 | 命令行打开文件 | `typora file.md` | [Use Typora from Shell or Cmd](https://support.typora.io/Use-Typora-From-Shell-or-cmd/) | 🟡 | 支持 macOS `Opened` 事件（双击/打开方式）；无 CLI 子命令 |
| 170 | 启动参数（Windows/Linux） | `--new`、`--args` 等 | [Launch Arguments](https://support.typora.io/Launch-Arguments/) | ❌ | 不解析 argv |
| 171 | Sublime “Open in Typora” | macOS 插件 | [Sublime](https://support.typora.io/Sublime/) | ❌ | 无 |
| 172 | VS Code / Cursor 扩展 | 右键 “Open in Typora” | [VS Code Extension](https://support.typora.io/Open-in-Typora-VS-Code-Extension/) | ❌ | 无 |
| 173 | macOS Services / 连续互通相机 / 词典 / Touch Bar | 系统服务集成 | [Typora on macOS](https://support.typora.io/Typora-on-macOS/) | ❌ | 无 |
| 174 | macOS 拼写/语法检查、替换 | 系统级编辑能力 | [Typora on macOS](https://support.typora.io/Typora-on-macOS/) | 🟡 | WebView 原生拼写检查，无语法检查/替换 |
| 175 | Linux 安装包 | deb/Snap/AppImage 等 | [Typora on Linux](https://support.typora.io/Typora-on-Linux/) · [Snap](https://support.typora.io/Snap/) | ✅ | AppImage/deb（跨平台打包） |
| 176 | 移动端/同步 | 通过 iCloud/Dropbox 等同步，官方移动端 | [Sync](https://support.typora.io/Sync/) | ❌ | 无移动端/同步功能（可用外部同步） |
| 177 | 商业授权/激活 | 14 天试用、许可证激活 | [Activate Typora](https://support.typora.io/activation/) | ➖ | Typeleft 开源免费 |

## 11. What's New 逐版本新增能力

> 这一节按版本列出官方 “What's New” 中可验证的功能增量，便于判断 Typora 近期演进方向。0.9.x 为 beta 历史版本，仅保留对现状仍有意义的条目。

| 版本 | 新增/改进功能 | 来源 | Typeleft 状态 |
|---|---|---|---|
| 1.14（2026-07） | 浮动编辑器工具栏；侧栏文件过滤（隐藏文件/非 Markdown 自定义）；文件树键盘导航；macOS 样式右键菜单 | [What's New 1.14](https://support.typora.io/What's-New-1.14/) | ❌ 全部未支持（Typeleft 无浮动工具栏） |
| 1.13（2026-04） | MathJax v4（默认支持 `\\` 换行、新 TeX 包）；Mermaid 11.13（Venn、Ishikawa）；VS Code/Cursor 扩展；改 Markdown 设置无需重启；源码/混合模式保持滚动；Copy as Plain Text | [What's New 1.13](https://support.typora.io/What's-New-1.13/) | 🟡 仅“滚动位置保持”；其余未支持 |
| 1.12（2025-09） | macOS Tahoe 适配；右键“Share”分享；新窗口样式/菜单图标 | [What's New 1.12](https://support.typora.io/What's-New-1.12/) | ❌ 未支持 |
| 1.11（2025-08） | LaTeX 分隔符 `\(...\)`/`\[...\]`；Alt+↑/↓ 移动行/段落；Mermaid 11.9（雷达图、矩形树图）；复制粘贴/视频图片/Emoji 改进；Wayland | [What's New 1.11](https://support.typora.io/What's-New-1.11/) | ❌ 均未支持（LaTeX 分隔符、移动行、新图类型） |
| 1.10（2025-02） | PDF 导出支持深色主题/页面背景；Mermaid 11.4（Packet、Kanban、Architecture）；GitHub Alert 可整段转换；代码/图片改进；TextBundle（开发版） | [What's New 1.10](https://support.typora.io/What's-New-1.10/) | ❌ 全部未支持 |
| 1.9（2024-06） | Code Block Math（以 `math` 为语言的代码围栏）；ePub 导出章节层级；Mermaid 10.9 Block Diagram；标题锚点规范 | [What's New 1.9](https://support.typora.io/What's-New-1.9/) | ❌ 未支持 |
| 1.8（2024-01） | GitHub Alerts/Callouts；`Cmd/Ctrl+滚轮` 缩放；Mermaid XY Chart；Linux 暗色自动检测；Windows 右键新建 Markdown | [What's New 1.8](https://support.typora.io/What's-New-1.8/) | ❌ 未支持 |
| 1.7（2023-09） | 固定/最近文件夹；图表右键删除；Mermaid 10.3（象限图、桑基图、ZenUML）；代码语言改进 | [What's New 1.7](https://support.typora.io/What's-New-1.7/) | ❌ 未支持 |
| 1.6（2023-05） | 设置新增“文件”组（默认扩展名、拖放行为）；关闭自动链接；默认代码语言；Mermaid 时间线图；PicList 上传 | [What's New 1.6](https://support.typora.io/What's-New-1.6/) | ❌ 未支持 |
| 1.5（2023-02） | 代码高亮语言扩充；Mermaid 9.2 思维导图；Shift+Tab 反缩进；源码模式改进 | [What's New 1.5](https://support.typora.io/What's-New-1.5/) | 🟡 Shift+Tab 反缩进支持；其余未支持 |
| 1.4（2022-09） | 文件树排序/按文件夹分组/按创建时间排序；Open Quickly 匹配路径；MathJax 3.2.2、AMS 公式编号、公式复制为图片；Mermaid 9.1.2 gitGraph；表格/查找替换/图片改进 | [What's New 1.4](https://support.typora.io/What's-New-1.4/) | 🟡 文件树与搜索部分；公式编号/复制为图片/gitGraph 无 |
| 1.3（2022-06） | 正则查找替换与匹配计数；跨文件正则搜索；Save Resources As；图片批量下载/移动/复制；复制/粘贴为；Windows/Linux iframe | [What's New 1.3](https://support.typora.io/What's-New-1.3/) | 🟡 当前文件正则查找；其余未支持 |
| 1.2（2022-03） | Mermaid 8.14（requirementDiagram）；删除图片文件；移动图片；Picsee 上传 | [What's New 1.2](https://support.typora.io/What's-New-1.2/) | 🟡 Mermaid 基础；图片管理未支持 |
| 1.1（2022-02） | 文件链接（目标不存在可一键创建）；数学/编辑/UI/安全/图片导出改进；命令行 | [What's New 1.1](https://support.typora.io/What's-New-1.1/) | ❌ 文件链接未支持 |
| 1.0（2021-11） | 正式版；ARM 构建；MathJax 3 与 displaylines 选项 | [What's New 1.0](https://support.typora.io/What's-New-1.0/) | 🟡 ARM 构建；数学选项无 |
| 0.11（2021-07） | 追加最终换行选项；打开链接/复制链接地址；YAML 以 `...` 结束；代码围栏 GFM 兼容 | [What's New 0.11](https://support.typora.io/What's-New-0.11/) | 🟡 链接打开；其余无 |
| 0.10（2021-04） | 导出配置面板（增删/改名/排序）；PDF 页面/页眉页脚/元数据/独立主题；HTML 大纲；代码语言自动补全 | [What's New 0.10](https://support.typora.io/What's-New-0.10/) | 🟡 HTML 导出配置；PDF/大纲/自动补全无 |

### 0.9.x beta 中仍影响现状的里程碑

| 版本 | 功能 | 来源 | Typeleft 状态 |
|---|---|---|---|
| 0.9.98 | Apple Silicon 原生；主题可在偏好设置切换并分别设置明暗主题、支持 `prefers-color-scheme`；Mermaid 8.8.3 + `--mermaid-theme`；复制图片内容 | [What's New 0.9.98](https://support.typora.io/What's-New-0.9.98/) | 🟡 明暗主题有；主题切换/复制图片内容无 |
| 0.9.90 | UTF-8 BOM；侧栏排序改进；支持 Azure `[[_TOC_]]` 与 `id` 锚点；表格解析改进；Mermaid 8.5.2（ER 图） | [What's New 0.9.90](https://support.typora.io/What's-New-0.9.90/) | 🟡 锚点；TOC/排序/ER 图无 |
| 0.9.84 | 全平台图片上传（uPic、PicGo-Core、PicGo.app、自定义命令）；脚注快速跳转；失败图片自动重载；拼写检查忽略 HTML 实体 | [What's New 0.9.84](https://support.typora.io/What's-New-0.9.84/) | 🟡 脚注跳转有；上传仅 HTTP |
| 0.9.80 | Mermaid 新增类图、状态图等 | [What's New 0.9.80](https://support.typora.io/What's-New-0.9.80/) | 🟡 Mermaid 基础支持，具体图类型受版本限制 |
| 0.9.73 | 新版偏好设置面板（含设置搜索）；表格/图片菜单；视图缩放与触控板捏合；暗色模式改进；Windows 内置更新器；图片 URL 自动转义；图片右键菜单 | [What's New 0.9.73](https://support.typora.io/What's-New-0.9.73/) | 🟡 部分设置/图片菜单；缩放/更新器/右键菜单无 |
| 0.9.71 | 代码高亮语言扩充；文件排序降序、忽略 `.git`、多窗口同文档同步；图片 `align` 属性；导出 PDF 超尺寸图缩放、可读锚点 | [What's New 0.9.71](https://support.typora.io/What's-New-0.9.71/) | 🟡 多窗口；PDF/排序/图片 align 无 |
| 0.9.66 | 拖拽插入文件链接；Emoji 自动补全默认开启；流程图库更新；阅读速度配置；搜索性能 | [What's New 0.9.66](https://support.typora.io/What's-New-0.9.66/) | 🟡 Emoji 补全有；文件链接/阅读速度无 |
| 0.9.63 | Windows JumpList；Open Quickly 分组并实时更新；侧栏全路径提示；无主题样式复制；mhchem 3.3；源码模式右键菜单 | [What's New 0.9.63](https://support.typora.io/What's-New-0.9.63/) | 🟡 源码右键/数学；Open Quickly/复制格式无 |
| 0.9.61 | 全局搜索；拖拽移动文件并从侧栏拖入写作区插入链接；字数统计改进；文件操作确认对话框 | [What's New 0.9.61](https://support.typora.io/What's-New-0.9.61/) | 🟡 字数统计/确认；全局搜索/拖拽移动无 |
| 0.9.59 | 多语言拼写检查；Mojave 暗色模式；文件树按名称/自然序/修改时间排序；侧栏宽度记忆；专注/打字机模式提示 | [What's New 0.9.59](https://support.typora.io/What's-New-0.9.59/) | 🟡 暗色/侧栏宽度/模式提示；排序无 |
| 0.9.58 | 插入图片时复制到自定义文件夹（支持 `${filename}`）；数学块复制到 Word；HTML 渲染安全修复 | [What's New 0.9.58](https://support.typora.io/What's-New-0.9.58/) | ✅ 图片复制到路径；其余无 |
| 0.9.54 | 单行换行遵循 CommonMark（不再打断行内样式）；支持 gravizo 渲染 PlantUML/DOT/UMLGraph | [What's New 0.9.54](https://support.typora.io/What's-New-0.9.54/) | 🟡 换行渲染；gravizo 无 |

## 12. Typeleft 相对 Typora 的额外能力

| 能力 | 说明 | 代码依据 |
|---|---|---|
| 命令面板 | `Cmd/Ctrl+Shift+P` 搜索并执行命令 | `src/components/CommandPalette/index.tsx` |
| PlantUML 图 | 容器块 + 快速插入菜单 | `Muya/lib/ui/quickInsert/config.js` |
| Vega / Vega-Lite | 容器块渲染 + 图表主题设置 | `Muya/lib/ui/quickInsert/config.js`、`SettingsPage` |
| 紧凑模式 | 隐藏窗口装饰的原生紧凑模式 | `ToggleCompactMode` + Rust `set_compact_mode` |
| 窗口置顶 | Always on Top | `ToggleAlwaysOnTop` + Rust `set_always_on_top` |
| 自定义 HTTP 图床 | 任意 HTTP 上传接口 + Token + 公共 URL | `ImageConfigDialog`、Rust `upload_image` |
| 开源、免费、跨平台 | MIT，macOS/Windows/Linux | `README.md`、`LICENSE` |
| 运行时切换中英文 | 无需重启 | `services/i18n.ts` |
| 备份文件 | 每 30 秒写 `.filename.backup` | `Editor/index.tsx`、Rust `save_backup` |

## 13. 主要缺口与建议优先级

### P0：影响日常写作效率

1. **跨文件搜索 + Open Quickly**（缺口 #16、#17、#105、#106）
   - 现状：只有当前文档查找替换；命令面板不能模糊找文件。
   - 建议：先做当前文件夹的文件名模糊索引（复用 `list_directory`），再做内容搜索（Rust 侧遍历 + 结果面板）。
2. **导出能力**（#140–#149）
   - 现状：HTML + 打印。
   - 建议：优先补 PDF 导出配置（复用现有 `print_html` 的隐藏窗口，但增加纸张/页边距/页眉页脚/主题），其次接 Pandoc（检测路径 + 预设 docx/ePub/LaTeX）。
3. **图片管理**（#117–#122）
   - 现状：能插入/上传，不能整理。
   - 建议：实现“全部图片复制/移动到文件夹并重写引用”“删除图片时询问是否删磁盘文件”“拖拽缩放写入 width”。
4. **TOC 与高亮**（#52、#72）
   - 现状：Muya 有 `tocCtrl` 数据但 `[toc]` 为空实现；无 `==` 规则。
   - 建议：补 `tocCtrl` 渲染与 `[toc]` 解析；补 `highlight` 行内规则和设置开关。

### P1：影响工作区体验

5. **文件树增强**（#81、#85–#87、#94）
   - 文件列表视图、排序/分组、文件过滤、文件系统监听、键盘导航。
6. **主题与自定义 CSS**（#126–#138）
   - 增加主题目录、`custom.css` 注入、字体/背景/代码块样式入口；这会一次性解锁自动编号、RTL、分页等大量“CSS 型功能”。
7. **表格工具条**（#45–#48）
   - 现有 `OpenTableTools` 消息没有消费者，补一个表格浮动工具条即可支持增删行列、对齐、移动。
8. **代码块设置**（#33–#36）
   - 行号、自动换行、默认语言、复制代码内容。
9. **公式增强**（#41–#43、#39、#40）
   - 评估从 KaTeX 切到 MathJax 的成本；至少补 `\ce{}`、自动编号、`\label/\ref`。

### P2：生态与系统集成

10. 图床生态（PicGo/uPic/自定义命令）、文件链接、版本历史/草稿恢复 UI、CLI/启动参数、自动更新、跨平台系统集成（Quick Look/Share/JumpList/右键新建）。

## 附录：抓取页面清单

### Quick Start（21）

[Quick Start](https://support.typora.io/Quick-Start/) · [Markdown Reference](https://support.typora.io/Markdown-Reference/) · [About Themes](https://support.typora.io/About-Themes/) · [Install Typora on Linux](https://support.typora.io/Typora-on-Linux/) · [Table Editing](https://support.typora.io/Table-Editing/) · [Report Bugs](https://support.typora.io/Report-Bugs/) · [Links](https://support.typora.io/Links/) · [HTML Support](https://support.typora.io/HTML/) · [Spellcheck](https://support.typora.io/Spellcheck/) · [Shortcut Keys](https://support.typora.io/Shortcut-Keys/) · [Sync](https://support.typora.io/Sync/) · [Trouble Shooting](https://support.typora.io/Trouble-Shooting/) · [Typora on Windows](https://support.typora.io/Typora-on-Windows/) · [Typora on macOS](https://support.typora.io/Typora-on-macOS/) · [Export](https://support.typora.io/Export/) · [Draw Diagrams](https://support.typora.io/Draw-Diagrams-With-Markdown/) · [File Management](https://support.typora.io/File-Management/) · [Images](https://support.typora.io/Images/) · [Math](https://support.typora.io/Math/) · [Outline](https://support.typora.io/Outline/) · [Code Fences](https://support.typora.io/Code-Fences/)

### How-To（48）

[Install and Use Pandoc](https://support.typora.io/Install-and-Use-Pandoc/) · [Auto Numbering](https://support.typora.io/Auto-Numbering/) · [Code Block Styles](https://support.typora.io/Code-Block-Styles/) · [Custom Fonts](https://support.typora.io/Custom-Font/) · [Change Background](https://support.typora.io/Backgound/) · [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/) · [Sublime](https://support.typora.io/Sublime/) · [Change Styles in Focus Mode](https://support.typora.io/Change-Styles-in-Focus-Mode/) · [Add Search Service](https://support.typora.io/Add-Search-Service/) · [Use Typora from Shell or Cmd](https://support.typora.io/Use-Typora-From-Shell-or-cmd/) · [Resize Images](https://support.typora.io/Resize-Image/) · [Auto Save](https://support.typora.io/Auto-Save/) · [Version Control](https://support.typora.io/Version-Control/) · [RTL](https://support.typora.io/RTL/) · [Task List](https://support.typora.io/Task-List/) · [Auto Pair](https://support.typora.io/Auto-Pair/) · [Page Breaks](https://support.typora.io/Page-Breaks/) · [Strict Mode](https://support.typora.io/Strict-Mode/) · [Width of Writing Area](https://support.typora.io/Width-of-Writing-Area/) · [Line Break](https://support.typora.io/Line-Break/) · [SmartyPants](https://support.typora.io/SmartyPants/) · [Media](https://support.typora.io/Media/) · [Dark Mode](https://support.typora.io/Dark-Mode/) · [Launch Options](https://support.typora.io/Launch-Options/) · [Word Count](https://support.typora.io/Word-Count/) · [Focus and Typewriter Mode](https://support.typora.io/Focus-and-Typewriter-Mode/) · [Copy and Paste](https://support.typora.io/Copy-and-Paste/) · [Zoom](https://support.typora.io/Zoom/) · [Older macOS Support](https://support.typora.io/Older-macOS-Support/) · [Upload Images](https://support.typora.io/Upload-Image/) · [Get Logs](https://support.typora.io/Get-Logs/) · [Launch Arguments](https://support.typora.io/Launch-Arguments/) · [New File in Context](https://support.typora.io/New-File-in-Context/) · [Text Snippets](https://support.typora.io/Text-Snippet/) · [Typeset](https://support.typora.io/Typeset/) · [Markdown Export](https://support.typora.io/Markdown-Export/) · [YAML Front Matter](https://support.typora.io/YAML/) · [Delete Range](https://support.typora.io/Delete-Range/) · [Snap](https://support.typora.io/Snap/) · [Advanced Config](https://support.typora.io/Advance-Config/) · [Search](https://support.typora.io/Search/) · [List Style](https://support.typora.io/List-Style/) · [Older Windows Support](https://support.typora.io/Older-Windows-Support/) · [TOC](https://support.typora.io/TOC/) · [Debug Themes](https://support.typora.io/Debug-Themes/) · [Install and Use VLOOK](https://support.typora.io/Install-and-Use-VLOOK/) · [VS Code Extension](https://support.typora.io/Open-in-Typora-VS-Code-Extension/) · [Line Spacing](https://support.typora.io/Line-Spacing/)

### What's New（29）

[1.14](https://support.typora.io/What's-New-1.14/) · [1.13](https://support.typora.io/What's-New-1.13/) · [1.12](https://support.typora.io/What's-New-1.12/) · [1.11](https://support.typora.io/What's-New-1.11/) · [1.10](https://support.typora.io/What's-New-1.10/) · [1.9](https://support.typora.io/What's-New-1.9/) · [1.8](https://support.typora.io/What's-New-1.8/) · [1.7](https://support.typora.io/What's-New-1.7/) · [1.6](https://support.typora.io/What's-New-1.6/) · [1.5](https://support.typora.io/What's-New-1.5/) · [1.4](https://support.typora.io/What's-New-1.4/) · [1.3](https://support.typora.io/What's-New-1.3/) · [1.2](https://support.typora.io/What's-New-1.2/) · [1.1](https://support.typora.io/What's-New-1.1/) · [1.0](https://support.typora.io/What's-New-1.0/) · [0.11](https://support.typora.io/What's-New-0.11/) · [0.10](https://support.typora.io/What's-New-0.10/) · [0.9.98](https://support.typora.io/What's-New-0.9.98/) · [0.9.90](https://support.typora.io/What's-New-0.9.90/) · [0.9.84](https://support.typora.io/What's-New-0.9.84/) · [0.9.80](https://support.typora.io/What's-New-0.9.80/) · [0.9.73](https://support.typora.io/What's-New-0.9.73/) · [0.9.71](https://support.typora.io/What's-New-0.9.71/) · [0.9.66](https://support.typora.io/What's-New-0.9.66/) · [0.9.63](https://support.typora.io/What's-New-0.9.63/) · [0.9.61](https://support.typora.io/What's-New-0.9.61/) · [0.9.59](https://support.typora.io/What's-New-0.9.59/) · [0.9.58](https://support.typora.io/What's-New-0.9.58/) · [0.9.54](https://support.typora.io/What's-New-0.9.54/)
