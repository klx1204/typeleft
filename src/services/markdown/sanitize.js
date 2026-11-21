import runSanitize from './dompurify'

const HTML_TAG_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHTML = str =>
  str.replace(/[&<>'"]/g, tag => HTML_TAG_REPLACEMENTS[tag])

export const escapeHtmlTags = html =>
  html.replace(/[&<>"']/g, x => HTML_TAG_REPLACEMENTS[x])

export const escapeInBlockHtml = html =>
  html.replace(/(<(style|script|title)[^<>]*>)([\s\S]*?)(<\/\2>)/g, (m, p1, p2, p3, p4) =>
    `${escapeHTML(p1)}${p3}${escapeHTML(p4)}`)

export const unescapeHTML = str =>
  str.replace(/(?:&amp;|&lt;|&gt;|&quot;|&#39;)/g, tag => ({
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#39;': "'",
    '&quot;': '"',
  }[tag] || tag))

export const sanitize = (html, purifyOptions, disableHtml) =>
  runSanitize(disableHtml ? escapeHtmlTags(html) : escapeInBlockHtml(html), purifyOptions)
