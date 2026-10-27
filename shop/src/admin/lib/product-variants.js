export const variantSignature = options => JSON.stringify(Object.entries(options ?? {}).sort(([a], [b]) => a.localeCompare(b)));
const emptyVariant = () => ({ title: 'Default', sku: '', options: {}, price: '', compareAt: '', cost: '',
  stockQty: 0, lowStockThreshold: 5, isDefault: false, isActive: true });

export const parseOptionValues = text => [...new Set(text.split(',').map(value => value.trim()).filter(Boolean))];

/** Preserve matching SKU data and the selected default as option combinations change. */
export function generateVariants(options, existing) {
  const axes = options.filter(option => option.name.trim() && option.values.length);
  let rows;
  if (!axes.length) {
    const previous = existing.find(variant => variant.isDefault) ?? existing[0];
    rows = [{ ...(previous ?? emptyVariant()), title: 'Default', options: {} }];
  } else {
    let combinations = [{}];
    for (const axis of axes) combinations = combinations.flatMap(options => axis.values.map(value => ({ ...options, [axis.name.trim()]: value })));
    const bySignature = new Map(existing.map(variant => [variantSignature(variant.options), variant]));
    rows = combinations.map(options => ({ ...(bySignature.get(variantSignature(options)) ?? emptyVariant()),
      options, title: Object.values(options).join(' / ') }));
  }
  const defaultIndex = Math.max(0, rows.findIndex(variant => variant.isDefault));
  return rows.map((variant, index) => ({ ...variant, isDefault: index === defaultIndex }));
}
