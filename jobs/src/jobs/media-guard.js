import { deletionCandidates, loadMediaPages } from './media-model.js';
export function protectJobsMedia(client, readJobsData) {
  const files = client.files;
  client.files = { ...files, async delete(id, options) {
    const all = [];
    for (const path of ['media', 'branding']) {
      all.push(...await loadMediaPages(({ skip, take }) => files.list({ path, skip, take, signal: options?.signal })));
    }
    const [data, { values }] = await Promise.all([readJobsData(), client.appearance.getPublic()]);
    if (!['admin', 'administrator', 'owner'].includes(data?.role))
      throw new Error('Jobs administrator access is required to check image references.');
    if (!Array.isArray(data.records)) throw new Error('Reload the complete Jobs workspace before deleting images.');
    deletionCandidates([id], all, { ...data, services: data.records.filter(r => r.kind === 'service'),
      staff: data.records.filter(r => r.kind === 'team'), settings: { ...data.settings,
      logo_url: values.app_logo_url, icon_url: values.app_icon_url, favicon_url: values.app_icon_url,
    } });
    return files.delete(id, options);
  } };
}
