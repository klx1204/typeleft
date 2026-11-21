import React, { useEffect, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { applyCustomTheme } from 'services/customTheme';

interface ISettingsPageProps {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
}

const defaultSettings = {
  fontSize: 16,
  lineHeight: 1.6,
  focusMode: false,
  typewriter: false,
  editorAreaWidth: '',
  trimUnnecessaryCodeBlockEmptyLines: false,
  preferLooseListItem: true,
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  tabSize: 4,
  codeBlockLineNumbers: true,
  codeBlockWrap: false,
  codeBlockDefaultLanguage: '',
  listIndentation: 1,
  frontmatterType: '-',
  themeMode: 'system',
  sequenceTheme: 'simple',
  mermaidTheme: 'default',
  vegaTheme: 'latimes',
  hideQuickInsertHint: false,
  hideLinkPopup: false,
  autoCheck: false,
  autoSave: true,
  spellcheckEnabled: false,
  spellcheckLang: '',
  superSubScript: true,
  sourceCode: false,
  lang: 'en',
  searchIsCaseSensitive: false,
  searchIsRegexp: false,
  searchIsWholeWord: false,
  insertLocalImageAction: 'none',
  insertWebImageAction: 'none',
  insertClipboardImageAction: 'none',
  preferRelativeImagePaths: false,
  autoEncodeImageURL: true,
  sidePaneWidth: 240,
  statusBarOpen: true,
  wordCountMethod: 0,
  animationEnable: true,
  fileStartupAction: 'none',
  folderStartupAction: 'openLast',
  defaultFileExtension: 'md',
  dragDropAction: 'open',
  recentFilesLimit: 10,
  searchServiceUrl: 'https://www.google.com/search?q=%s',
};

type Settings = Record<string, any>;

interface FieldDef {
  key: string;
  label: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  options?: (string | number)[];
}

const zhSections: Record<string, string> = {
    editor: '编辑器',
    typography: '排版',
    search: '搜索',
    markdown: 'Markdown',
    autoPair: '自动配对',
    extensions: '扩展',
    file: '文件',
    advanced: '高级',
    theme: '主题与图表',
    image: '图片',
    other: '其他',
};

const zhLabels: Record<string, string> = {
    fontSize: '字体大小',
    lineHeight: '行高',
    tabSize: '制表符宽度',
    editorAreaWidth: '编辑器区域宽度',
    typewriter: '打字机模式',
    focusMode: '专注模式',
    hideQuickInsertHint: '隐藏快速插入提示',
    hideLinkPopup: '隐藏链接弹窗',
    searchIsCaseSensitive: '区分大小写',
    searchIsRegexp: '正则表达式',
    searchIsWholeWord: '全词匹配',
    searchServiceUrl: '网页搜索地址',
    bulletListMarker: '无序列表标记',
    orderListDelimiter: '有序列表分隔符',
    listIndentation: '列表缩进',
    frontmatterType: 'Front Matter 类型',
    preferLooseListItem: '宽松列表项',
    trimUnnecessaryCodeBlockEmptyLines: '移除代码块多余空行',

    autoPairBracket: '自动配对括号',
    autoPairMarkdownSyntax: '自动配对 Markdown 语法',
    autoPairQuote: '自动配对引号',
    superSubScript: '上标/下标',
    codeBlockLineNumbers: '代码块显示行号',
    codeBlockWrap: '代码块自动换行',
    codeBlockDefaultLanguage: '代码块默认语言',
    themeMode: '主题模式',
    sequenceTheme: '时序图主题',
    mermaidTheme: 'Mermaid 主题',
    vegaTheme: 'Vega 主题',
    insertLocalImageAction: '本地图片操作',
    insertWebImageAction: '网络图片操作',
    insertClipboardImageAction: '剪贴板图片操作',
    preferRelativeImagePaths: '优先使用相对路径',
    autoEncodeImageURL: '自动编码图片 URL',
    autoSave: '自动保存',
    statusBarOpen: '显示状态栏',
    animationEnable: '启用动画',
    spellcheckEnabled: '拼写检查',
    spellcheckLang: '拼写检查语言',
    autoCheck: '自动勾选任务列表',
    lang: '语言',
    wordCountMethod: '字数统计方式',
    sidePaneWidth: '侧边栏宽度',
    fileStartupAction: '启动时（文件）',
    folderStartupAction: '启动时（文件夹）',
    defaultFileExtension: '默认扩展名',
    dragDropAction: '拖入文件行为',
    recentFilesLimit: '最近文件数量',
    textDirection: '文字方向',
    headingNumbering: '标题自动编号',
    justifyText: '正文两端对齐',
    listMarker: '无序列表符号',
    orderedMarker: '有序列表编号',
    bodyFont: '正文字体',
    codeFont: '代码字体',
    editorBackground: '编辑区背景色',
};

const sections: { title: string; key: string; fields: FieldDef[] }[] = [
  {
    title: 'Editor',
    key: 'editor',
    fields: [
      { key: 'fontSize', label: 'Font Size', type: 'number', min: 10, max: 40 },
      { key: 'lineHeight', label: 'Line Height', type: 'number', min: 1.0, max: 3.0, step: 0.1 },
      { key: 'tabSize', label: 'Tab Size', type: 'number', min: 1, max: 8 },
      { key: 'editorAreaWidth', label: 'Editor Area Width', type: 'text', placeholder: 'e.g. 800px or 60%' },
      { key: 'codeBlockLineNumbers', label: 'Code Block Line Numbers', type: 'checkbox' },
      { key: 'codeBlockWrap', label: 'Wrap Code Blocks', type: 'checkbox' },
      { key: 'codeBlockDefaultLanguage', label: 'Default Code Language', type: 'text', placeholder: 'e.g. javascript' },
      { key: 'typewriter', label: 'Typewriter Mode', type: 'checkbox' },
      { key: 'focusMode', label: 'Focus Mode', type: 'checkbox' },
      { key: 'hideQuickInsertHint', label: 'Hide Quick Insert Hint', type: 'checkbox' },
      { key: 'hideLinkPopup', label: 'Hide Link Popup', type: 'checkbox' },
    ],
  },
  {
    title: 'Typography',
    key: 'typography',
    fields: [
      { key: 'textDirection', label: 'Text Direction', type: 'select', options: ['ltr', 'rtl'] },
      { key: 'headingNumbering', label: 'Heading Auto Numbering', type: 'checkbox' },
      { key: 'justifyText', label: 'Justify Text', type: 'checkbox' },
      { key: 'listMarker', label: 'Bullet Marker', type: 'select', options: ['default', 'disc', 'circle', 'square'] },
      { key: 'orderedMarker', label: 'Ordered Marker', type: 'select', options: ['decimal', 'lower-alpha', 'lower-roman', 'upper-alpha', 'upper-roman'] },
      { key: 'bodyFont', label: 'Body Font', type: 'text', placeholder: 'e.g. "LXGW WenKai", serif' },
      { key: 'codeFont', label: 'Code Font', type: 'text', placeholder: 'e.g. "JetBrains Mono", monospace' },
      { key: 'editorBackground', label: 'Editor Background', type: 'text', placeholder: '#fdf6e3 or rgb(250, 246, 227)' },
    ],
  },
  {
    title: 'Search',
    key: 'search',
    fields: [
      { key: 'searchIsCaseSensitive', label: 'Case Sensitive Search', type: 'checkbox' },
      { key: 'searchIsRegexp', label: 'Regex Search', type: 'checkbox' },
      { key: 'searchIsWholeWord', label: 'Whole Word Search', type: 'checkbox' },
      { key: 'searchServiceUrl', label: 'Web Search URL', type: 'text', placeholder: 'https://www.google.com/search?q=%s' },
    ],
  },
  {
    title: 'Markdown',
    key: 'markdown',
    fields: [
      { key: 'bulletListMarker', label: 'Bullet List Marker', type: 'select', options: ['-', '*', '+'] },
      { key: 'orderListDelimiter', label: 'Ordered List Delimiter', type: 'select', options: ['.', ')'] },
      { key: 'listIndentation', label: 'List Indentation', type: 'select', options: [1, 2, 3, 4, 'dfm'] },
      { key: 'frontmatterType', label: 'Front Matter Type', type: 'select', options: ['-', '+'] },
      { key: 'preferLooseListItem', label: 'Prefer Loose List Items', type: 'checkbox' },
      { key: 'trimUnnecessaryCodeBlockEmptyLines', label: 'Trim Code Block Empty Lines', type: 'checkbox' },
    ],
  },
  {
    title: 'Auto Pairing',
    key: 'autoPair',
    fields: [
      { key: 'autoPairBracket', label: 'Auto Pair Brackets', type: 'checkbox' },
      { key: 'autoPairMarkdownSyntax', label: 'Auto Pair Markdown Syntax', type: 'checkbox' },
      { key: 'autoPairQuote', label: 'Auto Pair Quotes', type: 'checkbox' },
    ],
  },
  {
    title: 'Extensions',
    key: 'extensions',
    fields: [
      { key: 'superSubScript', label: 'Super/Sub Script', type: 'checkbox' },
    ],
  },
  {
    title: 'Files',
    key: 'file',
    fields: [
      { key: 'defaultFileExtension', label: 'Default Extension', type: 'text', placeholder: 'md' },
      { key: 'dragDropAction', label: 'Drop Files', type: 'select', options: ['open', 'insert-link', 'ignore'] },
      { key: 'recentFilesLimit', label: 'Recent Files Limit', type: 'number', min: 1, max: 30, step: 1 },
    ],
  },
  {
    title: 'Advanced',
    key: 'advanced',
    fields: [],
  },
  {
    title: 'Theme & Diagrams',
    key: 'theme',
    fields: [
      { key: 'themeMode', label: 'Theme Mode', type: 'select', options: ['system', 'light', 'dark'] },
      { key: 'sequenceTheme', label: 'Sequence Diagram Theme', type: 'select', options: ['simple', 'hand'] },
      { key: 'mermaidTheme', label: 'Mermaid Theme', type: 'select', options: ['default', 'dark', 'forest'] },
      { key: 'vegaTheme', label: 'Vega Theme', type: 'select', options: ['latimes', 'excel', 'ggplot2', 'quartz', 'vox', 'fivethirtyeight', 'dark'] },
    ],
  },
  {
    title: 'Image',
    key: 'image',
    fields: [
      { key: 'insertLocalImageAction', label: 'Local Image Action', type: 'select', options: ['none', 'copyToPath', 'upload'] },
      { key: 'insertWebImageAction', label: 'Web Image Action', type: 'select', options: ['none', 'copyToPath', 'upload'] },
      { key: 'insertClipboardImageAction', label: 'Clipboard Image Action', type: 'select', options: ['none', 'copyToPath', 'upload'] },
      { key: 'preferRelativeImagePaths', label: 'Prefer Relative Image Paths', type: 'checkbox' },
      { key: 'autoEncodeImageURL', label: 'Auto Encode Image URLs', type: 'checkbox' },
    ],
  },
  {
    title: 'Other',
    key: 'other',
    fields: [
      { key: 'autoSave', label: 'Auto Save', type: 'checkbox' },
      { key: 'statusBarOpen', label: 'Show Status Bar', type: 'checkbox' },
      { key: 'animationEnable', label: 'Enable Animations', type: 'checkbox' },
      { key: 'spellcheckEnabled', label: 'Spell Check', type: 'checkbox' },
      { key: 'spellcheckLang', label: 'Spell Check Language', type: 'text', placeholder: 'e.g. en-US' },
      { key: 'autoCheck', label: 'Auto Check Task Lists', type: 'checkbox' },
      { key: 'lang', label: 'Language', type: 'select', options: ['en', 'zh'] },
      { key: 'wordCountMethod', label: 'Word Count Method', type: 'select', options: [0, 1] },
      { key: 'sidePaneWidth', label: 'Sidebar Width (px)', type: 'number', min: 180, max: 600 },
      { key: 'fileStartupAction', label: 'On Startup (File)', type: 'select', options: ['', 'openLast'] },
      { key: 'folderStartupAction', label: 'On Startup (Folder)', type: 'select', options: ['none', 'openLast'] },
    ],
  },
];

const SettingsPage: React.FC<ISettingsPageProps> = ({ open, onClose, initialSection }) => {
  const [settings, setSettings] = useState<Settings>({});
  const [activeSection, setActiveSection] = useState('editor');
  const [customThemes, setCustomThemes] = useState<string[]>([]);
  const [themeDir, setThemeDir] = useState('');
  const [settingsPath, setSettingsPath] = useState('');
  const [logText, setLogText] = useState<string | null>(null);

  const loadCustomThemes = async () => {
    try {
      const [list, dir]: any = await Promise.all([remote.listThemes(), remote.getThemeDir()]);
      setCustomThemes(Array.isArray(list) ? list : []);
      setThemeDir(typeof dir === 'string' ? dir : '');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (open && initialSection) {
      setActiveSection(initialSection);
    }
  }, [open, initialSection]);

  useEffect(() => {
    if (open) {
      remote.getSettings().then((s: any) => {
        const merged = { ...defaultSettings };
        for (const k in s) {
          if (k !== 'basePath' && k !== 'markdown') {
            (merged as any)[k] = s[k];
          }
        }
        setSettings(merged);
      });
      loadCustomThemes();
      remote.getSettingsPath().then((p: string) => setSettingsPath(p)).catch(() => {});
    }
  }, [open]);

  const isZh = settings.lang === 'zh';
  const t = (field: { key: string; label: string }) => isZh ? (zhLabels[field.key] ?? field.label) : field.label;
  const ts = (section: { key: string; title: string }) => isZh ? (zhSections[section.key] ?? section.title) : section.title;

  const update = async (key: string, value: any) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await remote.saveSettings(next);
    } catch { /* ignore */ }
    transport.postMessage('SettingsChanged', { [key]: value });
    if (key === 'lang') {
      transport.postMessage('LanguageChanged', value);
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 720, maxHeight: '80vh', display: 'flex', position: 'relative', zIndex: 1,
        backgroundColor: 'var(--editorColor00)',
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: 180, padding: '16px 0',
          backgroundColor: 'var(--editorColor02)',
          borderRight: '1px solid var(--editorColor10)',
          overflowY: 'auto',
        }}>
          {sections.map(s => (
            <div
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                fontWeight: activeSection === s.key ? 600 : 400,
                color: 'var(--editorColor60)',
                backgroundColor: activeSection === s.key ? 'var(--editorColor06)' : 'transparent',
              }}
            >{ts(s)}</div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--editorColor)' }}>
              {(() => { const sec = sections.find(s => s.key === activeSection); return sec ? ts(sec) : ''; })()}
            </h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: 'var(--editorColor40)', padding: '0 4px',
            }}>×</button>
          </div>
          {sections.find(s => s.key === activeSection)?.fields.map(f => {
            const field = f as any;
            const val = settings[field.key];
            return (
              <div key={field.key} style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ flex: 1, fontSize: 13, color: 'var(--editorColor60)' }}>{t(field)}</label>
                {field.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!val}
                    onChange={e => update(field.key, e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                ) : field.type === 'number' ? (
                  <input type="number" value={val ?? ''}
                    min={field.min} max={field.max} step={field.step ?? 1}
                    onChange={e => update(field.key, parseFloat(e.target.value) || 0)}
                    style={{ width: 80, padding: '4px 8px', fontSize: 13,
                      border: '1px solid var(--editorColor10)', borderRadius: 4,
                      backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                    }}
                  />
                ) : field.type === 'select' ? (
                  <select value={String(val ?? '')}
                    onChange={e => {
                      const raw = e.target.value;
                      const hasNumericOption = (field.options ?? []).some((o: any) => typeof o === 'number');
                      const value = hasNumericOption && raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw;
                      update(field.key, value);
                    }}
                    style={{ padding: '4px 8px', fontSize: 13,
                      border: '1px solid var(--editorColor10)', borderRadius: 4,
                      backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                    }}
                  >
                    {field.options?.map((o: any) => (
                      <option key={String(o)} value={String(o)}>
                        {field.key === 'lang'
                          ? (o === 'zh' ? '中文' : 'English')
                          : field.key === 'wordCountMethod'
                            ? (o === 1 ? (isZh ? '按字符' : 'Characters') : (isZh ? '按词' : 'Words'))
                            : String(o)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={String(val ?? '')}
                    placeholder={field.placeholder}
                    onChange={e => update(field.key, e.target.value)}
                    style={{ width: 160, padding: '4px 8px', fontSize: 13,
                      border: '1px solid var(--editorColor10)', borderRadius: 4,
                      backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                    }}
                  />
                )}
              </div>
            );
          })}

          {activeSection === 'advanced' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--editorColor60)' }}>
                {isZh ? '配置文件' : 'Settings File'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--editorColor40)', wordBreak: 'break-all', marginBottom: 10 }}>
                {settingsPath || '…'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => settingsPath && remote.openPath({ path: settingsPath }).catch(() => {})}
                  style={{
                    padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                    border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                    backgroundColor: 'var(--editorColor04)',
                  }}
                >{isZh ? '打开 settings.json' : 'Open settings.json'}</button>
                <button
                  onClick={() => remote.getSettings().then((s: any) => {
                    const merged = { ...defaultSettings };
                    for (const k in s) if (k !== 'basePath' && k !== 'markdown') (merged as any)[k] = s[k];
                    setSettings(merged);
                  }).catch(() => {})}
                  style={{
                    padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                    border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                    backgroundColor: 'var(--editorColor04)',
                  }}
                >{isZh ? '重新载入' : 'Reload'}</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--editorColor40)', lineHeight: 1.7, marginTop: 12 }}>
                {isZh
                  ? '所有设置都保存在上面的 JSON 文件里，界面上的开关只是它的可视化编辑器。键名与含义见仓库 docs/settings.md；修改后回到这里点“重新载入”即可生效（部分项需重启）。'
                  : 'Every setting lives in the JSON file above; the UI is just a visual editor for it. See docs/settings.md for the key reference. After editing, press Reload here (some entries need a restart).'}
              </div>

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--editorColor10)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--editorColor60)' }}>
                  {isZh ? '错误日志' : 'Error Log'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => remote.readLog().then((text: string) => setLogText(text || '')).catch(() => setLogText(''))}
                    style={{
                      padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                      border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                      backgroundColor: 'var(--editorColor04)',
                    }}
                  >{isZh ? '查看日志' : 'View Log'}</button>
                  <button
                    onClick={() => remote.getLogPath().then((p: string) => remote.openPath({ path: p })).catch(() => {})}
                    style={{
                      padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                      border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                      backgroundColor: 'var(--editorColor04)',
                    }}
                  >{isZh ? '用系统编辑器打开' : 'Open in Editor'}</button>
                  <button
                    onClick={() => remote.clearLog().then(() => setLogText('')).catch(() => {})}
                    style={{
                      padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                      border: '1px solid var(--editorColor10)', color: '#e05555',
                      backgroundColor: 'var(--editorColor04)',
                    }}
                  >{isZh ? '清空' : 'Clear'}</button>
                </div>
                {logText !== null && (
                  <pre style={{
                    marginTop: 10, maxHeight: 220, overflow: 'auto', fontSize: 11, lineHeight: 1.5,
                    background: 'var(--editorColor02)', border: '1px solid var(--editorColor10)',
                    borderRadius: 4, padding: 8, whiteSpace: 'pre-wrap', color: 'var(--editorColor50)',
                  }}>{logText || (isZh ? '（空）' : '(empty)')}</pre>
                )}
              </div>
            </div>
          )}

          {activeSection === 'theme' && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--editorColor10)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--editorColor60)' }}>
                {isZh ? '自定义主题' : 'Custom Theme'}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <select
                  value={String(settings.customTheme ?? '')}
                  onChange={async e => {
                    const name = e.target.value;
                    const err = await applyCustomTheme(name);
                    if (!err) {
                      update('customTheme', name);
                    }
                  }}
                  style={{
                    padding: '4px 8px', fontSize: 13,
                    border: '1px solid var(--editorColor10)', borderRadius: 4,
                    backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                  }}
                >
                  <option value="">{isZh ? '无（内置）' : 'None (Built-in)'}</option>
                  {customThemes.map(n => (
                    <option key={n} value={n}>{n.replace(/\.css$/i, '')}</option>
                  ))}
                </select>
                <button onClick={() => remote.openThemeDir()} style={{
                  padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                  border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                  backgroundColor: 'var(--editorColor04)',
                }}>{isZh ? '打开主题文件夹' : 'Open Theme Folder'}</button>
                <button onClick={loadCustomThemes} style={{
                  padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
                  border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
                  backgroundColor: 'var(--editorColor04)',
                }}>{isZh ? '刷新' : 'Refresh'}</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--editorColor40)', wordBreak: 'break-all' }}>{themeDir}</div>
              <div style={{ fontSize: 12, color: 'var(--editorColor40)', lineHeight: 1.7, marginTop: 8 }}>
                {isZh
                  ? '把 Typora 主题的 .css 文件（以及字体/图片）复制到主题文件夹，刷新后选择即可。'
                  : 'Copy Typora theme .css files (and their fonts/images) into the theme folder, then refresh and select one.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
