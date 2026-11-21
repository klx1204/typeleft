import remote from 'services/remote/common';
import { finalizeImagePath, imageDirectory } from 'services/imagePaths';

const readFileAsBase64 = (file: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const match = result.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) resolve(match[1]);
      else reject(new Error('Failed to read image as base64'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Turn any image source (clipboard data URL, web URL, local path, File) into the
 * final `src` that should be written into the markdown document, honouring the
 * user's image settings. Shared by the Muya and Milkdown engines.
 */
export const processImage = async (
  image: string | File,
  options: any,
  name?: string
): Promise<string> => {
  const opts = options ?? {};
  const basePath = (window as any).basePath || '';

  const finalize = (path: string) => finalizeImagePath(path, basePath, opts);

  const saveBase64 = async (base64Data: string, fileName: string) =>
    finalize(await remote.saveImage({
      fileName,
      base64Data,
      subDir: opts.imageCopyDir || 'images',
      basePath: basePath || undefined,
    }));

  const downloadToPath = async (url: string, fileName: string) => {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const base64 = await readFileAsBase64(blob);
    return saveBase64(base64, fileName);
  };

  try {
    if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        const action = opts.insertClipboardImageAction;
        if (action === 'none') return image;
        const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) return image;
        if (action === 'upload') {
          return await remote.uploadImage({ base64Data: base64Match[1], fileName: name || `image-${Date.now()}.png` });
        }
        return await saveBase64(base64Match[1], name || `image-${Date.now()}`);
      }
      if (/^https?:\/\//.test(image)) {
        if (opts.insertWebImageAction === 'copyToPath' && basePath) {
          try {
            return await downloadToPath(image, name || `image-${Date.now()}`);
          } catch {
            return finalize(image);
          }
        }
        return finalize(image);
      }
      if (opts.insertLocalImageAction === 'upload') {
        const loaded = await remote.loadImage({ path: image });
        const b64 = loaded.url.split(',')[1] || '';
        return await remote.uploadImage({ base64Data: b64, fileName: image.split('/').pop() || name || 'image.png' });
      }
      if (opts.insertLocalImageAction === 'copyToPath' && basePath) {
        return finalize(await remote.copyImage({
          sourcePath: image,
          destDir: imageDirectory(basePath, opts.imageCopyDir),
        }));
      }
      return finalize(image);
    }
    if (image instanceof File) {
      const base64 = await readFileAsBase64(image);
      if (opts.insertClipboardImageAction === 'none') {
        return `data:image/png;base64,${base64}`;
      }
      if (opts.insertClipboardImageAction === 'upload') {
        return await remote.uploadImage({ base64Data: base64, fileName: image.name || `image-${Date.now()}.png` });
      }
      return await saveBase64(base64, image.name || `image-${Date.now()}`);
    }
  } catch (e) {
    console.error('[Typeleft] image processing failed:', e);
  }
  return typeof image === 'string' ? image : '';
};
