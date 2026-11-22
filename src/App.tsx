import React, { useCallback, useEffect, useState } from 'react';
import Editor from 'components/Editor';
import ErrorBoundary from 'components/ErrorBoundary';
import StatusBar from 'components/StatusBar';
import SettingsPage from 'components/SettingsPage';
import CommandPalette from 'components/CommandPalette';
import ExportDialog from 'components/ExportDialog';
import ImageConfigDialog from 'components/ImageConfigDialog';
import SelectionSearchMenu from 'components/SelectionSearchMenu';
import FolderSearch from 'components/FolderSearch';
import { applyCustomTheme, getCustomTheme } from 'services/customTheme';
import { initZoom, installZoomWheel, zoomIn, zoomOut, zoomReset } from 'services/zoom';
import { applyCustomShortcuts } from 'services/shortcuts';
import { remote } from 'services/remote';
import transport from 'services/transport';
import t from 'services/i18n';
import 'services/theme'
import 'services/scrollbar'
import 'services/localization'
import './App.scss';

document.oncontextmenu = () => false;

window.onerror = (msg, source, line, col, error) => {
  remote.unhandledException({ message: `[window.onerror] ${msg} at ${source}:${line}:${col}\n${error?.stack || ''}` });
};
window.onunhandledrejection = (e) => {
  remote.unhandledException({ message: `[unhandledRejection] ${e.reason}\n${e.reason?.stack || ''}` });
};

function App() {

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [imageConfigOpen, setImageConfigOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState<{ open: boolean; mode: 'content' | 'files' | 'tags' }>({ open: false, mode: 'content' });
  const [updateInfo, setUpdateInfo] = useState<{ current: string; latest: string; url: string; newer: boolean } | null>(null);
  const [updateError, setUpdateError] = useState('');
  const checkUpdates = useCallback(() => {
    setUpdateError('');
    remote.checkForUpdates()
      .then((info: any) => setUpdateInfo(info))
      .catch((err: any) => { setUpdateInfo(null); setUpdateError(String(err)); });
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenSettings', () => { setSettingsSection(undefined); setSettingsOpen(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenCommandPalette', () => setCommandPaletteOpen(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<{ mode?: 'content' | 'files' | 'tags' }>('OpenFolderSearch', (payload) => {
      setFolderSearch({ open: true, mode: payload?.mode ?? 'content' });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenExportDialog', () => setExportOpen(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenImageConfigDialog', () => setImageConfigOpen(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenThemeDialog', () => { setSettingsSection('theme'); setSettingsOpen(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    getCustomTheme().then(name => { if (name) applyCustomTheme(name); });
  }, []);

  // Zoom + full screen (#23 / #24)
  useEffect(() => {
    remote.getSettings().then((s: any) => initZoom(s?.zoom)).catch(() => initZoom(1));
    const offWheel = installZoomWheel();
    const unsubs = [
      transport.addListener('ZoomIn', () => zoomIn()),
      transport.addListener('ZoomOut', () => zoomOut()),
      transport.addListener('ZoomReset', () => zoomReset()),
      transport.addListener('ToggleFullscreen', async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const win = getCurrentWindow();
          await win.setFullscreen(!(await win.isFullscreen()));
        } catch {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else document.documentElement.requestFullscreen().catch(() => {});
        }
      }),
    ];
    return () => {
      offWheel();
      unsubs.forEach(fn => fn());
    };
  }, []);

  useEffect(() => {
    remote.getSettings().then((s: any) => applyCustomShortcuts(s)).catch(() => {});
    const unsub = transport.addListener<Record<string, unknown>>('SettingsChanged', (payload) => {
      if ('customShortcuts' in payload) {
        remote.getSettings().then((s: any) => applyCustomShortcuts(s)).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => transport.addListener<Record<string, unknown>>('SettingsChanged', (payload) => {
    if ('customTheme' in payload) {
      applyCustomTheme(typeof payload.customTheme === 'string' ? payload.customTheme : '');
    }
  }), []);

  useEffect(() => {
    const applyAnimation = (enabled: unknown) => {
      document.body.classList.toggle('no-animation', enabled === false);
    };
    remote.getSettings().then((s: any) => applyAnimation(s?.animationEnable)).catch(() => {});
    const unsub = transport.addListener<Record<string, unknown>>('SettingsChanged', (payload) => {
      if ('animationEnable' in payload) applyAnimation(payload.animationEnable);
    });
    return () => unsub();
  }, []);

  // Global keyboard shortcut for command palette
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      setCommandPaletteOpen(prev => !prev);
    }
    if (e.key === 'Escape') {
      setCommandPaletteOpen(false);
    }
  }, []);

  useEffect(() => transport.addListener('CheckForUpdates', () => checkUpdates()), [checkUpdates]);

  useEffect(() => {
    remote.getSettings().then((s: any) => {
      if (s?.checkUpdatesOnStartup) checkUpdates();
    }).catch(() => {});
  }, [checkUpdates]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ErrorBoundary>
      <Editor />
      <StatusBar />
      <SettingsPage open={settingsOpen} onClose={() => setSettingsOpen(false)} initialSection={settingsSection} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImageConfigDialog open={imageConfigOpen} onClose={() => setImageConfigOpen(false)} />
      <SelectionSearchMenu />
      <FolderSearch open={folderSearch.open} initialMode={folderSearch.mode} onClose={() => setFolderSearch({ ...folderSearch, open: false })} />
      {(updateInfo || updateError) && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10005, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
          onClick={() => { setUpdateInfo(null); setUpdateError(''); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 420, padding: 20, borderRadius: 8, backgroundColor: 'var(--editorColor00)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--editorColor60)' }}>{t('Check for Updates')}</div>
            {updateError ? (
              <div style={{ fontSize: 13, color: '#e05555', wordBreak: 'break-word' }}>{updateError}</div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--editorColor50)', lineHeight: 1.7 }}>
                {updateInfo?.newer
                  ? <>{t('A new version is available')}: <strong>{updateInfo.latest}</strong> ({t('current')} {updateInfo.current})</>
                  : <>{t('You are up to date')} ({updateInfo?.current})</>}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button
                onClick={() => { setUpdateInfo(null); setUpdateError(''); }}
                style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: '1px solid var(--editorColor10)', backgroundColor: 'var(--editorColor04)', color: 'var(--editorColor50)' }}
              >{t('Close')}</button>
              {updateInfo?.newer && (
                <button
                  onClick={() => { void remote.openUrl({ url: updateInfo.url }); setUpdateInfo(null); }}
                  style={{ padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4, border: 'none', backgroundColor: 'var(--themeColor)', color: '#fff' }}
                >{t('Download')}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}

export default App;
