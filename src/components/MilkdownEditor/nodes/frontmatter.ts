import { $node, $remark, $view } from '@milkdown/kit/utils';
import remarkFrontmatter from 'remark-frontmatter';

/**
 * Parse YAML front matter into a `yaml` mdast node.
 */
// Milkdown passes `{}` as options when none are given, which remark-frontmatter
// rejects; pass the `yaml` preset explicitly.
export const frontmatterRemark = $remark(
  'frontmatter',
  () => remarkFrontmatter as any,
  ['yaml', 'toml'] as any
);

/**
 * A block atom that keeps the raw YAML text so it survives round-trips.
 */
export const frontmatterNode = $node('frontmatter', () => ({
  content: '',
  group: 'block',
  atom: true,
  selectable: true,
  defining: true,
  isolating: true,
  attrs: { value: { default: '' }, kind: { default: 'yaml' } },
  parseDOM: [
    {
      tag: 'pre[data-type="frontmatter"]',
      getAttrs: (dom: any) => ({
        value: dom.textContent ?? '',
        kind: dom.getAttribute('data-kind') ?? 'yaml',
      }),
    },
  ],
  toDOM: (node: any) => [
    'pre',
    { 'data-type': 'frontmatter', 'data-kind': node.attrs.kind ?? 'yaml' },
    ['code', node.attrs.value],
  ],
  parseMarkdown: {
    match: (node: any) => node.type === 'yaml' || node.type === 'toml',
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { value: node.value ?? '', kind: node.type });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'frontmatter',
    runner: (state: any, node: any) => {
      state.addNode(node.attrs.kind || 'yaml', undefined, node.attrs.value);
    },
  },
}));

/** Editable front matter: double-click to edit the raw YAML block. */
export const frontmatterView = $view(frontmatterNode, () => (node, view, getPos) => {
  let currentNode = node;
  let textarea: HTMLTextAreaElement | null = null;

  const dom = document.createElement('pre');
  dom.setAttribute('data-type', 'frontmatter');
  dom.setAttribute('data-kind', currentNode.attrs.kind ?? 'yaml');
  dom.className = 'frontmatter-block';

  const render = () => {
    dom.innerHTML = '';
    const code = document.createElement('code');
    code.textContent = (currentNode.attrs.value as string) ?? '';
    dom.appendChild(code);
  };
  render();

  const startEdit = () => {
    if (textarea) return;
    const current = (currentNode.attrs.value as string) ?? '';
    textarea = document.createElement('textarea');
    textarea.className = 'frontmatter-editor';
    textarea.value = current;
    textarea.rows = Math.max(3, current.split('\n').length + 1);
    dom.innerHTML = '';
    dom.appendChild(textarea);
    textarea.focus();

    const finish = (commit: boolean) => {
      if (!textarea) return;
      const next = textarea.value;
      textarea = null;
      if (commit && next !== current) {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos === 'number') {
          view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { value: next }));
        }
      }
      render();
    };

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(false); }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); finish(true); }
    });
    textarea.addEventListener('blur', () => finish(true));
  };

  dom.addEventListener('dblclick', (event) => {
    event.preventDefault();
    startEdit();
  });

  return {
    dom,
    update(next) {
      if (next.type.name !== 'frontmatter') return false;
      currentNode = next;
      dom.setAttribute('data-kind', next.attrs.kind ?? 'yaml');
      if (!textarea) render();
      return true;
    },
    stopEvent(event) {
      return !!textarea && event.target === textarea;
    },
    ignoreMutation() {
      return !textarea;
    },
  };
});
