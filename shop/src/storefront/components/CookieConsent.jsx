import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/storefront/store/StoreProvider';

const KEY = 'shop.cookie-consent';

/** Bottom notice shown once per browser; text and on/off live in Settings → Storefront. */
const CookieConsent = () => {
  const { settings, pages } = useStore();
  const [visible, setVisible] = useState(false);
  const enabled = settings.cookie_consent_enabled === '1';

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!localStorage.getItem(KEY)) setTimeout(() => setVisible(true), 600);
    } catch {
      setVisible(true);
    }
  }, [enabled]);

  const decide = (value) => {
    try { localStorage.setItem(KEY, JSON.stringify({ value, at: Date.now() })); } catch { /* storage unavailable */ }
    setVisible(false);
  };

  if (!enabled || !visible) return null;
  const privacy = (pages.footer ?? []).find((p) => /privacy/i.test(p.Slug));
  return (
    <div role="dialog" aria-label="Cookie notice" className="ui-page fixed inset-x-4 bottom-4 z-30 mx-auto max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-pop sm:inset-x-6" style={{ marginBottom: 'var(--safe-bottom)' }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <p className="grow text-sm leading-6 text-zinc-700">
          {settings.cookie_consent_text || 'We use cookies to keep your cart and understand how the store is used.'}
          {privacy ? <> <Link to={`/pages/${privacy.Slug}`} className="underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">Read our privacy policy</Link>.</> : null}
        </p>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => decide('essential')} className="btn-ghost btn-sm">Essential only</button>
          <button type="button" onClick={() => decide('all')} className="btn-primary btn-sm">Accept</button>
        </div>
      </div>
    </div>
  );
};

export { CookieConsent };
