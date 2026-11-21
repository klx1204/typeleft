import { $remark } from '@milkdown/kit/utils';
import remarkBreaks from 'remark-breaks';

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
  return (tree: any) => {
    if (enabled) remarkBreaks()(tree);
  };
});
