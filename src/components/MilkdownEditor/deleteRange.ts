import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';

/**
 * Delete-range commands (#13).
 *
 * Cmd/Ctrl + Backspace deletes to the start of the block, Cmd/Ctrl + Delete to
 * the end, Cmd/Ctrl + Shift + Backspace removes the whole block, and
 * Alt + Backspace / Alt + Delete remove one word.
 */

const wordStart = (text: string, offset: number): number => {
  let index = offset;
  while (index > 0 && /\s/.test(text[index - 1])) index -= 1;
  while (index > 0 && !/\s/.test(text[index - 1])) index -= 1;
  return index;
};

const wordEnd = (text: string, offset: number): number => {
  let index = offset;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  while (index < text.length && !/\s/.test(text[index])) index += 1;
  return index;
};

export const deleteRangePlugin = $prose(() => new Plugin({
  props: {
    handleKeyDown(view, event) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod && !event.altKey) return false;
      if (event.key !== 'Backspace' && event.key !== 'Delete') return false;

      const { state } = view;
      const { from, to, $from } = state.selection;
      const depth = $from.depth;
      if (depth === 0) return false;

      // Alt/Option + Backspace/Delete: one word.
      if (event.altKey && !mod) {
        const start = $from.start(depth);
        const end = $from.end(depth);
        const text = state.doc.textBetween(start, end, '\n', '\n');
        if (event.key === 'Backspace') {
          if (from === to) {
            const index = wordStart(text, from - start);
            if (index === from - start) return false;
            event.preventDefault();
            view.dispatch(state.tr.delete(start + index, from).scrollIntoView());
            return true;
          }
        } else if (from === to) {
          const index = wordEnd(text, to - start);
          if (index === to - start) return false;
          event.preventDefault();
          view.dispatch(state.tr.delete(to, start + index).scrollIntoView());
          return true;
        }
        return false;
      }

      if (event.altKey) return false;

      // Shift: remove the whole block.
      if (event.shiftKey) {
        event.preventDefault();
        const blockStart = $from.before(depth);
        const blockEnd = $from.after(depth);
        const tr = state.tr.delete(blockStart, blockEnd);
        const docSize = tr.doc.content.size;
        if (!docSize) {
          tr.insert(0, state.schema.nodes.paragraph.create());
        }
        view.dispatch(tr.scrollIntoView());
        view.focus();
        return true;
      }

      event.preventDefault();
      if (event.key === 'Backspace') {
        const start = $from.start(depth);
        view.dispatch(state.tr.delete(start, from).scrollIntoView());
      } else {
        const end = $from.end(depth);
        view.dispatch(state.tr.delete(to, end).scrollIntoView());
      }
      return true;
    },
  },
}));
