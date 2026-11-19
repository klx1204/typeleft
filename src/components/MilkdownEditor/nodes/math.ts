import { $node, $remark, $view } from '@milkdown/kit/utils';
import type { NodeViewConstructor } from '@milkdown/kit/prose/view';
import katex from 'katex';
import remarkMath from 'remark-math';

/** Parse `$...$` / `$$...$$` into mdast math nodes. */
export const mathRemark = $remark('math', () => remarkMath);

const renderKatex = (value: string, displayMode: boolean): string => {
  try {
    return katex.renderToString(value || '\\phantom{x}', {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return `<span class="math-error">${value.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))}</span>`;
  }
};

const makeView = (displayMode: boolean): NodeViewConstructor => (node, view, getPos) => {
  const dom = document.createElement(displayMode ? 'div' : 'span');
  dom.className = displayMode ? 'math-node math-block' : 'math-node math-inline';
  dom.setAttribute('data-value', node.attrs.value ?? '');

  const render = (value: string) => {
    dom.innerHTML = renderKatex(value, displayMode);
  };
  render(node.attrs.value ?? '');

  let input: HTMLInputElement | null = null;

  const startEdit = () => {
    if (input) return;
    const current = (node.attrs.value ?? '') as string;
    input = document.createElement('input');
    input.type = 'text';
    input.value = current;
    input.className = 'math-node-input';
    dom.textContent = '';
    dom.appendChild(input);
    input.focus();
    input.select();

    const finish = (commit: boolean) => {
      if (!input) return;
      const next = commit ? input.value : current;
      dom.removeChild(input);
      input = null;
      if (commit && next !== current) {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos === 'number') {
          view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { value: next }));
        }
      } else {
        render(current);
      }
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  };

  dom.addEventListener('dblclick', (event) => {
    event.preventDefault();
    startEdit();
  });

  return {
    dom,
    update(next) {
      if (next.type !== node.type) return false;
      node = next;
      if (!input) render(node.attrs.value ?? '');
      return true;
    },
    stopEvent(event) {
      return !!input && event.target === input;
    },
    ignoreMutation() {
      return !input;
    },
  };
};

/** Inline math node. */
export const inlineMathNode = $node('inline_math', () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'span[data-type="inline-math"]',
      getAttrs: (dom: any) => ({ value: dom.getAttribute('data-value') ?? '' }),
    },
  ],
  toDOM: (node: any) => ['span', { 'data-type': 'inline-math', class: 'math-node math-inline', 'data-value': node.attrs.value }, node.attrs.value],
  parseMarkdown: {
    match: (node: any) => node.type === 'inlineMath',
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { value: node.value ?? '' });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'inline_math',
    runner: (state: any, node: any) => {
      state.addNode('inlineMath', undefined, node.attrs.value ?? '');
    },
  },
}));

/** Block math node. */
export const blockMathNode = $node('block_math', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  attrs: { value: { default: '' } },
  parseDOM: [
    {
      tag: 'div[data-type="block-math"]',
      getAttrs: (dom: any) => ({ value: dom.getAttribute('data-value') ?? '' }),
    },
  ],
  toDOM: (node: any) => ['div', { 'data-type': 'block-math', class: 'math-node math-block', 'data-value': node.attrs.value }, node.attrs.value],
  parseMarkdown: {
    match: (node: any) => node.type === 'math',
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { value: node.value ?? '' });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'block_math',
    runner: (state: any, node: any) => {
      state.addNode('math', undefined, node.attrs.value ?? '');
    },
  },
}));

export const inlineMathView = $view(inlineMathNode, () => makeView(false));
export const blockMathView = $view(blockMathNode, () => makeView(true));

export const mathPlugins = [mathRemark, inlineMathNode, blockMathNode, inlineMathView, blockMathView];
