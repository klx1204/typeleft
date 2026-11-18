import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import transport from "services/transport";
import remote from "services/remote/common";
import Muya from 'components/Muya/lib'
import TablePicker from 'components/Muya/lib/ui/tablePicker'
import CodePicker from 'components/Muya/lib/ui/codePicker'
import EmojiPicker from 'components/Muya/lib/ui/emojiPicker'
import ImageSelector from 'components/Muya/lib/ui/imageSelector'
import ImageToolbar from 'components/Muya/lib/ui/imageToolbar'
import LinkTools from 'components/Muya/lib/ui/linkTools'
import TableBarTools from 'components/Muya/lib/ui/tableTools'
import FootnoteTool from 'components/Muya/lib/ui/footnoteTool'
import FrontMenu from 'components/Muya/lib/ui/frontMenu'
import { createApplicationMenuState } from "services/menuState";
import { useI18n } from "services/i18n";
import 'components/Muya/themes/default.css'

interface IMuyaEditor {
    markdown: string
    cursor: any
    options: any
    searchOpen: number
    searchArg: { value: string, opt: any } | undefined
    scrollTopRef: React.MutableRefObject<number>
    onMarkdownChange: (markdown: string) => void
    onCursorChange: (cursor: any) => void
    onSearchArgChange: (arg: { value: string, opt: any } | undefined) => void
    onSearchOpenChange?: (open: number) => void
}

Muya.use(TablePicker)
Muya.use(CodePicker)
Muya.use(EmojiPicker)
Muya.use(ImageSelector)
Muya.use(ImageToolbar)
Muya.use(FrontMenu)
Muya.use(LinkTools, { jumpClick: (linkInfo: { href: string }) => { transport.postMessage('OpenURI', { uri: linkInfo.href }) } })
Muya.use(TableBarTools)
Muya.use(FootnoteTool)

const STANDAR_Y = 320

