export const LINE_BREAK = '\n'

export const DEFAULT_TURNDOWN_CONFIG = Object.freeze({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
  blankReplacement(content, node) {
    if (node && node.classList.contains('ag-soft-line-break')) {
      return LINE_BREAK
    } else if (node && node.classList.contains('ag-hard-line-break')) {
      return '  ' + LINE_BREAK
    } else if (node && node.classList.contains('ag-hard-line-break-sapce')) {
      return ''
    }
    return node.isBlock ? '\n\n' : ''
  },
})

export const EXPORT_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: ['contenteditable'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: [
    'data-align', 'controls', 'autoplay', 'loop', 'muted', 'playsinline',
    'poster', 'preload', 'allowfullscreen', 'frameborder', 'allow', 'sandbox',
    'loading', 'referrerpolicy', 'width', 'height',
  ],
  ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'track', 'picture', 'u', 'ins'],
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: false,
  },
  RETURN_TRUSTED_TYPE: false,
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
})
