# Typeleft → Milkdown 迁移计划

- 目标版本：v0.2.0（编辑器引擎切换）
- 技术栈：Tauri 2 + Rust（不变）+ React（不变）+ Milkdown 7.23
- 原则：**Markdown 文本仍为唯一数据源**，文件读写、自动保存、冲突检测、备份、导出全部复用现有 Rust/前端逻辑

---

## 1. 目标与非目标

### 目标

1. 用 Milkdown（ProseMirror + remark）替换 Muya，作为默认所见即所得编辑器
2. 保持现有文件格式、自动保存、备份、搜索、状态栏、主题系统行为不变
3. 打开 → 不修改 → 保存，Markdown 内容保持一致（差异必须可解释）
4. 中文输入、1MB 文档、表格、数学、代码块、图表可用

### 非目标（本期不做）

- 协同编辑（Yjs）
- 移动端
- 更换源码模式（仍为 CodeMirror，后续再升级到 CM6）
- Typora 主题整窗 UI 版式兼容
- 新增功能（TOC 块、Alerts 等）

---

## 2. 技术选型

```json
{
  "@milkdown/kit": "7.23.0"
}
```

数学与图表插件现状（npm 实测）：

| 包 | 最新版本 | 最后发布 | 结论 |
|---|---|---|---|
| `@milkdown/plugin-math` | 7.5.9 | 2024-12 | 不跟随主版本，不可用 |
| `@milkdown/plugin-diagram` | 7.7.0 | 2025-03 | 不跟随主版本，不可用 |
| `@benrbray/prosemirror-math` | 1.0.0 | 2024-04 | **纯 ProseMirror 实现，MIT，可直接集成** |
| `@tiptap/extension-mathematics` | 3.34.0 | 活跃 | Tiptap 专用，NodeView 可移植作备选 |
| `prosemirror-mermaid` / `tiptap-extension-mermaid` | 0.0.0 | 未正式发布 | 不可用 |

方案：

| 能力 | 方案 |
|---|---|
| 数学 | **首选 `@benrbray/prosemirror-math`**（schema + NodeView + KaTeX），与 ProseMirror 版本冲突时回退为自研 KaTeX NodeView |
| 图表 | 自研统一 `diagram` 节点（Mermaid / Flow / Sequence / PlantUML / Vega），复用现有 `lib/renderers`，约 1 周 |
| 脚注 | 自定义节点或 remark 插件 |
| Frontmatter | 自定义 atom 节点 + remark-frontmatter |
| TOC | 自定义节点（可选，P2） |
| 源码模式 | **CodeMirror 6**（`@codemirror/state`、`view`、`commands`、`lang-markdown`、`search`、`language`） |

集成方式：不使用 `@milkdown/react`（它依赖 `@milkdown/crepe`，自带 Notion 风格 UI 与主题，和现有界面冲突），改用 `@milkdown/kit` 手动创建：

```ts
const editor = await Editor.make()
  .config((ctx) => { ctx.set(rootCtx, container) })
  .use(commonmark).use(gfm).use(history).use(listener).use(prism)
  .create()
```


---

## 3. 架构

### 3.1 组件结构

```
src/components/
├── Editor/index.tsx          ← 不变，按 settings.editorEngine 选择引擎
├── Muya/index.tsx            ← 保留一个版本周期
└── MilkdownEditor/
    ├── index.tsx             ← React 包装，接口与 MuyaEditor 对齐
    ├── setup.ts              ← 编辑器初始化（preset/plugins）
    ├── nodes/                ← 自定义节点（math、diagram、image、footnote、frontmatter）
    ├── plugins/              ← 自定义插件（搜索高亮、图片上传、光标同步）
    └── theme.css             ← ProseMirror 基础样式 + 主题变量
```

### 3.2 接口对齐

`MilkdownEditor` 必须实现与 `MuyaEditor` 相同的 props：

```ts
interface IEditorProps {
  markdown: string
  cursor: any
  options: any
  searchOpen: number
  searchArg?: { value: string; opt: any }
  scrollTopRef: React.MutableRefObject<number>
  onMarkdownChange: (md: string) => void
  onCursorChange: (cursor: any) => void
  onSearchArgChange: (arg?: { value: string; opt: any }) => void
  onSearchOpenChange?: (open: number) => void
}
```

