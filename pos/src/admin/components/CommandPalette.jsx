// Ctrl/Cmd+K command palette: jump to an order by reference, a product, or a customer, or to any
// section. Searches the three admin actions in parallel with a short debounce.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { adminApi } from '@/admin/services/adminApi';
import { NAV } from '@/admin/components/navConfig';
import { fmtCents } from '@/shared/lib/money';
import { ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-react';

const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);

export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
};

export const CommandPalette = ({ open, onOpenChange }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ orders: [], products: [], customers: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => { if (open) { setQ(''); setResults({ orders: [], products: [], customers: [] }); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults({ orders: [], products: [], customers: [] }); setLoading(false); return undefined; }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const [orders, products, customers] = await Promise.all([
        adminApi.sales.list({ search: term, take: 5 }).catch(() => null),
        adminApi.products.list({ search: term, take: 5 }).catch(() => null),
        adminApi.customers.list({ search: term, take: 5 }).catch(() => null),
      ]);
      if (id !== seq.current) return;
      setResults({ orders: orders?.items ?? [], products: products?.items ?? [], customers: customers?.items ?? [] });
      setLoading(false);
      setActive(0);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = NAV.filter((n) => !term || n.label.toLowerCase().includes(term)).map((n) => ({ kind: 'Go to', label: n.label, to: n.to, key: `nav-${n.to}` }));
    const orders = results.orders.map((o) => ({ kind: 'Sale', label: o.Reference, sub: `${o.TellerName || ''} · ${fmtCents(o.TotalCents, o.Currency)} · ${String(o.Status).replace('_', ' ')}`, to: `/sales/${o.Id}`, key: `o-${o.Id}` }));
    const products = results.products.map((p) => ({ kind: 'Product', label: p.Name, sub: [p.Sku, p.Barcode, p.Status].filter(Boolean).join(' · '), to: `/products/${p.Id}`, key: `p-${p.Id}` }));
    const customers = results.customers.map((c) => ({ kind: 'Customer', label: c.Name || c.Email, sub: [c.Email, c.Phone].filter(Boolean).join(' · '), to: `/customers/${c.Id}`, key: `c-${c.Id}` }));
    return [...orders, ...products, ...customers, ...(term.length < 2 ? pages : pages.slice(0, 3))];
  }, [q, results]);

  const go = (item) => { onOpenChange(false); navigate(item.to); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <Dialog.Content className="ui-dialog card fixed left-1/2 top-[12vh] z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden p-0 shadow-pop outline-none" onKeyDown={onKey}>
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Jump to an order, product, customer or page</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-ink-700 px-4">
            <IconSearch className="h-4 w-4 text-mist-dim" />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sales, products, customers…" className="h-12 grow bg-transparent text-sm text-mist outline-none placeholder:text-mist-dim" />
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <span className="kbd">esc</span>}
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
            {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-mist-dim">{q.trim().length < 2 ? 'Type to search.' : loading ? 'Searching…' : 'No matches.'}</li> : null}
            {items.map((it, i) => (
              <li key={it.key} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(it)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-accent-soft text-accent-600' : 'text-mist'}`}>
                  <span className={`w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] ${i === active ? 'text-accent' : 'text-mist-dim'}`}>{it.kind}</span>
                  <span className="min-w-0 grow"><span className="block truncate text-sm">{it.label}</span>{it.sub ? <span className={`block truncate text-xs ${i === active ? 'text-accent-600/80' : 'text-mist-dim'}`}>{it.sub}</span> : null}</span>
                  {i === active ? <span className="kbd"><CornerDownLeft className="h-3 w-3" aria-label="Enter" /></span> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 border-t border-ink-700 px-4 py-2 text-[11px] text-mist-dim"><span><span className="kbd"><ArrowUp className="h-3 w-3" aria-label="Up" /></span> <span className="kbd"><ArrowDown className="h-3 w-3" aria-label="Down" /></span> navigate</span><span><span className="kbd"><CornerDownLeft className="h-3 w-3" aria-label="Enter" /></span> open</span></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
