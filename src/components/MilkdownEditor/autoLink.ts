import { $prose, $remark } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';

/** Auto-link typed URLs (#75). The setting also disables parsed autolinks. */
let enabled = true;

export const setAutoLinkEnabled = (value: unknown) => {
  enabled = value !== false;
};

const URL_AT_END = /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)$/;

const linkableUrl = (view: any, from: number): { url: string; start: number } | null => {
  const { state } = view;
  const { $from } = state.selection;
  const start = $from.start();
  const before = state.doc.textBetween(start, from, '\n', '\n');
  const match = URL_AT_END.exec(before);
  if (!match) return null;
  const url = match[0];
  const urlStart = from - url.length;
  if (state.doc.rangeHasMark(urlStart, from, state.schema.marks.link)) return null;
  return { url, start: urlStart };
};

const applyLink = (view: any, from: number) => {
  const found = linkableUrl(view, from);
  if (!found) return false;
  const mark = view.state.schema.marks.link;
  if (!mark) return false;
  const href = found.url.startsWith('www.') ? `https://${found.url}` : found.url;
  view.dispatch(view.state.tr.addMark(found.start, from, mark.create({ href })));
  return true;
};

export const autoLinkPlugin = $prose(() => new Plugin({
  props: {
    handleTextInput(view, from, to, text) {
      if (!enabled || text !== ' ' || from !== to) return false;
      if (view.state.selection.$from.parent.type.spec.code) return false;
      // Mark, then let the space itself be inserted normally.
      applyLink(view, from);
      return false;
    },
    handleKeyDown(view, event) {
      if (!enabled || event.key !== 'Enter' || event.shiftKey) return false;
      if (view.state.selection.$from.parent.type.spec.code) return false;
      if (view.state.selection.from !== view.state.selection.to) return false;
      applyLink(view, view.state.selection.from);
      return false;
    },
  },
}));

const visitLinks = (node: any) => {
  if (!node?.children) return;
  node.children = node.children.flatMap((child: any) => {
    if (child.type === 'link') {
      const text = child.children?.map((c: any) => c.value ?? '').join('') ?? '';
      const isLiteral = text.trim() === child.url || text.trim() === child.url.replace(/^https?:\/\//, '');
      if (isLiteral) return [{ type: 'text', value: text }];
    }
    visitLinks(child);
    return [child];
  });
};

export const autoLinkRemark = $remark('typeleftAutoLink', () => function typeleftAutoLink() {
  return (tree: any) => {
    if (!enabled) visitLinks(tree);
  };
});
