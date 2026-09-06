// Small shared UI primitives for the admin console (and a few reused by the storefront).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Tiny async-fetch hook: const { data, loading, error, reload, setData } = useAsync(fn, [deps]) */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return {
    ...state,
    reload: () => setTick((t) => t + 1),
    /** Replace the loaded data locally (optimistic updates) without a refetch. */
    setData: (next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })),
  };
}

/** Persisted UI preference (density, collapsed panels…). Falls back cleanly without storage. */
export function usePreference(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  const set = (next) => {
    setValue((v) => {
      const resolved = typeof next === 'function' ? next(v) : next;
      try { localStorage.setItem(key, JSON.stringify(resolved)); } catch { /* storage unavailable */ }
      return resolved;
    });
  };
  return [value, set];
}

export const Spinner = () => (
  <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  </div>
);

export const ErrorNote = ({ error }) =>
  error ? (
    <div role="alert" className="ui-page rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {String(error?.message ?? error)}
    </div>
  ) : null;

/**
 * Empty state with an optional call to action:
 * <EmptyState icon={<Icon/>} title="No products yet" text="…" action={<Link className="btn-primary">New product</Link>} />
 */
export const EmptyState = ({ icon, title, text, action, className = '', compact = false }) => (
  <div className={`card ui-page flex flex-col items-center justify-center gap-2 text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}>
    {icon ? <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</div> : null}
    <p className="text-[15px] font-semibold text-mist">{title}</p>
    {text ? <p className="max-w-md text-sm text-mist-muted">{text}</p> : null}
    {action ? <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
  </div>
);

/** Image that fades in when decoded, over a tinted placeholder; lazy by default. */
export const Img = ({ src, alt = '', className = '', wrapClassName = '', eager = false, ...rest }) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  if (!src) return null;
  return (
    <span className={`block overflow-hidden bg-ink-800 ${wrapClassName}`}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`img-fade ${loaded ? 'is-loaded' : ''} ${className}`}
        {...rest}
      />
    </span>
  );
};

export const StatCard = ({ label, value, sub, trend, children }) => (
  <div className="card min-w-0 p-4">
    <div className="flex items-start justify-between gap-2">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-mist-dim">{label}</p>
      {trend != null ? <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</span> : null}
    </div>
    <p className="mt-1.5 truncate text-[22px] font-semibold leading-tight tracking-tight text-mist tabular-nums">{value ?? '—'}</p>
    {sub ? <p className="mt-1 truncate text-xs text-mist-muted">{sub}</p> : null}
    {children}
  </div>
);

const badgeTones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  blue: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export const Badge = ({ tone = 'gray', children, dot = false }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${badgeTones[tone] ?? badgeTones.gray}`}>
    {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
    {children}
  </span>
);

const cellValue = (column, row) => (column.render ? column.render(row) : row[column.key] ?? '—');

const IconChevron = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSort = ({ dir, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {dir === 'asc' ? <path d="M12 19V5M6 11l6-6 6 6" /> : dir === 'desc' ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
  </svg>
);

/** Sort a page of rows client-side by a column key. Numbers, dates and strings all work. */
export const sortRows = (rows, sort) => {
  if (!sort?.key || !rows) return rows ?? [];
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
};

/**
 * Responsive data table.
 *
 * columns = [{ key, label, render?, mobile?, sortable?, align? }] where `mobile` tunes the narrow-screen
 * layout (each row becomes a card): 'title' | 'meta' | 'actions' | 'hide'.
 * `rowHref(row)` makes the whole mobile card tappable.
 * Sorting: pass `sort={{ key, dir }}` and `onSort(next)`; columns with `sortable: true` get a clickable header.
 * Selection: pass `selectable`, `selected` (Set of ids), `onToggle(id)`, `onToggleAll(ids)`.
 * Rows are dense by default; pass `density="comfortable"` for roomier rows.
 */
export const Table = ({ columns, rows, empty = 'Nothing here yet.', rowHref, sort, onSort, selectable = false, selected, onToggle, onToggleAll, density = 'compact', rowKey = (r) => r.Id ?? r.id }) => {
  const navigate = useNavigate();
  const titleCols = columns.filter((c) => c.mobile === 'title');
  const metaCols = columns.filter((c) => c.mobile === 'meta');
  const actionCols = columns.filter((c) => c.mobile === 'actions');
  const pairCols = columns.filter((c) => !c.mobile || !['title', 'meta', 'actions', 'hide'].includes(c.mobile));
  const cell = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5';
  const allIds = (rows ?? []).map(rowKey);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected?.has(id));
  const someSelected = selectable && allIds.some((id) => selected?.has(id));
  const toggleSort = (c) => {
    if (!c.sortable || !onSort) return;
    const next = sort?.key === c.key ? (sort.dir === 'asc' ? 'desc' : sort.dir === 'desc' ? null : 'asc') : 'asc';
    onSort(next ? { key: c.key, dir: next } : null);
  };
  const emptyNode = typeof empty === 'string' ? <div className="card px-4 py-10 text-center text-sm text-mist-dim">{empty}</div> : empty;

  return (
    <>
      {/* Mobile: one card per row — no sideways scrolling to read a record. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows?.length ? (
          rows.map((r, i) => {
            const href = rowHref?.(r) || null;
            const id = rowKey(r);
            return (
              <div
                key={id ?? i}
                {...(href
                  ? {
                      role: 'link',
                      tabIndex: 0,
                      onClick: () => navigate(href),
                      onKeyDown: (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(href);
                        }
                      },
                    }
                  : {})}
                className={`card flex flex-col gap-2.5 p-4 ${selected?.has(id) ? 'ring-2 ring-accent' : ''} ${
                  href ? 'cursor-pointer transition active:border-accent/40 active:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/70' : ''
                }`}
              >
                {titleCols.length > 0 && (
                  <div className="flex items-center gap-2 text-[15px] font-medium text-mist">
                    {selectable ? <input type="checkbox" checked={!!selected?.has(id)} onChange={() => onToggle?.(id)} onClick={(e) => e.stopPropagation()} className="accent-accent" aria-label="Select row" /> : null}
                    <div className="flex min-w-0 grow flex-wrap items-center gap-2">
                      {titleCols.map((c) => (
                        <div key={c.key} className="min-w-0">{cellValue(c, r)}</div>
                      ))}
                    </div>
                    {href && <IconChevron className="h-4 w-4 shrink-0 text-mist-dim" aria-hidden="true" />}
                  </div>
                )}
                {metaCols.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mist-muted">
                    {metaCols.map((c) => (
                      <div key={c.key} className="min-w-0">{cellValue(c, r)}</div>
                    ))}
                  </div>
                )}
                {pairCols.length > 0 && (
                  <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-2">
                    {pairCols.map((c) => (
                      <div key={c.key} className="contents">
                        <dt className="self-center text-[11px] font-semibold uppercase tracking-[0.1em] text-mist-dim">{c.label}</dt>
                        <dd className="min-w-0 self-center break-words text-sm text-mist-muted">{cellValue(c, r)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {actionCols.length > 0 && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-ink-700 pt-3">
                    {actionCols.map((c) => (
                      <div key={c.key}>{cellValue(c, r)}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          emptyNode
        )}
      </div>

      {/* Desktop: the full table, still scrollable if the columns are wide. */}
      {rows?.length || typeof empty === 'string' ? (
        <div className="card hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-ink-700 text-sm">
            <thead className="bg-ink-900">
              <tr className="border-b border-ink-700">
                {selectable ? (
                  <th className={`${cell} w-8 first:pl-4`}>
                    <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={() => onToggleAll?.(allSelected ? [] : allIds)} className="accent-accent" aria-label="Select all rows" />
                  </th>
                ) : null}
                {columns.map((c) => (
                  <th key={c.key} className={`whitespace-nowrap ${cell} text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-mist-dim first:pl-4 last:pr-4 ${c.align === 'right' ? 'text-right' : ''}`} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => toggleSort(c)} className={`inline-flex items-center gap-1 rounded hover:text-mist ${sort?.key === c.key ? 'text-mist' : ''}`}>
                        {c.label}
                        <IconSort dir={sort?.key === c.key ? sort.dir : null} className={`h-3 w-3 ${sort?.key === c.key ? 'text-accent' : 'opacity-40'}`} />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {rows?.length ? (
                rows.map((r, i) => {
                  const id = rowKey(r);
                  return (
                    <tr key={id ?? i} className={`transition-colors hover:bg-ink-900 ${selected?.has(id) ? 'bg-accent-soft/60' : ''}`}>
                      {selectable ? (
                        <td className={`${cell} w-8 first:pl-4`}>
                          <input type="checkbox" checked={!!selected?.has(id)} onChange={() => onToggle?.(id)} className="accent-accent" aria-label="Select row" />
                        </td>
                      ) : null}
                      {columns.map((c) => (
                        <td key={c.key} className={`${cell} align-middle text-mist-muted first:pl-4 last:pr-4 ${c.align === 'right' ? 'text-right' : ''}`}>
                          {cellValue(c, r)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-sm text-mist-dim">{empty}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="hidden md:block">{emptyNode}</div>
      )}
    </>
  );
};

/** Floating bar shown while rows are selected: <SelectionBar count={n} onClear={…}>{actions}</SelectionBar> */
export const SelectionBar = ({ count, onClear, children }) =>
  count > 0 ? (
    <div className="ui-page sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-ink-700 bg-white px-3 py-2 shadow-pop">
      <span className="px-1 text-sm font-medium text-mist">{count} selected</span>
      <span className="h-5 w-px bg-ink-700" />
      {children}
      <button type="button" onClick={onClear} className="btn-ghost btn-sm">Clear</button>
    </div>
  ) : null;

/**
 * Shared pagination control. Stacks the summary above the buttons on narrow
 * screens and drops the first/last jumps there to keep touch targets large.
 */
export const Pager = ({ page, pages, total, from, to, noun = 'rows', onPage, children }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-sm text-mist-muted">
      {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()} {noun}
      {children}
    </span>
    <div className="flex items-center justify-between gap-1.5 sm:justify-end">
      <button onClick={() => onPage(0)} disabled={page === 0} aria-label="First page" className="btn-ghost hidden px-2.5 py-1.5 disabled:opacity-40 sm:block">«</button>
      <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} className="btn-ghost px-3 py-2 disabled:opacity-40 sm:px-2.5 sm:py-1.5">‹ Prev</button>
      <span className="px-2 text-sm tabular-nums text-mist-muted">{page + 1} / {pages}</span>
      <button onClick={() => onPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1} className="btn-ghost px-3 py-2 disabled:opacity-40 sm:px-2.5 sm:py-1.5">Next ›</button>
      <button onClick={() => onPage(pages - 1)} disabled={page >= pages - 1} aria-label="Last page" className="btn-ghost hidden px-2.5 py-1.5 disabled:opacity-40 sm:block">»</button>
    </div>
  </div>
);

/**
 * Search field + submit/clear buttons that stay usable at 360px: the input
 * takes the full width and the buttons sit beneath it on one row.
 */
export const SearchBar = ({ value, onChange, onSubmit, onClear, placeholder, mono = false, children }) => (
  <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
    <input value={value} onChange={onChange} placeholder={placeholder} className={`input w-full sm:max-w-md ${mono ? 'font-mono' : ''}`} aria-label={placeholder} />
    <div className="flex items-center gap-2">
      <button className="btn-primary grow sm:grow-0">Search</button>
      {onClear ? (
        <button type="button" onClick={onClear} className="btn-ghost grow sm:grow-0">
          Clear
        </button>
      ) : null}
      {children}
    </div>
  </form>
);

/**
 * Page heading with optional actions on the right. The mobile top bar already
 * shows the page name, so the big title is desktop-only.
 */
export const PageHead = ({ title, subtitle, children }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
    <div className="min-w-0">
      <h1 className="hidden text-xl font-semibold tracking-tight text-mist lg:block">{title}</h1>
      {subtitle ? <p className="text-sm text-mist-muted lg:mt-0.5">{subtitle}</p> : null}
    </div>
    {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
  </div>
);

// Server timestamps are UTC but serialized without a timezone suffix; append
// 'Z' so JS doesn't misparse them as local time.
export const utcDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  // Timestamps come from SQLite CURRENT_TIMESTAMP ("2026-09-06 07:06:17", UTC, no zone) or from
  // .NET ("2026-09-06T07:06:17"); anything without an explicit zone is UTC.
  const s = String(v).trim();
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return new Date(s);
  if (/^\d{4}-\d\d-\d\d$/.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
};

export const fmtDate = (v) => {
  const d = utcDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : '—';
};

/** Compact timestamp for dense tables: "5 Sep, 14:58" (adds the year when it differs). */
export const fmtDateShort = (v) => {
  const d = utcDate(v);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
};

/** "3 minutes ago", "yesterday" … for activity feeds. */
export const fmtRelative = (v) => {
  const d = utcDate(v);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (diff < 60) return 'just now';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 86400 * 14) return rtf.format(-Math.round(diff / 86400), 'day');
  return fmtDateShort(v);
};

export const fmtCurrency = (v, currency = 'USD') =>
  (v ?? 0).toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 });
