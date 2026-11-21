import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { Command, EditorState, Transaction } from '@milkdown/kit/prose/state';
import { findTable, selectionCell, TableMap, moveTableRow, moveTableColumn } from '@milkdown/kit/prose/tables';

/**
 * Row / column reordering (#48).
 *
 * `prosemirror-tables` already provides the structural commands; the helpers
 * here resolve the current cell and clamp the target index.
 */
export const currentCell = (state: EditorState) => {
  const table = findTable(state.selection.$from);
  if (!table) return null;
  const cellPos = selectionCell(state);
  if (!cellPos) return null;
  const map = TableMap.get(table.node);
  const cell = map.findCell(cellPos.pos - table.start);
  return { table, map, row: cell.top, col: cell.left };
};

const moveTo = (
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  axis: 'row' | 'col',
  from: number,
  to: number,
): boolean => {
  if (from === to) return false;
  const command = axis === 'row'
    ? moveTableRow({ from, to, select: true })
    : moveTableColumn({ from, to, select: true });
  return command(state, dispatch);
};

export const moveRowTo = (from: number, to: number): Command =>
  (state, dispatch) => moveTo(state, dispatch, 'row', from, to);

export const moveColumnTo = (from: number, to: number): Command =>
  (state, dispatch) => moveTo(state, dispatch, 'col', from, to);

export const moveRowBy = (delta: number): Command => (state, dispatch) => {
  const cell = currentCell(state);
  if (!cell) return false;
  const to = Math.max(0, Math.min(cell.map.height - 1, cell.row + delta));
  return moveTo(state, dispatch, 'row', cell.row, to);
};

export const moveColumnBy = (delta: number): Command => (state, dispatch) => {
  const cell = currentCell(state);
  if (!cell) return false;
  const to = Math.max(0, Math.min(cell.map.width - 1, cell.col + delta));
  return moveTo(state, dispatch, 'col', cell.col, to);
};

/** Alt + Arrow keys are the accessible alternative to dragging handles. */
export const tableMovesPlugin = $prose(() => new Plugin({
  props: {
    handleKeyDown(view, event) {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return false;
      const commands: Record<string, Command | undefined> = {
        ArrowUp: moveRowBy(-1),
        ArrowDown: moveRowBy(1),
        ArrowLeft: moveColumnBy(-1),
        ArrowRight: moveColumnBy(1),
      };
      const command = commands[event.key];
      if (!command) return false;
      event.preventDefault();
      return command(view.state, view.dispatch);
    },
  },
}));
