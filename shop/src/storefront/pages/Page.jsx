import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shopApi } from '@/storefront/services/shopApi';
import { useStore } from '@/storefront/store/StoreProvider';
import { useAsync } from '@/shared/ui/ui';
import { Skeleton, SkeletonText } from '@/shared/ui/skeleton';
import { renderMarkdown } from '@/shared/lib/markdown';
import { errorMessage } from '@/shared/lib/errors';
import { ContactDetails } from '@/storefront/components/ContactDetails';
import { ChevronRight } from 'lucide-react';
import { Breadcrumb } from '@/storefront/components/Breadcrumb';

/** Editable content page: /pages/{slug}. Body is Markdown written in the back office. */
const Page = () => {
  const { slug } = useParams();
  const { storeName, pages } = useStore();
  const res = useAsync(() => shopApi.pages.get(slug), [slug]);
  const page = res.data;
  const html = useMemo(() => renderMarkdown(page?.BodyMarkdown), [page?.BodyMarkdown]);
  useEffect(() => { if (page?.Title) document.title = `${page.Title} · ${storeName}`; }, [page?.Title, storeName]);
  const others = (pages.footer ?? []).filter((p) => p.Slug !== slug).slice(0, 6);

  if (res.loading) {
    return (
      <div className="container-x py-10">
        <Skeleton className="h-3 w-24 rounded" /><Skeleton className="mt-4 h-12 w-1/2 rounded" /><Skeleton className="mt-3 h-4 w-1/3 rounded" />
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]"><SkeletonText lines={10} widths={[95, 90, 80, 60, 92, 85, 70, 40, 88, 55]} /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    );
  }
  if (res.error || !page) {
    return (
      <div className="container-x py-24 text-center">
        <p className="font-display text-3xl text-zinc-900">We couldn’t find that page.</p>
        <p className="mt-2 text-sm text-zinc-500">{errorMessage(res.error)}</p>
        <Link to="/" className="btn-ghost mt-8">Back to the shop</Link>
      </div>
    );
  }
  return (
    <article className="container-x py-10 sm:py-14">
      {/* Two columns from the top: header and article on the left, the rail beside the heading. */}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="min-w-0">
          <header className="max-w-4xl">
            <Breadcrumb items={[[page.Title]]} />
            <h1 className="font-display mt-4 text-4xl tracking-tight text-zinc-900 sm:text-6xl">{page.Title}</h1>
            {page.Summary ? <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-500 sm:text-xl">{page.Summary}</p> : null}
          </header>
          <div className="prose-page mt-10 max-w-3xl border-t border-zinc-200 pt-10" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
          {page.ShowContact ? <ContactDetails compact /> : null}
          {others.length ? (
            <nav className="rounded-2xl border border-zinc-200 p-5" aria-label="More information">
              <p className="eyebrow mb-3">More information</p>
              <ul className="flex flex-col">
                {others.map((p) => <li key={p.Slug}><Link to={`/pages/${p.Slug}`} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900">{p.Title}<ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden="true" /></Link></li>)}
                <li><Link to="/contact" className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900">Contact us<ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden="true" /></Link></li>
              </ul>
            </nav>
          ) : null}
          <div className="rounded-2xl bg-primary p-5 text-primary-fg">
            <p className="font-display text-lg">Ready to browse?</p>
            <p className="mt-1 text-sm text-primary-fg/70">Everything we make and curate, in one place.</p>
            <Link to="/shop" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary-fg px-5 py-3 text-sm font-semibold text-primary transition hover:opacity-90">Shop all products</Link>
          </div>
        </aside>
      </div>
    </article>
  );
};

export { Page };
