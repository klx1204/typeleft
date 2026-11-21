import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { EditorView } from '@milkdown/kit/prose/view';

/**
 * Spell checking with a loaded dictionary (#21 / #174).
 *
 * The WebView's native checker has no way to manage dictionaries, so Typeleft
 * ships a Hunspell English dictionary and layers decorations on top. Words in
 * `customDictionary` (Settings → Editor) are added to the dictionary.
 */
export const WORD_PATTERN = /[A-Za-z][A-Za-z'’-]{2,}/g;

let checker: any = null;
let loading: Promise<void> | null = null;
let customWords = new Set<string>();

const normalize = (word: string) => word.toLowerCase().replace(/[’]/g, "'");

export const setCustomDictionary = (raw: unknown): void => {
  const words = typeof raw === 'string' ? raw.split(/[,\n;]+/) : Array.isArray(raw) ? raw : [];
  customWords = new Set(words.map(word => normalize(String(word).trim())).filter(Boolean));
  if (checker) {
    for (const word of customWords) checker.add(word);
  }
};

export const extractWords = (text: string): string[] => {
  const matches = text.match(WORD_PATTERN) || [];
  return Array.from(new Set(matches.filter(word => word.length > 2)));
};

const load = async (): Promise<void> => {
  if (checker) return;
  if (!loading) {
    loading = (async () => {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import('nspell'),
        import('../../assets/spell/en.aff?raw'),
        import('../../assets/spell/en.dic?raw'),
      ]);
      checker = nspell(aff.default, dic.default);
      for (const word of customWords) checker.add(word);
    })();
  }
  await loading;
};

export const isMisspelled = (word: string): boolean => {
  if (!checker) return false;
  const normalized = normalize(word);
  if (customWords.has(normalized)) return false;
  // Ignore all-caps acronyms and words with digits.
  if (/^\d/.test(word) || (word.length > 1 && word === word.toUpperCase())) return false;
  return !checker.correct(word.replace(/’/g, "'"));
};

export const suggestWord = (word: string): string[] => {
  if (!checker) return [];
  try {
    return checker.suggest(word.replace(/’/g, "'")).slice(0, 5);
  } catch {
    return [];
  }
};

export const spellcheckKey = new PluginKey<DecorationSet>('TYPLEFT_SPELLCHECK');

export const spellcheckPlugin = $prose(() => new Plugin({
  key: spellcheckKey,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, previous) {
      const meta = tr.getMeta(spellcheckKey);
      if (meta) return meta as DecorationSet;
      return previous.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return spellcheckKey.getState(state) ?? DecorationSet.empty;
    },
  },
}));

let running = false;
let queued = false;

/** Recompute decorations; safe to call on every change. */
export const runSpellcheck = async (view: EditorView): Promise<void> => {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  try {
    await load();
    if (!view.dom.isConnected) return;
    const decorations: Decoration[] = [];
    view.state.doc.descendants((node, pos, parent) => {
      if (node.type.spec.code || parent?.type.spec.code) return false;
      if (!node.isText || !node.text) return;
      if (node.marks.some(mark => mark.type.name === 'inlineCode' || mark.type.name === 'code')) return;
      WORD_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WORD_PATTERN.exec(node.text))) {
        if (!isMisspelled(match[0])) continue;
        decorations.push(Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: 'tl-spell-error',
          'data-word': match[0],
        }));
        if (decorations.length >= 500) return false;
      }
      return;
    });
    view.dispatch(view.state.tr.setMeta(spellcheckKey, DecorationSet.create(view.state.doc, decorations)));
  } finally {
    running = false;
    if (queued) {
      queued = false;
      window.setTimeout(() => { void runSpellcheck(view); }, 50);
    }
  }
};
