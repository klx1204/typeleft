import React, { useEffect, useMemo, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { useI18n } from 'services/i18n';
import { parseFrontmatter } from 'services/frontmatter';
import {
  extractImageRefs,
  imageMarkdownSrc,
  localImagePath,
  removeFirstImageRef,
  replaceImageSrc,
  type ImageRef,
} from 'services/imageManager';

interface ImageManagerProps {
  open: boolean;
  markdown: string;
  basePath: string;
  onChange: (markdown: string) => void;
  onClose: () => void;
}

const btn: React.CSSProperties = {
  padding: '4px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
  border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
  backgroundColor: 'var(--editorColor04)',
};

const pickFolder = (defaultPath?: string): Promise<string | null> => new Promise((resolve) => {
  let done = false;
  const finish = (value: string | null) => {
    if (done) return;
    done = true;
    unsubscribe();
    resolve(value);
  };
  const unsubscribe = transport.addListener<string | null>('FolderPicked', path => finish(path ?? null));
  remote.pickFolder({ defaultPath }).catch(() => finish(null));
  setTimeout(() => finish(null), 120000);
});

const ImageManager: React.FC<ImageManagerProps> = ({ open, markdown, basePath, onChange, onClose }) => {
  const { t } = useI18n();
  const [working, setWorking] = useState(markdown);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const rootUrl = String(parseFrontmatter(working).data['typora-root-url'] || '');
  const refs = useMemo<ImageRef[]>(() => extractImageRefs(working), [working]);

  useEffect(() => {
    if (!open) return;
    setWorking(markdown);
    setMessage('');
    setError('');
    setMissing({});
  }, [open, markdown]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, boolean> = {};
      for (const ref of refs) {
        if (ref.kind !== 'local') continue;
        const path = localImagePath(ref.src, basePath, rootUrl);
        if (!path) continue;
        try { next[ref.src] = !(await remote.checkFileExists({ path })); } catch { next[ref.src] = true; }
      }
      if (!cancelled) setMissing(next);
    })();
    return () => { cancelled = true; };
  }, [open, refs, basePath, rootUrl]);

  const apply = (next: string) => {
    setWorking(next);
    onChange(next);
  };

  const downloadAll = async () => {
    const remoteRefs = refs.filter(ref => ref.kind === 'remote');
    if (!remoteRefs.length) return;
    const dir = await pickFolder(`${basePath}/images`);
    if (!dir) return;
    setBusy(true);
    setError('');
    const failures: string[] = [];
    let next = working;
    for (let i = 0; i < remoteRefs.length; i += 1) {
      const ref = remoteRefs[i];
      setMessage(`${t('Downloading')} ${i + 1}/${remoteRefs.length}`);
      try {
        const saved = await remote.downloadImage({ url: ref.src, destDir: dir });
        next = replaceImageSrc(next, ref.src, imageMarkdownSrc(saved, basePath));
        apply(next);
      } catch (err: any) {
        failures.push(`${ref.src}: ${String(err)}`);
      }
    }
    setBusy(false);
    setMessage(failures.length ? `${t('Failed')}: ${failures.length}` : t('Done'));
    if (failures.length) setError(failures.join('\n'));
  };

  const copyOrMoveAll = async (move: boolean) => {
    const localRefs = refs.filter(ref => ref.kind === 'local');
    if (!localRefs.length) return;
    const dir = await pickFolder(`${basePath}/images`);
    if (!dir) return;
    setBusy(true);
    setError('');
    const failures: string[] = [];
    let next = working;
    for (let i = 0; i < localRefs.length; i += 1) {
      const ref = localRefs[i];
      const source = localImagePath(ref.src, basePath, rootUrl);
      if (!source) continue;
      setMessage(`${move ? t('Moving') : t('Copying')} ${i + 1}/${localRefs.length}`);
      try {
        const saved = move
          ? await remote.moveImageToDir({ source, destDir: dir })
          : await remote.copyImageToDir({ source, destDir: dir });
        next = replaceImageSrc(next, ref.src, imageMarkdownSrc(saved, basePath));
        apply(next);
      } catch (err: any) {
        failures.push(`${ref.src}: ${String(err)}`);
      }
    }
    setBusy(false);
    setMessage(failures.length ? `${t('Failed')}: ${failures.length}` : t('Done'));
    if (failures.length) setError(failures.join('\n'));
  };

  const renameOne = async (ref: ImageRef) => {
    const source = localImagePath(ref.src, basePath, rootUrl);
    if (!source) return;
    const current = source.split('/').pop() || 'image';
    const name = window.prompt(t('New name'), current);
    if (!name || name === current) return;
    try {
      const saved = await remote.renameFile({ oldPath: source, newName: name });
      apply(replaceImageSrc(working, ref.src, imageMarkdownSrc(saved, basePath)));
      setMessage(t('Done'));
    } catch (err: any) {
      setError(String(err));
    }
  };

  const moveOne = async (ref: ImageRef) => {
    const source = localImagePath(ref.src, basePath, rootUrl);
    if (!source) return;
    const dir = await pickFolder(source.split('/').slice(0, -1).join('/'));
    if (!dir) return;
    try {
      const saved = await remote.moveImageToDir({ source, destDir: dir });
      apply(replaceImageSrc(working, ref.src, imageMarkdownSrc(saved, basePath)));
      setMessage(t('Done'));
    } catch (err: any) { setError(String(err)); }
  };

  const copyOne = async (ref: ImageRef) => {
    const source = localImagePath(ref.src, basePath, rootUrl);
    if (!source) return;
    const dir = await pickFolder(source.split('/').slice(0, -1).join('/'));
    if (!dir) return;
    try {
      const saved = await remote.copyImageToDir({ source, destDir: dir });
      apply(replaceImageSrc(working, ref.src, imageMarkdownSrc(saved, basePath)));
      setMessage(t('Done'));
    } catch (err: any) { setError(String(err)); }
  };

  const deleteOne = async (ref: ImageRef) => {
    const source = localImagePath(ref.src, basePath, rootUrl);
    const next = removeFirstImageRef(working, ref.src);
    apply(next);
    const stillUsed = extractImageRefs(next).some(item => item.src === ref.src);
    if (source && !stillUsed && window.confirm(`${t('Delete image file?')}\n${source}`)) {
      try { await remote.deleteFile({ path: source, useTrash: true }); } catch (err: any) { setError(String(err)); }
    }
  };

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9995, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 760, maxHeight: '80vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--editorColor00)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--editorColor10)' }}>
          <strong style={{ fontSize: 15 }}>{t('Image Manager')}</strong>
          <span style={{ fontSize: 12, color: 'var(--editorColor40)' }}>{refs.length} {t('images')}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button style={btn} disabled={busy} onClick={() => void downloadAll()}>{t('Download remote')}</button>
            <button style={btn} disabled={busy} onClick={() => void copyOrMoveAll(false)}>{t('Copy all')}</button>
            <button style={btn} disabled={busy} onClick={() => void copyOrMoveAll(true)}>{t('Move all')}</button>
            <button style={btn} onClick={onClose}>{t('Close')}</button>
          </span>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--editorColor40)', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>{t('Source')}</th>
                <th style={{ padding: '6px 10px' }}>{t('Type')}</th>
                <th style={{ padding: '6px 10px' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {refs.map(ref => (
                <tr key={ref.src} style={{ borderTop: '1px solid var(--editorColor06)' }}>
                  <td style={{ padding: '6px 10px', wordBreak: 'break-all', color: missing[ref.src] ? '#e05555' : 'var(--editorColor50)' }}>
                    {ref.src}{missing[ref.src] ? ` (${t('missing')})` : ''}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--editorColor40)' }}>{ref.kind}</td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {ref.kind === 'local' && (
                      <>
                        <button style={btn} onClick={() => void renameOne(ref)}>{t('Rename')}</button>{' '}
                        <button style={btn} onClick={() => void moveOne(ref)}>{t('Move')}</button>{' '}
                        <button style={btn} onClick={() => void copyOne(ref)}>{t('Copy')}</button>{' '}
                      </>
                    )}
                    <button style={{ ...btn, color: '#e05555' }} onClick={() => void deleteOne(ref)}>{t('Delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!refs.length && <div style={{ padding: 18, fontSize: 12, color: 'var(--editorColor40)', textAlign: 'center' }}>{t('No images')}</div>}
        </div>
        {(message || error) && (
          <div style={{ padding: '8px 14px', fontSize: 12, color: error ? '#e05555' : 'var(--editorColor40)', borderTop: '1px solid var(--editorColor10)', whiteSpace: 'pre-wrap' }}>
            {message}{error ? `\n${error}` : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageManager;
