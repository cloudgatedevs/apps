import React, { useEffect, useState } from 'react';
import { call, money } from './api';
import { Button, ErrorBox } from './ui';

export function useQuote(ids, promo = '') {
  const key = JSON.stringify([ids, promo.trim().toUpperCase()]);
  const [result, setResult] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    if (!ids.length) return;
    const timer = setTimeout(() => {
      call('quote', { service_ids: ids, promo }).then(quote => {
        if (active) setResult({ key, quote });
      }).catch(error => { if (active) setResult({ key, error }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [key, revision]);
  const current = result?.key === key ? result : null;
  return { quote: current?.quote, error: current?.error, loading: !!ids.length && !current,
    refresh: () => { setResult(null); setRevision(n => n + 1); } };
}

export function PriceReview({ pricing, held }) {
  const quote = held || pricing.quote;
  if (!held && pricing.loading) return <p role="status" className="muted">Checking your price…</p>;
  if (!held && pricing.error) return <><ErrorBox error={pricing.error}/><Button type="button" secondary onClick={pricing.refresh}>Refresh price</Button></>;
  if (!quote) return null;
  return <div className="price-review" aria-label="Verified booking price" aria-live="polite">
    {!!quote.discount && <div className="summary-line"><span>Promotion savings</span><strong>−{money(quote.discount, quote.currency)}</strong></div>}
    <div className="summary-line"><span>Appointment total</span><strong>{money(quote.total, quote.currency)}</strong></div>
    <div className="summary-line"><span>Pay now to confirm</span><strong>{money(quote.due, quote.currency)}</strong></div>
    <div className="summary-line"><span>Balance at your visit</span><strong>{money(quote.total - quote.due, quote.currency)}</strong></div>
  </div>;
}
