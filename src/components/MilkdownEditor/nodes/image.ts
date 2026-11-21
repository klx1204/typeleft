import { $remark, $view } from '@milkdown/kit/utils';
import { imageSchema } from '@milkdown/kit/preset/commonmark';
import { convertFileSrc } from '@tauri-apps/api/core';
import { visit } from 'unist-util-visit';
import { t } from 'services/i18n';
import { resolveMediaPath } from 'services/imagePaths';

type Align = 'left' | 'center' | 'right' | null;

const isAbsolute = (src: string) =>
  /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/') || src.startsWith('\\');

const toAssetUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    // Not running inside a Tauri webview (tests, plain browser).
    return path;
  }
};

/**
 * Resolve an image `src` from markdown into something the webview can load.
 * Relative paths are resolved against the currently opened file's folder.
 */
export const resolveImageSrc = (src: string): string => {
  if (!src) return src;
  if (/^(https?:|asset:|blob:|data:|tauri:)/i.test(src)) return src;
  let raw = src;
  if (/^file:\/\//i.test(raw)) {
    raw = decodeURI(raw.replace(/^file:\/\//i, ''));
  }
  const basePath: string = (window as any).basePath || '';
  if (isAbsolute(raw)) {
    return toAssetUrl(raw.replace(/\\/g, '/'));
  }
  const rooted = resolveMediaPath(raw, basePath, (window as any).typoraRootUrl);
  if (rooted !== raw) {
    if (/^(https?:|\/\/)/i.test(rooted)) return rooted;
    return toAssetUrl(rooted.replace(/^\.\//, ''));
  }
  if (!basePath) return raw;
  const joined = `${basePath.replace(/\\/g, '/')}/${raw.replace(/^\.\//, '')}`;
  const parts = joined.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' && out.length === 0) { out.push(''); continue; }
    if (part === '.') continue;
    if (part === '..') { out.pop(); continue; }
    out.push(part);
  }
  return toAssetUrl(out.join('/'));
};

/** Read `width` from a style attribute, including Typora's `zoom: 50%`. */
const styleSize = (raw: string): string | null => {
  const style = attrOf(raw, 'style');
  if (!style) return null;
  const zoom = /zoom\s*:\s*([\d.]+)%?/i.exec(style);
  if (zoom) return `${zoom[1]}%`;
  const width = /width\s*:\s*([\d.]+(?:px|%|em|rem)?)/i.exec(style);
  return width ? width[1] : null;
};

const attrOf = (raw: string, name: string): string | null => {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const match = re.exec(raw);
  if (!match) return null;
  return match[2] ?? match[3] ?? '';
};

/**
 * Muya (and Typora) store image layout as inline HTML:
 *   <img src="a.png" alt="x" width="300" data-align="center">
 * Turn those back into image nodes so they stay editable.
 */
export const imageHtmlRemark = $remark('typeleftImageHtml', () => function typeleftImageHtml() {
  return (tree: any) => {
    visit(tree, 'html', (node: any, index: number | undefined, parent: any) => {
      if (!parent || index === undefined || parent.type !== 'paragraph') return;
      const match = /^\s*<img\b([^>]*?)\/?>\s*$/i.exec(node.value || '');
      if (!match) return;
      const raw = match[1];
      const src = attrOf(raw, 'src');
      if (!src) return;
      const image = {
        type: 'image',
        url: src,
        alt: attrOf(raw, 'alt') ?? '',
        title: attrOf(raw, 'title') ?? null,
        data: {
          width: attrOf(raw, 'width') ?? styleSize(raw),
          align: attrOf(raw, 'data-align'),
        },
      };
      if (parent.type === 'paragraph') {
        parent.children[index] = image;
      } else if (parent.type === 'root') {
        // A standalone `<img>` block: wrap it so the inline image stays valid.
        parent.children[index] = { type: 'paragraph', children: [image] };
      }
    });
  };
});

const escapeAttr = (value: string) => String(value ?? '').replace(/"/g, '&quot;');

export const imageLayoutSchema = imageSchema.extendSchema((prev) => (ctx: any) => {
  const base = prev(ctx);
  return {
    ...base,
    attrs: {
      ...base.attrs,
      width: { default: null },
      align: { default: null },
    },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom: any) => ({
          src: dom.getAttribute('src') || '',
          alt: dom.getAttribute('alt') || '',
          title: dom.getAttribute('title') || '',
          width: dom.getAttribute('width') || null,
          align: dom.getAttribute('data-align') || null,
        }),
      },
    ],
    toDOM: (node: any) => {
      const attrs: Record<string, string> = {
        src: node.attrs.src,
        alt: node.attrs.alt,
      };
      if (node.attrs.title) attrs.title = node.attrs.title;
      if (node.attrs.width) attrs.width = node.attrs.width;
      if (node.attrs.align) attrs['data-align'] = node.attrs.align;
      return ['img', attrs];
    },
    parseMarkdown: {
      match: ({ type }: any) => type === 'image',
      runner: (state: any, node: any, type: any) => {
        state.addNode(type, {
          src: node.url,
          alt: node.alt ?? '',
          title: node.title ?? '',
          width: node.data?.width ?? null,
          align: node.data?.align ?? null,
        });
      },
    },
    toMarkdown: {
      match: (node: any) => node.type.name === 'image',
      runner: (state: any, node: any) => {
        const { src, alt, title, width, align } = node.attrs;
        if (width || align) {
          const parts = [`src="${escapeAttr(src)}"`];
          if (alt) parts.push(`alt="${escapeAttr(alt)}"`);
          if (title) parts.push(`title="${escapeAttr(title)}"`);
          if (width) parts.push(`width="${escapeAttr(width)}"`);
          if (align) parts.push(`data-align="${align}"`);
          state.addNode('html', undefined, `<img ${parts.join(' ')}>`);
          return;
        }
        state.addNode('image', undefined, undefined, {
          title,
          url: src,
          alt,
        });
      },
    },
  };
});

export const createImageView = $view(imageLayoutSchema.node, () => (node, view, getPos) => {
  let currentNode = node;

  const wrapper = document.createElement('span');
  wrapper.className = 'md-image image-node';
  wrapper.setAttribute('data-src', node.attrs.src ?? '');

  const img = document.createElement('img');
  img.alt = node.attrs.alt ?? '';
  img.loading = 'lazy';
  img.draggable = false;

  const toolbar = document.createElement('span');
  toolbar.className = 'image-toolbar';
  const alignButtons: [Align, string, string][] = [
    ['left', '⟸', t('Align left')],
    ['center', '⇔', t('Align center')],
    ['right', '⟹', t('Align right')],
    [null, '⤢', t('Original size')],
  ];
  alignButtons.forEach(([align, glyph, title]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = glyph;
    button.title = title;
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      updateAttrs({ align, width: align === null ? null : currentNode.attrs.width });
    });
    toolbar.appendChild(button);
  });

  const handle = document.createElement('span');
  handle.className = 'image-resize-handle';
  handle.title = t('Drag to resize');

  wrapper.appendChild(img);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(handle);

  const updateAttrs = (patch: Partial<{ width: string | null; align: Align }>) => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (typeof pos !== 'number') return;
    const attrs = { ...currentNode.attrs, ...patch };
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, attrs));
  };

  const apply = (target: typeof node) => {
    currentNode = target;
    const { src, alt, title, width, align } = target.attrs;
    img.alt = alt ?? '';
    img.title = title ?? '';
    img.style.width = width || '';
    img.src = resolveImageSrc(src ?? '');
    wrapper.setAttribute('data-src', src ?? '');
    wrapper.setAttribute('data-align', align ?? 'center');
    wrapper.setAttribute('data-width', width ?? '');
    Array.from(toolbar.querySelectorAll('button')).forEach((button, index) => {
      button.classList.toggle('active', align === alignButtons[index][0]);
    });
  };
  apply(node);

  // Drag the right edge to set an explicit width.
  let dragging = false;
  let startX = 0;
  let startWidth = 0;
  handle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    startX = event.clientX;
    startWidth = img.getBoundingClientRect().width || img.naturalWidth || 300;
    const onMove = (moveEvent: MouseEvent) => {
      if (!dragging) return;
      const width = Math.max(40, Math.round(startWidth + moveEvent.clientX - startX));
      img.style.width = `${width}px`;
    };
    const onUp = (upEvent: MouseEvent) => {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const width = Math.max(40, Math.round(startWidth + upEvent.clientX - startX));
      updateAttrs({ width: `${width}px` });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  return {
    dom: wrapper,
    update(next) {
      if (next.type.name !== 'image') return false;
      apply(next);
      return true;
    },
    // The DOM `src` is a resolved asset:// URL while the node keeps the
    // original markdown path, so never let ProseMirror re-read it from the DOM.
    ignoreMutation() { return true; },
    stopEvent(event) {
      const target = event.target as HTMLElement;
      return !!target.closest('.image-toolbar') || !!target.closest('.image-resize-handle');
    },
  };
});
