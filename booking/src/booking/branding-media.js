import { call, preview } from './api';
import { uploadImage, listImages, deleteImage } from '../shared/services/files';
import { isBookingFolder, loadMediaPages } from './media-model';

export async function saveBrandImage(blob, name, path = 'booking/branding') {
  const file = new File([blob], name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  if (!preview) return uploadImage(file, { path });
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
  return call('upload', { name: file.name, content, path }, true, 'branding-media');
}
export function listBrandImages(skip = 0) {
  return preview ? call('list', { skip, take: 36 }, true, 'branding-media') : listImages({ path: '*', skip, take: 36 });
}

export async function listBookingImages() {
  const files = await loadMediaPages(options => preview ? call('list', options, true, 'branding-media') : listImages(options));
  return files.filter(file => isBookingFolder(file.path));
}

export function removeBookingImage(id) {
  return preview ? call('delete', { id }, true, 'branding-media') : deleteImage(id);
}
