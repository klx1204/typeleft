# Typora 自定义样式能力与 Typeleft 兼容方案

- 整理日期：2026-11-14
- 目标：**Typeleft 具备与 Typora 同级的自定义样式能力，并能兼容 Typora 主题**
- 调研来源：
  - <https://theme.typora.io/doc/Install-Theme/>
  - <https://theme.typora.io/doc/Write-Custom-Theme/>
  - <https://support.typora.io/style/>（含其下全部 15 个样式页面）
- 样本主题：Academic（58 个选择器）、Barfi（89 个选择器），用于量化兼容难度
- Typeleft 代码基线：`b05abc1`（v0.1.0，Tauri 2 + React + Muya）

---

## 0. 结论先行

### 0.1 可行性判断

**内容区可以做到高兼容，整窗 UI 不可能 100% 兼容。**

Typora 主题的写法是“标签选择器为主、`#write` 为根、`md-*` 类为辅”。Muya 保留了标准标签结构（`p`、`h1`、`blockquote`、`pre`、`table`、`strong`、`em`、`code`、`img` 等），所以：

| 兼容层级 | 预估覆盖率 | 说明 |
|---|---|---|
| 编辑区排版（字体、字号、行高、标题、段落、引用、表格、列表、行内样式） | **80%–90%** | 加 `#write` 根与少量 class 即可直接命中 |
| 代码块与源码模式配色 | **60%–75%** | 需要 CodeMirror token → Prism token 的映射层 |
| 图片、TOC、任务列表、数学、Front Matter | **70%–85%** | 需要补 `.md-*` 类与 `mdtype` 属性 |
| 侧栏、标题栏、搜索框、菜单、弹窗等 UI | **10%–30%** | 选择器与 DOM 完全不同，只能做变量级“配色跟随”，版式无法照搬 |

两个真实样本的选择器构成：

| 主题 | 选择器总数 | 纯标签 | `#write` 根 | `md-*` 类 | 代码块类 | UI 类 |
|---|---|---|---|---|---|---|
| Academic | 58 | 22（38%） | 4（7%） | 15（26%） | 9（16%） | 3（5%） |
| Barfi | 89 | 35（39%） | 7（8%） | 13（15%） | 4（4%） | 18（20%） |

结论：**先把“内容区兼容层”做扎实，再决定是否为 UI 做一套 Typora 选择器别名**。不要一开始就追求整窗像素级一致。

### 0.2 中级目标验收标准

达到以下条件即可视为“具备 Typora 同级自定义样式能力，并兼容 Typora 主题”：

1. 用户可以把 Typora 主题文件夹中的 `*.css` 连同字体、图片复制到 Typeleft 主题目录，刷新后出现在主题列表。
2. 主题按“基础样式 → 主题 CSS → `base.user.css` → `{theme}.user.css`”顺序加载。
3. 明暗模式可分别选择主题，主题支持 `prefers-color-scheme`。
4. 主题内的相对资源（`url(./fonts/x.woff)`、`@import "sub.css"`）可用。
5. 编辑区可被主题控制：字体、字号、行高、段距、背景、宽度、标题、列表、任务、表格、代码块、TOC、数学、Front Matter、专注模式、Markdown 标记显示。
6. 导出 HTML / 打印 PDF 时应用当前主题，`@media print` 生效。
7. 5 个热门 Typora 主题在内容区可用，除 UI 外的显著差异不超过 5 类。

---

## 1. Typora 自定义样式体系

### 1.1 主题就是一个 CSS 文件

