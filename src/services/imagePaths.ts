/**
 * Image path rules shared by insertion, preview and export (#111–#114).
 */

const isAbsolutePath = (path: string) =>
  /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/') || path.startsWith('\\');

const hasScheme = (path: string) => /^[a-z][a-z0-9+.-]*:/i.test(path);

const encodePath = (path: string) =>
  encodeURI(path.replace(/\\/g, '/')).replace(/[?#]/g, c => (c === '?' ? '%3F' : '%23'));

/** Directory that receives copied/pasted images. */
export const imageDirectory = (basePath: string, option: unknown): string => {
  const dir = String(option ?? '').trim() || 'images';
  if (isAbsolutePath(dir)) return dir.replace(/\\/g, '/');
  if (!basePath) return dir;
  return `${basePath.replace(/\\/g, '/').replace(/\/+$/, '')}/${dir.replace(/^\.?\//, '').replace(/\/+$/, '')}`;
};

/**
 * Turn a saved file path into the `src` written to Markdown.
 * - optional relative form, with or without `./`
 * - optional URL encoding (local paths included, not just http)
 */
export const finalizeImagePath = (path: string, basePath: string, options: any): string => {
  const opts = options ?? {};
  let result = (path || '').replace(/\\/g, '/');

  if (opts.preferRelativeImagePaths && basePath) {
    const base = basePath.replace(/\\/g, '/').replace(/\/+$/, '');
    if (result.startsWith(base)) {
      result = result.slice(base.length).replace(/^\/+/, '');
      if (opts.dotSlashImagePaths !== false) result = `./${result}`;
    }
  }

  if (opts.autoEncodeImageURL && !/^(data:|asset:|blob:)/i.test(result)) {
    result = encodePath(result);
  }

  return result;
};

/** Resolve a Markdown `src` for preview, honouring `typora-root-url`. */
export const resolveMediaPath = (src: string, basePath: string, rootUrl?: string): string => {
  if (!src) return src;
  if (hasScheme(src) || src.startsWith('//')) return src;
  if (!rootUrl) return src;

  const root = String(rootUrl).trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const relative = src.replace(/^\.?\//, '');
  if (hasScheme(root) || root.startsWith('//')) return `${root}/${relative}`;
  if (root.startsWith('/')) return `${root}/${relative}`;
  if (!basePath) return `${root}/${relative}`;
  return `${basePath.replace(/\\/g, '/').replace(/\/+$/, '')}/${root.replace(/^\.?\//, '')}/${relative}`;
};
