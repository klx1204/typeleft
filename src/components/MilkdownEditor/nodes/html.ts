import { $node, $remark, $view } from '@milkdown/kit/utils';
import { convertFileSrc } from '@tauri-apps/api/core';
import { sanitize } from 'services/markdown/sanitize';
import { resolveMediaPath } from 'services/imagePaths';

/**
 * Raw HTML blocks and inline HTML (#54 / #73 / #74 / #60 / #61).
 *
 * The raw source is kept on the node, so Markdown round-trips byte for byte.
 * Rendering goes through DOMPurify, and media paths resolve like images.
 */
const PURIFY = {
  FORBID_ATTR: ['contenteditable', 'onerror', 'onload', 'onclick'],
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track', 'picture', 'u', 'ins'],
  ADD_ATTR: [
    'allowfullscreen', 'frameborder', 'allow', 'controls', 'autoplay', 'loop',
    'muted', 'playsinline', 'poster', 'preload', 'width', 'height', 'style',
    'class', 'target', 'rel', 'start', 'sandbox', 'loading', 'referrerpolicy',
  ],
  FORBID_TAGS: ['script', 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'link', 'base'],
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|asset|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
} as const;

const toAssetUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
};

export const previewMediaSrc = (src: string): string => {
  if (!src || /^(https?:|data:|blob:|asset:|tauri:|mailto:)/i.test(src)) return src;
  const basePath = (window as any).basePath || '';
  const resolved = resolveMediaPath(src, basePath, (window as any).typoraRootUrl);
  return toAssetUrl(resolved);
};

const fixMedia = (root: HTMLElement): void => {
  root.querySelectorAll('img,video,audio,source').forEach((el) => {
    const src = el.getAttribute('src');
    if (src) el.setAttribute('src', previewMediaSrc(src));
    const poster = el.getAttribute('poster');
    if (poster) el.setAttribute('poster', previewMediaSrc(poster));
  });
  root.querySelectorAll('iframe').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(src)) {
      el.removeAttribute('src');
      return;
    }
    el.setAttribute('sandbox', 'allow-scripts allow-presentation allow-popups');
    el.setAttribute('loading', 'lazy');
    el.setAttribute('referrerpolicy', 'no-referrer');
  });
};

export const renderHtml = (value: string): string => {
  const clean = sanitize(value || '', PURIFY);
  return clean;
};

const makeView = (inline: boolean) => () => (node: any) => {
  const dom = document.createElement(inline ? 'span' : 'div');
  dom.className = inline ? 'md-html-inline' : 'md-html-block';
  dom.setAttribute('contenteditable', 'false');
  dom.setAttribute('data-type', inline ? 'html-inline' : 'html-block');
  const render = (value: string) => {
    dom.innerHTML = renderHtml(value);
    fixMedia(dom);
  };
  render(node.attrs.value || '');
  return {
    dom,
    update(next: any) {
      if (next.type !== node.type) return false;
      node = next;
      render(next.attrs.value || '');
      return true;
    },
    ignoreMutation: () => true,
    stopEvent: (event: Event) => {
      const target = event.target as HTMLElement;
      return !!target.closest('a,iframe,video,audio');
    },
  };
};

const htmlNode = (name: string, kind: 'htmlBlock' | 'htmlInline', inline: boolean) => $node(name, () => ({
  group: inline ? 'inline' : 'block',
  inline,
  atom: true,
  selectable: true,
  attrs: { value: { default: '' } },
  parseDOM: inline
    ? [{ tag: 'span[data-type="html-inline"]', getAttrs: (dom: any) => ({ value: dom.getAttribute('data-value') || dom.innerHTML }) }]
    : [{ tag: 'div[data-type="html-block"]', getAttrs: (dom: any) => ({ value: dom.getAttribute('data-value') || dom.innerHTML }) }],
  toDOM: (node: any) => [inline ? 'span' : 'div', {
    'data-type': inline ? 'html-inline' : 'html-block',
    'data-value': node.attrs.value,
    class: inline ? 'md-html-inline' : 'md-html-block',
    contenteditable: 'false',
  }],
  parseMarkdown: {
    match: (node: any) => node.type === kind,
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { value: node.value ?? '' });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === name,
    runner: (state: any, node: any) => {
      state.addNode('html', undefined, node.attrs.value ?? '');
    },
  },
}));

