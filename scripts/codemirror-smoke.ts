/**
 * Headless smoke test for the CodeMirror 6 source-mode configuration.
 * Mirrors the extensions used by `src/components/CodeMirror6/index.tsx` and
 * exercises editing + search/replace without the desktop app.
 *
 * Usage: bun scripts/codemirror-smoke.ts
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
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
(win as any).requestAnimationFrame = g.requestAnimationFrame;
(win as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
g.cancelAnimationFrame = (win as any).cancelAnimationFrame;
g.innerHeight = 800;
g.innerWidth = 1200;
const MO = (win as any).MutationObserver ?? class { observe() {} disconnect() {} takeRecords() { return []; } };
g.MutationObserver = MO;
(win as any).MutationObserver = MO;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const selectionStub: any = {
  anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0,
  rangeCount: 0, isCollapsed: true, type: 'None',
  addRange() {}, removeAllRanges() {}, collapse() {}, extend() {},
  getRangeAt() { return { startContainer: win.document.body, startOffset: 0, endContainer: win.document.body, endOffset: 0 }; },
  setBaseAndExtent() {}, modify() {},
};
g.getSelection = () => selectionStub;
(win as any).getSelection = () => selectionStub;
(win.document as any).getSelection = () => selectionStub;
(win.document as any).hasFocus = () => true;
try { (Object.getPrototypeOf(win.document) as any).hasFocus = () => true; } catch { /* ignore */ }

const { EditorState } = await import('@codemirror/state');
const { EditorView, lineNumbers, highlightActiveLine, keymap } = await import('@codemirror/view');
const { defaultKeymap, history, historyKeymap, undo } = await import('@codemirror/commands');
const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown');
const { languages } = await import('@codemirror/language-data');
const { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } = await import('@codemirror/language');
const { search, setSearchQuery, findNext, replaceNext, replaceAll, SearchQuery, getSearchQuery } = await import('@codemirror/search');

const source = `# Title

中文段落 with **bold** and \`code\`.

- item one
- item two

\`\`\`js
const x = 1;
\`\`\`
`;

const root = win.document.getElementById('root');
const view = new EditorView({
  parent: root,
  state: EditorState.create({
    doc: source,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      search({ top: true }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
    ],
  }),
});

const fail = (message: string) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const assert = (condition: boolean, message: string) => {
  if (condition) console.log(`ok: ${message}`);
  else fail(message);
};

assert(view.state.doc.toString() === source, 'document loads unchanged');

// Typing
view.dispatch({ changes: { from: view.state.doc.length, insert: '\nAppended 中文。' } });
assert(view.state.doc.toString().endsWith('Appended 中文。'), 'insertion with CJK text');
undo(view);
assert(!view.state.doc.toString().includes('Appended'), 'undo removes the insertion');
view.dispatch({ changes: { from: view.state.doc.length, insert: '\nAppended 中文。' } });

// Search
const query = new SearchQuery({ search: 'item', caseSensitive: false });
view.dispatch({ effects: setSearchQuery.of(query) });
assert(getSearchQuery(view.state).search === 'item', 'search query stored');
findNext(view);
assert(!view.state.selection.main.empty, 'findNext selects a match');

// Replace all
replaceAll(view);
assert(!view.state.doc.toString().includes('- item'), 'replaceAll without replacement text removes matches');

view.destroy();
console.log(process.exitCode ? '\nSMOKE TEST FAILED' : '\nSMOKE TEST PASSED');
