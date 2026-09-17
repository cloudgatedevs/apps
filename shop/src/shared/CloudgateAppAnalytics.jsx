import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RefreshCw, ArrowUpRight, Eye, Users, UserCheck, Timer, MousePointerClick, ChartNoAxesCombined, ChevronLeft, ChevronRight, X, Activity, Info } from 'lucide-react';
import { appAnalyticsApi } from './services/appAnalyticsApi';
import { workflowLogsApi } from './services/workflowLogsApi';
import { ANALYTICS_PERIODS, count, duration, percent, comparison, countryName, visitorName, analyticsDateRange } from './lib/analytics';
import './cloudgate-app-analytics.css';

function useResource(load, dependencies) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, data: null, error: null });
    Promise.resolve().then(() => load(controller.signal)).then(
      data => { if (active) setState({ loading: false, data, error: null }); },
      error => { if (active && error.name !== 'AbortError') setState({ loading: false, data: null, error }); },
    );
    return () => { active = false; controller.abort(); };
  }, dependencies);
  return state;
}

function Failure({ error, retry }) {
  const title = error.code === 'forbidden' ? 'Admin account required' : error.code === 'not-installed' ? 'No matching published website' : error.code === 'unavailable' ? 'Analytics is not connected yet' : 'Could not load analytics';
  return <div className="cga-message" role="alert"><Info size={22}/><div><strong>{title}</strong><p>{error.message}</p>{retry && <button className="cga-button" onClick={retry}>Try again</button>}</div></div>;
}
function Empty({ children = 'No traffic recorded for this period.' }) { return <p className="cga-empty">{children}</p>; }
function Loading({ label = 'Loading analytics…' }) { return <p className="cga-empty" role="status"><RefreshCw className="cga-spin" size={16}/>{label}</p>; }

function Metric({ icon: Icon, title, value, current, previous, hint, loading }) {
  const delta = comparison(current, previous);
  return <article className="cga-card cga-metric"><div className="cga-metric-label"><span>{title}</span><Icon size={17}/></div><strong>{loading ? '—' : value}</strong><small className={hint ? '' : `cga-${delta.direction}`}>{loading ? 'Loading…' : hint || delta.text}</small></article>;
}

function Breakdown({ rows, total, limit = 10 }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, limit), sum = total ?? rows.reduce((n, row) => n + row.count, 0);
  const max = Math.max(1, ...visible.map(row => row.count));
  if (!visible.length || !sum) return <Empty/>;
  return <><ul className="cga-breakdown">{visible.map((row, i) => <li key={`${row.name}-${i}`}><div><span title={row.name}>{row.name}</span><span className="cga-numeric">{count(row.count)} <small>{percent(row.count / sum)}</small></span></div><div className="cga-track" aria-hidden="true"><span style={{ width: `${row.count / max * 100}%` }}/></div></li>)}</ul>{rows.length > limit && <button className="cga-link cga-more" onClick={() => setExpanded(v => !v)}>{expanded ? 'Show less' : `Show all ${rows.length}`}</button>}</>;
}

