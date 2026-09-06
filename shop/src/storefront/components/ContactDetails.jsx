import { Link } from 'react-router-dom';
import { useStore } from '@/storefront/store/StoreProvider';

const SOCIAL_LABEL = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', tiktok: 'TikTok' };

/** Address, hours, phone, email and social links from Settings, as a card. Used on About-style pages. */
const ContactDetails = ({ className = '', title = 'Find us', compact = false }) => {
  const { settings, social, storeName } = useStore();
  const rows = [
    settings.contact_address ? ['Address', <span className="whitespace-pre-line">{settings.contact_address}</span>] : null,
    settings.contact_hours ? ['Hours', settings.contact_hours] : null,
    settings.contact_phone ? ['Phone', <a href={`tel:${settings.contact_phone}`} className="text-zinc-900 hover:text-secondary">{settings.contact_phone}</a>] : null,
    settings.support_email ? ['Email', <a href={`mailto:${settings.support_email}`} className="text-zinc-900 hover:text-secondary">{settings.support_email}</a>] : null,
  ].filter(Boolean);
  if (!rows.length && !Object.keys(social).length) return null;
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-zinc-50 ${compact ? 'p-5' : 'p-6 sm:p-8'} ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">{storeName}</p><h2 className={`font-display mt-1 text-zinc-900 ${compact ? 'text-xl' : 'text-2xl'}`}>{title}</h2></div>
        <Link to="/contact" className="btn-ghost btn-sm">Send a message</Link>
      </div>
      <dl className={`mt-6 grid gap-5 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {rows.map(([label, value]) => (
          <div key={label}><dt className="label mb-1">{label}</dt><dd className="text-sm leading-6 text-zinc-700">{value}</dd></div>
        ))}
      </dl>
      {Object.keys(social).length ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {Object.entries(social).map(([k, url]) => <a key={k} href={url} target="_blank" rel="noreferrer" className="chip text-xs">{SOCIAL_LABEL[k]}</a>)}
        </div>
      ) : null}
    </section>
  );
};

export { ContactDetails };
