import { convertFileSrc } from '@tauri-apps/api/core'
import { remote } from 'services/remote'

const STYLE_ID = 'typeleft-user-theme'

const getStyleEl = (): HTMLStyleElement => {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!el) {
        el = document.createElement('style')
        el.id = STYLE_ID
        document.head.appendChild(el)
    }
    return el
}

const pickVar = (css: string, name: string): string | null => {
    const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`)
    const match = css.match(re)
    return match ? match[1].trim() : null
}

const normalizePath = (path: string): string => {
    const unified = path.replace(/\\/g, '/')
    const parts = unified.split('/')
    const out: string[] = []
    for (const part of parts) {
        if (!part || part === '.') continue
        if (part === '..') {
            out.pop()
            continue
        }
        out.push(part)
    }
    const prefix = unified.startsWith('/') ? '/' : ''
    return prefix + out.join('/')
}

const isExternal = (url: string) => /^(https?:|wss?:|ftp:|blob:|data:|asset:|file:|#)/i.test(url)

/**
 * Rewrite relative url()/@import references to absolute asset:// URLs rooted in
 * the theme directory. External and out-of-directory references are dropped.
 */
const replaceAsync = async (
    input: string,
    re: RegExp,
    replacer: (match: string, ...args: any[]) => Promise<string>
): Promise<string> => {
    const jobs: Promise<string>[] = []
    input.replace(re, (match, ...args) => {
        jobs.push(replacer(match, ...args))
        return match
    })
    const results = await Promise.all(jobs)
    let i = 0
    return input.replace(re, () => results[i++])
}

const mimeFor = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase() ?? ''
    switch (ext) {
        case 'woff2': return 'font/woff2'
        case 'woff': return 'font/woff'
        case 'otf': return 'font/otf'
        case 'ttf': return 'font/ttf'
        case 'png': return 'image/png'
        case 'jpg':
        case 'jpeg': return 'image/jpeg'
        case 'gif': return 'image/gif'
        case 'webp': return 'image/webp'
        case 'svg': return 'image/svg+xml'
        case 'bmp': return 'image/bmp'
        default: return 'application/octet-stream'
    }
}

// Inline every relative url() (fonts, background images) as a data: URL.
// WebKit is unreliable with custom-scheme subresources inside CSS, and this
// also guarantees the theme is fully self-contained (no external requests).
const inlineThemeAssets = async (css: string, themeDir: string): Promise<{ css: string, blocked: number }> => {
    const base = normalizePath(themeDir)
    let blocked = 0

    const out = await replaceAsync(css, /url\(\s*([^)]*?)\s*\)/gi, async (match, inner) => {
        const url = String(inner).trim().replace(/^['"]|['"]$/g, '')
        if (!url) return match
        if (/^(https?:|wss?:|ftp:|\/\/)/i.test(url)) {
            blocked += 1
            return 'url("")'
        }
        if (/^(data:|blob:|asset:)/i.test(url)) return match
        if (url.startsWith('#')) return match

        const abs = normalizePath(`${base}/${url}`)
        if (!(abs === base || abs.startsWith(base + '/'))) {
            blocked += 1
            return 'url("")'
        }
        try {
            const b64 = await remote.readThemeBinary({ name: abs.slice(base.length + 1) })
            return `url("data:${mimeFor(url)};base64,${b64}")`
        } catch {
            return match
        }
    })

    return { css: out, blocked }
}

// Only bridge colours, so the React UI follows the theme without overriding
// typography that the theme CSS already controls.
const buildBridge = (css: string): string => {
    const text = pickVar(css, 'text-color')
    const bg = pickVar(css, 'bg-color')
    const primary = pickVar(css, 'primary-color')
    const sidebar = pickVar(css, 'side-bar-bg-color')
    const border = pickVar(css, 'window-border-color')
    const rules: string[] = []

    if (text) {
        rules.push(`--editorColor: ${text};`)
        rules.push(`--editorColor80: color-mix(in srgb, ${text} 80%, transparent);`)
        rules.push(`--editorColor60: color-mix(in srgb, ${text} 60%, transparent);`)
        rules.push(`--editorColor50: color-mix(in srgb, ${text} 50%, transparent);`)
        rules.push(`--editorColor40: color-mix(in srgb, ${text} 40%, transparent);`)
        rules.push(`--editorColor30: color-mix(in srgb, ${text} 30%, transparent);`)
        rules.push(`--editorColor10: color-mix(in srgb, ${text} 10%, transparent);`)
        rules.push(`--editorColor06: color-mix(in srgb, ${text} 6%, transparent);`)
        rules.push(`--editorColor04: color-mix(in srgb, ${text} 4%, transparent);`)
        rules.push(`--editorColor02: color-mix(in srgb, ${text} 2%, transparent);`)
    }
    if (bg) {
        rules.push(`--app-bg-color: ${bg};`)
        rules.push(`--editorColor00: ${bg};`)
        rules.push(`--editorBgColor: ${bg};`)
        rules.push(`--floatBgColor: ${bg};`)
    }
    if (primary) {
        rules.push(`--themeColor: ${primary};`)
    }
    if (sidebar) {
        rules.push(`--sideBarBgColor: ${sidebar};`)
    }
    if (border) {
        rules.push(`--floatBorderColor: ${border};`)
    }

    return rules.length ? `:root { ${rules.join(' ')} }` : ''
}

export const clearCustomTheme = () => {
    document.getElementById(STYLE_ID)?.remove()
}

export const applyCustomTheme = async (name: string): Promise<string | null> => {
    if (!name) {
        clearCustomTheme()
        return null
    }
    try {
        const themeDir = await remote.getThemeDir()
        const themeCss = await remote.readThemeFile({ name })
        const themeBase = name.replace(/\.css$/i, '')

        let baseUser = ''
        if (await remote.themeFileExists({ name: 'base.user.css' })) {
            baseUser = await remote.readThemeFile({ name: 'base.user.css' })
        }
        let themeUser = ''
        if (await remote.themeFileExists({ name: `${themeBase}.user.css` })) {
            themeUser = await remote.readThemeFile({ name: `${themeBase}.user.css` })
        }

        const combined = `${themeCss}\n${baseUser}\n${themeUser}`
        const { css, blocked } = await inlineThemeAssets(combined, themeDir)
        const bridge = buildBridge(combined)

        const el = getStyleEl()
        el.textContent = `${css}\n${bridge}`
        if (blocked > 0) {
            console.warn(`[Typeleft] theme "${name}": ${blocked} external resource reference(s) blocked`)
        }
        return null
    } catch (e) {
        clearCustomTheme()
        return String(e)
    }
}

export const getCustomTheme = async (): Promise<string> => {
    try {
        const settings: any = await remote.getSettings()
        return settings?.customTheme ?? ''
    } catch {
        return ''
    }
}
