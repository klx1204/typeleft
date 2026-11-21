/**
 * View selection.
 *
 * ProseMirror has no virtualised rendering: parsing and laying out a very large
 * document blocks the UI for seconds (measured ~4.7s at 450K characters and
 * ~15s at 900K). CodeMirror 6 is virtualised, so large documents open in source
 * mode.
 */
export const LARGE_DOC_LIMIT = 200 * 1024;

export interface ViewDecision {
  /** Render the CodeMirror 6 source editor instead of the WYSIWYG editor. */
  sourceMode: boolean;
  /** True when source mode was chosen automatically because of the size. */
  autoSource: boolean;
}

export const resolveView = (
  docLength: number,
  sourceCode: boolean,
  forceWysiwyg = false
): ViewDecision => {
  const large = docLength > LARGE_DOC_LIMIT;
  return {
    sourceMode: large ? !forceWysiwyg : sourceCode,
    autoSource: large && !forceWysiwyg,
  };
};
