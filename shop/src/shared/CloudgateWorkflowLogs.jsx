// Logs page for the back office: every workflow call this installed app made to Cloudgate,
// read from Cloudgate's own log store and scoped to this app's controller and environment
// (see services/workflowLogsApi.js). The same two files (this one + cloudgate-workflow-logs.css)
// ship in every App Store app; each back office mounts <CloudgateWorkflowLogs/> on its own
// Logs page.
//
// Self-contained on purpose — like CloudgateSmtpSettings.jsx — so it renders the same whether
// the host is Shop/POS (Tailwind + react-router) or Booking/Jobs (hand-written CSS, hash
// navigation): plain React, its own stylesheet, Radix Dialog for the drawer, lucide icons.
// No payloads are fetched for the list; only the detail drawer asks for one call's request and
// response, masked when the action masks data.
import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, ChevronRight, RefreshCw, X } from 'lucide-react';
import { workflowLogsApi, workflowLogsScope } from './services/workflowLogsApi';
import './cloudgate-workflow-logs.css';

const PAGE_SIZE = 50;
const PERIODS = [[24, '24 hours'], [168, '7 days'], [720, '30 days']];
const OUTCOMES = [['', 'All'], ['success', 'Success'], ['unauthorized', 'Unauthorized'], ['error', 'Errors']];
const MIN_DURATIONS = [[0, 'Any duration'], [500, '≥ 500 ms'], [1000, '≥ 1 s'], [3000, '≥ 3 s'], [10000, '≥ 10 s']];
const OUTCOME_TONE = { success: 'green', unauthorized: 'amber', error: 'red' };

// ---------------------------------------------------------------- helpers
const utcDate = (v) => {
  if (v == null || v === '') return null;
  const s = String(v);
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) || !s.includes('T') ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => utcDate(v)?.toLocaleString() ?? '—';
const fmtDateShort = (v) => {
  const d = utcDate(v);
  if (!d) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), hour: '2-digit', minute: '2-digit' });
};
const fmtMs = (ms) => {
  const n = Number(ms ?? 0);
  if (!Number.isFinite(n)) return '—';
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(n < 10000 ? 2 : 1)} s`;
};
const durClass = (ms) => (ms >= 3000 ? 'cwl-num cwl-dur-bad' : ms >= 1000 ? 'cwl-num cwl-dur-warn' : 'cwl-num cwl-muted');
const fmtBytes = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n ?? 0} B`);
const pct = (current, previous) => (Number.isFinite(current) && Number.isFinite(previous) && previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);
const prettyJson = (text) => {
  if (text == null || text === '') return '';
  const s = String(text);
  if (s === '***') return s;
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};

/** Tiny async hook: { data, loading, error, reload }. */
function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && setState({ data, loading: false, error: null })).catch((error) => alive && setState({ data: null, loading: false, error }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

// ---------------------------------------------------------------- small pieces
const Badge = ({ tone = 'gray', plain = false, children }) => <span className={`cwl-badge cwl-badge-${tone}${plain ? ' cwl-plain' : ''}`}>{children}</span>;
const Skeleton = ({ lines = 3 }) => <div className="cwl-skel" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <i key={i} />)}</div>;
const ErrorNote = ({ error }) => (error ? <div role="alert" className="cwl-notice cwl-notice-error">{String(error?.message ?? error)}</div> : null);
const Empty = ({ title, text }) => <div className="cwl-card cwl-empty"><span className="cwl-empty-icon"><Activity size={20} /></span><strong>{title}</strong>{text ? <p>{text}</p> : null}</div>;

