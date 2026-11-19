# Milkdown PoC 报告（阶段 0）

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
