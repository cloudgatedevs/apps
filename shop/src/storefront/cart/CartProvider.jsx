import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { shopApi } from '@/storefront/services/shopApi';
import { errorMessage } from '@/shared/lib/errors';

// Server-side cart. The only client state is the cart token (localStorage) and the last
// response from the cart action; every mutation round-trips so prices and stock are always
// what the workflow says they are.
const TOKEN_KEY = 'shop.cart.token';
const EMPTY = { token: null, items: [], count: 0, subtotalCents: 0, currency: null, issues: [] };
const CartContext = createContext(null);

/** Fired on window whenever a line is added, so the header badge can bounce. */
export const CART_BUMP_EVENT = 'shop:cart-bump';

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};
const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const tokenRef = useRef(readToken());

  const apply = useCallback((next) => {
    const c = next && typeof next === 'object' ? next : EMPTY;
    tokenRef.current = c.token || tokenRef.current;
    if (c.token) writeToken(c.token);
    setCart({ ...EMPTY, ...c });
    return c;
  }, []);

  // Initial load: restore the cart behind the stored token (if any).
  useEffect(() => {
    let alive = true;
    const token = tokenRef.current;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    shopApi.cart
      .get(token)
      .then((c) => alive && apply(c))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [apply]);

  const run = useCallback(
    async (fn) => {
      setBusy(true);
      setError(null);
      try {
        return apply(await fn(tokenRef.current));
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [apply],
  );

  const add = useCallback(
    async (line, qty = 1, { openDrawer = true, notify = true } = {}) => {
      const next = await run((token) => shopApi.cart.add(token, line.variantId, qty));
      window.dispatchEvent(new CustomEvent(CART_BUMP_EVENT));
      const issue = (next?.issues ?? []).find((i) => i.variantId === line.variantId);
      if (notify) {
        if (issue) toast.warning(issue.message);
        else toast.success(`${line.title} added to your cart.`, { action: openDrawer ? undefined : { label: 'View cart', onClick: () => setOpen(true) } });
      }
      if (openDrawer) setOpen(true);
      return next;
    },
    [run],
  );
  const update = useCallback((variantId, qty) => run((token) => shopApi.cart.update(token, variantId, qty)), [run]);

  // Removing a line offers an undo for a few seconds; undo re-adds the same variant and quantity.
  const remove = useCallback(
    async (variantId) => {
      const line = cart.items.find((i) => i.variantId === variantId);
      const next = await run((token) => shopApi.cart.remove(token, variantId));
      if (line) {
        toast(`${line.title} removed.`, {
          action: { label: 'Undo', onClick: () => run((token) => shopApi.cart.add(token, variantId, line.qty)).catch(() => {}) },
          duration: 5000,
        });
      }
      return next;
    },
    [run, cart.items],
  );
  const clear = useCallback(() => run((token) => (token ? shopApi.cart.clear(token) : Promise.resolve(EMPTY))), [run]);
  const refresh = useCallback(() => run((token) => (token ? shopApi.cart.get(token) : Promise.resolve(EMPTY))), [run]);
  /** After checkout converts the cart: forget the token so the next visit starts clean. */
  const reset = useCallback(() => {
    tokenRef.current = null;
    writeToken(null);
    setCart(EMPTY);
  }, []);

  const value = useMemo(
    () => ({ ...cart, loading, busy, error, add, update, remove, clear, refresh, reset, open, setOpen, token: tokenRef.current }),
    [cart, loading, busy, error, add, update, remove, clear, refresh, reset, open],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
