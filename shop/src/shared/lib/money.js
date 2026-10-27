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

/** Major units -> integer cents. Accept decimal dots/commas; never discard unknown characters. */
export function toCents(input) {
  if (input === null || input === undefined) return null;
  let value = String(input).trim();
  // Mixed separators are unambiguous only with correctly grouped thousands and decimal cents.
  if (/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(value)) value = value.replaceAll(',', '');
  else if (/^-?\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(value)) value = value.replaceAll('.', '').replace(',', '.');
  else if (/^-?(?:\d+|\d{1,3}(?:[ \u00a0\u202f]\d{3})+)(?:[.,]\d{1,2})?$/.test(value))
    value = value.replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
  else return null;
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return cents === 0 ? 0 : negative ? -cents : cents;
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
