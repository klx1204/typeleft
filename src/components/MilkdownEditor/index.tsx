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
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  createCodeBlockCommand,
  insertHrCommand,
  insertImageCommand,
  turnIntoTextCommand,
} from '@milkdown/kit/preset/commonmark';
import { gfm, insertTableCommand, toggleStrikethroughCommand, remarkGFMPlugin, columnResizingPlugin, strikethroughInputRule as presetStrikethroughInputRule } from '@milkdown/kit/preset/gfm';
import remarkGfm from 'remark-gfm';
import { history, undoCommand, redoCommand } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { prism } from '@milkdown/plugin-prism';
import { $prose, $remark } from '@milkdown/kit/utils';
import { getMarkdown, replaceAll, callCommand } from '@milkdown/kit/utils';
import { Plugin, PluginKey, NodeSelection, Selection, TextSelection } from '@milkdown/kit/prose/state';
import { toggleMark } from '@milkdown/kit/prose/commands';
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
import { LARGE_DOC_LIMIT } from 'components/Editor/engine';
import { applyListIndentation } from 'services/markdown/listFormat';
import { parseFrontmatter } from 'services/frontmatter';
import { createApplicationMenuState } from 'services/menuState';
import { useI18n, t as translate } from 'services/i18n';
import { frontmatterNode, frontmatterRemark, frontmatterView } from './nodes/frontmatter';
import { mathRemark, inlineMathNode, blockMathNode, inlineMathView, blockMathView } from './nodes/math';
import { marksRemark, highlightMark, superscriptMark, subscriptMark, highlightInputRule, superscriptInputRule, subscriptInputRule, strikethroughInputRule, setSuperSubEnabled } from './nodes/marks';
import { tableWidthRemark, tableWithWidth, tableCellWithWidth, tableHeaderWithWidth } from './nodes/table';
import { createImageView, imageLayoutSchema, imageHtmlRemark } from './nodes/image';
import { createCodeBlockView } from './nodes/codeblock';
import { slashPlugin, setSlashCommandHandler } from './slash';
import { autoPairPlugin, setAutoPairOptions } from './autoPair';
import { smartPunctuationPlugin, setSmartPunctuationOptions } from './smartPunctuation';
import { deleteRangePlugin } from './deleteRange';
import { autoLinkPlugin, autoLinkRemark, setAutoLinkEnabled } from './autoLink';
import { softBreakRemark, setSoftBreakEnabled } from './softBreak';
import { pageBreakRemark, pageBreakNode, pageBreakView } from './nodes/pagebreak';
import { spellcheckPlugin, runSpellcheck, setCustomDictionary } from './spellcheck';
import { codeBlockDefaultsPlugin, codeBlockKeysPlugin, applyCodeBlockOptions, copyCodeBlock } from './codeblockExtras';
import { applyLayoutCss } from 'services/layoutCss';
import { EmojiPicker, TablePicker, LinkPopover } from './Pickers';
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
const gfmPlugins = (gfm as any[]).filter(plugin => plugin !== remarkGFMPlugin && plugin !== presetStrikethroughInputRule);
const gfmRemark = $remark('remarkGFM', () => remarkGfm as any, { singleTilde: false } as any);

const MAX_TOC = 500;

