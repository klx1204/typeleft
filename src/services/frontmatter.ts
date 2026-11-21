/**
 * Minimal front-matter reader (#51).
 *
 * Handles the flat YAML/TOML metadata Typora users write in practice: scalars,
 * quoted strings, inline arrays and simple lists. Nested objects are kept as
 * raw text; the export overrides have their own parser in `docExport.ts`.
 */

export interface FrontmatterInfo {
  format: 'yaml' | 'toml' | 'none';
  data: Record<string, any>;
}

const scalar = (raw: string): any => {
  const value = raw.trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^\[.*\]$/.test(value)) {
    return value.slice(1, -1).split(',').map(part => scalar(part)).filter(part => part !== '');
  }
  return value;
};

export const parseFrontmatter = (markdown: string): FrontmatterInfo => {
  const source = markdown || '';
  const yaml = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const toml = yaml ? null : /^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+/.exec(source);
  const match = yaml || toml;
  if (!match) return { format: 'none', data: {} };

  const data: Record<string, any> = {};
  let listKey = '';

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (listItem) {
      if (listKey) {
        const current = data[listKey];
        data[listKey] = Array.isArray(current) ? [...current, scalar(listItem[1])] : [scalar(listItem[1])];
      }
      continue;
    }
    const entry = /^\s*([A-Za-z][\w-]*)\s*[:=]\s*(.*)$/.exec(line);
    if (!entry) continue;
    const [, key, raw] = entry;
    listKey = raw.trim() ? '' : key;
    data[key] = raw.trim() ? scalar(raw) : [];
  }

  return { format: yaml ? 'yaml' : 'toml', data };
};
