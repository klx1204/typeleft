import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { t } from 'services/i18n';
import type { EditorView } from '@milkdown/kit/prose/view';

export interface SlashItem {
  id: string;
  /** i18n key for the visible label. */
  label: string;
  hint?: string;
  keywords: string;
}

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'h1', label: 'Heading 1', hint: '#', keywords: 'heading h1 title 标题' },
  { id: 'h2', label: 'Heading 2', hint: '##', keywords: 'heading h2 标题' },
  { id: 'h3', label: 'Heading 3', hint: '###', keywords: 'heading h3 标题' },
  { id: 'bullet', label: 'Bullet List', hint: '-', keywords: 'bullet list ul 无序 列表' },
  { id: 'ordered', label: 'Ordered List', hint: '1.', keywords: 'ordered list ol 有序 编号' },
  { id: 'task', label: 'Task List', hint: '[ ]', keywords: 'task todo checkbox 任务 待办' },
  { id: 'quote', label: 'Quote Block', hint: '>', keywords: 'quote blockquote 引用' },
  { id: 'code', label: 'Code Block', hint: '```', keywords: 'code fence 代码' },
  { id: 'table', label: 'Table', hint: 'grid', keywords: 'table 表格' },
  { id: 'emoji', label: 'Emoji', hint: '😀', keywords: 'emoji smile 表情' },
  { id: 'footnote', label: 'Footnote', hint: '[^1]', keywords: 'footnote 脚注' },
  { id: 'math', label: 'Math Block', hint: '$$', keywords: 'math latex formula 公式 数学' },
  { id: 'hr', label: 'Horizontal Rule', hint: '---', keywords: 'hr divider 分割线' },
  { id: 'pagebreak', label: 'Page Break', hint: '⌦', keywords: 'page break pagination 分页 换页' },
  { id: 'image', label: 'Image', hint: '🖼', keywords: 'image picture 图片' },
];

type Handler = (id: string) => void;

let commandHandler: Handler = () => {};
export const setSlashCommandHandler = (handler: Handler) => {
  commandHandler = handler;
};

export const slashKey = new PluginKey<{ from: number; to: number; query: string } | null>('TYPLEFT_SLASH');

interface MenuState {
  from: number;
  to: number;
  query: string;
  items: SlashItem[];
  active: number;
}

const matchSlash = (view: EditorView): { from: number; to: number; query: string } | null => {
  const { state } = view;
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\u0000');
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore);
  if (!match) return null;
  const query = match[1] ?? '';
  if (query.length > 20) return null;
  const to = $from.pos;
  const from = to - query.length - 1;
  return { from, to, query };
};

export const slashPlugin = $prose(() => {
  let menu: HTMLElement | null = null;
  let menuView: EditorView | null = null;
  let current: MenuState | null = null;

  const close = () => {
    menu?.remove();
    menu = null;
    current = null;
  };

  const filterItems = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_ITEMS;
    return SLASH_ITEMS.filter(item =>
      item.id.includes(q) || t(item.label).toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q)
    );
  };

  const paint = () => {
    if (!menu || !current) return;
    menu.innerHTML = '';
    current.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'slash-menu-item' + (index === current!.active ? ' active' : '');
      row.innerHTML = `<span class="slash-menu-label">${t(item.label)}</span><span class="slash-menu-hint">${item.hint ?? ''}</span>`;
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        applyItem(item.id);
      });
      menu!.appendChild(row);
    });
    if (!current.items.length) {
      const empty = document.createElement('div');
      empty.className = 'slash-menu-empty';
      empty.textContent = 'No results';
      menu.appendChild(empty);
    }
  };

  const place = (view: EditorView, from: number) => {
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'slash-menu';
      document.body.appendChild(menu);
    }
    const coords = view.coordsAtPos(from);
    menu.style.left = `${Math.round(coords.left)}px`;
    menu.style.top = `${Math.round(coords.bottom + 6)}px`;
  };

  const open = (view: EditorView, match: { from: number; to: number; query: string }) => {
    const items = filterItems(match.query);
    current = { ...match, items, active: 0 };
    paint();
    place(view, match.from);
  };

  function applyItem(id: string) {
    if (!current || !menuView) return;
    const { from, to } = current;
    const view = menuView;
    close();
    view.dispatch(view.state.tr.delete(from, to));
    view.focus();
    commandHandler(id);
  }

  return new Plugin({
    key: slashKey,
    view: (view) => {
      menuView = view;
      return {
        update: (editorView, prevState) => {
          if (editorView.state.doc.eq(prevState.doc) && editorView.state.selection.eq(prevState.selection)) return;
          const match = matchSlash(editorView);
          if (!match) {
            if (menu) close();
            return;
          }
          const sameQuery = current && current.query === match.query && current.from === match.from;
          if (sameQuery) return;
          open(editorView, match);
          if (current) current.active = 0;
          paint();
        },
        destroy: () => {
          close();
          menuView = null;
        },
      };
    },
    props: {
      handleKeyDown: (_view, event) => {
        if (!menu || !current) return false;
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          return true;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!current.items.length) return true;
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          current.active = (current.active + delta + current.items.length) % current.items.length;
          paint();
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          const item = current.items[current.active];
          if (item) applyItem(item.id);
          else close();
          return true;
        }
        return false;
      },
    },
  });
});
