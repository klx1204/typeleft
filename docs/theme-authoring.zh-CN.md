# 主题开发指南

面向编写 Typeleft 主题、或把 Typora 主题移植过来的作者。

- 适用于 Typeleft **0.9.0**。
- Typeleft 是 Tauri 应用，编辑器本身是网页，所以主题仍然是一个 CSS 文件加可选字体/图片。
- 设计目标是兼容 Typora：内容区保留 `#write`、标准标签、`md-*` 类、CSS 计数器和 `@font-face`。
- React 外壳（侧栏、弹窗、菜单）不能做结构性换肤，只能通过 CSS 变量跟随配色。

---

## 1. 安装与加载

1. 打开 **设置 → 主题与图表 → 打开主题文件夹**。
2. 把 `.css`（以及字体/图片）复制进去。
3. 在主题列表中选择，立即生效。

常见目录：

| 平台 | 路径 |
|---|---|
| macOS | `~/Library/Application Support/com.typeleft.desktop/themes/` |
| Windows | `%APPDATA%\com.typeleft.desktop\themes\` |
| Linux | `~/.local/share/com.typeleft.desktop/themes/` |

目录中的任意 `.css` 会出现在列表里；`*.user.css` 不显示，因为它们是覆盖文件。推荐使用小写加连字符命名。

### 加载顺序

```
your-theme.css
base.user.css            （可选，对所有主题生效）
your-theme.user.css      （可选，只对 your-theme.css 生效）
```

`.user.css` 前面的名字必须与主题文件名完全一致（区分大小写）。

### 资源处理

- 相对 `@import "sub.css"` 会被内联（最多 3 层）。
- 相对 `url(...)` 会转成 `data:` URL，主题是自包含的。
- 支持：`woff2`、`woff`、`otf`、`ttf`、`png`、`jpg`、`jpeg`、`gif`、`webp`、`svg`、`bmp`。
- 网络地址（`http:`、`https:`、`//`）、绝对路径、主题目录之外的路径会被**拦截**；对应的 `url()` 会变空，并在控制台给出警告。
- 字体和图片必须放在主题文件夹内，用相对路径引用。

---

## 2. DOM 契约

编辑器根节点：

```html
<div id="write" class="milkdown-write">
  <div class="milkdown-host">
    <div class="milkdown">
      <div class="ProseMirror" contenteditable="true"> … 文档 … </div>
    </div>
  </div>
</div>
```

因此 Typora 主题里的 `#write > p` 默认匹配不到。Typeleft 会自动把 `#write >` 重写为 `#write .ProseMirror >`，所以大多数 Typora 主题可以直接用。新主题建议写：

```css
#write .ProseMirror > p { … }
```

### 元素与类

| Markdown | DOM |
|---|---|
| 标题 | `#write .ProseMirror h1` … `h6`，带生成的 `id` |
| 段落 | `p`；空段落有 `.is-empty` 和 `data-placeholder` |
| 粗体/斜体/删除线 | `strong`、`em`、`s` |
| 行内代码 | `code` |
| 链接 | `a[href]` |
| 高亮/上标/下标 | `mark`、`sup`、`sub` |
| 下划线 | `u` |
| 引用 | `blockquote` |
| 列表 | `ul`、`ol`、`li` |
| 任务列表 | `li[data-item-type="task"][data-checked="true|false"]` |
| 分隔线 | `hr` |
| 表格 | `.tableWrapper > table`；`th`/`td`、`colgroup > col`、`.selectedCell`、`.column-resize-handle` |
| 代码块 | `.md-fences-wrapper` > `.md-fences-header`（`.md-fences-language`、`.md-fences-actions`）、`.md-fences-body`（`.md-fences-gutter`、`pre.md-fences > code.md-fences-content`） |
| 语法 token | Prism：`.token.keyword`、`.token.function` 等 |
| 数学 | `.math-node.math-inline` / `.math-node.math-block`，内部 KaTeX |
| 图表 | `.diagram-preview.active` |
| Front Matter | `pre[data-type="frontmatter"]`；编辑态 `.frontmatter-editor`、`.fm-key`、`.fm-section`、`.fm-comment`、`.fm-error` |
| 脚注 | `sup[data-type="footnote_reference"]`、`dl[data-type="footnote_definition"]`、悬浮预览 `.footnote-preview` |
| 分页 | `.page-break` |
| 原始 HTML | `.md-html-block`、`.md-html-inline` |
| 搜索 | `.typeleft-search-match`、`.typeleft-search-active` |
| 拼写错误 | `.tl-spell-error` |
| 占位符 | `p.is-empty::before { content: attr(data-placeholder) }` |
| 图片 | `.md-image.image-node > img`、`.image-toolbar`、`.image-resize-handle`、`data-align`、`data-width` |
| 选中节点 | `.ProseMirror-selectednode` |

### 状态类

- `#write.focus-mode`：专注模式开启。
- `body.code-block-no-line-numbers`：用户关闭了代码块行号。
- `body.code-block-wrap`：代码块自动换行。
- `#write.typewriter`：打字机模式。
- `.ProseMirror-focused`：编辑器有焦点。
- `window.actualTheme` 为 `"light"` 或 `"dark"`。

### 源码模式

CodeMirror 6 是**独立区域**，不在 `#write` 内：

```
.cm-editor, .cm-content, .cm-gutters, .cm-activeLine,
.cm-selectionBackground, .cm-cursor
```

内容主题不会自动作用于源码模式；需要额外写 `.cm-*` 规则。CodeMirror 会注入自己的样式，必要时提高选择器优先级。

### 不属于主题契约

