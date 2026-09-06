import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Table, Badge, PageHead, EmptyState, fmtDateShort } from '@/shared/ui/ui';
import { SkeletonTable } from '@/shared/ui/skeleton';
import { Dropdown } from '@/shared/ui/menus';
import { errorMessage } from '@/shared/lib/errors';
import { IconPages } from '@/admin/components/navConfig';
import { ArrowDown, ArrowUp } from 'lucide-react';

const Pages = () => {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.pages.list(), []);
  const rows = data ?? [];

  const move = (id, dir) => {
    const ids = rows.map((r) => r.Id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const previous = rows;
    setData(ids.map((x) => rows.find((r) => r.Id === x)));
    adminApi.pages.reorder(ids).then(setData).catch((err) => { setData(previous); toast.error(errorMessage(err)); });
  };
  const setStatus = (r, status) => adminApi.pages.update(r.Id, { status }).then(() => { toast.success(`${r.Title} ${status === 'published' ? 'published' : 'unpublished'}.`); reload(); }).catch((e) => toast.error(errorMessage(e)));
  const remove = (r) => adminApi.pages.remove(r.Id).then(() => { toast.success(`${r.Title} deleted.`); reload(); }).catch((e) => toast.error(errorMessage(e)));

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Pages" subtitle="Content pages on the storefront: about, shipping & returns, terms, privacy, FAQ and anything else you add. Written in Markdown.">
        <button onClick={reload} className="btn-ghost">Refresh</button>
        <Link to="/pages/new" className="btn-primary">New page</Link>
      </PageHead>
      <ErrorNote error={error} />
      {loading && !data ? (
        <SkeletonTable columns={5} rows={6} />
      ) : (
        <Table
          rowHref={(r) => `/pages/${r.Id}`}
          columns={[
            { key: 'Title', label: 'Page', mobile: 'title', render: (r) => <div className="leading-tight"><Link to={`/pages/${r.Id}`} className="font-medium text-mist hover:text-accent">{r.Title}</Link><p className="text-xs text-mist-dim"><span className="font-mono">/pages/{r.Slug}</span>{r.Summary ? ` · ${r.Summary}` : ''}</p></div> },
            { key: 'Status', label: 'Status', render: (r) => <Badge tone={r.Status === 'published' ? 'green' : 'amber'} dot>{r.Status}</Badge> },
            { key: 'placement', label: 'Shown in', mobile: 'meta', render: (r) => <span className="text-mist-muted">{[r.ShowInNav ? 'Navigation' : null, r.ShowInFooter ? 'Footer' : null].filter(Boolean).join(' + ') || 'Link only'}</span> },
            { key: 'BodyLength', label: 'Length', mobile: 'hide', align: 'right', render: (r) => <span className="tabular-nums text-mist-dim">{Math.round((r.BodyLength || 0) / 6)} words</span> },
            { key: 'UpdatedAt', label: 'Updated', mobile: 'hide', render: (r) => <span className="whitespace-nowrap text-mist-dim">{fmtDateShort(r.UpdatedAt)}</span> },
            {
              key: 'actions', label: '', mobile: 'actions',
              render: (r) => (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => move(r.Id, -1)} className="btn-ghost btn-sm" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(r.Id, 1)} className="btn-ghost btn-sm" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                  <Dropdown trigger={<button type="button" className="btn-ghost btn-sm" aria-label="Page actions">⋯</button>} items={[
                    { label: 'Edit', onSelect: () => window.location.assign(`/admin/pages/${r.Id}`) },
                    { label: 'View in store', onSelect: () => window.open(`/pages/${r.Slug}`, '_blank'), disabled: r.Status !== 'published' },
                    r.Status === 'published' ? { label: 'Unpublish', onSelect: () => setStatus(r, 'draft') } : { label: 'Publish', onSelect: () => setStatus(r, 'published') },
                    { separator: true },
                    { label: r.IsSystem ? 'Delete (system page)' : 'Delete', danger: true, disabled: !!r.IsSystem, onSelect: () => remove(r) },
                  ]} />
                </span>
              ),
            },
          ]}
          rows={rows}
          empty={<EmptyState icon={<IconPages className="h-5 w-5" />} title="No pages yet" text="Add an About page, delivery information or anything else customers should be able to read." action={<Link to="/pages/new" className="btn-primary">New page</Link>} />}
        />
      )}
    </div>
  );
};

export { Pages };
