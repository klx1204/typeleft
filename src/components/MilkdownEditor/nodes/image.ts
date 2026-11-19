import { $view } from '@milkdown/kit/utils';
import { imageSchema } from '@milkdown/kit/preset/commonmark';
import { convertFileSrc } from '@tauri-apps/api/core';

const isAbsolute = (src: string) =>
  /^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('/') || src.startsWith('\\');

/**
 * Resolve an image `src` from markdown into something the webview can load.
 * Relative paths are resolved against the currently opened file's folder.
 */
const toAssetUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    // Not running inside a Tauri webview (tests, plain browser).
    return path;
  }
};

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
  if (!basePath) return raw;
  const joined = `${basePath.replace(/\\/g, '/')}/${raw.replace(/^\.\//, '')}`;
  // Collapse `a/../b` segments.
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

export const createImageView = $view(imageSchema.node, () => (node) => {
  const wrapper = document.createElement('span');
  wrapper.className = 'md-image image-node';
  wrapper.setAttribute('data-src', node.attrs.src ?? '');

  const img = document.createElement('img');
  img.alt = node.attrs.alt ?? '';
  if (node.attrs.title) img.title = node.attrs.title;

  const apply = (next: typeof node) => {
    wrapper.setAttribute('data-src', next.attrs.src ?? '');
    img.alt = next.attrs.alt ?? '';
    if (next.attrs.title) img.title = next.attrs.title;
    wrapper.setAttribute('data-align', next.attrs.align ?? 'center');
    wrapper.setAttribute('data-width', next.attrs.width ?? '');
    img.style.width = next.attrs.width || '';
    img.src = resolveImageSrc(next.attrs.src ?? '');
  };

  const applyInitial = () => {
    wrapper.setAttribute('data-align', 'center');
    img.className = 'md-image';
    img.loading = 'lazy';
    img.src = resolveImageSrc(node.attrs.src ?? '');
    wrapper.appendChild(img);
  };
  applyInitial();

  return {
    dom: wrapper,
    update(next) {
      if (next.type.name !== 'image') return false;
      node = next;
      apply(next);
      return true;
    },
    // The DOM `src` is a resolved asset:// URL while the node keeps the
    // original markdown path, so never let ProseMirror re-read it from the DOM.
    ignoreMutation() { return true; },
    stopEvent() { return false; },
  };
});
