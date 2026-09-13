// Public storefront API — thin wrappers over the Shop controller's public actions.
//
// Convention: POST {gateway}/{env}/shop/<route> with { op, ...params }. Public
// actions are gateway-anonymous (no API key needed); the IdP bearer token is
// attached when the customer is signed in so carts/orders can follow them.
import { api } from '@/shared/services/api';

export const shopApi = {
  // --- catalog -------------------------------------------------------------
  /**
   * Everything the storefront shell needs, in ONE workflow call: public settings, the category
   * tree and the published pages for header/footer. With `home: true` the featured and newest
   * product grids ride along too, so the home page paints from a single round trip.
   * Every workflow call costs the same engine overhead regardless of how little it returns, so
   * folding these together is the cheapest way to make the first paint fast.
   */
  bootstrap: ({ home = false, take = 8 } = {}) => api.post('/catalog', { op: 'bootstrap', ...(home ? { home: true, take } : {}) }),
  settings: () => api.post('/catalog', { op: 'settings' }),
  categories: () => api.post('/catalog', { op: 'categories' }).then((r) => r?.items ?? []),
  featured: (take = 8) => api.post('/catalog', { op: 'featured', take }).then((r) => r?.items ?? []),
  /**
   * Paged product cards. `withBounds: true` adds `bounds: { minCents, maxCents }` — the price
   * range of the whole category, ignoring the other filters — to the same response (null when the
   * filter matched nothing), which spares the catalogue page a separate `priceBounds` call.
   */
  products: ({ category, search, sort, inStock, minCents, maxCents, skip = 0, take = 24, withBounds = false } = {}) =>
    api.post('/catalog', {
      op: 'products',
      skip,
      take,
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(sort ? { sort } : {}),
      ...(inStock ? { inStock: true } : {}),
      ...(minCents ? { minCents } : {}),
      ...(maxCents ? { maxCents } : {}),
      ...(withBounds ? { withBounds: true } : {}),
    }),
  /** Cheapest / dearest active product (optionally in a category) for the price filter. */
  priceBounds: (category) => api.post('/catalog', { op: 'bounds', ...(category ? { category } : {}) }),
  newsletter: {
    subscribe: (email) => api.post('/newsletter', { op: 'subscribe', email }),
  },
  pages: {
    nav: () => api.post('/pages', { op: 'nav' }),
    get: (slug) => api.post('/pages', { op: 'get', slug }),
  },
  contact: {
    send: (fields) => api.post('/contact', { op: 'send', ...fields }),
  },
  /** Is the store able to take card payments right now? Resolves to { ready, provider, reason }; null when unknown. */
  paymentsStatus: () => api.post('/payments', { op: 'status' }).catch(() => null),
  /** Product detail. `Related[]` (up to `related` cards from the same category) comes with it — no second call. */
  product: (slug, { related = 4 } = {}) => api.post('/catalog', { op: 'product', slug, related }),

  // --- cart (server-side, token in localStorage) ---------------------------
  cart: {
    get: (token) => api.post('/cart', { op: 'get', ...(token ? { token } : {}) }),
    add: (token, variantId, qty = 1) => api.post('/cart', { op: 'add', ...(token ? { token } : {}), variantId, qty }),
    update: (token, variantId, qty) => api.post('/cart', { op: 'update', token, variantId, qty }),
    remove: (token, variantId) => api.post('/cart', { op: 'remove', token, variantId }),
    clear: (token) => api.post('/cart', { op: 'clear', token }),
  },

  // --- signed-in customer ----------------------------------------------------
  account: {
    orders: ({ skip = 0, take = 20 } = {}) => api.post('/account', { op: 'orders', skip, take }),
    order: (reference) => api.post('/account', { op: 'order', reference }),
    me: () => api.post('/account', { op: 'me' }).then((r) => r?.customer ?? null),
  },

  // --- checkout & payment (Cloudgate Wallet hosted checkout) ---------------
  checkout: {
    /** Creates the order + wallet checkout session; returns { reference, paymentUrl, ... }. */
    start: (token, details) =>
      api.post('/checkout', { op: 'start', token, returnBase: window.location.origin, ...details }),
    /** Order + payment state; finalises the order when the wallet reports success. */
    status: (reference, token) => api.post('/payment-status', { reference, ...(token ? { token } : {}) }),
  },
};
