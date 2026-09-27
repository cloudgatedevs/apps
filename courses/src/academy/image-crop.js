// Crop + export helper (ported from the Cloudgate hub's imageCropExport.js and generalised
// to any aspect ratio). Draws the pixel crop from react-easy-crop onto a canvas, scales the long
// side down to `maxSide`, and encodes JPEG with decreasing quality until it fits `maxBytes`.

const MAX_BYTES = 4 * 1024 * 1024;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (e) => reject(e));
    if (/^https?:\/\//i.test(url)) image.crossOrigin = 'anonymous';
    image.src = url;
  });
}

/**
 * @param {string} imageSrc object URL or remote URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop from react-easy-crop
 * @param {{ maxSide?: number, maxBytes?: number, type?: 'image/jpeg' | 'image/png' | 'image/webp' }} [opts]
 * @returns {Promise<Blob>}
 */
export async function getCroppedBlob(imageSrc, pixelCrop, { maxSide = 1600, maxBytes = MAX_BYTES, type = 'image/jpeg' } = {}) {
  const image = await loadImage(imageSrc);
  const scale = Math.min(1, maxSide / Math.max(pixelCrop.width, pixelCrop.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
  canvas.height = Math.max(1, Math.round(pixelCrop.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') {
    // JPEG has no alpha: paint white first, or transparent areas encode as black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);

  const toBlob = (q) => new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
  let quality = 0.92;
  let blob = await toBlob(quality);
  while (type !== 'image/png' && blob && blob.size > maxBytes && quality > 0.42) {
    quality -= 0.07;
    blob = await toBlob(quality);
  }
  if (blob && blob.size > maxBytes && maxSide > 480) {
    return getCroppedBlob(imageSrc, pixelCrop, { maxSide: Math.floor(maxSide * 0.75), maxBytes, type });
  }
  if (!blob || blob.size > maxBytes) throw new Error('Could not compress the image under the size limit. Try a different photo.');
  return blob;
}

/** Full-image "crop" (no user crop) so every upload goes through the same resize/compress path. */
export async function getResizedBlob(imageSrc, opts) {
  const image = await loadImage(imageSrc);
  return getCroppedBlob(imageSrc, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }, opts);
}
