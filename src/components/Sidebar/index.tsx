import React, { useEffect, useRef, useState } from 'react';
import transport from 'services/transport';
import remote from 'services/remote/common';
import { useI18n } from 'services/i18n';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface TocEntry {
  text: string;
  level: number;
  slug: string;
}

interface ISidebarProps {
  open: boolean;
  section: 'filetree' | 'toc';
  onClose: () => void;
}

type DialogState =
  | { type: 'rename'; entry: FileEntry; value: string }
  | { type: 'move'; entry: FileEntry; value: string }
  | { type: 'newFile'; dir: string; value: string }
  | { type: 'newFolder'; dir: string; value: string }
  | { type: 'delete'; entry: FileEntry }
  | null;

interface ContextMenuState {
  x: number;
  y: number;
  entry?: FileEntry;
  dirPath: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box',
  border: '1px solid var(--editorColor10)', borderRadius: 4,
  backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
  border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
  backgroundColor: 'var(--editorColor04)',
};

const Sidebar: React.FC<ISidebarProps> = ({ open, section, onClose }) => {
  const { t } = useI18n();
  const [width, setWidth] = useState(240);
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [tocQuery, setTocQuery] = useState('');
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [pinnedFolders, setPinnedFolders] = useState<string[]>([]);
  const [defaultExt, setDefaultExt] = useState('md');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState('');
  const allFilesRef = useRef<Map<string, FileEntry[]>>(new Map());

  useEffect(() => {
    remote.getSettings().then(async (s: any) => {
      if (typeof s?.sidePaneWidth === 'number') setWidth(s.sidePaneWidth);
      if (Array.isArray(s?.pinnedFolders)) setPinnedFolders(s.pinnedFolders.filter((x: unknown) => typeof x === 'string'));
      if (typeof s?.defaultFileExtension === 'string' && s.defaultFileExtension.trim()) {
        setDefaultExt(s.defaultFileExtension.trim().replace(/^\./, ''));
      }
      remote.listRecentFolders().then((list: string[]) => setRecentFolders(Array.isArray(list) ? list : [])).catch(() => {});
      if (s?.folderStartupAction === 'openLast' && Array.isArray(s?.recentFolders) && s.recentFolders[0]) {
        const dir = s.recentFolders[0];
        try {
          const entries = await remote.listDirectory({ path: dir });
          setFolderPath(dir);
          allFilesRef.current.set(dir, entries);
          setFiles([...entries]);
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<Record<string, unknown>>('SettingsChanged', (payload) => {
      if (typeof payload.sidePaneWidth === 'number') setWidth(payload.sidePaneWidth);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<{ path: string }>('FolderOpened', ({ path }) => {
      setFolderPath(path);
      setExpandedDirs(new Set());
      allFilesRef.current.clear();
      loadDir(path);
      remote.listRecentFolders().then((list: string[]) => setRecentFolders(Array.isArray(list) ? list : [])).catch(() => {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<{ state: { toc?: any[]; cur?: number } }>('StateChange', ({ state }) => {
      if (state?.toc) {
        setToc(state.toc.map((h: any) => ({
          text: h.content ?? '',
          level: h.lvl ?? 1,
          slug: h.slug ?? '',
        })));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const loadDir = async (dirPath: string) => {
    try {
      const entries = await remote.listDirectory({ path: dirPath });
      allFilesRef.current.set(dirPath, entries);
      setFiles([...entries]);
      return entries;
    } catch {
      return [];
    }
  };

  const openFolderByPath = async (dir: string) => {
    try {
      setFolderPath(dir);
      setExpandedDirs(new Set());
      allFilesRef.current.clear();
      await loadDir(dir);
      await remote.saveRecentFolder({ path: dir }).catch(() => {});
      remote.listRecentFolders().then((list: string[]) => setRecentFolders(Array.isArray(list) ? list : [])).catch(() => {});
    } catch {
      setError(t('Operation failed'));
    }
  };

  const togglePin = async () => {
    if (!folderPath) return;
    const next = pinnedFolders.includes(folderPath)
      ? pinnedFolders.filter(p => p !== folderPath)
      : [folderPath, ...pinnedFolders].slice(0, 12);
    setPinnedFolders(next);
    try {
      const settings: any = await remote.getSettings();
      await remote.saveSettings({ ...settings, pinnedFolders: next });
    } catch { /* ignore */ }
  };

  const refreshAll = async () => {
    if (!folderPath) return;
    await loadDir(folderPath);
    for (const dir of Array.from(expandedDirs)) {
      await loadDir(dir);
    }
  };

  const parentOf = (p: string) => p.substring(0, Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')));
  const joinPath = (dir: string, name: string) => `${dir}/${name}`;
  const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
  const extName = (name: string) => {
    const i = name.lastIndexOf('.');
    return i > 0 ? name.slice(i) : '';
  };
  const stemName = (name: string) => {
    const ext = extName(name);
    return ext ? name.slice(0, -ext.length) : name;
  };

  const toggleDir = async (dir: FileEntry) => {
    if (!dir.is_dir) return;
    const next = new Set(expandedDirs);
    if (next.has(dir.path)) {
      next.delete(dir.path);
    } else {
      await loadDir(dir.path);
      next.add(dir.path);
    }
    setExpandedDirs(next);
  };

  const openFile = async (entry: FileEntry) => {
    if (entry.is_dir) {
      await toggleDir(entry);
      return;
    }
    try {
      const text = await remote.readTextFile({ path: entry.path });
      const basePath = parentOf(entry.path);
      transport.postMessage('LoadFile', { text, basePath, filePath: entry.path });
    } catch {
      remote.openFileDialog();
    }
  };

  const openContextMenu = (e: React.MouseEvent, entry: FileEntry | undefined, dirPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, dirPath });
  };

  const runDialog = async () => {
    if (!dialog) return;
    setError('');
    try {
      if (dialog.type === 'rename') {
        const name = dialog.value.trim();
        if (!name) return;
        const valid = await remote.isValidFilename({ name });
        if (!valid) { setError(t('Invalid file name')); return; }
        const newPath = joinPath(parentOf(dialog.entry.path), name);
        if (newPath !== dialog.entry.path && await remote.checkFileExists({ path: newPath })) {
          setError(t('Target already exists'));
          return;
        }
        const result = await remote.renameFile({ oldPath: dialog.entry.path, newName: name });
        transport.postMessage('FileRenamed', { oldPath: dialog.entry.path, newPath: result });
        setDialog(null);
        await refreshAll();
      } else if (dialog.type === 'move') {
        const dest = dialog.value.trim();
        if (!dest) return;
        const target = joinPath(dest, baseName(dialog.entry.path));
        if (await remote.checkFileExists({ path: target })) {
          setError(t('Target already exists'));
          return;
        }
        await remote.moveFile({ source: dialog.entry.path, dest: target });
        transport.postMessage('FileRenamed', { oldPath: dialog.entry.path, newPath: target });
        setDialog(null);
        await refreshAll();
      } else if (dialog.type === 'newFile' || dialog.type === 'newFolder') {
        const name = dialog.value.trim();
        if (!name) return;
        const valid = await remote.isValidFilename({ name });
        if (!valid) { setError(t('Invalid file name')); return; }
        const target = joinPath(dialog.dir, name);
        if (await remote.checkFileExists({ path: target })) {
          setError(t('Target already exists'));
          return;
        }
        if (dialog.type === 'newFile') {
          await remote.createFile({ path: target });
        } else {
          await remote.createDir({ path: target });
        }
        setDialog(null);
        await refreshAll();
        await loadDir(dialog.dir);
      } else if (dialog.type === 'delete') {
        await remote.deleteFile({ path: dialog.entry.path, useTrash: true });
        transport.postMessage('FileDeleted', { path: dialog.entry.path });
        setDialog(null);
        await refreshAll();
      }
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const copyEntry = async (entry: FileEntry) => {
    try {
      const dir = parentOf(entry.path);
      const ext = extName(entry.name);
      const stem = stemName(entry.name);
      let candidate = joinPath(dir, `${stem} (${t('Copy of')})${ext}`);
      let i = 2;
      while (await remote.checkFileExists({ path: candidate })) {
        candidate = joinPath(dir, `${stem} (${t('Copy of')} ${i})${ext}`);
        i += 1;
      }
      await remote.copyFile({ source: entry.path, dest: candidate });
      await refreshAll();
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Copy failed'));
    }
  };

  const renderEntries = (entries: FileEntry[], depth = 0): React.ReactNode => (
    <>
      {entries.map(entry => (
        <React.Fragment key={entry.path}>
          <div
            className="file-list-item"
            onClick={() => openFile(entry)}
            onContextMenu={e => openContextMenu(e, entry, entry.is_dir ? entry.path : parentOf(entry.path))}
            style={{
              cursor: 'pointer', padding: '2px 4px', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 4,
              color: 'var(--editorColor60)',
              paddingLeft: 4 + depth * 14,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--editorColor06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span>{entry.is_dir ? (expandedDirs.has(entry.path) ? '▼' : '▶') : '📄'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
          </div>
          {entry.is_dir && expandedDirs.has(entry.path) && renderEntries(allFilesRef.current.get(entry.path) ?? [], depth + 1)}
        </React.Fragment>
      ))}
    </>
  );

  const contextMenuItemStyle: React.CSSProperties = {
    padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--editorColor50)',
    whiteSpace: 'nowrap',
  };

  const normalizedQuery = tocQuery.trim().toLowerCase();
  const filteredToc = normalizedQuery
    ? toc.filter(item => item.text.toLowerCase().includes(normalizedQuery))
    : toc;

  if (!open) return null;

  return (
    <div id="typora-sidebar" style={{
      position: 'fixed', top: 0, left: 0, bottom: 24, width,
      borderRight: '1px solid var(--editorColor10)',
      backgroundColor: 'var(--editorColor04)',
      overflowY: 'auto', zIndex: 900,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderBottom: '1px solid var(--editorColor10)',
        fontSize: 13, fontWeight: 600, color: 'var(--editorColor60)', gap: 8,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {section === 'filetree' ? (folderPath ? folderPath.split('/').pop() : t('Files')) : t('Outline')}
        </span>
        <span style={{ display: 'flex', gap: 6 }}>
          {section === 'filetree' && folderPath && (
            <button
              onClick={() => togglePin()}
              title={pinnedFolders.includes(folderPath) ? t('Unpin Folder') : t('Pin Folder')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: pinnedFolders.includes(folderPath) ? 'var(--themeColor)' : 'var(--editorColor60)', fontSize: 13, padding: 0 }}
            >{pinnedFolders.includes(folderPath) ? '★' : '☆'}</button>
          )}
          {section === 'filetree' && folderPath && (
            <button
              onClick={() => refreshAll()}
              title={t('Refresh')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editorColor60)', fontSize: 13, padding: 0 }}
            >⟳</button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editorColor60)', fontSize: 16, padding: 0 }}>×</button>
        </span>
      </div>

      {section === 'filetree' ? (
        <div
          style={{ padding: 8, flex: 1 }}
          onContextMenu={e => openContextMenu(e, undefined, folderPath)}
        >
          {!folderPath && (
            <div
              onClick={() => remote.openFolderDialog()}
              style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 13, color: 'var(--editorColor40)', textAlign: 'center', border: '1px dashed var(--editorColor10)', borderRadius: 4 }}
            >
              + {t('Open Folder')}
            </div>
          )}
          {folderPath && (
            <div
              onClick={() => remote.openFolderDialog()}
              style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 12, color: 'var(--editorColor40)', textAlign: 'center', borderBottom: '1px solid var(--editorColor06)', marginBottom: 4 }}
            >
              {folderPath}
            </div>
          )}
          {!folderPath && pinnedFolders.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--editorColor40)', padding: '2px 4px', textTransform: 'uppercase' }}>{t('Pinned Folders')}</div>
              {pinnedFolders.map(dir => (
                <div
                  key={dir}
                  onClick={() => openFolderByPath(dir)}
                  title={dir}
                  style={{ cursor: 'pointer', padding: '2px 4px', fontSize: 13, color: 'var(--editorColor60)', display: 'flex', gap: 4 }}
                >
                  <span>★</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(dir)}</span>
                </div>
              ))}
            </div>
          )}
          {!folderPath && recentFolders.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--editorColor40)', padding: '2px 4px', textTransform: 'uppercase' }}>{t('Recent Folders')}</div>
              {recentFolders.slice(0, 8).map(dir => (
                <div
                  key={dir}
                  onClick={() => openFolderByPath(dir)}
                  title={dir}
                  style={{ cursor: 'pointer', padding: '2px 4px', fontSize: 13, color: 'var(--editorColor60)', display: 'flex', gap: 4 }}
                >
                  <span>🗀</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baseName(dir)}</span>
                </div>
              ))}
            </div>
          )}
          {renderEntries(files)}
        </div>
      ) : (
        <div style={{ padding: 8 }}>
          <input
            value={tocQuery}
            onChange={e => setTocQuery(e.target.value)}
            placeholder={t('Filter outline...')}
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          {filteredToc.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--editorColor40)', padding: 8, textAlign: 'center' }}>
              {toc.length === 0 ? t('No headings') : t('No result')}
            </div>
          )}
          {filteredToc.map((item, i) => (
            <div
              key={item.slug || i}
              onClick={() => {
                const el = document.getElementById(item.slug);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              style={{
                cursor: 'pointer', padding: '2px 4px', paddingLeft: 8 + (item.level - 1) * 16,
                fontSize: 13 - Math.min(item.level - 1, 2) * 1,
                color: 'var(--editorColor60)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--editorColor06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {item.text}
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 10000,
            backgroundColor: 'var(--editorColor00)', border: '1px solid var(--editorColor10)',
            borderRadius: 6, padding: '4px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          {contextMenu.entry ? (
            <>
              {!contextMenu.entry.is_dir && (
                <div style={contextMenuItemStyle} onClick={() => { setContextMenu(null); openFile(contextMenu.entry!); }}>{t('Open...').replace('...', '')}</div>
              )}
              <div style={contextMenuItemStyle} onClick={() => { setDialog({ type: 'rename', entry: contextMenu.entry!, value: contextMenu.entry!.name }); setError(''); setContextMenu(null); }}>{t('Rename')}</div>
              <div style={contextMenuItemStyle} onClick={() => { setError(''); copyEntry(contextMenu.entry!); setContextMenu(null); }}>{t('Copy')}</div>
              <div style={contextMenuItemStyle} onClick={() => { setDialog({ type: 'move', entry: contextMenu.entry!, value: parentOf(contextMenu.entry!.path) }); setError(''); setContextMenu(null); }}>{t('Move')}</div>
              <div style={{ ...contextMenuItemStyle, color: '#e05555' }} onClick={() => { setDialog({ type: 'delete', entry: contextMenu.entry! }); setError(''); setContextMenu(null); }}>{t('Delete')}</div>
            </>
          ) : (
            <>
              <div style={contextMenuItemStyle} onClick={() => { setDialog({ type: 'newFile', dir: contextMenu.dirPath, value: `untitled.${defaultExt}` }); setError(''); setContextMenu(null); }}>{t('New File')}</div>
              <div style={contextMenuItemStyle} onClick={() => { setDialog({ type: 'newFolder', dir: contextMenu.dirPath, value: 'new-folder' }); setError(''); setContextMenu(null); }}>{t('New Folder')}</div>
              <div style={contextMenuItemStyle} onClick={() => { setContextMenu(null); refreshAll(); }}>{t('Refresh')}</div>
            </>
          )}
        </div>
      )}

      {dialog && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10001, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
          }}
          onClick={() => setDialog(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 360, padding: 20, borderRadius: 8,
              backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
              {dialog.type === 'rename' && t('Rename')}
              {dialog.type === 'move' && t('Move')}
              {dialog.type === 'newFile' && t('New File')}
              {dialog.type === 'newFolder' && t('New Folder')}
              {dialog.type === 'delete' && (dialog.entry.is_dir ? t('Delete Folder') : t('Delete File'))}
            </div>
            {dialog.type === 'delete' ? (
              <div style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                {t('Are you sure you want to delete')} <b>{dialog.entry.name}</b>?
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: 'var(--editorColor40)', marginBottom: 6 }}>
                  {dialog.type === 'move' ? t('Destination') : t('File Name')}
                </div>
                <input
                  autoFocus
                  value={dialog.value}
                  onChange={e => setDialog({ ...dialog, value: e.target.value } as DialogState)}
                  onKeyDown={e => { if (e.key === 'Enter') runDialog(); if (e.key === 'Escape') setDialog(null); }}
                  style={inputStyle}
                />
              </>
            )}
            {error && <div style={{ color: '#e05555', fontSize: 12, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button style={btnStyle} onClick={() => setDialog(null)}>{t('Cancel')}</button>
              <button style={{ ...btnStyle, backgroundColor: 'var(--themeColor)', borderColor: 'var(--themeColor)', color: '#fff' }} onClick={runDialog}>{t('Confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
