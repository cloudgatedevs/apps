import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Camera, Plus, ScanLine, Tag, Trash2 } from 'lucide-react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, PageHead, Img, Badge } from '@/shared/ui/ui';
import { SkeletonForm } from '@/shared/ui/skeleton';
import { Field, Modal, Notice, ConfirmButton } from '@/shared/ui/forms';
import { ImageUploader } from '@/shared/ui/ImageUploader';
import { MediaPicker } from '@/shared/ui/MediaPicker';
import { fmtCents, fromCents, toCents } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { BarcodeScanner } from '@/pos/components/BarcodeScanner';
import { useScannerInput } from '@/pos/components/useScannerInput';
import { LabelSheet } from '@/admin/components/LabelSheet';

const UNITS = ['each', 'kg', 'g', 'l', 'ml', 'm', 'box', 'pack'];
const empty = { name: '', sku: '', barcode: '', categoryId: '', supplierId: '', price: '', cost: '', taxRateBp: '', taxExempt: false, trackInventory: true, stockQty: '', lowStockThreshold: '', unit: 'each', isWeighed: false, imageUrl: '', imageFileId: '', color: '', notes: '', status: 'active' };

const fromProduct = (p) => ({
  name: p.Name ?? '', sku: p.Sku ?? '', barcode: p.Barcode ?? '', categoryId: p.CategoryId ?? '', supplierId: p.SupplierId ?? '', price: fromCents(p.PriceCents), cost: p.CostCents != null ? fromCents(p.CostCents) : '',
  taxRateBp: p.TaxRateBp ?? '', taxExempt: !!p.TaxExempt, trackInventory: p.TrackInventory !== 0, stockQty: '', lowStockThreshold: p.LowStockThreshold ?? '', unit: p.Unit || 'each', isWeighed: !!p.IsWeighed,
  imageUrl: p.ImageUrl ?? '', imageFileId: p.ImageFileId ?? '', color: p.Color ?? '', notes: p.Notes ?? '', status: p.Status ?? 'active',
});

/**
 * Create / edit a product. The main feature for stock capture: point the camera at the pack and the
 * barcode lands in the field (a USB scanner works too); the form warns when another product already
 * owns that barcode. Extra barcodes (multipacks, alternative packaging) are added on saved products.
 */
const ProductEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const { data, loading, error, setData } = useAsync(() => (isNew ? Promise.resolve(null) : adminApi.products.get(Number(id))), [id]);
  const categories = useAsync(() => adminApi.categories.list(), []);
  const suppliers = useAsync(() => adminApi.suppliers.list(), []);
  const settings = useAsync(() => adminApi.settings.get(), []);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [owner, setOwner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [extra, setExtra] = useState(null); // { barcode, label, packQty }
  const [labels, setLabels] = useState(null);
  const currency = settings.data?.currency || 'ZAR';

  useEffect(() => { if (data) setForm(fromProduct(data)); }, [data]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // Scanned code goes into whichever barcode field is open: the extra-barcode dialog or the main field.
  const applyScan = async (code) => {
    if (extra) { setExtra((x) => ({ ...x, barcode: code })); toast.success(`Scanned ${code}`); return; }
    setForm((f) => ({ ...f, barcode: code }));
    setScanning(false);
    toast.success(`Scanned ${code}`);
  };
  useScannerInput(applyScan);

  // Warn when the barcode already belongs to another product.
  useEffect(() => {
    const code = form.barcode.trim();
    if (!code) { setOwner(null); return undefined; }
    const t = setTimeout(() => adminApi.products.barcodeOwner(code).then((o) => setOwner(o && String(o.Id) !== String(id) ? o : null)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [form.barcode, id]);

  const payload = () => ({
    name: form.name.trim(), sku: form.sku.trim() || null, barcode: form.barcode.trim() || null, categoryId: form.categoryId ? Number(form.categoryId) : null, supplierId: form.supplierId ? Number(form.supplierId) : null,
    priceCents: toCents(form.price) ?? 0, costCents: toCents(form.cost), taxRateBp: form.taxRateBp === '' ? null : Number(form.taxRateBp), taxExempt: form.taxExempt, trackInventory: form.trackInventory,
    lowStockThreshold: form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold), unit: form.unit || 'each', isWeighed: form.isWeighed, imageUrl: form.imageUrl || null, imageFileId: form.imageFileId || null, color: form.color || null, notes: form.notes || null, status: form.status,
    ...(isNew && form.stockQty !== '' ? { stockQty: Number(form.stockQty) } : {}),
  });

  const save = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) { toast.error('Give the product a name.'); return; }
    if (owner) { toast.error(`Barcode ${form.barcode} already belongs to ${owner.Name}.`); return; }
    setBusy(true);
    try {
      if (isNew) { const p = await adminApi.products.create(payload()); toast.success('Product created.'); navigate(`/products/${p.Id}`, { replace: true }); }
      else { setData(await adminApi.products.update(Number(id), payload())); toast.success('Saved.'); }
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    try { const r = await adminApi.products.remove(Number(id)); toast.success(r.archived ? 'Product has sales, so it was deactivated instead of deleted.' : 'Product deleted.'); navigate('/products'); } catch (err) { toast.error(errorMessage(err)); }
  };
  const addExtra = async () => {
    if (!extra?.barcode?.trim()) { toast.error('Scan or type the barcode.'); return; }
    try { setData(await adminApi.products.addBarcode(Number(id), { barcode: extra.barcode.trim(), label: extra.label, packQty: Number(extra.packQty) || 1 })); setExtra(null); toast.success('Barcode added.'); } catch (err) { toast.error(errorMessage(err)); }
  };
  const removeExtra = async (bid) => { try { setData(await adminApi.products.removeBarcode(Number(id), bid)); } catch (err) { toast.error(errorMessage(err)); } };

  if (!isNew && loading && !data) return <SkeletonForm fields={8} />;
  if (error) return <ErrorNote error={error} />;
  const defaultBp = Number(settings.data?.tax_rate_bp ?? 0);

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <PageHead title={isNew ? 'New product' : form.name || 'Edit product'} subtitle={isNew ? 'Scan the barcode, set a price, and it is on the tills.' : <>{data?.Status === 'active' ? <Badge tone="green" dot>active</Badge> : <Badge tone="gray" dot>inactive</Badge>}{data?.Sold30d ? <span className="ml-2">{Number(data.Sold30d)} sold in the last 30 days</span> : null}</>}>
        {!isNew ? <button type="button" onClick={() => adminApi.products.labels([Number(id)]).then(setLabels)} className="btn-ghost"><Tag className="h-4 w-4" /> Label</button> : null}
        <Link to="/products" className="btn-ghost">Back</Link>
        <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving…' : isNew ? 'Create product' : 'Save'}</button>
      </PageHead>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="text-[15px] font-semibold text-mist">Barcode</h2>
            <p className="text-xs text-mist-muted">Point the camera at the pack, or use a USB scanner while this page is open.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex grow gap-2">
                <input value={form.barcode} onChange={set('barcode')} className="input font-mono" placeholder="6001234567890" inputMode="numeric" />
                <button type="button" onClick={() => setScanning((v) => !v)} className={`btn-ghost shrink-0 ${scanning ? '!bg-accent-soft !text-accent-600' : ''}`}><Camera className="h-4 w-4" /> {scanning ? 'Stop' : 'Scan'}</button>
              </div>
            </div>
            {owner ? <Notice tone="warn" className="mt-3">This barcode already belongs to <Link to={`/products/${owner.Id}`} className="font-medium underline">{owner.Name}</Link>. Use a different code or edit that product instead.</Notice> : null}
            {scanning ? <BarcodeScanner active onScan={applyScan} className="mt-3 max-w-md" /> : null}
            {!isNew ? (
              <div className="mt-4">
                <div className="flex items-center justify-between"><p className="label">Additional barcodes</p><button type="button" onClick={() => setExtra({ barcode: '', label: '', packQty: 1 })} className="btn-ghost btn-sm"><Plus className="h-4 w-4" /> Add</button></div>
                <p className="text-xs text-mist-dim">Multipacks or alternative packaging that ring up this product. A pack quantity of 6 adds six units per scan.</p>
                {data?.Barcodes?.length ? (
                  <ul className="mt-2 divide-y divide-ink-700 rounded-lg border border-ink-700">
                    {data.Barcodes.map((b) => <li key={b.Id} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="font-mono text-mist">{b.Barcode}</span><span className="text-mist-muted">{b.Label}</span><span className="ml-auto text-xs text-mist-dim">× {Number(b.PackQty)}</span><button type="button" onClick={() => removeExtra(b.Id)} className="btn-ghost btn-sm text-red-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button></li>)}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name" className="sm:col-span-2"><input id="p-name" value={form.name} onChange={set('name')} className="input" required autoFocus={isNew} /></Field>
            <Field label="SKU" hint="Your own code; optional." htmlFor="p-sku"><input id="p-sku" value={form.sku} onChange={set('sku')} className="input font-mono" /></Field>
            <Field label="Category" htmlFor="p-cat"><select id="p-cat" value={form.categoryId} onChange={set('categoryId')} className="select"><option value="">None</option>{(categories.data ?? []).map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}</select></Field>
            <Field label={`Selling price (${currency})`} htmlFor="p-price"><input id="p-price" value={form.price} onChange={set('price')} className="input" inputMode="decimal" placeholder="0.00" required /></Field>
            <Field label={`Cost price (${currency})`} hint="Used for stock value and margin reports." htmlFor="p-cost"><input id="p-cost" value={form.cost} onChange={set('cost')} className="input" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Sold by" htmlFor="p-unit">
              <div className="flex gap-2"><select id="p-unit" value={form.unit} onChange={set('unit')} className="select">{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-mist-muted"><input type="checkbox" checked={form.isWeighed} onChange={set('isWeighed')} className="accent-accent" /> Weighed / measured</label></div>
            </Field>
            <Field label="Tax" htmlFor="p-tax">
              <div className="flex gap-2"><input id="p-tax" value={form.taxRateBp} onChange={set('taxRateBp')} className="input" inputMode="numeric" placeholder={`Default ${defaultBp / 100}%`} disabled={form.taxExempt} />
                <label className="flex items-center gap-2 whitespace-nowrap text-sm text-mist-muted"><input type="checkbox" checked={form.taxExempt} onChange={set('taxExempt')} className="accent-accent" /> Exempt</label></div>
              <p className="text-xs text-mist-dim">In basis points: 1500 = 15%.</p>
            </Field>
            <Field label="Supplier" htmlFor="p-sup"><select id="p-sup" value={form.supplierId} onChange={set('supplierId')} className="select"><option value="">None</option>{(suppliers.data ?? []).map((s) => <option key={s.Id} value={s.Id}>{s.Name}</option>)}</select></Field>
            <Field label="Status" htmlFor="p-status"><select id="p-status" value={form.status} onChange={set('status')} className="select"><option value="active">Active (on the tills)</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Notes" htmlFor="p-notes" className="sm:col-span-2"><textarea id="p-notes" value={form.notes} onChange={set('notes')} className="textarea" rows={2} /></Field>
          </section>

          <section className="card p-5">
            <h2 className="text-[15px] font-semibold text-mist">Inventory</h2>
            <label className="mt-2 flex items-center gap-2 text-sm text-mist-muted"><input type="checkbox" checked={form.trackInventory} onChange={set('trackInventory')} className="accent-accent" /> Track stock for this product</label>
            {form.trackInventory ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {isNew ? <Field label="Opening stock" htmlFor="p-stock"><input id="p-stock" value={form.stockQty} onChange={set('stockQty')} className="input" inputMode="decimal" placeholder="0" /></Field>
                  : <Field label="On hand"><div className="flex items-center gap-2"><span className="text-lg font-semibold tabular-nums text-mist">{Number(data?.StockQty ?? 0)} {form.unit !== 'each' ? form.unit : ''}</span><Link to={`/inventory?product=${id}`} className="text-xs text-accent hover:text-accent-600">Adjust</Link></div></Field>}
                <Field label="Low stock alert" hint={`Blank uses the store default (${settings.data?.low_stock_threshold ?? 5}).`} htmlFor="p-low"><input id="p-low" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} className="input" inputMode="decimal" /></Field>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className="card p-5">
            <h2 className="text-[15px] font-semibold text-mist">Image</h2>
            <p className="text-xs text-mist-muted">Shown on the till tile. Optional.</p>
            <div className="mt-3 flex flex-col items-start gap-3">
              {form.imageUrl ? <Img src={form.imageUrl} alt="" wrapClassName="h-32 w-32 rounded-xl border border-ink-700" className="h-32 w-32 object-cover" /> : <span className="grid h-32 w-32 place-items-center rounded-xl border border-dashed border-ink-600 text-mist-dim"><ScanLine className="h-6 w-6" /></span>}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setChoosing(true)} className="btn-ghost btn-sm">Choose…</button>
                <button type="button" onClick={() => setUploading(true)} className="btn-ghost btn-sm">Upload…</button>
                {form.imageUrl ? <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: '', imageFileId: '' }))} className="btn-ghost btn-sm">Remove</button> : null}
              </div>
            </div>
            <Field label="Tile colour" hint="Used when there is no image." htmlFor="p-color" className="mt-4">
              <div className="flex items-center gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(form.color) ? form.color : '#2563eb'} onChange={set('color')} className="h-9 w-12 cursor-pointer rounded border border-ink-600" /><input id="p-color" value={form.color} onChange={set('color')} className="input font-mono" placeholder="#2563eb" /></div>
            </Field>
          </section>
          {!isNew ? (
            <section className="card p-5">
              <h2 className="text-[15px] font-semibold text-mist">Danger zone</h2>
              <p className="mt-1 text-xs text-mist-muted">Products that have been sold are deactivated rather than deleted so receipts and reports stay intact.</p>
              <ConfirmButton onConfirm={remove} confirmLabel="Delete for real?" className="btn-danger mt-3">Delete product</ConfirmButton>
            </section>
          ) : null}
        </div>
      </div>

      <Modal open={!!extra} onClose={() => setExtra(null)} title="Add a barcode" size="sm" footer={<><button type="button" className="btn-ghost" onClick={() => setExtra(null)}>Cancel</button><button type="button" className="btn-primary" onClick={addExtra}>Add</button></>}>
        {extra ? (
          <div className="flex flex-col gap-3">
            <Field label="Barcode"><input value={extra.barcode} onChange={(e) => setExtra({ ...extra, barcode: e.target.value })} className="input font-mono" autoFocus /></Field>
            <BarcodeScanner active onScan={(code) => setExtra((x) => ({ ...x, barcode: code }))} compact />
            <Field label="Label" hint="e.g. Case of 6"><input value={extra.label} onChange={(e) => setExtra({ ...extra, label: e.target.value })} className="input" /></Field>
            <Field label="Units per scan"><input type="number" min="1" step="1" value={extra.packQty} onChange={(e) => setExtra({ ...extra, packQty: e.target.value })} className="input" /></Field>
          </div>
        ) : null}
      </Modal>
      <MediaPicker open={choosing} onClose={() => setChoosing(false)} preferFolder="pos/products" title={`Choose an image for ${form.name || 'the product'}`} onUploadInstead={() => setUploading(true)}
        onPick={(files) => { const f = files[0]; if (f?.url) setForm((x) => ({ ...x, imageUrl: f.url, imageFileId: f.id || '' })); }} />
      <ImageUploader open={uploading} onClose={() => setUploading(false)} path="pos/products" aspect={1} maxFiles={1} title={`Image for ${form.name || 'the product'}`}
        onUploaded={(done) => { const f = done[0]; if (f?.url) setForm((x) => ({ ...x, imageUrl: f.url, imageFileId: f.id || '' })); setUploading(false); }} />
      <LabelSheet open={!!labels} onClose={() => setLabels(null)} products={labels ?? []} defaultSize={settings.data?.label_size} />
      <p className="text-xs text-mist-dim">{data ? `Price ${fmtCents(data.PriceCents, currency)} · updated ${data.UpdatedAt}` : ''}</p>
    </form>
  );
};

export { ProductEdit };
