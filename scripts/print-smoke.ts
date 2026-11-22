/**
 * Print/PDF smoke: build a representative print document (cover, TOC, CJK,
 * table, code, long paragraphs), then ask headless Chrome for a PDF and check
 * that it produced pages. Works without Pandoc or a TeX engine, so it can run
 * on any machine with Chrome.
 *
 * Usage: bun scripts/print-smoke.ts [chrome-path]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildCoverHtml,
  buildPrintCss,
  buildTocHtml,
  defaultPrintSettings,
  type PrintHeading,
} from '../src/services/printSettings';

const renderer = process.env.PDF_RENDERER || 'chrome';
const candidates = [
  process.argv[2],
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean) as string[];
const chrome = candidates.find(candidate => existsSync(candidate));
if (renderer === 'chrome' && !chrome) {
  console.error('print smoke: Chrome/Chromium not found (set CHROME or PDF_RENDERER=weasyprint)');
  process.exit(1);
}
if (renderer === 'weasyprint' && !spawnSync('weasyprint', ['--version']).status) {
  console.error('print smoke: weasyprint not found');
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'typeleft-print-'));
const settings = {
  ...defaultPrintSettings(),
  cover: {
    enabled: true,
    title: 'Typeleft Print Smoke',
    subtitle: 'Cover, TOC, tables, code and CJK',
    author: 'Typeleft contributors',
    date: '2026-11-22',
  },
  toc: { enabled: true, title: 'Contents', depth: 3, pageNumbers: true },
  headingNumbering: true,
};

const headings: PrintHeading[] = [
  { level: 1, id: 'intro', text: 'Introduction' },
  { level: 2, id: 'scope', text: 'Scope' },
  { level: 1, id: 'cjk', text: '中文排版检查' },
  { level: 2, id: 'table', text: 'Table and code' },
];

const rows = Array.from({ length: 48 }, (_, index) =>
  `<tr><td>${index + 1}</td><td>Row ${index + 1} — 表格跨页检查</td><td>${(index * 7) % 31}</td></tr>`,
).join('');

const article = `
<article class="markdown-body"><div id="write"><h1 id="intro">Introduction</h1>
<p>${'This paragraph checks justification, widows and orphans across page boundaries. '.repeat(8)}</p>
<h2 id="scope">Scope</h2>
<p>Print CSS, page size, margins, running headers and footers, a linked table of contents, cover page and metadata.</p>
<h1 id="cjk">中文排版检查</h1>
<p>${'这是一段用于检查中文公文版式、首行缩进、两端对齐以及跨页效果的文字。'.repeat(10)}</p>
<h2 id="table">Table and code</h2>
<table><thead><tr><th>#</th><th>Description</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
<pre><code class="language-js">const answer = 42;
console.log('print smoke', answer);
</code></pre>
<p>End of the sample.</p></div></article>`;

const document = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Typeleft Print Smoke</title>
<meta name="author" content="Typeleft contributors">
<style>${buildPrintCss(settings)}</style>
</head><body>
${buildCoverHtml(settings)}
${buildTocHtml(settings, headings)}
${article}
</body></html>`;

const htmlPath = join(dir, 'print-sample.html');
const pdfPath = join(dir, 'print-sample.pdf');
writeFileSync(htmlPath, document);

const result = renderer === 'weasyprint'
  ? spawnSync('weasyprint', [htmlPath, pdfPath], { encoding: 'utf8' })
  : spawnSync(chrome as string, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ], { encoding: 'utf8' });

if (result.status !== 0) {
  console.error(`print smoke: chrome exited ${result.status}`);
  console.error(result.stderr?.slice(-800));
  process.exit(1);
}
const pdf = readFileSync(pdfPath);
const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
const size = statSync(pdfPath).size;
const htmlSize = statSync(htmlPath).size;
console.log(`print smoke: html ${htmlSize} bytes, pdf ${size} bytes, ${pages} page objects`);
console.log(`sample: ${htmlPath}`);
console.log(`pdf:    ${pdfPath}`);
if (size < 20_000 || (pages > 0 && pages < 2)) {
  console.error('print smoke: PDF looks empty');
  process.exit(1);
}
console.log('PRINT SMOKE PASSED');
