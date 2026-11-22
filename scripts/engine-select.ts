/**
 * Unit checks for the view decision (source-mode fallback).
 * Usage: bun scripts/engine-select.ts
 */
import { LARGE_DOC_LIMIT, resolveView } from '../src/components/Editor/engine';
import { parseDocumentExport } from '../src/services/docExport';
import { buildSearchUrl } from '../src/services/searchWeb';
import { applyListIndentation } from '../src/services/markdown/listFormat';
import { parseFrontmatter } from '../src/services/frontmatter';
import { extractWords } from '../src/components/MilkdownEditor/spellcheck';
import { finalizeImagePath, resolveMediaPath, imageDirectory } from '../src/services/imagePaths';
import { mediaKindForPath } from '../src/services/media';
import { buildExportLayoutCss, buildLayoutCss, typographyOverrides } from '../src/services/layoutCss';
import { extractImageRefs, replaceImageSrc, localImagePath, imageMarkdownSrc } from '../src/services/imageManager';
import { shouldOfferDraft } from '../src/services/draft';
import { removeTocMarker, stripFrontmatter } from '../src/services/printSettings';
import { buildCoverHtml, buildPrintCss, buildTocHtml, defaultPrintSettings, normalizePrintSettings, paperSizeMm } from '../src/services/printSettings';
import { acceleratorFromEvent, defaultShortcut } from '../src/services/shortcuts';

const nestedList = `- a
  - b
    - c
- d`;

const withExport = parseDocumentExport(`---
title: Release\nexport:
  fileName: notes.html
  includeToc: false
  includeCss: true
  postAction: open-file
---

# Body
`);

const small = 1_000;
const large = LARGE_DOC_LIMIT + 1;
const oneMb = 1024 * 1024;

