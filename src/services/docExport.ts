/**
 * Per-document export overrides (#152).
 *
 * A document may carry its own export settings in YAML front matter:
 *
 * ```yaml
 * ---
 * export:
 *   fileName: notes.html
 *   includeCss: false
 *   includeToc: false
 *   postAction: open-file
 * ---
 * ```
 *
 * Only the small `export:` block is read; a full YAML parser would be overkill
 * for a handful of scalar values.
 */

const parseScalar = (raw: string): any => {
  const value = raw.trim().replace(/^["']|["']$/g, '');
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
};

export const parseDocumentExport = (markdown: string): Record<string, any> => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown || '');
  if (!match) return {};

  const result: Record<string, any> = {};
  let inside = false;
  let blockIndent = 0;

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const entry = /^(\s*)([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!entry) continue;
    const [, spaces, key, raw] = entry;
    if (!inside) {
      if (key === 'export' && !raw.trim()) {
        inside = true;
        blockIndent = spaces.length;
      }
      continue;
    }
    if (spaces.length <= blockIndent) {
      inside = false;
      continue;
    }
    result[key] = parseScalar(raw);
  }

  return result;
};
