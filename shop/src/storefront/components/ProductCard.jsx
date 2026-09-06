import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtCents, fmtRange, discountPct } from '@/shared/lib/money';

const Placeholder = () => (
  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /><circle cx="16" cy="9" r="1.5" /></svg>
  </div>
);

const ProductCard = ({ p, currency, eager = false }) => {
  const [loaded, setLoaded] = useState(false);
  const from = p.PriceFromCents ?? p.PriceCents;
  const to = p.PriceToCents ?? p.PriceCents;
  const pct = discountPct(from, p.CompareAtCents);
  const soldOut = p.TrackInventory && (p.AvailableQty ?? 0) <= 0;
  const lowStock = p.TrackInventory && !soldOut && (p.AvailableQty ?? 0) <= 3;
  return (
    <Link to={`/p/${p.Slug}`} className="group flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-100">
        {p.ImageUrl ? (
          <img src={p.ImageUrl} alt={p.Name} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(true)} className={`img-fade h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] ${loaded ? 'is-loaded' : ''}`} />
        ) : <Placeholder />}
        {pct ? <span className="badge absolute left-3 top-3 bg-secondary text-secondary-fg shadow">−{pct}%</span> : null}
        {soldOut ? <span className="badge absolute right-3 top-3 bg-white/90 text-zinc-700 shadow">Sold out</span> : lowStock ? <span className="badge absolute right-3 top-3 bg-amber-100 text-amber-800 shadow">Only {p.AvailableQty} left</span> : null}
        <span className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-2 rounded-xl bg-white/95 py-2 text-center text-xs font-semibold text-zinc-900 opacity-0 shadow-lg transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">{soldOut ? 'View details' : 'View & add to cart'}</span>
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        {p.CategoryName ? <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{p.CategoryName}</p> : null}
        <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-secondary">{p.Name}</h3>
        <p className="text-sm tabular-nums text-zinc-900">
          {from !== to ? fmtRange(from, to, currency) : fmtCents(from, currency)}
          {p.CompareAtCents > from ? <s className="ml-2 text-zinc-400">{fmtCents(p.CompareAtCents, currency)}</s> : null}
        </p>
      </div>
    </Link>
  );
};

export { ProductCard, Placeholder };
