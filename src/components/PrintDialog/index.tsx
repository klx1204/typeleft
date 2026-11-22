import React, { useEffect, useMemo, useRef, useState } from 'react';
import remote from 'services/remote/common';
import transport from 'services/transport';
import { useI18n } from 'services/i18n';
import { getThemeCssForExport } from 'services/customTheme';
import { parseFrontmatter } from 'services/frontmatter';
import {
  buildPrintCss,
  buildCoverHtml,
  builtInPresets,
  defaultPrintSettings,
  MARGIN_PRESETS,
  normalizePrintSettings,
  paperSizeMm,
  type MarginPreset,
  type PrintSettings,
} from 'services/printSettings';
import { buildPrintHtml } from 'services/printDocument';

interface PrintDialogProps {
  open: boolean;
  markdown: string;
  title: string;
  basePath?: string;
  docPrint?: any;
  onClose: () => void;
}

type Tab = 'page' | 'type' | 'structure' | 'header' | 'meta' | 'engine';

interface EngineInfo {
  name: string;
  found: boolean;
  path: string;
  version: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 7px', fontSize: 12, boxSizing: 'border-box',
  border: '1px solid var(--editorColor10)', borderRadius: 4,
  backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)', outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '5px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 4,
  border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
  backgroundColor: 'var(--editorColor04)',
};

const primaryStyle: React.CSSProperties = {
  ...btnStyle, backgroundColor: 'var(--themeColor)', borderColor: 'var(--themeColor)', color: '#fff',
};

const Row: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
    <div style={{ width: 170, flexShrink: 0, fontSize: 12, color: 'var(--editorColor50)' }}>
      {label}
      {hint && <div style={{ fontSize: 11, color: 'var(--editorColor30)' }}>{hint}</div>}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const Check: React.FC<{ checked: boolean; onChange: (value: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--editorColor50)', cursor: 'pointer' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    {label}
  </label>
);

const numValue = (value: string, fallback: number): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const headingNumberingFromDoc = (markdown: string): boolean =>
  /^(?:---|\+\+\+)[\s\S]*?heading-numbering:\s*true/i.test(markdown || '');

