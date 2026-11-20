import { $markSchema, $remark, $inputRule } from '@milkdown/kit/utils';
import { markRule } from '@milkdown/kit/prose';
import { findAndReplace } from 'mdast-util-find-and-replace';

/**
 * `==highlight==`, `^superscript^` and `~subscript~`.
 *
 * markdown has no native syntax for these, so a remark transform rewrites the
 * matching text into custom mdast nodes and a stringify handler writes them
 * back verbatim. Marks keep the source round-trip stable.
 */
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
    },
  });

  return (tree: any) => {
    findAndReplace(tree, [
      [/==([^=\n]+)==/g, (_: string, text: string) => ({
        type: 'highlight',
        children: [{ type: 'text', value: text }],
      }) as any],
      [/\^([^\s^\n]+)\^/g, (_: string, text: string) => ({
        type: 'superscript',
        children: [{ type: 'text', value: text }],
      }) as any],
      [/(?<!~)~([^~\s\n]+)~(?!~)/g, (_: string, text: string) => ({
        type: 'subscript',
        children: [{ type: 'text', value: text }],
      }) as any],
    ]);
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

export const highlightInputRule = $inputRule((ctx) =>
  markRule(/==([^=\n]+)==$/, highlightMark.type(ctx))
);
export const superscriptInputRule = $inputRule((ctx) =>
  markRule(/\^([^\s^\n]+)\^$/, superscriptMark.type(ctx))
);
export const subscriptInputRule = $inputRule((ctx) =>
  markRule(/(?<!~)~([^~\s\n]+)~$/, subscriptMark.type(ctx))
);

export const markPlugins = [
  marksRemark,
  highlightMark,
  superscriptMark,
  subscriptMark,
  highlightInputRule,
  superscriptInputRule,
  subscriptInputRule,
];
