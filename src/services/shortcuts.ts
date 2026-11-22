import remote from 'services/remote/common';

export interface ShortcutAction {
  id: string;
  label: string;
  default: string;
}

/**
 * Menu/command-palette actions that may get a custom accelerator (#163).
 * Editor-level keys (typing rules, table navigation) are intentionally absent.
 */
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'new_file', label: 'New File', default: 'CmdOrCtrl+N' },
  { id: 'open_file', label: 'Open File...', default: 'CmdOrCtrl+O' },
  { id: 'save', label: 'Save', default: 'CmdOrCtrl+S' },
  { id: 'save_as', label: 'Save As...', default: 'CmdOrCtrl+Shift+S' },
  { id: 'export_html', label: 'Export...', default: '' },
  { id: 'print', label: 'Print...', default: 'CmdOrCtrl+P' },
  { id: 'quick_open', label: 'Quick Open...', default: 'CmdOrCtrl+Shift+O' },
  { id: 'search_folder', label: 'Search in Folder...', default: 'CmdOrCtrl+Shift+F' },
  { id: 'find', label: 'Find...', default: 'CmdOrCtrl+F' },
  { id: 'replace', label: 'Replace...', default: 'CmdOrCtrl+H' },
  { id: 'image_manager', label: 'Image Manager...', default: '' },
  { id: 'bold', label: 'Bold', default: 'CmdOrCtrl+B' },
  { id: 'italic', label: 'Italic', default: 'CmdOrCtrl+I' },
  { id: 'hyperlink', label: 'Link', default: 'CmdOrCtrl+K' },
  { id: 'heading_1', label: 'Heading 1', default: 'CmdOrCtrl+1' },
  { id: 'heading_2', label: 'Heading 2', default: 'CmdOrCtrl+2' },
  { id: 'view_source', label: 'Toggle Source Code', default: 'CmdOrCtrl+/' },
  { id: 'view_sidebar', label: 'Toggle Sidebar', default: 'CmdOrCtrl+Shift+L' },
  { id: 'zoom_in', label: 'Zoom In', default: 'CmdOrCtrl+=' },
  { id: 'zoom_out', label: 'Zoom Out', default: 'CmdOrCtrl+-' },
  { id: 'zoom_reset', label: 'Actual Size', default: 'CmdOrCtrl+0' },
];

export const defaultShortcut = (id: string): string =>
  SHORTCUT_ACTIONS.find(action => action.id === id)?.default ?? '';

/** Build a Tauri accelerator from a keyboard event, or '' when invalid. */
export const acceleratorFromEvent = (event: KeyboardEvent): string => {
  const key = event.key;
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return '';
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('CmdOrCtrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  let name = key;
  if (key === ' ') name = 'Space';
  else if (key === 'Escape') return '';
  else if (key === 'ArrowUp') name = 'Up';
  else if (key === 'ArrowDown') name = 'Down';
  else if (key === 'ArrowLeft') name = 'Left';
  else if (key === 'ArrowRight') name = 'Right';
  else if (key.length === 1) name = key.toUpperCase();
  else name = key.charAt(0).toUpperCase() + key.slice(1);
  parts.push(name);
  if (parts.length === 1) return '';
  return parts.join('+');
};

/** Push the user's accelerator map (or defaults) to the native menu. */
export const applyCustomShortcuts = (settings: any): Promise<void> => {
  const custom = settings?.customShortcuts;
  const map: Record<string, string> = {};
  if (custom && typeof custom === 'object') {
    for (const [id, value] of Object.entries(custom)) {
      if (typeof value === 'string') map[id] = value;
    }
  }
  return remote.applyShortcuts({ shortcuts: map }).catch(() => {});
};
