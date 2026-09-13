import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '@/storefront/services/shopApi';
import { useStore } from '@/storefront/store/StoreProvider';
import { useCart } from '@/storefront/cart/CartProvider';
import { useAsync } from '@/shared/ui/ui';
import { Skeleton, SkeletonText } from '@/shared/ui/skeleton';
import { Modal } from '@/shared/ui/forms';
import { Placeholder, ProductCard } from '@/storefront/components/ProductCard';
import { QtyStepper } from '@/storefront/components/QtyStepper';
import { fmtCents, discountPct } from '@/shared/lib/money';
import { errorMessage } from '@/shared/lib/errors';
import { Lock, Truck, Undo2, X } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';
import { VerifiedLink } from '@/storefront/components/VerifiedBadge';

// Option values that read as colours render as swatches instead of text chips.
const COLOURS = {
  black: '#18181b', white: '#ffffff', grey: '#9ca3af', gray: '#9ca3af', charcoal: '#374151', navy: '#1e3a8a', blue: '#2563eb', 'sky blue': '#38bdf8',
  red: '#dc2626', burgundy: '#7f1d1d', pink: '#ec4899', rose: '#f43f5e', orange: '#f97316', yellow: '#facc15', mustard: '#ca8a04',
  green: '#16a34a', olive: '#4d7c0f', forest: '#14532d', mint: '#6ee7b7', teal: '#0d9488', purple: '#7c3aed', lilac: '#c4b5fd',
  brown: '#78350f', tan: '#d2b48c', beige: '#e7dcc8', cream: '#fdf6e3', sand: '#e0c9a6', khaki: '#bdb76b', natural: '#efe6d6', silver: '#c0c0c0', gold: '#d4af37',
};
const colourOf = (optName, value) => (/colou?r|shade|finish/i.test(optName) ? COLOURS[String(value).trim().toLowerCase()] ?? null : null);

