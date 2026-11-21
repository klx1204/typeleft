import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import remote from 'services/remote/common';

/**
 * Settings-driven behaviour for code fences:
 * - line numbers / soft wrap (#33 / #34)
 * - default language for newly created blocks (#35)
 * - Tab / Shift+Tab indentation and `Copy Code Block` (#36)
 * - ```math rendered through KaTeX (#39, see nodes/codeblock.ts)
 */

const tabSize = (): number => {
  const value = Number((window as any).typeleftEditorOptions?.tabSize);
  return Number.isFinite(value) && value > 0 ? Math.min(8, Math.floor(value)) : 4;
};

const defaultLanguage = (): string => {
  const value = (window as any).typeleftEditorOptions?.codeBlockDefaultLanguage;
  return typeof value === 'string' ? value.trim() : '';
};

/** Reflect the two display preferences on the document root. */
export const applyCodeBlockOptions = (options: any): void => {
  const body = document.body;
  body.classList.toggle('code-block-no-line-numbers', options?.codeBlockLineNumbers === false);
  body.classList.toggle('code-block-wrap', !!options?.codeBlockWrap);
};

/** Give freshly inserted fences the configured default language. */
export const codeBlockDefaultsPlugin = $prose(() => new Plugin({
  appendTransaction(trs, _oldState, newState) {
    const language = defaultLanguage();
    if (!language || !trs.some(tr => tr.docChanged)) return null;
    let tr: any = null;
    for (const base of trs) {
      base.mapping.maps.forEach(map => {
        map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
          newState.doc.nodesBetween(newStart, newEnd, (node, pos) => {
            if (node.type.name !== 'code_block' || node.attrs.language) return;
            if (!tr) tr = newState.tr;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, language });
          });
        });
      });
    }
    return tr;
  },
}));

const codeBlockAt = (view: EditorView): { node: any; pos: number } | null => {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'code_block') {
      return { node, pos: $from.before(depth) };
    }
  }
  return null;
};

/** Indent or outdent the selected code lines. */
const changeIndent = (view: EditorView, outdent: boolean): boolean => {
  const { state } = view;
  const block = codeBlockAt(view);
  if (!block) return false;
  const size = tabSize();
  const { from, to } = state.selection;
  const contentStart = block.pos + 1;
  const contentEnd = block.pos + block.node.nodeSize - 1;
  const text = state.doc.textBetween(contentStart, contentEnd, '\n', '\n');

  // Line offsets inside the block's text.
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  const lineAt = (offset: number) => starts.filter(start => start <= offset).length - 1;

  const firstLine = lineAt(Math.min(from, text.length));
  const lastLine = lineAt(Math.min(to, text.length));
  const lineStart = (line: number) => contentStart + starts[line];
  const lineEnd = (line: number) => (line + 1 < starts.length ? contentStart + starts[line + 1] - 1 : contentEnd);

  if (outdent) {
    const selectionCollapsed = from === to;
    const leading = (line: number) => {
      const segment = state.doc.textBetween(lineStart(line), lineEnd(line), '\n', '\n');
      return segment.match(/^[ \t]*/)?.[0].length ?? 0;
    };
    if (selectionCollapsed && leading(firstLine) === 0) {
      // Shift+Tab at the start of an unindented block leaves the fence.
      const paragraph = state.schema.nodes.paragraph;
      if (!paragraph) return false;
      const insertAt = block.pos + block.node.nodeSize;
      const tr = state.tr.insert(insertAt, paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    let tr = state.tr;
    for (let line = lastLine; line >= firstLine; line -= 1) {
      const count = Math.min(leading(line), size);
      if (count > 0) tr = tr.delete(lineStart(line), lineStart(line) + count);
    }
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const pad = ' '.repeat(size);
  let tr = state.tr;
  if (from === to) {
    // Typora inserts a tab at the caret, not at the line start.
    tr = tr.insertText(pad, from);
    tr = tr.setSelection(TextSelection.create(tr.doc, from + size));
  } else {
    for (let line = lastLine; line >= firstLine; line -= 1) {
      tr = tr.insert(lineStart(line), state.schema.text(pad));
    }
    tr = tr.setSelection(TextSelection.create(tr.doc, from + size, to + size * (lastLine - firstLine + 1)));
  }
  view.dispatch(tr.scrollIntoView());
  return true;
};

export const codeBlockKeysPlugin = $prose(() => new Plugin({
  props: {
    handleKeyDown(view, event) {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return false;
      if (!codeBlockAt(view)) return false;
      event.preventDefault();
      return changeIndent(view, event.shiftKey);
    },
  },
}));

/** `Edit → Copy Code Block` (#36). */
export const copyCodeBlock = (view: EditorView): boolean => {
  const block = codeBlockAt(view);
  if (!block) return false;
  const text = block.node.textContent;
  remote.setClipboard({ type: 'text', data: text }).catch(() => {
    navigator.clipboard?.writeText(text).catch(() => {});
  });
  return true;
};
