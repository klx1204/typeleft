/**
 * Unit checks for the view decision (source-mode fallback).
 * Usage: bun scripts/engine-select.ts
 */
import { LARGE_DOC_LIMIT, resolveView } from '../src/components/Editor/engine';

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
];

let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed ? '\nENGINE TESTS FAILED' : '\nENGINE TESTS PASSED');
process.exit(failed ? 1 : 0);