const cases: [string, boolean][] = [
  ['small documents use WYSIWYG', (() => {
    const v = resolveView(small, false);
    return v.sourceMode === false && v.autoSource === false;
  })()],
  ['small documents honour the source toggle', (() => {
    const v = resolveView(small, true);
    return v.sourceMode === true && v.autoSource === false;
  })()],
  ['large documents open in source mode', (() => {
    const v = resolveView(large, false);
    return v.sourceMode === true && v.autoSource === true;
  })()],
  ['a 1MB document opens in source mode', (() => {
    const v = resolveView(oneMb, false);
    return v.sourceMode === true && v.autoSource === true;
  })()],
  ['shift+F override shows WYSIWYG', (() => {
    const v = resolveView(large, false, true);
    return v.sourceMode === false && v.autoSource === false;
  })()],
  ['limit is 200K characters', LARGE_DOC_LIMIT === 200 * 1024],
  ['front matter export block is parsed', withExport.fileName === 'notes.html' && withExport.postAction === 'open-file'],
  ['front matter booleans keep their type', withExport.includeToc === false && withExport.includeCss === true],
  ['export keys outside the block are ignored', parseDocumentExport('---\ntitle: x\n---\n# Body').includeToc === undefined],
  ['documents without front matter have no overrides', Object.keys(parseDocumentExport('# Body')).length === 0],
  ['search URL replaces %s', buildSearchUrl('a b', 'https://example.com?q=%s') === 'https://example.com?q=a%20b'],
  ['search URL appends without %s', buildSearchUrl('a b', 'https://example.com?q=') === 'https://example.com?q=a%20b'],
  ['search URL falls back to the default', buildSearchUrl('x', '') === 'https://www.google.com/search?q=x'],
  ['list indentation 1 keeps the output', applyListIndentation(nestedList, 1) === nestedList],
  ['list indentation 3 adds two spaces per level', applyListIndentation(nestedList, 3) === `- a
    - b
        - c
- d`],
  ['list indentation leaves fenced code alone', applyListIndentation('- a\n  ```\n  - not a list\n  ```', 3) === '- a\n  ```\n  - not a list\n  ```'],
  ['dfm indentation targets four columns', applyListIndentation(nestedList, 'dfm') === `- a
    - b
        - c
- d`],
  ['YAML front matter is read', (() => {
    const info = parseFrontmatter('---\ntitle: "Notes"\ntags: [a, b]\ndraft: true\n---\n# Body');
    return info.format === 'yaml' && info.data.title === 'Notes' && info.data.draft === true
      && Array.isArray(info.data.tags) && info.data.tags.length === 2;
  })()],
  ['YAML lists are collected', (() => {
    const info = parseFrontmatter('---\naliases:\n  - one\n  - two\n---\n');
    return Array.isArray(info.data.aliases) && info.data.aliases.join(',') === 'one,two';
  })()],
  ['TOML front matter is read', (() => {
    const info = parseFrontmatter('+++\ntitle = "Toml"\ncount = 3\n+++\n');
    return info.format === 'toml' && info.data.title === 'Toml' && info.data.count === 3;
  })()],
  ['documents without front matter are empty', parseFrontmatter('# Body').format === 'none'],
  ['image paths become relative with ./', finalizeImagePath('/docs/notes/images/a.png', '/docs/notes', {
    preferRelativeImagePaths: true, dotSlashImagePaths: true,
  }) === './images/a.png'],
  ['image paths can omit ./', finalizeImagePath('/docs/notes/images/a.png', '/docs/notes', {
    preferRelativeImagePaths: true, dotSlashImagePaths: false,
  }) === 'images/a.png'],
  ['image paths encode spaces', finalizeImagePath('/docs/notes/my image.png', '/docs/notes', {
    preferRelativeImagePaths: true, autoEncodeImageURL: true,
  }) === './my%20image.png'],
  ['image copy directory honours an absolute path', imageDirectory('/docs/notes', '/var/pics') === '/var/pics'],
  ['image copy directory defaults to images', imageDirectory('/docs/notes', '') === '/docs/notes/images'],
  ['typora-root-url resolves against the document folder', resolveMediaPath('pic.png', '/docs/notes', 'assets') === '/docs/notes/assets/pic.png'],
  ['typora-root-url accepts a URL root', resolveMediaPath('pic.png', '/docs/notes', 'https://cdn.example.com/img') === 'https://cdn.example.com/img/pic.png'],
  ['absolute sources ignore typora-root-url', resolveMediaPath('https://x.test/a.png', '/docs', 'assets') === 'https://x.test/a.png'],
  ['media kinds come from extensions', mediaKindForPath('/example/a.PNG') === 'image'
    && mediaKindForPath('/example/movie.mp4') === 'video' && mediaKindForPath('/example/song.mp3') === 'audio'],
  ['non-media drops are not classified', mediaKindForPath('/example/notes.md') === null],
  ['typography inherits the theme by default', buildLayoutCss({ textDirection: '', headingNumbering: 'inherit', justifyText: 'inherit' }) === ''],
  ['typography explicit values are emitted', (() => {
    const css = buildExportLayoutCss({ textDirection: 'rtl', bodyFont: 'Georgia, serif', lineHeight: 1.8, paragraphGap: '1em', listMarker: 'square' });
    return css.includes('direction: rtl') && css.includes('font-family: Georgia, serif')
      && css.includes('line-height: 1.8') && css.includes('margin-bottom: 1em')
      && css.includes('list-style-type: square');
  })()],
  ['typography explicit off disables heading counters', (() => {
    const values = typographyOverrides({ headingNumbering: 'off', justifyText: 'off' });
    return values.headingNumbering === false && values.justify === false
      && buildLayoutCss({ headingNumbering: 'off' }).includes('content: none');
  })()],
  ['image refs are extracted and deduplicated', (() => {
    const refs = extractImageRefs('![a](./a.png)\n![b](https://x.test/b.png)\n<img src="c.png">\n![again](./a.png)');
    return refs.length === 3 && refs[0].kind === 'local' && refs[1].kind === 'remote';
  })()],
  ['image refs rewrite both syntaxes', (() => {
    const next = replaceImageSrc('![a](old.png)\n<img src="old.png">', 'old.png', './new.png');
    return next.includes('![a](./new.png)') && next.includes('src="./new.png"');
  })()],
  ['local image paths resolve against the document', localImagePath('./images/a.png', '/docs') === '/docs/images/a.png'],
  ['image markdown path is relative', imageMarkdownSrc('/docs/images/a.png', '/docs') === './images/a.png'],
  ['print defaults are A4 with Chinese official margins', (() => {
    const values = defaultPrintSettings();
    return values.paper === 'A4' && values.margins.top === 25.4
      && values.margins.left === 31.8 && values.margins.right === 31.8
      && paperSizeMm(values)[0] === 210 && paperSizeMm(values)[1] === 297
      && paperSizeMm({ ...values, orientation: 'landscape' })[0] === 297;
  })()],
  ['print settings normalize and clamp', (() => {
    const values = normalizePrintSettings({ paper: 'A3', fontSize: 99, margins: { top: -5, left: 20 }, toc: { depth: 12 }, pageStart: 0 });
    return values.paper === 'A3' && values.fontSize === 30 && values.margins.top === 0
      && values.margins.left === 20 && values.toc.depth === 6 && values.pageStart === 1;
  })()],
  ['print css emits page, margins and headers', (() => {
    const css = buildPrintCss({ ...defaultPrintSettings(), headerFooter: { ...defaultPrintSettings().headerFooter, headerCenter: '{title}', footerCenter: '{page} / {total}' } });
    return css.includes('size: 210mm 297mm') && css.includes('margin: 25.4mm 31.8mm 25.4mm 31.8mm')
      && css.includes('@top-center') && css.includes('counter(page)')
      && css.includes('target-counter') && css.includes('break-after: page')
      && css.includes('counter-h1') === false;
  })()],
  ['print heading numbering uses counters', (() => {
    const css = buildPrintCss({ ...defaultPrintSettings(), headingNumbering: true });
    return css.includes('counter(h1)') && css.includes('counter(h2)') && css.includes('counter-increment: h1');
  })()],
  ['print page number format is applied', (() => {
    const css = buildPrintCss({ ...defaultPrintSettings(), pageNumberFormat: 'roman' });
    return css.includes('counter(page, lower-roman)');
  })()],
  ['print strips front matter and TOC marker', (() => {
    const stripped = stripFrontmatter('---\ntitle: X\n---\n# H\n');
    return stripped === '# H\n' && removeTocMarker('# A\n\n[TOC]\n\n# B') === '# A\n\n# B';
  })()],
  ['print cover and toc escape content', (() => {
    const cover = buildCoverHtml({ ...defaultPrintSettings(), cover: { enabled: true, title: 'A & B', subtitle: '', author: 'C', date: '' } });
    const toc = buildTocHtml(defaultPrintSettings(), [{ level: 1, id: 'x', text: 'One <two>' }]);
    return cover.includes('print-cover-page') && cover.includes('A &amp; B')
      && toc.includes('href="#x"') && toc.includes('One &lt;two&gt;');
  })()],
  ['draft is offered only when recent and different', (() => {
    const now = 1_700_000_000_000;
    return shouldOfferDraft({ content: 'a', savedAt: now - 1000 }, 'b', now)
      && !shouldOfferDraft({ content: 'a', savedAt: now - 1000 }, 'a', now)
      && !shouldOfferDraft({ content: 'a', savedAt: now - 10 * 24 * 3600 * 1000 }, 'b', now)
      && !shouldOfferDraft(null, 'b', now);
  })()],
  ['shortcuts build accelerators from events', (() => {
    const event = { key: 'K', metaKey: false, ctrlKey: true, altKey: true, shiftKey: true } as KeyboardEvent;
    return acceleratorFromEvent(event) === 'CmdOrCtrl+Alt+Shift+K'
      && acceleratorFromEvent({ key: 'Control', ctrlKey: true } as KeyboardEvent) === ''
      && acceleratorFromEvent({ key: 'k', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as KeyboardEvent) === ''
      && defaultShortcut('save') === 'CmdOrCtrl+S'
      && defaultShortcut('nope') === '';
  })()],
  ['spellcheck extracts unique words', (() => {
    const words = extractWords('teh quikc teh Typeleft — done');
    return words.includes('teh') && words.includes('quikc') && words.includes('Typeleft')
      && words.filter(w => w === 'teh').length === 1;
  })()],
];

let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed ? '\nENGINE TESTS FAILED' : '\nENGINE TESTS PASSED');
process.exit(failed ? 1 : 0);
