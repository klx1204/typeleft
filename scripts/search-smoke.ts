/**
 * Search / replace smoke tests (cross-node matches, capture groups).
 * Usage: bun scripts/search-smoke.ts
 */
import domino from 'domino';

const win: any = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');
const zero = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
(win.Element.prototype as any).getBoundingClientRect = () => ({ ...zero });
(win.Element.prototype as any).getClientRects = () => [];
(win.Element.prototype as any).scrollIntoView = () => {};
(win.document as any).elementFromPoint = () => null;
const g: any = globalThis;
g.window = win;
g.document = win.document;
g.navigator = win.navigator ?? { userAgent: 'domino' };
g.Node = win.Node;
g.Element = win.Element;
g.HTMLElement = win.HTMLElement;
g.Text = win.Text;
g.DocumentFragment = win.DocumentFragment;
const MO = (win as any).MutationObserver ?? class { observe() {} disconnect() {} takeRecords() { return []; } };
g.MutationObserver = MO;
(win as any).MutationObserver = MO;
const selectionStub: any = {
  anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0,
  rangeCount: 0, isCollapsed: true, type: 'None',
  addRange() {}, removeAllRanges() {}, collapse() {}, extend() {},
  getRangeAt() { return {}; }, setBaseAndExtent() {}, modify() {},
};
g.getSelection = () => selectionStub;
(win as any).getSelection = () => selectionStub;
(win.document as any).getSelection = () => selectionStub;
(win.document as any).hasFocus = () => true;
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
(win as any).requestAnimationFrame = g.requestAnimationFrame;
g.innerHeight = 800;
g.innerWidth = 1200;
g.scrollY = 0;
g.scrollX = 0;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const { Editor, rootCtx, defaultValueCtx, editorViewCtx } = await import('@milkdown/kit/core');
const { commonmark } = await import('@milkdown/kit/preset/commonmark');
const { gfm } = await import('@milkdown/kit/preset/gfm');
const { searchPlugin, setSearchQuery, getSearchState, findNextMatch, replaceCurrentMatch, replaceAllMatches } = await import(
  '../src/components/MilkdownEditor/search'
);

const root = win.document.getElementById('root');
const editor = await Editor.make()
  .config((ctx: any) => {
    ctx.set(rootCtx, root);
    ctx.set(defaultValueCtx, 'ab**cd**ef\n\nregex 123 and 456');
  })
  .use(commonmark)
  .use(gfm)
  .use(searchPlugin)
  .create();

const view: any = editor.action((ctx: any) => ctx.get(editorViewCtx));

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed += 1;
};

// 1. Match spanning a mark: "abcd" is split across a plain and a bold node.
const count = setSearchQuery(view, 'abcd', {});
check('cross-node match', count === 1, `${count} matches`);
const state = getSearchState(view);
const match = state?.matches[0];
check('cross-node range covers both nodes', !!match && match.to - match.from === 4, match ? `${match.from}-${match.to}` : 'none');

// 2. Regex with a capture group, expanded through $1.
setSearchQuery(view, '([a-z]+)cd', { regexp: true });
replaceCurrentMatch(view, '$1-X');
const afterReplace = view.state.doc.textContent;
check('regex $1 replacement', afterReplace.includes('ab-X'), JSON.stringify(afterReplace.slice(0, 20)));

// 3. $& keeps the whole match.
setSearchQuery(view, 'ef', {});
replaceCurrentMatch(view, '[$&]');
check('regex $& replacement', view.state.doc.textContent.includes('[ef]'), JSON.stringify(view.state.doc.textContent.slice(0, 30)));

// 4. replaceAll over multiple matches.
setSearchQuery(view, '\\d+', { regexp: true });
const replaced = replaceAllMatches(view, 'N');
check('replaceAll', replaced === 2 && view.state.doc.textContent.includes('N and N'), `${replaced} replaced`);

await editor.destroy();
console.log(failed ? '\nSEARCH TESTS FAILED' : '\nSEARCH TESTS PASSED');
process.exit(failed ? 1 : 0);
