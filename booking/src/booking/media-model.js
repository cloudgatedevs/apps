const SETTINGS = { logo_url: 'Logo', icon_url: 'App icon', favicon_url: 'Favicon', hero_image_url: 'Homepage banner', about_image_url: 'About image' };
export const MEDIA_FOLDERS = { 'booking/services': 'Services', 'booking/team': 'Team', 'booking/branding': 'Branding', 'booking/library': 'General library' };
export const folderLabel = path => MEDIA_FOLDERS[path] || path.slice('booking/'.length);
export function isBookingFolder(path) {
  return typeof path === 'string' && path.startsWith('booking/') && path.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes('\\'));
}

function imageKeys(value) {
  if (!value) return [];
  try {
    const url = new URL(String(value).trim(), 'https://booking.invalid');
    url.hash = ''; url.searchParams.sort();
    const keys = [url.href];
    // Full images and thumbnails both reference the host's DataFile id.
    if (/^\/File\/GetPublicFileById(?:Small)?$/i.test(url.pathname)) {
      const id = [...url.searchParams].find(([key]) => key.toLowerCase() === 'id')?.[1];
      if (/^[0-9a-f-]{36}$/i.test(id || '')) keys.push('file:' + id.toLowerCase());
    }
    const previewImage = /^\/api\/branding-media\/([a-f0-9]{64})\.png$/.exec(url.pathname);
    if (previewImage) keys.push('preview:' + previewImage[1]);
    return keys;
  } catch { return []; }
}

export function mediaRows(files, data) {
  if (!Array.isArray(data?.services) || !data?.settings) throw new Error('Reload booking data before managing media.');
  const references = [];
  for (const person of data.staff || []) references.push({ keys: imageKeys(person.image_url), label: person.name + ' (team)', page: 'team' });
  for (const service of data.services) {
    // Retired services no longer display their photo. Hidden services still need theirs.
    if (Number(service.deleted)) continue;
    references.push({ keys: imageKeys(service.image_url), label: service.name + (Number(service.active) ? '' : ' (hidden)'), page: 'services' });
  }
  for (const [key, label] of Object.entries(SETTINGS)) references.push({ keys: imageKeys(data.settings[key]), label, page: 'settings' });
  return files.filter(file => isBookingFolder(file.path)).map(file => {
    const keys = new Set([...imageKeys(file.url), ...imageKeys(file.thumbUrl), 'file:' + String(file.id).toLowerCase()]);
    const usages = references.filter(ref => ref.keys.some(key => keys.has(key))).map(({ label, page }) => ({ label, page }));
    return { ...file, id: String(file.id), usages, inUse: usages.length > 0 };
  });
}

export function deletionCandidates(ids, files, data) {
  const rows = mediaRows(files, data);
  return [...new Set(ids.map(String))].map(id => {
    const row = rows.find(file => file.id === id);
    if (!row) throw new Error('An image is no longer in the Booking library. Refresh and select your images again.');
    if (row.inUse) throw new Error(`${row.name} is now in use. Remove it from its service, team member or branding setting before deleting it.`);
    return row;
  });
}

// The host caps each page. Read every page before filtering by app folder so
// booking photos remain visible even when other apps have a large library.
export async function loadMediaPages(readPage) {
  const files = new Map();
  let skip = 0;
  for (;;) {
    const page = await readPage({ path: '*', skip, take: 100 });
    if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0) throw new Error('The file service returned an invalid media list.');
    const before = files.size;
    for (const file of page.items) {
      if (file.id == null) throw new Error('An image is missing its file identifier. Refresh the library.');
      if (files.has(String(file.id))) throw new Error('The media list changed while loading. Refresh to try again.');
      files.set(String(file.id), file);
    }
    skip += page.items.length;
    if (skip >= page.total) return [...files.values()];
    if (!page.items.length || before === files.size) throw new Error('The media list changed while loading. Refresh to try again.');
  }
}
