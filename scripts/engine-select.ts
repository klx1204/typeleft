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
