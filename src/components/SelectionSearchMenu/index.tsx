import React, { useCallback, useEffect, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { buildSearchUrl } from 'services/searchWeb';
import { useI18n } from 'services/i18n';

/**
 * Right-click menu for a text selection: search it with the configured web
 * search engine (#165). Mounted once, so it works in both editor modes.
 */
const SelectionSearchMenu: React.FC = () => {
  const { t } = useI18n();
  const [menu, setMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const text = window.getSelection()?.toString().trim() ?? '';
      if (!text) return;
      event.preventDefault();
      event.stopPropagation();
      setMenu({ x: event.clientX, y: event.clientY, text });
    };
    const close = () => setMenu(null);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, []);

  const search = useCallback((raw?: string) => {
    const text = (raw ?? window.getSelection()?.toString() ?? '').trim();
    if (!text) return;
    const url = buildSearchUrl(text, (window as any).typeleftEditorOptions?.searchServiceUrl);
    remote.openUrl({ url }).catch(() => window.open(url, '_blank'));
    setMenu(null);
  }, []);

  useEffect(() => transport.addListener('SearchSelection', () => search()), [search]);

  if (!menu) return null;

  return (
    <div
      style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 10000,
        backgroundColor: 'var(--editorColor00)', border: '1px solid var(--editorColor10)',
        borderRadius: 6, padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div
        onClick={() => search(menu.text)}
        style={{ padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--editorColor50)', whiteSpace: 'nowrap' }}
      >{t('Search the Web for')} “{menu.text.slice(0, 24)}{menu.text.length > 24 ? '…' : ''}”</div>
    </div>
  );
};

export default SelectionSearchMenu;
