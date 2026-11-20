# Milkdown PoC 报告（阶段 0）

> **状态说明（2026-11-21）**
> 本文件是阶段 0 的**历史记录**，其结论（「暂不切换」「大文档回退 Muya」）已被后续实现取代。
> 最终交付：v0.2.0（引擎切换）→ v0.2.1（修复）→ v0.3.0（标记与图片布局）→ v0.4.0（大文档改走源码模式）。
> 每个阻塞项的最终处理方式见文末「9. 后续结果对照」。

- 日期：2026-11-19
- 环境：Typeleft 0.1.5 + Tauri 2 + React 17 + macOS（Apple Silicon）
- Milkdown：`@milkdown/kit@7.23.0` + `@milkdown/plugin-prism@7.23.0`
- 集成方式：`@milkdown/kit/core` 手动 `Editor.make()`，未使用 `@milkdown/react` / `crepe`
- 插件：preset-commonmark、preset-gfm、plugin-history、plugin-listener、plugin-prism
- 测试入口：`settings.editorEngine = "milkdown"`，与 Muya 并存（默认仍为 muya）

---

## 1. 渲染结果

| 元素 | 结果 |
|---|---|
| 标题 H1–H6 | ✅ |
| 段落 / 换行 | ✅ |
| 粗体 / 斜体 / 删除线 / 行内代码 | ✅ |
| 引用块 | ✅ |
| 无序 / 有序列表 | ✅ |
| 任务列表 | ❌ 显示为普通 bullet，无 checkbox |
| 表格 | ✅（边框、表头） |
| 代码块 + Prism 高亮 | ✅ |
| 图片 | ❌ 相对路径未解析，显示空占位 |
| 数学 `$...$` / `$$...$$` | 未启用（PoC 范围外，文本保留） |
| Front Matter | ❌ 被当成 `***` + Setext 标题，YAML 结构被破坏 |
| 中文文本 | ✅ 正常显示 |
| 字数统计 / TOC / 搜索 / 撤销接入 | 未接入（阶段 1） |

截图：`/tmp/milkdown-poc/render.png`、`render2.png`

---

## 2. Markdown round-trip 差异

方法：打开 `test.md` → 不改动 → 触发菜单保存 → `diff -u`。

| 差异 | 分类 | 说明 |
|---|---|---|
| `---`（frontmatter 分隔）→ `***` | **语义丢失** | YAML 被当 thematic break |
| `tags: [test, poc]` → `tags: \[test, poc\]` + Setext 下划线 | **语义丢失** | frontmatter 内容被当作标题/段落 |
| 无序列表 `-` → `*` | 可接受规范化 | 语义一致，但会改动文件 |
| 任务列表 `- [ ]` → `* [ ]` | 可接受规范化 | 仍是合法 GFM task list |
| 表格对齐空格（`Name  |`、`| 1     |`） | 可接受规范化 | 语义一致 |
| 标题 / 引用 / 代码块 / 行内样式 / 图片 / 脚注 | 无差异 | ✅ |

结论：**基础语法 round-trip 良好，但 frontmatter 会被破坏，必须在切换前修复**。

---

## 3. 性能

| 文档 | 大小 | Milkdown 创建耗时 |
|---|---|---|
| 渲染检查文档 | 628 B | 21–35 ms（首次 35ms） |
| 性能文档（4800 个 Section） | 1.0 MB | **17,802 ms（约 17.8 秒）** |

- 小文档：可接受
- 1MB：**不可接受**（超过门槛 10 倍）
- 原因：ProseMirror 全量构建与渲染约 3 万+ 节点，无虚拟化；Milkdown/Tiptap 均基于 ProseMirror，换 Tiptap 不会改善

---

## 4. 阻塞项与修复路径

| # | 问题 | 修复路径 | 阶段 |
|---|---|---|---|
| 1 | Frontmatter 被破坏 | `remark-frontmatter` + 自定义 atom 节点 + 序列化规则 | 阶段 2（必须） |
| 2 | 图片相对路径不加载 | 自定义 image nodeView：`convertFileSrc` 解析本地路径，复用现有 `imageAction` | 阶段 2（必须） |
| 3 | 任务列表无 checkbox | 启用 GFM taskList 节点 + 自定义 nodeView/CSS | 阶段 2 |
| 4 | 1MB 文档 17.8s | 方案 A：按文件大小回退 Muya（>500KB）；方案 B：分块/懒渲染（ProseMirror 需自研）；方案 C：接受大文档慢并提示 | 阶段 1 前决策 |
| 5 | 字数/TOC/搜索/撤销 | 阶段 1 适配层 | 阶段 1 |
| 6 | 中文 IME | 需人工验证（拼音组合、候选词、标点） | 阶段 1 前人工 |

---

## 5. 需人工验证的项

- 中文拼音输入法（composition 事件、候选词、全角标点）
- 长文档（100KB–1MB）实际输入延迟与滚动流畅度
- 菜单粘贴（当前仅系统 Cmd+V 生效，PoC 未接入菜单 Paste 事件）
- 图片拖拽、表格编辑手感

---

## 6. 结论

**PoC 结论：基础能力可行，但未达到切换门槛，暂不进入阶段 1 的默认切换。**

- ✅ 小文档渲染与 round-trip 基础语法良好（21–35ms）
- ❌ Frontmatter 语义丢失、图片与任务列表缺失
- ❌ 1MB 文档 17.8s，属于架构级问题
- ⚠️ IME 尚未人工验证

建议：

