export type Paper = 'A3' | 'A4' | 'A5' | 'B5' | 'Letter' | 'custom';
export type Orientation = 'portrait' | 'landscape';
export type MarginPreset = 'normal' | 'cn-official' | 'narrow' | 'moderate' | 'wide' | 'custom';

export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PrintCover {
  enabled: boolean;
  title: string;
  subtitle: string;
  author: string;
  date: string;
}

export interface PrintToc {
  enabled: boolean;
  title: string;
  depth: number;
  pageNumbers: boolean;
}

export interface PrintHeaderFooter {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  evenHeaderLeft: string;
  evenHeaderCenter: string;
  evenHeaderRight: string;
  evenFooterLeft: string;
  evenFooterCenter: string;
  evenFooterRight: string;
  differentOddEven: boolean;
  differentFirst: boolean;
}

export interface PrintMeta {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export interface PrintSettings {
  paper: Paper;
  orientation: Orientation;
  customWidth: number;
  customHeight: number;
  marginPreset: MarginPreset;
  margins: Margins;
  bodyFont: string;
  headingFont: string;
  codeFont: string;
  cjkFont: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
  justify: boolean;
  headingNumbering: boolean;
  pageBreaks: boolean;
  cover: PrintCover;
  toc: PrintToc;
  headerFooter: PrintHeaderFooter;
  pageNumberFormat: 'arabic' | 'roman' | 'Roman' | 'alpha' | 'Alpha';
  pageStart: number;
  meta: PrintMeta;
  imageMaxWidth: string;
  codeHighlight: string;
}

export interface PrintPreset {
  id: string;
  name: string;
  settings: PrintSettings;
}

export const PAPER_MM: Record<Exclude<Paper, 'custom'>, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  B5: [176, 250],
  Letter: [215.9, 279.4],
};

export const MARGIN_PRESETS: Record<Exclude<MarginPreset, 'custom'>, Margins> = {
  normal: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
  'cn-official': { top: 25.4, bottom: 25.4, left: 31.8, right: 31.8 },
  narrow: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7 },
  moderate: { top: 19.05, bottom: 19.05, left: 19.05, right: 19.05 },
  wide: { top: 38.1, bottom: 38.1, left: 38.1, right: 38.1 },
};

export const defaultPrintSettings = (): PrintSettings => ({
  paper: 'A4',
  orientation: 'portrait',
  customWidth: 210,
  customHeight: 297,
  marginPreset: 'cn-official',
  margins: { ...MARGIN_PRESETS['cn-official'] },
  bodyFont: '',
  headingFont: '',
  codeFont: '',
  cjkFont: '',
  fontSize: 11,
  lineHeight: 1.6,
  paragraphSpacing: 0.6,
  firstLineIndent: 0,
  justify: true,
  headingNumbering: false,
  pageBreaks: true,
  cover: { enabled: false, title: '', subtitle: '', author: '', date: '' },
  toc: { enabled: true, title: 'Contents', depth: 3, pageNumbers: true },
  headerFooter: {
    headerLeft: '',
    headerCenter: '',
    headerRight: '',
    footerLeft: '',
    footerCenter: '{page}',
    footerRight: '',
    evenHeaderLeft: '',
    evenHeaderCenter: '',
    evenHeaderRight: '',
    evenFooterLeft: '',
    evenFooterCenter: '{page}',
    evenFooterRight: '',
    differentOddEven: false,
    differentFirst: false,
  },
  pageNumberFormat: 'arabic',
  pageStart: 1,
  meta: { title: '', author: '', subject: '', keywords: '' },
  imageMaxWidth: '100%',
  codeHighlight: 'github',
});

