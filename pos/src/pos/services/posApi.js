// Till API — wrappers over the POS controller's teller actions.
//
// Every call is POST {gateway}/{env}/pos/pos-<area> with { op, ...params }. The actions need the
// gateway API key (signed by the client) AND an IdP bearer token whose user has a teller role;
// prices, tax, stock and totals are always computed server-side.
import { api } from '@/shared/services/api';

const call = (route, op, params = {}) => api.post(route, { op, ...params });

export const posApi = {
  catalog: {
    /** Till settings (store name, currency, tax, receipt text, payment methods, theme). */
    settings: () => call('/pos-catalog', 'settings').then((r) => r?.values ?? {}),
    categories: () => call('/pos-catalog', 'categories').then((r) => r?.items ?? []),
    products: ({ categoryId, search, skip = 0, take = 200 } = {}) =>
      call('/pos-catalog', 'products', { skip, take, ...(categoryId ? { categoryId } : {}), ...(search ? { search } : {}) }).then((r) => r?.items ?? []),
    /** Barcode, alias barcode or SKU -> { found, product } */
    lookup: (code) => call('/pos-catalog', 'lookup', { code }),
  },

  shift: {
    registers: () => call('/pos-shift', 'registers').then((r) => r?.items ?? []),
    current: () => call('/pos-shift', 'current').then((r) => r?.shift ?? null),
    open: (registerId, floatCents) => call('/pos-shift', 'open', { registerId, floatCents }).then((r) => r?.shift ?? null),
    movement: (type, amountCents, note) => call('/pos-shift', 'movement', { type, amountCents, note }).then((r) => r?.shift ?? null),
    close: (countedCents, note) => call('/pos-shift', 'close', { countedCents, note }).then((r) => r?.shift ?? null),
  },

  sale: {
    /** Cash sale in one call: lines + payments -> completed sale (receipt). */
    complete: ({ lines, payments, discountCents, customer, note, heldSaleId }) =>
      call('/pos-sale', 'complete', { lines, payments, discountCents, ...customerFields(customer), note, heldSaleId }),
    /** Open sale (for a card payment). */
    create: ({ lines, discountCents, customer, note, heldSaleId }) =>
      call('/pos-sale', 'create', { lines, discountCents, ...customerFields(customer), note, heldSaleId }),
    hold: ({ lines, discountCents, customer, note, holdLabel, heldSaleId }) =>
      call('/pos-sale', 'hold', { lines, discountCents, ...customerFields(customer), note, holdLabel, heldSaleId }),
    held: () => call('/pos-sale', 'held').then((r) => r?.items ?? []),
    recall: (saleId) => call('/pos-sale', 'recall', { saleId }),
    discard: (saleId) => call('/pos-sale', 'discard', { saleId }),
    get: (saleId) => call('/pos-sale', 'get', { saleId }),
    byReference: (reference) => call('/pos-sale', 'get', { reference }),
    recent: ({ skip = 0, take = 20 } = {}) => call('/pos-sale', 'recent', { skip, take }).then((r) => ({ items: r?.items ?? [], total: Number(r?.total ?? (r?.items?.length ?? 0)) })),
    refundCash: (saleId, items, reason) => call('/pos-sale', 'refund', { saleId, items, method: 'cash', reason }),
  },

  payment: {
    /** Card: opens a Cloudgate Wallet checkout for the outstanding amount; the sale returns with PendingCardPayment.PaymentUrl. */
    start: (saleId) => call('/pos-payment', 'start', { saleId, returnBase: window.location.origin }),
    status: (saleId) => call('/pos-payment', 'status', { saleId }),
    cancel: (saleId) => call('/pos-payment', 'cancel', { saleId }),
    refundCard: (saleId, items, reason) => call('/pos-payment', 'refund', { saleId, items, reason }),
    walletStatus: () => call('/pos-payment', 'wallet-status'),
  },

  receipt: {
    email: (saleId, to) => call('/pos-receipt', 'email', { saleId, to }),
  },
};

function customerFields(c) {
  if (!c) return {};
  return { customerId: c.id ?? undefined, customerName: c.name ?? undefined, customerEmail: c.email ?? undefined };
}
