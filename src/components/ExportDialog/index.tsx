import React, { useEffect, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { useI18n } from 'services/i18n';

interface ExportConfig {
  id: string;
  name: string;
  exportType: string;
  fileName: string;
  outputDir: string;
  includeCss: boolean;
  includeFrontmatter: boolean;
  includeToc: boolean;
  postAction: string;
}

interface IExportDialogProps {
  open: boolean;
  onClose: () => void;
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

const primaryBtnStyle: React.CSSProperties = {
  ...btnStyle,
  backgroundColor: 'var(--themeColor)',
  borderColor: 'var(--themeColor)',
  color: '#fff',
};

const newId = () => `export-${Date.now()}`;

const defaultConfig = (): ExportConfig => ({
  id: newId(),
  name: 'HTML',
  exportType: 'html',
  fileName: 'export.html',
  outputDir: '',
  includeCss: true,
  includeFrontmatter: false,
  includeToc: true,
  postAction: 'none',
});

const ExportDialog: React.FC<IExportDialogProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<ExportConfig[]>([]);
  const [draft, setDraft] = useState<ExportConfig | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setError('');
    remote.getExportConfigs().then((list: ExportConfig[]) => {
      setConfigs(list);
      setDraft(list.length ? { ...list[0] } : defaultConfig());
    }).catch(() => {
      setConfigs([]);
      setDraft(defaultConfig());
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const offDone = transport.addListener<{ path: string }>('ExportDone', ({ path }) => {
      setMessage(`${t('Exported to')}: ${path}`);
    });
    const offFail = transport.addListener<{ message: string }>('ExportFailed', ({ message }) => {
      setError(message);
    });
    return () => { offDone(); offFail(); };
  }, [open, t]);

  if (!open || !draft) return null;

  const update = (patch: Partial<ExportConfig>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    setError('');
    try {
      await remote.saveExportConfig({ config: draft });
      const list = await remote.getExportConfigs();
      setConfigs(list);
      setMessage('');
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const remove = async () => {
    setError('');
    try {
      await remote.deleteExportConfig({ id: draft.id });
      const list = await remote.getExportConfigs();
      setConfigs(list);
      setDraft(list.length ? { ...list[0] } : defaultConfig());
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const move = async (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= configs.length) return;
    const next = [...configs];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setConfigs(next);
    try {
      await remote.reorderExportConfigs({ ids: next.map(c => c.id) });
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const exportNow = async () => {
    setMessage('');
    setError('');
    const fileName = draft.fileName || 'export.html';
    const targetPath = draft.outputDir ? `${draft.outputDir.replace(/\/+$/, '')}/${fileName}` : undefined;
    transport.postMessage('Export', {
      type: 'html',
      context: {},
      title: fileName.replace(/\.html?$/i, ''),
      targetPath,
      options: {
        includeCss: draft.includeCss,
        includeFrontmatter: draft.includeFrontmatter,
        includeToc: draft.includeToc,
        postAction: draft.postAction,
      },
    });
  };

  const browse = async () => {
    const dir = await new Promise<string | null>((resolve) => {
      let done = false;
      const finish = (value: string | null) => {
        if (done) return;
        done = true;
        unsubscribe();
        resolve(value);
      };
      const unsubscribe = transport.addListener<string | null>('FolderPicked', (path) => finish(path ?? null));
      remote.pickFolder({ defaultPath: draft.outputDir || undefined }).catch(() => finish(null));
      setTimeout(() => finish(null), 120000);
    });
    if (dir) update({ outputDir: dir });
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9997, display: 'flex',
        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxHeight: '80vh', display: 'flex',
          backgroundColor: 'var(--editorColor00)', borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          width: 180, padding: '16px 0', backgroundColor: 'var(--editorColor02)',
          borderRight: '1px solid var(--editorColor10)', overflowY: 'auto',
        }}>
          <div style={{ padding: '0 12px 8px', fontSize: 12, color: 'var(--editorColor40)' }}>{t('Configurations')}</div>
          {configs.map((c, index) => (
            <div
              key={c.id}
              onClick={() => { setDraft({ ...c }); setMessage(''); setError(''); }}
              style={{
                padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                color: 'var(--editorColor60)',
                backgroundColor: draft.id === c.id ? 'var(--editorColor06)' : 'transparent',
                fontWeight: draft.id === c.id ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <button
                title={t('Move Up')}
                disabled={index === 0}
                onClick={e => { e.stopPropagation(); move(index, -1); }}
                style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 0.7, color: 'inherit', padding: 0 }}
              >↑</button>
              <button
                title={t('Move Down')}
                disabled={index === configs.length - 1}
                onClick={e => { e.stopPropagation(); move(index, 1); }}
                style={{ background: 'none', border: 'none', cursor: index === configs.length - 1 ? 'default' : 'pointer', opacity: index === configs.length - 1 ? 0.3 : 0.7, color: 'inherit', padding: 0 }}
              >↓</button>
            </div>
          ))}
          <div
            onClick={() => setDraft(defaultConfig())}
            style={{ padding: '8px 12px 0', fontSize: 12, cursor: 'pointer', color: 'var(--themeColor)' }}
          >+ {t('New Configuration')}</div>
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t('Export Configurations')}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--editorColor40)' }}>×</button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', marginBottom: 6 }}>{t('Name')}</div>
          <input style={inputStyle} value={draft.name} onChange={e => update({ name: e.target.value })} />

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('File Name')}</div>
          <input style={inputStyle} value={draft.fileName} onChange={e => update({ fileName: e.target.value })} />

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('Output Directory')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={inputStyle}
              value={draft.outputDir}
              placeholder="~/Downloads"
              onChange={e => update({ outputDir: e.target.value })}
            />
            <button style={btnStyle} onClick={browse}>{t('Browse')}</button>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={draft.includeCss} onChange={e => update({ includeCss: e.target.checked })} />
              {t('Include CSS')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={draft.includeFrontmatter} onChange={e => update({ includeFrontmatter: e.target.checked })} />
              {t('Include Frontmatter')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={draft.includeToc} onChange={e => update({ includeToc: e.target.checked })} />
              {t('Include Outline')}
            </label>
          </div>

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('After Export')}</div>
          <select
            value={draft.postAction || 'none'}
            onChange={e => update({ postAction: e.target.value })}
            style={{ ...inputStyle, width: 220 }}
          >
            <option value="none">{t('Do Nothing')}</option>
            <option value="open-file">{t('Open File')}</option>
            <option value="open-folder">{t('Open Folder')}</option>
          </select>

          {message && <div style={{ color: '#2e9d5b', fontSize: 12, marginTop: 12 }}>{message}</div>}
          {error && <div style={{ color: '#e05555', fontSize: 12, marginTop: 12 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnStyle} onClick={save}>{t('Save')}</button>
              <button style={{ ...btnStyle, color: '#e05555' }} onClick={remove}>{t('Delete')}</button>
            </div>
            <button style={primaryBtnStyle} onClick={exportNow}>{t('Export Now')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
