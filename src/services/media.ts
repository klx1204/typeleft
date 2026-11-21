/** Classify a dropped/pasted file by extension (#124). */
export type MediaKind = 'image' | 'video' | 'audio' | null;

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico']);
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'mkv', 'avi']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'opus']);

export const mediaKindForPath = (path: string): MediaKind => {
  const clean = String(path || '').split(/[?#]/)[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  if (IMAGE.has(ext)) return 'image';
  if (VIDEO.has(ext)) return 'video';
  if (AUDIO.has(ext)) return 'audio';
  return null;
};
