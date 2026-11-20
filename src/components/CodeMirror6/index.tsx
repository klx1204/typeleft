import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import {
  search,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
  SearchQuery,
} from '@codemirror/search';
import transport from 'services/transport';
import remote from 'services/remote/common';
import { useI18n } from 'services/i18n';
import { getTOC } from 'services/common';
import './theme.css';

const MAX_TOC = 500;

interface ICodeMirror6 {
  markdown: string;
  cursor: any;
  options: any;
  searchOpen: number;
  searchArg: { value: string; opt: any } | undefined;
  scrollTopRef: React.MutableRefObject<number>;
  onMarkdownChange: (markdown: string) => void;
  onCursorChange: (cursor: any) => void;
  onSearchArgChange: (arg: { value: string; opt: any } | undefined) => void;
  onSearchOpenChange?: (open: number) => void;
}

const readOnlyCompartment = new Compartment();

const CodeMirror6: React.FC<ICodeMirror6> = (props) => {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const markdownRef = useRef(props.markdown ?? '');
  const [searchValue, setSearchValue] = useState('');
  const [replaceValue, setReplaceValue] = useState('');
  const [marginTop, setMarginTop] = useState(0);

  const emitStats = useCallback((value: string) => {
    const wordCount = { character: value.length, word: value.split(/\s+/).filter(Boolean).length };
    // A 1 MB document can contain thousands of headings; sending them all over
    // IPC and into the sidebar is slower than it is useful.
    const { toc } = getTOC(value);
    transport.postMessage('StateChange', { state: { wordCount, toc: toc.slice(0, MAX_TOC), cur: toc[0] }, codeMirror: true });
  }, []);

  const emitSelection = useCallback((view: EditorView) => {
    const range = view.state.selection.main;
    const anchorLine = view.state.doc.lineAt(range.anchor);
    const headLine = view.state.doc.lineAt(range.head);
    const cursor = {
      anchor: { line: anchorLine.number - 1, ch: range.anchor - anchorLine.from },
      focus: { line: headLine.number - 1, ch: range.head - headLine.from },
    };
    propsRef.current.onCursorChange(cursor);
    const selectionText = view.state.sliceDoc(range.from, range.to);
    transport.postMessage('CodeMirrorSelectionChange', { cursor, selectionText });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: propsRef.current.markdown ?? '',
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          search({ top: true }),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
          readOnlyCompartment.of(EditorState.readOnly.of(false)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const value = update.state.doc.toString();
              markdownRef.current = value;
              propsRef.current.onMarkdownChange(value);
              emitStats(value);
            }
            if (update.selectionSet || update.docChanged) {
              emitSelection(update.view);
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    emitStats(propsRef.current.markdown ?? '');
    requestAnimationFrame(() => {
      const anchor = propsRef.current.cursor?.anchor;
      if (anchor && typeof anchor.line === 'number') {
        const line = view.state.doc.line(Math.min(anchor.line + 1, view.state.doc.lines));
        view.dispatch({ selection: { anchor: line.from + Math.min(anchor.ch ?? 0, line.length) } });
      }
      window.scrollTo(window.scrollX, propsRef.current.scrollTopRef?.current ?? 0);
      view.focus();
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External content updates (file switch, conflict reload, restore).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const next = props.markdown ?? '';
    if (next === markdownRef.current) return;
    markdownRef.current = next;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    });
    const anchor = propsRef.current.cursor?.anchor;
    if (anchor && typeof anchor.line === 'number') {
      const line = view.state.doc.line(Math.min(anchor.line + 1, view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from + Math.min(anchor.ch ?? 0, line.length) } });
    }
    emitStats(next);
  }, [props.markdown, emitStats]);

  useEffect(() => {
    if (props.searchArg?.value) {
      setSearchValue(props.searchArg.value);
    }
  }, [props.searchArg]);

  useEffect(() => transport.addListener('Copy', () => {
    const view = viewRef.current;
    if (!view) return;
    const range = view.state.selection.main;
    const text = view.state.sliceDoc(range.from, range.to);
    if (text) remote.setClipboard({ type: 'text', data: text }).catch(() => {});
  }), []);

  useEffect(() => transport.addListener('Cut', () => {
    const view = viewRef.current;
    if (!view) return;
    const range = view.state.selection.main;
    const text = view.state.sliceDoc(range.from, range.to);
    if (text) remote.setClipboard({ type: 'text', data: text }).catch(() => {});
    if (range.from !== range.to) view.dispatch({ changes: { from: range.from, to: range.to } });
  }), []);

  useEffect(() => transport.addListener('Paste', async () => {
    const text = await remote.getClipboardText().catch(() => null);
    if (!text) return;
    const view = viewRef.current;
    if (!view) return;
    const range = view.state.selection.main;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: text },
      selection: { anchor: range.from + text.length },
    });
    view.focus();
  }), []);

  useEffect(() => {
    const onscroll = () => {
      if (props.scrollTopRef) props.scrollTopRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onscroll);
    return () => window.removeEventListener('scroll', onscroll);
  }, [props.scrollTopRef]);

  useEffect(() => {
    setMarginTop(current => {
      const next = { 0: 0, 1: 50, 2: 90 }[props.searchOpen] ?? 0;
      window.scrollBy(0, next - current);
      return next;
    });
  }, [props.searchOpen]);

  const applyQuery = useCallback((value: string) => {
    const view = viewRef.current;
    if (!view) return;
    const query = new SearchQuery({
      search: value,
      caseSensitive: !!propsRef.current.options?.searchIsCaseSensitive,
      regexp: !!propsRef.current.options?.searchIsRegexp,
      wholeWord: !!propsRef.current.options?.searchIsWholeWord,
    });
    view.dispatch({ effects: setSearchQuery.of(query) });
    if (value) findNext(view);
    view.focus();
  }, []);

  const focusSearch = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    // Keep the selection so the search starts at the cursor.
    view.focus();
  }, []);

  const closeSearch = useCallback(() => {
    propsRef.current.onSearchOpenChange?.(0);
    propsRef.current.onSearchArgChange(undefined);
    setSearchValue('');
    setReplaceValue('');
    viewRef.current?.focus();
  }, []);

  const doSearch = useCallback((value: string) => {
    setSearchValue(value);
    applyQuery(value);
  }, [applyQuery]);

  const doFind = useCallback((direction: 1 | -1) => {
    const view = viewRef.current;
    if (!view) return;
    if (direction === 1) findNext(view);
    else findPrevious(view);
  }, []);

  const doReplace = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    applyQuery(searchValue);
    replaceNext(view);
  }, [applyQuery, searchValue]);

  const doReplaceAll = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    applyQuery(searchValue);
    replaceAll(view);
  }, [applyQuery, searchValue]);

  useEffect(() => {
    if (!props.searchOpen) return;
    focusSearch();
  }, [props.searchOpen, focusSearch]);

  // Cmd/Ctrl+F must open the app's own search bar, not CodeMirror's built-in
  // panel (which `search()` installs via its keymap).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
        event.stopPropagation();
        propsRef.current.onSearchOpenChange?.(1);
      }
    };
    host.addEventListener('keydown', onKeyDown, true);
    return () => host.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const searchBarStyle: React.CSSProperties = useMemo(() => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px',
    backgroundColor: 'var(--editorColor02)',
    borderBottom: '1px solid var(--editorColor10)',
    fontSize: 13,
    position: 'sticky', top: 0, zIndex: 100,
    marginBottom: 8,
  }), []);

  return (
    <div style={{ fontSize: props.options?.fontSize, lineHeight: props.options?.lineHeight, marginTop }}>
      {props.searchOpen > 0 && (
        <div id="md-searchpanel" style={searchBarStyle}>
          <input
            autoFocus
            type="text"
            placeholder={t('Search...')}
            value={searchValue}
            onChange={e => doSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doFind(1); if (e.key === 'Escape') closeSearch(); }}
            style={inputStyle}
          />
          <button onClick={() => doFind(-1)} style={btnStyle} title={t('Previous')}>&larr;</button>
          <button onClick={() => doFind(1)} style={btnStyle} title={t('Next')}>&rarr;</button>
          {props.searchOpen === 2 && (
            <>
              <input
                type="text"
                placeholder={t('Replace...')}
                value={replaceValue}
                onChange={e => setReplaceValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doReplace(); }}
                style={{ ...inputStyle, width: 120, marginLeft: 8 }}
              />
              <button onClick={doReplace} style={btnStyle} title={t('Replace')}>Rpl</button>
              <button onClick={doReplaceAll} style={btnStyle} title={t('Replace All')}>All</button>
            </>
          )}
          <button onClick={closeSearch} style={{ ...btnStyle, fontSize: 16 }} title={t('Close')}>&times;</button>
        </div>
      )}
      <div id="write" className="cm6-write">
        <div ref={hostRef} className="cm6-host" />
      </div>
    </div>
  );
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

export default CodeMirror6;
