import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';

/**
 * Auto-pairing for brackets and quotes, plus Markdown wrapping for selections.
 *
 * Markdown delimiters are only paired around a selection: pairing them on
 * collapsed input would fight the syntax input rules (`==x==`, `^x^`, `~x~`,
 * `**bold**`), which need the real closing characters to be typed.
 */
let options = { bracket: true, quote: true, markdown: true };

export const setAutoPairOptions = (next: any) => {
  options = {
    bracket: next?.autoPairBracket !== false,
    quote: next?.autoPairQuote !== false,
    markdown: next?.autoPairMarkdownSyntax !== false,
  };
};

const BRACKETS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' };
const QUOTES = ['"', "'"];
const MARKDOWN = ['*', '_', '~', '=', '$', '^', '`'];
const CLOSERS = new Set([...Object.values(BRACKETS), ...QUOTES]);

export const autoPairPlugin = $prose(() => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      const { state } = view;
      // Keep code blocks literal.
      if (state.selection.$from.parent.type.spec.code) return false;

      // Typing a closing character over an existing one moves the caret instead
      // of duplicating it (`()` + `)` -> `()`).
      if (from === to && CLOSERS.has(text) && state.doc.textBetween(from, from + 1) === text) {
        view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from + 1)));
        return true;
      }

      const pairable =
        (options.bracket && !!BRACKETS[text]) ||
        (options.quote && QUOTES.includes(text));

      if (from === to) {
        if (!pairable) return false;
        const close = BRACKETS[text] ?? text;
        const tr = state.tr.insertText(text + close, from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + text.length));
        view.dispatch(tr.scrollIntoView());
        return true;
      }

      // Wrap selections with brackets/quotes or Markdown delimiters.
      const wrap = pairable || (options.markdown && MARKDOWN.includes(text));
      if (!wrap) return false;
      const close = BRACKETS[text] ?? text;
      let tr = state.tr.insertText(text, from);
      tr = tr.insertText(close, to + text.length);
      tr = tr.setSelection(TextSelection.create(tr.doc, from + text.length, to + text.length));
      view.dispatch(tr.scrollIntoView());
      return true;
    },
  },
}));
