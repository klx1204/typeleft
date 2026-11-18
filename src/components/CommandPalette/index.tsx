import React, { useCallback, useEffect, useRef, useState } from 'react';
import transport from 'services/transport';
import remote from 'services/remote/common';
import { useI18n } from 'services/i18n';

interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
}

const CommandPalette: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = [
    { id: 'save', label: 'Save', category: 'File', action: () => transport.postMessage('MenuSave', {}) },
    { id: 'save_as', label: 'Save As...', category: 'File', action: () => transport.postMessage('MenuSaveAs', {}) },
    { id: 'open', label: 'Open File...', category: 'File', action: () => remote.openFileDialog() },
    { id: 'open_folder', label: 'Open Folder...', category: 'File', action: () => remote.openFolderDialog() },
    { id: 'new_file', label: 'New File', category: 'File', action: () => transport.postMessage('NewFile', {}) },
    { id: 'settings', label: 'Settings...', category: 'File', action: () => transport.postMessage('OpenSettings', {}) },
    { id: 'export_html', label: 'Export HTML...', category: 'File', action: () => transport.postMessage('OpenExportDialog', {}) },
    { id: 'image_hosting', label: 'Image Hosting', category: 'File', action: () => transport.postMessage('OpenImageConfigDialog', {}) },
    { id: 'themes', label: 'Themes...', category: 'View', action: () => transport.postMessage('OpenThemeDialog', {}) },
    { id: 'print', label: 'Print...', category: 'File', action: () => transport.postMessage('Export', { type: 'print', context: {} }) },

    { id: 'undo', label: 'Undo', category: 'Edit', action: () => transport.postMessage('Undo', {}) },
    { id: 'redo', label: 'Redo', category: 'Edit', action: () => transport.postMessage('Redo', {}) },
    { id: 'find', label: 'Find...', category: 'Edit', action: () => transport.postMessage('SearchOpenChange', { open: 1 }) },
    { id: 'replace', label: 'Replace...', category: 'Edit', action: () => transport.postMessage('SearchOpenChange', { open: 2 }) },

    { id: 'bold', label: 'Bold', category: 'Format', action: () => transport.postMessage('Format', 'bold') },
    { id: 'italic', label: 'Italic', category: 'Format', action: () => transport.postMessage('Format', 'italic') },
    { id: 'code', label: 'Inline Code', category: 'Format', action: () => transport.postMessage('Format', 'inline_code') },
    { id: 'strike', label: 'Strikethrough', category: 'Format', action: () => transport.postMessage('Format', 'strike') },
    { id: 'link', label: 'Insert Link', category: 'Format', action: () => transport.postMessage('Format', 'link') },
    { id: 'image', label: 'Insert Image', category: 'Format', action: () => transport.postMessage('InsertImage', '') },
    { id: 'clear_format', label: 'Clear Format', category: 'Format', action: () => transport.postMessage('Format', 'clear') },

    { id: 'h1', label: 'Heading 1', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'heading 1') },
    { id: 'h2', label: 'Heading 2', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'heading 2') },
    { id: 'h3', label: 'Heading 3', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'heading 3') },
    { id: 'blockquote', label: 'Quote Block', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'blockquote') },
    { id: 'code_block', label: 'Code Block', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'pre') },
    { id: 'ol', label: 'Ordered List', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'ol-order') },
    { id: 'ul', label: 'Bullet List', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'ul-bullet') },
    { id: 'task_list', label: 'Task List', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'ul-task') },
    { id: 'table', label: 'Insert Table', category: 'Paragraph', action: () => transport.postMessage('UpdateParagraph', 'table') },
    { id: 'hr', label: 'Horizontal Rule', category: 'Paragraph', action: () => transport.postMessage('InsertParagraph', 'hr') },

    { id: 'sidebar', label: 'Toggle Sidebar', category: 'View', action: () => transport.postMessage('SidebarToggle', { open: true }) },
    { id: 'outline', label: 'Show Outline', category: 'View', action: () => transport.postMessage('SidebarSection', { section: 'toc' }) },
    { id: 'source', label: 'Toggle Source Code', category: 'View', action: () => transport.postMessage('ToggleSourceCode', {}) },
    { id: 'compact', label: 'Toggle Compact Mode', category: 'View', action: () => transport.postMessage('ToggleCompactMode', {}) },
    { id: 'ontop', label: 'Toggle Always on Top', category: 'Window', action: () => transport.postMessage('ToggleAlwaysOnTop', {}) },
  ];

  const q = query.toLowerCase();
  const filtered = query
    ? commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      t(c.label).toLowerCase().includes(q) ||
      t(c.category).toLowerCase().includes(q))
    : commands;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((cmd: Command) => {
    cmd.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && filtered[selectedIndex]) { execute(filtered[selectedIndex]); return; }
  }, [filtered, selectedIndex, execute, onClose]);

  if (!open) return null;

  let category = '';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', justifyContent: 'center', paddingTop: '15vh',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxHeight: 400,
        backgroundColor: 'var(--editorColor00)',
        borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
      }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
          placeholder={t('Type a command...')}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 15, border: 'none',
            outline: 'none', boxSizing: 'border-box',
            backgroundColor: 'var(--editorColor02)', color: 'var(--editorColor50)',
            borderBottom: '1px solid var(--editorColor10)',
          }}
        />
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map((cmd, i) => {
            const showCategory = cmd.category !== category;
            category = cmd.category;
            return (
              <React.Fragment key={cmd.id}>
                {showCategory && (
                  <div style={{ padding: '6px 16px 2px', fontSize: 11, fontWeight: 600, color: 'var(--editorColor40)' }}>
                    {t(cmd.category)}
                  </div>
                )}
                <div
                  onClick={() => execute(cmd)}
                  style={{
                    padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                    color: 'var(--editorColor30)',
                    backgroundColor: i === selectedIndex ? 'var(--editorColor06)' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >{t(cmd.label)}</div>
              </React.Fragment>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--editorColor40)', textAlign: 'center' }}>
              {t('No commands found')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
