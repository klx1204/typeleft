/**
 * Engine selection.
 *
 * ProseMirror has no virtualised rendering: parsing and laying out a very large
 * document blocks the UI for seconds (measured ~4.7s at 450K characters and
 * ~15s at 900K). Documents above the limit therefore open with the Muya engine,
 * which stays bundled as a compatibility fallback.
 */
export const LARGE_DOC_LIMIT = 200 * 1024;

export type EditorEngine = 'milkdown' | 'muya';

export const resolveEngine = (configured: unknown, docLength: number): EditorEngine => {
  if (configured === 'muya') return 'muya';
  return docLength > LARGE_DOC_LIMIT ? 'muya' : 'milkdown';
};