1. **先做 4 项技术验证**（frontmatter、image nodeView、taskList、大文档策略），每项 1–2 天，全部通过再进入阶段 1
2. **大文档策略**优先定为「按大小回退 Muya」：>500KB 自动使用 Muya，Milkdown 只处理中小文档
3. **不建议换 Tiptap**：同样基于 ProseMirror，1MB 性能问题相同，且 Markdown 保真度需更多自研
4. 若 4 项验证中任一失败（尤其是 frontmatter 或大文档），暂停迁移，保留 Muya 并继续维护

---

## 7. 附：PoC 代码

- `src/components/MilkdownEditor/index.tsx`（最小实现 + 计时 + 序列化）
- `src/components/Editor/index.tsx`：`options.editorEngine === 'milkdown'` 分支
- 依赖：`@milkdown/kit@7.23.0`、`@milkdown/plugin-prism@7.23.0`
- 回退：设置 `editorEngine` 为 `muya` 或删除该键即可

---

## 8. 阶段 2 增补：无头 round-trip 回归（v0.2.0）

PoC 之后新增了 `scripts/milkdown-roundtrip.ts`，用 Domino 提供 DOM，在 Node/Bun 中直接运行 Milkdown 的 `解析 → 序列化` 管线（commonmark + gfm + history + frontmatter + math），可重复执行：

```bash
bun run test:roundtrip
```

### 结果

| 文档 | 与原文一致 | 幂等（二次序列化不再变化） |
|---|---|---|
| `scripts/fixtures/roundtrip.md`（基础语法 + 数学 + 脚注 + frontmatter） | 否（仅表格补空格） | ✅ |
| `scripts/fixtures/roundtrip-edge.md`（Setext、嵌套列表、HTML、TOML、转义） | 否（见下） | ✅ |

### 差异分类

| 差异 | 分类 | 说明 |
|---|---|---|
| 表格单元格按列宽补空格 | 可接受 | 语义不变，第二次起稳定 |
| Setext 标题 → ATX | 可接受 | `Title\n===` → `# Title` |
| 缩进代码块 / `~~~` → 三反引号 | 可接受 | 语义不变 |
| 列表符号统一 `-`（跟随设置） | 可接受 | `*`/`+` → `-` |
| 硬换行 `  ⏎` → `\⏎` | 可接受 | 仍为硬换行 |
| `***` / `___` 分隔线 → `---` | 可接受 | 与 Typora 一致 |
| 相邻有序列表合并后重编号 | 可接受 | CommonMark 中编号本身无语义 |
| 实体 `&lt;tag&gt;` → `\<tag>` | 可接受 | 仍为纯文本，未被当作 HTML |
| 文档末尾孤立的 `<br>` | **会丢失** | 已知边界问题；段落内 `<br>` 保留 |
| YAML / TOML frontmatter | 无差异 | 类型也保留 |
| 行内/块级数学、脚注、HTML 块、图片、链接标题 | 无差异 | ✅ |

### 性能（Domino，无界面）

| 字符数 | 解析 + 渲染 | 序列化 |
|---|---|---|
| ~90K | 457 ms | 78 ms |
| ~180K | 990 ms | 144 ms |
| ~270K | 1.7 s | 196 ms |
| ~449K | 4.7 s | 338 ms |
| ~919K | 14.9 s | 1.1 s |

结论：ProseMirror 无虚拟化，耗时随文档线性→超线性增长。因此 **>200K 字符自动回退 Muya**（`LARGE_DOC_LIMIT`），界面顶部给出提示。（v0.4.0 起改为自动源码模式，见第 9 节。）

### 序列化配置

```ts
ctx.update(remarkStringifyOptionsCtx, prev => ({
  ...prev,
  bullet: settings.bulletListMarker || '-',
  rule: '-',
  fence: '`',
  listItemIndent: 'one',
}))
```

该配置同时消除了 PoC 阶段观察到的 `-` → `*` 与 `---` → `***` 两类差异。


---

## 9. 后续结果对照（2026-11-21）

阶段 0 列出的阻塞项与最终处理方式：

| 阶段 0 的问题 | 最终处理 | 版本 |
|---|---|---|
| Frontmatter 被破坏 | `remark-frontmatter`（YAML + TOML）+ 自定义 atom 节点，round-trip 逐字节一致，双击可编辑 | v0.2.0 |
| 图片相对路径不显示 | 自定义 image nodeView + `convertFileSrc`，复用 `services/imageAction.ts` 的粘贴/拖拽/上传策略 | v0.2.0 |
| 任务列表无 checkbox | GFM taskList 节点 + CSS checkbox，点击切换 | v0.2.0 |
| 数学未启用 | `remark-math` + 自研 KaTeX 节点（未采用 `@benrbray/prosemirror-math`，避免 ProseMirror peer 冲突） | v0.2.0 |
| 图表无插件 | 在 code block NodeView 内做预览（Mermaid / Flow / Sequence / PlantUML / Vega），markdown 仍是普通围栏块 | v0.2.0 |
| 1MB 文档 17.8s | 先回退 Muya；v0.4.0 起改为**自动进入 CM6 源码模式**（CM6 虚拟滚动），打开 ~2.8s | v0.2.0 / v0.4.0 |
| 搜索/撤销/字数/TOC 未接 | Decoration 搜索替换、history 插件、StateChange（字数 + 大纲上限 500） | v0.2.0 |
| 中文 IME 未验证 | 2026-11-21 用**小鹤双拼**真机验证：组合下划线、候选窗、`vswf`→中文、无残留拼音 | v0.4.0 |
| 代码块无语言/行号 | 自研 code block NodeView：语言下拉、行号、换行、复制、Prism 高亮 | v0.2.0 |

阶段 0 建议的「回退 Muya」只作为过渡方案存在了一个版本周期，v0.4.0 起 Muya 仅保留为设置里的手动选项。
