import CodeMirror from "components/CodeMirror";
import MuyaEditor from "components/Muya";
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

const Editor: React.FC = () => {
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

    const OnFileLoaded = useCallback(() => setTimeout(() => transport.postMessage('FileLoaded', { text: markdownRef.current }), 100), [])

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
    }), []);

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
        document.title = 'Typeleft'
        getCurrentWebviewWindow().setTitle('Typeleft').catch(() => {});
    }), []);

    const saveContent = useCallback((content: string) => {
        if (filePath) {
            remote.saveFile({ filePath, content })
            transport.postMessage('SaveState', { status: 'Saved' })
        } else {
            remote.saveFileAs({ content })
        }
    }, [filePath])

    // Auto-save every 5s (if enabled) + backup every 30s
    useEffect(() => {
        let saveCount = 0;
        const interval = setInterval(() => {
            const content = markdownRef.current ?? ''
            if (content && filePath) {
                const autoSave = optionsRef.current?.autoSave !== false;
                if (autoSave) {
                    remote.saveFile({ filePath, content })
                }
                saveCount++;
                if (saveCount % 6 === 0) {
                    remoteCommon.saveBackup({ path: filePath, content })
                }
            }
        }, 5000)
        return () => clearInterval(interval)
    }, [filePath])

    // Check for backup on load
    useEffect(() => {
        if (filePath) {
            remoteCommon.checkBackup({ path: filePath }).then((backup: string | null) => {
                if (backup) {
                    transport.postMessage('SaveState', { status: 'Backup found' })
                }
            }).catch(() => {})
        }
    }, [filePath])

    useEffect(() => transport.addListener('MenuSave', () => {
        saveContent(markdownRef.current ?? '')
    }), [saveContent]);

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

    if (!options) {
        return <></>
    }

    return (
        <>
            <Sidebar open={sidebarOpen} section={sidebarSection} onClose={() => setSidebarOpen(false)} />
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