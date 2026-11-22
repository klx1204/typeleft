/**
 * Typography settings as design tokens.
 *
 * A setting has three states: follow the theme (no override), use the built-in
 * default, or an explicit value. Only explicit values produce CSS, so a theme
 * keeps full control until the user changes something.
 */

const STYLE_ID = 'typeleft-layout-css';
const ROOT_ATTRS = [
  'data-direction',
  'data-heading-numbering',
  'data-tl-justify',
  'data-tl-font',
  'data-tl-code-font',
  'data-tl-bg',
  'data-tl-line-height',
  'data-tl-paragraph-gap',
  'data-tl-list-marker',
  'data-tl-ordered-marker',
];
const ROOT_VARS = [
  '--tl-body-font',
  '--tl-code-font',
  '--tl-editor-bg',
  '--tl-line-height',
  '--tl-paragraph-gap',
  '--tl-list-marker',
  '--tl-ordered-marker',
];

const safeFont = (value: string): string =>
  value.replace(/[;{}<>\\\n\r]/g, '').trim();

const safeColor = (value: string): string => {
  const color = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.,%\s]+\)$/i.test(color)) return color;
  if (/^[a-z]{3,20}$/i.test(color)) return color;
  return '';
};

const safeLength = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d+(?:\.\d+)?(?:px|em|rem|%|pt|mm|in)?$/.test(text)) return text;
  return '';
};

