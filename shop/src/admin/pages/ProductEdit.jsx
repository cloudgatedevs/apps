import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Badge, PageHead, Img } from '@/shared/ui/ui';
import { Skeleton, SkeletonForm } from '@/shared/ui/skeleton';
import { Field, ConfirmButton } from '@/shared/ui/forms';
import { Tooltip } from '@/shared/ui/menus';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { MediaPicker } from '@/shared/ui/MediaPicker';
import { fmtCents, fromCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { productStatusTone } from '@/admin/pages/Products';
import { ExternalLink, Image as ImageIcon } from 'lucide-react';

// ---------------------------------------------------------------- helpers
const emptyProduct = {
  name: '', slug: '', sku: '', brand: '', shortDescription: '', description: '', categoryId: '',
  status: 'draft', price: '', compareAt: '', cost: '', trackInventory: true, isFeatured: false, tags: '', weightGrams: '',
};

const fromServer = (p) => ({
  name: p.Name ?? '', slug: p.Slug ?? '', sku: p.Sku ?? '', brand: p.Brand ?? '',
  shortDescription: p.ShortDescription ?? '', description: p.Description ?? '', categoryId: p.CategoryId ?? '',
  status: p.Status ?? 'draft', price: fromCents(p.PriceCents), compareAt: fromCents(p.CompareAtCents), cost: fromCents(p.CostCents),
  trackInventory: !!p.TrackInventory, isFeatured: !!p.IsFeatured, tags: p.Tags ?? '', weightGrams: p.WeightGrams ?? '',
});

const optionsFromServer = (p) => (p.Options ?? []).map((o) => ({ name: o.Name, values: (o.Values ?? []).map((v) => v.Value) }));

const variantsFromServer = (p) => (p.Variants ?? []).map((v) => ({
  id: v.Id, title: v.Title ?? '', sku: v.Sku ?? '', barcode: v.Barcode ?? '', options: v.Options ?? {},
  price: fromCents(v.PriceCents), compareAt: fromCents(v.CompareAtCents), cost: fromCents(v.CostCents),
  stockQty: v.StockQty ?? 0, lowStockThreshold: v.LowStockThreshold ?? 5, isDefault: !!v.IsDefault, isActive: v.IsActive !== 0 && v.IsActive !== false,
}));

const signature = (options) => JSON.stringify(Object.entries(options ?? {}).sort(([a], [b]) => a.localeCompare(b)));

/** Cartesian product of option values -> variant rows, keeping existing rows with the same combination. */
function generateVariants(options, existing) {
  const axes = options.filter((o) => o.name.trim() && o.values.length);
  if (!axes.length) return existing.length ? existing : [{ title: 'Default', sku: '', options: {}, price: '', compareAt: '', cost: '', stockQty: 0, lowStockThreshold: 5, isDefault: true, isActive: true }];
  let combos = [{}];
  for (const axis of axes) {
    combos = combos.flatMap((c) => axis.values.map((v) => ({ ...c, [axis.name.trim()]: v })));
  }
  const bySig = new Map(existing.map((v) => [signature(v.options), v]));
  return combos.map((opts, i) => {
    const prev = bySig.get(signature(opts));
    return prev
      ? { ...prev, options: opts, title: Object.values(opts).join(' / ') }
      : { title: Object.values(opts).join(' / '), sku: '', options: opts, price: '', compareAt: '', cost: '', stockQty: 0, lowStockThreshold: 5, isDefault: i === 0, isActive: true };
  });
}

const toPayload = (form, options, variants, creating) => ({
  name: form.name, slug: form.slug || undefined, sku: form.sku, brand: form.brand,
  shortDescription: form.shortDescription, description: form.description,
  categoryId: form.categoryId ? Number(form.categoryId) : null,
  status: form.status, priceCents: toCents(form.price) ?? 0, compareAtCents: toCents(form.compareAt), costCents: toCents(form.cost),
  trackInventory: form.trackInventory, isFeatured: form.isFeatured, tags: form.tags,
  weightGrams: form.weightGrams === '' ? null : Number(form.weightGrams),
  options: options.filter((o) => o.name.trim()).map((o, i) => ({ name: o.name.trim(), values: o.values, position: i })),
  variants: variants.map((v, i) => ({
    id: v.id, title: v.title, sku: v.sku, barcode: v.barcode, options: v.options,
    priceCents: toCents(v.price), compareAtCents: toCents(v.compareAt), costCents: toCents(v.cost),
    ...(creating ? { stockQty: Number(v.stockQty) || 0 } : {}),
    lowStockThreshold: Number(v.lowStockThreshold) || 0, isDefault: v.isDefault, isActive: v.isActive, position: i,
  })),
});

const PageSkeleton = () => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-2"><Skeleton className="h-6 w-56 rounded" /><Skeleton className="h-3.5 w-40 rounded" /></div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6"><SkeletonForm fields={6} /><SkeletonForm fields={3} /></div>
      <div className="flex flex-col gap-6"><SkeletonForm fields={3} /><SkeletonForm fields={3} /><div className="card p-4"><Skeleton className="h-4 w-20 rounded" /><div className="mt-3 grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div></div></div>
    </div>
  </div>
);

