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

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * Tiny highlighter/validator for YAML and TOML front matter: enough to make
 * keys stand out and to flag lines that are not `key: value` / `key = value`.
 */
const highlightFrontmatter = (value: string, kind: 'yaml' | 'toml'): { html: string; invalid: number } => {
  let invalid = 0;
  const lines = value.split('\n').map((line, index) => {
    if (!line.trim()) return '';
    if (/^\s*#/.test(line)) return `<span class="fm-comment">${escapeHtml(line)}</span>`;
    if (kind === 'toml') {
      if (/^\s*\[.*\]\s*$/.test(line)) return `<span class="fm-section">${escapeHtml(line)}</span>`;
      const match = /^(\s*)([^=]+)(=)(.*)$/.exec(line);
      if (match) {
        return `${match[1]}<span class="fm-key">${escapeHtml(match[2].trimEnd())}</span>${match[2].match(/\s*$/)![0]}${match[3]}<span class="fm-value">${escapeHtml(match[4])}</span>`;
      }
      invalid = invalid || index + 1;
      return `<span class="fm-error">${escapeHtml(line)}</span>`;
    }
    const match = /^(\s*)([^:#]+)(:)(.*)$/.exec(line);
    if (match) {
      return `${match[1]}<span class="fm-key">${escapeHtml(match[2].trimEnd())}</span>${match[2].match(/\s*$/)![0]}${match[3]}<span class="fm-value">${escapeHtml(match[4])}</span>`;
    }
    if (/^\s*-\s/.test(line)) return `<span class="fm-value">${escapeHtml(line)}</span>`;
    invalid = invalid || index + 1;
    return `<span class="fm-error">${escapeHtml(line)}</span>`;
  });
  return { html: lines.join('\n') + '\n', invalid };
};

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
    const kind = (currentNode.attrs.kind as string) === 'toml' ? 'toml' : 'yaml';

    const wrap = document.createElement('div');
    wrap.className = 'frontmatter-editor-wrap';

    const highlight = document.createElement('div');
    highlight.className = 'frontmatter-highlight';
    highlight.setAttribute('aria-hidden', 'true');

    textarea = document.createElement('textarea');
    textarea.className = 'frontmatter-editor';
    textarea.value = current;
    textarea.rows = Math.max(3, current.split('\n').length + 1);

    const error = document.createElement('div');
    error.className = 'frontmatter-error';
    error.hidden = true;

    const refresh = () => {
      const { html, invalid } = highlightFrontmatter(textarea!.value, kind);
      highlight.innerHTML = html;
      highlight.scrollTop = textarea!.scrollTop;
      error.hidden = invalid === 0;
      error.textContent = invalid ? `第 ${invalid} 行格式可能无效` : '';
    };
    refresh();

    wrap.appendChild(highlight);
    wrap.appendChild(textarea);
    wrap.appendChild(error);
    dom.innerHTML = '';
    dom.appendChild(wrap);
    textarea.addEventListener('input', refresh);
    textarea.addEventListener('scroll', () => { highlight.scrollTop = textarea!.scrollTop; });
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
