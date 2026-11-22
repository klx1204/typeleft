/**
 * Regenerate src/services/markdown/emojisJson.json from emojibase-data (MIT).
 * Usage: bun run build:emoji
 */
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url);
const DATA = new URL('node_modules/emojibase-data/en/data.json', ROOT);
const SHORTCODES = new URL('node_modules/emojibase-data/en/shortcodes/emojibase.json', ROOT);
const OUT = new URL('src/services/markdown/emojisJson.json', ROOT);

const GROUPS = [
  'Smileys & Emotion',
  'People & Body',
  'Component',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
];

const data = JSON.parse(await readFile(DATA, 'utf8'));
const shortcodes = JSON.parse(await readFile(SHORTCODES, 'utf8'));

const output = [];
for (const item of data) {
  const rawAliases = shortcodes[item.hexcode];
  const aliases = Array.isArray(rawAliases) ? rawAliases : (rawAliases ? [rawAliases] : []);
  if (!item.emoji || aliases.length === 0) continue;
  output.push({
    emoji: item.emoji,
    description: item.label ?? '',
    category: GROUPS[item.group] ?? '',
    aliases,
    tags: item.tags ?? [],
  });
}

await writeFile(OUT, JSON.stringify(output));
console.log(`wrote ${output.length} emoji to ${OUT.pathname}`);
