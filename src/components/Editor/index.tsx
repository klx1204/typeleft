import CodeMirror from "components/CodeMirror";
import MuyaEditor from "components/Muya";
import MilkdownEditor from "components/MilkdownEditor";
import Sidebar from "components/Sidebar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { remote } from "services/remote";
import transport from "services/transport";
import remoteCommon from "services/remote/common";
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import './index.scss'
import ExportHtml from "services/exportHtml";
import { htmlToMarkdown } from "services/importHtml";
import { DEFAULT_TURNDOWN_CONFIG } from "components/Muya/lib/config";
import { getHtmlToc, getTOC } from "services/common";
import { useI18n } from "services/i18n";

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 10002, display: 'flex',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)',
};
const modalCardStyle: React.CSSProperties = {
    width: 420, padding: 22, borderRadius: 8,
    backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};
const modalTitleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, marginBottom: 10 };
const modalTextStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.6, marginBottom: 18, color: 'var(--editorColor60)' };
const modalActionsStyle: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8 };
const dialogBtnStyle: React.CSSProperties = {
    padding: '6px 14px', fontSize: 13, cursor: 'pointer', borderRadius: 4,
    border: '1px solid var(--editorColor10)', color: 'var(--editorColor50)',
    backgroundColor: 'var(--editorColor04)',
};
const dialogPrimaryBtnStyle: React.CSSProperties = {
    ...dialogBtnStyle, backgroundColor: 'var(--themeColor)', borderColor: 'var(--themeColor)', color: '#fff',
};

