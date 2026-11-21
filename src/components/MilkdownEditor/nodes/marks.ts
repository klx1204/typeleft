import { $markSchema, $remark, $inputRule } from '@milkdown/kit/utils';
import { markRule } from '@milkdown/kit/prose';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { strikethroughSchema } from '@milkdown/kit/preset/gfm';
import { findAndReplace } from 'mdast-util-find-and-replace';

/**
 * `==highlight==`, `^superscript^` and `~subscript~`.
 *
 * markdown has no native syntax for these, so a remark transform rewrites the
 * matching text into custom mdast nodes and a stringify handler writes them
 * back verbatim. Marks keep the source round-trip stable.
 */
let superSubEnabled = true;

/** The `superSubScript` setting; highlight is always available. */
export const setSuperSubEnabled = (enabled: boolean) => {
  superSubEnabled = enabled;
};

export const marksRemark = $remark('typeleftMarks', () => function typeleftMarks(this: any) {
  const data = this.data();
  const extensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = []);
  extensions.push({
    handlers: {
      highlight: (node: any, _parent: any, state: any) =>
        '==' + state.containerPhrasing(node, { before: '==', after: '==' }) + '==',
      superscript: (node: any, _parent: any, state: any) =>
        '^' + state.containerPhrasing(node, { before: '^', after: '^' }) + '^',
      subscript: (node: any, _parent: any, state: any) =>
        '~' + state.containerPhrasing(node, { before: '~', after: '~' }) + '~',
      underline: (node: any, _parent: any, state: any) =>
        '<u>' + state.containerPhrasing(node, { before: '<u>', after: '</u>' }) + '</u>',
    },
  });

  return (tree: any) => {
    const rules: any[] = [
      [/==([^=\n]+)==/g, (_: string, text: string) => ({
        type: 'highlight',
        children: [{ type: 'text', value: text }],
      }) as any],
    ];
    if (superSubEnabled) {
      rules.push(
        [/\^([^\s^\n]+)\^/g, (_: string, text: string) => ({
          type: 'superscript',
          children: [{ type: 'text', value: text }],
        }) as any],
        [/(?<!~)~([^~\s\n]+)~(?!~)/g, (_: string, text: string) => ({
          type: 'subscript',
          children: [{ type: 'text', value: text }],
        }) as any],
      );
    }
    findAndReplace(tree, rules);

    // `<u>…</u>` / `<ins>…</ins>` become an editable underline mark. Micromark
    // may split the open tag, text and close tag into separate html nodes.
    const convertUnderline = (node: any) => {
      if (!node || !Array.isArray(node.children)) return;
      const children = node.children;
      const out: any[] = [];
      for (let i = 0; i < children.length; i += 1) {
        const child = children[i];
        if (child.type === 'html') {
          const trimmed = (child.value || '').trim();
          const open = /^<(u|ins)>$/i.exec(trimmed);
          if (open) {
            const tag = open[1].toLowerCase();
            let close = -1;
            for (let j = i + 1; j < children.length; j += 1) {
              const candidate = children[j];
              if (candidate.type === 'html' && new RegExp(`^</${tag}>$`, 'i').test((candidate.value || '').trim())) {
                close = j;
                break;
              }
            }
            if (close !== -1) {
              out.push({ type: 'underline', children: children.slice(i + 1, close) });
              i = close;
              continue;
            }
          }
          const full = /^<(u|ins)>([\s\S]*)<\/\1>$/i.exec(trimmed);
          if (full && !/[<>]/.test(full[2])) {
            out.push({ type: 'underline', children: [{ type: 'text', value: full[2] }] });
            continue;
          }
        }
        convertUnderline(child);
        out.push(child);
      }
      node.children = out;
    };
    convertUnderline(tree);
  };
});

const markSchema = (name: string, tag: string) => $markSchema(name, () => ({
  parseDOM: [{ tag }],
  toDOM: () => [tag, 0],
  parseMarkdown: {
    match: (node: any) => node.type === name,
    runner: (state: any, node: any, markType: any) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === name,
    runner: (state: any, mark: any) => {
      state.withMark(mark, name);
    },
  },
}));

export const highlightMark = markSchema('highlight', 'mark');
export const superscriptMark = markSchema('superscript', 'sup');
export const subscriptMark = markSchema('subscript', 'sub');

export const underlineMark = $markSchema('underline', () => ({
  parseDOM: [{ tag: 'u' }, { tag: 'ins' }],
  toDOM: () => ['u', 0],
  parseMarkdown: {
    match: (node: any) => node.type === 'underline',
    runner: (state: any, node: any, markType: any) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark: any) => mark.type.name === 'underline',
    runner: (state: any, mark: any) => {
      state.withMark(mark, 'underline');
    },
  },
}));

/** `markRule` wrapper that honours the `superSubScript` toggle. */
const gatedMarkRule = (regexp: RegExp, markName: string, gate = false) => (ctx: any) => new InputRule(
  regexp,
  (state, match, start, end) => {
    if (gate && !superSubEnabled) return null;
    const group = match[match.length - 1];
    if (!group || !group.trim()) return null;
    const type = state.schema.marks[markName];
    if (!type) return null;
    if (state.doc.rangeHasMark(start, end, state.schema.marks.inlineCode)) return null;
    const fullMatch = match[0];
    const startSpaces = fullMatch.search(/\S/);
    const textStart = start + fullMatch.indexOf(group);
    const textEnd = textStart + group.length;
    const tr = state.tr;
    if (textEnd < end) tr.delete(textEnd, end);
    if (textStart > start) tr.delete(start + startSpaces, textStart);
    tr.addMark(start, start + startSpaces + group.length, type.create());
    return tr;
  }
);

export const highlightInputRule = $inputRule(gatedMarkRule(/==([^=\n]+)==$/, 'highlight'));
export const superscriptInputRule = $inputRule(gatedMarkRule(/\^([^\s^\n]+)\^$/, 'superscript', true));
export const subscriptInputRule = $inputRule(gatedMarkRule(/(?<!~)~([^~\s\n]+)~$/, 'subscript', true));

// The preset's strikethrough rule also accepts a single tilde, which would
// steal `~sub~`. Only `~~strike~~` is a strikethrough here.
export const strikethroughInputRule = $inputRule((ctx) =>
  markRule(/~~([^~\n]+)~~$/, strikethroughSchema.type(ctx))
);

export const markPlugins = [
  marksRemark,
  highlightMark,
  superscriptMark,
  subscriptMark,
  highlightInputRule,
  superscriptInputRule,
  subscriptInputRule,
  strikethroughInputRule,
];
