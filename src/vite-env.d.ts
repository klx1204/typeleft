/// <reference types="vite/client" />

declare module '*?raw' {
  const source: string;
  export default source;
}

declare module 'nspell' {
  const nspell: (aff: string | Uint8Array, dic: string | Uint8Array) => any;
  export default nspell;
}

declare module 'services/markdown/sanitize' {
  export const sanitize: (html: string, purifyOptions?: unknown, disableHtml?: boolean) => string;
  export const escapeHTML: (value: string) => string;
  export const escapeHtmlTags: (value: string) => string;
  export const unescapeHTML: (value: string) => string;
}
