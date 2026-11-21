import React, { useEffect, useState } from 'react';
import transport from 'services/transport';
import { remote } from 'services/remote';
import { useI18n } from 'services/i18n';

interface IStateChange {
  state: {
    wordCount?: { character?: number; word?: number; characters?: number; words?: number };
    toc?: string;
    cur?: number;
    frontmatter?: Record<string, any>;
  };
}

const StatusBar: React.FC = () => {
  const { t } = useI18n();
  const [words, setWords] = useState(0);
  const [chars, setChars] = useState(0);
  const [saveState, setSaveState] = useState('');
  const [visible, setVisible] = useState(true);
  const [wordCountMethod, setWordCountMethod] = useState(0);
  const [meta, setMeta] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const unsub = transport.addListener<IStateChange>('StateChange', (payload) => {
      const wc = payload.state?.wordCount;
      if (wc) {
        setWords(wc.word ?? wc.words ?? 0);
        setChars(wc.character ?? wc.characters ?? 0);
      }
      if (payload.state?.frontmatter) setMeta(payload.state.frontmatter);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<{ status: string }>('SaveState', (payload) => {
      setSaveState(payload.status);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    remote.getSettings().then((s: any) => {
      if (typeof s?.statusBarOpen === 'boolean') setVisible(s.statusBarOpen);
      if (typeof s?.wordCountMethod === 'number') setWordCountMethod(s.wordCountMethod);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = transport.addListener<Record<string, unknown>>('SettingsChanged', (payload) => {
      if (typeof payload.statusBarOpen === 'boolean') setVisible(payload.statusBarOpen);
      if (typeof payload.wordCountMethod === 'number') setWordCountMethod(payload.wordCountMethod);
    });
    return () => unsub();
  }, []);

  if (!visible) return null;

  const saveLabel =
    saveState === 'Saved' ? t('Saved')
      : saveState === 'Backup found' ? t('Backup found')
        : saveState === 'Save failed' ? t('Save failed')
          : saveState === 'Saving' ? t('Saving')
            : saveState;

  return (
    <div className="StatusBar footer-item" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 24, display: 'flex', alignItems: 'center',
      padding: '0 12px', fontSize: 12, userSelect: 'none',
      borderTop: '1px solid var(--editorColor10)',
      backgroundColor: 'var(--editorColor04)',
      color: 'var(--editorColor40)',
      zIndex: 1000, gap: 16,
    }}>
      <div>
        {wordCountMethod === 1
          ? `${chars} ${t('chars')}`
          : `${words} ${t('words')} / ${chars} ${t('chars')}`}
      </div>
      {saveLabel && <div>{saveLabel}</div>}
      {meta && (meta.title || meta.tags || meta.author) && (
        <div
          title={JSON.stringify(meta, null, 2)}
          style={{ marginLeft: 'auto', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {meta.title ? String(meta.title) : ''}
          {meta.title && (meta.author || meta.tags) ? ' · ' : ''}
          {meta.author ? String(meta.author) : ''}
          {meta.author && meta.tags ? ' · ' : ''}
          {meta.tags && Array.isArray(meta.tags) ? meta.tags.join(', ') : (meta.tags ? String(meta.tags) : '')}
        </div>
      )}
    </div>
  );
};

export default StatusBar;
