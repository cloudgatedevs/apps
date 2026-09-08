// Back office API — wrappers over the Shop controller's admin actions.
//
// Every call is POST {gateway}/{env}/shop/admin-<area> with { op, ...params }.
// These actions require the gateway API key (signed by the client) AND an IdP
// bearer token whose user has the admin role; the workflow rejects anything else.
import { api } from '@/shared/services/api';
import { refundApi } from '@/shared/services/refunds';

const call = (route, op, params = {}) => api.post(route, { op, ...params });

export const adminApi = {
  dashboard: {
    stats: () => call('/admin-dashboard', 'stats'),
    recentOrders: (take = 10) => call('/admin-dashboard', 'recent-orders', { take }).then((r) => r?.items ?? []),
    salesByDay: (days = 30) => call('/admin-dashboard', 'sales-by-day', { days }).then((r) => r?.items ?? []),
    topProducts: (days = 30, take = 5) => call('/admin-dashboard', 'top-products', { days, take }).then((r) => r?.items ?? []),
    /** Can the tenant wallet take payments in this environment? { ready, provider, status, reason, production } */
    walletStatus: () => call('/admin-dashboard', 'wallet-status'),
  },

  products: {
    list: ({ search, status, categoryId, lowStock, sort, skip = 0, take = 50 } = {}) =>
      call('/admin-products', 'list', {
        skip,
        take,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(lowStock ? { lowStock: true } : {}),
        ...(sort ? { sort } : {}),
      }),
    get: (id) => call('/admin-products', 'get', { id }),
    create: (product) => call('/admin-products', 'create', product),
    update: (id, patch) => call('/admin-products', 'update', { id, ...patch }),
    setStatus: (id, status) => call('/admin-products', 'set-status', { id, status }),
    remove: (id) => call('/admin-products', 'delete', { id }),
    addImage: (productId, { url, thumbUrl, fileId, alt, variantId }) =>
      call('/admin-products', 'add-image', { productId, url, thumbUrl, fileId, alt, variantId }),
    removeImage: (productId, imageId) => call('/admin-products', 'remove-image', { productId, imageId }),
    reorderImages: (productId, imageIds) => call('/admin-products', 'reorder-images', { productId, imageIds }),
    /** Every image file id / URL the shop still references (products, categories, logo). */
    imageRefs: () => call('/admin-products', 'image-refs'),
  },

  categories: {
    list: () => call('/admin-categories', 'list').then((r) => r?.items ?? []),
    create: (category) => call('/admin-categories', 'create', category).then((r) => r?.items ?? []),
    update: (id, patch) => call('/admin-categories', 'update', { id, ...patch }).then((r) => r?.items ?? []),
    remove: (id) => call('/admin-categories', 'delete', { id }).then((r) => r?.items ?? []),
    reorder: (ids) => call('/admin-categories', 'reorder', { ids }).then((r) => r?.items ?? []),
  },

  inventory: {
    stock: ({ search, productId, lowStock, outOfStock, sort, skip = 0, take = 100 } = {}) =>
      call('/admin-inventory', 'stock', {
        skip,
        take,
        ...(search ? { search } : {}),
        ...(productId ? { productId } : {}),
        ...(lowStock ? { lowStock: true } : {}),
        ...(outOfStock ? { outOfStock: true } : {}),
        ...(sort ? { sort } : {}),
      }),
    lowStock: (take = 20) => call('/admin-inventory', 'low-stock', { take }).then((r) => r?.items ?? []),
    adjust: ({ variantId, delta, setTo, reason, note, reference }) =>
      call('/admin-inventory', 'adjust', { variantId, delta, setTo, reason, note, reference }),
    setThreshold: (variantId, lowStockThreshold) => call('/admin-inventory', 'set-threshold', { variantId, lowStockThreshold }),
    movements: ({ variantId, productId, reason, skip = 0, take = 50 } = {}) =>
      call('/admin-inventory', 'movements', {
        skip,
        take,
        ...(variantId ? { variantId } : {}),
        ...(productId ? { productId } : {}),
        ...(reason ? { reason } : {}),
      }),
  },

  orders: {
    list: ({ search, status, paymentStatus, fulfillmentStatus, skip = 0, take = 50 } = {}) =>
      call('/admin-orders', 'list', {
        skip,
        take,
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
      }),
    get: (id) => call('/admin-orders', 'get', { id }),
    /** Status change. For "shipped", carrier/tracking are stored on the timeline and go into the customer email. */
    setStatus: (id, status, { note, carrier, trackingNumber, trackingUrl, notifyCustomer = true } = {}) =>
      call('/admin-orders', 'set-status', { id, status, note, carrier, trackingNumber, trackingUrl, notifyCustomer }),
    addNote: (id, note) => call('/admin-orders', 'add-note', { id, note }),
    /** Full refund when amountCents is omitted; restock puts the sold units back with a ledger entry. */
    refund: (id, { amountCents, reason, restock } = {}) =>
      refundApi.submit(id, { amountCents, reason, restock: !!restock, method: 'card' }).then(async (r) => { const detail = await call('/admin-orders', 'get', { id }); refundApi.acknowledge(id, r.request?.RequestKey); return { ...detail, RefundResult: r.request }; }),
  },

  customers: {
    list: ({ search, kind, sort, skip = 0, take = 50 } = {}) =>
      call('/admin-customers', 'list', { skip, take, ...(search ? { search } : {}), ...(kind ? { kind } : {}), ...(sort ? { sort } : {}) }),
    get: (id) => call('/admin-customers', 'get', { id }),
  },

  pages: {
    list: () => call('/admin-pages', 'list').then((r) => r?.items ?? []),
    get: (id) => call('/admin-pages', 'get', { id }),
    create: (page) => call('/admin-pages', 'create', page),
    update: (id, patch) => call('/admin-pages', 'update', { id, ...patch }),
    remove: (id) => call('/admin-pages', 'delete', { id }),
    reorder: (ids) => call('/admin-pages', 'reorder', { ids }).then((r) => r?.items ?? []),
  },

  messages: {
    list: ({ status, search, skip = 0, take = 50 } = {}) => call('/admin-messages', 'list', { skip, take, ...(status ? { status } : {}), ...(search ? { search } : {}) }),
    get: (id) => call('/admin-messages', 'get', { id }),
    setStatus: (id, status) => call('/admin-messages', 'set-status', { id, status }),
    remove: (id) => call('/admin-messages', 'delete', { id }),
  },

  settings: {
    get: () => call('/admin-settings', 'get').then((r) => r?.values ?? {}),
    set: (values) => call('/admin-settings', 'set', { values }).then((r) => r?.values ?? {}),
    /** Sends a test message through the saved SMTP settings. Resolves to { sent, reason?, via? }. */
    // (settings keys are documented in cloudgate/workflows/admin-settings/plan.py)
    sendTest: (to) => call('/admin-settings', 'send-test', { to }),
  },
};
