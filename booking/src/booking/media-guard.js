import { deletionCandidates, loadMediaPages } from './media-model.js';
export function protectBookingMedia(client, readBookingData) {
  const files = client.files;
  client.files = { ...files, async delete(id, options) {
    const all = [];
    for (const path of ['media', 'branding']) {
      all.push(...await loadMediaPages(({ skip, take }) => files.list({ path, skip, take, signal: options?.signal })));
    }
    const [data, { values }] = await Promise.all([readBookingData(), client.appearance.getPublic()]);
    deletionCandidates([id], all, { ...data, settings: { ...data.settings,
      logo_url: values.app_logo_url, icon_url: values.app_icon_url, favicon_url: values.app_icon_url,
    } });
    return files.delete(id, options);
  } };
}
