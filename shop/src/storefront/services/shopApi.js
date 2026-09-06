// Public storefront API — thin wrappers over the Shop controller's public actions.
//
// Convention: POST {gateway}/{env}/shop/<route> with { op, ...params }. Public
// actions are gateway-anonymous (no API key needed); the IdP bearer token is
// attached when the customer is signed in so carts/orders can follow them.
import { api } from '@/shared/services/api';

export const shopApi = {
  // --- catalog -------------------------------------------------------------
  settings: () => api.post('/catalog', { op: 'settings' }),
  categories: () => api.post('/catalog', { op: 'categories' }).then((r) => r?.items ?? []),
  featured: (take = 8) => api.post('/catalog', { op: 'featured', take }).then((r) => r?.items ?? []),
  products: ({ category, search, sort, inStock, minCents, maxCents, skip = 0, take = 24 } = {}) =>
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
  product: (slug) => api.post('/catalog', { op: 'product', slug }),

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