/** Main image with hover zoom (desktop) and a tap-to-open lightbox. */
const Gallery = ({ images, index, onIndex, name, badge }) => {
  const [zoom, setZoom] = useState(null); // { x%, y% }
  const [lightbox, setLightbox] = useState(false);
  const wrap = useRef(null);
  const img = images[index];
  const move = (e) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const step = (d) => onIndex((index + d + images.length) % images.length);
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, index]);

  return (
    <div className="flex flex-col gap-3">
      <div ref={wrap} onMouseMove={move} onMouseLeave={() => setZoom(null)} onClick={() => img && setLightbox(true)} role={img ? 'button' : undefined} tabIndex={img ? 0 : undefined} onKeyDown={(e) => { if (e.key === 'Enter' && img) setLightbox(true); }} aria-label="Open image" className={`relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 ${img ? 'cursor-zoom-in' : ''}`}>
        {img ? (
          <img key={img.Id} src={img.Url} alt={img.Alt || name} className="ui-page h-full w-full object-cover transition-transform duration-200" style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
        ) : <Placeholder />}
        {badge ? <span className="badge absolute left-3 top-3 bg-primary text-primary-fg shadow">{badge}</span> : null}
        {images.length > 1 ? (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous image" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-800 shadow transition hover:bg-white">‹</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next image" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-800 shadow transition hover:bg-white">›</button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((im, i) => (
            <button key={im.Id} type="button" onClick={() => onIndex(i)} aria-label={`Image ${i + 1}`} aria-current={i === index} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${i === index ? 'border-zinc-900' : 'border-transparent hover:border-zinc-300'}`}>
              <img src={im.ThumbUrl || im.Url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <Modal open={lightbox} onClose={() => setLightbox(false)} title={name} size="xl" hideHeader className="bg-zinc-950 text-white sm:rounded-2xl">
        <div className="relative flex h-[80dvh] items-center justify-center">
          {img ? <img key={img.Id} src={img.Url} alt={img.Alt || name} className="ui-page max-h-full max-w-full object-contain" /> : null}
          <button type="button" onClick={() => setLightbox(false)} aria-label="Close" className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X className="h-5 w-5" aria-hidden="true" /></button>
          {images.length > 1 ? (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous image" className="absolute left-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">‹</button>
              <button type="button" onClick={() => step(1)} aria-label="Next image" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20">›</button>
              <p className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-zinc-400">{index + 1} / {images.length}</p>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

const PageSkeleton = () => (
  <div className="container-x py-8">
    <Skeleton className="mb-6 h-3 w-48 rounded" />
    <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
      <div className="flex flex-col gap-3"><Skeleton className="aspect-square w-full rounded-2xl" /><div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-16 rounded-xl" />)}</div></div>
      <div className="flex flex-col gap-5"><Skeleton className="h-3 w-24 rounded" /><Skeleton className="h-9 w-3/4 rounded" /><Skeleton className="h-7 w-1/3 rounded" /><SkeletonText lines={3} /><div className="flex gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-14 rounded-full" />)}</div><div className="flex gap-3"><Skeleton className="h-11 w-32 rounded-xl" /><Skeleton className="h-11 grow rounded-xl" /></div></div>
    </div>
  </div>
);

const Product = () => {
  const { slug } = useParams();
  const { currency } = useStore();
  const { add, busy } = useCart();
  // One workflow call: the detail row carries `Related[]` (same category), so there is no
  // second, dependent request for the "You may also like" strip.
  const res = useAsync(() => shopApi.product(slug, { related: 4 }), [slug]);
  const p = res.data;
  const related = (p?.Related ?? []).filter((r) => r.Id !== p.Id).slice(0, 4);

  const [choice, setChoice] = useState({});
  const [qty, setQty] = useState(1);
  const [imageIdx, setImageIdx] = useState(0);
  const [added, setAdded] = useState(false);
  const buyRef = useRef(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    if (!p) return;
    const def = (p.Variants ?? []).find((v) => v.IsDefault) ?? p.Variants?.[0];
    setChoice(def?.Options ?? {});
    setQty(1);
    setImageIdx(0);
    document.title = `${p.Name} · ${document.title.split(' · ').pop()}`;
  }, [p]);

  // Sticky buy bar on phones once the main button scrolls out of view.
  useEffect(() => {
    if (!buyRef.current) return undefined;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0 });
    io.observe(buyRef.current);
    return () => io.disconnect();
  }, [p]);

  const variant = useMemo(() => {
    if (!p) return null;
    const vs = p.Variants ?? [];
    if (!p.Options?.length) return vs[0] ?? null;
    return vs.find((v) => Object.entries(choice).every(([k, val]) => v.Options?.[k] === val)) ?? null;
  }, [p, choice]);

  const availableFor = (optName, value) =>
    (p?.Variants ?? []).some((v) => v.Options?.[optName] === value && Object.entries(choice).every(([k, val]) => k === optName || v.Options?.[k] === val) && v.AvailableQty > 0);

  if (res.loading) return <PageSkeleton />;
  if (res.error) return <div className="container-x py-16 text-center"><p className="text-lg font-medium">We couldn’t find that product.</p><p className="mt-1 text-sm text-zinc-500">{errorMessage(res.error)}</p><Link to="/shop" className="btn-ghost mt-6"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to the shop</span></Link></div>;
  if (!p) return null;

  const images = p.Images ?? [];
  const variantImage = variant?.ImageId ? images.findIndex((i) => i.Id === variant.ImageId) : -1;
  const shownIdx = variantImage >= 0 && imageIdx === 0 ? variantImage : imageIdx;
  const price = variant?.PriceCents ?? p.PriceCents;
  const compare = variant?.CompareAtCents ?? p.CompareAtCents;
  const pct = discountPct(price, compare);
  const available = variant ? (p.TrackInventory ? variant.AvailableQty : Infinity) : 0;
  const canBuy = !!variant && available > 0;
  const buyLabel = !variant ? 'Choose options' : canBuy ? (added ? 'Added' : 'Add to cart') : 'Sold out';

  const addToCart = async () => {
    if (!canBuy || busy) return;
    try {
      await add({
        variantId: variant.Id, productId: p.Id, slug: p.Slug, title: p.Name, variantTitle: variant.Title, sku: variant.Sku,
        unitPriceCents: price, imageUrl: images[shownIdx]?.ThumbUrl || images[0]?.ThumbUrl || images[0]?.Url || null,
        availableQty: p.TrackInventory ? variant.AvailableQty : undefined,
      }, qty, { openDrawer: false });
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } catch {
      /* the provider already surfaced the error */
    }
  };

  return (
    <div className="container-x flex flex-col gap-10 py-8">
      <Breadcrumb items={[['Shop', '/shop'], ...(p.CategorySlug ? [[p.CategoryName || p.CategorySlug, `/shop/${p.CategorySlug}`]] : []), [p.Name]]} />

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <Gallery images={images} index={shownIdx} onIndex={setImageIdx} name={p.Name} badge={pct ? `−${pct}%` : null} />

        <div className="flex flex-col gap-5">
          {p.Brand ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{p.Brand}</p> : null}
          <h1 className="font-display text-4xl tracking-tight text-zinc-900">{p.Name}</h1>
          <p className="text-2xl tabular-nums text-zinc-900">
            {fmtCents(price, currency)}
            {compare > price ? <s className="ml-3 text-base text-zinc-400">{fmtCents(compare, currency)}</s> : null}
            {pct ? <span className="ml-3 rounded-md bg-emerald-50 px-2 py-0.5 align-middle text-xs font-semibold text-emerald-700">Save {pct}%</span> : null}
          </p>
          {p.ShortDescription ? <p className="text-zinc-600">{p.ShortDescription}</p> : null}

          {(p.Options ?? []).map((o) => (
            <div key={o.Id} className="flex flex-col gap-2">
              <span className="label">{o.Name}: <span className="normal-case tracking-normal text-zinc-900">{choice[o.Name]}</span></span>
              <div className="flex flex-wrap gap-2">
                {(o.Values ?? []).map((v) => {
                  const selected = choice[o.Name] === v.Value;
                  const ok = availableFor(o.Name, v.Value);
                  const colour = colourOf(o.Name, v.Value);
                  if (colour) {
                    return (
                      <button key={v.Id} type="button" onClick={() => setChoice((c) => ({ ...c, [o.Name]: v.Value }))} title={v.Value} aria-label={v.Value} aria-pressed={selected}
                        className={`relative grid h-9 w-9 place-items-center rounded-full border-2 transition ${selected ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-400'} ${!ok ? 'opacity-40' : ''}`}>
                        <span className="h-6 w-6 rounded-full ring-1 ring-inset ring-black/10" style={{ background: colour }} />
                        {!ok ? <span className="absolute h-px w-8 rotate-45 bg-zinc-500" /> : null}
                      </button>
                    );
                  }
                  return (
                    <button key={v.Id} type="button" onClick={() => setChoice((c) => ({ ...c, [o.Name]: v.Value }))} className={`chip ${selected ? 'chip-active' : ''} ${!ok ? 'line-through opacity-50' : ''}`} aria-pressed={selected}>
                      {v.Value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div ref={buyRef} className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-3">
              <QtyStepper value={qty} max={Number.isFinite(available) ? Math.max(1, available) : Infinity} onChange={setQty} size="lg" />
              <button type="button" onClick={addToCart} disabled={!canBuy || busy} className={`btn-primary h-11 grow transition ${added ? 'bg-emerald-600 hover:bg-emerald-600' : ''}`}>{busy ? 'Adding…' : buyLabel}</button>
            </div>
            <p className="text-xs text-zinc-500">
              {variant?.Sku ? <span className="font-mono">{variant.Sku} · </span> : null}
              {!variant ? 'Select a combination.' : !p.TrackInventory ? 'In stock.' : available <= 0 ? 'Currently unavailable.' : available <= 5 ? `Only ${available} left.` : 'In stock.'}
            </p>
          </div>

          <ul className="grid grid-cols-3 gap-2 text-center text-xs text-zinc-600">
            <li className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 px-2 py-2.5"><Lock className="h-4 w-4 text-secondary" aria-hidden="true" />Secure checkout</li>
            <li className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 px-2 py-2.5"><Truck className="h-4 w-4 text-secondary" aria-hidden="true" />Tracked delivery</li>
            <li className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-200 px-2 py-2.5"><Undo2 className="h-4 w-4 text-secondary" aria-hidden="true" />14-day returns</li>
          </ul>
          <VerifiedLink className="self-start" />

          {p.Description ? <div className="prose prose-zinc max-w-none border-t border-zinc-200 pt-5 text-sm leading-relaxed text-zinc-700 whitespace-pre-line">{p.Description}</div> : null}
        </div>
      </div>

      {related.length ? (
        <section className="flex flex-col gap-5 border-t border-zinc-200 pt-10">
          <div className="flex items-end justify-between"><h2 className="text-lg font-semibold">You may also like</h2><Link to={`/shop/${p.CategorySlug}`} className="text-sm text-zinc-600 hover:text-zinc-900">More in {p.CategoryName} →</Link></div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{related.map((r) => <ProductCard key={r.Id} p={r} currency={currency} />)}</div>
        </section>
      ) : null}

      {/* Sticky buy bar on phones */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur transition-transform duration-200 md:hidden ${showBar ? 'translate-y-0' : 'translate-y-full'}`} style={{ paddingBottom: 'calc(0.75rem + var(--safe-bottom))' }}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 grow"><p className="truncate text-sm font-medium text-zinc-900">{p.Name}</p><p className="text-sm tabular-nums text-zinc-600">{fmtCents(price, currency)}{variant?.Title && variant.Title !== 'Default' ? ` · ${variant.Title}` : ''}</p></div>
          <button type="button" onClick={addToCart} disabled={!canBuy || busy} className={`btn-primary h-11 ${added ? 'bg-emerald-600' : ''}`}>{buyLabel}</button>
        </div>
      </div>
    </div>
  );
};

export { Product };
