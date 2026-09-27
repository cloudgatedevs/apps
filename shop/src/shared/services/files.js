import { cloudgate } from '@/platform';
// Product editors use SDK media storage. Native branding uses its own SDK folder.
const folder = path => String(path).includes('branding') ? 'branding' : 'media';
export const uploadImage = (file, { path = 'media' } = {}) => cloudgate.files.upload(file, folder(path));
export const listImages = async ({ path = 'media', skip = 0, take = 100 } = {}) => {
  if (path !== '*') return cloudgate.files.list({ path: folder(path), skip, take });
  // The picker spans this app's media and branding; native SDK paths stay scoped.
  const groups = await Promise.all(['media', 'branding'].map(async path => {
    const items = [];
    for (;;) {
      const page = await cloudgate.files.list({ path, skip: items.length, take: 100 });
      if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0 || (!page.items.length && items.length < page.total))
        throw new Error('Could not load the complete media library. Try again.');
      items.push(...page.items);
      if (items.length >= page.total) return items;
    }
  }));
  const items = groups.flat();
  return { items: items.slice(skip, skip + take), total: items.length };
};
export const deleteImage = id => cloudgate.files.delete(id);