const placeholderPlugin = $prose(() => new Plugin({
  props: {
    decorations(state) {
      const decorations: Decoration[] = [];
      state.doc.forEach((node, offset) => {
        if (node.type.name === 'paragraph' && node.content.size === 0) {
          decorations.push(Decoration.node(offset, offset + node.nodeSize, {
            class: 'is-empty',
            'data-placeholder': translate('Insert hint'),
          }));
        }
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
}));

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
  // Safety net: ProseMirror has no virtualised rendering, so a document this
  // large must go to source mode. The parent decides that, but if a render ever
  // slips through we refuse to block the main thread for ~15 seconds.
  const tooLarge = (props.markdown?.length ?? 0) > LARGE_DOC_LIMIT;
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
  const [emojiPicker, setEmojiPicker] = useState<{ top: number; left: number } | null>(null);
  const [tablePicker, setTablePicker] = useState<{ top: number; left: number } | null>(null);
  const [linkPopover, setLinkPopover] = useState<{ top: number; left: number; href: string; text: string } | null>(null);
  const [footnotePreview, setFootnotePreview] = useState<{ top: number; left: number; html: string } | null>(null);

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
    const meta = parseFrontmatter(markdown).data;
    (window as any).typoraRootUrl = typeof meta['typora-root-url'] === 'string' ? meta['typora-root-url'] : '';
    const wordCount = countWords(markdown);
    // Read heading ids from the rendered DOM: Milkdown generates them at render
    // time, so the schema attributes alone are empty.
    requestAnimationFrame(() => {
      try {
        const root = containerRef.current;
        if (!root) return;
        const nodes = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[];
        const toc = nodes.slice(0, MAX_TOC).map(el => ({
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
        const frontmatter = parseFrontmatter(markdown).data;
        transport.postMessage('StateChange', { state: { wordCount, toc, cur, frontmatter }, milkdown: true });
      } catch {
        transport.postMessage('StateChange', { state: { wordCount, toc: [], cur: 0, frontmatter: {} }, milkdown: true });
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
      // Serialize only the part of the block before the caret: this keeps inline
      // markdown syntax (`**`, links, code) in the column count, unlike counting
      // the rendered text length.
      const within = from > blockStart ? editor.action(getMarkdown({ from: blockStart, to: from })) : '';
      const prefixLines = (before || '').split('\n');
      const withinLines = (within || '').split('\n');
      const line = Math.max(0, prefixLines.length - 1 + withinLines.length - 1);
      const ch = withinLines.length > 1
        ? withinLines[withinLines.length - 1].length
        : (prefixLines[prefixLines.length - 1] ?? '').length + withinLines[0].length;
      const cursor = { anchor: { line, ch }, focus: { line, ch } };
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
      ['superscript', 'sup'],
      ['subscript', 'sub'],
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
    if (!el || tooLarge) return;
    const startedAt = performance.now();
    let cancelled = false;
    let editor: Editor | null = null;

    // Parsing happens here, before the options-sync effect runs.
    setAutoPairOptions(propsRef.current.options);
    setSmartPunctuationOptions(propsRef.current.options);
    setAutoLinkEnabled(propsRef.current.options?.autoLink);
    setSoftBreakEnabled(propsRef.current.options?.preserveSoftLineBreaks);
    const initialMeta = parseFrontmatter(propsRef.current.markdown || '').data;
    (window as any).typoraRootUrl = typeof initialMeta['typora-root-url'] === 'string' ? initialMeta['typora-root-url'] : '';

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, el);
        ctx.set(defaultValueCtx, propsRef.current.markdown ?? '');
        // Keep source output close to what Typora/Muya write.
        ctx.update(remarkStringifyOptionsCtx, (prev: any) => ({
          ...prev,
          bullet: propsRef.current.options?.bulletListMarker || '-',
          bulletOrdered: propsRef.current.options?.orderListDelimiter || '.',
          rule: '-',
          fence: '`',
          listItemIndent: 'one',
        }));
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          const formatted = applyListIndentation(markdown, propsRef.current.options?.listIndentation);
          markdownRef.current = formatted;
          propsRef.current.onMarkdownChange(formatted);
          emitState(formatted);
        });
      })
      .use(commonmark)
      .use(gfmPlugins)
      .use(columnResizingPlugin)
      .use(gfmRemark)
      .use(history)
      .use(listener)
      .use(prism)
      .use(frontmatterRemark)
      .use(frontmatterNode)
      .use(frontmatterView)
      .use(tableWidthRemark)
      .use(tableWithWidth)
      .use(tableCellWithWidth)
      .use(tableHeaderWithWidth)
      .use(marksRemark)
      .use(highlightMark)
      .use(superscriptMark)
      .use(subscriptMark)
      .use(highlightInputRule)
      .use(superscriptInputRule)
      .use(subscriptInputRule)
      .use(strikethroughInputRule)
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
      .use(smartPunctuationPlugin)
      .use(autoPairPlugin)
      .use(deleteRangePlugin)
      .use(autoLinkRemark)
      .use(autoLinkPlugin)
      .use(softBreakRemark)
      .use(pageBreakRemark)
      .use(pageBreakNode)
      .use(pageBreakView)
      .use(spellcheckPlugin)
      .use(codeBlockDefaultsPlugin)
      .use(codeBlockKeysPlugin)
      .use(placeholderPlugin)
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
    applyLayoutCss(props.options);
    applyCodeBlockOptions(props.options);
    setAutoPairOptions(props.options);
    setSmartPunctuationOptions(props.options);
    setAutoLinkEnabled(props.options?.autoLink);
    setSoftBreakEnabled(props.options?.preserveSoftLineBreaks);
    setSuperSubEnabled(props.options?.superSubScript !== false);
    setCustomDictionary(props.options?.customDictionary);
    const view = getView();
    if (view) {
      // The bundled dictionary drives the decorations; native underlines would
      // duplicate them and cannot use the custom word list.
      view.dom.setAttribute('spellcheck', 'false');
      view.dom.setAttribute('lang', props.options?.spellcheckLang || '');
    }
  }, [props.options, getView]);

  // ------------------------------------------------------------- spellcheck
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    const start = () => {
      if (cancelled) return;
      const view = getView();
      if (!view) {
        if (attempts < 40) {
          attempts += 1;
          timer = window.setTimeout(start, 250);
        }
        return;
      }
      if (!props.options?.spellcheckEnabled) {
        import('./spellcheck').then(({ spellcheckKey }) => {
          if (!cancelled && view.dom.isConnected) view.dispatch(view.state.tr.setMeta(spellcheckKey, null));
        }).catch(() => {});
        return;
      }
      timer = window.setTimeout(() => { void runSpellcheck(view); }, 600);
    };

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [
    props.markdown,
    props.options?.spellcheckEnabled,
    props.options?.customDictionary,
    getView,
  ]);

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

  const toggleMarkByName = useCallback((name: string) => {
    withView((view) => {
      const type = view.state.schema.marks[name];
      if (type) toggleMark(type)(view.state, view.dispatch, view);
      view.focus();
    });
  }, []);

  const withView = useCallback((fn: (view: EditorView, editor: Editor) => void) => {
    const editor = editorRef.current;
    const view = getView();
    if (!editor || !view) return;
    fn(view, editor);
  }, [getView]);

  const caretCoords = useCallback(() => {
    const view = getView();
    if (!view) return { top: 240, left: 240 };
    try {
      const coords = view.coordsAtPos(view.state.selection.from);
      return { top: coords.bottom + 6, left: coords.left };
    } catch {
      return { top: 240, left: 240 };
    }
  }, [getView]);

  const openEmojiPicker = useCallback(() => setEmojiPicker(caretCoords()), [caretCoords]);
  const openTablePicker = useCallback(() => setTablePicker(caretCoords()), [caretCoords]);

  const openLinkPopover = useCallback(() => {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection;
    const linkType = view.state.schema.marks.link;
    let href = '';
    if (linkType) {
      const node = view.state.doc.nodeAt(from);
      const mark = node?.marks.find(m => m.type === linkType)
        ?? view.state.doc.resolve(from).marks().find(m => m.type === linkType);
      href = (mark?.attrs.href as string) || '';
    }
    setLinkPopover({
      ...caretCoords(),
      href,
      text: view.state.doc.textBetween(from, to, ' '),
    });
  }, [getView, caretCoords]);

  const insertTextAtCursor = useCallback((text: string) => {
    withView((view) => {
      view.dispatch(view.state.tr.insertText(text).scrollIntoView());
      view.focus();
    });
  }, [withView]);

  const insertFootnote = useCallback(() => {
    withView((view) => {
      const schema = view.state.schema;
      const defType = schema.nodes.footnote_definition;
      const refType = schema.nodes.footnote_reference;
      if (!defType || !refType) return;
      let max = 0;
      view.state.doc.descendants((n: any) => {
        if (n.type.name === 'footnote_definition' || n.type.name === 'footnote_reference') {
          const value = parseInt(String(n.attrs.label), 10);
          if (!Number.isNaN(value)) max = Math.max(max, value);
        }
        return true;
      });
      const label = String(max + 1);
      const tr = view.state.tr.replaceSelectionWith(refType.create({ label }));
      const paragraph = schema.nodes.paragraph.create(null, schema.text(translate('Footnote text')));
      const definition = defType.create({ label }, paragraph);
      const insertPos = tr.doc.content.size;
      tr.insert(insertPos, definition);
      try {
        const $inside = tr.doc.resolve(Math.min(insertPos + 2, tr.doc.content.size - 1));
        tr.setSelection(Selection.near($inside, 1));
      } catch { /* ignore */ }
      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  }, [withView]);

  const applyLink = useCallback((href: string, text: string) => {
    withView((view) => {
      const { from, to } = view.state.selection;
      const linkType = view.state.schema.marks.link;
      if (!linkType) return;
      let tr = view.state.tr;
      let end = to;
      if (text && text !== view.state.doc.textBetween(from, to, ' ')) {
        tr = tr.insertText(text, from, to);
        end = from + text.length;
      }
      tr = tr.addMark(from, end, linkType.create({ href }));
      view.dispatch(tr);
      view.focus();
    });
    setLinkPopover(null);
  }, [withView]);

  const removeLink = useCallback(() => {
    withView((view) => {
      const { from, to } = view.state.selection;
      const linkType = view.state.schema.marks.link;
      if (linkType) view.dispatch(view.state.tr.removeMark(from, to, linkType));
      view.focus();
    });
    setLinkPopover(null);
  }, [withView]);

  const insertPageBreak = useCallback(() => {
    withView((view) => {
      const { state } = view;
      const type = state.schema.nodes.page_break;
      const paragraph = state.schema.nodes.paragraph;
      if (!type || !paragraph) return;
      const { $from } = state.selection;
      const pos = $from.depth > 0 ? $from.after($from.depth) : state.selection.to;
      const node = type.create();
      let tr = state.tr.insert(pos, node);
      const afterBreak = pos + node.nodeSize;
      if (!tr.doc.nodeAt(afterBreak)) {
        tr = tr.insert(afterBreak, paragraph.create());
      }
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(afterBreak + 1)));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  }, [withView]);

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
      openLinkPopover();
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
  }), [run, withView, openLinkPopover]);

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
      case 'table': openTablePicker(); break;
      case 'mathblock': insertBlockMath(); break;
      default: run(turnIntoTextCommand); break;
    }
  }), [run, toggleTaskList, insertBlockMath, openTablePicker]);

  useEffect(() => transport.addListener<string>('InsertParagraph', (pos) => {
    if (pos === 'hr') run(insertHrCommand);
    if (pos === 'pagebreak') insertPageBreak();
  }), [run, insertPageBreak]);

  useEffect(() => transport.addListener('InsertImage', (arg: any) => {
    if (arg && typeof arg === 'string') {
      run(insertImageCommand, { src: arg });
    } else {
      insertImageFromFile();
    }
  }), [run, insertImageFromFile]);

  useEffect(() => transport.addListener<{ path: string; name: string }>('InsertFileLink', ({ path, name }) => {
    withView((view) => {
      const { state } = view;
      const link = state.schema.marks.link;
      if (!link) return;
      const label = name || path;
      const href = /^[a-z]+:/i.test(path) ? path : `file://${encodeURI(path)}`;
      const from = state.selection.from;
      const tr = state.tr.insertText(label, from).addMark(from, from + label.length, link.create({ href }));
      tr.setSelection(TextSelection.create(tr.doc, from + label.length));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  }), [withView]);

  useEffect(() => transport.addListener('CopyCodeBlock', () => {
    withView(view => { copyCodeBlock(view); });
  }), [withView]);

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
    const html = await remote.getClipboardHtml().catch(() => null);
    if (html) {
      withView((view) => {
        view.pasteHTML(html);
        view.focus();
      });
      return;
    }
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

  const copySelection = useCallback((cut: boolean, forcedFormat?: string) => {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection;
    const text = view.state.doc.textBetween(from, to, '\n');
    const format = forcedFormat || propsRef.current.options?.defaultCopyFormat || 'rich';
    let html = '';
    const selection = window.getSelection();
    if (selection && selection.rangeCount && !selection.isCollapsed) {
      const container = document.createElement('div');
      container.appendChild(selection.getRangeAt(0).cloneContents());
      html = container.innerHTML;
    }
    const finish = () => {
      if (cut && from !== to) view.dispatch(view.state.tr.delete(from, to));
      view.focus();
    };
    const markdown = () => {
      try {
        const value = editorRef.current?.action(getMarkdown({ from, to })) || text;
        return applyListIndentation(value, propsRef.current.options?.listIndentation);
      } catch {
        return text;
      }
    };
    if (format === 'markdown') {
      remote.setClipboard({ type: 'text', data: markdown() }).then(finish).catch(finish);
    } else if (format === 'text') {
      remote.setClipboard({ type: 'text', data: text }).then(finish).catch(finish);
    } else if (html) {
      remote.setClipboardRich({ text, html }).then(finish).catch(finish);
    } else if (text) {
      remote.setClipboard({ type: 'text', data: text }).then(finish).catch(finish);
    } else {
      finish();
    }
  }, [getView]);

  useEffect(() => transport.addListener('Copy', () => copySelection(false)), [copySelection]);

  useEffect(() => transport.addListener('Cut', () => copySelection(true)), [copySelection]);

  useEffect(() => transport.addListener<string>('CopyAs', (format) => copySelection(false, format)), [copySelection]);

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
      // Resolve through the click coordinates: the checkbox sits in the item's
      // left padding, and posAtCoords reliably lands inside its paragraph.
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
      const inside = at ? at.pos : view.posAtDOM(li, 0);
      const $inside = view.state.doc.resolve(inside);
      let depth = $inside.depth;
      while (depth > 0 && $inside.node(depth).type.name !== 'list_item') depth -= 1;
      if (depth <= 0) return;
      const pos = $inside.before(depth);
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      event.preventDefault();
      const nextChecked = node.attrs.checked !== true;
      const setChecked = (tr: any, at: number, checked: boolean) => {
        const target = tr.doc.nodeAt(at);
        if (!target) return tr;
        return tr.setNodeMarkup(at, undefined, { ...target.attrs, checked });
      };
      let tr = setChecked(view.state.tr, pos, nextChecked);

      // Mirrors Muya's `autoCheck`: a parent tick cascades to its children, then
      // parents become ticked when all of their direct task children are ticked.
      if (propsRef.current.options?.autoCheck) {
        node.descendants((child, offset) => {
          if (child.type.name === 'list_item' && child.attrs.checked != null) {
            tr = setChecked(tr, pos + 1 + offset, nextChecked);
          }
          return true;
        });

        const $pos = view.state.doc.resolve(pos + 1);
        for (let d = $pos.depth; d > 0; d -= 1) {
          const ancestor = $pos.node(d);
          if (ancestor.type.name !== 'list_item' || ancestor.attrs.checked == null) continue;
          const ancestorPos = $pos.before(d);
          const fresh = tr.doc.nodeAt(ancestorPos);
          if (!fresh) continue;
          const children: boolean[] = [];
          fresh.forEach((list: any) => {
            list.forEach((item: any) => {
              if (item.type.name === 'list_item' && item.attrs.checked != null) {
                children.push(item.attrs.checked === true);
              }
            });
          });
          if (!children.length) break;
          const parentChecked = children.every(Boolean);
          if (fresh.attrs.checked === parentChecked) break;
          tr = setChecked(tr, ancestorPos, parentChecked);
        }
      }

      view.dispatch(tr);
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
        case 'table': openTablePicker(); break;
        case 'emoji': openEmojiPicker(); break;
        case 'footnote': insertFootnote(); break;
        case 'math': insertBlockMath(); break;
        case 'hr': run(insertHrCommand); break;
        case 'pagebreak': insertPageBreak(); break;
        case 'image': insertImageFromFile(); break;
        default: break;
      }
    });
  }, [run, toggleTaskList, insertBlockMath, insertImageFromFile, openTablePicker, openEmojiPicker, insertFootnote, insertPageBreak]);

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

  if (tooLarge) return null;

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
          <button className={formatState.highlight ? 'active' : ''} onMouseDown={e => { e.preventDefault(); toggleMarkByName('highlight'); }} title="Highlight">H</button>
          <button className={formatState.superscript ? 'active' : ''} onMouseDown={e => { e.preventDefault(); toggleMarkByName('superscript'); }} title="Superscript">x²</button>
          <button className={formatState.subscript ? 'active' : ''} onMouseDown={e => { e.preventDefault(); toggleMarkByName('subscript'); }} title="Subscript">x₂</button>
          <button onMouseDown={e => { e.preventDefault(); openLinkPopover(); }} title="Link">🔗</button>
        </div>
      )}

      {tableBar && (
        <div
          className="milkdown-table-toolbar"
          style={{ position: 'absolute', top: tableBar.top, left: tableBar.left }}
          onMouseDown={e => e.preventDefault()}
        >
          <button onMouseDown={e => { e.preventDefault(); tableCommand(addRowAfter); }} title={t('Add row')}>+</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteRow); }} title={t('Delete row')}>−</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(addColumnAfter); }} title={t('Add column')}>+</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteColumn); }} title={t('Delete column')}>−</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('left'); }} title={t('Align left')}>←</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('center'); }} title={t('Align center')}>↔</button>
          <button onMouseDown={e => { e.preventDefault(); alignCell('right'); }} title={t('Align right')}>→</button>
          <button onMouseDown={e => { e.preventDefault(); tableCommand(deleteTable); }} title={t('Delete table')}>×</button>
        </div>
      )}

      {emojiPicker && (
        <EmojiPicker
          top={emojiPicker.top}
          left={emojiPicker.left}
          onPick={(emoji) => { insertTextAtCursor(emoji); setEmojiPicker(null); }}
          onClose={() => setEmojiPicker(null)}
        />
      )}

      {tablePicker && (
        <TablePicker
          top={tablePicker.top}
          left={tablePicker.left}
          onPick={(rows, cols) => {
            setTablePicker(null);
            run(insertTableCommand, { row: rows, col: cols });
          }}
          onClose={() => setTablePicker(null)}
        />
      )}

      {linkPopover && (
        <LinkPopover
          top={linkPopover.top}
          left={linkPopover.left}
          initialHref={linkPopover.href}
          initialText={linkPopover.text}
          onApply={applyLink}
          onRemove={removeLink}
          onClose={() => setLinkPopover(null)}
        />
      )}

      {footnotePreview && (
        <div
          className="footnote-preview"
          style={{
            position: 'fixed', top: footnotePreview.top, left: footnotePreview.left, zIndex: 9500,
            maxWidth: 420, padding: '6px 10px', fontSize: 13, lineHeight: 1.6,
            backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor70)',
            border: '1px solid var(--editorColor10)', borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: footnotePreview.html }}
        />
      )}

      <div
        id="write"
        className={`milkdown-write${props.options?.typewriter ? ' typewriter' : ''}`}
        onClick={(e) => {
          const anchor = (e.target as HTMLElement).closest('a');
          if (!anchor) return;
          const href = anchor.getAttribute('href') || '';
          if (!href) return;
          if (href.startsWith('#')) {
            e.preventDefault();
            const id = decodeURIComponent(href.slice(1));
            const target = document.getElementById(id)
              || (containerRef.current?.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement | null);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
          // External links open only with Cmd/Ctrl so a plain click still edits.
          if ((e.metaKey || e.ctrlKey) && /^(https?:|mailto:)/i.test(href)) {
            e.preventDefault();
            remote.openUrl({ url: href }).catch(() => {});
          }
        }}
        onMouseOver={(e) => {
          const ref = (e.target as HTMLElement).closest('sup[data-type="footnote_reference"]') as HTMLElement | null;
          if (!ref) return;
          const label = ref.getAttribute('data-label') || '';
          const definition = document.querySelector(
            `dl[data-type="footnote_definition"][data-label="${CSS.escape(label)}"] dd`
          );
          if (!definition) return;
          const rect = ref.getBoundingClientRect();
          setFootnotePreview({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 440)),
            html: definition.innerHTML,
          });
        }}
        onMouseOut={(e) => {
          const ref = (e.target as HTMLElement).closest('sup[data-type="footnote_reference"]');
          if (!ref) return;
          const next = e.relatedTarget as HTMLElement | null;
          if (!next || !next.closest?.('sup[data-type="footnote_reference"]')) setFootnotePreview(null);
        }}
      >
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
