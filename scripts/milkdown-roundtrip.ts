/**
 * Headless markdown round-trip harness for the Milkdown engine.
 *
 * Runs Milkdown's parser + serializer (the same presets and custom remark
 * plugins the app uses) inside a Domino DOM, so round-trip differences can be
 * measured without launching the desktop app.
 *
 * Usage: bun scripts/milkdown-roundtrip.ts <file.md> [more.md ...]
 */
import domino from 'domino';

const win: any = domino.createWindow('<!doctype html><html><body><div id="root"></div></body></html>');

class MutationObserverStub {
  observe() { /* noop */ }
  disconnect() { /* noop */ }
  takeRecords() { return []; }
}

// Domino has no layout engine: provide the geometry APIs ProseMirror touches.
const zeroRect = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
(win.Element.prototype as any).getBoundingClientRect = () => ({ ...zeroRect });
(win.Element.prototype as any).getClientRects = () => [];
(win.Element.prototype as any).scrollIntoView = () => {};
(win.Element.prototype as any).scrollTo = () => {};
(win.HTMLElement.prototype as any).offsetHeight = 0;
(win.HTMLElement.prototype as any).offsetWidth = 0;
(win.document as any).elementFromPoint = () => null;
try {
  Object.defineProperty(win.document, 'readyState', { get: () => 'complete', configurable: true });
} catch { /* ignore */ }
(win.document as any).hasFocus = () => true;

const g: any = globalThis;
g.window = win;
g.document = win.document;
g.navigator = win.navigator ?? { userAgent: 'domino' };
g.Node = win.Node;
g.Element = win.Element;
g.HTMLElement = win.HTMLElement;
g.HTMLDivElement = win.HTMLDivElement ?? win.HTMLElement;
g.Text = win.Text;
g.DocumentFragment = win.DocumentFragment;
g.MutationObserver = (win as any).MutationObserver ?? MutationObserverStub;
g.getSelection = () => win.getSelection();
g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
g.innerHeight = 800;
g.innerWidth = 1200;
g.pageYOffset = 0;
g.pageXOffset = 0;
g.scrollY = 0;
g.scrollX = 0;
g.scrollBy = () => {};
g.scrollTo = () => {};
// Milkdown's timers dispatch CustomEvents on the global object.
const eventTarget = new EventTarget();
g.addEventListener = eventTarget.addEventListener.bind(eventTarget);
g.removeEventListener = eventTarget.removeEventListener.bind(eventTarget);
g.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget);
g.CustomEvent = CustomEvent;
g.Event = Event;
g.cancelAnimationFrame = (id: any) => clearTimeout(id);
g.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.DOMRect = win.DOMRect ?? class { constructor(public x = 0, public y = 0, public width = 0, public height = 0) {} top = 0; left = 0; right = 0; bottom = 0; };

const { Editor, rootCtx, defaultValueCtx, remarkStringifyOptionsCtx } = await import('@milkdown/kit/core');
const { commonmark } = await import('@milkdown/kit/preset/commonmark');
const { gfm } = await import('@milkdown/kit/preset/gfm');
const { history } = await import('@milkdown/kit/plugin/history');
const { getMarkdown } = await import('@milkdown/kit/utils');
const { frontmatterNode, frontmatterRemark } = await import('../src/components/MilkdownEditor/nodes/frontmatter');
const { mathRemark, inlineMathNode, blockMathNode, inlineMathView, blockMathView } = await import('../src/components/MilkdownEditor/nodes/math');
const { createImageView } = await import('../src/components/MilkdownEditor/nodes/image');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: bun scripts/milkdown-roundtrip.ts <file.md> [...]');
  process.exit(1);
}

const normalize = (text: string) => text.replace(/\r\n/g, '\n');

let failures = 0;

for (const file of files) {
  const source = normalize(await Bun.file(file).text());
  const root = win.document.getElementById('root');
  root.innerHTML = '';

  const editor = await Editor.make()
    .config((ctx: any) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, source);
      ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
        ...prev,
        bullet: '-',
        rule: '-',
        fence: '`',
        listItemIndent: 'one',
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(frontmatterRemark)
    .use(frontmatterNode)
    .use(mathRemark)
    .use(inlineMathNode)
    .use(blockMathNode)
    .use(inlineMathView)
    .use(blockMathView)
    .use(createImageView)
    .create();

  const output = editor.action(getMarkdown());

  if (file === files[0]) {
    const html = root.innerHTML;
    console.log(`dom: katex=${/class="katex/.test(html) ? 'yes' : 'NO'} img=${/<img/.test(html) ? 'yes' : 'NO'}`);
  }
  // Feed the serialized output back through the editor: a stable serializer
  // must be idempotent, otherwise repeated saves keep rewriting the file.
  const second = await Editor.make()
    .config((ctx: any) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, output);
      ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
        ...prev,
        bullet: '-',
        rule: '-',
        fence: '`',
        listItemIndent: 'one',
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(frontmatterRemark)
    .use(frontmatterNode)
    .use(mathRemark)
    .use(inlineMathNode)
    .use(blockMathNode)
    .use(inlineMathView)
    .use(blockMathView)
    .use(createImageView)
    .create();
  const secondOutput = second.action(getMarkdown());
  await second.destroy();
  await editor.destroy();

  const identical = output === source;
  if (!identical) failures += 1;
  console.log(`\n===== ${file} =====`);
  console.log(identical ? 'identical: yes' : 'identical: NO');
  console.log(secondOutput === output ? 'idempotent: yes' : 'idempotent: NO');
  if (!identical) {
    const outPath = `${file}.out.md`;
    await Bun.write(outPath, output);
    const diff = Bun.spawnSync(['diff', '-u', file, outPath], { stdout: 'pipe', stderr: 'pipe' });
    console.log(diff.stdout.toString());
  }
}

console.log(`\n${failures === 0 ? 'ALL IDENTICAL' : `${failures} file(s) changed`}`);
process.exit(0);
