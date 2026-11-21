import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import MilkdownEditor from '../src/components/MilkdownEditor';
import { applyCustomTheme } from '../src/services/customTheme';
import themeCss from './typora-theme.css?raw';
import CodeMirror6 from '../src/components/CodeMirror6';
import Sidebar from '../src/components/Sidebar';
import ExportDialog from '../src/components/ExportDialog';
import SettingsPage from '../src/components/SettingsPage';
import SelectionSearchMenu from '../src/components/SelectionSearchMenu';

const fixture = `---
title: Devtest
tags: [a, b]
---

# 一级标题

中文段落，**粗体**、*斜体*、\`行内代码\`、~~删除~~、[链接](https://example.com)。

高亮 ==重点==，上标 mc^2^，下标 H~2~O。

## 二级标题

> 引用块

- 列表一
- 列表二

1. 有序一
2. 有序二

- [ ] 父任务
  - [ ] 子任务 A
  - [x] 子任务 B
- [x] 已完成

| Name | Value |
| --- | ---: |
| alpha | 1 |
| beta | 2 |

<!-- tl-cw: 140,180 -->

\`\`\`js
const x = 1;
const y = 2;
\`\`\`

\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
\`\`\`

\`\`\`math
a^2 + b^2 = c^2
\`\`\`

行内公式 $E = mc^2$。

$$
a^2 + b^2 = c^2
$$

![demo](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzQ0OGFmZiIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjM0IiBmaWxsPSIjZmZkMTY2Ii8+PHJlY3QgeD0iMTEwIiB5PSIzMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2MCIgcng9IjgiIGZpbGw9IiMwNmQ2YTAiLz48L3N2Zz4=)

<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzQ0OGFmZiIvPjxjaXJjbGUgY3g9IjYwIiBjeT0iNjAiIHI9IjM0IiBmaWxsPSIjZmZkMTY2Ii8+PHJlY3QgeD0iMTEwIiB5PSIzMCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI2MCIgcng9IjgiIGZpbGw9IiMwNmQ2YTAiLz48L3N2Zz4=" alt="居中图片" data-align="center" width="160px">

脚注[^1]。

[^1]: 脚注内容。
`;

const layoutMode = location.search.includes('layout');
const noPairMode = location.search.includes('nopair');
const noMarksMode = location.search.includes('nomarks');
const codeBlockMode = location.search.includes('codeblock');
const sidebarMode = location.search.includes('sidebar');
const foldersMode = location.search.includes('folders');
const exportMode = location.search.includes('exportdialog');
const settingsMode = location.search.includes('settings');
const searchMenuMode = location.search.includes('searchmenu');

const options: any = {
  ...(noPairMode ? { autoPairBracket: false, autoPairQuote: false, autoPairMarkdownSyntax: false } : {}),
  ...(noMarksMode ? { superSubScript: false } : {}),
  ...(codeBlockMode ? { codeBlockLineNumbers: false, codeBlockWrap: true, codeBlockDefaultLanguage: 'javascript' } : {}),
  ...(layoutMode ? {
    textDirection: 'rtl',
    headingNumbering: true,
    justifyText: true,
    listMarker: 'square',
    orderedMarker: 'lower-roman',
    bodyFont: 'Georgia, serif',
    codeFont: '"Courier New", monospace',
    editorBackground: '#123456',
  } : {}),
  fontSize: 16,
  lineHeight: 1.6,
  editorAreaWidth: '860px',
  bulletListMarker: '-',
  typewriter: false,
  focusMode: false,
  autoSave: false,
  autoCheck: true,
};