const PrintDialog: React.FC<PrintDialogProps> = ({ open, markdown, title, basePath, docPrint, onClose }) => {
  const { t, lang } = useI18n();
  const isZh = lang === 'zh';
  const [tab, setTab] = useState<Tab>('page');
  const [settings, setSettings] = useState<PrintSettings>(defaultPrintSettings());
  const [presets, setPresets] = useState<{ id: string; name: string; settings: PrintSettings }[]>(builtInPresets());
  const [presetId, setPresetId] = useState('builtin-cn-a4');
  const [engines, setEngines] = useState<EngineInfo[]>([]);
  const [engine, setEngine] = useState<'system' | 'xelatex' | 'tectonic' | 'weasyprint'>('system');
  const [enginePaths, setEnginePaths] = useState<Record<string, string>>({});
  const [pandocPath, setPandocPath] = useState('');
  const [appSettings, setAppSettings] = useState<any>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<any>(null);

  const rootUrl = useMemo(
    () => String(parseFrontmatter(markdown).data['typora-root-url'] || ''),
    [markdown],
  );
  const headingNumbering = settings.headingNumbering || headingNumberingFromDoc(markdown);

  const loadEngines = async (paths: Record<string, string>, pandoc: string) => {
    try {
      const list: EngineInfo[] = await remote.detectPrintEngines({
        overrides: { ...paths, ...(pandoc ? { pandoc } : {}) },
      });
      setEngines(Array.isArray(list) ? list : []);
      const available = (list || []).find(item => item.name !== 'pandoc' && item.found);
      if (available) setEngine(available.name as any);
    } catch {
      setEngines([]);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab('page');
    setError('');
    setMessage('');
    setPreview(false);
    setPreviewHtml('');
    remote.getSettings().then((saved: any) => {
      setAppSettings(saved || {});
      setSettings(normalizePrintSettings({ ...(saved?.printSettings || {}), ...(docPrint || {}) }));
      setPresets([...builtInPresets(), ...(Array.isArray(saved?.printPresets) ? saved.printPresets : [])]);
      const paths = saved?.printEnginePaths && typeof saved.printEnginePaths === 'object' ? saved.printEnginePaths : {};
      setEnginePaths(paths);
      setPandocPath(saved?.pandocPath || '');
      void loadEngines(paths, saved?.pandocPath || '');
    }).catch(() => {});
  }, [open, docPrint]);

  useEffect(() => {
    if (!open) return;
    const offProgress = transport.addListener<{ stage: string; engine?: string }>('PrintExportProgress', ({ stage }) => {
      if (stage === 'done') { setBusy(''); setMessage(t('Done')); }
      else if (stage === 'canceled') { setBusy(''); setMessage(t('Canceled')); }
      else setBusy(stage === 'compiling' ? t('Rendering PDF...') : stage);
    });
    return () => { offProgress(); };
  }, [open, t]);

  useEffect(() => {
    if (!preview || !previewHtml || !previewRef.current) return;
    let cancelled = false;
    const container = previewRef.current;
    setPreviewBusy(true);
    (async () => {
      try {
        container.innerHTML = '';
        const { Previewer } = await import('pagedjs');
        const previewer = new Previewer();
        previewerRef.current = previewer;
        await previewer.preview(previewHtml, [], container);
        if (!cancelled) setPreviewBusy(false);
      } catch (err: any) {
        if (cancelled) return;
        container.innerHTML = `<div style="padding:16px;color:#a00">${t('Preview failed')}: ${String(err)}</div>`;
        setPreviewBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preview, previewHtml, t]);

  const update = (patch: Partial<PrintSettings>) => setSettings(prev => normalizePrintSettings({ ...prev, ...patch }));
  const updateCover = (patch: Partial<PrintSettings['cover']>) => update({ cover: { ...settings.cover, ...patch } });
  const updateToc = (patch: Partial<PrintSettings['toc']>) => update({ toc: { ...settings.toc, ...patch } });
  const updateHf = (patch: Partial<PrintSettings['headerFooter']>) => update({ headerFooter: { ...settings.headerFooter, ...patch } });
  const updateMeta = (patch: Partial<PrintSettings['meta']>) => update({ meta: { ...settings.meta, ...patch } });
  const updateMargin = (patch: Partial<PrintSettings['margins']>) => update({ margins: { ...settings.margins, ...patch }, marginPreset: 'custom' });

  const gatherHtml = async (): Promise<string> => {
    const themeCss = await getThemeCssForExport().catch(() => '');
    return buildPrintHtml({
      markdown,
      settings,
      title: settings.meta.title || settings.cover.title || title,
      basePath,
      rootUrl,
      themeCss,
    });
  };

  const pickTarget = (): Promise<string | null> => new Promise((resolve) => {
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      unsub();
      resolve(value);
    };
    const unsub = transport.addListener<string | null>('ExportPathPicked', path => finish(path ?? null));
    const name = `${(settings.meta.title || title || 'document').replace(/[\\/:*?"<>|]/g, '-')}.pdf`;
    remote.pickExportPath({ fileName: name, extension: 'pdf' }).catch(() => finish(null));
    setTimeout(() => finish(null), 120000);
  });

  const openPreview = async () => {
    setError('');
    setPreviewBusy(true);
    setPreview(true);
    try {
      setPreviewHtml(await gatherHtml());
    } catch (err: any) {
      setPreview(false);
      setError(String(err));
    } finally {
      setPreviewBusy(false);
    }
  };

  const print = async () => {
    setError('');
    setBusy(t('Preparing...'));
    try {
      await remote.printHTML({ html: await gatherHtml(), context: {} });
      setBusy('');
    } catch (err: any) {
      setBusy('');
      setError(String(err));
    }
  };

  const exportPdf = async () => {
    setError('');
    setMessage('');
    if (engine === 'system') {
      setError(t('Choose a PDF engine, or use system printing.'));
      return;
    }
    if (!markdown.trim()) {
      setError(t('Nothing to export.'));
      return;
    }
    const targetPath = await pickTarget();
    if (!targetPath) return;
    const values = {
      paper: settings.paper,
      orientation: settings.orientation,
      widthMm: settings.customWidth,
      heightMm: settings.customHeight,
      marginTop: settings.margins.top,
      marginBottom: settings.margins.bottom,
      marginLeft: settings.margins.left,
      marginRight: settings.margins.right,
      bodyFont: settings.bodyFont || undefined,
      headingFont: settings.headingFont || undefined,
      codeFont: settings.codeFont || undefined,
      cjkFont: settings.cjkFont || undefined,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      paragraphSpacing: settings.paragraphSpacing,
      firstLineIndent: settings.firstLineIndent,
      headingNumbering,
      pageBreaks: settings.pageBreaks,
      toc: settings.toc.enabled,
      tocDepth: settings.toc.depth,
      coverTitle: settings.cover.title || settings.meta.title || title,
      coverSubtitle: settings.cover.subtitle || undefined,
      coverAuthor: settings.cover.author || settings.meta.author || undefined,
      coverDate: settings.cover.date || undefined,
      cover: settings.cover.enabled,
      headerLeft: settings.headerFooter.headerLeft || undefined,
      headerCenter: settings.headerFooter.headerCenter || undefined,
      headerRight: settings.headerFooter.headerRight || undefined,
      footerLeft: settings.headerFooter.footerLeft || undefined,
      footerCenter: settings.headerFooter.footerCenter || undefined,
      footerRight: settings.headerFooter.footerRight || undefined,
      differentOddEven: settings.headerFooter.differentOddEven,
      differentFirst: settings.headerFooter.differentFirst,
      pageNumberFormat: settings.pageNumberFormat,
      pageStart: settings.pageStart,
      subject: settings.meta.subject || undefined,
      keywords: settings.meta.keywords || undefined,
      imageMaxWidth: settings.imageMaxWidth,
      css: buildPrintCss(settings),
      coverHtml: buildCoverHtml(settings),
    };
    setBusy(t('Rendering PDF...'));
    try {
      await remote.pandocExportPrint({
        markdown,
        targetPath,
        basePath: basePath || undefined,
        pandocPath: pandocPath || undefined,
        engine,
        enginePath: enginePaths[engine] || undefined,
        options: values,
      });
      setBusy('');
      setMessage(`${t('Exported to')}: ${targetPath}`);
      if (appSettings?.printOpenAfter !== false) remote.openPath({ path: targetPath }).catch(() => {});
    } catch (err: any) {
      setBusy('');
      const raw = String(err ?? '');
      setError(raw === 'canceled'
        ? t('Canceled')
        : raw.includes('engine-not-found')
          ? `${t('PDF engine not found')}: ${engine}. ${t('Set its path in the Engine tab.')}`
          : raw.includes('pandoc-not-found')
            ? t('Pandoc not found. Set its path in Settings → Import & Export.')
            : raw);
    }
  };

  const persist = async (patch: Record<string, any>) => {
    const next = { ...appSettings, printSettings: settings, ...patch };
    setAppSettings(next);
    await remote.saveSettings(next);
  };

  const savePreset = async () => {
    const name = window.prompt(t('Preset name'), isZh ? '我的打印预设' : 'My print preset');
    if (!name) return;
    if (presets.some(p => p.name === name && !p.id.startsWith('builtin-'))) {
      setError(t('A preset with that name already exists.'));
      return;
    }
    const next = [...presets, { id: `preset-${Date.now()}`, name, settings }];
    setPresets(next);
    try {
      await persist({ printPresets: next.filter(item => !item.id.startsWith('builtin-')) });
      setMessage(t('Preset saved'));
    } catch (err: any) { setError(String(err)); }
  };

  const applyPreset = (id: string) => {
    setPresetId(id);
    const preset = presets.find(item => item.id === id);
    if (preset) setSettings(normalizePrintSettings(preset.settings));
  };

  const deletePreset = async () => {
    if (presetId.startsWith('builtin-')) return;
    const next = presets.filter(item => item.id !== presetId);
    setPresets(next);
    setPresetId('builtin-cn-a4');
    try {
      await persist({ printPresets: next.filter(item => !item.id.startsWith('builtin-')) });
    } catch (err: any) { setError(String(err)); }
  };

  const saveSettingsNow = async () => {
    try {
      await persist({});
      setMessage(t('Saved'));
    } catch (err: any) { setError(String(err)); }
  };

  const saveEnginePaths = async () => {
    try {
      await persist({ printEnginePaths: enginePaths });
      await loadEngines(enginePaths, pandocPath);
      setMessage(t('Saved'));
    } catch (err: any) { setError(String(err)); }
  };

  if (!open) return null;

  const [pw, ph] = paperSizeMm(settings);
  const engineFound = (name: string) => engines.find(item => item.name === name);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'page', label: t('Page') },
    { id: 'type', label: t('Typography') },
    { id: 'structure', label: t('Structure') },
    { id: 'header', label: t('Header & Footer') },
    { id: 'meta', label: t('Metadata') },
    { id: 'engine', label: t('Engine') },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10004, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 940, height: '86vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--editorColor00)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--editorColor10)' }}>
          <strong style={{ fontSize: 16 }}>{t('Print / PDF')}</strong>
          <span style={{ fontSize: 12, color: 'var(--editorColor40)' }}>{pw.toFixed(0)} × {ph.toFixed(0)} mm</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: engineFound('pandoc')?.found ? 'var(--editorColor40)' : '#c44' }}>
            {engineFound('pandoc')?.found ? engineFound('pandoc')?.version : t('Pandoc not found')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--editorColor40)' }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 160, padding: '10px 0', borderRight: '1px solid var(--editorColor10)', backgroundColor: 'var(--editorColor02)', overflowY: 'auto' }}>
            {tabs.map(item => (
              <div key={item.id} onClick={() => setTab(item.id)} style={{ padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: tab === item.id ? 'var(--editorColor60)' : 'var(--editorColor40)', backgroundColor: tab === item.id ? 'var(--editorColor06)' : 'transparent', fontWeight: tab === item.id ? 600 : 400 }}>
                {item.label}
              </div>
            ))}
            <div style={{ marginTop: 14, padding: '0 12px', fontSize: 11, color: 'var(--editorColor30)', lineHeight: 1.6 }}>
              {settings.cover.enabled && <div>✓ {t('Cover')}</div>}
              {settings.toc.enabled && <div>✓ {t('Table of Contents')}</div>}
              <div>{settings.headerFooter.differentOddEven ? t('Odd/even pages differ') : t('Same headers on all pages')}</div>
              {docPrint && <div style={{ color: 'var(--themeColor)' }}>{t('Front matter overrides active')}</div>}
            </div>
          </div>

          <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--editorColor40)' }}>{t('Preset')}</span>
              <select value={presetId} onChange={e => applyPreset(e.target.value)} style={{ ...inputStyle, width: 220 }}>
                {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
              <button style={btnStyle} onClick={() => void savePreset()}>{t('Save Preset')}</button>
              {!presetId.startsWith('builtin-') && <button style={btnStyle} onClick={() => void deletePreset()}>{t('Delete')}</button>}
            </div>

            {tab === 'page' && <>
              <Row label={t('Paper')}>
                <select value={settings.paper} onChange={e => update({ paper: e.target.value as any })} style={{ ...inputStyle, width: 220 }}>
                  {['A3', 'A4', 'A5', 'B5', 'Letter', 'custom'].map(paper => <option key={paper} value={paper}>{paper === 'custom' ? t('Custom') : paper}</option>)}
                </select>
              </Row>
              {settings.paper === 'custom' && <Row label={t('Size (mm)')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" value={settings.customWidth} onChange={e => update({ customWidth: numValue(e.target.value, 210) })} style={{ ...inputStyle, width: 100 }} />
                  <span style={{ alignSelf: 'center', color: 'var(--editorColor40)' }}>×</span>
                  <input type="number" value={settings.customHeight} onChange={e => update({ customHeight: numValue(e.target.value, 297) })} style={{ ...inputStyle, width: 100 }} />
                </div>
              </Row>}
              <Row label={t('Orientation')}>
                <select value={settings.orientation} onChange={e => update({ orientation: e.target.value as any })} style={{ ...inputStyle, width: 180 }}>
                  <option value="portrait">{t('Portrait')}</option>
                  <option value="landscape">{t('Landscape')}</option>
                </select>
              </Row>
              <Row label={t('Margins')} hint={t('default: A4 + Chinese official')}>
                <select value={settings.marginPreset} onChange={e => {
                  const preset = e.target.value as MarginPreset;
                  if (preset === 'custom') update({ marginPreset: preset });
                  else update({ marginPreset: preset, margins: { ...MARGIN_PRESETS[preset as Exclude<MarginPreset, 'custom'>] } });
                }} style={{ ...inputStyle, width: 240 }}>
                  <option value="normal">{t('Normal (25.4 mm)')}</option>
                  <option value="cn-official">{t('Chinese official (2.54 / 3.18 cm)')}</option>
                  <option value="narrow">{t('Narrow (12.7 mm)')}</option>
                  <option value="moderate">{t('Moderate (19.05 mm)')}</option>
                  <option value="wide">{t('Wide (38.1 mm)')}</option>
                  <option value="custom">{t('Custom')}</option>
                </select>
              </Row>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                {([['top', t('Top')], ['bottom', t('Bottom')], ['left', t('Left')], ['right', t('Right')]] as const).map(([key, label]) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: 'var(--editorColor40)', marginBottom: 3 }}>{label} (mm)</div>
                    <input type="number" step="0.1" value={settings.margins[key]} onChange={e => updateMargin({ [key]: numValue(e.target.value, settings.margins[key]) })} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <Check checked={settings.pageBreaks} onChange={value => update({ pageBreaks: value })} label={t('Start each top-level heading on a new page')} />
              </div>
            </>}

            {tab === 'type' && <>
              <Row label={t('Body font')}><input style={inputStyle} placeholder={t('System default')} value={settings.bodyFont} onChange={e => update({ bodyFont: e.target.value })} /></Row>
              <Row label={t('Heading font')}><input style={inputStyle} placeholder={t('Same as body')} value={settings.headingFont} onChange={e => update({ headingFont: e.target.value })} /></Row>
              <Row label={t('CJK font')} hint={t('auto-detected when empty')}><input style={inputStyle} placeholder={t('Auto')} value={settings.cjkFont} onChange={e => update({ cjkFont: e.target.value })} /></Row>
              <Row label={t('Code font')}><input style={inputStyle} placeholder="JetBrains Mono" value={settings.codeFont} onChange={e => update({ codeFont: e.target.value })} /></Row>
              <Row label={t('Font size (pt)')}><input type="number" step="0.5" value={settings.fontSize} onChange={e => update({ fontSize: numValue(e.target.value, 11) })} style={{ ...inputStyle, width: 100 }} /></Row>
              <Row label={t('Line height')}><input type="number" step="0.05" value={settings.lineHeight} onChange={e => update({ lineHeight: numValue(e.target.value, 1.6) })} style={{ ...inputStyle, width: 100 }} /></Row>
              <Row label={t('Paragraph spacing (em)')}><input type="number" step="0.1" value={settings.paragraphSpacing} onChange={e => update({ paragraphSpacing: numValue(e.target.value, 0.6) })} style={{ ...inputStyle, width: 100 }} /></Row>
              <Row label={t('First-line indent (em)')}><input type="number" step="0.5" value={settings.firstLineIndent} onChange={e => update({ firstLineIndent: numValue(e.target.value, 0) })} style={{ ...inputStyle, width: 100 }} /></Row>
              <Row label={t('Image max width')}><input style={inputStyle} value={settings.imageMaxWidth} onChange={e => update({ imageMaxWidth: e.target.value })} /></Row>
              <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                <Check checked={settings.justify} onChange={value => update({ justify: value })} label={t('Justify text')} />
                <Check checked={headingNumbering} onChange={value => update({ headingNumbering: value })} label={t('Number headings')} />
              </div>
            </>}

            {tab === 'structure' && <>
              <div style={{ marginBottom: 10 }}><Check checked={settings.cover.enabled} onChange={value => updateCover({ enabled: value })} label={t('Cover page')} /></div>
              {settings.cover.enabled && <>
                <Row label={t('Title')}><input style={inputStyle} value={settings.cover.title} onChange={e => updateCover({ title: e.target.value })} /></Row>
                <Row label={t('Subtitle')}><input style={inputStyle} value={settings.cover.subtitle} onChange={e => updateCover({ subtitle: e.target.value })} /></Row>
                <Row label={t('Author')}><input style={inputStyle} value={settings.cover.author} onChange={e => updateCover({ author: e.target.value })} /></Row>
                <Row label={t('Date')}><input style={inputStyle} value={settings.cover.date} onChange={e => updateCover({ date: e.target.value })} /></Row>
                <div style={{ fontSize: 11, color: 'var(--editorColor30)', marginBottom: 10 }}>{t('Leave a field empty to hide it; the document title is used when available.')}</div>
              </>}
              <div style={{ margin: '12px 0 10px' }}><Check checked={settings.toc.enabled} onChange={value => updateToc({ enabled: value })} label={t('Table of contents page')} /></div>
              {settings.toc.enabled && <>
                <Row label={t('TOC title')}><input style={inputStyle} value={settings.toc.title} onChange={e => updateToc({ title: e.target.value })} /></Row>
                <Row label={t('Depth')}>
                  <select value={settings.toc.depth} onChange={e => updateToc({ depth: numValue(e.target.value, 3) })} style={{ ...inputStyle, width: 100 }}>
                    {[1, 2, 3, 4, 5, 6].map(depth => <option key={depth} value={depth}>{depth}</option>)}
                  </select>
                </Row>
                <Check checked={settings.toc.pageNumbers} onChange={value => updateToc({ pageNumbers: value })} label={t('Show page numbers')} />
              </>}
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--editorColor30)', lineHeight: 1.7 }}>
                {t('Tables repeat their header across pages; headings avoid splitting from following text; images keep their aspect ratio.')}
              </div>
            </>}

            {tab === 'header' && <>
              <div style={{ fontSize: 12, color: 'var(--editorColor40)', marginBottom: 10 }}>
                {t('Tokens')}: <code>{'{page}'}</code> <code>{'{total}'}</code> <code>{'{title}'}</code> <code>{'{author}'}</code> <code>{'{date}'}</code>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                {([['headerLeft', 'L'], ['headerCenter', 'C'], ['headerRight', 'R']] as const).map(([key, label]) => (
                  <input key={key} style={inputStyle} placeholder={`${t('Header')} ${label}`} value={settings.headerFooter[key]} onChange={e => updateHf({ [key]: e.target.value })} />
                ))}
                {([['footerLeft', 'L'], ['footerCenter', 'C'], ['footerRight', 'R']] as const).map(([key, label]) => (
                  <input key={key} style={inputStyle} placeholder={`${t('Footer')} ${label}`} value={settings.headerFooter[key]} onChange={e => updateHf({ [key]: e.target.value })} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 20, margin: '8px 0 12px' }}>
                <Check checked={settings.headerFooter.differentOddEven} onChange={value => updateHf({ differentOddEven: value })} label={t('Different odd/even pages')} />
                <Check checked={settings.headerFooter.differentFirst} onChange={value => updateHf({ differentFirst: value })} label={t('Different first page')} />
              </div>
              {settings.headerFooter.differentOddEven && <>
                <div style={{ fontSize: 12, color: 'var(--editorColor40)', marginBottom: 6 }}>{t('Even pages')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {([['evenHeaderLeft', 'HL'], ['evenHeaderCenter', 'HC'], ['evenHeaderRight', 'HR'], ['evenFooterLeft', 'FL'], ['evenFooterCenter', 'FC'], ['evenFooterRight', 'FR']] as const).map(([key, label]) => (
                    <input key={key} style={inputStyle} placeholder={label} value={settings.headerFooter[key]} onChange={e => updateHf({ [key]: e.target.value })} />
                  ))}
                </div>
              </>}
              <Row label={t('Page numbers')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={settings.pageNumberFormat} onChange={e => update({ pageNumberFormat: e.target.value as any })} style={{ ...inputStyle, width: 130 }}>
                    <option value="arabic">1, 2, 3</option>
                    <option value="roman">i, ii, iii</option>
                    <option value="Roman">I, II, III</option>
                    <option value="alpha">a, b, c</option>
                    <option value="Alpha">A, B, C</option>
                  </select>
                  <input type="number" min={1} value={settings.pageStart} onChange={e => update({ pageStart: numValue(e.target.value, 1) })} style={{ ...inputStyle, width: 90 }} placeholder={t('Start')} />
                </div>
              </Row>
              <div style={{ fontSize: 11, color: 'var(--editorColor30)', lineHeight: 1.7 }}>
                {t('Browser/system printing cannot control running headers; they appear in WeasyPrint and LaTeX PDF exports.')}
              </div>
            </>}

            {tab === 'meta' && <>
              <Row label={t('PDF title')}><input style={inputStyle} value={settings.meta.title} onChange={e => updateMeta({ title: e.target.value })} placeholder={title} /></Row>
              <Row label={t('Author')}><input style={inputStyle} value={settings.meta.author} onChange={e => updateMeta({ author: e.target.value })} /></Row>
              <Row label={t('Subject')}><input style={inputStyle} value={settings.meta.subject} onChange={e => updateMeta({ subject: e.target.value })} /></Row>
              <Row label={t('Keywords')}><input style={inputStyle} value={settings.meta.keywords} onChange={e => updateMeta({ keywords: e.target.value })} placeholder="one, two" /></Row>
              <div style={{ fontSize: 11, color: 'var(--editorColor30)', lineHeight: 1.7 }}>{t('Metadata is embedded in PDF exports and meta tags in HTML.')}</div>
            </>}

            {tab === 'engine' && <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {([
                  ['system', t('System print'), t('Opens the system print dialog; page size and margins apply, running headers are limited.')],
                  ['xelatex', 'XeLaTeX', t('Full layout: cover, TOC, headers, fonts, bookmarks, CJK.')],
                  ['tectonic', 'Tectonic', t('XeTeX-based, downloads packages on demand.')],
                  ['weasyprint', 'WeasyPrint', t('CSS paged media: page numbers, running headers, links.')],
                ] as const).map(([id, label, hint]) => {
                  const info = engineFound(id);
                  return (
                    <label key={id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--editorColor50)', cursor: 'pointer' }}>
                      <input type="radio" checked={engine === id} onChange={() => setEngine(id)} style={{ marginTop: 2 }} />
                      <span>
                        <strong>{label}</strong>
                        <span style={{ color: 'var(--editorColor30)' }}> · {hint}</span>
                        {id !== 'system' && <div style={{ fontSize: 11, color: info?.found ? '#2e9d5b' : '#c44' }}>{info?.found ? `${info.version} — ${info.path}` : t('Not found')}</div>}
                      </span>
                    </label>
                  );
                })}
              </div>
              {engine !== 'system' && (
                <Row label={t('Custom engine path')} hint={t('leave empty to use PATH')}>
                  <input style={inputStyle} placeholder={engine} value={enginePaths[engine] || ''} onChange={e => setEnginePaths({ ...enginePaths, [engine]: e.target.value })} />
                </Row>
              )}
              <Row label="Pandoc">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={inputStyle} placeholder={t('auto-detect')} value={pandocPath} onChange={e => setPandocPath(e.target.value)} />
                  <button style={btnStyle} onClick={() => void saveEnginePaths()}>{t('Save & Detect')}</button>
                </div>
              </Row>
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--editorColor50)' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('Capability matrix')}</div>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                  <thead><tr>{[t('Feature'), t('System'), 'XeLaTeX/Tectonic', 'WeasyPrint'].map(h => <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid var(--editorColor10)', padding: '3px 6px' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[
                      [t('Paper & margins'), '✓', '✓', '✓'],
                      [t('Cover & TOC'), 'partial', '✓', '✓'],
                      [t('Page numbers'), 'partial', '✓', '✓'],
                      [t('Running headers'), '—', '✓', '✓'],
                      [t('CJK fonts'), 'system', '✓', '✓'],
                      [t('PDF metadata'), 'partial', '✓', '✓'],
                      [t('Bookmarks'), '—', '✓', '✓'],
                    ].map(row => (
                      <tr key={row[0]}>
                        {row.map((cell, index) => <td key={index} style={{ borderBottom: '1px solid var(--editorColor06)', padding: '3px 6px', color: cell === '—' ? 'var(--editorColor30)' : 'var(--editorColor50)' }}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 6, color: 'var(--editorColor30)' }}>{t('Engines are detected, never installed automatically.')}</div>
              </div>
            </>}

            {busy && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--themeColor)' }}>{busy}</div>}
            {message && <div style={{ marginTop: 12, fontSize: 12, color: '#2e9d5b' }}>{message}</div>}
            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#e05555', whiteSpace: 'pre-wrap' }}>{error}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--editorColor10)' }}>
          <button style={btnStyle} onClick={() => void saveSettingsNow()}>{t('Save Settings')}</button>
          <span style={{ marginLeft: 'auto' }} />
          <button style={btnStyle} onClick={onClose}>{t('Close')}</button>
          <button style={btnStyle} onClick={() => void openPreview()}>{t('Preview')}</button>
          <button style={btnStyle} onClick={() => void print()}>{t('System Print')}</button>
          <button style={primaryStyle} disabled={engine === 'system' || !!busy} onClick={() => void exportPdf()}>{busy ? t('Rendering PDF...') : t('Export PDF')}</button>
          {busy && <button style={{ ...btnStyle, color: '#e05555' }} onClick={() => { void remote.cancelPrintExport(); }}>{t('Cancel')}</button>}
        </div>
      </div>

      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10010, display: 'flex', flexDirection: 'column', backgroundColor: '#666' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', backgroundColor: '#222', color: '#eee' }}>
            <strong style={{ fontSize: 13 }}>{t('Print preview')}</strong>
            <span style={{ fontSize: 12, color: '#aaa' }}>{t('Page size and margins follow the print settings.')}</span>
            <span style={{ marginLeft: 'auto' }} />
            <button style={{ ...btnStyle, backgroundColor: '#333', color: '#eee', borderColor: '#555' }} onClick={() => { setPreview(false); previewerRef.current = null; }}>{t('Back')}</button>
            <button style={{ ...btnStyle, backgroundColor: '#333', color: '#eee', borderColor: '#555' }} onClick={() => void print()}>{t('System Print')}</button>
            <button style={{ ...btnStyle, backgroundColor: 'var(--themeColor)', color: '#fff', borderColor: 'var(--themeColor)' }} disabled={engine === 'system'} onClick={() => void exportPdf()}>{t('Export PDF')}</button>
          </div>
          {previewBusy && <div style={{ padding: 10, color: '#eee', fontSize: 12 }}>{t('Laying out pages...')}</div>}
          <div ref={previewRef} style={{ flex: 1, overflow: 'auto', padding: '16px 0', background: '#666' }} />
        </div>
      )}
    </div>
  );
};

export default PrintDialog;