来源：[About Themes](https://support.typora.io/About-Themes/)、[Install Theme](https://theme.typora.io/doc/Install-Theme/)

- Typora 内置 6 个主题，全部由 CSS 实现。
- 每个主题对应主题文件夹中的一个 `.css` 文件，主题菜单直接读取该目录。
- 主题可携带字体、图片等资源，通过相对路径引用。

### 1.2 安装目录与命名

| 项目 | 规则 | 来源 |
|---|---|---|
| macOS 主题目录 | `~/Library/Application Support/abnerworks.Typora/themes/` | [Install Theme](https://theme.typora.io/doc/Install-Theme/) |
| 打开方式 | 偏好设置 → 外观 → Open Theme Folder | [Install Theme](https://theme.typora.io/doc/Install-Theme/) |
| 文件名 | 只用小写字母与 `-`，不能有空格/大写/其他字符 | [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/) |
| 菜单显示名 | `my-first-theme.css` → “My First Theme” | [About Themes](https://support.typora.io/About-Themes/) |
| 安装步骤 | 复制 CSS + 资源 → 重启 → 主题菜单选择 | [Install Theme](https://theme.typora.io/doc/Install-Theme/) |
| 更新风险 | 主题文件被更新会覆盖直接修改，建议用 `.user.css` | [Install Theme](https://theme.typora.io/doc/Install-Theme/) |

### 1.3 四层 CSS 加载顺序

来源：[Add Custom CSS](https://support.typora.io/Add-Custom-CSS/)

1. Typora 基础样式
2. 当前主题 CSS
3. `base.user.css`（对所有主题生效）
4. `{current-theme}.user.css`（只对当前主题生效）

注意：`{current-theme}` 必须与主题文件名完全一致且大小写敏感。例如 `github.css` 对应 `github.user.css`，不是 `Github.user.css`。

### 1.4 明暗主题

来源：[About Themes](https://support.typora.io/About-Themes/)

- macOS / Windows 可分别为 Light / Dark 选择不同主题。
- 系统配色变化时自动切换对应主题。
- 主题内可用 `@media (prefers-color-scheme: dark)` 写自适应样式。

### 1.5 CSS 变量（官方推荐的第一层定制）

来源：[Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/)

官方推荐优先覆盖变量，而不是重写所有选择器：

```css
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --md-char-color: #C7C5C5;
  --meta-content-color: #5b808d;
  --primary-color: #428bca;
  --primary-btn-border-color: #285e8e;
  --primary-btn-text-color: #fff;
  --window-border: 1px solid #eee;
  --active-file-bg-color: #eee;
  --active-file-text-color: inherit;
  --active-file-border-color: #777;
  --side-bar-bg-color: var(--bg-color);
  --item-hover-bg-color: rgba(229, 229, 229, 0.59);
  --item-hover-text-color: inherit;
  --monospace: monospace;
}
```

真实主题还会使用：`--blur-text-color`、`--search-select-bg-color`、`--search-select-text-color`、`--control-text-color`、`--heading-char-color`、`--table-border-color`、`--drag-placeholder-color`、`--panel-border-color`、`--color-popover-bg-color`、`--active-toggle-btn-color`、`--side-bar-fg-color`、`--side-bar-menu-active-tint`、`--window-border-color`。

### 1.6 DOM 契约

来源：[Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/)

#### 根节点

- 窗口内容是一张网页：全局背景、字体写到 `html` / `body`。
- 写作区是 `div#write`：宽度、内边距、基础字号、文字颜色写在 `#write`。
- 只想影响正文、不影响弹窗时，一律加 `#write` 前缀。

#### 块级元素

| Markdown 类型 | 输出选择器 | 额外信息 |
|---|---|---|
| 段落 | `p` | 可含多个 `.md-line` |
| 标题 | `h1`–`h6` | `mdtype="heading"` |
| 引用 | `blockquote` | |
| 无序列表 | `ul li` | |
| 有序列表 | `ol li` | |
| 任务列表 | `ul.task-list li.task-list-item` | |
| 代码块 | `pre.md-fences`（初始化前 `pre.md-fences.mock-cm`） | CodeMirror 主题 `cm-s-inner` |
| 图表 | `pre[lang="sequence"]`、`pre[lang="flow"]`、`pre[lang="mermaid"]` | |
| 分隔线 | `hr` | |
| 链接定义 | `.md-def-link` | 子元素 `.md-def-name`、`.md-def-content`、`.md-def-title` |
| 脚注定义 | `.md-def-footnote` | 子元素 `.md-def-name`、`.md-def-content` |
| YAML | `pre.md-meta-block` | `mdtype="meta_block"` |
| 数学块 | `[mdtype="math_block"]` | 预览 `.mathjax-block` |
| 表格 | `table thead tbody th tr td` | |
| TOC | `.md-toc` | 层级 `.md-toc-h1`…`.md-toc-h6` |

另外每个块元素带 `mdtype` 属性：`paragraph`、`heading`、`blockquote`、`fences`、`hr`、`def_link`、`def_footnote`、`table`、`meta_block`、`math_block`、`list`、`toc`、`list_item`、`table_row`、`table_cell`、`line`。

#### 行内元素

Typora 为行内元素包了三层：

```html
<span md-inline="strong">
  <span class="md-meta md-before">**</span>
  <strong><span md-inline="plain">text</span></strong>
  <span class="md-meta md-after">**</span>
</span>
```

- `md-inline` 取值：`plain`、`strong`、`em`、`code`、`underline`、`escape`、`tag`、`del`、`footnote`、`emoji`、`inline_math`、`subscript`、`superscript`、`linebreak`、`highlight`、`url`、`autolink`、`link`、`reflink`、`image`、`refimg`。
- Markdown 标记包裹在 `.md-meta`，内容包裹在 `.md-content`，二者默认隐藏；光标进入时父级加 `.md-expand` 才显示。
- 想“不隐藏 Markdown 语法”，主题会写 `.md-meta, .md-content { display: inline; }`（[Typeset](https://support.typora.io/Typeset/)）。

#### 源码模式

- 源码模式由 CodeMirror 驱动，主题类名 `.cm-s-typora-default`。
- 代码块由 CodeMirror 驱动，主题类名 `.cm-s-inner`。
- 两者 token 类名相同（`.cm-keyword`、`.cm-string`、`.cm-comment` 等）。

#### 专注模式

来源：[Change Styles in Focus Mode](https://support.typora.io/Change-Styles-in-Focus-Mode/)

- 开启后 `<body>` 加 `on-focus-mode`。
- 当前块加 `.md-focus`，包含当前块的容器加 `.md-focus-container`。
- 可包含子块的块没有 `.md-end-block`，叶子块有。
- 官方推荐先改 `--blur-text-color` 简化定制。

### 1.7 自定义能力清单

| # | 能力 | 实现方式 | 来源 |
|---|---|---|---|
| 1 | 整套主题切换 | 主题文件夹中的 CSS 文件 | [About Themes](https://support.typora.io/About-Themes/) |
| 2 | 安装第三方主题 | 复制 CSS + 字体/图片，重启 | [Install Theme](https://theme.typora.io/doc/Install-Theme/) |
| 3 | 全局级微调 | `base.user.css` | [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/) |
| 4 | 单主题级微调 | `{theme}.user.css` | [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/) |
| 5 | 明暗分别设主题 | Light/Dark 两个主题选择 | [About Themes](https://support.typora.io/About-Themes/) |
| 6 | 主题内自适应明暗 | `prefers-color-scheme` | [About Themes](https://support.typora.io/About-Themes/) |
| 7 | 改全局配色 | 覆盖 `:root` CSS 变量 | [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/) |
| 8 | 改字体族 | `body { font-family }` + `@font-face` | [Custom Fonts](https://support.typora.io/Custom-Font/) |
| 9 | 改字号 | `html { font-size }` + 元素用 `rem` | [Custom Fonts](https://support.typora.io/Custom-Font/) |
| 10 | 改源码模式字体 | `#typora-source` + `--monospace` | [Custom Fonts](https://support.typora.io/Custom-Font/) |
| 11 | 改代码块字体 | `body { --monospace }` 或 `#md-fences` | [Custom Fonts](https://support.typora.io/Custom-Font/) |
| 12 | 改写作区宽度 | `#write { max-width }` | [Width of Writing Area](https://support.typora.io/Width-of-Writing-Area/) |
| 13 | 改源码区宽度 | `#typora-source .CodeMirror-lines` | [Width of Writing Area](https://support.typora.io/Width-of-Writing-Area/) |
| 14 | 改背景 | `content` / `body` / `#write` 背景图与色 | [Change Background](https://support.typora.io/Backgound/) |
| 15 | 改行距 | `#write { line-height }` | [Line Spacing](https://support.typora.io/Line-Spacing/) |
| 16 | 改段距 | `#write p/li { margin }` | [Line Spacing](https://support.typora.io/Line-Spacing/) |
| 17 | 标题自动编号 | CSS counter | [Auto Numbering](https://support.typora.io/Auto-Numbering/) |
| 18 | 大纲/TOC 自动编号 | CSS counter | [Auto Numbering](https://support.typora.io/Auto-Numbering/) |
| 19 | 控制 TOC 层级 | `.md-toc-h6 { display:none }` | [TOC Levels](https://support.typora.io/TOC-levels/) |
| 20 | 有序列表样式 | `ol { list-style-type }`（含中文/希腊/罗马数字） | [List Style](https://support.typora.io/List-Style/) |
| 21 | 无序列表样式 | `ul { list-style-type }`（含自定义内容） | [List Style](https://support.typora.io/List-Style/) |
| 22 | 完成任务划线/淡化 | `.task-list-done` | [Task List](https://support.typora.io/Task-List/) |
| 23 | 代码块配色 | 移植 CodeMirror 主题到 `.cm-s-inner` | [Code Block Styles](https://support.typora.io/Code-Block-Styles/) |
| 24 | 源码模式配色 | `.cm-s-typora-default` | [Code Block Styles](https://support.typora.io/Code-Block-Styles/) |
| 25 | 专注模式淡化 | `--blur-text-color` 或 `.md-focus` 系列 | [Change Styles in Focus Mode](https://support.typora.io/Change-Styles-in-Focus-Mode/) |
| 26 | 不隐藏 Markdown 标记 | `.md-meta, .md-content { display:inline }` | [Typeset](https://support.typora.io/Typeset/) |
| 27 | 大写/小型大写标题 | `text-transform`、`font-variant` | [Typeset](https://support.typora.io/Typeset/) |
| 28 | 连字控制 | `font-variant-ligatures` | [Typeset](https://support.typora.io/Typeset/) |
| 29 | 两端/居中/右对齐 | `text-align` | [Typeset](https://support.typora.io/Typeset/) |
| 30 | RTL | `#write { direction: rtl }` | [RTL](https://support.typora.io/RTL/) |
| 31 | 竖排 | `writing-mode: vertical-rl` | [Typeset](https://support.typora.io/Typeset/) |
| 32 | 空格/换行显示策略 | 编辑器设置 + CSS `white-space` | [Whitespace and Line Breaks](https://support.typora.io/Line-Break/) |
| 33 | 图片居中/取消居中 | `p > img:only-child` | [Images](https://support.typora.io/Images/) |
| 34 | 表格边框/斑马纹 | `table`、`tr:nth-child(2n)` | [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/) |
| 35 | 打印/PDF 专用样式 | `@media print { .typora-export }` | [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/) |
| 36 | 主题调试 | DevTools / Inspect Element | [Debug Themes](https://support.typora.io/Debug-Themes/) |
| 37 | 主题内拆分资源 | `@import "sub.css"` + 相对路径 | Barfi 样本、[Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/) |
| 38 | 主题携带字体 | `@font-face` + `url('./fonts/x.woff')` | [Custom Fonts](https://support.typora.io/Custom-Font/) |

---

## 2. Typeleft 现有样式能力

### 2.1 当前架构

| 层 | 实现 | 位置 |
|---|---|---|
| 主题切换 | `applyTheme()` 动态改 3 个 `<link>` 的 href | `src/services/theme.ts` |
| 内置主题文件 | 固定 6 个文件：editor/prismjs/codemirror × light/dark | `public/theme/` |
| 编辑器样式 | Muya `default.css` + `src/assets/styles/index.css` | `src/components/Muya/themes/default.css` |
| CSS 变量 | `--editorColor*`、`--themeColor*`、`--highlightColor` 等约 30 个 | `public/theme/editor/*.theme.css` |
| 编辑区宽度 | 设置项 `editorAreaWidth` → `document.body.setProperty('--editorAreaWidth')` | `src/components/Muya/index.tsx` |
| 字号/行高 | 设置项写入 CodeMirror；Muya 仅用于光标定位 | `src/components/CodeMirror/index.tsx`、`Muya/lib/index.js` |
| 导出样式 | 固定 `github-markdown-css` + `exportStyle.css` + Prism/Katex | `src/services/exportHtml.js` |
| 图表主题 | Mermaid / Sequence / Vega 主题枚举 | `SettingsPage` |
| 明暗 | `themeMode: system / light / dark` | `SettingsPage` |

### 2.2 能力对比

| # | Typora 能力 | Typeleft 现状 | 差距说明 |
|---|---|---|---|
| 1 | 主题文件夹扫描 | ❌ | 只有 `public/theme` 内置文件，不能读用户目录 |
| 2 | 第三方主题安装 | ❌ | 无导入/复制/扫描流程 |
| 3 | 主题列表菜单 | ❌ | 只有 light/dark/system 三选一 |
| 4 | `base.user.css` | ❌ | 无 |
| 5 | `{theme}.user.css` | ❌ | 无 |
| 6 | 明暗分别设主题 | ❌ | 只能明/暗各一套固定文件 |
| 7 | `prefers-color-scheme` | 🟡 | 可写媒体查询，但主题系统不感知 |
| 8 | `:root` 变量覆盖 | 🟡 | 内置变量可改，但用户无法注入 |
| 9 | 自定义字体族 | ❌ | 设置里只有字号，无字体族；WYSIWYG 字号也不生效 |
| 10 | 自定义字号 | 🟡 | 仅源码模式生效；Muya 固定 16px |
| 11 | 自定义行高 | 🟡 | 同上，Muya 固定 1.6 |
| 12 | 自定义段距 | ❌ | 无设置/CSS 入口 |
| 13 | 编辑区宽度 | ✅ | `editorAreaWidth` |
| 14 | 源码区宽度 | ❌ | 无 |
| 15 | 背景图/背景色 | 🟡 | `theme.ts` 写死 body 背景，主题 CSS 可改但无用户主题 |
| 16 | 代码块样式 | 🟡 | Prism 主题固定，内置 light/dark 两套 |
| 17 | 源码模式样式 | 🟡 | CodeMirror `one-dark`，内置两套 |
| 18 | 列表样式 | ❌ | 固定 |
| 19 | 任务完成样式 | ❌ | 无 `.task-list-done` 类 |
| 20 | 标题自动编号 | ❌ | 无自定义 CSS |
| 21 | TOC 层级控制 | ❌ | 无 TOC 块 |
| 22 | 专注模式样式 | 🟡 | 有 `ag-focus-mode`，无 `--blur-text-color`/`on-focus-mode` |
| 23 | 不隐藏 Markdown 标记 | ❌ | 无 `.md-meta` 概念 |
| 24 | RTL / 竖排 | ❌ | 无入口 |
| 25 | 打印/PDF 专用样式 | ❌ | 打印 HTML 固定样式，无主题注入 |
| 26 | 主题资源（字体/图片） | 🟡 | 内置主题可放资源，用户主题不能 |
| 27 | 主题热重载 | ❌ | 切换靠 href，无文件监听/刷新 |
| 28 | DevTools 调试 | ❌ | 无菜单入口 |
| 29 | 导出应用当前主题 | ❌ | 导出固定 GitHub 风格 |
| 30 | 主题拆分 `@import` | ❌ | 无用户主题目录 |

### 2.3 关键限制（按影响排序）

1. **没有用户主题目录**：所有主题能力都锁在 `public/theme` 的 6 个文件里。
2. **CSS 变量体系太窄**：只有 `--editorColor*` 等内部变量，没有 Typora 的语义变量（`--bg-color`、`--text-color`、`--side-bar-bg-color` 等）。
3. **DOM 契约不同**：`#ag-editor-id` + `ag-*` vs `#write` + `md-*`，第三方主题无法命中。
4. **代码块渲染引擎不同**：Prism `<code>` vs CodeMirror `.cm-s-inner`，主题 token 类不通用。
5. **字号/行高设置对 WYSIWYG 无效**：`setFont()` 只更新光标计算参数，没有改 DOM 字号。
6. **导出与编辑样式割裂**：导出始终 GitHub Markdown 风格，用户主题不影响导出结果。
7. **无调试/热重载**：改主题必须重启或重新选主题。

---

## 3. Typora 主题兼容性分析

### 3.1 选择器分级

| 级别 | Typora 选择器 | Typeleft 能否直接命中 | 处理方式 |
|---|---|---|---|
| **A 直接可用** | `h1`–`h6`、`p`、`blockquote`、`ul`、`ol`、`li`、`table`、`thead`、`tbody`、`tr`、`th`、`td`、`strong`、`em`、`code`、`pre`、`a`、`img`、`hr`、`mark`、`sup`、`sub` | ✅ 标签一致 | 无需处理 |
| **A 直接可用** | `#write p`、`#write h1`、`#write table` | ❌ 根节点是 `#ag-editor-id` | 给容器加 `#write` 或把 id 改为 `write` |
| **B 需适配** | `#write > p`、`#write > blockquote` | ❌ 块是 `#ag-editor-id` 的直接子元素 | 把渲染根改成 `div#write.ag-editor-id` 后可用；若只加外层包装，需把 `#write >` 重写为 `#write > #ag-editor-id >` |
| **B 需适配** | `.md-fences` | ❌ 实际是 `pre.ag-fence-code` | 渲染时补 `md-fences` 类 |
| **B 需适配** | `pre.md-meta-block` | ❌ `pre.ag-front-matter` | 补 `md-meta-block` 类 |
| **B 需适配** | `[mdtype="math_block"]` | ❌ 无 `mdtype` | 渲染时写 `mdtype` 属性 |
| **B 需适配** | `.md-toc`、`.md-toc-h1..h6` | ❌ 无 TOC 块 | 实现 TOC 后补类 |
| **B 需适配** | `.task-list-item`、`.task-list-done` | ❌ `li.ag-task-list-item` | 补类，完成态加 `.task-list-done` |
| **B 需适配** | `.md-image`、`.md-meta` | ❌ `ag-image-*` | 补类或选择器别名 |
| **B 需适配** | `.md-inline="strong"` 外层包装 | ❌ 无 `md-inline` | 渲染时加属性 |
| **B 需适配** | `.md-meta`、`.md-content`、`.md-expand` | ❌ `ag-remove`、`ag-hide` | 标记 span 加 `md-meta` 类 |
| **C 需重写** | `.cm-s-inner .cm-keyword` 等 | ❌ Prism token | 生成 Prism 映射 CSS |
| **C 需重写** | `.cm-s-typora-default` | ❌ `cm-s-one-dark` | 容器加别名类 + token 映射 |
| **D 不可用** | `#typora-sidebar`、`.file-list-item`、`#md-searchpanel`、`#typora-quick-open`、`.dropdown-menu`、`#toc-dropmenu` 等 UI | ❌ DOM 完全不同 | 忽略，或用变量映射近似配色 |

### 3.2 需要补齐的 DOM

建议在 Muya 渲染层做“双类名/双属性”，不改变现有结构：

| Muya 现状 | 兼容层追加 |
|---|---|
| `#ag-editor-id` | 把渲染根改为 `div#write.ag-editor-id`，并同步把查找选择器改为 class（`div.ag-editor-id`） |
| 块 `p#key.ag-paragraph` | `mdtype="paragraph"`，标题 `mdtype="heading"`，引用 `mdtype="blockquote"`，`pre` 代码块 `mdtype="fences"`，`hr` `mdtype="hr"`，表格 `mdtype="table"`，Front Matter `mdtype="meta_block"`，数学 `mdtype="math_block"`，列表 `mdtype="list"`，列表项 `mdtype="list_item"` |
| `pre.ag-fence-code` | `md-fences` |
| `pre.ag-front-matter` | `md-meta-block` |
| `pre.ag-multiple-math` | `mdtype="math_block"`；预览容器 `mathjax-block`（可用 KaTeX 容器别名） |
| `li.ag-task-list-item` | `task-list-item`；完成态 `task-list-done`；未完成 `task-list-not-done` |
| `li.ag-task-list-item input` | 保持 `input[type=checkbox]`，补 `ul.task-list` 父类 |
| `span.ag-remove`（标记） | `md-meta md-before` / `md-meta md-after` |
| 行内输出 `strong/em/code/del/mark/sup/sub` | 外层 `span[md-inline="strong"]` 等（值为 `strong`、`em`、`code`、`del`、`highlight` 等） |
| `span.ag-hide`（隐藏内容） | `md-content` |
| 专注模式 `body.ag-show...`? 实际 `container.ag-focus-mode` | `body.on-focus-mode`；块 `.md-focus`、`.md-focus-container`、`.md-end-block` |
| 图片容器 `span.ag-image-container` | `md-image`；编辑态 `md-expand` |
| TOC（待实现） | `.md-toc`、`.md-toc-h1..h6` |
| 代码块内 `<code class="language-x">` | `.CodeMirror`、`.CodeMirror-lines`、`.CodeMirror-line` 的轻量别名（可选） |

### 3.3 代码块 token 映射

Typora 用 CodeMirror，主题写 `.cm-s-inner .cm-keyword`。Typeleft 用 Prism，HTML 形如 `<span class="token keyword">`。两种做法：

**方案 A：CSS 别名（改动最小）**

在兼容层生成一段映射 CSS：

```css
.cm-s-inner .cm-keyword,
.cm-s-inner .cm-builtin { color: var(--typora-keyword); }
/* 直接给 Prism token 补 CodeMirror 类更稳： */
.token.keyword { /* 保留 Prism 原有 */ }
```

更彻底的是渲染时给 Prism span 追加 CodeMirror 类：

```html
<span class="token keyword cm-keyword">const</span>
```

映射表：

| Prism token | CodeMirror class |
|---|---|
| `keyword` | `cm-keyword` |
| `builtin` | `cm-builtin` |
| `string` | `cm-string` |
| `number` | `cm-number` |
| `comment` | `cm-comment` |
| `operator` | `cm-operator` |
| `punctuation` | `cm-punctuation` |
| `function` | `cm-def` / `cm-variable-2` |
| `class-name` | `cm-variable-3` |
| `tag` | `cm-tag` |
| `attr-name` | `cm-attribute` |
| `attr-value` | `cm-string-2` |
| `property` | `cm-property` |
| `boolean` | `cm-atom` |
| `regex` | `cm-string-2` |

这样 Typora 主题里的 `.cm-s-inner .cm-keyword { color: ... }` 可以直接命中。同时给 `<pre>` 加 `CodeMirror cm-s-inner` 类，命中背景/字体/行号规则。

**方案 B：换用 CodeMirror 渲染代码块**：与 Typora 完全一致，但改动大、性能与交互风险高，不建议。

### 3.4 主题变量映射

Typeleft 组件大量使用 `--editorColor*`。要让 Typora 主题的 `--bg-color`/`--text-color` 驱动这些组件，需要在兼容层建立“语义变量 → 内部变量”的桥接，并放在主题 CSS 之后、应用样式之前：

```css
:root {
  --editorColor: var(--text-color, #000);
  --editorColor80: color-mix(in srgb, var(--text-color, #000) 80%, transparent);
  --editorColor60: color-mix(in srgb, var(--text-color, #000) 60%, transparent);
  --editorColor50: color-mix(in srgb, var(--text-color, #000) 50%, transparent);
  --editorColor40: color-mix(in srgb, var(--text-color, #000) 40%, transparent);
  --editorColor30: color-mix(in srgb, var(--text-color, #000) 30%, transparent);
  --editorColor10: color-mix(in srgb, var(--text-color, #000) 10%, transparent);
  --editorColor06: color-mix(in srgb, var(--text-color, #000) 6%, transparent);
  --editorColor04: color-mix(in srgb, var(--text-color, #000) 4%, transparent);
  --editorColor02: color-mix(in srgb, var(--text-color, #000) 2%, transparent);
  --editorColor00: var(--bg-color, #fff);

  --editorBgColor: var(--bg-color, #f7f7f7);
  --themeColor: var(--primary-color, #448aff);
  --highlightColor: var(--search-select-bg-color, rgba(104, 134, 170, .4));
  --selectionColor: var(--search-select-text-color, rgba(0, 0, 0, .1));
  --tableBorderColor: var(--table-border-color, #e5e5e5);
  --itemBgColor: var(--active-file-bg-color, #f8f8f8);
  --floatBgColor: var(--bg-color, #f8f8f8);
  --floatHoverColor: var(--item-hover-bg-color, rgba(0, 0, 0, .04));
  --floatBorderColor: var(--window-border-color, rgba(0, 0, 0, .12));
  --codeBgColor: var(--bg-color, #fff);
  --codeBlockBgColor: var(--bg-color, #fff);
  --focusColor: var(--primary-color, var(--themeColor));
  --blur-text-color: var(--blur-text-color, var(--editorColor10));
  --monospace: var(--monospace, "DejaVu Sans Mono", Consolas, monospace);
}
```

注意：

- `color-mix()` 需要较新的 WebKit/Chromium；Tauri 2 的 WebView 版本足够新，但建议提供降级（用主题直接给 `--editorColorXX` 时优先）。
- 若 Typora 主题只定义了 `--bg-color`/`--text-color`，UI 至少能跟随明暗与主色。
- 反之，Typeleft 内置主题也应补齐一套 Typora 语义变量，方便第三方主题与内置主题共用同一套桥接。

### 3.5 主题资源加载

Typora 主题常见：

```css
@import "barfi/mermaid.dark.css";
@font-face { src: url('./fonts/xxx.woff'); }
content { background: url(./bg.png); }
```

Typeleft 是 Tauri WebView，`file://` 受 CSP/协议限制。建议：

1. 用 Tauri 自定义协议 `theme://`（或 `asset://` + scope）映射到主题目录。
2. 注入主题时把 CSS 里的相对 `url(...)`/`@import` 重写为 `theme://{themeName}/...`。
3. `tauri.conf.json` 的 CSP 允许 `theme:` 与 `asset:`。
4. 或采用更简单的方案：加载前把 CSS 中的 `url(...)` 重写为 base64 data URL（只适合小资源，字体可能很大）。
5. 字体文件使用 `asset` 协议或复制到 `public/theme/...` 缓存目录。

### 3.6 导出与打印

Typora 的导出使用 `.typora-export` 容器 + `@media print`。Typeleft 当前：

- `src/services/exportHtml.js` 固定拼 `github-markdown-css`、`exportStyle.css`、Prism、KaTeX。
- 打印走 `print_html`，HTML 与编辑主题无关。

改造建议：

1. 导出时读取“当前主题 CSS + `base.user.css` + `{theme}.user.css`”。
2. 生成 `.typora-export` 包裹层，保留 `#write` 别名，确保主题的 `@media print` 规则命中。
3. 把主题中的相对资源重写为 `file://` 或 data URL。
4. 导出设置增加“使用当前主题 / 使用 GitHub 风格 / 自定义 CSS”三选一。
5. PDF 打印窗口加载同一份 HTML，`@page` 与 `@media print` 生效。

---

## 4. 目标架构

### 4.1 目录结构

```text
~/.config/typeleft/themes/        (macOS: ~/Library/Application Support/.../themes/)
├── base.user.css                 # 全局追加
├── my-theme.css                  # 主题
├── my-theme.user.css             # 该主题追加
├── my-theme/
│   ├── fonts/
│   └── bg.png
└── ...
```

内置主题放应用资源目录，用户主题放用户数据目录；主题列表 = 内置 + 用户目录扫描。

### 4.2 主题加载管线

```text
1. app base css (index.css / Muya default.css)
2. theme css (user or builtin)
3. typora-compat.css (变量桥接、选择器别名、token 映射)
4. base.user.css
5. {theme}.user.css
6. runtime overrides (fontSize, editorAreaWidth, focus/typewriter)
```

顺序要点：

- `typora-compat.css` 放在主题之后，才能用主题变量推导内部变量；但选择器别名应使用 `:where()` 降低特异性，避免覆盖主题自身规则。
- `base.user.css` / `.user.css` 必须最后，保证用户微调优先级最高。
- 运行时设置（宽度、字号）用 CSS 变量注入，不直接改样式表。

### 4.3 主题加载与切换 API（伪代码）

```ts
type ThemeManifest = {
  id: string;          // 文件名（不含 .css）
  name: string;        // 菜单显示名
  path: string;
  builtin: boolean;
  dark?: boolean;      // 是否暗色（用于明暗分组）
};

// Rust: list_themes(dir) -> ThemeManifest[]
// Rust: read_theme_css(path) -> string
// Rust: watch theme dir -> emit ThemeDirChanged

async function applyTheme(themeId: string) {
  const css = await readThemeCss(themeId);
  const compat = await readCompatCss();
  const baseUser = await readIfExists('base.user.css');
  const themeUser = await readIfExists(`${themeId}.user.css`);
  injectStyles([css, compat, baseUser, themeUser], {
    rewriteUrls: (url) => toThemeProtocol(themeId, url),
  });
}
```

### 4.4 设置界面

Appearance 分组建议：

- 主题：`Light 主题`、`Dark 主题`（两个下拉）
- 跟随系统：开关
- 主题列表：缩略图/名称/来源（内置/用户）
- 按钮：`打开主题文件夹`、`重新加载主题`、`安装主题...`（选 zip/css）
- 自定义 CSS：`编辑 base.user.css`、`编辑当前主题 .user.css`
- 调试：`开发者工具`
- 导出：`导出时使用当前主题`

### 4.5 安全与健壮性

- 主题 CSS 可引用远程资源；默认允许 `http(s)` 图片/字体，但限制 `@import` 远程样式（可配置）。
- 主题 CSS 注入前做基本校验（拒绝 `</style>`、`expression()` 等）。
- 单个主题加载失败时回退默认主题，不阻塞编辑。
- 监听文件变化，主题目录变动时刷新列表；当前主题被删除时回退。
- 主题 CSS 可能很大，做缓存（mtime + hash）。

---

## 5. 实施路线

| 阶段 | 内容 | 产出 | 预估 |
|---|---|---|---|
| **P1 主题基础设施** | 用户主题目录、扫描、列表、切换、`base.user.css` / `{theme}.user.css`、打开文件夹、刷新 | 可用第三方 CSS 主题 | 1.5–2 人日 |
| **P2 变量与 DOM 兼容层** | `#write` 包装、`mdtype`、`md-inline`、`.md-*` 类、任务/TOC/图片类、变量桥接 | Academic 类主题内容区可用 | 2.5–3 人日 |
| **P3 代码块兼容** | Prism token 双类、`pre.md-fences`、`.cm-s-inner` 别名、源码模式 `.cm-s-typora-default` 别名 | 代码块配色跟随主题 | 1.5–2 人日 |
| **P4 资源协议** | `theme://` 协议、`@import`/`url()` 重写、字体/背景图、CSP | 带资源的完整主题可用 | 1.5–2 人日 |
| **P5 导出主题化** | 导出注入当前主题、`.typora-export`、`@media print`、PDF | 导出/打印跟随主题 | 1.5–2 人日 |
| **P6 体验完善** | 明暗分别设主题、主题预览、错误提示、DevTools 入口、热重载 | 达到中级目标 | 1.5–2 人日 |

合计约 **10–13 人日**（不含内置主题移植与 UI 深度适配）。

### 验收清单

- [ ] 把 `academic.css` + 字体复制到用户主题目录，重启后出现在列表，内容区排版正确。
- [ ] `base.user.css` 改字体对所有主题生效。
- [ ] `academic.user.css` 只影响 Academic。
- [ ] Barfi 主题的 `@import "barfi/codeblock.dark.css"` 能加载。
- [ ] 代码块 `.cm-s-inner` 配色生效。
- [ ] `#write { max-width }` / `font-family` / `line-height` 生效。
- [ ] 任务列表 `.task-list-done` 划线生效。
- [ ] 专注模式 `--blur-text-color` 生效。
- [ ] 导出 HTML/PDF 使用当前主题。
- [ ] 主题目录变动后列表自动刷新。

---

## 6. 风险与注意事项

1. **UI 无法完全兼容**：Typora 主题里 5%–20% 的选择器是 UI 专属。需要明确告知用户“内容区兼容，界面仅跟随主色”。
2. **CSS 特异性冲突**：Typora 主题常用 `#write h1`、`.md-fences` 等高特异性选择器；兼容层别名要用 `:where()` 或同特异性选择器，避免被应用样式覆盖。
3. **CodeMirror → Prism 映射不完美**：部分 token 语义不同（如 `cm-variable-2`），需要逐个调。
4. **`content` 元素不存在**：Typora 的 `content` 是写作区外层容器；Typeleft 需提供等价包装，否则背景图规则失效。
5. **字体加载跨域/协议**：Tauri WebView 对 `file://` 限制较多，优先自定义协议。
6. **导出资源**：导出 HTML 若引用 `theme://`，在浏览器打开会失效；需要转 `file://` 或内联。
7. **性能**：主题 CSS 可能包含大量 `@font-face` 与图片；切换主题时避免整页重排，可先 `disabled` 旧 link 再加载新 link。
8. **安全性**：允许任意 CSS 意味着可加载远程资源，需要给用户明确提示，并提供“禁用远程资源”开关。

---

## 附录 A：调研页面索引

### theme.typora.io

- [Install Theme](https://theme.typora.io/doc/Install-Theme/)
- [Write Custom Theme](https://theme.typora.io/doc/Write-Custom-Theme/)

### support.typora.io/style/ 及其子页（15）

- [Style 索引](https://support.typora.io/style/)
- [About Themes](https://support.typora.io/About-Themes/)
- [Add Custom CSS](https://support.typora.io/Add-Custom-CSS/)
- [Auto Numbering for Headings](https://support.typora.io/Auto-Numbering/)
- [Change Background](https://support.typora.io/Backgound/)
- [Change Styles in Focus Mode](https://support.typora.io/Change-Styles-in-Focus-Mode/)
- [Code Block Styles](https://support.typora.io/Code-Block-Styles/)
- [Custom Fonts](https://support.typora.io/Custom-Font/)
- [Debug Themes / CSS](https://support.typora.io/Debug-Themes/)
- [Whitespace and Line Breaks](https://support.typora.io/Line-Break/)
- [Line Spacing and Paragraph Spacing](https://support.typora.io/Line-Spacing/)
- [Customize List Styles](https://support.typora.io/List-Style/)
- [Task List](https://support.typora.io/Task-List/)
- [Control TOC Levels](https://support.typora.io/TOC-levels/)
- [Typesetting with CSS](https://support.typora.io/Typeset/)
- [Change Width of Writing Area](https://support.typora.io/Width-of-Writing-Area/)

## 附录 B：Typora CSS 变量速查与 Typeleft 映射

| Typora 变量 | 用途 | Typeleft 对应/映射 |
|---|---|---|
| `--bg-color` | 窗口/写作区背景 | `--editorColor00` / `--editorBgColor` |
| `--text-color` | 正文颜色 | `--editorColor` |
| `--md-char-color` | Markdown 标记颜色 | `--editorColor30` |
| `--meta-content-color` | 链接地址/图片说明 | `--editorColor40` |
| `--primary-color` | 主色/按钮/链接 | `--themeColor` |
| `--primary-btn-border-color` | 主按钮边框 | `--themeColor` |
| `--primary-btn-text-color` | 主按钮文字 | `#fff` |
| `--window-border` | 侧栏/窗口边框 | `1px solid var(--editorColor10)` |
| `--side-bar-bg-color` | 侧栏背景 | `--editorColor00` |
| `--active-file-bg-color` | 文件选中背景 | `--editorColor04` |
| `--item-hover-bg-color` | 条目悬浮背景 | `--floatHoverColor` |
| `--item-hover-text-color` | 条目悬浮文字 | `--editorColor50` |
| `--monospace` | 代码字体 | `--codeFontFamily`（需新增） |
| `--blur-text-color` | 专注模式淡化色 | `--editorColor10` |
| `--search-select-bg-color` | 搜索高亮 | `--highlightColor` |
| `--search-select-text-color` | 搜索高亮文字 | `--selectionColor` |
| `--table-border-color` | 表格边框 | `--tableBorderColor` |
| `--window-border-color` | 窗口边框色 | `--editorColor10` |

## 附录 C：选择器兼容速查

| Typora | Typeleft 现状 | 兼容动作 |
|---|---|---|
| `#write` | `#ag-editor-id`（渲染根） | 渲染根改为 `div#write.ag-editor-id`，同步改查询选择器 |
| `#write > p` | `#ag-editor-id > p.ag-paragraph` | 渲染根改为 `#write` 后直接命中；否则重写 `>` 选择器 |
| `#write h1..h6` | `h1..h6` | 加 `#write` 后直接命中 |
| `#write blockquote` | `blockquote` | 直接命中 |
| `#write table` | `table` | 直接命中 |
| `#write pre` | `pre.ag-paragraph` | 直接命中（标签） |
| `pre.md-fences` | `pre.ag-fence-code` | 补 `md-fences` 类 |
| `pre.md-meta-block` | `pre.ag-front-matter` | 补 `md-meta-block` 类 |
| `[mdtype="math_block"]` | `pre.ag-multiple-math` | 补 `mdtype` |
| `[mdtype="heading"]` | `h1#key.ag-paragraph` | 补 `mdtype` |
| `[mdtype="paragraph"]` | `p#key.ag-paragraph` | 补 `mdtype` |
| `.md-toc` / `.md-toc-h1..h6` | 无 | 实现 TOC 后补类 |
| `ul.task-list li.task-list-item` | `li.ag-task-list-item` | 补 `task-list` / `task-list-item` |
| `.task-list-done` | 无 | 完成态补类 |
| `.md-image` | `span.ag-image-container` | 补 `md-image` |
| `.md-meta` / `.md-content` | `span.ag-remove` / `span.ag-hide` | 补类 |
| `span[md-inline="strong"]` | `strong` 无外层 | 渲染时加 `md-inline` |
| `.cm-s-inner .cm-keyword` | `.token.keyword` | token 双类 + 映射 |
| `.cm-s-typora-default` | `.cm-s-one-dark` | 源码容器加别名类 |
| `#typora-source` | CodeMirror 容器 | 加 id 别名 |
| `.typora-export` | 无 | 导出容器加类 |
| `body.on-focus-mode` | `container.ag-focus-mode` | body 加类 |
| `.md-focus` | `.ag-active`? | 映射当前块类 |
| `.md-focus-container` | 无 | 容器补类 |

## 附录 D：样本主题观察

### Academic（58 个选择器）

- 使用 `#write`、`#sidebar-loading-template`、`.file-list-item`、`.md-fences`、`.CodeMirror-*`、`.cm-s-typora-default`、`#typora-source`、`.md-def-name`、`sup.md-footnote`、`mark`、`pre.md-meta-block`、`.task-list-item`、`.md-task-list-item`、`.md-toc-inner`、`.md-header`。
- 变量：`--side-bar-bg-color`、`--window-border`、`--search-select-bg-color`、`--active-file-bg-color`、`--item-hover-bg-color`、`--control-text-color`、`--text-color`。
- 内容区主要依赖标签与 `#write`，兼容成本中等。

### Barfi（89 个选择器）

- 使用大量 Typora UI 选择器：`#toc-dropmenu`、`.outline-item`、`.auto-suggest-container`、`#typora-quick-open`、`.typora-quick-open-item`、`#typora-sidebar`、`.file-list-item`、`.sidebar-tabs`、`#md-searchpanel`、`.dropdown-menu`、`.popover-title`。
- 使用 `@import "barfi/mermaid.dark.css"`、`@import "barfi/codeblock.dark.css"`、`@import "barfi/sourcemode.dark.css"`。
- 变量覆盖非常全，适合作为“变量映射”测试样本。
- UI 选择器占比高，整窗兼容成本高；内容区仍可通过标签与 `#write` 命中。

## 附录 E：结论摘要

- **Typora 的自定义样式能力 = CSS 文件即主题 + 四层加载 + 语义变量 + `#write`/`md-*` DOM 契约 + CodeMirror 代码块 + 独立打印样式。**
- **Typeleft 目前只有“两套内置 CSS 的明暗切换”**，缺少用户主题目录、变量体系、DOM 契约、代码块映射与导出主题化。
- **兼容 Typora 主题是可行的，但要分层**：内容区优先，代码块其次，UI 最后；不要承诺整窗像素级一致。
- **最小可行路径**：P1（主题目录/加载）+ P2（`#write`/`mdtype`/变量桥接）+ P3（Prism token 双类），约 5–7 人日即可让 Academic 这类主题在内容区达到可用水平。
- **完整中级目标**再补 P4（资源协议）、P5（导出/打印）、P6（明暗分别设置与热重载），总计约 10–13 人日。
