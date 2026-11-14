import { useEffect, useState } from 'react'
import { remote } from 'services/remote'
import transport from 'services/transport'

const KEYS = [
    'InputFootnoteDefine', 'InputYAMLFrontMatter', 'InputMathFormula', 'InputLanguageIdentifier',
    'ClickToAddAnImage', 'LoadImageFail', 'Footnote', 'FootnoteNotFound', 'Create', 'GoTo',

    'File', 'Edit', 'Format', 'Paragraph', 'View', 'Window',

    'New', 'New File', 'Open...', 'Open File...', 'Open Folder...', 'Save', 'Saved', 'Backup found',
    'Save As...', 'Import HTML...', 'Export HTML...', 'Print...', 'Close Window', 'New Window', 'Settings...',

    'Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Select All', 'Find...', 'Replace...',

    'Bold', 'Italic', 'Code', 'Inline Code', 'Strikethrough', 'Link', 'Insert Link', 'Image',
    'Insert Image', 'Clear Format',

    'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Heading 5', 'Heading 6',
    'Quote Block', 'Code Block', 'Ordered List', 'Bullet List', 'Task List', 'Table', 'Insert Table',
    'Math Block', 'Horizontal Rule', 'Horizontal Line',

    'Source Code', 'Toggle Source Code', 'Toggle Sidebar', 'Show Outline',
    'Compact Mode', 'Toggle Compact Mode', 'Always on Top', 'Toggle Always on Top',

    'words', 'chars', 'Files', 'Outline', 'Open Folder', 'No headings',
    'Type a command...', 'No commands found', 'Search...', 'Replace...', 'Previous', 'Next',
    'Replace', 'Replace All', 'Close', 'Search',

    'Front Matter', 'Header 1', 'Header 2', 'Header 3', 'Header 4', 'Header 5', 'Header 6',
    'Table Block', 'Display Math', 'HTML Block', 'Order List', 'To-do List', 'Vega Chart',
    'Flow Chart', 'Sequence Diagram', 'PlantUML Diagram', 'Mermaid', 'No result',

    'Rename', 'Delete', 'Copy', 'Move', 'Refresh', 'New File', 'New Folder', 'Cancel', 'Confirm',
    'File Name', 'Destination', 'Delete File', 'Delete Folder', 'Are you sure you want to delete',
    'Invalid file name', 'Target already exists', 'Operation failed', 'Copy of',
    'Rename failed', 'Delete failed', 'Move failed', 'Copy failed', 'Create failed',
    'Invalid Mermaid Codes', 'Invalid Codes', 'Editor Error', 'Component Stack',
    'Image Hosting', 'Upload URL', 'Token', 'Public Base URL', 'Test Upload', 'Upload URL is empty',
    'No upload configuration', 'Test succeeded', 'Upload configuration',
    'Export', 'Export Configurations', 'Name', 'Output Directory', 'Include CSS', 'Include Frontmatter',
    'Export Now', 'Delete Configuration', 'Select output directory', 'Browse', 'Exported to',
    'Export failed', 'New Configuration', 'Configurations'
]

let lang = 'en'
let dict: Record<string, string> = {}
const listeners = new Set<() => void>()

export const getLang = () => lang

export const t = (key: string): string => {
    if (lang !== 'zh') return key
    return dict[key] ?? key
}

export const subscribeLang = (fn: () => void) => {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
}

const notify = () => listeners.forEach(fn => fn())

const loadDict = async () => {
    try {
        dict = await remote.getStringResources({ names: KEYS })
    } catch {
        dict = {}
    }
}

export const initI18n = async () => {
    try {
        const settings: any = await remote.getSettings()
        lang = settings?.lang ?? 'en'
    } catch {
        lang = 'en'
    }
    await loadDict()
    notify()
}

transport.addListener('SettingsChanged', async (payload: any) => {
    if (payload && 'lang' in payload) {
        lang = payload.lang === 'zh' ? 'zh' : 'en'
        await loadDict()
        notify()
    }
})

export const useI18n = () => {
    const [, force] = useState(0)
    useEffect(() => subscribeLang(() => force(v => v + 1)), [])
    return { t, lang }
}

export default t
