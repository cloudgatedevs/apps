import { deletionCandidates, loadMediaPages } from './media-model.js';
export function protectEventsMedia(client, readEventsData) {
  const files = client.files;
  client.files = { ...files, async delete(id, options) {
    const all = [];
    for (const path of ['media', 'branding']) {
      all.push(...await loadMediaPages(({ skip, take }) => files.list({ path, skip, take, signal: options?.signal })));
    }
    const [data, { values }] = await Promise.all([readEventsData(), client.appearance.getPublic()]);
    if (!['admin', 'administrator', 'owner'].includes(data?.role))
      throw new Error('Events administrator access is required to check image references.');
    deletionCandidates([id], all, { ...data, settings: { ...data.settings,
      logo_url: values.app_logo_url, icon_url: values.app_icon_url, favicon_url: values.app_icon_url,
    } });
    return files.delete(id, options);
  } };
}
