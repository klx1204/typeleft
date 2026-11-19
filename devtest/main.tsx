import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import MilkdownEditor from '../src/components/MilkdownEditor';
import CodeMirror6 from '../src/components/CodeMirror6';

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

- [ ] 待办
- [x] 已完成

| Name | Value |
| --- | ---: |
| alpha | 1 |
| beta | 2 |

\`\`\`js
const x = 1;
const y = 2;
\`\`\`

\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
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

const options: any = {
  editorEngine: 'milkdown',
  fontSize: 16,
  lineHeight: 1.6,
  editorAreaWidth: '860px',
  bulletListMarker: '-',
  typewriter: false,
  focusMode: false,
  autoSave: false,
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
  check('milkdown task items', ml.querySelectorAll('li[data-item-type="task"]').length === 2);
  check('milkdown task checked', !!ml.querySelector('li[data-item-type="task"][data-checked="true"]'));
  check('milkdown katex', ml.querySelectorAll('.katex').length >= 2, `${ml.querySelectorAll('.katex').length}`);
  check('milkdown code block', !!ml.querySelector('.md-fences-wrapper'));
  const selects = Array.from(ml.querySelectorAll('select.md-fences-language')) as HTMLSelectElement[];
  check('language selects', selects.length === 2, selects.map(sel => {
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
  check('milkdown Prism tokens', ml.querySelectorAll('.token.keyword, .token.function').length > 0);
  check('milkdown highlight mark', !!ml.querySelector('mark') && (ml.querySelector('mark')!.textContent || '').includes('重点'));
  check('milkdown superscript', !!ml.querySelector('sup'));
  check('milkdown subscript', !!ml.querySelector('sub'));
  const h1 = ml.querySelector('h1') as HTMLElement | null;
  check('milkdown themed heading color', !!h1 && getComputedStyle(h1).color !== 'rgb(0, 0, 0)');

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

ReactDOM.render(<Harness />, document.getElementById('root'));

const isStatic = location.search.includes('static');

// Let Milkdown create, KaTeX render and Mermaid draw before asserting.
if (isStatic) {
  setTimeout(() => finish(), 3000);
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
            }, 400);
          }, 300);
        }, 300);
      } else {
        finish();
      }
    }, 600);
  }, 500);
}, 2500);