const MuyaEditor: React.FC<IMuyaEditor> = (props) => {
    const { t } = useI18n();
    const [editor, setEditor] = useState<Muya>();
    const [marginTop, setMarginTop] = useState(0);
    const markdownRef = useRef('');
    const searchArgRef = useRef<any>();
    const cursorRef = useRef<any>();
    const optionsRef = useRef<any>(props.options);

    const relativeScroll = useCallback((delta: number) => {
        window.scrollBy(0, delta)
    }, [])

    const scrollToElement = useCallback((selector) => {
        if (editor == null) {
            return;
        }
        const anchor = document.querySelector(selector)
        if (anchor) {
            const { y } = anchor.getBoundingClientRect()
            relativeScroll(y - STANDAR_Y)
        }
    }, [editor, relativeScroll])

    const scrollToElementIfInvisible = useCallback((selector) => {
        const anchor = document.querySelector(selector)
        if (anchor) {
            const { y } = anchor.getBoundingClientRect()
            if (y < 0 || y > window.innerHeight) {
                scrollToElement(selector)
            }
        }
    }, [scrollToElement])

    const scrollToCursor = useCallback(() => {
        relativeScroll(editor?.getSelection().cursorCoords.y - STANDAR_Y)
    }, [editor, relativeScroll])

    const scrollToCursorIfInvisible = useCallback(() => {
        try {
            const y = editor?.getSelection().cursorCoords.y;
            if (y < 0 || y > window.innerHeight) {
                relativeScroll(y - STANDAR_Y)
            }
        } catch (err) {
            console.log(err)
        }
    }, [editor, relativeScroll])

    const search = useCallback(arg => {
        if (arg?.value && editor) {
            const { value, opt = {} } = arg
            const selection = opt.selection?.start ? opt.selection : undefined
            editor.search(value, { ...opt, selection })
        }
    }, [editor])

    useEffect(() => {
        searchArgRef.current = props.searchArg
    }, [props.searchArg])

    useEffect(() => {
        markdownRef.current = ''
    }, [editor])

    useEffect(() => {
        cursorRef.current = props.cursor
    }, [props.cursor])

    useEffect(() => {
        if (markdownRef.current != props.markdown && editor) {
            markdownRef.current = props.markdown
            editor.setMarkdown(props.markdown, cursorRef.current)
            editor.resetHistory()
            const scrollTop = props.scrollTopRef.current;
            window.scrollTo(window.scrollX, scrollTop)
            scrollToCursorIfInvisible()
            setTimeout(() => {
                window.scrollTo(window.scrollX, scrollTop)
                scrollToCursorIfInvisible()
                search(searchArgRef.current)
            }, 100);
        }
    }, [editor, props.markdown, props.scrollTopRef, scrollToCursorIfInvisible, scrollToElementIfInvisible, search])

    useEffect(() => {
        search(props.searchArg)
    }, [editor, props.searchArg, search])

    useEffect(() => {
        const ele = document.getElementById('editor');
        const muya = new Muya(ele, optionsRef.current);

        // Wire up image processing pipeline
        muya.options.imageAction = async (image: any, id: string, name?: string) => {
            const opts: any = muya.options;
            const basePath = window.basePath || '';
            const finalize = (path: string) => {
                let result = path;
                if (opts.preferRelativeImagePaths && basePath && result.startsWith(basePath)) {
                    result = '.' + result.slice(basePath.length);
                }
                if (opts.autoEncodeImageURL && /^https?:\/\//.test(result)) {
                    try { result = encodeURI(result); } catch { /* ignore */ }
                }
                return result;
            };
            const saveBase64 = async (base64Data: string, fileName: string) => finalize(await remote.saveImage({
                fileName,
                base64Data,
                subDir: 'images',
                basePath: basePath || undefined,
            }));
            const downloadToPath = async (url: string, fileName: string) => {
                const resp = await fetch(url);
                const blob = await resp.blob();
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const text = String(reader.result || '');
                        const match = text.match(/^data:image\/\w+;base64,(.+)$/);
                        if (match) resolve(match[1]);
                        else reject(new Error('Failed to read image as base64'));
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                return saveBase64(base64, fileName);
            };
            try {
                if (!image) return '';
                if (typeof image === 'string') {
                    if (image.startsWith('data:')) {
                        const action = opts.insertClipboardImageAction;
                        if (action === 'none') return image;
                        const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/);
                        if (!base64Match) return image;
                        if (action === 'upload') {
                            return await remote.uploadImage({ base64Data: base64Match[1], fileName: name || `image-${Date.now()}.png` });
                        }
                        return await saveBase64(base64Match[1], name || `image-${Date.now()}`);
                    }
                    if (/^https?:\/\//.test(image)) {
                        if (opts.insertWebImageAction === 'copyToPath' && basePath) {
                            try {
                                return await downloadToPath(image, name || `image-${Date.now()}`);
                            } catch {
                                return finalize(image);
                            }
                        }
                        return finalize(image);
                    }
                    if (opts.insertLocalImageAction === 'upload') {
                        const loaded = await remote.loadImage({ path: image });
                        const b64 = loaded.url.split(',')[1] || '';
                        return await remote.uploadImage({ base64Data: b64, fileName: image.split('/').pop() || name || 'image.png' });
                    }
                    if (opts.insertLocalImageAction === 'copyToPath' && basePath) {
                        return finalize(await remote.copyImage({
                            sourcePath: image,
                            destDir: `${basePath}/images`
                        }));
                    }
                    return finalize(image);
                }
                if (image instanceof File) {
                    const base64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const result = reader.result as string;
                            const match = result.match(/^data:image\/\w+;base64,(.+)$/);
                            if (match) resolve(match[1]);
                            else reject(new Error('Failed to read image as base64'));
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(image);
                    });
                    if (opts.insertClipboardImageAction === 'none') {
                        return `data:image/png;base64,${base64}`;
                    }
                    if (opts.insertClipboardImageAction === 'upload') {
                        return await remote.uploadImage({ base64Data: base64, fileName: image.name || `image-${Date.now()}.png` });
                    }
                    return await saveBase64(base64, image.name || `image-${Date.now()}`);
                }
            } catch (e) {
                console.error('[Typeleft] imageAction error:', e);
            }
            return typeof image === 'string' ? image : '';
        };

        muya.options.clipboardFilePath = () => {
            return undefined;
        };

        setEditor(muya);
        return () => muya.destroy()
    }, []);

    useEffect(() => {
        if (!editor) return;
        Object.assign(editor.options, props.options);
        try {
            (editor as any).setOptions({ tabSize: props.options?.tabSize });
            const hide = !!props.options?.hideQuickInsertHint;
            (editor as any).container?.classList.toggle('ag-show-quick-insert-hint', !hide);
        } catch (err) {
            console.log(err);
        }
    }, [editor, props.options])

    useEffect(() => {
        if (!editor) return;
        const container = (editor as any).container as HTMLElement | undefined;
        if (!container) return;
        container.setAttribute('spellcheck', String(!!props.options?.spellcheckEnabled));
        container.setAttribute('lang', props.options?.spellcheckLang || '');
    }, [editor, props.options?.spellcheckEnabled, props.options?.spellcheckLang])

    useEffect(() => {
        editor?.setFocusMode(props.options.focusMode)
    }, [editor, props.options.focusMode])

    useEffect(() => {
        editor?.setFont({ fontSize: props.options?.fontSize, lineHeight: props.options?.lineHeight })
    }, [editor, props.options?.fontSize, props.options?.lineHeight])

    useEffect(() => transport.addListener<{ slug: string }>('ScrollTo', ({ slug }) => {
        scrollToElement(`#${slug}`)
    }), [editor, scrollToElement]);

    useEffect(() => transport.addListener('UpdateParagraph', type => {
        editor?.updateParagraph(type)
    }), [editor]);

    useEffect(() => transport.addListener('InsertParagraph', pos => {
        if (pos === 'hr') {
            editor?.insertParagraph('after', '---\n', true)
        } else {
            editor?.insertParagraph(pos, '', true)
        }
    }), [editor]);

    useEffect(() => transport.addListener('DeleteParagraph', () => {
        editor?.deleteParagraph()
    }), [editor]);

    useEffect(() => transport.addListener('Undo', () => {
        editor?.undo()
    }), [editor]);

    useEffect(() => transport.addListener('Redo', () => {
        editor?.redo()
    }), [editor]);

    // Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z (or Ctrl+Y) fallback when native undo is unavailable
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                editor?.undo();
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                editor?.redo();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editor]);

    useEffect(() => transport.addListener('Duplicate', () => {
        editor?.duplicate()
    }), [editor]);

    const FORMAT_ALIAS: Record<string, string> = {
        bold: 'strong',
        italic: 'em',
        strike: 'del',
    };
    useEffect(() => transport.addListener<string>('Format', type => {
        editor?.format(FORMAT_ALIAS[type] ?? type)
    }), [editor]);

    useEffect(() => transport.addListener('DeleteSelection', () => {
        editor?.delete()
    }), [editor]);

    useEffect(() => transport.addListener('SelectAll', () => {
        editor?.selectAll()
    }), [editor]);

    useEffect(() => transport.addListener<any>('Copy', () => {
        editor?.clipboard.copy({ type: 'normal', copyInfo: null })
    }), [editor]);

    useEffect(() => transport.addListener<any>('Cut', () => {
        editor?.clipboard.cut({ type: 'normal', copyInfo: null })
    }), [editor]);

    useEffect(() => transport.addListener<any>('Paste', async () => {
        const text = await remote.getClipboardText()
        if (text) {
            editor?.clipboard.paste({ type: 'normal', text, html: '' })
            return
        }
        // No text on the clipboard: try an image (screenshot etc.)
        try {
            const base64 = await remote.getClipboardImage()
            if (!base64 || !editor) return
            const dataUrl = `data:image/png;base64,${base64}`
            const action = (editor.options as any)?.imageAction
            const src = action ? await action(dataUrl, '', `image-${Date.now()}.png`) : dataUrl
            if (src) editor.insertImage({ src })
        } catch (e) {
            console.error('[Typeleft] clipboard image paste failed:', e)
        }
    }), [editor]);

    useEffect(() => transport.addListener<string>('InsertTable', arg => {
        editor?.createTable(arg)
    }), [editor]);

    useEffect(() => transport.addListener<string>('InsertImage', arg => {
        if (arg && typeof arg === 'string') {
            editor?.insertImage({ src: arg })
        } else {
            editor?.format('image')
        }
    }), [editor]);

    useEffect(() => transport.addListener<{ value: string, opt: unknown }>('Search', (arg) => {
        props.onSearchArgChange(arg)
        setTimeout(() => scrollToElementIfInvisible('.ag-highlight'), 0)
    }), [editor, props, scrollToElementIfInvisible]);

    useEffect(() => transport.addListener<{ action: string }>('Find', ({ action }) => {
        editor?.find(action)
        setTimeout(() => scrollToElementIfInvisible('.ag-highlight'), 0)
    }), [editor, scrollToElementIfInvisible]);

    useEffect(() => transport.addListener<{ value: string, opt: unknown }>('Replace', ({ value, opt }) => {
        editor?.replace(value, opt)
    }), [editor, scrollToElement]);

    useEffect(() => {
        setMarginTop(currentMarginTop => {
            const newMarginTop = { 0: 0, 1: 50, 2: 90 }[props.searchOpen] ?? 0;
            relativeScroll(newMarginTop - currentMarginTop)
            return newMarginTop;
        })
    }, [props.searchOpen, relativeScroll])

    useEffect(() => transport.addListener<{ open: number }>('SearchOpenChange', ({ open }) => {
        if (open == 0 && editor) {
            const { contentState } = editor as any;
            contentState.setCursorToHighlight();
            contentState.searchMatches.matches = [];
            contentState.render(true);
            props.onSearchArgChange(undefined)
        }
    }), [editor, props, relativeScroll]);

    useEffect(() => transport.addListener<Record<string, unknown>>('SettingsChanged', (newOptions) => {
        for (const name in newOptions) {
            const value = newOptions[name];
            if (name == 'focusMode') {
                editor?.setFocusMode(value)
            } else if (name == 'typewriter') {
                value && scrollToCursor()
            }
        }
        const rerenderKeys = [
            'mermaidTheme', 'sequenceTheme', 'vegaTheme', 'preferLooseListItem',
            'trimUnnecessaryCodeBlockEmptyLines', 'disableHtml', 'frontmatterType',
            'isGitlabCompatibilityEnabled', 'superSubScript', 'footnote', 'bulletListMarker',
            'orderListDelimiter', 'listIndentation'
        ];
        if (rerenderKeys.some(k => k in newOptions)) {
            setTimeout(() => { (editor as any)?.contentState.render(false, true) }, 0)
        }
    }), [editor, scrollToCursor]);

    useEffect(() => editor?.on('selectionChange', (selection: any) => {
        const menuState = createApplicationMenuState(selection)
        const selectionText = window.getSelection()?.toString();
        transport.postMessage('SelectionChange', { selection, menuState, selectionText });
        const { y } = selection.cursorCoords
        props.options?.typewriter && relativeScroll(y - window.innerHeight / 2 + 136);
        window.innerHeight - y < 100 && relativeScroll(y - window.innerHeight + 100);
    }), [editor, props.options?.typewriter, relativeScroll])

    useEffect(() => editor?.on('selectionFormats', (formats: any) => {
        const fotmats_simple = formats.map((e: any) => ({ type: e.type, tag: e.tag }));
        transport.postMessage('SelectionFormats', { formats: fotmats_simple });
    }), [editor])

    useEffect(() => editor?.on('contentChange', ({ markdown, wordCount, cursor, toc: { toc, cur } }: any) => {
        markdownRef.current = markdown;

        // 同步内容与光标
        props.onMarkdownChange(markdown)
        props.onCursorChange(cursor)

        // StateChange 必须在 onMarkdownChange、onCursorChange 之后发送，否则会导致编辑器内容/光标不同步
        transport.postMessage('StateChange', { state: { wordCount, toc, cur }, muya: true });
    }), [editor, props])

    useEffect(() => {
        const ele = document.getElementById('editor');
        if (ele) {
            ele.style.boxSizing = `border-box`
            ele.style.minHeight = `100vh`
            if (props.options?.typewriter) {
                ele.style.paddingTop = `calc(50vh - ${136 - marginTop}px)`
                ele.style.paddingBottom = 'calc(50vh - 54px)'
            } else {
                ele.style.paddingTop = `${marginTop}px`
                ele.style.paddingBottom = '0'
            }
        }
    }, [marginTop, props.options?.typewriter])

    useEffect(() => {
        document.body.style.setProperty('--editorAreaWidth', props.options?.editorAreaWidth)
    }, [props.options?.editorAreaWidth])

    useEffect(() => {
        try {
            editor?.focus()
        } catch (err) {
            console.log(err)
        }
    }, [editor])

    useEffect(() => {
        const onscroll = () => {
            props.scrollTopRef.current = window.scrollY
        }
        addEventListener('scroll', onscroll);
        return () => removeEventListener('scroll', onscroll)
    }, [props.scrollTopRef])

    const [searchValue, setSearchValue] = useState('');
    const [replaceValue, setReplaceValue] = useState('');

    const closeSearch = useCallback(() => {
        props.onSearchOpenChange?.(0);
        props.onSearchArgChange(undefined);
        setSearchValue('');
        setReplaceValue('');
        if (editor) {
            const { contentState } = editor as any;
            contentState.setCursorToHighlight();
            contentState.searchMatches.matches = [];
            contentState.render(true);
        }
    }, [editor, props]);

    const doSearch = useCallback((value: string) => {
        setSearchValue(value);
        if (value && editor) {
            editor.search(value, {
                searchIsCaseSensitive: !!props.options?.searchIsCaseSensitive,
                searchIsRegexp: !!props.options?.searchIsRegexp,
                searchIsWholeWord: !!props.options?.searchIsWholeWord,
                selectHighlight: true,
            });
            props.onSearchArgChange({ value, opt: {} });
            setTimeout(() => scrollToElementIfInvisible('.ag-highlight'), 0);
        }
    }, [editor, props, scrollToElementIfInvisible]);

    const searchOpts = useMemo(() => ({
        searchIsCaseSensitive: !!props.options?.searchIsCaseSensitive,
        searchIsRegexp: !!props.options?.searchIsRegexp,
        searchIsWholeWord: !!props.options?.searchIsWholeWord,
    }), [props.options?.searchIsCaseSensitive, props.options?.searchIsRegexp, props.options?.searchIsWholeWord]);

    const findNext = useCallback(() => {
        if (searchValue) {
            editor?.find('next');
            setTimeout(() => scrollToElementIfInvisible('.ag-highlight'), 0);
        }
    }, [editor, searchValue, scrollToElementIfInvisible]);

    const findPrev = useCallback(() => {
        if (searchValue) {
            editor?.find('pre');
            setTimeout(() => scrollToElementIfInvisible('.ag-highlight'), 0);
        }
    }, [editor, searchValue, scrollToElementIfInvisible]);

    const doReplace = useCallback(() => {
        if (searchValue) {
            editor?.replace(replaceValue, { ...searchOpts, isSingle: true });
        }
    }, [editor, searchValue, replaceValue, searchOpts]);

    const doReplaceAll = useCallback(() => {
        if (searchValue) {
            editor?.replace(replaceValue, { ...searchOpts, isSingle: false });
        }
    }, [editor, searchValue, replaceValue, searchOpts]);

    const searchBarStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px',
        backgroundColor: 'var(--editorColor02)',
        borderBottom: '1px solid var(--editorColor10)',
        fontSize: 13,
        position: 'sticky', top: 0, zIndex: 100,
    };

    return (
        <div style={{
            fontSize: props.options?.fontSize,
            lineHeight: props.options?.lineHeight
        }}>
            {props.searchOpen > 0 && (
                <div id="md-searchpanel" style={searchBarStyle}>
                    <input
                        autoFocus
                        type="text"
                        placeholder={t('Search...')}
                        value={searchValue}
                        onChange={e => doSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') findNext(); if (e.key === 'Escape') closeSearch(); }}
                        style={{
                            flex: 1, padding: '3px 6px', fontSize: 13,
                            border: '1px solid var(--editorColor10)', borderRadius: 3,
                            backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                            outline: 'none',
                        }}
                    />
                    <button onClick={findPrev} style={btnStyle} title={t('Previous')}>&larr;</button>
                    <button onClick={findNext} style={btnStyle} title={t('Next')}>&rarr;</button>
                    {props.searchOpen === 2 && (
                        <>
                            <input
                                type="text"
                                placeholder={t('Replace...')}
                                value={replaceValue}
                                onChange={e => setReplaceValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') doReplace(); }}
                                style={{
                                    width: 120, padding: '3px 6px', fontSize: 13, marginLeft: 8,
                                    border: '1px solid var(--editorColor10)', borderRadius: 3,
                                    backgroundColor: 'var(--editorColor00)', color: 'var(--editorColor50)',
                                    outline: 'none',
                                }}
                            />
                            <button onClick={doReplace} style={btnStyle} title={t('Replace')}>Rpl</button>
                            <button onClick={doReplaceAll} style={btnStyle} title={t('Replace All')}>All</button>
                        </>
                    )}
                    <button onClick={closeSearch} style={{ ...btnStyle, fontSize: 16 }} title={t('Close')}>&times;</button>
                </div>
            )}
            <div id="write">
                <div id="editor" />
            </div>
        </div>
    )

}

const btnStyle: React.CSSProperties = {
    padding: '3px 8px', fontSize: 13, cursor: 'pointer',
    border: '1px solid var(--editorColor10)', borderRadius: 3,
    backgroundColor: 'var(--editorColor04)', color: 'var(--editorColor50)',
}

export default MuyaEditor