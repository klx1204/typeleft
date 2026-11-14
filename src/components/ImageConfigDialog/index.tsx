import React, { useEffect, useState } from 'react';
import remote from 'services/remote/common';
import { useI18n } from 'services/i18n';

interface ImageUploadConfig {
  id: string;
  name: string;
  provider: string;
  host: string;
  port: number;
  username: string;
  password: string;
  remotePath: string;
  baseUrl: string;
}

interface IImageConfigDialogProps {
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

const newId = () => `image-${Date.now()}`;

const defaultConfig = (): ImageUploadConfig => ({
  id: newId(),
  name: 'HTTP',
  provider: 'http',
  host: '',
  port: 0,
  username: '',
  password: '',
  remotePath: '',
  baseUrl: '',
});

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ImageConfigDialog: React.FC<IImageConfigDialogProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<ImageUploadConfig[]>([]);
  const [draft, setDraft] = useState<ImageUploadConfig | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setError('');
    remote.getImageUploadConfigs().then((list: ImageUploadConfig[]) => {
      setConfigs(list);
      setDraft(list.length ? { ...list[0] } : defaultConfig());
    }).catch(() => {
      setConfigs([]);
      setDraft(defaultConfig());
    });
  }, [open]);

  if (!open || !draft) return null;

  const update = (patch: Partial<ImageUploadConfig>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    setError('');
    try {
      await remote.saveImageUploadConfig({ config: draft });
      const list = await remote.getImageUploadConfigs();
      setConfigs(list);
      setMessage(t('Saved'));
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const remove = async () => {
    setError('');
    try {
      await remote.deleteImageUploadConfig({ id: draft.id });
      const list = await remote.getImageUploadConfigs();
      setConfigs(list);
      setDraft(list.length ? { ...list[0] } : defaultConfig());
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  const testUpload = async () => {
    setMessage('');
    setError('');
    try {
      await save();
      const url = await remote.uploadImage({ base64Data: TINY_PNG, fileName: 'typeleft-test.png' });
      setMessage(`${t('Test succeeded')}: ${url}`);
    } catch (e: any) {
      setError(e?.toString?.() ?? t('Operation failed'));
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9996, display: 'flex',
        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 600, maxHeight: '80vh', display: 'flex',
          backgroundColor: 'var(--editorColor00)', borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          width: 170, padding: '16px 0', backgroundColor: 'var(--editorColor02)',
          borderRight: '1px solid var(--editorColor10)', overflowY: 'auto',
        }}>
          <div style={{ padding: '0 12px 8px', fontSize: 12, color: 'var(--editorColor40)' }}>{t('Configurations')}</div>
          {configs.map(c => (
            <div
              key={c.id}
              onClick={() => { setDraft({ ...c }); setMessage(''); setError(''); }}
              style={{
                padding: '6px 12px', fontSize: 13, cursor: 'pointer',
                color: 'var(--editorColor60)',
                backgroundColor: draft.id === c.id ? 'var(--editorColor06)' : 'transparent',
                fontWeight: draft.id === c.id ? 600 : 400,
              }}
            >{c.name}</div>
          ))}
          <div
            onClick={() => setDraft(defaultConfig())}
            style={{ padding: '8px 12px 0', fontSize: 12, cursor: 'pointer', color: 'var(--themeColor)' }}
          >+ {t('New Configuration')}</div>
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{t('Image Hosting')}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--editorColor40)' }}>×</button>
          </div>

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', marginBottom: 6 }}>{t('Name')}</div>
          <input style={inputStyle} value={draft.name} onChange={e => update({ name: e.target.value })} />

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('Upload URL')}</div>
          <input style={inputStyle} value={draft.host} placeholder="https://example.com/api/upload" onChange={e => update({ host: e.target.value })} />

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('Token')}</div>
          <input style={inputStyle} value={draft.password} onChange={e => update({ password: e.target.value })} />

          <div style={{ fontSize: 12, color: 'var(--editorColor40)', margin: '12px 0 6px' }}>{t('Public Base URL')}</div>
          <input style={inputStyle} value={draft.baseUrl} placeholder="https://cdn.example.com" onChange={e => update({ baseUrl: e.target.value })} />

          {message && <div style={{ color: '#2e9d5b', fontSize: 12, marginTop: 12, wordBreak: 'break-all' }}>{message}</div>}
          {error && <div style={{ color: '#e05555', fontSize: 12, marginTop: 12, wordBreak: 'break-all' }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnStyle} onClick={save}>{t('Save')}</button>
              <button style={{ ...btnStyle, color: '#e05555' }} onClick={remove}>{t('Delete')}</button>
            </div>
            <button style={btnStyle} onClick={testUpload}>{t('Test Upload')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageConfigDialog;
