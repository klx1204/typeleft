import { resolveMediaPath } from 'services/imagePaths';

export type ImageKind = 'local' | 'remote' | 'embedded' | 'other';

export interface ImageRef {
  src: string;
  alt: string;
  kind: ImageKind;
}

const IMAGE_MD = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const IMAGE_HTML = /<img\b[^>]*\bsrc\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi;

export const imageKind = (src: string): ImageKind => {
  if (/^(data:|asset:|blob:)/i.test(src)) return 'embedded';
  if (/^https?:\/\//i.test(src)) return 'remote';
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return 'other';
  return 'local';
};

export const extractImageRefs = (markdown: string): ImageRef[] => {
  const seen = new Set<string>();
  const out: ImageRef[] = [];
  const add = (src: string, alt = '') => {
    const clean = src.replace(/^<|>$/g, '').trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({ src: clean, alt, kind: imageKind(clean) });
  };
  for (const match of (markdown || '').matchAll(IMAGE_MD)) add(match[2], match[1]);
  for (const match of (markdown || '').matchAll(IMAGE_HTML)) add(match[2] || match[3] || '', '');
  return out;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replace the exact image source in both Markdown and HTML image syntax. */
export const replaceImageSrc = (markdown: string, oldSrc: string, newSrc: string): string => {
  if (!oldSrc || oldSrc === newSrc) return markdown;
  const escaped = escapeRegex(oldSrc);
  return markdown
    .replace(new RegExp(`(!\\[[^\\]]*\\]\\(\\s*)${escaped}(?=\\s|["')])`, 'g'), `$1${newSrc}`)
    .replace(new RegExp(`(<img\\b[^>]*\\bsrc\\s*=\\s*["'])${escaped}(?=["'])`, 'gi'), `$1${newSrc}`);
};

/** Absolute path for a local image reference (respecting typora-root-url). */
export const localImagePath = (src: string, basePath: string, rootUrl?: string): string | null => {
  if (imageKind(src) !== 'local' && !/^file:\/\//i.test(src)) return null;
  const raw = /^file:\/\//i.test(src) ? decodeURI(src.replace(/^file:\/\//i, '')) : src;
  const resolved = resolveMediaPath(raw, basePath, rootUrl);
  if (/^[a-z][a-z0-9+.-]*:/i.test(resolved)) return null;
  if (/^[a-zA-Z]:[\\/]/.test(resolved) || resolved.startsWith('/')) return resolved.replace(/\\/g, '/');
  return basePath ? `${basePath.replace(/\\/g, '/').replace(/\/+$/, '')}/${resolved.replace(/^\.\//, '')}` : null;
};

/** Markdown source for a saved image path, relative to the document folder. */
export const imageMarkdownSrc = (absolutePath: string, basePath: string, dotSlash = true): string => {
  const normalized = absolutePath.replace(/\\/g, '/');
  const base = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (base && normalized.startsWith(`${base}/`)) {
    const rel = normalized.slice(base.length + 1);
    return dotSlash ? `./${rel}` : rel;
  }
  return normalized;
};

/** Remove the first Markdown or HTML occurrence of an image source. */
export const removeFirstImageRef = (markdown: string, src: string): string => {
  const escaped = escapeRegex(src);
  const markdownRe = new RegExp(`!\\[[^\\]]*\\]\\(\\s*${escaped}(?:\\s+["'][^"']*["'])?\\s*\\)\\n?`);
  const htmlRe = new RegExp(`<img\\b[^>]*\\bsrc\\s*=\\s*["']${escaped}["'][^>]*>\\n?`, 'i');
  if (markdownRe.test(markdown)) return markdown.replace(markdownRe, '');
  return markdown.replace(htmlRe, '');
};
