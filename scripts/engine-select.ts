/**
 * Unit checks for the view decision (engine + source-mode fallback).
 * Usage: bun scripts/engine-select.ts
 */
import { LARGE_DOC_LIMIT, resolveView } from '../src/components/Editor/engine';

const small = 1_000;
const large = LARGE_DOC_LIMIT + 1;
const oneMb = 1024 * 1024;

const cases: [string, boolean][] = [
  ['defaults to milkdown for small documents', (() => {
    const v = resolveView(undefined, small, false);
    return v.engine === 'milkdown' && v.sourceMode === false && v.autoSource === false;
  })()],
  ['keeps the user source-mode choice for small documents', (() => {
    const v = resolveView('milkdown', small, true);
    return v.sourceMode === true && v.autoSource === false;
  })()],
  ['opens large documents in source mode', (() => {
    const v = resolveView('milkdown', large, false);
    return v.engine === 'milkdown' && v.sourceMode === true && v.autoSource === true;
  })()],
  ['opens a 1MB document in source mode', (() => {
    const v = resolveView(undefined, oneMb, false);
    return v.sourceMode === true && v.autoSource === true;
  })()],
  ['shift+F override shows WYSIWYG', (() => {
    const v = resolveView('milkdown', large, false, true);
    return v.sourceMode === false && v.autoSource === false;
  })()],
  ['explicit muya is respected', (() => {
    const v = resolveView('muya', large, false);
    return v.engine === 'muya' && v.sourceMode === false && v.autoSource === false;
  })()],
  ['muya still honours the source setting', (() => {
    const v = resolveView('muya', small, true);
    return v.engine === 'muya' && v.sourceMode === true;
  })()],
  ['limit is 200K characters', LARGE_DOC_LIMIT === 200 * 1024],
];

let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed ? '\nENGINE TESTS FAILED' : '\nENGINE TESTS PASSED');
process.exit(failed ? 1 : 0);
