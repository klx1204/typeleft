/**
 * Window zoom.
 *
 * Tauri's `setZoom` scales the whole webview (the same thing Ctrl/Cmd + wheel
 * does in a browser). In a plain browser (devtest) we fall back to CSS `zoom`,
 * which is enough for visual checks.
 */

import remote from 'services/remote/common';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
const STEP = 0.1;

let current = 1;
let persistTimer: number | undefined;

const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

const paint = async (level: number) => {
  if (!(window as any).__DEV_STUB__) {
    try {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      await getCurrentWebview().setZoom(level);
      return;
    } catch {
      // Not inside a Tauri webview.
    }
  }
  document.documentElement.style.zoom = level === 1 ? '' : String(level);
};

/** Persist in the background; zoom is not worth a blocking write. */
const persist = () => {
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    remote.getSettings()
      .then((settings: any) => remote.saveSettings({ ...settings, zoom: current }))
      .catch(() => {});
  }, 500);
};

export const getZoom = (): number => current;

export const setZoom = (value: number, persistChange = true): number => {
  current = clamp(value);
  paint(current);
  if (persistChange) persist();
  return current;
};

export const zoomIn = (): number => setZoom(current + STEP);
export const zoomOut = (): number => setZoom(current - STEP);
export const zoomReset = (): number => setZoom(1);

/** Apply the saved value at startup without re-saving it. */
export const initZoom = (value: unknown): void => {
  const level = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  current = clamp(level);
  paint(current);
};

/** Cmd/Ctrl + wheel, matching Typora and every browser. */
export const installZoomWheel = (): (() => void) => {
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else if (event.deltaY > 0) zoomOut();
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  return () => window.removeEventListener('wheel', onWheel);
};
