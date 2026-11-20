import { $remark } from '@milkdown/kit/utils';
import { tableSchema, tableCellSchema, tableHeaderSchema } from '@milkdown/kit/preset/gfm';
import { visit } from 'unist-util-visit';

/**
 * GFM tables cannot express column widths. When the user resizes a column we
 * write the widths into an HTML comment after the table:
 *
 *   | a | b |
 *   | - | - |
 *
 *   <!-- tl-cw: 120,220 -->
 *
 * The transform below folds that comment back into the table cells (as the
 * `colwidth` attribute prosemirror-tables uses), so nothing else changes.
 */
const WIDTH_RE = /^\s*<!--\s*tl-cw:\s*([\d,\s]+?)\s*-->\s*$/;

export const tableWidthRemark = $remark('typeleftTableWidths', () => function typeleftTableWidths() {
  return (tree: any) => {
    const children: any[] = tree.children || [];
    let lastTable: any = null;
    for (let i = 0; i < children.length; i += 1) {
      const block = children[i];
      if (block.type === 'table') {
        lastTable = block;
        continue;
      }
      // Depending on the micromark extensions the comment can arrive either as
      // a block `html` node or as an inline one inside a paragraph.
      const htmlNode = block.type === 'html'
        ? block
        : block.type === 'paragraph'
          ? (block.children || []).find((c: any) => c.type === 'html' && WIDTH_RE.test(c.value || ''))
          : null;
      if (!htmlNode || !lastTable) continue;
      const match = WIDTH_RE.exec(htmlNode.value || '');
      if (!match) continue;
      const widths = match[1].split(',').map(v => Number(v.trim())).filter(v => Number.isFinite(v) && v > 0);
      if (!widths.length) continue;
      lastTable.data = lastTable.data || {};
      lastTable.data.colwidths = widths;
      for (const row of lastTable.children || []) {
        (row.children || []).forEach((cell: any, col: number) => {
          if (widths[col]) {
            cell.data = cell.data || {};
            cell.data.colwidth = [widths[col]];
          }
        });
      }
      if (block.type === 'html') {
        children.splice(i, 1);
        i -= 1;
      } else {
        block.children = block.children.filter((c: any) => c !== htmlNode);
        if (!block.children.length) {
          children.splice(i, 1);
          i -= 1;
        }
      }
    }
  };
});

const cellRunner = (base: any) => (state: any, node: any, type: any) => {
  const colwidth = node.data?.colwidth ?? null;
  state.openNode(type, { alignment: node.align, colwidth });
  state.openNode(state.schema.nodes.paragraph);
  state.next(node.children);
  state.closeNode();
  state.closeNode();
};

export const tableCellWithWidth = tableCellSchema.extendSchema((prev) => (ctx: any) => {
  const base = prev(ctx);
  return {
    ...base,
    parseMarkdown: { match: base.parseMarkdown.match, runner: cellRunner(base) },
  };
});

export const tableHeaderWithWidth = tableHeaderSchema.extendSchema((prev) => (ctx: any) => {
  const base = prev(ctx);
  return {
    ...base,
    parseMarkdown: { match: base.parseMarkdown.match, runner: cellRunner(base) },
  };
});

export const tableWithWidth = tableSchema.extendSchema((prev) => (ctx: any) => {
  const base = prev(ctx);
  return {
    ...base,
    toMarkdown: {
      match: base.toMarkdown.match,
      runner: (state: any, node: any) => {
        const firstRow = node.content.firstChild;
        const widths: number[] = [];
        firstRow?.content.forEach((cell: any) => {
          const width = Array.isArray(cell.attrs.colwidth) ? cell.attrs.colwidth[0] : null;
          widths.push(Number(width) || 0);
        });
        base.toMarkdown.runner(state, node);
        if (widths.length && widths.every(w => w > 0)) {
          state.addNode('html', undefined, `<!-- tl-cw: ${widths.join(',')} -->`);
        }
      },
    },
  };
});
