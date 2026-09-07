// Till session state shared by every screen: settings (currency, tax, receipt text, payment
// methods, theme), the categories, the teller's open shift, and the cart being rung up.
// The cart lives here so it survives switching between Register / Sales / Shift screens.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { posApi } from '@/pos/services/posApi';
import { useAuthContext } from '@/shared/auth';
import { errorMessage } from '@/shared/lib/errors';
import { ScreenLoader } from '@/shared/ui/ScreenLoader';
import { useLiveEvents } from '@/admin/services/live';

const TillContext = createContext(null);
export const useTill = () => useContext(TillContext);

const CART_KEY = 'pos.cart';

const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const fg = ([r, g, b]) => {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.4 ? [24, 24, 27] : [255, 255, 255];
};
const applyTheme = (primary, secondary) => {
  const root = document.documentElement.style;
  const set = (name, hex, fallback) => { const rgb = hexToRgb(hex) ?? fallback; root.setProperty(`--c-${name}`, rgb.join(' ')); root.setProperty(`--c-${name}-fg`, fg(rgb).join(' ')); };
  set('primary', primary, [15, 23, 42]);
  set('secondary', secondary, [37, 99, 235]);
};

/** Cart line: { key, productId, name, sku, barcode, unit, isWeighed, unitPriceCents, qty, discountCents, stockQty, trackInventory } */
const TillProvider = () => {
  const { currentUser, logout } = useAuthContext();
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [shift, setShift] = useState(undefined); // undefined = loading, null = none
  const [error, setError] = useState(null);
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { return {}; } });

  const reloadShift = useCallback(async () => {
    try { setShift(await posApi.shift.current()); } catch (err) { setShift(null); toast.error(errorMessage(err)); }
  }, []);
  // Shift totals (sales, takings, expected cash) change with every sale and refund, including
  // card payments confirmed by webhook: refetch on the live events so the Shift screen is current.
  useLiveEvents(useCallback(() => { void reloadShift(); }, [reloadShift]), ['sale.completed', 'sale.refunded', 'sale.voided']);

  useEffect(() => {
    let alive = true;
    Promise.all([posApi.catalog.settings(), posApi.catalog.categories(), posApi.shift.current()])
      .then(([s, c, sh]) => {
        if (!alive) return;
        setSettings(s);
        setCategories(c);
        setShift(sh);
        applyTheme(s.theme_primary, s.theme_secondary);
        if (s.store_name) document.title = `${s.store_name} · Till`;
      })
      .catch((err) => alive && setError(err));
    return () => { alive = false; };
  }, []);

  // ---- cart
  const lines = cart.lines ?? [];
  const persist = (next) => { setCart(next); try { localStorage.setItem(CART_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const update = (fn) => persist(fn({ lines: [], discountCents: 0, customer: null, note: '', heldSaleId: null, ...cart }));

  const addProduct = useCallback((p, qty = 1) => {
    update((c) => {
      const isWeighed = !!p.IsWeighed;
      const existing = !isWeighed ? c.lines.find((l) => l.productId === p.Id && !l.discountCents) : null;
      if (existing) return { ...c, lines: c.lines.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l)) };
      const line = {
        key: `${p.Id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId: p.Id, name: p.Name, sku: p.Sku, barcode: p.Barcode,
        unit: p.Unit || 'each', isWeighed, unitPriceCents: Number(p.PriceCents || 0), qty, discountCents: 0,
        stockQty: Number(p.StockQty ?? 0), trackInventory: !!p.TrackInventory, taxRateBp: p.TaxRateBp, taxExempt: !!p.TaxExempt,
      };
      return { ...c, lines: [...c.lines, line] };
    });
  }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = useCallback((key, patch) => update((c) => ({ ...c, lines: c.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })), [cart]); // eslint-disable-line react-hooks/exhaustive-deps
  const removeLine = useCallback((key) => update((c) => ({ ...c, lines: c.lines.filter((l) => l.key !== key) })), [cart]); // eslint-disable-line react-hooks/exhaustive-deps
  const setCartMeta = useCallback((patch) => update((c) => ({ ...c, ...patch })), [cart]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearCart = useCallback(() => persist({ lines: [], discountCents: 0, customer: null, note: '', heldSaleId: null }), []);
  const loadSale = useCallback((sale) => persist({
    lines: (sale.Items ?? []).map((i) => ({ key: `${i.ProductId}-${i.Id}`, productId: i.ProductId, name: i.Name, sku: i.Sku, barcode: i.Barcode, unit: i.Unit, isWeighed: i.Unit !== 'each', unitPriceCents: i.UnitPriceCents, qty: Number(i.Qty), discountCents: i.DiscountCents || 0, stockQty: 0, trackInventory: false, taxRateBp: i.TaxRateBp })),
    discountCents: sale.DiscountCents || 0,
    customer: sale.CustomerName || sale.CustomerEmail ? { id: sale.CustomerId, name: sale.CustomerName, email: sale.CustomerEmail } : null,
    note: sale.Note || '', heldSaleId: sale.Id,
  }), []);

  // Totals mirror the server's rules (tax-inclusive by default) so the display matches the receipt.
  const totals = useMemo(() => {
    const incl = String(settings?.prices_include_tax ?? '1') === '1';
    const defaultBp = Number(settings?.tax_rate_bp ?? 0);
    let subtotal = 0; let tax = 0;
    for (const l of lines) {
      const gross = Math.round(l.qty * l.unitPriceCents);
      const disc = Math.max(0, Math.min(gross, l.discountCents || 0));
      let total = gross - disc;
      const bp = l.taxExempt ? 0 : (l.taxRateBp ?? defaultBp) ?? 0;
      let t = 0;
      if (incl) t = bp ? total - Math.round(total / (1 + bp / 10000)) : 0;
      else { t = bp ? Math.round(total * bp / 10000) : 0; total += t; }
      subtotal += total; tax += t;
    }
    const discount = Math.max(0, Math.min(subtotal, cart.discountCents || 0));
    return { subtotal, tax, discount, total: Math.max(0, subtotal - discount), count: lines.reduce((s, l) => s + (l.isWeighed ? 1 : l.qty), 0) };
  }, [lines, cart.discountCents, settings]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <div className="card max-w-md p-6 text-center">
          <p className="font-semibold text-mist">The till could not load its settings.</p>
          <p className="mt-2 text-sm text-mist-muted">{errorMessage(error)}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">Try again</button>
            {/* A token from another environment (e.g. after switching API hosts) keeps failing
                on every retry; signing out clears it and starts a fresh login. */}
            <button type="button" onClick={() => logout(true)} className="btn-ghost">Sign out</button>
          </div>
        </div>
      </div>
    );
  }
  if (!settings || shift === undefined) return <ScreenLoader />;

  const value = {
    settings, categories, currency: settings.currency || 'ZAR', shift, setShift, reloadShift,
    teller: currentUser?.user, cart: { ...cart, lines }, totals, addProduct, setLine, removeLine, setCartMeta, clearCart, loadSale,
    cashEnabled: String(settings.payment_cash_enabled ?? '1') === '1', cardEnabled: String(settings.payment_card_enabled ?? '1') === '1',
    requireShift: String(settings.require_shift ?? '1') === '1',
  };
  return <TillContext.Provider value={value}><Outlet /></TillContext.Provider>;
};

export { TillProvider };