侧栏、设置、菜单、搜索栏、选择器、链接弹窗、图片工具条的结构属于 React UI，不能换布局，只能跟随颜色变量。不要依赖它们的内部类名。

---

## 3. 层叠与优先级

- Typeleft 自带样式放在 `@layer typeleft-base`。
- 主题注入到 `<style id="typeleft-user-theme">`，**不在 layer 内**，所以普通主题规则会胜过基础层。
- 不要把主题包进 `@layer`，除非你明确想和基础层竞争层级顺序。
- 通常不需要 `!important`；只有 CodeMirror 源码模式覆盖不了时才考虑。

---

## 4. 应用提供的颜色变量

优先使用这些变量，不要硬编码强调色：

```css
:root {
  --themeColor: …;
  --themeColor10 … --themeColor90;
  --editorColor: …;
  --editorColor80/60/50/40/30/10/06/04/02;
  --editorColor00: …;
  --app-bg-color: …;
  --editorBgColor: …;
  --sideBarBgColor: …;
  --floatBgColor: …;
  --floatBorderColor: …;
}
```

Typeleft 会把常见 Typora 变量桥接到外壳：

| Typora 变量 | 效果 |
|---|---|
| `text-color` | `--editorColor*` |
| `bg-color` | 背景/表面变量 |
| `primary-color` | `--themeColor` |
| `side-bar-bg-color` | 侧栏背景 |
| `window-border-color` | 浮层边框颜色 |

只设置这五个变量也能让外壳配色协调：

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

## 5. 设置令牌（0.9+）

**设置 → 排版** 与主题 CSS 通过设计令牌协作。每个设置有三态：跟随主题（默认）、内置默认、自定义。只有显式修改才会输出 CSS，所以主题在用户未覆盖时完全说了算。

变量：

```css
--tl-body-font
--tl-code-font
--tl-editor-bg
--tl-line-height
--tl-paragraph-gap
--tl-list-marker
--tl-ordered-marker
--tl-focus-dim        /* 预留给专注模式强度 */
```

`#write` 上的属性：

```html
data-direction="ltr|rtl"
data-heading-numbering="true|false"
data-tl-justify="true|false"
data-tl-font / data-tl-code-font / data-tl-bg
data-tl-line-height / data-tl-paragraph-gap
data-tl-list-marker / data-tl-ordered-marker
```

优先级：

1. 用户没改设置 → **主题胜出**；
2. 用户显式修改 → Typeleft 输出针对性覆盖；
3. 主题可以用 `var(--tl-*, 回退值)` 主动接入设置，也可以忽略。

```css
#write {
  font-family: var(--tl-body-font, "Theme Serif", serif);
  background: var(--tl-editor-bg, #fdf6e3);
  line-height: var(--tl-line-height, 1.7);
}

#write p { margin-bottom: var(--tl-paragraph-gap, 1em); }

#write[data-direction="rtl"] { direction: rtl; text-align: right; }
#write[data-heading-numbering="true"] h1::before { content: counter(h1) " "; }
```

编辑器通过 `#write[data-*]` 应用显式设置；HTML/打印导出会收到同样的令牌（直接 CSS）。Pandoc 格式只映射目标格式能理解的值（字体/字号），不会继承完整 CSS 主题。

---

## 6. Typora 兼容性说明

**通常可用**

- `#write` + 标签选择器（`p`、`h1`、`blockquote`、`table`、`pre` 等）。
- `#write > x`（自动重写）。
- CSS 计数器做标题编号。
- `@font-face` 与相对字体/图片。
- `base.user.css` / `{theme}.user.css`。
- `prefers-color-scheme` 媒体查询。

**需要注意**

- 代码块：`pre.md-fences` 保留，但外面多了 header、行号槽和操作按钮；假设 `pre` 是整块的规则可能需要调整。
- `md-*` 类：只有本文档列出的稳定。Typora 的 TOC、定义列表或编辑器外壳类可能不存在。
- UI：Typora 主题的侧栏/标题栏规则不会作用于 React 外壳。
- 外部字体/图片会被拦截；请本地打包。
- VLOOK 等重排版主题可能需要修选择器。

---

## 7. 调试清单

1. 打开 **视图 → 开发者工具**（发布版也可用）。
2. 检查 `#write` 与 `.ProseMirror` 的计算字体、颜色、背景。
3. 确认 `@font-face` 在 Network/Computed 中加载成功。
4. 测试明暗模式；一次只能启用一个自定义主题。
5. 如果写了源码模式样式，单独测试 `.cm-*`。
6. 测试标题、表格、代码块、任务列表、图片、脚注。
7. 修改文件后在设置中重新选择主题；无需重启。
8. 看控制台：被拦截的外部资源会提示。

**导出限制（0.9）：** HTML/打印导出会应用主题和设置令牌；Pandoc 的 docx/ePub/PDF 不使用 CSS 主题，只映射字体/字号等令牌。

---

## 8. 最小示例

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

#write .ProseMirror table { border-collapse: collapse; }
#write .ProseMirror th,
#write .ProseMirror td { border: 1px solid #ddd; padding: 6px 10px; }

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

## 9. 契约稳定性

稳定：

- `#write`、`.ProseMirror`、标准 HTML 标签。
- 本文档列出的 `md-*` 内容类。
- `.token.*` Prism 类。
- `@layer typeleft-base` + 主题 unlayered 的优先级。

可能变化：

- 工具条/弹窗/选择器内部。
- 代码块、表格除文档描述外的具体嵌套。
- 侧栏和对话框 DOM。

公开分享主题时请注明适配的 Typeleft 版本。目前没有应用内主题市场；可以附仓库链接并开 issue/discussion。
