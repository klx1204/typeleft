/// <reference types="vite/client" />

declare module '*?raw' {
  const source: string;
  export default source;
}

declare module 'nspell' {
  const nspell: (aff: string | Uint8Array, dic: string | Uint8Array) => any;
  export default nspell;
}
