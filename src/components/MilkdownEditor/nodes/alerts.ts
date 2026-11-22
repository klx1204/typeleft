import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';

/**
 * GitHub Alerts (#53): `> [!NOTE]` blockquotes.
 *
 * The source stays a normal blockquote, so Markdown round-trips untouched; a
 * decoration hides the marker and adds the callout styling.
 */
const KEY = new PluginKey('typeleftAlerts');
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;

let enabled = true;

export const setAlertsEnabled = (value: unknown) => {
  enabled = value !== false;
};

export const alertsPlugin = $prose(() => new Plugin({
  key: KEY,
  props: {
    decorations(state) {
      if (!enabled) return DecorationSet.empty;
      const decorations: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name !== 'blockquote') return;
        const first = node.firstChild;
        if (!first || first.type.name !== 'paragraph') return;
        const match = ALERT.exec(first.textContent);
        if (!match) return;
        const type = match[1].toUpperCase();
        decorations.push(Decoration.node(pos, pos + node.nodeSize, {
          class: `md-alert md-alert-${type.toLowerCase()}`,
        }));
        // blockquote > paragraph > leading text
        decorations.push(Decoration.inline(pos + 2, pos + 2 + match[0].length, {
          class: 'md-alert-marker',
        }));
        return false;
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
}));