Editor 层不改逻辑，只按 `options.editorEngine` 条件渲染。

### 3.3 数据流

```
打开文件 (Rust) → markdown 字符串
   → Milkdown: replaceAll(md)
   → 用户编辑 → plugin-listener markdownUpdated → onMarkdownChange(md)
   → 现有自动保存/冲突/备份逻辑（不变）
```

外部切换文件时：

```
markdown prop 变化 → 若与编辑器当前 md 不同 → replaceAll(新内容) + 恢复滚动位置
```

### 3.4 关键适配点

| 能力 | 方案 |
|---|---|
| 光标 | ProseMirror `{from,to}` ↔ `{line,ch}`：维护"文档位置 → 行/列"映射（可用 `state.doc.textBetween` 构建行偏移表） |
| 搜索 | ProseMirror Decoration 高亮 + 遍历文本节点计算匹配；替换用 transaction |
| 撤销/重做 | `plugin-history` + 菜单 `Undo/Redo` 事件映射 |
| 字数统计 | `state.doc.textContent` 复用现有 `wordCount` |
| TOC | 遍历 heading 节点生成（替代 Muya 的 tocCtrl） |
| 专注/打字机 | ProseMirror decoration + 滚动逻辑 |
| 主题 | 保留 `#write` 容器，Milkdown 节点输出加 `md-*` 类；现有 `customTheme` 加载逻辑复用 |

---

## 4. 阶段计划

### 阶段 0：PoC（3–5 天）

任务：

1. 安装依赖，创建最小 `MilkdownEditor`（commonmark + gfm + history + listener）
2. 加载现有测试文档（标题/表格/代码/数学/图片/脚注/frontmatter/中文）
3. 验证：
   - 打开 → 不修改 → 序列化，Markdown 差异清单
   - 中文 IME（拼音输入、候选词、标点）
   - 1MB 文档输入延迟
   - 表格编辑、代码块高亮、图片显示

**决策门槛（不过则暂停并评估 Tiptap）**

- Markdown 差异可解释，不破坏渲染语义
- 中文输入无异常
- 1MB 文档可编辑（单次输入 < 100ms）
- 表格/代码/图片基本可用

### 阶段 1：适配层（1.5–2 周）

1. `MilkdownEditor` 完整 props 对齐（markdown/cursor/scroll/search）
2. 光标 ↔ 行/列映射，滚动恢复
3. 搜索/替换（Decoration + 事务）
4. 撤销/重做接入菜单与快捷键
5. 字数统计、TOC 事件
6. 自动保存/冲突/备份回归（不改 Rust）
7. 设置项 `editorEngine`（milkdown / muya）

验收：打开/编辑/保存/搜索/撤销/备份全部可用。

### 阶段 1.5：源码模式 CM6（1–1.5 周）

1. 用 CM6 `EditorView` + `@codemirror/lang-markdown` 替换 CM5
2. 迁移查找/替换（`@codemirror/search`）
3. 迁移滚动位置恢复、光标同步（`{anchor, head}` ↔ 现有 cursor 格式）
4. 主题：CM6 编辑器主题变量，复用 light/dark 配色
5. 保持与 WYSIWYG 模式的切换、滚动位置互认

验收：源码模式功能与现有 CM5 一致，搜索/替换/滚动/主题正常。

### 阶段 2：功能对齐（4–6 周）

按依赖顺序：

1. **代码块**：Prism 高亮、语言选择、行号、自动换行、默认语言
2. **表格**：GFM 表格、增删行列、对齐、列宽、浮动工具条
3. **数学**：KaTeX 自定义节点（行内/块级/`$$`/编号预留）
4. **图片**：插入/粘贴/拖拽/上传、对齐、缩放、相对路径
5. **脚注 / 上下标 / 高亮 / Frontmatter**
6. **图表容器**：Mermaid / Flow / Sequence / PlantUML / Vega 自定义节点 + nodeView
7. **斜杠命令 / 快速插入**（slash 插件 + 现有配置）
8. **格式浮动工具栏**（tooltip 插件）
9. **专注模式 / 打字机模式**
10. **主题系统**：`#write` + `md-*` 钩子、Typora 变量桥接、代码块 token 映射

