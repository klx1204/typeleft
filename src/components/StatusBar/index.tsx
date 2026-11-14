import React, { useEffect, useState } from 'react';
import transport from 'services/transport';
import { remote } from 'services/remote';
import { useI18n } from 'services/i18n';

interface IStateChange {
  state: {
    wordCount?: { character?: number; word?: number; characters?: number; words?: number };
    toc?: string;
    cur?: number;
  };
}

const StatusBar: React.FC = () => {
  const { t } = useI18n();
  const [words, setWords] = useState(0);
  const [chars, setChars] = useState(0);
  const [saveState, setSaveState] = useState('');
  const [visible, setVisible] = useState(true);
  const [wordCountMethod, setWordCountMethod] = useState(0);

  useEffect(() => {
    const unsub = transport.addListener<IStateChange>('StateChange', (payload) => {
      const wc = payload.state?.wordCount;
      if (wc) {
        setWords(wc.word ?? wc.words ?? 0);
        setChars(wc.character ?? wc.characters ?? 0);
      }
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

  const saveLabel = saveState === 'Saved' ? t('Saved') : saveState === 'Backup found' ? t('Backup found') : saveState;

  return (
    <div className="StatusBar" style={{
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
    </div>
  );
};

export default StatusBar;