const results: string[] = [];
const check = (name: string, ok: boolean, extra = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

const onlyCm6 = location.search.includes('cm6');

const Harness: React.FC = () => {
  const [markdown, setMarkdown] = useState(fixture);
  const [cursor, setCursor] = useState<any>();
  const [searchOpen, setSearchOpen] = useState(0);
  const latestMarkdown = useRef('');

  useEffect(() => {
    latestMarkdown.current = markdown;
  }, [markdown]);

  useEffect(() => {
    (window as any).__setSearchOpen = setSearchOpen;
    (window as any).__latestMarkdown = () => latestMarkdown.current;
  }, []);

  return (
    <div>
      {!onlyCm6 && <div id="milkdown-test">
        <MilkdownEditor
          markdown={markdown}
          cursor={cursor}
          options={options}
          searchOpen={searchOpen}
          searchArg={undefined}
          scrollTopRef={{ current: 0 } as any}
          onMarkdownChange={setMarkdown}
          onCursorChange={setCursor}
          onSearchArgChange={() => {}}
          onSearchOpenChange={setSearchOpen}
        />
      </div>}
      {sidebarMode && <Sidebar open section="toc" onClose={() => {}} />}
      {foldersMode && <Sidebar open section="filetree" onClose={() => {}} />}
      {exportMode && <ExportDialog open onClose={() => {}} />}
      {settingsMode && <SettingsPage open initialSection="advanced" onClose={() => {}} />}
      <SelectionSearchMenu />
      <div id="cm6-test" style={{ marginTop: onlyCm6 ? 24 : 80, borderTop: onlyCm6 ? 'none' : '2px solid #444' }}>
        <CodeMirror6
          markdown={fixture}
          cursor={undefined}
          options={options}
          searchOpen={0}
          searchArg={undefined}
          scrollTopRef={{ current: 0 } as any}
          onMarkdownChange={() => {}}
          onCursorChange={() => {}}
          onSearchArgChange={() => {}}
          onSearchOpenChange={() => {}}
        />
      </div>
      <pre id="test-results" style={{ display: 'none' }} />
    </div>
  );
};

const finish = (extraCheck?: () => void) => {
  const ml = document.getElementById('milkdown-test') || document.createElement('div');
  const cm = document.getElementById('cm6-test')!;

  check('milkdown #write.milkdown-write', !!ml.querySelector('#write.milkdown-write'));
  check('milkdown headings', ml.querySelectorAll('h1,h2').length >= 2, `${ml.querySelectorAll('h1,h2').length}`);
  check('milkdown table', !!ml.querySelector('table'));
  const firstTable = ml.querySelector('table');
  const cols = firstTable ? firstTable.querySelectorAll('col') : [];
  check('table column widths', cols.length === 2, `${cols.length} cols`);
  check('milkdown task items', ml.querySelectorAll('li[data-item-type="task"]').length >= 4, `${ml.querySelectorAll('li[data-item-type="task"]').length}`);
  check('milkdown task checked', !!ml.querySelector('li[data-item-type="task"][data-checked="true"]'));
  check('milkdown katex', ml.querySelectorAll('.katex').length >= 2, `${ml.querySelectorAll('.katex').length}`);
  check('milkdown code block', !!ml.querySelector('.md-fences-wrapper'));
  const selects = Array.from(ml.querySelectorAll('select.md-fences-language')) as HTMLSelectElement[];
  check('language selects', selects.length === 3, selects.map(sel => {
    const cs = getComputedStyle(sel);
    return `value=${sel.value} bg=${cs.backgroundColor} appearance=${cs.appearance} color=${cs.color}`;
  }).join(' | '));
  check('milkdown line numbers', ml.querySelectorAll('.md-fences-gutter > div').length >= 2);
  check('milkdown image', !!ml.querySelector('.md-image img'));
  const aligned = ml.querySelector('.image-node[data-align="center"][data-width="160px"]') as HTMLElement | null;
  check('image layout attrs', !!aligned, aligned ? (aligned.querySelector('img') as HTMLImageElement).style.width : 'n/a');
  check('image toolbar', (aligned?.querySelectorAll('.image-toolbar button').length ?? 0) === 4);
  const fm = ml.querySelector('pre[data-type="frontmatter"]') as HTMLElement | null;
  check('milkdown frontmatter', !!fm);
  if (fm) {
    const cs = getComputedStyle(fm);
    const code = fm.querySelector('code') as HTMLElement | null;
    const r = fm.getBoundingClientRect();
    check('frontmatter visible', r.height > 10 && r.width > 10, `rect=${Math.round(r.width)}x${Math.round(r.height)} color=${cs.color} code=${code ? getComputedStyle(code).color : 'n/a'} text=${JSON.stringify((fm.textContent || '').slice(0, 40))}`);
  }
  check('milkdown diagram preview', !!ml.querySelector('.diagram-preview.active svg'));
  check('milkdown math fence', !!ml.querySelector('.md-fences-wrapper[data-language="math"] .diagram-preview.active .katex'));
  check('milkdown Prism tokens', ml.querySelectorAll('.token.keyword, .token.function').length > 0);
  check('milkdown highlight mark', Array.from(ml.querySelectorAll('mark')).some(m => (m.textContent || '').includes('重点')));
  check('milkdown superscript', !!ml.querySelector('sup'));
  check('milkdown subscript', !!ml.querySelector('sub'));
  const h1 = ml.querySelector('h1') as HTMLElement | null;
  check('milkdown themed heading color', !!h1 && getComputedStyle(h1).color !== 'rgb(0, 0, 0)');

  (window as any).__THEME_CSS__ = themeCss;

  if (layoutMode) {
    const write = ml.querySelector('#write') as HTMLElement | null;
    const writeStyle = write ? getComputedStyle(write) : null;
    check('layout rtl', writeStyle?.direction === 'rtl', writeStyle?.direction || 'n/a');
    check('layout body font', (writeStyle?.fontFamily || '').toLowerCase().includes('georgia'), writeStyle?.fontFamily || '');
    check('layout background', writeStyle?.backgroundColor === 'rgb(18, 52, 86)', writeStyle?.backgroundColor || '');
    const p = ml.querySelector('#write .ProseMirror p') as HTMLElement | null;
    check('layout justify', !!p && getComputedStyle(p).textAlign === 'justify', p ? getComputedStyle(p).textAlign : 'n/a');
    const ul = ml.querySelector('#write .ProseMirror ul') as HTMLElement | null;
    check('layout bullet marker', !!ul && getComputedStyle(ul).listStyleType === 'square', ul ? getComputedStyle(ul).listStyleType : 'n/a');
    const ol = ml.querySelector('#write .ProseMirror ol') as HTMLElement | null;
    check('layout ordered marker', !!ol && getComputedStyle(ol).listStyleType === 'lower-roman', ol ? getComputedStyle(ol).listStyleType : 'n/a');
    const h1 = ml.querySelector('#write .ProseMirror h1') as HTMLElement | null;
    const before = h1 ? getComputedStyle(h1, '::before').content : '';
    check('layout heading numbering', (before || '').includes('counter(h1)'), before);
    const code = ml.querySelector('#write .ProseMirror code') as HTMLElement | null;
    check('layout code font', !!code && getComputedStyle(code).fontFamily.toLowerCase().includes('courier'), code ? getComputedStyle(code).fontFamily : 'n/a');
  }

if (location.search.includes('theme')) {
    const write = ml.querySelector('#write') as HTMLElement | null;
    const writeStyle = write ? getComputedStyle(write) : null;
    check('typora theme wins over base layer', writeStyle?.maxWidth === '780px', writeStyle?.maxWidth || 'n/a');
    check('typora theme font', (writeStyle?.fontFamily || '').includes('Georgia'), writeStyle?.fontFamily || '');
    check('typora theme h1 colour', !!h1 && getComputedStyle(h1).color === 'rgb(139, 94, 0)',
      h1 ? getComputedStyle(h1).color : 'n/a');
    const before = h1 ? getComputedStyle(h1, '::before').content : '';
    // Computed style returns the unresolved `counter(h1)` expression; the
    // screenshot is what proves the numbers render.
    check('typora theme CSS counters', (before || '').includes('counter(h1)'), before);
    const firstP = ml.querySelector('#write > .milkdown .ProseMirror > p, #write .ProseMirror > p') as HTMLElement | null;
    check('typora theme #write > p rewritten', !!firstP && getComputedStyle(firstP).letterSpacing === '1.5px',
      firstP ? getComputedStyle(firstP).letterSpacing : 'n/a');
    const fence = ml.querySelector('pre.md-fences') as HTMLElement | null;
    check('typora theme code block', !!fence && getComputedStyle(fence).backgroundColor === 'rgb(43, 43, 43)',
      fence ? getComputedStyle(fence).backgroundColor : 'n/a');
  }

  check('cm6 editor mounted', !!cm.querySelector('.cm-editor'));
  check('cm6 lines', cm.querySelectorAll('.cm-line').length > 5, `${cm.querySelectorAll('.cm-line').length}`);
  check('cm6 gutters', cm.querySelectorAll('.cm-gutterElement').length > 3);
  const activeLine = cm.querySelector('.cm-activeLine') as HTMLElement | null;
  check('cm6 diagnostic', true, `selection=${JSON.stringify(window.getSelection()?.toString()?.slice(0, 20))} selBands=${cm.querySelectorAll('.cm-selectionBackground').length} activeBg=${activeLine ? getComputedStyle(activeLine).backgroundColor : 'n/a'}`);

  const emitted: any[] = (window as any).__emitted || [];
  const state = emitted.filter(e => e.event === 'StateChange').pop();
  check('StateChange emitted', !!state);
  check('StateChange word count > 0', !!state && (state.payload?.state?.wordCount?.word ?? 0) > 0,
    state ? JSON.stringify(state.payload?.state?.wordCount) : '');
  check('StateChange TOC', !!state && (state.payload?.state?.toc?.length ?? 0) >= 2,
    state ? `${state.payload?.state?.toc?.length} headings` : '');

  const errors = ((window as any).__errors || []).filter((e: string) => !/Warning: Each child|ReactDOM.render/.test(e));
  check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 1200));

  if (extraCheck) extraCheck();

  window.scrollTo(0, 0);

  const pre = document.getElementById('test-results')!;
  pre.textContent = results.join('\n');
  document.title = results.some(r => r.startsWith('FAIL')) ? 'TESTS FAILED' : 'TESTS PASSED';
  (window as any).__results = results;
  console.log(results.join('\n'));
};

