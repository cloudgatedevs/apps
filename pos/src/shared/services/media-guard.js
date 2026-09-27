const imageKeys = value => {
  if (!value) return [];
  try {
    const url = new URL(String(value), 'https://pos.invalid'); url.hash = ''; url.searchParams.sort();
    const id = /^\/File\/GetPublicFileById(?:Small)?$/i.test(url.pathname)
      ? [...url.searchParams].find(([key]) => key.toLowerCase() === 'id')?.[1] : null;
    return [url.href, ...(id ? ['file:' + id.toLowerCase()] : [])];
  } catch { return []; }
};

export function protectPosMedia(client, readReferences) {
  const files = client.files;
  client.files = { ...files, async delete(id, options) {
    const all = new Map();
    for (const path of ['media', 'branding']) {
      let skip = 0;
      for (;;) {
        const page = await files.list({ path, skip, take: 100, signal: options?.signal });
        if (!Array.isArray(page?.items) || !Number.isInteger(page.total) || page.total < 0)
          throw new Error('Reload the media library before deleting images.');
        for (const item of page.items) {
          if (item.id == null || all.has(String(item.id))) throw new Error('The media library changed. Refresh and try again.');
          all.set(String(item.id), item);
        }
        skip += page.items.length;
        if (skip >= page.total) break;
        if (!page.items.length) throw new Error('The media library is incomplete. Refresh and try again.');
      }
    }
    const file = all.get(String(id));
    if (!file) throw new Error('This image is no longer in the POS library. Refresh and try again.');
    // The workflow checks the retail Admin role and includes inactive products.
    const [refs, { values }] = await Promise.all([readReferences(), client.appearance.getPublic()]);
    if (!Array.isArray(refs?.fileIds) || !Array.isArray(refs?.urls)) throw new Error('Could not verify product image references.');
    const used = new Set([...refs.fileIds.map(value => 'file:' + String(value).toLowerCase()),
      ...[...refs.urls, values.app_logo_url, values.app_icon_url].flatMap(imageKeys)]);
    if (['file:' + String(file.id).toLowerCase(), ...imageKeys(file.url), ...imageKeys(file.thumbUrl)].some(key => used.has(key)))
      throw new Error(`${file.name} is in use. Remove it from its product or appearance setting before deleting it.`);
    return files.delete(id, options);
  } };
}
