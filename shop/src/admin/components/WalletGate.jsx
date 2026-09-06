// Tells the store owner to activate their Cloudgate Wallet when the tenant cannot take payments yet.
// Shown as a dialog once per browser session on the dashboard, and as a persistent banner after that.
import { useEffect, useState } from 'react';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync } from '@/shared/ui/ui';
import { Modal, Notice } from '@/shared/ui/forms';
import { ExternalLink } from 'lucide-react';

const HUB_URL = String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim().replace(/\/$/, '');
const SESSION_KEY = 'admin.wallet.prompted';

export const walletUrl = () => (HUB_URL ? `${HUB_URL}/wallet` : '/wallet');

export const useWalletStatus = () => useAsync(() => adminApi.dashboard.walletStatus().catch(() => null), []);

const IconWallet = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" /><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" /><circle cx="16.5" cy="14.5" r="1.25" /></svg>;

const WalletGate = ({ status }) => {
  const [open, setOpen] = useState(false);
  const notReady = status && status.ready === false;

  useEffect(() => {
    if (!notReady) return;
    try {
      if (!sessionStorage.getItem(SESSION_KEY)) { setOpen(true); sessionStorage.setItem(SESSION_KEY, '1'); }
    } catch {
      setOpen(true);
    }
  }, [notReady]);

  if (!notReady) return null;
  const env = status.production ? 'production' : 'sandbox';
  const body = (
    <>
      <p className="text-sm text-mist-muted">{status.reason || 'The wallet cannot accept payments yet.'}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="label">Environment</dt><dd className="mt-0.5 capitalize text-mist">{env}</dd></div>
        <div><dt className="label">Provider</dt><dd className="mt-0.5 text-mist">{status.provider === 'None' ? '—' : status.provider}</dd></div>
        <div><dt className="label">Onboarding</dt><dd className="mt-0.5 text-mist">{status.status}</dd></div>
        <div><dt className="label">Charges</dt><dd className="mt-0.5 text-mist">{status.chargesEnabled ? 'Enabled' : 'Off'}</dd></div>
      </dl>
      <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-mist-muted">
        <li>Open <span className="font-medium text-mist">Wallet</span> in the Cloudgate hub and choose your payment provider (Stripe or Paystack).</li>
        <li>Complete the provider's onboarding: business details, bank account and identity checks.</li>
        <li>Come back here. The store starts taking card payments the moment charges are enabled.</li>
      </ol>
      <p className="mt-4 text-xs text-mist-dim">Until then customers can browse and fill their cart, but checkout tells them the store is not taking payments yet.</p>
    </>
  );
  return (
    <>
      <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-3">
        <span><strong>Payments are not active.</strong> {status.reason || 'Complete wallet onboarding to take card payments.'}</span>
        <span className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm">Details</button>
          <a href={walletUrl()} target="_blank" rel="noreferrer" className="btn-primary btn-sm">Activate wallet <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
        </span>
      </Notice>
      <Modal open={open} onClose={() => setOpen(false)} title="Activate your Cloudgate Wallet" description="Card payments run through the tenant wallet. It is not ready yet." size="md"
        footer={(
          <>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Remind me later</button>
            <a href={walletUrl()} target="_blank" rel="noreferrer" className="btn-primary">Open Wallet in Cloudgate <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
          </>
        )}
      >
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><IconWallet className="h-6 w-6" /></span>
          <div className="min-w-0">{body}</div>
        </div>
      </Modal>
    </>
  );
};

export { WalletGate };
