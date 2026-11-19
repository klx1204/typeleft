/**
 * Unit checks for the engine fallback decision.
 * Usage: bun scripts/engine-select.ts
 */
import { LARGE_DOC_LIMIT, resolveEngine } from '../src/components/Editor/engine';

const cases: [string, boolean][] = [
  ['defaults to milkdown for small documents', resolveEngine(undefined, 1_000) === 'milkdown'],
  ['honours an explicit muya setting', resolveEngine('muya', 1_000) === 'muya'],
  ['keeps milkdown at the limit', resolveEngine('milkdown', LARGE_DOC_LIMIT) === 'milkdown'],
  ['falls back above the limit', resolveEngine('milkdown', LARGE_DOC_LIMIT + 1) === 'muya'],
  ['falls back for a 1MB document', resolveEngine(undefined, 1024 * 1024) === 'muya'],
  ['limit is 200K characters', LARGE_DOC_LIMIT === 200 * 1024],
];

let failed = 0;
for (const [name, ok] of cases) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
console.log(failed ? '\nENGINE TESTS FAILED' : '\nENGINE TESTS PASSED');
process.exit(failed ? 1 : 0);
