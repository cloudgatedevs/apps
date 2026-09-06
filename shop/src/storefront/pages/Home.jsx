import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { shopApi } from '@/storefront/services/shopApi';
import { useStore } from '@/storefront/store/StoreProvider';
import { useAsync } from '@/shared/ui/ui';
import { SkeletonCards, Skeleton } from '@/shared/ui/skeleton';
import { ProductCard } from '@/storefront/components/ProductCard';
import { errorMessage } from '@/shared/lib/errors';
import { fmtCents } from '@/shared/lib/money';
import { Lock, MessageCircle, Truck, Undo2 } from 'lucide-react';

const VALUES = [
  { icon: Lock, title: 'Secure payments', text: 'Cards are handled by Cloudgate Wallet on a hosted page. We never see your card.' },
  { icon: Truck, title: 'Fast, tracked delivery', text: 'Dispatched within 1–2 working days, with tracking sent by email.' },
  { icon: Undo2, title: 'Easy returns', text: 'Changed your mind? Get in touch within 14 days of delivery.' },
  { icon: MessageCircle, title: 'Real people', text: 'A person answers, usually the same day.' },
];

const IconArrow = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

const SectionHead = ({ eyebrow, title, to, cta = 'View all' }) => (
  <div className="flex items-end justify-between gap-6">
    <div>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="font-display mt-2 text-3xl tracking-tight text-zinc-900">{title}</h2>
    </div>
    {to ? <Link to={to} className="hidden items-center gap-1.5 text-sm text-zinc-600 transition hover:text-zinc-900 sm:inline-flex">{cta} <IconArrow className="h-4 w-4" /></Link> : null}
  </div>
);

const Newsletter = () => {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await shopApi.newsletter.subscribe(email.trim());
      setDone(true);
      toast.success('You are on the list. Welcome!');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="container-x">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-12 text-primary-fg sm:px-14 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary/40 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow text-primary-fg/70">Stay in the loop</p>
            <h2 className="font-display mt-3 text-3xl tracking-tight sm:text-4xl">New arrivals and members-only offers, first.</h2>
            <p className="mt-3 text-sm leading-6 text-primary-fg/70">One email a fortnight at most. Unsubscribe any time.</p>
          </div>
          {done ? (
            <p className="rounded-2xl bg-white/10 px-5 py-4 text-sm">Thanks, you are subscribed.</p>
          ) : (
            <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" className="input h-12 grow rounded-full border-white/20 bg-white/10 px-5 text-white placeholder:text-zinc-400 focus:border-white/40 focus:ring-white/10" />
              <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50">{busy ? 'Joining…' : 'Subscribe'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

const Home = () => {
  const { storeName, settings, categories, currency, freeShippingThresholdCents, pages } = useStore();
  const featured = useAsync(() => shopApi.featured(8), []);
  const latest = useAsync(() => shopApi.products({ sort: 'newest', take: 8 }), []);
  const top = categories.filter((c) => !c.ParentId);
  const heroProducts = (featured.data ?? []).filter((p) => p.ImageUrl).slice(0, 2);
  const about = (pages.nav ?? []).concat(pages.footer ?? []).find((p) => /about/i.test(p.Slug));

  return (
    <div className="flex flex-col gap-20 pb-14 sm:gap-28">
      {/* Hero */}
      <section className="container-x pt-8 sm:pt-12">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-2xl bg-zinc-50 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:px-14">
          <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-secondary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-fuchsia-200/40 blur-3xl" />
          <div className="relative flex flex-col gap-7">
            <p className="eyebrow">{storeName}</p>
            <h1 className="font-display max-w-2xl text-5xl leading-[1.02] tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">{settings.store_tagline || 'Considered essentials for everyday life.'}</h1>
            <p className="max-w-lg text-lg leading-8 text-zinc-500">{settings.store_description || 'Thoughtfully made pieces, priced honestly, delivered with care.'}{freeShippingThresholdCents ? ` Free shipping on orders over ${fmtCents(freeShippingThresholdCents, currency)}.` : ''}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary">Shop the collection</Link>
              {about ? <Link to={`/pages/${about.Slug}`} className="btn-ghost">Our story</Link> : top[0] ? <Link to={`/shop/${top[0].Slug}`} className="btn-ghost">{top[0].Name}</Link> : null}
            </div>
          </div>
          <div className="relative grid grid-cols-2 gap-4">
            {featured.loading ? (
              <><Skeleton className="aspect-[4/5] rounded-2xl" /><Skeleton className="mt-10 aspect-[4/5] rounded-2xl" /></>
            ) : heroProducts.length ? (
              heroProducts.map((p, i) => (
                <Link key={p.Id} to={`/p/${p.Slug}`} className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-100 ${i === 1 ? 'mt-10' : ''}`}>
                  <img src={p.ImageUrl} alt={p.Name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  <span className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-2xl bg-white/95 px-4 py-2.5 text-sm shadow-lg"><span className="truncate font-medium text-zinc-900">{p.Name}</span><span className="ml-3 shrink-0 tabular-nums text-zinc-600">{fmtCents(p.PriceFromCents ?? p.PriceCents, currency)}</span></span>
                </Link>
              ))
            ) : (
              <div className="col-span-2 aspect-[16/10] rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-100" />
            )}
          </div>
        </div>
      </section>

      {/* Categories */}
      {top.length ? (
        <section className="container-x flex flex-col gap-8">
          <SectionHead eyebrow="Browse" title="Shop by category" to="/shop" cta="All products" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {top.map((c) => (
              <Link key={c.Id} to={`/shop/${c.Slug}`} className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-zinc-100 p-5 sm:aspect-[5/6]">
                {c.ImageUrl || c.SampleImageUrl ? <img src={c.ImageUrl || c.SampleImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-gradient-to-br from-zinc-200 to-zinc-100" />}
                <span className="absolute inset-0 bg-gradient-to-t from-zinc-900/70 via-zinc-900/10 to-transparent" />
                <span className="font-display relative text-2xl text-white">{c.Name}</span>
                <span className="relative mt-1 inline-flex items-center gap-1 text-xs text-zinc-200">{c.ProductCount} product{c.ProductCount === 1 ? '' : 's'} <IconArrow className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Featured */}
      <section className="container-x flex flex-col gap-8">
        <SectionHead eyebrow="Editor’s picks" title="Featured this season" to="/shop" />
        {featured.error ? <p className="text-sm text-red-600">{errorMessage(featured.error)}</p> : featured.loading ? <SkeletonCards count={4} /> : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-7">{(featured.data ?? []).slice(0, 8).map((p, i) => <ProductCard key={p.Id} p={p} currency={currency} eager={i < 4} />)}</div>
        )}
      </section>

      {/* Values */}
      <section className="container-x">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary/10 text-secondary" aria-hidden="true"><v.icon className="h-5 w-5" strokeWidth={1.75} /></span>
              <p className="font-display text-lg text-zinc-900">{v.title}</p>
              <p className="text-sm leading-6 text-zinc-500">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <section className="container-x flex flex-col gap-8">
        <SectionHead eyebrow="Just landed" title="New arrivals" to="/shop?sort=newest" />
        {latest.loading ? <SkeletonCards count={4} /> : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-7">{(latest.data?.items ?? []).slice(0, 8).map((p) => <ProductCard key={p.Id} p={p} currency={currency} />)}</div>
        )}
      </section>

      <Newsletter />
    </div>
  );
};

export { Home };
