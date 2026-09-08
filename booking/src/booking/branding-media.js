import { call, preview } from './api';
import { uploadImage, listImages } from '../shared/services/files';

export async function saveBrandImage(blob, name) {
  const file = new File([blob], name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  if (!preview) return uploadImage(file, { path: 'booking/branding' });
  const content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(file);
  });
  return call('upload', { name: file.name, content }, true, 'branding-media');
}
export function listBrandImages(skip = 0) {
  return preview ? call('list', { skip, take: 36 }, true, 'branding-media') : listImages({ path: '*', skip, take: 36 });
}