export const htmlBlockNode = htmlNode('html_block', 'htmlBlock', false);
export const htmlInlineNode = htmlNode('html_inline', 'htmlInline', true);
export const htmlBlockView = $view(htmlBlockNode, makeView(false));
export const htmlInlineView = $view(htmlInlineNode, makeView(true));

const BLOCK_TAGS = /^\s*<(address|article|aside|base|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul|video|audio)(\s|>|\/)/i;

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

/**
 * Convert every remaining `html` mdast node; page breaks and images ran first.
 * Inline tag pairs are merged so `<span style>…</span>` keeps its styling, and
 * media-only paragraphs (video/audio/iframe often parse as paragraphs) become
 * block nodes.
 */
export const htmlRemark = $remark('typeleftHtml', () => function typeleftHtml() {
  return (tree: any, file: any) => {
    const source = typeof file?.value === 'string' ? file.value : String(file ?? '');
    const sliceSource = (from: any, to: any): string | null => {
      const start = from?.position?.start?.offset;
      const end = to?.position?.end?.offset;
      if (typeof start === 'number' && typeof end === 'number') return source.slice(start, end);
      return null;
    };

    const convertInlineContainer = (node: any) => {
      const children = node.children || [];
      const out: any[] = [];
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child.type === 'html') {
          const value = child.value || '';
          const open = /^<([a-zA-Z][\w:-]*)(\s[^>]*)?>$/.exec(value.trim());
          if (open && !VOID_TAGS.has(open[1].toLowerCase())) {
            const tag = open[1].toLowerCase();
            let close = -1;
            for (let j = i + 1; j < children.length; j += 1) {
              const candidate = children[j];
              if (candidate.type === 'html' && new RegExp(`^</${tag}\\s*>$`, 'i').test((candidate.value || '').trim())) {
                close = j;
                break;
              }
            }
            if (close !== -1) {
              const merged = sliceSource(child, children[close])
                ?? children.slice(i, close + 1).map((c: any) => c.value ?? c.children?.map((x: any) => x.value ?? '').join('') ?? '').join('');
              out.push({ type: 'htmlInline', value: merged });
              i = close;
              continue;
            }
          }
          out.push({ type: 'htmlInline', value });
          continue;
        }
        convertInlineContainer(child);
        out.push(child);
      }
      node.children = out;
    };

    const isMediaParagraph = (node: any): boolean => {
      const children = node.children || [];
      if (!children.length) return false;
      if (!children.every((c: any) => c.type === 'html' || (c.type === 'text' && !String(c.value || '').trim()))) return false;
      const first = children.find((c: any) => c.type === 'html');
      return !!first && /^\s*<(video|audio|iframe|div|figure|section|table|details|object|embed)\b/i.test(first.value || '');
    };

    const convertBlockContainer = (node: any) => {
      const out: any[] = [];
      for (const child of node.children || []) {
        if (child.type === 'html') {
          if (!(child.value || '').trim()) {
            out.push(child);
            continue;
          }
          out.push({ type: 'htmlBlock', value: child.value });
          continue;
        }
        if (child.type === 'paragraph' && isMediaParagraph(child)) {
          const kids = child.children || [];
          const merged = sliceSource(kids[0], kids[kids.length - 1])
            ?? kids.map((c: any) => c.value ?? '').join('');
          out.push({ type: 'htmlBlock', value: merged });
          continue;
        }
        if (child.type === 'paragraph' || child.type === 'heading' || child.type === 'tableCell') {
          convertInlineContainer(child);
          out.push(child);
          continue;
        }
        convertBlockContainer(child);
        out.push(child);
      }
      node.children = out;
    };

    convertBlockContainer(tree);
  };
});