import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  schemaCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import {
  commonmark,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  turnIntoTextCommand,
} from '@milkdown/kit/preset/commonmark';
import { gfm, insertTableCommand, toggleStrikethroughCommand, remarkGFMPlugin } from '@milkdown/kit/preset/gfm';
import remarkGfm from 'remark-gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { prism } from '@milkdown/plugin-prism';
import { $prose, $remark } from '@milkdown/kit/utils';
import { getMarkdown, replaceAll, callCommand } from '@milkdown/kit/utils';
import { Plugin, PluginKey, NodeSelection, Selection } from '@milkdown/kit/prose/state';
import {
  addRowAfter,
  addColumnAfter,
  deleteRow,
  deleteColumn,
  deleteTable,
  setCellAttr,
  isInTable,
} from '@milkdown/kit/prose/tables';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';
import '@milkdown/kit/prose/view/style/prosemirror.css';
import '@milkdown/kit/prose/tables/style/tables.css';
import 'katex/dist/katex.min.css';
import './theme.css';

import transport from 'services/transport';
import remote from 'services/remote/common';
import { processImage } from 'services/imageAction';
import { createApplicationMenuState } from 'services/menuState';
import { useI18n } from 'services/i18n';
import { frontmatterNode, frontmatterRemark, frontmatterView } from './nodes/frontmatter';
import { mathRemark, inlineMathNode, blockMathNode, inlineMathView, blockMathView } from './nodes/math';
import { marksRemark, highlightMark, superscriptMark, subscriptMark } from './nodes/marks';
import { createImageView, imageLayoutSchema, imageHtmlRemark } from './nodes/image';
import { createCodeBlockView } from './nodes/codeblock';
import { slashPlugin, setSlashCommandHandler } from './slash';
import {
  searchPlugin,
  setSearchQuery,
  findNextMatch,
  replaceCurrentMatch,
  replaceAllMatches,
  getSearchState,
} from './search';

interface IMilkdownEditor {
  markdown: string;
  cursor?: any;
  options: any;
  searchOpen: number;
  searchArg?: { value: string; opt: any };
  scrollTopRef: React.MutableRefObject<number>;
  onMarkdownChange: (markdown: string) => void;
  onCursorChange: (cursor: any) => void;
  onSearchArgChange: (arg: { value: string; opt: any } | undefined) => void;
  onSearchOpenChange?: (open: number) => void;
}

// GFM's single-tilde strikethrough would swallow `~subscript~`, so register
// remark-gfm ourselves with only `~~strikethrough~~` enabled.
const gfmPlugins = (gfm as any[]).filter(plugin => plugin !== remarkGFMPlugin);
const gfmRemark = $remark('remarkGFM', () => remarkGfm as any, { singleTilde: false } as any);

const focusKey = new PluginKey('TYPLEFT_FOCUS');
const focusPlugin = $prose(() => new Plugin({
  key: focusKey,
  props: {
    decorations(state) {
      const { $from } = state.selection;
      const depth = $from.depth > 0 ? 1 : 0;
      if (depth === 0) return null;
      const pos = $from.before(1);
      const node = state.doc.nodeAt(pos);
      if (!node) return null;
      return DecorationSet.create(state.doc, [
        Decoration.node(pos, pos + node.nodeSize, { class: 'has-focus' }),
      ]);
    },
  },
}));