function Pager({ page, total, size, loading, onChange, label }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="cga-pager"><span>{total ? `${page * size + 1}–${Math.min((page + 1) * size, total)} of ${count(total)} ${label}` : `0 ${label}`}</span><div><button className="cga-button" aria-label={`Previous ${label}`} disabled={loading || page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={15}/></button><span>{page + 1} / {pages}</span><button className="cga-button" aria-label={`Next ${label}`} disabled={loading || page + 1 >= pages} onClick={() => onChange(page + 1)}><ChevronRight size={15}/></button></div></div>;
}

function VisitorCalls({ visitor, period, close }) {
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const range = analyticsDateRange(period);
  const calls = useResource(() => workflowLogsApi.list({ idpUserId: visitor.idpUserId, skip: page * 10, take: 10, ...range }), [visitor.idpUserId, period, page, refresh]);
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal><Dialog.Overlay className="cga-overlay"/><Dialog.Content className="cga cga-dialog"><header><div><Dialog.Title>Workflow calls · {visitorName(visitor)}</Dialog.Title><Dialog.Description>Calls by this signed-in visitor in the selected period, scoped to this app.</Dialog.Description></div><Dialog.Close className="cga-button" aria-label="Close visitor calls"><X size={18}/></Dialog.Close></header>{calls.loading ? <Loading label="Loading workflow calls…"/> : calls.error ? <Failure error={calls.error} retry={() => setRefresh(r => r + 1)}/> : !calls.data?.items?.length ? <Empty>No workflow calls recorded for this visitor in this period.</Empty> : <div className="cga-table-wrap"><table><thead><tr><th>Action</th><th>Result</th><th>Duration</th><th>Time</th></tr></thead><tbody>{calls.data.items.map(row => <tr key={row.id}><td className="cga-path">{row.route || '/'}{row.op && <small>{row.op}</small>}</td><td>{row.outcome}</td><td>{duration(row.durationMs)}</td><td>{new Date(row.creationTime).toLocaleString()}</td></tr>)}</tbody></table></div>}<Pager page={page} total={calls.data?.totalCount || 0} size={10} label="calls" loading={calls.loading} onChange={setPage}/></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function CloudgateAppAnalytics({ api = appAnalyticsApi }) {
  const [period, setPeriod] = useState(3), [refresh, setRefresh] = useState(0);
  const [pathPage, setPathPage] = useState(0), [visitorPage, setVisitorPage] = useState(0);
  const [selectedPath, setSelectedPath] = useState(''), [deviceTab, setDeviceTab] = useState('deviceTypes');
  const [visitor, setVisitor] = useState(null);
  const overview = useResource(signal => api.overview(period, { signal }), [api, period, refresh]);
  const paths = useResource(signal => api.pages({ timePeriod: period, skip: pathPage * 10, take: 10, signal }), [api, period, pathPage, refresh]);
  const sessions = useResource(signal => api.sessions({ timePeriod: period, skip: visitorPage * 10, take: 10, pagePath: selectedPath, signal }), [api, period, visitorPage, selectedPath, refresh]);
  const data = overview.data, summary = data?.summary || {};
  const reload = () => { setPathPage(0); setVisitorPage(0); setRefresh(n => n + 1); };
  const changePeriod = value => { setPeriod(Number(value)); setPathPage(0); setVisitorPage(0); setSelectedPath(''); setVisitor(null); };
  const choosePath = path => { setSelectedPath(current => current === path ? '' : path); setVisitorPage(0); };
  const address = data?.app?.customUrl || data?.app?.url;
  const safeAddress = /^https?:\/\//i.test(address || '') ? address : null;
  const referrers = data?.referrers;
  const sources = referrers ? [
    { name: 'Direct', count: referrers.directViewCount || 0 },
    { name: 'Internal navigation', count: referrers.internalViewCount || 0 },
    ...(referrers.items || []).map(row => ({ name: row.host, count: row.viewCount })),
  ].filter(row => row.count > 0).sort((a, b) => b.count - a.count) : [];
  const scope = { ...api.scope, ...data?.scope };
  return <div className="cga"><div className="cga-toolbar"><div className="cga-context"><span className="cga-environment">{scope.isProduction ? 'Production' : 'Sandbox'}</span><span>{data?.app?.name || scope.projectPath || 'This app'}</span>{safeAddress && <a href={safeAddress} target="_blank" rel="noreferrer">{safeAddress.replace(/^https?:\/\//, '').replace(/\/$/, '')}<ArrowUpRight size={14}/></a>}</div><div className="cga-controls"><label><span className="cga-sr">Analytics period</span><select value={period} onChange={e => changePeriod(e.target.value)}>{ANALYTICS_PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="cga-button" onClick={reload} disabled={overview.loading}><RefreshCw size={15} className={overview.loading ? 'cga-spin' : ''}/>Refresh</button></div></div>
    {overview.error ? <Failure error={overview.error} retry={reload}/> : <>
      <div className="cga-metrics">
        <Metric icon={Eye} title="Page views" value={count(summary.viewCount)} current={summary.viewCount} previous={summary.previousViewCount} loading={overview.loading}/>
        <Metric icon={Users} title="Sessions" value={count(summary.uniqueSessionCount)} current={summary.uniqueSessionCount} previous={summary.previousUniqueSessionCount} loading={overview.loading}/>
        <Metric icon={UserCheck} title="Signed-in visitors" value={count(summary.signedInVisitorCount)} current={summary.signedInVisitorCount} previous={summary.previousSignedInVisitorCount} loading={overview.loading}/>
        <Metric icon={MousePointerClick} title="Bounce rate" value={percent(summary.bounceRate)} hint="Sessions with one page view" loading={overview.loading}/>
        <Metric icon={Timer} title="Average session" value={duration(summary.averageSessionDurationMs)} hint="From recorded session endings" loading={overview.loading}/>
      </div>
      {!overview.loading && summary.viewCount === 0 && <div className="cga-note"><ChartNoAxesCombined size={19}/><span>No page views recorded in this period. Traffic appears here after people visit the published website.</span></div>}
      <div className="cga-grid">
        <section className="cga-card cga-pages"><header><div><h2>Pages</h2><p>Select a path to see its visitors.</p></div><span className="cga-pill">{count(paths.data?.totalCount)} paths</span></header>{paths.loading ? <Loading label="Loading page views…"/> : paths.error ? <Failure error={paths.error} retry={reload}/> : !paths.data?.items?.length ? <Empty/> : <div className="cga-table-wrap"><table><thead><tr><th>Page path</th><th className="cga-right">Views</th><th className="cga-right">Sessions</th></tr></thead><tbody>{paths.data.items.map(row => <tr key={row.pagePath} className={selectedPath === row.pagePath ? 'cga-selected' : ''}><td><button className="cga-path cga-link" aria-pressed={selectedPath === row.pagePath} onClick={() => choosePath(row.pagePath)}>{row.pagePath || '/'}</button></td><td className="cga-right">{count(row.viewCount)}</td><td className="cga-right">{count(row.uniqueSessionCount)}</td></tr>)}</tbody></table></div>}<Pager page={pathPage} total={paths.data?.totalCount || 0} size={10} loading={paths.loading} onChange={setPathPage} label="paths"/></section>
        <section className="cga-card"><header><div><h2>Countries</h2><p>Where recorded website activity comes from.</p></div></header>{overview.loading ? <Loading/> : <Breakdown rows={(data?.geographic?.countries || []).map(row => ({ name: countryName(row.countryCode), count: row.requestCount })).sort((a, b) => b.count - a.count)}/>}</section>
        <section className="cga-card"><header><div><h2>Traffic sources</h2><p>Direct visits and referring websites.</p></div></header>{overview.loading ? <Loading/> : <Breakdown rows={sources} total={summary.viewCount} limit={12}/>}</section>
        <section className="cga-card"><header><div><h2>Devices & browsers</h2><p>How people visit your website.</p></div></header><div className="cga-tabs" role="group" aria-label="Device breakdown">{[['deviceTypes', 'Devices'], ['browsers', 'Browsers'], ['operatingSystems', 'Operating systems']].map(([key, label]) => <button key={key} aria-pressed={deviceTab === key} onClick={() => setDeviceTab(key)}>{label}</button>)}</div>{overview.loading ? <Loading/> : <Breakdown rows={data?.devices?.[deviceTab] || []}/>}</section>
      </div>
      <section className="cga-card cga-visitors"><header><div><h2>Visitors</h2><p>{selectedPath ? <>Sessions that visited <code>{selectedPath}</code>. <button className="cga-link" onClick={() => choosePath(selectedPath)}>Clear filter</button></> : 'Recent visitor sessions for this website.'}</p></div><span className="cga-pill">{count(sessions.data?.totalCount)} sessions</span></header>{sessions.loading ? <Loading label="Loading visitors…"/> : sessions.error ? <Failure error={sessions.error} retry={reload}/> : !sessions.data?.items?.length ? <Empty>{selectedPath ? 'No visitor sessions for this page in this period.' : 'No visitor sessions recorded in this period.'}</Empty> : <div className="cga-table-wrap"><table><thead><tr><th>Visitor</th><th>Country</th><th className="cga-right">Views</th><th className="cga-right">Duration</th><th>Last seen</th><th><span className="cga-sr">Workflow calls</span></th></tr></thead><tbody>{sessions.data.items.map((row, i) => <tr key={`${row.clientSessionId}-${row.anonymousVisitorId}-${i}`}><td><strong>{visitorName(row)}</strong>{row.idpUserEmailAddress && visitorName(row) !== row.idpUserEmailAddress ? <small>{row.idpUserEmailAddress}</small> : !row.idpUserId && <small>Session {(row.anonymousVisitorId || row.clientSessionId || '').slice(0, 12)}</small>}</td><td>{countryName(row.country)}</td><td className="cga-right">{count(row.viewCount)}</td><td className="cga-right">{duration(row.totalDurationMs)}</td><td className="cga-time">{new Date(row.lastSeen).toLocaleString()}</td><td>{row.idpUserId && <button className="cga-button" title={`Workflow calls for ${visitorName(row)}`} aria-label={`Workflow calls for ${visitorName(row)}`} onClick={() => setVisitor(row)}><Activity size={15}/></button>}</td></tr>)}</tbody></table></div>}<Pager page={visitorPage} total={sessions.data?.totalCount || 0} size={10} loading={sessions.loading} onChange={setVisitorPage} label="sessions"/></section>
      <p className="cga-footnote">Source: Cloudgate Web App Insights · UTC reporting periods · {scope.isProduction ? 'Production' : 'Sandbox'} traffic</p>
    </>}{visitor && <VisitorCalls visitor={visitor} period={period} close={() => setVisitor(null)}/>}</div>;
}
