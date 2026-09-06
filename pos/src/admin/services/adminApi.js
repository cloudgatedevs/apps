// Back office API — wrappers over the POS controller's admin actions.
//
// Every call is POST {gateway}/{env}/pos/admin-<area> with { op, ...params }. These actions
// require the gateway API key (signed by the client) AND an IdP bearer token whose user has
// the Admin role; the workflow rejects anything else (require_admin).
import { api } from '@/shared/services/api';

const call = (route, op, params = {}) => api.post(route, { op, ...params });
const items = (r) => r?.items ?? [];
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false));

export const adminApi = {
  dashboard: {
    stats: () => call('/admin-dashboard', 'stats'),
    byHour: () => call('/admin-dashboard', 'by-hour').then(items),
    byDay: (days = 30) => call('/admin-dashboard', 'by-day', { days }).then(items),
    top: (days = 30, take = 8) => call('/admin-dashboard', 'top', { days, take }).then(items),
    byTeller: (days = 30) => call('/admin-dashboard', 'by-teller', { days }).then(items),
    byCategory: (days = 30) => call('/admin-dashboard', 'by-category', { days }).then(items),
    byMethod: (days = 30) => call('/admin-dashboard', 'by-method', { days }).then(items),
    recent: (take = 10) => call('/admin-dashboard', 'recent', { take }).then(items),
    /** Can the tenant wallet take card payments in this environment? { ready, provider, status, reason, production } */
    walletStatus: () => call('/admin-dashboard', 'wallet-status'),
  },

  products: {
    list: ({ search, status, categoryId, supplierId, lowStock, sort, skip = 0, take = 50 } = {}) =>
      call('/admin-products', 'list', { skip, take, ...clean({ search, status, categoryId, supplierId, lowStock, sort }) }),
    get: (id) => call('/admin-products', 'get', { id }),
    create: (product) => call('/admin-products', 'create', product),
    update: (id, patch) => call('/admin-products', 'update', { id, ...patch }),
    setStatus: (id, status) => call('/admin-products', 'set-status', { id, status }),
    remove: (id) => call('/admin-products', 'delete', { id }),
    addBarcode: (id, { barcode, label, packQty }) => call('/admin-products', 'add-barcode', { id, barcode, label, packQty }),
    removeBarcode: (id, barcodeId) => call('/admin-products', 'remove-barcode', { id, barcodeId }),
    /** Which product (if any) already uses this barcode. */
    barcodeOwner: (barcode) => call('/admin-products', 'barcode-owner', { barcode }).then((r) => r?.owner ?? null),
    labels: (ids) => call('/admin-products', 'labels', { ids }).then(items),
    /** rows: [{ name, sku, barcode, price, cost, stock, category }] — upserts by barcode, then SKU, then name. */
    importRows: (rows) => call('/admin-products', 'import', { rows }),
    /** Every image file id / URL still referenced (products, logo, icon). */
    imageRefs: () => call('/admin-products', 'image-refs'),
  },

  categories: {
    list: () => call('/admin-categories', 'list').then(items),
    create: (c) => call('/admin-categories', 'create', c).then(items),
    update: (id, patch) => call('/admin-categories', 'update', { id, ...patch }).then(items),
    remove: (id) => call('/admin-categories', 'delete', { id }).then(items),
    reorder: (ids) => call('/admin-categories', 'reorder', { ids }).then(items),
  },

  suppliers: {
    list: () => call('/admin-suppliers', 'list').then(items),
    create: (s) => call('/admin-suppliers', 'create', s).then(items),
    update: (id, patch) => call('/admin-suppliers', 'update', { id, ...patch }).then(items),
    remove: (id) => call('/admin-suppliers', 'delete', { id }).then(items),
  },

  registers: {
    list: () => call('/admin-registers', 'list').then(items),
    create: (r) => call('/admin-registers', 'create', r).then(items),
    update: (id, patch) => call('/admin-registers', 'update', { id, ...patch }).then(items),
    remove: (id) => call('/admin-registers', 'delete', { id }).then(items),
  },

  inventory: {
    levels: ({ search, categoryId, lowStock, skip = 0, take = 100 } = {}) => call('/admin-inventory', 'levels', { skip, take, ...clean({ search, categoryId, lowStock }) }),
    movements: ({ productId, reason, skip = 0, take = 50 } = {}) => call('/admin-inventory', 'movements', { skip, take, ...clean({ productId, reason }) }),
    /** Either delta (+/-) or newQty. reason: adjust|count|receive|damage|void */
    adjust: ({ productId, delta, newQty, reason, note, reference }) => call('/admin-inventory', 'adjust', { productId, delta, newQty, reason, note, reference }),
    /** Goods received: items [{ productId, qty, unitCostCents }] */
    receive: ({ supplierId, reference, note, items: lines }) => call('/admin-inventory', 'receive', { supplierId, reference, note, items: lines }),
    receipts: ({ skip = 0, take = 50 } = {}) => call('/admin-inventory', 'receipts', { skip, take }),
    receipt: (id) => call('/admin-inventory', 'receipt', { id }),
    /** Stock take: items [{ productId, countedQty }] */
    count: ({ items: lines, reference, note }) => call('/admin-inventory', 'count', { items: lines, reference, note }),
  },

  sales: {
    list: ({ search, status, from, to, tellerUserId, registerId, shiftId, skip = 0, take = 50 } = {}) =>
      call('/admin-sales', 'list', { skip, take, ...clean({ search, status, from, to, tellerUserId, registerId, shiftId }) }),
    get: (id) => call('/admin-sales', 'get', { id }),
    byReference: (reference) => call('/admin-sales', 'get', { reference }),
    void: (id, reason) => call('/admin-sales', 'void', { id, reason }),
    /** items [{ saleItemId, qty }]; method cash|card (card goes back through the wallet payment). */
    refund: (id, { items: lines, reason, method = 'cash' }) => call('/admin-sales', 'refund', { id, items: lines, reason, method }),
  },

  shifts: {
    list: ({ status, registerId, from, to, skip = 0, take = 50 } = {}) => call('/admin-shifts', 'list', { skip, take, ...clean({ status, registerId, from, to }) }),
    get: (id) => call('/admin-shifts', 'get', { id }),
    forceClose: (id, { countedCents, note } = {}) => call('/admin-shifts', 'force-close', { id, countedCents, note }),
  },

  tellers: {
    list: () => call('/admin-tellers', 'list').then(items),
  },

  customers: {
    list: ({ search, skip = 0, take = 50 } = {}) => call('/admin-customers', 'list', { skip, take, ...clean({ search }) }),
    get: (id) => call('/admin-customers', 'get', { id }),
    create: (c) => call('/admin-customers', 'create', c),
    update: (id, patch) => call('/admin-customers', 'update', { id, ...patch }),
    remove: (id) => call('/admin-customers', 'delete', { id }),
  },

  reports: {
    summary: (range) => call('/admin-reports', 'summary', range).then(items),
    products: (range) => call('/admin-reports', 'products', range).then(items),
    categories: (range) => call('/admin-reports', 'categories', range).then(items),
    tellers: (range) => call('/admin-reports', 'tellers', range).then(items),
    methods: (range) => call('/admin-reports', 'methods', range).then(items),
    tax: (range) => call('/admin-reports', 'tax', range).then(items),
    zReports: (range) => call('/admin-reports', 'z-reports', range).then(items),
  },

  settings: {
    get: () => call('/admin-settings', 'get').then((r) => r?.values ?? {}),
    set: (values) => call('/admin-settings', 'set', { values }).then((r) => r?.values ?? {}),
    /** Sends a test message through the saved SMTP settings. Resolves to { sent, reason?, via? }. */
    sendTest: (to) => call('/admin-settings', 'send-test', { to }),
  },
};
