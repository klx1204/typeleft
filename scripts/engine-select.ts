/**
 * Unit checks for the view decision (source-mode fallback).
 * Usage: bun scripts/engine-select.ts
 */
import { LARGE_DOC_LIMIT, resolveView } from '../src/components/Editor/engine';
import { parseDocumentExport } from '../src/services/docExport';
import { buildSearchUrl } from '../src/services/searchWeb';

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
];

let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed ? '\nENGINE TESTS FAILED' : '\nENGINE TESTS PASSED');
process.exit(failed ? 1 : 0);
