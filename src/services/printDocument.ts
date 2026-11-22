import ExportHtml from './exportHtml';
import {
  buildCoverHtml,
  buildPrintCss,
  buildTocHtml,
  collectPrintHeadings,
  normalizePrintSettings,
  removeTocMarker,
  stripFrontmatter,
  type PrintSettings,
} from './printSettings';

const escapeAttr = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export { removeTocMarker, stripFrontmatter } from './printSettings';

export interface PrintDocumentOptions {
  markdown: string;
  settings: PrintSettings | any;
  title: string;
  basePath?: string;
  rootUrl?: string;
  themeCss?: string;
}

/**
 * Build a self-contained print document: theme CSS, print CSS, optional cover,
 * a standalone linked TOC with page-number targets, then the rendered article.
 * Used by the preview and by system printing; Pandoc PDF gets the same settings
 * through its own arguments.
 */
export const buildPrintHtml = async (options: PrintDocumentOptions): Promise<string> => {
  const settings = normalizePrintSettings(options.settings);
  const html = await new ExportHtml(removeTocMarker(stripFrontmatter(options.markdown)), {
    baseUrl: options.basePath ? `file:///${options.basePath.replaceAll('\\', '/')}/` : undefined,
    typoraRootUrl: options.rootUrl,
  }).generate({
    title: options.title,
    includeCss: true,
    wrapInWrite: true,
    printOptimization: true,
    extraCss: options.themeCss || '',
    toc: '',
  });

  const articleMatch = html.match(/<article[\s\S]*?<\/article>/);
  const article = articleMatch?.[0] ?? '';
  const headings = collectPrintHeadings(article, settings.toc.depth);
  const cover = buildCoverHtml(settings);
  const toc = buildTocHtml(settings, headings);
  const printCss = buildPrintCss(settings);
  const meta = [
    settings.meta.title && `<meta name="title" content="${escapeAttr(settings.meta.title)}">`,
    (settings.meta.author || settings.cover.author) && `<meta name="author" content="${escapeAttr(settings.meta.author || settings.cover.author)}">`,
    settings.meta.subject && `<meta name="description" content="${escapeAttr(settings.meta.subject)}">`,
    settings.meta.keywords && `<meta name="keywords" content="${escapeAttr(settings.meta.keywords)}">`,
  ].filter(Boolean).join('\n  ');

  let document = html;
  if (article) document = document.replace(article, `${cover}${toc}${article}`);
  document = document.replace(
    '</head>',
    `  ${meta}\n  <style id="typeleft-print-style">\n${printCss}\n  </style>\n</head>`,
  );
  return document;
};

/** Headings of the rendered article, for the dialog's outline summary. */
export const printHeadingCount = (html: string, depth = 3): number => {
  const article = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '';
  return collectPrintHeadings(article, depth).length;
};
