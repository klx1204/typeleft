import { $remark } from '@milkdown/kit/utils';

/**
 * "Preserve single line break" (#12).
 *
 * When enabled, a single newline inside a paragraph becomes a line break in the
 * WYSIWYG view instead of collapsing to a space. The export pipeline applies
 * the same rule through marked's `breaks` option.
 */
let enabled = false;

export const setSoftBreakEnabled = (value: unknown) => {
  enabled = value === true;
};

export const softBreakRemark = $remark('typeleftSoftBreak', () => function typeleftSoftBreak() {
  // A `break` node without `data.isInline` renders as a real `<br>`.
  const convert = (node: any) => {
    if (!node || !Array.isArray(node.children)) return;
    const next: any[] = [];
    for (const child of node.children) {
      if (child.type === 'break') {
        // commonmark's remark-line-break marks these as inline (a space);
        // clearing the flag makes the hardbreak render as `<br>`.
        if (child.data) delete child.data.isInline;
        next.push(child);
        continue;
      }
      if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
        const parts = child.value.split('\n');
        parts.forEach((part: string, index: number) => {
          if (index) next.push({ type: 'break' });
          if (part) next.push({ ...child, value: part });
        });
        continue;
      }
      convert(child);
      next.push(child);
    }
    node.children = next;
  };

  return (tree: any) => {
    if (enabled) convert(tree);
  };
});
