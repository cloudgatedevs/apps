// "Verified Cloudgate merchant" proof. Links to the public verification page on the Cloudgate hub
// for this tenant: /verify/{tenancy} in production, /verify/{tenancy}/sandbox for the test store,
// so shoppers can confirm who is taking their payment before they pay.
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { apiEnv } from '@/shared/services/api';
import { cloudgate } from '@/platform';

const HUB = String(import.meta.env.VITE_IDP_BASE_URL ?? '').trim().replace(/\/$/, '');
export const isSandbox = apiEnv !== 'prod';
export const verifyUrl = () => `${HUB}/verify/${encodeURIComponent(cloudgate.auth.tenancyName || '')}${isSandbox ? '/sandbox' : ''}`;

/** Card variant for the footer: icon and title on one row, copy underneath at full width. */
const VerifiedBadge = ({ className = '' }) => (
  <a href={verifyUrl()} target="_blank" rel="noreferrer" className={`group block rounded-2xl border border-ink-700 bg-ink-850 p-4 transition hover:border-mist ${className}`}>
    <span className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary"><ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" /></span>
      <span className="text-sm font-semibold text-mist">Verified Cloudgate merchant</span>
      {isSandbox ? <span className="badge ml-auto bg-amber-100 text-amber-800">Sandbox</span> : null}
    </span>
    <span className="mt-2.5 block text-xs leading-5 text-mist-dim">Payments are processed by Cloudgate Wallet on a hosted page. Your card details never touch this site.</span>
    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-secondary group-hover:underline">View verification <ExternalLink className="h-3 w-3" aria-hidden="true" /></span>
  </a>
);

/** One-line variant for checkout and product pages. */
const VerifiedLink = ({ className = '' }) => (
  <a href={verifyUrl()} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline ${className}`}>
    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Verified Cloudgate merchant{isSandbox ? ' (sandbox)' : ''} <ExternalLink className="h-3 w-3" aria-hidden="true" />
  </a>
);

export { VerifiedBadge, VerifiedLink };
