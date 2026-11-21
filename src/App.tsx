import React, { useCallback, useEffect, useState } from 'react';
import Editor from 'components/Editor';
import ErrorBoundary from 'components/ErrorBoundary';
import StatusBar from 'components/StatusBar';
import SettingsPage from 'components/SettingsPage';
import CommandPalette from 'components/CommandPalette';
import ExportDialog from 'components/ExportDialog';
import ImageConfigDialog from 'components/ImageConfigDialog';
import { applyCustomTheme, getCustomTheme } from 'services/customTheme';
import { initZoom, installZoomWheel, zoomIn, zoomOut, zoomReset } from 'services/zoom';
import { remote } from 'services/remote';
import transport from 'services/transport';
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

  useEffect(() => {
    const unsub = transport.addListener('OpenSettings', () => { setSettingsSection(undefined); setSettingsOpen(true); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener('OpenCommandPalette', () => setCommandPaletteOpen(true));
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
    </ErrorBoundary>
  );
}

export default App;
