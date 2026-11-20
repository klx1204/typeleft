/**
 * View selection.
 *
 * ProseMirror has no virtualised rendering: parsing and laying out a very large
 * document blocks the UI for seconds (measured ~4.7s at 450K characters and
 * ~15s at 900K). CodeMirror 6 is virtualised, so large documents open in source
 * mode instead of being handed to the legacy Muya engine.
 *
 * The Muya engine is still selectable manually in Settings.
 */
export const LARGE_DOC_LIMIT = 200 * 1024;

export type EditorEngine = 'milkdown' | 'muya';

export interface ViewDecision {
  engine: EditorEngine;
  /** Render the CodeMirror 6 source editor instead of the WYSIWYG editor. */
  sourceMode: boolean;
  /** True when source mode was chosen automatically because of the size. */
  autoSource: boolean;
}

export const resolveView = (
  configured: unknown,
  docLength: number,
  sourceCode: boolean,
  forceWysiwyg = false
): ViewDecision => {
  const engine: EditorEngine = configured === 'muya' ? 'muya' : 'milkdown';
  const large = docLength > LARGE_DOC_LIMIT;
  const autoSource = engine === 'milkdown' && large && !forceWysiwyg;
  return {
    engine,
    // For large documents the size decides, so a stale `sourceCode` setting
    // cannot silently pull a small document into source mode either.
    sourceMode: engine === 'milkdown'
      ? (large ? !forceWysiwyg : sourceCode)
      : sourceCode,
    autoSource,
  };
};
