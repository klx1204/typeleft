import React, { useEffect, useMemo, useRef, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { useI18n } from 'services/i18n';

type Mode = 'content' | 'files' | 'tags';

interface FolderSearchProps {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
}

interface Hit {
  path: string;
  rel: string;
  line?: number;
  text?: string;
  tags?: string[];
}

const fuzzyScore = (text: string, needle: string): number => {
  let index = 0;
  let score = 0;
  for (const char of needle) {
    const found = text.indexOf(char, index);
    if (found === -1) return -1;
    score += found === index ? 2 : 1;
    index = found + 1;
  }
  return score - text.length * 0.01;
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14, border: 'none',
  outline: 'none', boxSizing: 'border-box',
  backgroundColor: 'var(--editorColor02)', color: 'var(--editorColor60)',
  borderBottom: '1px solid var(--editorColor10)',
};

const FolderSearch: React.FC<FolderSearchProps> = ({ open, initialMode = 'content', onClose }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [folder, setFolder] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [files, setFiles] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [options, setOptions] = useState<any>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setQuery('');
    setResults([]);
    setActive(0);
    setError('');
    remote.getSettings().then((settings: any) => setOptions(settings || {})).catch(() => {});
    remote.listRecentFolders()
      .then((list: string[]) => {
        const dir = Array.isArray(list) ? list[0] : '';
        setFolder(dir || '');
        if (!dir) setError(t('Open a folder first'));
      })
      .catch(() => setError(t('Open a folder first')));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, initialMode, t]);

  useEffect(() => {
    if (!open || !folder || mode !== 'files' || files.length) return;
    remote.listFolderFiles({ root: folder })
      .then((rows: unknown) => setFiles(Array.isArray(rows) ? rows as Hit[] : []))
      .catch((err: any) => setError(String(err)));
  }, [open, folder, mode, files.length]);

  useEffect(() => {
    if (!open || !folder || mode === 'files') return;
    const value = query.trim();
    if (!value) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      const request = mode === 'content'
        ? remote.searchFolder({
          root: folder,
          query: value,
          caseSensitive: !!options.searchIsCaseSensitive,
          regex: !!options.searchIsRegexp,
          wholeWord: !!options.searchIsWholeWord,
        })
        : remote.searchTags({ root: folder, query: value });
      request.then((rows: unknown) => {
        setResults(Array.isArray(rows) ? rows as Hit[] : []);
        setActive(0);
        setError('');
      }).catch((err: any) => setError(String(err))).finally(() => setLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [open, folder, mode, query, options]);

  const fileHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files.slice(0, 300);
    return files
      .map(file => ({ file, score: fuzzyScore(file.rel.toLowerCase(), needle) }))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 300)
      .map(item => item.file);
  }, [files, query]);

  const visible = mode === 'files' ? fileHits : results;

  const openHit = async (hit: Hit) => {
    try {
      const text = await remote.readTextFile({ path: hit.path });
      const basePath = hit.path.replace(/[\\/][^\\/]+$/, '');
      transport.postMessage('LoadFile', { text, basePath, filePath: hit.path });
      const line = hit.line ?? 1;
      window.setTimeout(() => transport.postMessage('GoToLine', { line }), 300);
      onClose();
    } catch (err: any) {
      setError(String(err));
    }
  };

  if (!open) return null;

  const modes: { id: Mode; label: string }[] = [
    { id: 'content', label: t('Content') },
    { id: 'files', label: t('Files') },
    { id: 'tags', label: t('Tags') },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9996, display: 'flex',
        justifyContent: 'center', paddingTop: '10vh', backgroundColor: 'rgba(0,0,0,0.3)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 680, maxHeight: 520, display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--editorColor00)', borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, visible.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && visible[active]) { void openHit(visible[active]); }
          }}
          placeholder={mode === 'content' ? t('Search in folder...') : mode === 'tags' ? t('Search tags...') : t('Type a file name...')}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 4, padding: '6px 10px', borderBottom: '1px solid var(--editorColor10)', fontSize: 12 }}>
          {modes.map(item => (
            <button
              key={item.id}
              onClick={() => { setMode(item.id); setActive(0); }}
              style={{
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                border: '1px solid var(--editorColor10)',
                backgroundColor: mode === item.id ? 'var(--editorColor06)' : 'transparent',
                color: 'var(--editorColor50)',
              }}
            >{item.label}</button>
          ))}
          <span style={{ marginLeft: 'auto', color: 'var(--editorColor30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
            {folder || t('No folder')}
          </span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error && <div style={{ padding: 12, fontSize: 12, color: '#e05555' }}>{error}</div>}
          {loading && <div style={{ padding: 12, fontSize: 12, color: 'var(--editorColor40)' }}>{t('Searching...')}</div>}
          {!loading && !error && !visible.length && (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--editorColor40)', textAlign: 'center' }}>
              {query ? t('No result') : t('Type to search')}
            </div>
          )}
          {visible.map((hit, index) => (
            <div
              key={`${hit.path}:${hit.line ?? 0}:${index}`}
              className="folder-search-hit"
              onClick={() => void openHit(hit)}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                backgroundColor: index === active ? 'var(--editorColor06)' : 'transparent',
                color: 'var(--editorColor50)',
              }}
            >
              {mode === 'content' ? (
                <>
                  <span style={{ color: 'var(--themeColor)' }}>{hit.rel}:{hit.line}</span>
                  <div style={{ color: 'var(--editorColor40)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.text}</div>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--themeColor)' }}>{hit.rel}</span>
                  {mode === 'tags' && hit.tags?.length ? (
                    <span style={{ color: 'var(--editorColor40)' }}> · {hit.tags.join(', ')}</span>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FolderSearch;