const Stat = ({ label, value, trend, sub }) => (
  <div className="cwl-card cwl-stat">
    <div className="cwl-stat-label"><span>{label}</span>{trend != null ? <span className={`cwl-stat-trend ${trend >= 0 ? 'up' : 'down'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</span> : null}</div>
    <div className="cwl-stat-value cwl-num">{value ?? '—'}</div>
    {sub ? <div className="cwl-stat-sub">{sub}</div> : null}
  </div>
);

/** Dependency-free bar chart of calls per bucket with the error share stacked in red. */
const BucketChart = ({ buckets, bucketSize }) => {
  const [hover, setHover] = useState(null);
  if (!buckets?.length) return <div className="cwl-empty-chart">No calls in this period.</div>;
  const max = Math.max(1, ...buckets.map((b) => b.calls));
  const w = 600; const h = 140; const padY = 8; const gap = 2;
  const bw = (w - gap * (buckets.length - 1)) / buckets.length;
  const label = (b) => {
    const d = new Date(b.at);
    return bucketSize === 'hour' ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  return (
    <div className="cwl-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Calls per period" onMouseLeave={() => setHover(null)}>
        {buckets.map((b, i) => {
          const x = i * (bw + gap);
          const total = (b.calls / max) * (h - padY * 2);
          const errors = (b.errors / max) * (h - padY * 2);
          return (
            <g key={b.at} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={bw} height={h} fill="transparent" />
              <rect x={x} y={h - padY - total} width={bw} height={Math.max(total, b.calls ? 1.5 : 0)} fill="var(--cwl-accent, #4f46e5)" opacity={hover === i ? 1 : 0.75} />
              {b.errors ? <rect x={x} y={h - padY - errors} width={bw} height={Math.max(errors, 1.5)} fill="#dc2626" /> : null}
            </g>
          );
        })}
      </svg>
      {hover != null ? (
        <div className="cwl-tip" style={{ left: `${((hover + 0.5) / buckets.length) * 100}%` }}>
          {label(buckets[hover])}: {buckets[hover].calls.toLocaleString()} calls{buckets[hover].errors ? `, ${buckets[hover].errors} errors` : ''}{buckets[hover].calls ? ` · avg ${fmtMs(buckets[hover].avgMs)}` : ''}
        </div>
      ) : null}
      <div className="cwl-chart-axis"><span>{label(buckets[0])}</span><span>{label(buckets[buckets.length - 1])}</span></div>
    </div>
  );
};

const NodeLogs = ({ sessionId }) => {
  const [state, setState] = useState({ status: 'idle', items: [], error: null });
  const load = async () => {
    setState({ status: 'loading', items: [], error: null });
    try { setState({ status: 'done', items: await workflowLogsApi.nodes(sessionId), error: null }); } catch (err) { setState({ status: 'error', items: [], error: err }); }
  };
  if (state.status === 'idle') return <button type="button" onClick={load} className="cwl-btn cwl-btn-sm">Show node logs</button>;
  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'error') return <ErrorNote error={state.error} />;
  if (!state.items.length) return <p className="cwl-dim" style={{ margin: 0 }}>No node logs were recorded for this call.</p>;
  return (
    <ol className="cwl-nodes">
      {state.items.map((n) => (
        <li key={n.id} className="cwl-node">
          <div className="cwl-node-head">
            <Badge plain tone={n.logType === 'Error' ? 'red' : n.logType === 'Warning' ? 'amber' : 'gray'}>{n.logType}</Badge>
            <strong>{n.nodeName || 'Node'}</strong>
            {n.durationMs != null ? <span className={durClass(n.durationMs)}>{fmtMs(n.durationMs)}</span> : null}
            <time>{fmtDate(n.creationTime)}</time>
          </div>
          {n.message ? <p>{n.message}</p> : null}
          {n.info ? <pre className="cwl-pre">{prettyJson(n.info)}</pre> : null}
          {n.response ? <pre className="cwl-pre">{prettyJson(n.response)}</pre> : null}
        </li>
      ))}
    </ol>
  );
};

const Drawer = ({ id, onClose }) => {
  const detail = useAsync(() => (id ? workflowLogsApi.get(id) : Promise.resolve(null)), [id]);
  const d = detail.data;
  return (
    <Dialog.Root open={!!id} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cwl-overlay" />
        <Dialog.Content className="cwl-drawer cwl">
          <div className="cwl-drawer-head">
            <div style={{ minWidth: 0 }}>
              <Dialog.Title asChild><h2 className="cwl-mono" style={{ fontSize: 15 }}>{d ? `/${d.route || '?'}${d.op ? ` · ${d.op}` : ''}` : 'Call'}</h2></Dialog.Title>
              <Dialog.Description asChild><p>{d ? `${fmtDate(d.creationTime)} · session ${d.sessionId}` : 'Loading the call…'}</p></Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="cwl-btn cwl-btn-sm" aria-label="Close"><X size={15} /></button></Dialog.Close>
          </div>
          <div className="cwl-drawer-body">
            {detail.loading ? <Skeleton lines={6} /> : detail.error ? <ErrorNote error={detail.error} /> : d ? (
              <>
                <dl>
                  <div><dt>Outcome</dt><dd><Badge plain tone={OUTCOME_TONE[d.outcome] ?? 'gray'}>{d.outcome} · {d.httpStatusCode}</Badge></dd></div>
                  <div><dt>Duration</dt><dd className={durClass(d.durationMs)}>{fmtMs(d.durationMs)}{d.cached ? ' (cached)' : ''}</dd></div>
                  <div><dt>User</dt><dd>{d.idpUserEmail || (d.idpUserId ? `#${d.idpUserId}` : 'Anonymous')}</dd></div>
                  <div><dt>Country</dt><dd>{d.country || '—'}</dd></div>
                  <div style={{ gridColumn: '1 / -1' }}><dt>Request</dt><dd className="cwl-mono cwl-muted">{d.method} {d.url || `/${d.route}`}</dd></div>
                </dl>
                {d.masked ? <div className="cwl-notice cwl-notice-info">This action masks its data in Cloudgate, so the request and response are hidden here too.</div> : null}
                <section><p className="cwl-label">Request body</p><pre className="cwl-pre">{prettyJson(d.body) || '(empty)'}</pre></section>
                <section><p className="cwl-label">Response</p><pre className="cwl-pre">{prettyJson(d.response) || '(empty)'}</pre></section>
                <section><p className="cwl-label">Node logs</p><NodeLogs sessionId={d.sessionId} /></section>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const Unavailable = ({ error }) => {
  const code = error?.code;
  const title = code === 'forbidden' ? 'Admin account required' : code === 'not-installed' ? 'This controller is not an installed app' : 'Workflow logs are not available here';
  const text = !workflowLogsScope.configured
    ? 'The local preview does not talk to Cloudgate. Run the app against a Cloudgate environment and sign in as a tenant administrator to see its workflow logs.'
    : error?.message || 'Update the Cloudgate host to a version that ships the workflow logs admin API.';
  return <Empty title={title} text={text} />;
};

// ---------------------------------------------------------------- page
/**
 * <CloudgateWorkflowLogs title="Logs" showTitle />
 * `showTitle={false}` when the host back office already prints the page name (Booking, Jobs).
 */
export function CloudgateWorkflowLogs({ title = 'Logs', showTitle = true }) {
  const [period, setPeriod] = useState(24);
  const [outcome, setOutcome] = useState('');
  const [route, setRoute] = useState('');
  const [minMs, setMinMs] = useState(0);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const configured = workflowLogsScope.configured;

  const summary = useAsync(() => (configured ? workflowLogsApi.summary(period) : Promise.resolve(null)), [period, configured]);
  const since = useMemo(() => new Date(Date.now() - period * 3600 * 1000).toISOString(), [period, summary.data?.to]);
  const list = useAsync(
    () => (configured ? workflowLogsApi.list({ skip: page * PAGE_SIZE, take: PAGE_SIZE, outcome: outcome || undefined, route: route || undefined, minDurationMs: minMs || undefined, startDate: since }) : Promise.resolve(null)),
    [period, outcome, route, minMs, page, configured, since],
  );
  useEffect(() => { setPage(0); }, [period, outcome, route, minMs]);

  const s = summary.data;
  const cur = s?.current;
  const prev = s?.previous;
  const rows = list.data?.items ?? [];
  const total = list.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const routes = useMemo(() => (s?.byRoute ?? []).map((r) => r.route).filter(Boolean).sort(), [s]);
  const blocking = !configured || ['unavailable', 'forbidden', 'not-installed'].includes(summary.error?.code);
  const hasFilters = Boolean(outcome || route || minMs);

  return (
    <div className="cwl">
      <div className="cwl-head">
        <div>
          {showTitle ? <h2>{title}</h2> : null}
          <p>
            {configured ? <>Every workflow call this app made to Cloudgate — <span className="cwl-mono">/{workflowLogsScope.projectPath}</span> in <Badge plain tone={workflowLogsScope.isProduction ? 'violet' : 'blue'}>{workflowLogsScope.isProduction ? 'production' : 'sandbox'}</Badge>{s?.fromInstall === false ? <span className="cwl-dim"> (developer tenant)</span> : null}</> : 'Workflow calls recorded by Cloudgate for this app.'}
          </p>
        </div>
        <div className="cwl-head-actions">
          <div className="cwl-seg" role="group" aria-label="Period">
            {PERIODS.map(([hours, label]) => <button key={hours} type="button" aria-pressed={period === hours} onClick={() => setPeriod(hours)}>{label}</button>)}
          </div>
          <button type="button" className="cwl-btn" onClick={() => { summary.reload(); list.reload(); }} disabled={!configured}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {blocking ? <Unavailable error={summary.error} /> : (
        <>
          <ErrorNote error={summary.error} />
          {s?.sampled ? <div className="cwl-notice cwl-notice-warn">More than 100 000 calls in this period: the percentiles and the chart cover the newest 100 000 only.</div> : null}

          {summary.loading ? <div className="cwl-card"><Skeleton lines={3} /></div> : cur ? (
            <div className="cwl-stats">
              <Stat label="Calls" value={cur.calls.toLocaleString()} trend={pct(cur.calls, prev?.calls)} sub={prev?.calls ? `${prev.calls.toLocaleString()} in the previous period` : 'no calls in the previous period'} />
              <Stat label="Success rate" value={`${cur.successRate}%`} trend={prev?.calls ? Math.round((cur.successRate - prev.successRate) * 10) / 10 : null} sub={`${cur.success.toLocaleString()} succeeded`} />
              <Stat label="Errors" value={cur.errors.toLocaleString()} sub={`${cur.unauthorized.toLocaleString()} unauthorized${prev?.calls ? ` · ${prev.errors.toLocaleString()} before` : ''}`} />
              <Stat label="Avg duration" value={fmtMs(cur.avgMs)} sub={prev?.calls ? `${fmtMs(prev.avgMs)} in the previous period` : 'gateway time per call'} />
              <Stat label="p95 duration" value={fmtMs(cur.p95Ms)} sub="19 of 20 calls were faster" />
            </div>
          ) : null}

          <div className="cwl-grid">
            <section className="cwl-card">
              <div className="cwl-card-head"><h3>Calls per {s?.bucketSize === 'day' ? 'day' : 'hour'}</h3><span className="cwl-legend"><i style={{ background: 'var(--cwl-accent, #4f46e5)' }} />calls<i style={{ background: '#dc2626' }} />errors</span></div>
              {summary.loading ? <Skeleton lines={4} /> : <BucketChart buckets={s?.buckets} bucketSize={s?.bucketSize} />}
            </section>
            <section className="cwl-card">
              <div className="cwl-card-head"><h3>By action</h3>{route ? <button type="button" className="cwl-link" onClick={() => setRoute('')}>Show all actions</button> : null}</div>
              {summary.loading ? <Skeleton lines={5} /> : !s?.byRoute?.length ? <p className="cwl-dim" style={{ margin: '24px 0', textAlign: 'center' }}>No calls in this period.</p> : (
                <div className="cwl-scroll cwl-routes">
                  <table>
                    <thead><tr><th>Action</th><th className="cwl-r">Calls</th><th className="cwl-r">Errors</th><th className="cwl-r">Avg</th><th className="cwl-r">p95</th><th className="cwl-r">Max</th></tr></thead>
                    <tbody>
                      {s.byRoute.map((r) => (
                        <tr key={r.route} className={route === r.route ? 'active' : ''} onClick={() => setRoute(route === r.route ? '' : r.route)} title="Filter the list to this action">
                          <td className="cwl-mono">/{r.route}</td>
                          <td className="cwl-r cwl-num cwl-muted">{r.calls.toLocaleString()}</td>
                          <td className={`cwl-r cwl-num ${r.errors ? 'cwl-dur-bad' : 'cwl-dim'}`}>{r.errors ? `${r.errors} (${r.errorRate}%)` : '0'}</td>
                          <td className={`cwl-r ${durClass(r.avgMs)}`}>{fmtMs(r.avgMs)}</td>
                          <td className={`cwl-r ${durClass(r.p95Ms)}`}>{fmtMs(r.p95Ms)}</td>
                          <td className={`cwl-r ${durClass(r.maxMs)}`}>{fmtMs(r.maxMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="cwl-filters">
            <div className="cwl-seg" role="group" aria-label="Outcome">
              {OUTCOMES.map(([v, label]) => <button key={v} type="button" aria-pressed={outcome === v} onClick={() => setOutcome(v)}>{label}</button>)}
            </div>
            <select id="cwl-route" value={route} onChange={(e) => setRoute(e.target.value)} aria-label="Action">
              <option value="">All actions</option>
              {routes.map((r) => <option key={r} value={r}>/{r}</option>)}
              {route && !routes.includes(route) ? <option value={route}>/{route}</option> : null}
            </select>
            <select id="cwl-min" value={minMs} onChange={(e) => setMinMs(Number(e.target.value))} aria-label="Minimum duration">
              {MIN_DURATIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            {hasFilters ? <button type="button" className="cwl-btn cwl-btn-sm" onClick={() => { setOutcome(''); setRoute(''); setMinMs(0); }}>Clear filters</button> : null}
            <span className="cwl-count">{list.data ? `${total.toLocaleString()} calls in the last ${PERIODS.find(([h]) => h === period)?.[1]}` : ''}</span>
          </div>

          <ErrorNote error={list.error} />
          {list.loading ? <div className="cwl-card"><Skeleton lines={8} /></div> : !rows.length ? (
            <Empty title="No calls match" text="Widen the period or clear the filters. Calls appear here as soon as the app talks to Cloudgate." />
          ) : (
            <>
              <div className="cwl-card cwl-list">
                <div className="cwl-scroll">
                  <table>
                    <thead><tr><th>Time</th><th>Action</th><th>Outcome</th><th className="cwl-r">Duration</th><th>User</th><th className="cwl-hide-sm">Country</th><th className="cwl-r cwl-hide-sm">Size</th><th /></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="cwl-muted" style={{ whiteSpace: 'nowrap' }} title={fmtDate(r.creationTime)}>{fmtDateShort(r.creationTime)}</td>
                          <td className="cwl-mono">/{r.route || '?'}{r.op ? <span className="cwl-dim"> · {r.op}</span> : null}</td>
                          <td><Badge tone={OUTCOME_TONE[r.outcome] ?? 'gray'}>{r.outcome} {r.httpStatusCode}</Badge></td>
                          <td className={`cwl-r ${durClass(r.durationMs)}`}>{fmtMs(r.durationMs)}{r.cached ? <span className="cwl-dim" style={{ fontSize: 10, marginLeft: 4 }}>cached</span> : null}</td>
                          <td className="cwl-user">{r.idpUserEmail || (r.idpUserId ? `#${r.idpUserId}` : r.runInPortal ? 'Cloudgate hub' : <span className="cwl-dim">Anonymous</span>)}</td>
                          <td className="cwl-hide-sm">{r.country || '—'}</td>
                          <td className="cwl-r cwl-hide-sm cwl-dim" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtBytes(r.bodyBytes)} → {fmtBytes(r.responseBytes)}</td>
                          <td className="cwl-r"><button type="button" className="cwl-btn cwl-btn-sm" onClick={() => setOpenId(r.id)}>Details <ChevronRight size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="cwl-pager">
                <span>{(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString()} of {total.toLocaleString()} calls</span>
                <div>
                  <button type="button" className="cwl-btn cwl-btn-sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>‹ Prev</button>
                  <span className="cwl-num cwl-muted">{page + 1} / {pages}</span>
                  <button type="button" className="cwl-btn cwl-btn-sm" onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page >= pages - 1}>Next ›</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <Drawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