验收：与现有功能清单逐项对照，无回退。

### 阶段 3：切换与清理（1 周）

1. 默认引擎改为 milkdown，保留 muya 作回退开关
2. 全量手动回归（见第 6 节）
3. 打包体积、启动时间、内存对比
4. 移除 Muya（下一个版本）

### 阶段 4：发布（1 周）

1. 版本 0.2.0，CI 四平台
2. README / 文档更新（引擎说明、已知差异）
3. Release notes 列出保真度差异与回退方式

---

## 5. 风险登记

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Markdown round-trip 失真 | 高 | 高 | PoC 先做差异测试；保留 raw 节点；必要时用 remark 插件补齐 |
| 数学/图表插件不可用 | 高 | 中 | 数学用 `@benrbray/prosemirror-math`，冲突则自研 KaTeX 节点；图表自研 NodeView |
| CM6 迁移遗漏功能 | 中 | 中 | CM5 → CM6 只迁移搜索/滚动/光标/主题，逐项对照验证 |
| 中文 IME 异常 | 中 | 高 | PoC 重点验证；必要时锁定 ProseMirror 版本或调整 composition 处理 |
| 光标映射复杂 | 中 | 中 | 先近似（百分比），再精确映射；搜索/状态栏不依赖精确光标 |
| 大文档性能 | 中 | 中 | 1MB 基准；必要时分块/懒渲染 |
| 主题兼容层重做 | 中 | 中 | 保留 `#write`，按 ProseMirror 结构补 `md-*`；CSS 变量桥接复用 |
| 工期超预期 | 高 | 中 | 阶段 0 决策门槛；双引擎并存可随时回退 |
| 回归遗漏 | 中 | 高 | 第 6 节清单 + 每阶段截图验证 |

---

## 6. 回归清单

- [ ] 打开/新建/保存/另存为/最近文件
- [ ] 自动保存、冲突检测、备份恢复
- [ ] 源码模式切换、滚动位置保持
- [ ] 查找/替换（大小写/整词/正则）
- [ ] 撤销/重做（菜单 + Cmd+Z/Shift+Cmd+Z）
- [ ] 标题/段落/引用/列表/任务/表格/代码/数学/图表/图片/脚注
- [ ] 图片粘贴/拖拽/上传/相对路径
- [ ] 字数统计、TOC 大纲、点击跳转
- [ ] 专注模式、打字机模式
- [ ] 中英文界面切换
- [ ] 自定义主题（含字体/背景图/@import）
- [ ] 导出 HTML、打印
- [ ] 中文输入、复制粘贴（HTML/纯文本/图片）
- [ ] 1MB 文档、长表格、多图表文档

---

## 7. 决策点

| 节点 | 决策 |
|---|---|
| 阶段 0 结束 | round-trip/IME/性能达标 → 继续；否则评估 Tiptap 或暂缓 |
| 阶段 2 中期 | 图表/数学 nodeView 是否达到可用 → 决定是否保留 Muya 回退 |
| 阶段 3 结束 | 回归通过 → 默认切换；否则保持 muya 默认 |

---

## 8. 工期汇总

| 阶段 | 工期 |
|---|---|
| PoC | 3–5 天 |
| 适配层 | 1.5–2 周 |
| 源码模式 CM6 | 1–1.5 周 |
| 功能对齐 | 4–6 周 |
| 切换与清理 | 1 周 |
| 发布 | 1 周 |
| **合计** | **约 10–14 周（单人）** |

---

## 9. 实施状态（v0.2.0）

### 已交付

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | PoC、round-trip 差异清单、性能基线、报告 | ✅ |
| 1 | 适配层：cursor/scroll 同步、搜索替换、撤销重做、字数、TOC、自动保存兼容、`editorEngine` 设置 | ✅ |
| 1.5 | 源码模式 CodeMirror 6（替换 CM5，含搜索/光标/滚动/主题） | ✅ |
| 2 | 代码块、表格、数学、图片、脚注、Frontmatter、图表、格式工具栏、主题钩子 | ✅ |
| 2 | 斜杠命令菜单、`==高亮==`、上下标、图片对齐与拖拽缩放 | ✅ |
| 2（延后） | 表格列宽拖拽持久化、图片内联 HTML 的非常规写法规范化 | ⏸ 后续 |
| 3 | 默认引擎 milkdown、>200KB 回退 Muya、回归清单 | ⏳ 待人工回归 |
| 4 | 版本 0.2.0、四平台 CI、Release | ⏳ |