const num = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/** Merge persisted/partial print settings with defaults and clamp values. */
export const normalizePrintSettings = (raw: any): PrintSettings => {
  const base = defaultPrintSettings();
  if (!raw || typeof raw !== 'object') return base;
  const margins = raw.margins && typeof raw.margins === 'object' ? raw.margins : {};
  const cover = raw.cover && typeof raw.cover === 'object' ? raw.cover : {};
  const toc = raw.toc && typeof raw.toc === 'object' ? raw.toc : {};
  const hf = raw.headerFooter && typeof raw.headerFooter === 'object' ? raw.headerFooter : {};
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  const paper = (['A3', 'A4', 'A5', 'B5', 'Letter', 'custom'] as Paper[]).includes(raw.paper) ? raw.paper : base.paper;
  const preset = (['normal', 'cn-official', 'narrow', 'moderate', 'wide', 'custom'] as MarginPreset[]).includes(raw.marginPreset)
    ? raw.marginPreset as MarginPreset
    : base.marginPreset;
  const defaults = preset === 'custom' ? base.margins : MARGIN_PRESETS[preset as Exclude<MarginPreset, 'custom'>];
  return {
    paper,
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    customWidth: num(raw.customWidth, base.customWidth, 50, 1000),
    customHeight: num(raw.customHeight, base.customHeight, 50, 1000),
    marginPreset: preset,
    margins: {
      top: num(margins.top, defaults.top, 0, 100),
      bottom: num(margins.bottom, defaults.bottom, 0, 100),
      left: num(margins.left, defaults.left, 0, 100),
      right: num(margins.right, defaults.right, 0, 100),
    },
    bodyFont: text(raw.bodyFont, base.bodyFont),
    headingFont: text(raw.headingFont, base.headingFont),
    codeFont: text(raw.codeFont, base.codeFont),
    cjkFont: text(raw.cjkFont, base.cjkFont),
    fontSize: num(raw.fontSize, base.fontSize, 6, 30),
    lineHeight: num(raw.lineHeight, base.lineHeight, 1, 3),
    paragraphSpacing: num(raw.paragraphSpacing, base.paragraphSpacing, 0, 4),
    firstLineIndent: num(raw.firstLineIndent, base.firstLineIndent, 0, 10),
    justify: raw.justify !== false,
    headingNumbering: raw.headingNumbering === true,
    pageBreaks: raw.pageBreaks !== false,
    cover: {
      enabled: cover.enabled === true,
      title: text(cover.title),
      subtitle: text(cover.subtitle),
      author: text(cover.author),
      date: text(cover.date),
    },
    toc: {
      enabled: toc.enabled !== false,
      title: text(toc.title, base.toc.title),
      depth: num(toc.depth, base.toc.depth, 1, 6),
      pageNumbers: toc.pageNumbers !== false,
    },
    headerFooter: {
      headerLeft: text(hf.headerLeft),
      headerCenter: text(hf.headerCenter),
      headerRight: text(hf.headerRight),
      footerLeft: text(hf.footerLeft),
      footerCenter: text(hf.footerCenter, '{page}'),
      footerRight: text(hf.footerRight),
      evenHeaderLeft: text(hf.evenHeaderLeft),
      evenHeaderCenter: text(hf.evenHeaderCenter),
      evenHeaderRight: text(hf.evenHeaderRight),
      evenFooterLeft: text(hf.evenFooterLeft),
      evenFooterCenter: text(hf.evenFooterCenter),
      evenFooterRight: text(hf.evenFooterRight),
      differentOddEven: hf.differentOddEven === true,
      differentFirst: hf.differentFirst === true,
    },
    pageNumberFormat: (['arabic', 'roman', 'Roman', 'alpha', 'Alpha'] as const).includes(raw.pageNumberFormat)
      ? raw.pageNumberFormat
      : 'arabic',
    pageStart: num(raw.pageStart, 1, 1, 9999),
    meta: {
      title: text(meta.title),
      author: text(meta.author),
      subject: text(meta.subject),
      keywords: text(meta.keywords),
    },
    imageMaxWidth: text(raw.imageMaxWidth, base.imageMaxWidth) || '100%',
    codeHighlight: text(raw.codeHighlight, base.codeHighlight) || 'github',
  };
};