const listMarker = (value: string): string => {
  const allowed = ['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'lower-roman', 'upper-alpha', 'upper-roman'];
  return allowed.includes(value) ? value : '';
};

/** `true`/`'on'` are on, `false`/`'off'` are explicitly off, anything else inherits. */
const isOn = (value: unknown): boolean => value === true || value === 'on';
const explicit = (value: unknown): boolean => value !== undefined && value !== null && value !== '' && value !== 'inherit';

export interface TypographyOverrides {
  direction: 'ltr' | 'rtl' | null;
  headingNumbering: boolean | null;
  justify: boolean | null;
  bodyFont: string | null;
  codeFont: string | null;
  background: string | null;
  lineHeight: string | null;
  paragraphGap: string | null;
  listMarker: string | null;
  orderedMarker: string | null;
}

export const typographyOverrides = (options: any): TypographyOverrides => {
  const opts = options ?? {};
  return {
    direction: opts.textDirection === 'rtl' || opts.textDirection === 'ltr' ? opts.textDirection : null,
    headingNumbering: isOn(opts.headingNumbering) ? true : (opts.headingNumbering === false || opts.headingNumbering === 'off' ? false : null),
    justify: isOn(opts.justifyText) ? true : (opts.justifyText === false || opts.justifyText === 'off' ? false : null),
    bodyFont: safeFont(opts.bodyFont || '') || null,
    codeFont: safeFont(opts.codeFont || '') || null,
    background: safeColor(opts.editorBackground || '') || null,
    lineHeight: safeLength(opts.lineHeight) || null,
    paragraphGap: safeLength(opts.paragraphGap) || null,
    listMarker: listMarker(opts.listMarker || '') || null,
    orderedMarker: listMarker(opts.orderedMarker || '') || null,
  };
};

export const buildLayoutCss = (options: any): string => {
  const values = typographyOverrides(options);
  const rules: string[] = [];

  if (values.direction === 'rtl') {
    rules.push('#write[data-direction="rtl"] { direction: rtl; text-align: right; }');
    rules.push('#write[data-direction="rtl"] pre.md-fences, #write[data-direction="rtl"] table, #write[data-direction="rtl"] code, #write[data-direction="rtl"] .math-node, #write[data-direction="rtl"] .md-fences-header, #write[data-direction="rtl"] .md-fences-gutter { direction: ltr; text-align: left; }');
  } else if (values.direction === 'ltr') {
    rules.push('#write[data-direction="ltr"] { direction: ltr; text-align: left; }');
  }

  if (values.headingNumbering === false) {
    rules.push('#write[data-heading-numbering="false"] h1, #write[data-heading-numbering="false"] h2, #write[data-heading-numbering="false"] h3, #write[data-heading-numbering="false"] h4, #write[data-heading-numbering="false"] h5, #write[data-heading-numbering="false"] h6 { counter-increment: none; counter-reset: none; }');
    rules.push('#write[data-heading-numbering="false"] h1::before, #write[data-heading-numbering="false"] h2::before, #write[data-heading-numbering="false"] h3::before, #write[data-heading-numbering="false"] h4::before, #write[data-heading-numbering="false"] h5::before, #write[data-heading-numbering="false"] h6::before { content: none; }');
  }

  if (values.headingNumbering === true) {
    rules.push('#write[data-heading-numbering="true"] { counter-reset: h1 h2 h3 h4 h5 h6; }');
    for (let level = 1; level <= 6; level += 1) {
      const resets = level < 6
        ? ` counter-reset: ${Array.from({ length: 6 - level }, (_, i) => `h${level + 1 + i}`).join(' ')};`
        : '';
      const content = Array.from({ length: level }, (_, i) => `counter(h${i + 1})`).join(' "." ');
      rules.push(`#write[data-heading-numbering="true"] h${level} { counter-increment: h${level};${resets} }`);
      rules.push(`#write[data-heading-numbering="true"] h${level}::before { content: ${content} " "; color: var(--themeColor60, var(--themeColor)); }`);
    }
  }

  if (values.justify === true) {
    rules.push('#write[data-tl-justify="true"] p, #write[data-tl-justify="true"] li { text-align: justify; }');
  } else if (values.justify === false) {
    rules.push('#write[data-tl-justify="false"] p, #write[data-tl-justify="false"] li { text-align: initial; }');
  }

  if (values.listMarker && ['disc', 'circle', 'square'].includes(values.listMarker)) {
    rules.push('#write[data-tl-list-marker="true"] ul { list-style-type: var(--tl-list-marker); }');
  }
  if (values.orderedMarker) {
    rules.push('#write[data-tl-ordered-marker="true"] ol { list-style-type: var(--tl-ordered-marker); }');
  }

  if (values.bodyFont) {
    rules.push('#write[data-tl-font="true"] { font-family: var(--tl-body-font); }');
  }
  if (values.codeFont) {
    rules.push('#write[data-tl-code-font="true"] code, #write[data-tl-code-font="true"] pre, #write[data-tl-code-font="true"] pre.md-fences, #write[data-tl-code-font="true"] .md-fences-gutter { font-family: var(--tl-code-font); }');
  }
  if (values.background) {
    rules.push('#write[data-tl-bg="true"] { background-color: var(--tl-editor-bg); }');
  }
  if (values.lineHeight) {
    rules.push('#write[data-tl-line-height="true"] { line-height: var(--tl-line-height); }');
  }
  if (values.paragraphGap) {
    rules.push('#write[data-tl-paragraph-gap="true"] p { margin-bottom: var(--tl-paragraph-gap); }');
  }

  return rules.join('\n');
};

/**
 * Static CSS for HTML/print export. Unlike the editor rules this uses direct
 * values (no data attributes or custom properties), because the exported DOM
 * has no editor instance to toggle them.
 */
export const buildExportLayoutCss = (options: any): string => {
  const values = typographyOverrides(options);
  const rules: string[] = [];
  const vars: string[] = [];
  if (values.bodyFont) vars.push(`--tl-body-font: ${values.bodyFont};`);
  if (values.codeFont) vars.push(`--tl-code-font: ${values.codeFont};`);
  if (values.background) vars.push(`--tl-editor-bg: ${values.background};`);
  if (values.lineHeight) vars.push(`--tl-line-height: ${values.lineHeight};`);
  if (values.paragraphGap) vars.push(`--tl-paragraph-gap: ${values.paragraphGap};`);
  if (values.listMarker) vars.push(`--tl-list-marker: ${values.listMarker};`);
  if (values.orderedMarker) vars.push(`--tl-ordered-marker: ${values.orderedMarker};`);
  if (vars.length) rules.push(`:root { ${vars.join(' ')} }`);

  if (values.direction === 'rtl') {
    rules.push('#write { direction: rtl; text-align: right; }');
    rules.push('#write pre, #write table, #write code { direction: ltr; text-align: left; }');
  } else if (values.direction === 'ltr') {
    rules.push('#write { direction: ltr; text-align: left; }');
  }

  if (values.headingNumbering === false) {
    rules.push('#write h1, #write h2, #write h3, #write h4, #write h5, #write h6 { counter-increment: none; counter-reset: none; }');
    rules.push('#write h1::before, #write h2::before, #write h3::before, #write h4::before, #write h5::before, #write h6::before { content: none; }');
  }
  if (values.headingNumbering === true) {
    rules.push('#write { counter-reset: h1 h2 h3 h4 h5 h6; }');
    for (let level = 1; level <= 6; level += 1) {
      const resets = level < 6
        ? ` counter-reset: ${Array.from({ length: 6 - level }, (_, i) => `h${level + 1 + i}`).join(' ')};`
        : '';
      const content = Array.from({ length: level }, (_, i) => `counter(h${i + 1})`).join(' "." ');
      rules.push(`#write h${level} { counter-increment: h${level};${resets} }`);
      rules.push(`#write h${level}::before { content: ${content} " "; }`);
    }
  }

  if (values.justify === true) rules.push('#write p, #write li { text-align: justify; }');
  if (values.justify === false) rules.push('#write p, #write li { text-align: initial; }');

  if (values.listMarker && ['disc', 'circle', 'square'].includes(values.listMarker)) {
    rules.push(`#write ul { list-style-type: ${values.listMarker}; }`);
  }
  if (values.orderedMarker) {
    rules.push(`#write ol { list-style-type: ${values.orderedMarker}; }`);
  }
  if (values.bodyFont) rules.push(`#write { font-family: ${values.bodyFont}; }`);
  if (values.codeFont) rules.push(`#write code, #write pre, #write .md-fences-gutter { font-family: ${values.codeFont}; }`);
  if (values.background) rules.push(`#write { background-color: ${values.background}; }`);
  if (values.lineHeight) rules.push(`#write { line-height: ${values.lineHeight}; }`);
  if (values.paragraphGap) rules.push(`#write p { margin-bottom: ${values.paragraphGap}; }`);

  return rules.join('\n');
};

const setAttr = (el: HTMLElement, name: string, on: boolean) => {
  if (on) el.setAttribute(name, 'true');
  else el.removeAttribute(name);
};

export const applyLayoutCss = (options: any): void => {
  const values = typographyOverrides(options);
  const write = document.getElementById('write') as HTMLElement | null;
  const root = document.documentElement;

  if (write) {
    if (values.direction) write.setAttribute('data-direction', values.direction);
    else write.removeAttribute('data-direction');
    if (values.headingNumbering === null) write.removeAttribute('data-heading-numbering');
    else write.setAttribute('data-heading-numbering', values.headingNumbering ? 'true' : 'false');
    if (values.justify === null) write.removeAttribute('data-tl-justify');
    else write.setAttribute('data-tl-justify', values.justify ? 'true' : 'false');
    setAttr(write, 'data-tl-font', !!values.bodyFont);
    setAttr(write, 'data-tl-code-font', !!values.codeFont);
    setAttr(write, 'data-tl-bg', !!values.background);
    setAttr(write, 'data-tl-line-height', !!values.lineHeight);
    setAttr(write, 'data-tl-paragraph-gap', !!values.paragraphGap);
    setAttr(write, 'data-tl-list-marker', !!values.listMarker);
    setAttr(write, 'data-tl-ordered-marker', !!values.orderedMarker);
  }

  const vars: Record<string, string | null> = {
    '--tl-body-font': values.bodyFont,
    '--tl-code-font': values.codeFont,
    '--tl-editor-bg': values.background,
    '--tl-line-height': values.lineHeight,
    '--tl-paragraph-gap': values.paragraphGap,
    '--tl-list-marker': values.listMarker,
    '--tl-ordered-marker': values.orderedMarker,
  };
  for (const [name, value] of Object.entries(vars)) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }

  const css = buildLayoutCss(options);
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    existing?.remove();
    return;
  }
  const el = existing ?? document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  // Keep it last so explicit overrides win over theme rules at equal specificity.
  document.head.appendChild(el);
};

/** Clear attributes/variables when the editor unmounts. */
export const clearLayoutCss = (): void => {
  const write = document.getElementById('write');
  if (write) ROOT_ATTRS.forEach(attr => write.removeAttribute(attr));
  ROOT_VARS.forEach(name => document.documentElement.style.removeProperty(name));
  document.getElementById(STYLE_ID)?.remove();
};
