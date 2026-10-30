/**
 * Client-side image compression for support-chat attachments.
 *
 * Downscales + re-encodes an image in the browser (canvas → JPEG) BEFORE upload
 * so we never ship multi-megabyte camera/screenshot files to storage. This is
 * the primary defence against storage bloat; the server keeps a hard 5MB ceiling
 * as a backstop. Fail-open: any error returns the original file untouched.
 *
 * @module lib/utils/image-compress
 */

export interface CompressOptions {
  /** Longest-edge cap in pixels. Screenshots rarely need more than this. */
  maxDimension?: number;
  /** JPEG quality (0–1). */
  quality?: number;
  /** Skip re-encoding files already at/below this size AND within maxDimension. */
  skipBelowBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  skipBelowBytes: 300 * 1024, // 300KB
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = url;
  });
}

/**
 * Compress an image File. Returns a (usually smaller) JPEG File, or the original
 * file if it's not a raster image we can safely re-encode, or on any failure.
 * Animated GIFs are passed through untouched (a canvas would flatten them).
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality, skipBelowBytes } = { ...DEFAULTS, ...options };

  if (typeof document === 'undefined') return file; // SSR guard
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // preserve animation

  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;

    const scale = Math.min(1, maxDimension / Math.max(w, h));
    // Small AND already within bounds → don't bother re-encoding.
    if (scale === 1 && file.size <= skipBelowBytes) return file;

    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob || blob.size >= file.size) return file; // re-encode didn't help

    const baseName = file.name.replace(/\.[^./\\]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file; // fail-open
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
