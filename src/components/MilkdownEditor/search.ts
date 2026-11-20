import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';

export interface SearchOptions {
  caseSensitive?: boolean;
  regexp?: boolean;
  wholeWord?: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
  /** Capture groups of the match, used to expand `$1` in replacements. */
  groups?: string[];
}

export interface SearchState {
  query: string;
  options: SearchOptions;
  matches: SearchMatch[];
  active: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>('TYPLEFT_SEARCH');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildRegexp = (query: string, options: SearchOptions): RegExp | null => {
  if (!query) return null;
  let pattern = options.regexp ? query : escapeRegExp(query);
  if (options.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  try {
    return new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
};

/**
 * Search inside each text block over its flattened inline text, so a match can
 * span marks (e.g. `**bo**ld`) instead of only living inside a single text node.
 */
const collectMatches = (doc: ProseNode, query: string, options: SearchOptions): SearchMatch[] => {
  const matches: SearchMatch[] = [];
  const re = buildRegexp(query, options);
  if (!re) return matches;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        const start = pos + 1 + offset;
        for (let i = 0; i < child.text!.length; i += 1) positions.push(start + i);
        text += child.text;
      } else if (child.isInline) {
        // Atoms (images, math, footnote refs) behave as one character.
        positions.push(pos + 1 + offset);
        text += '\uFFFC';
      }
    });
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) { re.lastIndex += 1; continue; }
      const first = match.index;
      const last = first + match[0].length - 1;
      const from = positions[first];
      const to = positions[last] + 1;
      if (from == null || to == null) continue;
      matches.push({ from, to, groups: match.slice() });
    }
    return false;
  });
  return matches;
};

const buildDecorations = (doc: ProseNode, matches: SearchMatch[], active: number) => {
  const decorations = matches.map((match, index) =>
    Decoration.inline(match.from, match.to, {
      class: index === active ? 'typeleft-search-match typeleft-search-active' : 'typeleft-search-match',
    })
  );
  return DecorationSet.create(doc, decorations);
};

const expandReplacement = (template: string, groups?: string[]): string => {
  if (!groups) return template;
  return template.replace(/\$(\d{1,2}|&)/g, (whole, key: string) => {
    if (key === '&') return groups[0] ?? whole;
    const index = Number(key);
    return groups[index] ?? whole;
  });
};

const makeState = (doc: ProseNode, query: string, options: SearchOptions, active = 0): SearchState => {
  const matches = collectMatches(doc, query, options);
  return {
    query,
    options,
    matches,
    active: matches.length ? Math.min(active, matches.length - 1) : 0,
    decorations: buildDecorations(doc, matches, active),
  };
};

export const searchPlugin = $prose(() => new Plugin<SearchState>({
  key: searchKey,
  state: {
    init: (_, { doc }) => makeState(doc, '', {}, 0),
    apply: (tr, previous, _oldState, newState) => {
      const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
      if (meta) {
        const query = meta.query ?? previous.query;
        const options = meta.options ?? previous.options;
        const matches = meta.matches ?? collectMatches(newState.doc, query, options);
        const active = meta.active ?? previous.active;
        return {
          query,
          options,
          matches: matches as { from: number; to: number }[],
          active,
          decorations: buildDecorations(newState.doc, matches as { from: number; to: number }[], active),
        };
      }
      if (tr.docChanged) {
        const matches = collectMatches(newState.doc, previous.query, previous.options);
        return {
          ...previous,
          matches,
          active: matches.length ? Math.min(previous.active, matches.length - 1) : 0,
          decorations: buildDecorations(newState.doc, matches, previous.active),
        };
      }
      return previous;
    },
  },
  props: {
    decorations(state) {
      return searchKey.getState(state)?.decorations;
    },
  },
}));

export const getSearchState = (view: EditorView): SearchState | undefined =>
  searchKey.getState(view.state);

export const setSearchQuery = (view: EditorView, query: string, options: SearchOptions) => {
  const state = makeState(view.state.doc, query, options, 0);
  const tr = view.state.tr.setMeta(searchKey, { query, options, matches: state.matches, active: 0 });
  view.dispatch(tr);
  scrollToActiveMatch(view);
  return state.matches.length;
};

const scrollToActiveMatch = (view: EditorView) => {
  requestAnimationFrame(() => {
    const el = view.dom.querySelector('.typeleft-search-active') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
};

export const findNextMatch = (view: EditorView, direction: 1 | -1 = 1) => {
  const state = getSearchState(view);
  if (!state || !state.matches.length) return false;
  const next = (state.active + direction + state.matches.length) % state.matches.length;
  view.dispatch(view.state.tr.setMeta(searchKey, { active: next }));
  const match = state.matches[next];
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, match.from, match.to)));
  scrollToActiveMatch(view);
  return true;
};

export const replaceCurrentMatch = (view: EditorView, replacement: string) => {
  const state = getSearchState(view);
  if (!state || !state.matches.length) return false;
  const match = state.matches[state.active] ?? state.matches[0];
  const expanded = expandReplacement(replacement, match.groups);
  const tr = view.state.tr.insertText(expanded, match.from, match.to);
  view.dispatch(tr);
  findNextMatch(view, 1);
  return true;
};

export const replaceAllMatches = (view: EditorView, replacement: string) => {
  const state = getSearchState(view);
  if (!state || !state.matches.length) return 0;
  const tr = view.state.tr;
  for (const match of [...state.matches].reverse()) {
    tr.insertText(expandReplacement(replacement, match.groups), match.from, match.to);
  }
  view.dispatch(tr);
  return state.matches.length;
};
