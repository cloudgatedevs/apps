import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { adminApi } from '@/admin/services/adminApi';
import { useAsync, ErrorNote, Badge, PageHead, Pager, SearchBar, EmptyState, fmtDate, fmtRelative } from '@/shared/ui/ui';
import { SkeletonLines } from '@/shared/ui/skeleton';
import { Modal } from '@/shared/ui/forms';
import { errorMessage } from '@/shared/lib/errors';
import { IconMessages } from '@/admin/components/navConfig';

const PAGE_SIZE = 50;
const TONE = { new: 'blue', read: 'gray', replied: 'green', archived: 'gray' };

const Messages = () => {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'open';
  const query = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 0) || 0;
  const [search, setSearch] = useState(query);
  const [open, setOpen] = useState(null);
  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const list = useAsync(() => adminApi.messages.list({ status: status === 'all' ? undefined : status, search: query || undefined, skip: page * PAGE_SIZE, take: PAGE_SIZE }), [status, query, page]);
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const view = async (m) => {
    setOpen(m);
    if (m.Status === 'new') {
      try { const fresh = await adminApi.messages.get(m.Id); setOpen(fresh); list.setData((d) => d && ({ ...d, items: d.items.map((r) => (r.Id === m.Id ? fresh : r)), newCount: Math.max(0, (d.newCount || 1) - 1) })); } catch { /* keep the list copy */ }
    }
  };
  const setStatus = async (m, next) => {
    try {
      const updated = await adminApi.messages.setStatus(m.Id, next);
      list.setData((d) => d && ({ ...d, items: d.items.map((r) => (r.Id === m.Id ? updated : r)) }));
      setOpen((o) => (o?.Id === m.Id ? updated : o));
      toast.success(`Marked ${next}.`);
    } catch (err) { toast.error(errorMessage(err)); }
  };
  const remove = async (m) => {
    try { await adminApi.messages.remove(m.Id); setOpen(null); toast.success('Message deleted.'); list.reload(); } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="Messages" subtitle={`Contact-form messages from customers.${list.data?.newCount ? ` ${list.data.newCount} new.` : ''}`}>
        <div className="flex rounded-lg border border-ink-600 bg-white p-0.5">
          {[['open', 'Open'], ['replied', 'Replied'], ['archived', 'Archived'], ['all', 'All']].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setParam({ status: v })} className={`rounded-md px-3 py-1 text-sm ${status === v ? 'bg-accent-soft text-accent-600' : 'text-mist-muted'}`} aria-pressed={status === v}>{label}</button>
          ))}
        </div>
        <button onClick={list.reload} className="btn-ghost">Refresh</button>
      </PageHead>
      <SearchBar value={search} onChange={(e) => setSearch(e.target.value)} onSubmit={(e) => { e.preventDefault(); setParam({ q: search.trim() }); }} onClear={query ? () => { setSearch(''); setParam({ q: '' }); } : undefined} placeholder="Search by name, email, subject, order or text…" />
      <ErrorNote error={list.error} />
      {list.loading ? (
        <div className="card px-4"><SkeletonLines count={5} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<IconMessages className="h-5 w-5" />} title={status === 'open' ? 'Inbox zero' : 'No messages here'} text="Messages sent through the storefront's contact page land here and are also emailed to the support address." />
      ) : (
        <>
          <ul className="card divide-y divide-ink-700/70">
            {rows.map((m) => (
              <li key={m.Id}>
                <button type="button" onClick={() => view(m)} className={`flex w-full items-start gap-4 px-4 py-3 text-left transition hover:bg-ink-900 ${m.Status === 'new' ? 'bg-accent-soft/40' : ''}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.Status === 'new' ? 'bg-accent' : 'bg-transparent'}`} />
                  <span className="min-w-0 grow">
                    <span className="flex flex-wrap items-center gap-2"><span className={`text-sm ${m.Status === 'new' ? 'font-semibold text-mist' : 'font-medium text-mist'}`}>{m.Name || m.Email}</span><span className="text-xs text-mist-dim">{m.Email}</span>{m.OrderReference ? <Link to={`/orders?q=${encodeURIComponent(m.OrderReference)}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-accent">{m.OrderReference}</Link> : null}</span>
                    <span className="block truncate text-sm text-mist">{m.Subject || '(no subject)'}</span>
                    <span className="block truncate text-xs text-mist-muted">{m.Message}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1"><span className="whitespace-nowrap text-xs text-mist-dim">{fmtRelative(m.CreatedAt)}</span><Badge tone={TONE[m.Status] ?? 'gray'}>{m.Status}</Badge></span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} pages={pages} total={total} from={total === 0 ? 0 : page * PAGE_SIZE + 1} to={Math.min(total, (page + 1) * PAGE_SIZE)} noun="messages" onPage={(p) => setParam({ page: p })} />
        </>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.Subject || '(no subject)'} description={open ? `${open.Name || open.Email} · ${fmtDate(open.CreatedAt)}` : ''} size="lg"
        footer={open ? (
          <>
            <button type="button" onClick={() => remove(open)} className="btn-danger btn-sm">Delete</button>
            <span className="grow" />
            {open.Status !== 'archived' ? <button type="button" onClick={() => setStatus(open, 'archived')} className="btn-ghost">Archive</button> : <button type="button" onClick={() => setStatus(open, 'read')} className="btn-ghost">Unarchive</button>}
            {open.Status !== 'replied' ? <button type="button" onClick={() => setStatus(open, 'replied')} className="btn-ghost">Mark replied</button> : null}
            <a href={`mailto:${open.Email}?subject=${encodeURIComponent(`Re: ${open.Subject || 'your message'}`)}`} className="btn-primary">Reply by email</a>
          </>
        ) : null}
      >
        {open ? (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><p className="label">From</p><p className="text-mist">{open.Name || '—'}</p><p className="break-all text-mist-muted">{open.Email}</p></div>
              <div><p className="label">Order</p><p className="text-mist">{open.OrderReference ? <Link to={`/orders?q=${encodeURIComponent(open.OrderReference)}`} className="font-mono text-accent">{open.OrderReference}</Link> : '—'}</p></div>
              <div><p className="label">Account</p><p className="text-mist">{open.IdpUserId ? `#${open.IdpUserId}` : 'Guest'}</p></div>
            </div>
            <div className="whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-900 p-4 leading-relaxed text-mist">{open.Message}</div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export { Messages };
