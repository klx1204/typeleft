import { $node, $remark, $view } from '@milkdown/kit/utils';

/**
 * `[TOC]` block (#52). The source stays `[TOC]`; the node view renders a live
 * outline from the headings and links back into the document.
 */
let enabled = true;

export const setTocEnabled = (value: unknown) => {
  enabled = value !== false;
};

export const tocRemark = $remark('typeleftToc', () => function typeleftToc() {
  return (tree: any) => {
    if (!enabled || !Array.isArray(tree.children)) return;
    for (const child of tree.children) {
      if (child.type !== 'paragraph' || !Array.isArray(child.children)) continue;
      if (!child.children.every((c: any) => c.type === 'text')) continue;
      const text = child.children.map((c: any) => c.value ?? '').join('').trim();
      if (/^\[toc\]$/i.test(text)) {
        child.type = 'tocBlock';
        child.children = [];
      }
    }
  };
});

export const tocNode = $node('toc_block', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  attrs: {},
  parseDOM: [{ tag: 'nav[data-type="toc"]' }],
  toDOM: () => ['nav', { 'data-type': 'toc', class: 'md-toc' }],
  parseMarkdown: {
    match: (node: any) => node.type === 'tocBlock',
    runner: (state: any, _node: any, type: any) => {
      state.addNode(type);
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'toc_block',
    runner: (state: any) => {
      state.addNode('html', undefined, '[TOC]');
    },
  },
}));

export const tocView = $view(tocNode, () => (node, view) => {
  const dom = document.createElement('nav');
  dom.className = 'md-toc';
  dom.setAttribute('data-type', 'toc');
  dom.setAttribute('contenteditable', 'false');

  const render = () => {
    const headings = Array.from(view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[];
    const signature = headings.map(h => `${h.tagName}:${h.id}:${h.textContent}`).join('|');
    if ((dom as any).__signature === signature) return;
    (dom as any).__signature = signature;
    dom.innerHTML = '';
    if (!headings.length) {
      const empty = document.createElement('div');
      empty.className = 'md-toc-empty';
      empty.textContent = 'No headings';
      dom.appendChild(empty);
      return;
    }
    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));
      const link = document.createElement('a');
      link.className = `md-toc-item md-toc-h${level}`;
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent ?? '';
      link.style.paddingLeft = `${8 + (level - 1) * 16}px`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = view.dom.querySelector(`[id="${CSS.escape(heading.id)}"]`) as HTMLElement | null;
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      dom.appendChild(link);
    }
  };

  render();
  const timer = window.setInterval(render, 800);
  return {
    dom,
    update(next: any) {
      if (next.type !== node.type) return false;
      render();
      return true;
    },
    destroy() { window.clearInterval(timer); },
    ignoreMutation: () => true,
    stopEvent: (event: Event) => !!((event.target as HTMLElement).closest('a')),
  };
});