export const paperSizeMm = (settings: PrintSettings): [number, number] => {
  const [w, h] = settings.paper === 'custom'
    ? [settings.customWidth, settings.customHeight]
    : PAPER_MM[settings.paper];
  return settings.orientation === 'landscape' ? [h, w] : [w, h];
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const cssString = (value: string): string => value.replace(/["\\\n\r]/g, ' ').trim();

const fontStack = (settings: PrintSettings, kind: 'body' | 'heading' | 'code'): string => {
  const custom = kind === 'code' ? settings.codeFont : kind === 'heading' ? settings.headingFont : settings.bodyFont;
  if (custom.trim()) return custom;
  const cjk = settings.cjkFont.trim()
    ? `"${settings.cjkFont.trim()}"`
    : '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun"';
  if (kind === 'code') return `"JetBrains Mono", "Cascadia Code", Menlo, Consolas, ${cjk}, monospace`;
  return `-apple-system, "Segoe UI", ${cjk}, "Times New Roman", serif`;
};

/** Print CSS shared by browser preview, WeasyPrint and Paged.js. */
export const buildPrintCss = (input: PrintSettings, themeCss = ''): string => {
  const settings = normalizePrintSettings(input);
  const [w, h] = paperSizeMm(settings);
  const m = settings.margins;
  const title = settings.cover.title || settings.meta.title;
  const author = settings.cover.author || settings.meta.author;
  const date = settings.cover.date;
  const marginBox = (area: string, value: string): string => {
    if (!value.trim()) return '';
    const content = value
      .replace(/\{page\}/g, 'counter(page)')
      .replace(/\{total\}/g, 'counter(pages)')
      .replace(/\{title\}/g, cssString(title))
      .replace(/\{author\}/g, cssString(author))
      .replace(/\{date\}/g, cssString(date));
    return `@${area} { content: "${content}"; }\n`;
  };
  const hf = settings.headerFooter;
  const boxSet = (odd: boolean): string => {
    const values = odd
      ? {
        hl: hf.headerLeft, hc: hf.headerCenter, hr: hf.headerRight,
        fl: hf.footerLeft, fc: hf.footerCenter, fr: hf.footerRight,
      }
      : {
        hl: hf.evenHeaderLeft || (hf.differentOddEven ? '' : hf.headerLeft),
        hc: hf.evenHeaderCenter || (hf.differentOddEven ? '' : hf.headerCenter),
        hr: hf.evenHeaderRight || (hf.differentOddEven ? '' : hf.headerRight),
        fl: hf.evenFooterLeft || (hf.differentOddEven ? '' : hf.footerLeft),
        fc: hf.evenFooterCenter || (hf.differentOddEven ? '' : hf.footerCenter),
        fr: hf.evenFooterRight || (hf.differentOddEven ? '' : hf.footerRight),
      };
    return marginBox('top-left', values.hl)
      + marginBox('top-center', values.hc)
      + marginBox('top-right', values.hr)
      + marginBox('bottom-left', values.fl)
      + marginBox('bottom-center', values.fc)
      + marginBox('bottom-right', values.fr);
  };
  const oddBoxes = settings.cover.enabled ? '' : boxSet(true);
  const evenBoxes = settings.cover.enabled ? '' : (hf.differentOddEven ? boxSet(false) : oddBoxes);
  const firstPage = hf.differentFirst
    ? '@page :first { @top-left { content: none; } @top-center { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }\n'
    : '';
  const pageRule = `@page { size: ${w}mm ${h}mm; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; ${oddBoxes} }\n`
    + (settings.cover.enabled ? '@page cover { margin: 0; }\n' : '')
    + firstPage
    + `@page :left { ${evenBoxes} }\n@page :right { ${oddBoxes} }\n`;

  const headingSizes = [2.0, 1.6, 1.32, 1.16, 1.06, 1.0];
  const headingRules = headingSizes.map((scale, index) => {
    const level = index + 1;
    const breaks = level === 1 && settings.pageBreaks ? 'break-before: page;' : '';
    return `#write h${level}, .markdown-body h${level} { font-family: ${fontStack(settings, 'heading')}; font-size: ${(settings.fontSize * scale).toFixed(1)}pt; line-height: 1.25; margin: ${level === 1 ? '0 0 0.8em' : '1em 0 0.5em'}; ${breaks} break-after: avoid; }\n`;
  }).join('');

  return `/* Typeleft print stylesheet */
${themeCss}
${pageRule}
html, body { margin: 0; padding: 0; background: #fff; color: #111; }
.markdown-body, #write { font-family: ${fontStack(settings, 'body')}; font-size: ${settings.fontSize}pt; line-height: ${settings.lineHeight}; color: #111; max-width: none; padding: 0; margin: 0; }
#write p, .markdown-body p { margin: 0 0 ${settings.paragraphSpacing}em; ${settings.justify ? 'text-align: justify;' : ''} ${settings.firstLineIndent > 0 ? `text-indent: ${settings.firstLineIndent}em;` : ''} }
${headingRules}
#write a, .markdown-body a { color: #0b57d0; text-decoration: none; }
#write img, .markdown-body img { max-width: ${settings.imageMaxWidth || '100%'}; height: auto; break-inside: avoid; }
#write table, .markdown-body table { border-collapse: collapse; width: 100%; break-inside: auto; }
#write thead, .markdown-body thead { display: table-header-group; }
#write tr, .markdown-body tr { break-inside: avoid; }
#write th, #write td, .markdown-body th, .markdown-body td { border: 1px solid #bbb; padding: 4pt 6pt; vertical-align: top; }
#write pre, .markdown-body pre { font-family: ${fontStack(settings, 'code')}; font-size: ${Math.max(7, settings.fontSize - 2).toFixed(1)}pt; line-height: 1.45; white-space: pre-wrap; word-break: break-word; padding: 8pt; background: #f6f8fa; border: 1px solid #ddd; border-radius: 3pt; break-inside: avoid; }
#write code, .markdown-body code { font-family: ${fontStack(settings, 'code')}; font-size: 0.92em; }
#write pre code, .markdown-body pre code { font-size: 1em; }
#write blockquote, .markdown-body blockquote { margin: 0.8em 0; padding: 0.2em 1em; border-left: 3pt solid #999; color: #333; }
#write ul, #write ol, .markdown-body ul, .markdown-body ol { margin: 0 0 ${settings.paragraphSpacing}em 1.4em; padding: 0; }
#write li, .markdown-body li { margin: 0.15em 0; }
#write h1 + p, #write h2 + p, #write h3 + p, #write h4 + p { break-before: avoid; }
#write p, #write li, .markdown-body p, .markdown-body li { orphans: 2; widows: 2; }
#write hr, .markdown-body hr { border: none; border-top: 1px solid #bbb; margin: 1.2em 0; }
#write .md-alert, .markdown-body .md-alert { break-inside: avoid; border: 1px solid #bbb; border-left-width: 4pt; padding: 6pt 10pt; margin: 0.8em 0; }
#write .md-emoji, .markdown-body .md-emoji { font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif; }
#write .page-break, .markdown-body .page-break { break-after: page; }
/* Cover */
.print-cover-page { page: cover; height: 100vh; box-sizing: border-box; padding: 55mm 30mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; font-family: ${fontStack(settings, 'heading')}; }
.print-cover-page .cover-title { font-size: ${(settings.fontSize * 2.6).toFixed(1)}pt; font-weight: 700; line-height: 1.25; margin-bottom: 0.5em; }
.print-cover-page .cover-subtitle { font-size: ${(settings.fontSize * 1.5).toFixed(1)}pt; color: #333; margin-bottom: 3em; }
.print-cover-page .cover-author { font-size: ${(settings.fontSize * 1.15).toFixed(1)}pt; margin-top: 4em; }
.print-cover-page .cover-date { font-size: ${settings.fontSize}pt; color: #444; margin-top: 0.8em; }
/* TOC */
.print-toc { break-after: page; font-family: ${fontStack(settings, 'body')}; }
.print-toc-title { font-size: ${(settings.fontSize * 1.6).toFixed(1)}pt; font-weight: 700; margin: 0 0 1.2em; }
.print-toc a { display: block; color: #111; text-decoration: none; margin: 0.28em 0; padding-left: var(--toc-indent, 0); }
.print-toc a::after { content: target-counter(attr(href), page); float: right; }
.print-toc a.no-page-numbers::after { content: none; }
.print-toc a { border-bottom: 1px dotted #bbb; }
`;
};

export const buildCoverHtml = (input: PrintSettings): string => {
  const settings = normalizePrintSettings(input);
  if (!settings.cover.enabled) return '';
  const parts = [`<div class="cover-title">${escapeHtml(settings.cover.title || settings.meta.title)}</div>`];
  if (settings.cover.subtitle) parts.push(`<div class="cover-subtitle">${escapeHtml(settings.cover.subtitle)}</div>`);
  if (settings.cover.author) parts.push(`<div class="cover-author">${escapeHtml(settings.cover.author)}</div>`);
  if (settings.cover.date) parts.push(`<div class="cover-date">${escapeHtml(settings.cover.date)}</div>`);
  return `<section class="print-cover-page">${parts.join('')}</section>`;
};

export interface PrintHeading {
  level: number;
  id: string;
  text: string;
}

/** Collect headings from the generated article HTML for the standalone TOC. */
export const collectPrintHeadings = (html: string, depth: number): PrintHeading[] => {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map(node => ({
      level: Number(node.tagName.slice(1)),
      id: node.id || '',
      text: (node.textContent || '').trim(),
    }))
    .filter(item => item.text && item.id && item.level <= depth);
};

export const buildTocHtml = (input: PrintSettings, headings: PrintHeading[]): string => {
  const settings = normalizePrintSettings(input);
  if (!settings.toc.enabled || !headings.length) return '';
  const items = headings.map(heading => {
    const indent = (heading.level - 1) * 1.2;
    const pageClass = settings.toc.pageNumbers ? '' : ' class="no-page-numbers"';
    return `<a href="#${escapeHtml(heading.id)}"${pageClass} style="--toc-indent:${indent}em">${escapeHtml(heading.text)}</a>`;
  }).join('');
  return `<nav class="print-toc"><div class="print-toc-title">${escapeHtml(settings.toc.title)}</div>${items}</nav>`;
};

export const builtInPresets = (): PrintPreset[] => [
  { id: 'builtin-cn-a4', name: 'A4 中文公文', settings: defaultPrintSettings() },
  {
    id: 'builtin-a4-normal',
    name: 'A4 Normal',
    settings: { ...defaultPrintSettings(), marginPreset: 'normal', margins: { ...MARGIN_PRESETS.normal } },
  },
  {
    id: 'builtin-a5-booklet',
    name: 'A5 Booklet',
    settings: { ...defaultPrintSettings(), paper: 'A5' },
  },
  {
    id: 'builtin-letter',
    name: 'Letter',
    settings: { ...defaultPrintSettings(), paper: 'Letter', marginPreset: 'normal', margins: { ...MARGIN_PRESETS.normal } },
  },
];
