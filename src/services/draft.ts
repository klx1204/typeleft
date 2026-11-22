export interface DraftLike {
  content: string;
  savedAt: number;
  filePath?: string;
}

const MAX_AGE = 7 * 24 * 3600 * 1000;

/**
 * A draft is offered only when it has content, is recent and differs from what
 * the editor would show otherwise. Drafts identical to the saved document are
 * stale leftovers and get discarded silently.
 */
export const shouldOfferDraft = (
  draft: DraftLike | null | undefined,
  current: string,
  now = Date.now(),
): boolean => {
  if (!draft || !draft.content) return false;
  if (draft.content === current) return false;
  if (!Number.isFinite(draft.savedAt) || now - draft.savedAt > MAX_AGE) return false;
  if (draft.savedAt > now + 60_000) return false;
  return true;
};