### 实现要点

- `src/components/MilkdownEditor/`
  - `index.tsx`：编辑器生命周期、菜单命令、搜索栏、格式/表格浮动工具栏、状态事件
  - `nodes/frontmatter.ts`：YAML/TOML atom 节点，保留种类，双击编辑
  - `nodes/math.ts`：`remark-math` + KaTeX 行内/块级节点，双击编辑
  - `nodes/image.ts`：本地/相对路径 `convertFileSrc` 解析；粘贴/拖拽/上传走 `services/imageAction.ts`
  - `nodes/codeblock.ts`：语言选择、行号、换行、复制、Mermaid/Flow/Sequence/PlantUML/Vega 预览
  - `search.ts`：Decoration 搜索高亮与替换
  - `theme.css`：`@layer typeleft-base` 低优先级基础样式，Typora 主题（无 layer）始终覆盖
- `src/components/CodeMirror6/`：CM6 源码模式
- `src/services/imageAction.ts`：两套引擎共用的图片处理管线

### 序列化选项

为贴近 Typora/Muya 的输出，序列化器固定：

```ts
bullet: settings.bulletListMarker || '-'
rule: '-'
fence: '`'
listItemIndent: 'one'
```

### 已知差异（可接受）

- Setext 标题 → ATX（`#`）
- 缩进代码块 / `~~~` 围栏 → 三反引号围栏
- 表格单元格补齐空格（对齐列宽），**幂等**
- 列表符号统一为 `-`（跟随设置）
- 硬换行 `  ⏎` → `\⏎`
- 连续的有序列表按 CommonMark 语义合并后重新编号（编号本身无语义）
- `<br>` 作为文档最后一个块时会被丢弃；段落内 `<br>` 保留为 `<br />`

### 自动化测试

```bash
bun run test           # 四套测试
bun run test:engine    # 引擎选择与 200K 回退判定
bun run test:roundtrip # markdown 解析/序列化差异与幂等性
bun run test:cm6       # CodeMirror 6 冒烟
bun run test:web       # 真实浏览器渲染 + 交互回归
```

- `scripts/milkdown-roundtrip.ts`：Domino 中运行 Milkdown 解析/序列化，输出差异与幂等性
- `scripts/codemirror-smoke.ts`：CM6 文档载入、中文插入、撤销、搜索、全部替换
- `scripts/engine-select.ts`：默认 milkdown、显式 muya、阈值与 1MB 回退
- `scripts/web-smoke.sh` + `devtest/`：在无头 Chrome 中挂载真实的 `MilkdownEditor` 与
  `CodeMirror6` 组件（Tauri IPC 用 stub 替代），断言 frontmatter / 表格 / 任务列表 /
  KaTeX / 代码块行号 / Mermaid / 图片 / Prism token / TOC / 字数，并驱动搜索面板与
  真实输入（`execCommand`），任何 `console.error` 都会失败。可用 `?light=1` 检查浅色主题，
  `?static=1` 关闭交互，`?cm6=1` 只渲染源码模式。

### 包体积与发布

| 产物 | v0.1.5（Muya） | v0.2.0（Milkdown） | 变化 |
|---|---|---|---|
| macOS universal `.dmg` | 13 MB | 14 MB | +1 MB |
| Linux `amd64.AppImage` | 82 MB | 83 MB | +1 MB |
| Windows `x64-setup.exe` | 5 MB | 6 MB | +1 MB |

前端 `dist` 9.4 MB（其中主包 2.8 MB、mermaid 1.1 MB、vega-embed 0.7 MB）。
发布：v0.2.0（引擎切换）→ v0.2.1（菜单命令/主题/CM6 修复）→ v0.3.0（高亮、上下标、图片对齐缩放）。

### 需人工验证

- 中文 IME（拼音组合、候选词、全角标点）
- 50KB–200KB 文档输入延迟、滚动流畅度
- 主题（Academic 等）在 Milkdown 下的实际观感
- 表格编辑手感、图片拖拽
