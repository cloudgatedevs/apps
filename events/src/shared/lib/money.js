// Money helpers. The backend stores every amount as integer minor units (cents),
// matching the Cloudgate Wallet API. Format only at the edge.

const DEFAULT_CURRENCY = 'ZAR';
const LOCALE_BY_CURRENCY = { ZAR: 'en-ZA', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };

/** 34900 -> "R 349,00" (locale-aware for the currency). */
export function fmtCents(cents, currency = DEFAULT_CURRENCY) {
  const value = (Number(cents) || 0) / 100;
  const code = String(currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return value.toLocaleString(LOCALE_BY_CURRENCY[code] ?? undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

/** Price range for a product: "R 349,00" or "R 349,00 – R 399,00". */
export function fmtRange(fromCents, toCents, currency) {
  if (toCents == null || toCents === fromCents) return fmtCents(fromCents, currency);
  return `${fmtCents(fromCents, currency)} – ${fmtCents(toCents, currency)}`;
}

/** "349.00" (form input, major units) -> 34900. Returns null for blank/invalid. */
export function toCents(input) {
  if (input === '' || input === null || input === undefined) return null;
  const n = Number(String(input).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** 34900 -> "349.00" for form inputs. */
export function fromCents(cents) {
  if (cents === null || cents === undefined || cents === '') return '';
  return ((Number(cents) || 0) / 100).toFixed(2);
}

/** Percentage off for a compare-at price, or null. */
export function discountPct(priceCents, compareAtCents) {
  if (!compareAtCents || !priceCents || compareAtCents <= priceCents) return null;
  return Math.round((1 - priceCents / compareAtCents) * 100);
}
