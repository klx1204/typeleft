/**
 * Pure-CSS typography / layout options.
 *
 * These are user preferences that only need CSS: direction, heading numbering,
 * justification, list markers, fonts and background. They are injected as a
 * single style element so themes stay untouched and switching them is instant.
 */

const STYLE_ID = 'typeleft-layout-css';

const safeFont = (value: string): string =>
  value.replace(/[;{}<>\\\n\r]/g, '').trim();

const safeColor = (value: string): string => {
  const color = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.,%\s]+\)$/i.test(color)) return color;
  if (/^[a-z]{3,20}$/i.test(color)) return color;
  return '';
};

const listMarker = (value: string): string => {
  const allowed = ['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'lower-roman', 'upper-alpha', 'upper-roman'];
  return allowed.includes(value) ? value : '';
};

export const buildLayoutCss = (options: any): string => {
  if (!options) return '';
  const rules: string[] = [];

  if (options.textDirection === 'rtl') {
    rules.push('#write { direction: rtl !important; text-align: right !important; }');
    rules.push('#write pre.md-fences, #write table, #write code, #write .math-node, #write .md-fences-header, #write .md-fences-gutter { direction: ltr !important; text-align: left !important; }');
  }

  if (options.headingNumbering) {
    rules.push('#write { counter-reset: h1 h2 h3 h4 h5 h6; }');
    for (let level = 1; level <= 6; level += 1) {
      const resets = level < 6
        ? ` counter-reset: ${Array.from({ length: 6 - level }, (_, i) => `h${level + 1 + i}`).join(' ')};`
        : '';
      const content = Array.from({ length: level }, (_, i) => `counter(h${i + 1})`).join(' "." ');
      rules.push(`#write h${level} { counter-increment: h${level};${resets} }`);
      rules.push(`#write h${level}::before { content: ${content} " "; color: var(--themeColor60, var(--themeColor)); }`);
    }
  }

  if (options.justifyText) {
    rules.push('#write p, #write li { text-align: justify !important; }');
  }

  const ul = listMarker(options.listMarker || '');
  if (ul && !['decimal', 'lower-alpha', 'lower-roman'].includes(ul)) {
    rules.push(`#write ul { list-style-type: ${ul} !important; }`);
  }
  const ol = listMarker(options.orderedMarker || '');
  if (ol && ['decimal', 'lower-alpha', 'lower-roman'].includes(ol)) {
    rules.push(`#write ol { list-style-type: ${ol} !important; }`);
  }

  const bodyFont = safeFont(options.bodyFont || '');
  if (bodyFont) rules.push(`#write { font-family: ${bodyFont} !important; }`);

  const codeFont = safeFont(options.codeFont || '');
  if (codeFont) {
    rules.push(`#write code, #write pre, #write pre.md-fences, #write .md-fences-gutter { font-family: ${codeFont} !important; }`);
  }

  const background = safeColor(options.editorBackground || '');
  if (background) rules.push(`#write { background-color: ${background} !important; }`);

  return rules.join('\n');
};

export const applyLayoutCss = (options: any): void => {
  const css = buildLayoutCss(options);
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  // Keep it last so it wins over theme rules at equal specificity.
  document.head.appendChild(el);
};
