import { $node, $remark, $view } from '@milkdown/kit/utils';

/**
 * Page break (#62).
 *
 * Stored as the HTML Typora/print pipelines understand:
 * `<div style="page-break-after: always;"></div>`.
 * The editor shows a dashed placeholder instead of the raw tag.
 */
const HTML = '<div style="page-break-after: always;"></div>';
const PAGE_BREAK = /^\s*<div[^>]*(?:page-break-after|page-break-before|break-after|break-before)[^>]*>\s*(?:<\/div>)?\s*$/i;

const isPageBreakHtml = (node: any) => node?.type === 'html' && PAGE_BREAK.test(node.value || '');

/**
 * Some remark configurations parse the `<div>` as inline HTML inside a
 * paragraph; split the paragraph around it so the block node stays valid.
 */
const splitPageBreaks = (node: any) => {
  if (!Array.isArray(node.children)) return;
  const next: any[] = [];
  for (const child of node.children) {
    if (isPageBreakHtml(child)) {
      next.push({ type: 'pageBreak' });
      continue;
    }
    if (child.type === 'paragraph' && Array.isArray(child.children) && child.children.some(isPageBreakHtml)) {
      let buffer: any[] = [];
      const flush = () => {
        if (buffer.length) next.push({ ...child, children: buffer });
        buffer = [];
      };
      for (const part of child.children) {
        if (isPageBreakHtml(part)) {
          flush();
          next.push({ type: 'pageBreak' });
        } else {
          buffer.push(part);
        }
      }
      flush();
      continue;
    }
    splitPageBreaks(child);
    next.push(child);
  }
  node.children = next;
};

export const pageBreakRemark = $remark('typeleftPageBreak', () => function typeleftPageBreak() {
  return (tree: any) => splitPageBreaks(tree);
});

export const pageBreakNode = $node('page_break', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {},
  parseDOM: [{ tag: 'div[data-type="pagebreak"]' }],
  toDOM: () => ['div', { 'data-type': 'pagebreak', class: 'page-break' }],
  parseMarkdown: {
    match: (node: any) => node.type === 'pageBreak',
    runner: (state: any, _node: any, type: any) => {
      state.addNode(type);
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'page_break',
    runner: (state: any) => {
      state.addNode('html', undefined, HTML);
    },
  },
}));

export const pageBreakView = $view(pageBreakNode, () => () => {
  const dom = document.createElement('div');
  dom.className = 'page-break';
  dom.setAttribute('data-type', 'pagebreak');
  dom.setAttribute('contenteditable', 'false');
  dom.textContent = '';
  return { dom };
});

export const pageBreakHtml = HTML;