(window as any).__THEME_CSS__ = themeCss;

if (location.search.includes('theme')) {
  applyCustomTheme('typora-theme.css').then((err) => {
    if (err) console.error('custom theme failed: ' + err);
  });
}

ReactDOM.render(<Harness />, document.getElementById('root'));

const isStatic = location.search.includes('static');
const isPickers = location.search.includes('pickers');

const runPickerChecks = async () => {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const pm = document.querySelector('#milkdown-test .ProseMirror') as HTMLElement | null;
  if (!pm) { finish(); return; }
  pm.focus();

  const gotoEnd = () => {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(pm);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };
  const typeSlash = async (query: string) => {
    gotoEnd();
    document.execCommand('insertText', false, ' /' + query);
    await wait(350);
  };
  const pressEnter = () => pm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const clickFirst = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    el?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  };

  // Emoji
  await typeSlash('emoji');
  check('slash: emoji command', !!document.querySelector('.slash-menu'));
  pressEnter();
  await wait(350);
  const emojiBox = document.querySelector('.emoji-picker');
  check('emoji picker opens', !!emojiBox);
  clickFirst('.emoji-grid button');
  await wait(250);
  check('emoji inserted', (pm.textContent || '').includes('😀'), (pm.textContent || '').slice(-12));

  // Table picker
  await typeSlash('table');
  pressEnter();
  await wait(350);
  check('table picker opens', !!document.querySelector('.table-picker'));
  const rows = document.querySelectorAll('.table-grid-row');
  const targetCell = rows[1]?.querySelectorAll('.table-grid-cell')[2] as HTMLElement | undefined;
  targetCell?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await wait(350);
  const tables = document.querySelectorAll('#milkdown-test table');
  const lastTable = tables[tables.length - 1];
  check('table picker creates 2x3', !!lastTable && lastTable.querySelectorAll('tr').length === 2 && lastTable.querySelectorAll('th').length === 3,
    lastTable ? `${lastTable.querySelectorAll('tr').length}x${lastTable.querySelectorAll('th').length}` : 'none');

  // Footnote
  await typeSlash('footnote');
  pressEnter();
  await wait(400);
  check('footnote inserted', /\[\^\d+\]/.test(pm.textContent || '') || !!document.querySelector('#milkdown-test dl[data-type]'),
    (pm.textContent || '').slice(-30));

  // Diagram preview toggle
  const previewBtn = document.querySelector('.md-fences-wrapper[data-language="mermaid"] button[title="Toggle preview"]') as HTMLElement | null;
  previewBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(300);
  check('diagram preview hides', !document.querySelector('.md-fences-wrapper[data-language="mermaid"] .diagram-preview.active'));
  previewBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(3000);
  check('diagram preview shows again', !!document.querySelector('.diagram-preview.active svg'));

  // Front matter editor: double-click renders the highlighter.
  const fmBlock = document.querySelector('#milkdown-test pre[data-type="frontmatter"]') as HTMLElement | null;
  fmBlock?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  await wait(300);
  check('frontmatter editor opens', !!document.querySelector('.frontmatter-editor'));
  check('frontmatter highlighter', document.querySelectorAll('.frontmatter-highlight .fm-key').length > 0,
    `${document.querySelectorAll('.frontmatter-highlight .fm-key').length} keys`);
  const fmEditor = document.querySelector('.frontmatter-editor') as HTMLTextAreaElement | null;
  fmEditor?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(150);

  // Rich clipboard through the menu events (Tauri stub keeps the clipboard).
  const firstP = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror p'))
    .find(p => (p.textContent || '').includes('中文段落')) as HTMLElement | undefined;
  if (firstP) {
    const range = document.createRange();
    range.selectNodeContents(firstP);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    pm.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await wait(250);
    (window as any).__emit('Copy');
    await wait(300);
    const clip = (window as any).__clipboard;
    check('copy writes html', !!clip?.html && String(clip.html).includes('中文段落') && String(clip.html).includes('strong'),
      clip ? JSON.stringify(clip).slice(0, 120) : 'empty');

    gotoEnd();
    document.dispatchEvent(new Event('selectionchange'));
    pm.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await wait(250);
    (window as any).__emit('Paste');
    await wait(400);
    const occurrences = (pm.textContent || '').split('中文段落').length - 1;
    check('paste reads html', occurrences >= 2, `${occurrences} occurrences`);
  }

  // Link popover (no window.prompt)
  const para = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror p'))
    .find(p => (p.textContent || '').includes('中文段落')) as HTMLElement | undefined;
  if (para) {
    const range = document.createRange();
    range.selectNodeContents(para);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    pm.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await wait(300);
    const linkBtn = Array.from(document.querySelectorAll('.milkdown-bubble-toolbar button'))
      .find(b => b.getAttribute('title') === 'Link') as HTMLElement | undefined;
    linkBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await wait(250);
    check('link popover opens', !!document.querySelector('.link-popover'));
  }

  finish();
};