const Editor: React.FC = () => {
    const { t } = useI18n();
    const [markdown, setMarkdown] = useState<string>();
    const markdownRef = useRef<string>();
    const [cursor, setCursor] = useState<any>();
    const [options, setOptions] = useState<any>();
    const optionsRef = useRef<any>();
    const [searchOpen, setSearchOpen] = useState(0);
    const [searchArg, setSearchArg] = useState<{ value: string, opt: any }>();
    const muyaScrollTopRef = useRef(0);
    const codeMirrorScrollRef = useRef(0);
    const [filePath, setFilePath] = useState<string>();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarSection, setSidebarSection] = useState<'filetree' | 'toc'>('filetree');
    const [sidePaneWidth, setSidePaneWidth] = useState(240);
    const lastSavedContentRef = useRef('');
    const lastBackupRef = useRef('');
    const lastMtimeRef = useRef<number | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [conflict, setConflict] = useState<{ content: string } | null>(null);
    const [backupPrompt, setBackupPrompt] = useState<{ id: string; created: number; content: string } | null>(null);

    const OnFileLoaded = useCallback(() => setTimeout(() => transport.postMessage('FileLoaded', { text: markdownRef.current }), 100), [])

    // Track what is on disk so we never rewrite unchanged content and can detect
    // concurrent external edits.
    const adoptLoadedFile = useCallback((text: string, path?: string) => {
        lastSavedContentRef.current = text;
        lastBackupRef.current = text;
        lastMtimeRef.current = null;
        setSaveStatus('idle');
        if (path) {
            remoteCommon.getFileMtime({ path }).then(m => { lastMtimeRef.current = m }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        Promise.all([
            remote.getSettings(),
            remote.contentLoaded(),
        ]).then(([settings, pending]: any) => {
            const { markdown, basePath, ...opt } = settings
            if (typeof (opt as any).sidePaneWidth === 'number') {
                setSidePaneWidth((opt as any).sidePaneWidth)
            }
            const text = pending?.text ?? markdown
            const bp = pending?.base_path ?? basePath
            const fp = pending?.file_path ?? undefined
            window.basePath = bp
            setFilePath(fp)
            if (fp) {
                const name = fp.split('/').pop() || 'Typeleft'
                document.title = `${name} - Typeleft`
                getCurrentWebviewWindow().setTitle(`${name} - Typeleft`).catch(() => {})
            }
            setOptions(opt)
            setMarkdown(text)
            markdownRef.current = text
            adoptLoadedFile(text, fp)
            OnFileLoaded();
        })
    }, [OnFileLoaded]);

    useEffect(() => {
        optionsRef.current = options
    }, [options])

    useEffect(() => {
        if (markdown != undefined && markdownRef.current != markdown) {
            transport.postMessage('MarkdownChange', { text: markdown });
            markdownRef.current = markdown
        }
    }, [markdown])

    useEffect(() => {
        transport.postMessage('CursorChange', { cursor })
    }, [cursor])

    useEffect(() => transport.addListener<IExportArgs>('Export', async ({ type, context, basePath, title, options, targetPath }) => {
        let source = markdownRef.current ?? ''
        if (options && (options as any).includeFrontmatter === false) {
            source = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
        }
        const fallbackTitle = filePath
            ? (filePath.split('/').pop() || 'Typeleft').replace(/\.[^.]+$/, '')
            : 'Typeleft'
        const generateOption = {
            printOptimization: type === 'print',
            title: title || fallbackTitle,
            toc: getHtmlToc(getTOC(source).toc),
            ...options,
        }
        const baseUrl = basePath ? `file:///${basePath.replaceAll('\\', '/')}/` : undefined
        const html = await new ExportHtml(source, { ...optionsRef.current, baseUrl }).generate(generateOption)
        if (type == 'print') {
            remote.printHTML({ html, context })
        } else if (targetPath) {
            try {
                await remote.writeTextFile({ path: targetPath, content: html })
                transport.postMessage('ExportDone', { path: targetPath })
            } catch (e) {
                transport.postMessage('ExportFailed', { message: String(e) })
            }
        } else {
            remote.exportCallback({ html, context })
        }
    }), []);

    useEffect(() => transport.addListener<{ type: string, text: string }>('ImportFile', ({ text }) => {
        setMarkdown(htmlToMarkdown(text, [], DEFAULT_TURNDOWN_CONFIG))
    }), [options]);

    useEffect(() => transport.addListener<{ text: string, basePath: string, filePath?: string }>('LoadFile', ({ text, basePath, filePath }) => {
        window.basePath = basePath
        setFilePath(filePath)
        setCursor(undefined)
        setMarkdown(text)
        markdownRef.current = text
        adoptLoadedFile(text, filePath)
        if (filePath) {
            const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'Typeleft';
            document.title = `${name} - Typeleft`;
            getCurrentWebviewWindow().setTitle(`${name} - Typeleft`).catch(() => {});
        }
        OnFileLoaded();
    }), [OnFileLoaded]);

    useEffect(() => transport.addListener<{ text: string, cursor: string, basePath: string }>('SetMarkdown', ({ text, cursor, basePath }) => {
        window.basePath = basePath
        setCursor(cursor)
        setTimeout(() => setMarkdown(text))
        markdownRef.current = text
        adoptLoadedFile(text)
    }), [adoptLoadedFile]);

    useEffect(() => transport.addListener<Record<string, unknown>>('SettingsChanged', (newOptions) => {
        for (const name in newOptions) {
            const value = newOptions[name];
            if (name.startsWith('search'))
                setSearchArg(old => old ? { ...old, opt: { ...old.opt, [name]: value } } : old)
        }
        setOptions((oldOptions: any) => ({ ...oldOptions, ...newOptions }))
        if (typeof (newOptions as any).sidePaneWidth === 'number') {
            setSidePaneWidth((newOptions as any).sidePaneWidth)
        }
    }), []);

    useEffect(() => transport.addListener<{ open: number }>('SearchOpenChange', ({ open }) => {
        setSearchOpen(open)
    }), []);

    useEffect(() => transport.addListener<{ oldPath: string; newPath: string }>('FileRenamed', ({ oldPath, newPath }) => {
        if (filePath !== oldPath) return
        setFilePath(newPath)
        const base = newPath.substring(0, newPath.lastIndexOf('/'))
        window.basePath = base
        const name = newPath.split('/').pop() || 'Typeleft'
        document.title = `${name} - Typeleft`
        getCurrentWebviewWindow().setTitle(`${name} - Typeleft`).catch(() => {})
    }), [filePath]);

    useEffect(() => transport.addListener<{ path: string }>('FileDeleted', ({ path }) => {
        if (filePath !== path) return
        setFilePath(undefined)
        document.title = 'Typeleft'
        getCurrentWebviewWindow().setTitle('Typeleft').catch(() => {})
    }), [filePath]);

    useEffect(() => transport.addListener('NewFile', () => {
        setFilePath(undefined)
        setCursor(undefined)
        setMarkdown('')
        markdownRef.current = ''
        adoptLoadedFile('')
        document.title = 'Typeleft'
        getCurrentWebviewWindow().setTitle('Typeleft').catch(() => {});
    }), []);

    const saveNow = useCallback(async (opts?: { skipIfUnchanged?: boolean; force?: boolean }) => {
        const content = markdownRef.current ?? ''
        if (!filePath) {
            remote.saveFileAs({ content })
            return false
        }
        if (opts?.skipIfUnchanged && content === lastSavedContentRef.current) {
            return true
        }
        setSaveStatus('saving')
        try {
            const mtime = await remoteCommon.saveFile({
                filePath,
                content,
                expectedMtime: opts?.force ? null : lastMtimeRef.current,
                force: opts?.force,
            })
            lastSavedContentRef.current = content
            lastMtimeRef.current = mtime
            setSaveStatus('saved')
            transport.postMessage('SaveState', { status: 'Saved' })
            return true
        } catch (e: any) {
            const msg = String(e ?? '')
            if (msg.includes('conflict')) {
                setConflict({ content })
            } else {
                setSaveStatus('error')
                transport.postMessage('SaveState', { status: 'Save failed' })
            }
            return false
        }
    }, [filePath])

    // Auto-save: only when content actually changed since the last successful write.
    useEffect(() => {
        if (!filePath) return
        const timer = setInterval(() => {
            if (optionsRef.current?.autoSave === false) return
            const content = markdownRef.current ?? ''
            if (!content || content === lastSavedContentRef.current) return
            saveNow({ skipIfUnchanged: true })
        }, 2000)
        return () => clearInterval(timer)
    }, [filePath, saveNow])

    // Rolling backups: at most one every 30s, only when the content changed.
    useEffect(() => {
        if (!filePath) return
        const timer = setInterval(() => {
            const content = markdownRef.current ?? ''
            if (!content || content === lastBackupRef.current) return
            remoteCommon.saveBackup({ path: filePath, content })
                .then(() => { lastBackupRef.current = content })
                .catch(() => {})
        }, 30000)
        return () => clearInterval(timer)
    }, [filePath])

    // Offer to restore a newer backup when a file is opened.
    useEffect(() => {
        if (!filePath) return
        let cancelled = false
        remoteCommon.latestBackup({ path: filePath }).then((meta) => {
            if (cancelled || !meta || !meta.isNewer) return
            remoteCommon.readBackup({ path: filePath, id: meta.id }).then((content) => {
                if (!cancelled) {
                    setBackupPrompt({ id: meta.id, created: meta.created, content })
                    transport.postMessage('SaveState', { status: 'Backup found' })
                }
            }).catch(() => {})
        }).catch(() => {})
        return () => { cancelled = true }
    }, [filePath])

    useEffect(() => transport.addListener('MenuSave', () => {
        saveNow()
    }), [saveNow]);

    useEffect(() => transport.addListener('MenuSaveAs', () => {
        const content = markdownRef.current ?? ''
        remote.saveFileAs({ content })
    }), []);

    useEffect(() => {
        const unsub = transport.addListener('SidebarToggle', () => {
            setSidebarOpen(prev => !prev);
        });
        return () => unsub();
    }, []);

    // Drag and drop file support
    useEffect(() => {
        const appWindow = getCurrentWebviewWindow();
        const unsub = appWindow.listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
            const path = event.payload.paths?.[0];
            if (!path) return;
            remote.readTextFile({ path }).then((text: string) => {
                const basePath = path.substring(0, path.lastIndexOf('/'));
                transport.postMessage('LoadFile', { text, basePath, filePath: path });
            }).catch(() => {
                // Try Tauri-based file read
                remote.openFileDialog();
            });
        });
        return () => { unsub.then(fn => fn()); };
    }, []);

    // Save window state on close request
    useEffect(() => {
        const appWindow = getCurrentWebviewWindow();
        const unsub = appWindow.listen<Record<string, unknown>>('SaveWindowState', (event) => {
            remoteCommon.saveWindowState(event.payload);
        });
        return () => { unsub.then(fn => fn()); };
    }, []);

    // Window menu handlers
    useEffect(() => transport.addListener('ToggleCompactMode', () => {
        const next = !document.body.classList.contains('compact-mode');
        document.body.classList.toggle('compact-mode', next);
        remoteCommon.setCompactMode({ compact: next });
    }), []);

    useEffect(() => transport.addListener('ToggleAlwaysOnTop', () => {
        const next = !document.body.classList.contains('always-on-top');
        document.body.classList.toggle('always-on-top', next);
        remoteCommon.setAlwaysOnTop({ onTop: next });
    }), []);

    const toggleSourceCode = useCallback(() => {
        setOptions((old: any) => {
            const next = { ...old, sourceCode: !old.sourceCode };
            remoteCommon.saveSettings(next).catch(() => {});
            return next;
        });
    }, []);

    useEffect(() => transport.addListener('ToggleSourceCode', () => {
        toggleSourceCode();
    }), [toggleSourceCode]);

    // Shift+F global shortcut → toggle source code
    useEffect(() => transport.addListener<{ id: string, state: string }>('GlobalShortcut', (payload) => {
        if (payload.id === "Shift+F" || payload.id === "shift+f") {
            toggleSourceCode();
        }
    }), [toggleSourceCode]);

    useEffect(() => transport.addListener('NewWindow', async () => {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const label = `main-${Date.now()}`;
        new WebviewWindow(label, {
            url: '/',
            title: 'Typeleft',
        });
    }), []);

    useEffect(() => transport.addListener('ImportHTMLDialog', async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const text = await file.text();
            transport.postMessage('ImportFile', { type: 'html', text });
        };
        input.click();
    }), []);

    useEffect(() => transport.addListener<{ section: 'filetree' | 'toc' }>('SidebarSection', ({ section }) => {
        setSidebarSection(section);
        setSidebarOpen(true);
    }), []);

    if (!options || markdown === undefined) {
        return <></>
    }

    return (
        <>
            <Sidebar open={sidebarOpen} section={sidebarSection} onClose={() => setSidebarOpen(false)} />

            {conflict && (
                <div style={modalOverlayStyle} onClick={() => setConflict(null)}>
                    <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
                        <div style={modalTitleStyle}>{t('File changed on disk')}</div>
                        <div style={modalTextStyle}>{t('The file has been modified by another program. Choose what to do.')}</div>
                        <div style={modalActionsStyle}>
                            <button style={dialogBtnStyle} onClick={() => {
                                const content = conflict.content;
                                setConflict(null);
                                remote.saveFileAs({ content });
                            }}>{t('Save As...')}</button>
                            <button style={dialogBtnStyle} onClick={async () => {
                                setConflict(null);
                                if (!filePath) return;
                                try {
                                    const text = await remoteCommon.readTextFile({ path: filePath });
                                    setMarkdown(text);
                                    markdownRef.current = text;
                                    adoptLoadedFile(text, filePath);
                                    setSaveStatus('idle');
                                } catch { /* ignore */ }
                            }}>{t('Reload')}</button>
                            <button style={dialogPrimaryBtnStyle} onClick={() => {
                                setConflict(null);
                                saveNow({ force: true });
                            }}>{t('Overwrite')}</button>
                        </div>
                    </div>
                </div>
            )}

            {backupPrompt && (
                <div style={modalOverlayStyle} onClick={() => setBackupPrompt(null)}>
                    <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
                        <div style={modalTitleStyle}>{t('Restore backup')}</div>
                        <div style={modalTextStyle}>
                            {t('A newer backup was found for this file. Do you want to restore it?')}
                            <br />
                            {new Date(backupPrompt.created).toLocaleString()}
                        </div>
                        <div style={modalActionsStyle}>
                            <button style={dialogBtnStyle} onClick={async () => {
                                if (filePath) {
                                    await remoteCommon.deleteBackup({ path: filePath, id: backupPrompt.id }).catch(() => {});
                                }
                                setBackupPrompt(null);
                            }}>{t('Discard')}</button>
                            <button style={dialogPrimaryBtnStyle} onClick={async () => {
                                const content = backupPrompt.content;
                                setBackupPrompt(null);
                                setMarkdown(content);
                                markdownRef.current = content;
                                if (filePath) {
                                    await remoteCommon.deleteBackup({ path: filePath, id: backupPrompt.id }).catch(() => {});
                                }
                                saveNow({ force: true });
                            }}>{t('Restore')}</button>
                        </div>
                    </div>
                </div>
            )}
            <div style={{ marginLeft: sidebarOpen ? sidePaneWidth : 0, transition: 'margin-left .2s' }}>
                {options.sourceCode ? (
                    <CodeMirror
                        options={options}
                        cursor={cursor}
                        markdown={markdown ?? ''}
                        searchOpen={searchOpen}
                        searchArg={searchArg}
                        scrollTopRef={codeMirrorScrollRef}
                        onMarkdownChange={setMarkdown}
                        onCursorChange={setCursor}
                        onSearchArgChange={setSearchArg}
                        onSearchOpenChange={setSearchOpen}
                    />
                ) : options.editorEngine === 'milkdown' ? (
                    <MilkdownEditor
                        key={filePath ?? 'new'}
                        markdown={markdown ?? ''}
                        options={options}
                        onMarkdownChange={setMarkdown}
                    />
                ) : (
                    <MuyaEditor
                        options={options}
                        cursor={cursor}
                        markdown={markdown ?? ''}
                        searchOpen={searchOpen}
                        searchArg={searchArg}
                        scrollTopRef={muyaScrollTopRef}
                        onMarkdownChange={setMarkdown}
                        onCursorChange={setCursor}
                        onSearchArgChange={setSearchArg}
                        onSearchOpenChange={setSearchOpen}
                    />
                )}
            </div>
        </>
    )
}

export default Editor;