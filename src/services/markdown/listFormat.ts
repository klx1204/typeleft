/**
 * List indentation (#30).
 *
 * remark-stringify aligns nested content to the parent marker (2 spaces under
 * "- ", 3 under "1. "). Typora's `listIndentation` adds N-1 extra spaces per
 * nesting level; extra indentation is still valid CommonMark, so the document
 * keeps its structure while the source matches the preference.
 *
 * `dfm` (Daring Fireball) targets four columns per level.
 */
const MAX_EXTRA = 3;

export const applyListIndentation = (markdown: string, setting: unknown): string => {
  const dfm = setting === 'dfm';
  const count = dfm ? 4 : Number(setting);
  if (!Number.isFinite(count)) return markdown;
  const extra = Math.max(0, Math.min(MAX_EXTRA, Math.floor(count) - 1));
  if (!extra && !dfm) return markdown;

  const lines = markdown.split('\n');
  const contentColumns: number[] = [];
  const shifts: number[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = /^(\s*)(`{3,}|~{3,})/.exec(line);

    if (inFence) {
      // Fence contents stay verbatim; only the closing marker ends the block.
      if (fence) inFence = false;
      continue;
    }

    const leading = line.length - line.trimStart().length;

    if (fence) {
      while (contentColumns.length && leading < contentColumns[contentColumns.length - 1]) {
        contentColumns.pop(); shifts.pop();
      }
      const shift = shifts[shifts.length - 1] ?? 0;
      if (shift > 0) lines[i] = ' '.repeat(leading + shift) + line.slice(leading);
      inFence = true;
      continue;
    }

    if (!line.trim()) continue;

    while (contentColumns.length && leading < contentColumns[contentColumns.length - 1]) {
      contentColumns.pop(); shifts.pop();
    }
    const depth = contentColumns.length;
    const marker = /^([-*+]|\d{1,9}[.)])(\s+)/.exec(line.slice(leading));

    if (marker) {
      const shift = dfm ? Math.max(0, depth * 4 - leading) : depth * extra;
      // Depth detection uses the original columns, not the shifted ones.
      contentColumns.push(leading + marker[1].length + marker[2].length);
      shifts.push(shift);
      if (shift > 0) lines[i] = ' '.repeat(leading + shift) + line.slice(leading);
    } else {
      const shift = shifts[shifts.length - 1] ?? 0;
      if (shift > 0) lines[i] = ' '.repeat(leading + shift) + line.slice(leading);
    }
  }

  return lines.join('\n');
};
