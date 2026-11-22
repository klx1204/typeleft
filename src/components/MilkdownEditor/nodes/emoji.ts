import { $inputRule, $node, $remark } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import emojis from 'services/markdown/emojisJson.json';

/**
 * `:shortcode:` emoji (#70).
 *
 * The rendered node is an inline atom; the Markdown source keeps the shortcode
 * so copy/save rounds back to `:smile:`.
 */
let enabled = true;

export const setEmojiEnabled = (value: unknown) => {
  enabled = value !== false;
};

const byAlias = new Map<string, { emoji: string; shortcode: string }>();
for (const entry of emojis as any[]) {
  for (const alias of entry.aliases ?? []) {
    if (!byAlias.has(alias)) byAlias.set(String(alias).toLowerCase(), { emoji: entry.emoji, shortcode: alias });
  }
}

export const lookupEmoji = (shortcode: string) => byAlias.get(shortcode.toLowerCase());

const EMOJI = /:([a-z0-9_+-]+):/g;

const splitText = (value: string): any[] => {
  const out: any[] = [];
  let last = 0;
  for (const match of value.matchAll(EMOJI)) {
    const found = lookupEmoji(match[1]);
    if (!found) continue;
    const index = match.index ?? 0;
    if (index > last) out.push({ type: 'text', value: value.slice(last, index) });
    out.push({ type: 'emoji', shortcode: found.shortcode, value: found.emoji });
    last = index + match[0].length;
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out.length ? out : [{ type: 'text', value }];
};

const walk = (node: any): void => {
  if (!Array.isArray(node.children)) return;
  const next: any[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes(':')) {
      next.push(...splitText(child.value));
      continue;
    }
    walk(child);
    next.push(child);
  }
  node.children = next;
};

export const emojiRemark = $remark('typeleftEmoji', () => function typeleftEmoji() {
  return (tree: any) => {
    if (!enabled) return;
    walk(tree);
  };
});

export const emojiNode = $node('emoji', () => ({
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  attrs: {
    shortcode: { default: '' },
    value: { default: '' },
  },
  parseDOM: [{
    tag: 'span[data-type="emoji"]',
    getAttrs: (dom: any) => ({ shortcode: dom.getAttribute('data-shortcode') ?? '', value: dom.textContent ?? '' }),
  }],
  toDOM: (node: any) => ['span', {
    'data-type': 'emoji',
    'data-shortcode': node.attrs.shortcode,
    class: 'md-emoji',
  }, node.attrs.value],
  parseMarkdown: {
    match: (node: any) => node.type === 'emoji',
    runner: (state: any, node: any, type: any) => {
      state.addNode(type, { shortcode: node.shortcode ?? '', value: node.value ?? '' });
    },
  },
  toMarkdown: {
    match: (node: any) => node.type.name === 'emoji',
    runner: (state: any, node: any) => {
      state.addNode('text', undefined, `:${node.attrs.shortcode}:`);
    },
  },
}));

export const emojiInputRule = $inputRule(() => new InputRule(
  /:([a-z0-9_+-]+):$/,
  (state, match, start, end) => {
    if (!enabled) return null;
    const found = lookupEmoji(match[1]);
    if (!found) return null;
    const type = state.schema.nodes.emoji;
    if (!type) return null;
    return state.tr.replaceWith(start, end, type.create({ shortcode: found.shortcode, value: found.emoji }));
  },
));