const countWords = (text: string) => {
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latin = (text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .match(/[A-Za-z0-9_'-]+/g) ?? []).length;
  return { word: cjk + latin, character: text.replace(/\s+/g, '').length };
};

const MilkdownEditor: React.FC<IMilkdownEditor> = (props) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const markdownRef = useRef(props.markdown ?? '');
  const propsRef = useRef(props);
  propsRef.current = props;
  const [ready, setReady] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [formatState, setFormatState] = useState<Record<string, boolean>>({});
  const [tableBar, setTableBar] = useState<{ top: number; left: number } | null>(null);

  const getView = useCallback((): EditorView | null => {
    try {
      return editorRef.current?.action((ctx) => ctx.get(editorViewCtx)) ?? null;
    } catch {
      return null;
    }
  }, []);

  // ------------------------------------------------------------------ stats
  const emitState = useCallback((markdown: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const wordCount = countWords(markdown);
    // Read heading ids from the rendered DOM: Milkdown generates them at render
    // time, so the schema attributes alone are empty.
    requestAnimationFrame(() => {
      try {
        const root = containerRef.current;
        if (!root) return;
        const nodes = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[];
        const toc = nodes.map(el => ({
          content: el.textContent ?? '',
          lvl: Number(el.tagName.slice(1)),
          slug: el.id,
        }));
        let cur = 0;
        if (nodes.length) {
          const view = getView();
          const caretTop = view ? view.coordsAtPos(view.state.selection.head).top : 0;
          nodes.forEach((el, index) => {
            if (el.getBoundingClientRect().top <= caretTop + 4) cur = index;
          });
        }
        transport.postMessage('StateChange', { state: { wordCount, toc, cur }, milkdown: true });
      } catch {
        transport.postMessage('StateChange', { state: { wordCount, toc: [], cur: 0 }, milkdown: true });
      }
    });
  }, [getView]);

  const emitCursor = useCallback(() => {
    const view = getView();
    const editor = editorRef.current;
    if (!view || !editor) return;
    const { from, to, $from } = view.state.selection;
    try {
      const blockStart = $from.depth > 0 ? $from.start(1) : from;
      const before = blockStart > 0 ? editor.action(getMarkdown({ from: 0, to: blockStart })) : '';
      const lines = before ? before.split('\n') : [];
      const line = Math.max(0, lines.length - 1);
      const blockText = $from.parent.textBetween(0, $from.parentOffset, undefined, ' ');
      const cursor = { anchor: { line, ch: blockText.length }, focus: { line, ch: blockText.length } };
      propsRef.current.onCursorChange(cursor);
      const selectionText = from === to ? '' : view.state.doc.textBetween(from, to, '\n');
      const menuState = createApplicationMenuState({
        start: { key: line, block: { functionType: '' }, type: 'span' },
        end: { key: line, block: { functionType: '' }, type: 'span' },
        affiliation: buildAffiliation(view),
      });
      transport.postMessage('SelectionChange', { selection: cursor, menuState, selectionText });
    } catch (err) {
      console.error('[Milkdown] cursor sync failed', err);
    }
  }, [getView]);

  const emitFormats = useCallback(() => {
    const view = getView();
    if (!view) return;
    const { state } = view;
    const { from, to, $from } = state.selection;
    const formats: { type: string; tag: string }[] = [];
    const marks: [string, string][] = [
      ['strong', 'strong'],
      ['emphasis', 'em'],
      ['inlineCode', 'code'],
      ['link', 'a'],
      ['strikethrough', 'del'],
      ['highlight', 'mark'],
    ];
    for (const [name, tag] of marks) {
      const type = state.schema.marks[name];
      if (!type) continue;
      if (state.doc.rangeHasMark(from, to, type) || type.isInSet($from.marks())) {
        formats.push({ type, tag } as any);
      }
    }
    const next: Record<string, boolean> = {};
    for (const format of formats as any[]) next[format.type?.name ?? format.tag] = true;
    setFormatState(next);
    const simple = (formats as any[]).map((f) => ({ type: f.type?.name ?? f.tag, tag: f.tag }));
    transport.postMessage('SelectionFormats', { formats: simple });
  }, [getView]);

  const cursorTimerRef = useRef<number | undefined>(undefined);
  const scheduleCursor = useCallback(() => {
    if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = window.setTimeout(() => emitCursor(), 250);
  }, [emitCursor]);

  const handleSelectionChange = useCallback(() => {
    scheduleCursor();
    emitFormats();
    const view = getView();
    if (!view) return;
    const sel = view.state.selection;
    if (isInTable(view.state)) {
      try {
        const start = view.coordsAtPos(sel.from);
        setTableBar({ top: start.top + window.scrollY - 44, left: start.left });
      } catch {
        setTableBar(null);
      }
    } else {
      setTableBar(null);
    }
    if (sel.empty) {
      setToolbar(null);
      return;
    }
    try {
      const start = view.coordsAtPos(sel.from);
      const end = view.coordsAtPos(sel.to);
      const top = Math.min(start.top, end.top) + window.scrollY - 44;
      const left = (start.left + end.right) / 2;
      setToolbar({ top, left });
    } catch {
      setToolbar(null);
    }
    if (propsRef.current.options?.typewriter) {
      const coords = view.coordsAtPos(sel.head);
      const delta = coords.top - window.innerHeight / 2;
      if (Math.abs(delta) > 8) window.scrollBy(0, delta);
    }
  }, [scheduleCursor, emitFormats, getView]);

  // ------------------------------------------------------------- create once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const startedAt = performance.now();
    let cancelled = false;
    let editor: Editor | null = null;

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, el);
        ctx.set(defaultValueCtx, propsRef.current.markdown ?? '');
        // Keep source output close to what Typora/Muya write.
        ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
          ...prev,
          bullet: propsRef.current.options?.bulletListMarker || '-',
          rule: '-',
          fence: '`',
          listItemIndent: 'one',
        }));
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          markdownRef.current = markdown;
          propsRef.current.onMarkdownChange(markdown);
          emitState(markdown);
        });
      })
      .use(commonmark)
      .use(gfmPlugins)
      .use(gfmRemark)
      .use(history)
      .use(listener)
      .use(prism)
      .use(frontmatterRemark)
      .use(frontmatterNode)
      .use(frontmatterView)
      .use(marksRemark)
      .use(highlightMark)
      .use(superscriptMark)
      .use(subscriptMark)
      .use(mathRemark)
      .use(inlineMathNode)
      .use(blockMathNode)
      .use(inlineMathView)
      .use(blockMathView)
      .use(imageHtmlRemark)
      .use(imageLayoutSchema)
      .use(createImageView)
      .use(createCodeBlockView)
      .use(searchPlugin)
      .use(slashPlugin)
      .use(focusPlugin)
      .create()
      .then((instance) => {
        if (cancelled) {
          instance.destroy();
          return;
        }
        editor = instance;
        editorRef.current = instance;
        setReady(true);
        // A document starting with an atom (front matter, image, …) would open
        // with that node selected, which looks like a focus ring. Start in the
        // first text block instead.
        try {
          const view = instance.action((ctx) => ctx.get(editorViewCtx));
          if (view.state.selection instanceof NodeSelection) {
            const pos = Math.min(view.state.selection.to + 1, view.state.doc.content.size);
            const next = Selection.near(view.state.doc.resolve(pos), 1);
            if (next) view.dispatch(view.state.tr.setSelection(next));
          }
        } catch { /* ignore */ }
        const elapsed = Math.round(performance.now() - startedAt);
        (window as any).__milkdownReady = elapsed;
        transport.postMessage('SaveState', { status: `Milkdown ready ${elapsed}ms` });
        emitState(markdownRef.current);
        // Restore the cursor coming from source mode, if any.
        const anchor = propsRef.current.cursor?.anchor;
        if (anchor && typeof anchor.line === 'number') {
          requestAnimationFrame(() => restoreCursor(anchor.line));
        }
        requestAnimationFrame(() => {
          const view = getView();
          if (view) {
            window.scrollTo(window.scrollX, propsRef.current.scrollTopRef?.current ?? 0);
            try { view.focus(); } catch { /* ignore */ }
          }
        });
      })
      .catch((err) => {
        console.error('[Milkdown] create failed', err);
        transport.postMessage('SaveState', { status: `Milkdown error: ${String(err).slice(0, 60)}` });
        remote.unhandledException({ message: `MILKDOWN CREATE ERROR: ${String(err)}` }).catch(() => {});
      });

    return () => {
      cancelled = true;
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      editorRef.current = null;
      editor?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore a cursor by markdown line number (used when switching from CM6).
  const restoreCursor = useCallback((line: number) => {
    const editor = editorRef.current;
    const view = getView();
    if (!editor || !view) return;
    try {
      let acc = 0;
      let target: number | null = null;
      view.state.doc.forEach((node, offset) => {
        if (target !== null) return;
        const md = editor.action(getMarkdown({ from: offset, to: offset + node.nodeSize }));
        const lines = md.split('\n').length;
        if (line < acc + lines) target = offset + 1;
        acc += lines;
      });
      if (target !== null) {
        const pos = Math.min(target + 1, view.state.doc.content.size);
        view.dispatch(view.state.tr.setSelection(
          (view.state.selection.constructor as any).near(view.state.doc.resolve(pos))
        ));
        view.focus();
      }
    } catch (err) {
      console.error('[Milkdown] restore cursor failed', err);
    }
  }, [getView]);

  // -------------------------------------------------- external markdown sync
  useEffect(() => {
    const next = props.markdown ?? '';
    if (!ready) return;
    if (next === markdownRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    markdownRef.current = next;
    try {
      editor.action(replaceAll(next, true));
      emitState(next);
    } catch (err) {
      console.error('[Milkdown] replaceAll failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.markdown, ready]);

  // ------------------------------------------------------------ options sync
  useEffect(() => {
    document.body.style.setProperty('--editorAreaWidth', props.options?.editorAreaWidth ?? '860px');
    document.body.style.setProperty('--editorFontSize', props.options?.fontSize ?? '16px');
    document.body.style.setProperty('--editorLineHeight', String(props.options?.lineHeight ?? 1.6));
    const write = document.getElementById('write');
    if (write) write.classList.toggle('focus-mode', !!props.options?.focusMode);
    (window as any).typeleftEditorOptions = props.options;
    const view = getView();
    if (view) {
      view.dom.setAttribute('spellcheck', String(!!props.options?.spellcheckEnabled));
      view.dom.setAttribute('lang', props.options?.spellcheckLang || '');
    }
  }, [props.options, getView]);

  // -------------------------------------------------------------- scroll sync
  useEffect(() => {
    const onscroll = () => {
      if (props.scrollTopRef) props.scrollTopRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onscroll);
    return () => window.removeEventListener('scroll', onscroll);
  }, [props.scrollTopRef]);

  // --------------------------------------------------------------- selection
  useEffect(() => {
    if (!ready) return;
    const view = getView();
    if (!view) return;
    const handler = () => handleSelectionChange();
    view.dom.addEventListener('mouseup', handler);
    view.dom.addEventListener('keyup', handler);
    return () => {
      view.dom.removeEventListener('mouseup', handler);
      view.dom.removeEventListener('keyup', handler);
    };
  }, [ready, getView, handleSelectionChange]);

  // ------------------------------------------------------------------- menus
  const run = useCallback((command: any, payload?: any) => {
    const editor = editorRef.current;
    if (!editor) return false;
    // `$command` plugins expose the actual command key on `.key`; passing the
    // plugin object itself makes Milkdown look up a slice called "plugin".
    const key = command && command.key ? command.key : command;
    try {
      return editor.action(callCommand(key, payload));
    } catch (err) {
      console.error('[Milkdown] command failed', err);
      return false;
    }
  }, []);

  const withView = useCallback((fn: (view: EditorView, editor: Editor) => void) => {
    const editor = editorRef.current;
    const view = getView();
    if (!editor || !view) return;
    fn(view, editor);
  }, [getView]);

  const insertBlockMath = useCallback(() => {
    withView((view, editor) => {
      const type = editor.action((ctx) => ctx.get(schemaCtx).nodes['block_math']);
      if (!type) return;
      const node = type.create({ value: '' });
      view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
      view.focus();
    });
  }, [withView]);

  const toggleTaskList = useCallback(() => {
    withView((view) => {
      const { state } = view;
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'list_item') {
          const pos = $from.before(depth);
          const nextChecked = node.attrs.checked == null ? false : null;
          view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: nextChecked }));
          view.focus();
          return;
        }
      }
    });
  }, [withView]);

  const insertImageFromFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const src = await processImage(file, propsRef.current.options);
      if (src) run(insertImageCommand, { src });
    };
    input.click();
  }, [run]);

  useEffect(() => transport.addListener('Undo', () => {
    run(undoCommand);
  }), [run]);

  useEffect(() => transport.addListener('Redo', () => {
    run(redoCommand);
  }), [run]);

  useEffect(() => transport.addListener<string>('Format', (type) => {
    const commands: Record<string, any> = {
      bold: toggleStrongCommand,
      italic: toggleEmphasisCommand,
      inline_code: toggleInlineCodeCommand,
      strike: toggleStrikethroughCommand,
    };
    if (type === 'link') {
      const href = window.prompt('Link URL', 'https://');
      if (href) run(toggleLinkCommand, { href });
      return;
    }
    if (type === 'clear') {
      withView((view) => {
        const { state } = view;
        const { from, to } = state.selection;
        const tr = state.tr;
        for (const mark of state.storedMarks ?? state.doc.resolve(from).marks()) {
          tr.removeMark(from, to, mark.type);
        }
        const paragraph = state.schema.nodes.paragraph;
        tr.setBlockType(from, to, paragraph);
        view.dispatch(tr);
      });
      return;
    }
    const command = commands[type];
    if (command) run(command);
  }), [run, withView]);

  useEffect(() => transport.addListener<string>('UpdateParagraph', (type) => {
    if (type.startsWith('heading ')) {
      const level = Number(type.split(' ')[1] ?? 1);
      run(wrapInHeadingCommand, level);
      return;
    }
    switch (type) {
      case 'blockquote': run(wrapInBlockquoteCommand); break;
      case 'pre': run(createCodeBlockCommand); break;
      case 'ol-order': run(wrapInOrderedListCommand); break;
      case 'ul-bullet': run(wrapInBulletListCommand); break;
      case 'ul-task': toggleTaskList(); break;
      case 'table': run(insertTableCommand, { row: 3, col: 3 }); break;
      case 'mathblock': insertBlockMath(); break;
      default: run(turnIntoTextCommand); break;
    }
  }), [run, toggleTaskList, insertBlockMath]);

  useEffect(() => transport.addListener<string>('InsertParagraph', (pos) => {
    if (pos === 'hr') run(insertHrCommand);
  }), [run]);

  useEffect(() => transport.addListener('InsertImage', (arg: any) => {
    if (arg && typeof arg === 'string') {
      run(insertImageCommand, { src: arg });
    } else {
      insertImageFromFile();
    }
  }), [run, insertImageFromFile]);

  useEffect(() => transport.addListener('SelectAll', () => {
    withView((view) => {
      const { state } = view;
      view.dispatch(state.tr.setSelection(
        (state.selection.constructor as any).create(state.doc, 0, state.doc.content.size)
      ));
      view.focus();
    });
  }), [withView]);

  useEffect(() => transport.addListener('Paste', async () => {
    const text = await remote.getClipboardText().catch(() => null);
    if (text) {
      withView((view) => view.dispatch(view.state.tr.insertText(text).scrollIntoView()));
      return;
    }
    try {
      const base64 = await remote.getClipboardImage();
      if (!base64) return;
      const src = await processImage(`data:image/png;base64,${base64}`, propsRef.current.options, `image-${Date.now()}.png`);
      if (src) run(insertImageCommand, { src });
    } catch (err) {
      console.error('[Milkdown] clipboard image paste failed', err);
    }
  }), [run, withView]);

  useEffect(() => transport.addListener('Copy', () => {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection;
    const text = view.state.doc.textBetween(from, to, '\n');
    if (text) remote.setClipboard({ type: 'text', data: text }).catch(() => {});
  }), [getView]);

  useEffect(() => transport.addListener('Cut', () => {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection;
    const text = view.state.doc.textBetween(from, to, '\n');
    if (text) remote.setClipboard({ type: 'text', data: text }).catch(() => {});
    view.dispatch(view.state.tr.delete(from, to));
  }), [getView]);

  useEffect(() => transport.addListener<{ slug: string }>('ScrollTo', ({ slug }) => {
    const el = document.getElementById(slug);
    if (el) {
      window.scrollBy(0, el.getBoundingClientRect().top - 120);
      return;
    }
    // Fall back to matching by heading text when ids differ.
    const root = containerRef.current;
    const target = root?.querySelector(`[id="${CSS.escape(slug)}"]`);
    if (target) window.scrollBy(0, target.getBoundingClientRect().top - 120);
  }), []);

  useEffect(() => transport.addListener('DeleteParagraph', () => {
    withView((view) => {
      const { state } = view;
      const { $from } = state.selection;
      const start = $from.start(1);
      const end = $from.end(1);
      view.dispatch(state.tr.delete(start - 1, end + 1));
      view.focus();
    });
  }), [withView]);

  useEffect(() => transport.addListener('Duplicate', () => {
    withView((view) => {
      const { state } = view;
      const { $from } = state.selection;
      const node = $from.node(1);
      if (!node) return;
      const pos = $from.before(1) + node.nodeSize;
      view.dispatch(state.tr.insert(pos, node.copy(node.content)));
      view.focus();
    });
  }), [withView]);

  // ------------------------------------------------------------------ search
  const searchOpts = useMemo(() => ({
    caseSensitive: !!props.options?.searchIsCaseSensitive,
    regexp: !!props.options?.searchIsRegexp,
    wholeWord: !!props.options?.searchIsWholeWord,
  }), [props.options?.searchIsCaseSensitive, props.options?.searchIsRegexp, props.options?.searchIsWholeWord]);

  const doSearch = useCallback((value: string) => {
    setSearchValue(value);
    const view = getView();
    if (!view) return;
    setSearchQuery(view, value, searchOpts);
  }, [getView, searchOpts]);

  const closeSearch = useCallback(() => {
    setSearchValue('');
    setReplaceValue('');
    propsRef.current.onSearchOpenChange?.(0);
    propsRef.current.onSearchArgChange(undefined);
    const view = getView();
    if (view) {
      setSearchQuery(view, '', searchOpts);
      view.focus();
    }
  }, [getView, searchOpts]);

  useEffect(() => {
    if (!ready) return;
    const view = getView();
    if (!view) return;
    if (props.searchOpen === 0) {
      setSearchQuery(view, '', searchOpts);
    } else if (searchValue) {
      setSearchQuery(view, searchValue, searchOpts);
    }
  }, [props.searchOpen, searchOpts, ready, getView]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !props.searchArg?.value) return;
    const view = getView();
    if (!view) return;
    setSearchValue(props.searchArg.value);
    setSearchQuery(view, props.searchArg.value, searchOpts);
  }, [props.searchArg, ready, getView, searchOpts]);

  useEffect(() => transport.addListener('Find', ({ action }: any) => {
    const view = getView();
    if (!view) return;
    findNextMatch(view, action === 'pre' ? -1 : 1);
  }), [getView]);

  useEffect(() => transport.addListener('Replace', ({ value, opt }: any) => {
    const view = getView();
    if (!view) return;
    if (opt?.isSingle === false) {
      const count = replaceAllMatches(view, value ?? '');
      transport.postMessage('SaveState', { status: `Replaced ${count}` });
    } else {
      replaceCurrentMatch(view, value ?? '');
    }
  }), [getView]);

  // ---------------------------------------------------------- task list click
  useEffect(() => {
    if (!ready) return;
    const view = getView();
    if (!view) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const li = target.closest('li[data-item-type="task"]') as HTMLElement | null;
      if (!li) return;
      const rect = li.getBoundingClientRect();
      if (event.clientX - rect.left > 26) return;
      const inside = view.posAtDOM(li, 0);
      const $inside = view.state.doc.resolve(inside);
      let depth = $inside.depth;
      while (depth > 0 && $inside.node(depth).type.name !== 'list_item') depth -= 1;
      if (depth <= 0) return;
      const pos = $inside.before(depth);
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      event.preventDefault();
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        checked: node.attrs.checked !== true,
      }));
    };
    view.dom.addEventListener('mousedown', onClick);
    return () => view.dom.removeEventListener('mousedown', onClick);
  }, [ready, getView]);

  // ------------------------------------------------------------ image drop
  useEffect(() => {
    if (!ready) return;
    const view = getView();
    if (!view) return;
    const onDrop = async (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
      if (!files.length) return;
      event.preventDefault();
      for (const file of files) {
        const src = await processImage(file, propsRef.current.options);
        if (src) run(insertImageCommand, { src });
      }
    };
    view.dom.addEventListener('drop', onDrop as any);
    return () => view.dom.removeEventListener('drop', onDrop as any);
  }, [ready, getView, run]);

  // ------------------------------------------------ keyboard fallback (undo)
  useEffect(() => {
    if (!ready) return;
    const view = getView();
    if (!view) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        run(undoCommand);
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        run(redoCommand);
      } else if (key === 'f') {
        event.preventDefault();
        propsRef.current.onSearchOpenChange?.(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ready, getView, run]);

  const tableCommand = useCallback((command: any) => {
    withView((view) => {
      command(view.state, view.dispatch);
      view.focus();
    });
  }, [withView]);

  const alignCell = useCallback((align: 'left' | 'center' | 'right') => {
    withView((view) => {
      setCellAttr('alignment', align)(view.state, view.dispatch);
      view.focus();
    });
  }, [withView]);

  // Slash menu commands.
  useEffect(() => {
    setSlashCommandHandler((id) => {
      switch (id) {
        case 'h1': run(wrapInHeadingCommand, 1); break;
        case 'h2': run(wrapInHeadingCommand, 2); break;
        case 'h3': run(wrapInHeadingCommand, 3); break;
        case 'bullet': run(wrapInBulletListCommand); break;
        case 'ordered': run(wrapInOrderedListCommand); break;
        case 'task': toggleTaskList(); break;
        case 'quote': run(wrapInBlockquoteCommand); break;
        case 'code': run(createCodeBlockCommand); break;
        case 'table': run(insertTableCommand, { row: 3, col: 3 }); break;
        case 'math': insertBlockMath(); break;
        case 'hr': run(insertHrCommand); break;
        case 'image': insertImageFromFile(); break;
        default: break;
      }
    });
  }, [run, toggleTaskList, insertBlockMath, insertImageFromFile]);

  // ------------------------------------------------------------------ render
  const searchBarStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px',
    backgroundColor: 'var(--editorColor02)',
    borderBottom: '1px solid var(--editorColor10)',
    fontSize: 13,
    position: 'sticky', top: 0, zIndex: 100,
  };

  const matchCount = (() => {
    const view = getView();
    if (!view) return 0;
    return getSearchState(view)?.matches.length ?? 0;
  })();

  return (
    <div>
      {props.searchOpen > 0 && (
        <div id="md-searchpanel" style={searchBarStyle}>
          <input
            autoFocus
            type="text"
            placeholder={t('Search...')}
            value={searchValue}
            onChange={e => doSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { const v = getView(); if (v) findNextMatch(v); }
              if (e.key === 'Escape') closeSearch();
            }}
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: 'var(--editorColor40)', minWidth: 28, textAlign: 'right' }}>{matchCount}</span>
          <button onClick={() => { const v = getView(); if (v) findNextMatch(v, -1); }} style={btnStyle} title={t('Previous')}>&larr;</button>
          <button onClick={() => { const v = getView(); if (v) findNextMatch(v, 1); }} style={btnStyle} title={t('Next')}>&rarr;</button>
          {props.searchOpen === 2 && (
            <>
              <input
                type="text"
                placeholder={t('Replace...')}
                value={replaceValue}
                onChange={e => setReplaceValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { const v = getView(); if (v) replaceCurrentMatch(v, replaceValue); } }}
                style={{ ...inputStyle, width: 120, marginLeft: 8 }}
              />
              <button onClick={() => { const v = getView(); if (v) replaceCurrentMatch(v, replaceValue); }} style={btnStyle} title={t('Replace')}>Rpl</button>
              <button onClick={() => { const v = getView(); if (v) replaceAllMatches(v, replaceValue); }} style={btnStyle} title={t('Replace All')}>All</button>
            </>
          )}
          <button onClick={closeSearch} style={{ ...btnStyle, fontSize: 16 }} title={t('Close')}>&times;</button>
        </div>
      )}

      {toolbar && (
        <div
          className="milkdown-bubble-toolbar"
          style={{ position: 'absolute', top: toolbar.top, left: toolbar.left, transform: 'translateX(-50%)' }}
          onMouseDown={e => e.preventDefault()}
        >
          <button className={formatState.strong ? 'active' : ''} onMouseDown={e => { e.preventDefault(); run(toggleStrongCommand); }} title="Bold"><b>B</b></button>
          <button className={formatState.emphasis ? 'active' : ''} onMouseDown={e => { e.preventDefault(); run(toggleEmphasisCommand); }} title="Italic"><i>I</i></button>
          <button className={formatState.inlineCode ? 'active' : ''} onMouseDown={e => { e.preventDefault(); run(toggleInlineCodeCommand); }} title="Inline code">{"<>"}</button>
          <button className={formatState.strikethrough ? 'active' : ''} onMouseDown={e => { e.preventDefault(); run(toggleStrikethroughCommand); }} title="Strikethrough"><s>S</s></button>
          <button onMouseDown={e => {
            e.preventDefault();
            const href = window.prompt('Link URL', 'https://');
            if (href) run(toggleLinkCommand, { href });
          }} title="Link">🔗</button>
        </div>
      )}

      {tableBar && (
        <div
          className="milkdown-table-toolbar"
          style={{ position: 'absolute', top: tableBar.top, left: tableBar.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button onMouseDown={e => { e.preventDefault(); tableCommand(addRowAfter); }} title="Add row">+行</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteRow); }} title="Delete row">-行</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(addColumnAfter); }} title="Add column">+列</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteColumn); }} title="Delete column">-列</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('left'); }} title="Align left">左</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('center'); }} title="Align center">中</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('right'); }} title="Align right">右</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteTable); }} title="Delete table">×</button>
        </div>
      )}

      <div id="write" className={`milkdown-write${props.options?.typewriter ? ' typewriter' : ''}`}>
        <div ref={containerRef} className="milkdown-host" />
      </div>
    </div>
  );
};

const buildAffiliation = (view: EditorView): any[] => {
  const { $from } = view.state.selection;
  const affiliation: any[] = [];
  for (let depth = 1; depth <= $from.depth; depth += 1) {
    const node = $from.node(depth);
    const name = node.type.name;
    const type = name === 'heading' ? `h${node.attrs.level}` : name;
    affiliation.push({
      type,
      functionType: name === 'code_block' ? 'code' : '',
      listType: node.attrs.checked != null ? 'task' : '',
      children: [],
    });
  }
  return affiliation;
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '3px 6px', fontSize: 13,
  border: '1px solid var(--editorColor10)', borderRadius: 3,
  backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '3px 8px', fontSize: 13, cursor: 'pointer',
  border: '1px solid var(--editorColor10)', borderRadius: 3,
  backgroundColor: 'var(--editorColor04)', color: 'var(--editorColor50)',
};

export default MilkdownEditor;