// Let Milkdown create, KaTeX render and Mermaid draw before asserting.
if (searchMenuMode) {
  setTimeout(() => {
    const p = document.querySelector('#milkdown-test .ProseMirror p');
    if (!p || !p.firstChild) return;
    const range = document.createRange();
    range.setStart(p.firstChild, 0);
    range.setEnd(p.firstChild, 4);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const r = p.getBoundingClientRect();
    (p.closest('.ProseMirror') || p).dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: Math.round(r.left + 30), clientY: Math.round(r.top + 10),
    }));
  }, 2200);
}

if (exportMode) {
  setTimeout(() => {
    const rows = Array.from(document.querySelectorAll('div')).filter(el =>
      el.querySelectorAll('button').length === 2 && (el.textContent || '').startsWith('HTML'));
    const row = rows[rows.length - 1];
    const down = row?.querySelectorAll('button')[1] as HTMLButtonElement | undefined;
    down?.click();
  }, 2200);
}

if (sidebarMode) {
  setTimeout(() => {
    const input = document.querySelector('#typora-sidebar input') as HTMLInputElement | null;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, '二级');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, 2200);
}

if (isStatic) {
  setTimeout(() => finish(), 3000);
} else if (isPickers) {
  setTimeout(() => { void runPickerChecks(); }, 2500);
} else setTimeout(() => {
  // Search panel driven through the real transport event.
  (window as any).__setSearchOpen(1);
  setTimeout(() => {
    const panel = document.getElementById('md-searchpanel');
    check('search panel opens', !!panel);

    const input = panel?.querySelector('input') as HTMLInputElement | null;
    if (input) {
      // React tracks the value internally; go through the native setter.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '列表');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        const matches = document.querySelectorAll('.typeleft-search-match').length;
        check('search finds matches', matches > 0, `${matches} matches`);
        (window as any).__setSearchOpen(0);
      }, 300);
    }

    // Real typing into the ProseMirror contenteditable.
    const pm = document.querySelector('#milkdown-test .ProseMirror') as HTMLElement | null;
    const lastParagraph = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror p')).pop() as HTMLElement | undefined;
    if (pm && lastParagraph) {
      pm.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(lastParagraph);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      const ok = document.execCommand('insertText', false, ' TYPED 中文');
      check('typing dispatched', ok);
    }

    setTimeout(() => {
      const md = (window as any).__latestMarkdown?.() ?? '';
      check('typed text reaches markdown', md.includes('TYPED 中文'));

      // Slash menu: new paragraph -> "/" -> filter -> Enter
      const pmEl = document.querySelector('#milkdown-test .ProseMirror') as HTMLElement | null;
      if (pmEl) {
        const paras = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror p'));
        const target = paras[paras.length - 1] as HTMLElement | undefined;
        if (target) {
          pmEl.focus();
          const range = document.createRange();
          range.selectNodeContents(target);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          pmEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
          document.execCommand('insertText', false, '/');
        }
        setTimeout(() => {
          const menu = document.querySelector('.slash-menu');
          check('slash menu opens', !!menu, `${menu?.childElementCount ?? 0} items`);
          document.execCommand('insertText', false, 'h2');
          setTimeout(() => {
            const items = Array.from(document.querySelectorAll('.slash-menu-item'));
            check('slash menu filters', items.length === 1 && (items[0].textContent || '').includes('Heading 2'),
              items.map(i => i.textContent).join(' | ').slice(0, 80));
            pmEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            setTimeout(() => {
              const h2s = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror h2'));
              check('slash command applies', h2s.some(h => (h.textContent || '').includes('h2') || (h.textContent || '') === ''),
                `${h2s.length} h2`);
              check('slash menu closes', !document.querySelector('.slash-menu'));
                      // Formatting bubble: select a paragraph, click the three new marks.
              const targetP = Array.from(document.querySelectorAll('#milkdown-test .ProseMirror p'))
                .find(p => (p.textContent || '').includes('中文段落')) as HTMLElement | undefined;
              const clickBubble = (title: string) => {
                const btn = Array.from(document.querySelectorAll('.milkdown-bubble-toolbar button'))
                  .find(b => b.getAttribute('title') === title) as HTMLElement | undefined;
                btn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              };
              if (targetP && pmEl) {
                const r = document.createRange();
                r.selectNodeContents(targetP);
                const sel2 = window.getSelection();
                sel2?.removeAllRanges();
                sel2?.addRange(r);
                document.dispatchEvent(new Event('selectionchange'));
                pmEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              }
              setTimeout(() => {
                check('format bubble opens', !!document.querySelector('.milkdown-bubble-toolbar'));
                clickBubble('Highlight');
                clickBubble('Superscript');
                clickBubble('Subscript');
                setTimeout(() => {
                  check('bubble highlight', !!targetP?.querySelector('mark'));
                  check('bubble superscript', !!targetP?.querySelector('sup'));
                  check('bubble subscript', !!targetP?.querySelector('sub'));

                  // autoCheck: ticking the parent ticks its children.
                  // ProseMirror may replace the <li> nodes when attrs change, so
                  // always look them up again instead of caching references.
                  const findTask = (text: string) =>
                    Array.from(document.querySelectorAll('#milkdown-test li[data-item-type="task"]'))
                      .find(li => (li.textContent || '').includes(text)) as HTMLElement | undefined;
                  const stateOf = (text: string) => findTask(text)?.getAttribute('data-checked') ?? 'missing';
                  const clickCheckbox = (li: HTMLElement) => {
                    const rect = li.getBoundingClientRect();
                    li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + 5, clientY: rect.top + 8 }));
                  };
                  const parentLi = findTask('父任务');
                  if (parentLi) clickCheckbox(parentLi);
                  setTimeout(() => {
                    check('autoCheck ticks children',
                      stateOf('子任务 A') === 'true' && stateOf('子任务 B') === 'true',
                      `${stateOf('子任务 A')},${stateOf('子任务 B')}`);
                    check('autoCheck ticks parent', stateOf('父任务') === 'true', stateOf('父任务'));

                    // Untick one child: the parent must follow.
                    const childA = findTask('子任务 A');
                    if (childA) clickCheckbox(childA);
                    setTimeout(() => {
                      check('autoCheck unticks parent', stateOf('父任务') === 'false', stateOf('父任务'));

                      // CodeMirror typing
                      const cmContent = document.querySelector('#cm6-test .cm-content') as HTMLElement | null;
                      if (cmContent) {
                        cmContent.focus();
                        document.execCommand('insertText', false, 'CM6TYPED');
                      }
                      setTimeout(() => {
                        const cmText = cmContent?.textContent ?? '';
                        check('cm6 typing works', cmText.includes('CM6TYPED'));
                        finish();
                      }, 400);
                    }, 350);
                  }, 350);
                }, 300);
              }, 300);
            }, 400);
          }, 300);
        }, 300);
      } else {
        finish();
      }
    }, 600);
  }, 500);
}, 2500);