// ---------------------------------------------------------------- page
const ProductEdit = () => {
  const { id } = useParams();
  const creating = !id;
  const navigate = useNavigate();

  const categories = useAsync(() => adminApi.categories.list(), []);
  const product = useAsync(() => (creating ? Promise.resolve(null) : adminApi.products.get(Number(id))), [id]);

  const [form, setForm] = useState(emptyProduct);
  const [options, setOptions] = useState([]);
  const [variants, setVariants] = useState([]);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    if (creating) {
      setForm(emptyProduct);
      setOptions([]);
      setVariants(generateVariants([], []));
      setImages([]);
      return;
    }
    if (product.data) {
      setForm(fromServer(product.data));
      setOptions(optionsFromServer(product.data));
      setVariants(variantsFromServer(product.data));
      setImages(product.data.Images ?? []);
    }
  }, [creating, product.data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const hasVariants = options.some((o) => o.name.trim() && o.values.length);
  const currency = product.data?.Currency || 'ZAR';

  // ---- options editor
  const updateOption = (i, patch) => setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const removeOption = (i) => setOptions((os) => os.filter((_, j) => j !== i));
  const addOption = () => setOptions((os) => [...os, { name: '', values: [] }]);
  useEffect(() => {
    setVariants((vs) => generateVariants(options, vs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);

  const updateVariant = (i, patch) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const setDefault = (i) => setVariants((vs) => vs.map((v, j) => ({ ...v, isDefault: j === i })));

  // ---- save (Ctrl+S too)
  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) return toast.error('Give the product a name.');
    if (toCents(form.price) == null || toCents(form.price) < 0) return toast.error('Enter a valid price.');
    setSaving(true);
    try {
      const payload = toPayload(form, options, variants, creating);
      if (creating) {
        const created = await adminApi.products.create(payload);
        toast.success('Product created. Add photos, then publish when it is ready.');
        navigate(`/products/${created.Id}`, { replace: true });
      } else {
        const updated = await adminApi.products.update(Number(id), payload);
        setForm(fromServer(updated));
        setOptions(optionsFromServer(updated));
        setVariants(variantsFromServer(updated));
        setImages(updated.Images ?? []);
        toast.success('Saved.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
    return undefined;
  };
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, options, variants]);

  const setStatus = async (status) => {
    const previous = form.status;
    setForm((f) => ({ ...f, status }));
    try {
      const updated = await adminApi.products.setStatus(Number(id), status);
      setForm(fromServer(updated));
      toast.success(status === 'active' ? 'Product is live.' : `Status set to ${status}.`);
    } catch (err) {
      setForm((f) => ({ ...f, status: previous }));
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    try {
      const r = await adminApi.products.remove(Number(id));
      navigate('/products', { replace: true, state: { notice: r.deleted ? 'Product deleted.' : 'Product archived (it has order history).' } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // ---- images
  const [choosing, setChoosing] = useState(false);
  const onUploaded = async (done) => {
    let latest = null;
    for (const up of done) {
      try {
        latest = await adminApi.products.addImage(Number(id), { url: up.url, thumbUrl: up.thumbUrl, fileId: up.id, alt: form.name });
      } catch (err) {
        toast.error(errorMessage(err));
      }
    }
    if (latest) setImages(latest.Images ?? []);
    toast.success(`${done.length} image${done.length === 1 ? '' : 's'} added.`);
  };
  const removeImage = async (imageId) => {
    const previous = images;
    setImages((imgs) => imgs.filter((i) => i.Id !== imageId));
    try {
      const updated = await adminApi.products.removeImage(Number(id), imageId);
      setImages(updated.Images ?? []);
    } catch (err) {
      setImages(previous);
      toast.error(errorMessage(err));
    }
  };
  const reorder = async (ids) => {
    const previous = images;
    setImages(ids.map((x) => images.find((i) => i.Id === x)).filter(Boolean));
    try {
      const updated = await adminApi.products.reorderImages(Number(id), ids);
      setImages(updated.Images ?? []);
    } catch (err) {
      setImages(previous);
      toast.error(errorMessage(err));
    }
  };
  const makePrimary = (imageId) => reorder([imageId, ...images.map((i) => i.Id).filter((x) => x !== imageId)]);
  const onDrop = (targetId) => {
    if (dragId == null || dragId === targetId) return;
    const ids = images.map((i) => i.Id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setDragId(null);
    reorder(ids);
  };

  const totalStock = useMemo(() => variants.reduce((s, v) => s + (Number(v.stockQty) || 0), 0), [variants]);

  if (!creating && product.loading) return <PageSkeleton />;
  if (!creating && product.error) return <ErrorNote error={product.error} />;

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <PageHead
        title={creating ? 'New product' : form.name || 'Edit product'}
        subtitle={creating ? 'Products start as drafts. Publish when the listing is ready.' : (
          <span className="inline-flex items-center gap-2">
            <Badge tone={productStatusTone(form.status)} dot>{form.status}</Badge>
            {form.status === 'active' ? <a href={`/p/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:text-accent-600">View in store <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}
          </span>
        )}
      >
        <Link to="/products" className="btn-ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back</span></Link>
        {!creating && form.status !== 'active' ? <button type="button" onClick={() => setStatus('active')} className="btn-ghost">Publish</button> : null}
        {!creating && form.status === 'active' ? <button type="button" onClick={() => setStatus('draft')} className="btn-ghost">Unpublish</button> : null}
        <Tooltip text="Ctrl S"><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : creating ? 'Create product' : 'Save changes'}</button></Tooltip>
      </PageHead>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ---- left column */}
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-mist">Details</h2>
            <Field label="Name" htmlFor="name"><input id="name" value={form.name} onChange={set('name')} className="input" required autoFocus={creating} /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug" hint="URL handle. Leave blank to generate from the name." htmlFor="slug"><input id="slug" value={form.slug} onChange={set('slug')} className="input font-mono" placeholder="auto" /></Field>
              <Field label="Product SKU" htmlFor="sku"><input id="sku" value={form.sku} onChange={set('sku')} className="input font-mono" /></Field>
              <Field label="Brand" htmlFor="brand"><input id="brand" value={form.brand} onChange={set('brand')} className="input" /></Field>
              <Field label="Category" htmlFor="category">
                <select id="category" value={form.categoryId ?? ''} onChange={set('categoryId')} className="select">
                  <option value="">No category</option>
                  {(categories.data ?? []).map((c) => <option key={c.Id} value={c.Id}>{c.ParentId ? '— ' : ''}{c.Name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Short description" hint="One line shown on listing cards." htmlFor="short"><input id="short" value={form.shortDescription} onChange={set('shortDescription')} className="input" maxLength={500} /></Field>
            <Field label="Description" htmlFor="desc"><textarea id="desc" value={form.description} onChange={set('description')} className="textarea" rows={6} /></Field>
            <Field label="Tags" hint="Comma separated, used by search." htmlFor="tags"><input id="tags" value={form.tags} onChange={set('tags')} className="input" /></Field>
          </section>

          <section className="card flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-mist">Options &amp; variants</h2>
                <p className="text-xs text-mist-muted">Add option axes like Size or Colour; every combination becomes a sellable variant with its own SKU and stock.</p>
              </div>
              <button type="button" onClick={addOption} className="btn-ghost btn-sm">Add option</button>
            </div>

            {options.map((o, i) => (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-ink-700 p-3 sm:grid-cols-[10rem_1fr_auto]">
                <input value={o.name} onChange={(e) => updateOption(i, { name: e.target.value })} className="input" placeholder="Option (e.g. Size)" />
                <input
                  value={o.values.join(', ')}
                  onChange={(e) => updateOption(i, { values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                  className="input"
                  placeholder="Values, comma separated (S, M, L)"
                />
                <button type="button" onClick={() => removeOption(i)} className="btn-ghost btn-sm">Remove</button>
              </div>
            ))}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-mist-dim">
                    <th className="py-2 pr-3">Variant</th>
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Price</th>
                    <th className="py-2 pr-3">Compare at</th>
                    <th className="py-2 pr-3">Cost</th>
                    <th className="py-2 pr-3">{creating ? 'Opening stock' : 'Stock'}</th>
                    <th className="py-2 pr-3">Low at</th>
                    <th className="py-2 pr-3">Default</th>
                    <th className="py-2">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700/70">
                  {variants.map((v, i) => (
                    <tr key={v.id ?? signature(v.options) ?? i}>
                      <td className="py-2 pr-3"><input value={v.title} onChange={(e) => updateVariant(i, { title: e.target.value })} className="input w-36 py-1.5" disabled={hasVariants} /></td>
                      <td className="py-2 pr-3"><input value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} className="input w-36 py-1.5 font-mono" /></td>
                      <td className="py-2 pr-3"><input value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })} className="input w-24 py-1.5 tabular-nums" placeholder={form.price || 'inherit'} inputMode="decimal" /></td>
                      <td className="py-2 pr-3"><input value={v.compareAt} onChange={(e) => updateVariant(i, { compareAt: e.target.value })} className="input w-24 py-1.5 tabular-nums" placeholder="—" inputMode="decimal" /></td>
                      <td className="py-2 pr-3"><input value={v.cost} onChange={(e) => updateVariant(i, { cost: e.target.value })} className="input w-24 py-1.5 tabular-nums" placeholder="—" inputMode="decimal" /></td>
                      <td className="py-2 pr-3">
                        {creating ? (
                          <input type="number" min="0" value={v.stockQty} onChange={(e) => updateVariant(i, { stockQty: e.target.value })} className="input w-20 py-1.5 tabular-nums" />
                        ) : (
                          <Tooltip text="Adjust in Inventory"><Link to={`/inventory?productId=${id}`} className="tabular-nums text-accent hover:text-accent-600">{v.stockQty}</Link></Tooltip>
                        )}
                      </td>
                      <td className="py-2 pr-3"><input type="number" min="0" value={v.lowStockThreshold} onChange={(e) => updateVariant(i, { lowStockThreshold: e.target.value })} className="input w-16 py-1.5 tabular-nums" /></td>
                      <td className="py-2 pr-3"><input type="radio" name="defaultVariant" checked={!!v.isDefault} onChange={() => setDefault(i)} className="accent-accent" /></td>
                      <td className="py-2"><input type="checkbox" checked={!!v.isActive} onChange={(e) => updateVariant(i, { isActive: e.target.checked })} className="accent-accent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-mist-dim">
              {variants.length} variant{variants.length === 1 ? '' : 's'} · {creating ? `${totalStock} units opening stock` : 'stock changes are made in Inventory so every movement is recorded'}
            </p>
          </section>
        </div>

        {/* ---- right column */}
        <div className="flex flex-col gap-6">
          <section className="card flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-mist">Pricing</h2>
            <Field label={`Price (${currency})`} htmlFor="price"><input id="price" value={form.price} onChange={set('price')} className="input tabular-nums" inputMode="decimal" placeholder="0.00" required /></Field>
            <Field label="Compare-at price" hint="Shown struck through when higher than the price." htmlFor="compareAt"><input id="compareAt" value={form.compareAt} onChange={set('compareAt')} className="input tabular-nums" inputMode="decimal" /></Field>
            <Field label="Cost" hint="Used for stock value; never shown to customers." htmlFor="cost"><input id="cost" value={form.cost} onChange={set('cost')} className="input tabular-nums" inputMode="decimal" /></Field>
            {toCents(form.price) != null ? <p className="text-xs text-mist-dim">Customers see {fmtCents(toCents(form.price), currency)}{toCents(form.compareAt) > toCents(form.price) ? <> instead of <s>{fmtCents(toCents(form.compareAt), currency)}</s></> : null}.</p> : null}
          </section>

          <section className="card flex flex-col gap-4 p-4">
            <h2 className="text-sm font-semibold text-mist">Visibility</h2>
            <Field label="Status" htmlFor="status">
              <select id="status" value={form.status} onChange={set('status')} className="select">
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (live in store)</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} className="accent-accent" /> Featured on the home page</label>
            <label className="flex items-center gap-3 text-sm text-mist-muted"><input type="checkbox" checked={form.trackInventory} onChange={set('trackInventory')} className="accent-accent" /> Track inventory (hide when out of stock)</label>
            <Field label="Weight (grams)" htmlFor="weight"><input id="weight" type="number" min="0" value={form.weightGrams} onChange={set('weightGrams')} className="input tabular-nums" /></Field>
          </section>

          <section className="card flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mist">Images</h2>
              {!creating ? <div className="flex gap-2"><button type="button" onClick={() => setChoosing(true)} className="btn-ghost btn-sm">Choose…</button><button type="button" onClick={() => setUploading(true)} className="btn-ghost btn-sm">Upload…</button></div> : null}
            </div>
            {creating ? (
              <p className="text-xs text-mist-muted">Create the product first, then add images.</p>
            ) : images.length === 0 ? (
              <button type="button" onClick={() => setUploading(true)} className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-ink-600 px-4 py-8 text-center text-xs text-mist-muted transition hover:border-accent hover:bg-accent-soft/40">
                <ImageIcon className="h-7 w-7 text-mist-dim" aria-hidden="true" />
                <span className="font-medium text-mist">Add product photos</span>
                <span>Drag and drop, pick files or use the webcam. Each opens in the crop tool. The first image is the listing photo.</span>
              </button>
            ) : (
              <>
                <ul className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <li
                      key={img.Id}
                      draggable
                      onDragStart={() => setDragId(img.Id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(img.Id)}
                      className={`group relative aspect-square overflow-hidden rounded-xl border bg-ink-900 transition ${dragId === img.Id ? 'opacity-50' : ''} ${i === 0 ? 'border-accent' : 'border-ink-700'}`}
                    >
                      <Img src={img.ThumbUrl || img.Url} alt={img.Alt ?? ''} wrapClassName="h-full w-full" className="h-full w-full object-cover" />
                      {i === 0 ? <span className="absolute left-1 top-1 rounded-md bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">Primary</span> : null}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-slate-900/70 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                        {i !== 0 ? <button type="button" onClick={() => makePrimary(img.Id)} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-mist">Primary</button> : <span />}
                        <button type="button" onClick={() => removeImage(img.Id)} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-red-700">Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-mist-dim">Drag to reorder. The first image is the listing photo.</p>
              </>
            )}
          </section>

          {!creating ? (
            <section className="card flex flex-col gap-3 p-4">
              <h2 className="text-sm font-semibold text-mist">Danger zone</h2>
              <p className="text-xs text-mist-muted">Products with order history are archived instead of deleted so past orders keep their lines.</p>
              <ConfirmButton onConfirm={remove} confirmLabel="Really delete?">Delete product</ConfirmButton>
            </section>
          ) : null}
        </div>
      </div>

      {!creating ? (
        <>
        <MediaPicker open={choosing} onClose={() => setChoosing(false)} multiple preferFolder="shop/products" title={`Choose photos for ${form.name || 'product'}`} onUploadInstead={() => setUploading(true)}
          onPick={(files) => onUploaded(files.map((f) => ({ url: f.url, thumbUrl: f.thumbUrl, id: f.id })))} />
        <ImageUploader open={uploading} onClose={() => setUploading(false)} path="shop/products" aspect={1} maxFiles={10} title={`Photos for ${form.name || 'product'}`} onUploaded={onUploaded} />
        </>
      ) : null}
    </form>
  );
};

export { ProductEdit };
