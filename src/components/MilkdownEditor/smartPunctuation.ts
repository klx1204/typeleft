import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';

/**
 * Smart quotes and smart dashes (#9 / #10).
 *
 * Runs before the auto-pair plugin: a curly quote is inserted as a pair, and
 * when `autoPairQuote` is off only the single (opening/closing) character is
 * produced.
 */
let options = { quotes: true, dashes: true, pairQuotes: true };

export const setSmartPunctuationOptions = (next: any) => {
  options = {
    quotes: next?.smartQuotes !== false,
    dashes: next?.smartDashes !== false,
    pairQuotes: next?.autoPairQuote !== false,
  };
};

const WORD = /[\p{L}\p{N}]/u;
const OPEN_BEFORE = /[\s([{<—–“‘"'/]/;

const textBefore = (state: any, from: number, count: number): string =>
  state.doc.textBetween(Math.max(0, from - count), from, '\n', '\n');

const charAt = (state: any, pos: number): string =>
  pos < state.doc.content.size ? state.doc.textBetween(pos, pos + 1, '\n', '\n') : '';

export const smartPunctuationPlugin = $prose(() => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      const { state } = view;
      if (state.selection.$from.parent.type.spec.code) return false;

      const replace = (value: string, selectFrom?: number, selectTo?: number) => {
        const tr = state.tr.insertText(value, from, to);
        tr.setSelection(TextSelection.create(
          tr.doc,
          selectFrom ?? from + value.length,
          selectTo ?? from + value.length,
        ));
        view.dispatch(tr.scrollIntoView());
        return true;
      };

      if (options.quotes && (text === '"' || text === "'")) {
        const previous = textBefore(state, from, 1);
        const apostrophe = text === "'" && WORD.test(previous);
        const opening = !previous || OPEN_BEFORE.test(previous);
        const [open, close] = text === '"' ? ['“', '”'] : ['‘', '’'];

        if (apostrophe) return replace(close);
        // Skip over the closing quote that the opener already inserted.
        if (from === to && charAt(state, from) === close) {
          const tr = state.tr.setSelection(TextSelection.create(state.doc, from + 1));
          view.dispatch(tr);
          return true;
        }
        if (from !== to) {
          // Keep the selected text and wrap it.
          let tr = state.tr.insertText(open, from);
          tr = tr.insertText(close, to + open.length);
          tr = tr.setSelection(TextSelection.create(tr.doc, from + open.length, to + open.length));
          view.dispatch(tr.scrollIntoView());
          return true;
        }
        if (!opening) return replace(close);
        if (options.pairQuotes) return replace(open + close, from + 1, from + 1);
        return replace(open);
      }

      if (options.dashes && text === '-') {
        const previousTwo = textBefore(state, from, 2);
        // `--` becomes an en dash; typing a third dash promotes it to em dash.
        if (textBefore(state, from, 1) === '–') {
          const tr = state.tr.insertText('—', from - 1, from);
          tr.setSelection(TextSelection.create(tr.doc, from));
          view.dispatch(tr.scrollIntoView());
          return true;
        }
        if (previousTwo === '--') {
          const tr = state.tr.insertText('—', from - 2, from);
          tr.setSelection(TextSelection.create(tr.doc, from - 1));
          view.dispatch(tr.scrollIntoView());
          return true;
        }
        if (previousTwo.endsWith('-')) {
          const tr = state.tr.insertText('–', from - 1, from);
          tr.setSelection(TextSelection.create(tr.doc, from));
          view.dispatch(tr.scrollIntoView());
          return true;
        }
      }

      if (options.dashes && text === '.') {
        if (textBefore(state, from, 2) === '..') {
          const tr = state.tr.insertText('…', from - 2, from);
          tr.setSelection(TextSelection.create(tr.doc, from - 1));
          view.dispatch(tr.scrollIntoView());
          return true;
        }
      }

      return false;
    },
  },
}));
