import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route } from 'react-router-dom';
import { CloudgateBackoffice, Profile, RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { cloudgate, preview } from './jobs/platform';
import { JOB_PAGES, jobNavigation } from './jobs/navigation';
import metadata from '../template.json';
const JobsPage = lazy(() => import('./jobs/main'));

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Suspense fallback={<p className="p-8">Opening Jobs…</p>}>
      <CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={jobNavigation}
        fallback="/" basePath="/admin" developerMode={!preview} publicHome={<JobsPage />}
        publicRoutes={<>
          <Route path="/request" element={<JobsPage />} />
          <Route path="/account" element={<JobsPage section="account" />} />
          {['requests', 'quotes', 'jobs', 'invoices', 'addresses', 'calendar'].map(page =>
            <Route key={page} path={'/account/' + page} element={<JobsPage section="account" page={page} />} />)}
          <Route path="/account/profile" element={<RequireAuth><main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="text-accent" to="/account">← My account</Link><Profile /></main></RequireAuth>} />
        </>}>
        <Route index element={<JobsPage section="admin" />} />
        {JOB_PAGES.filter(([page]) => page !== 'overview').map(([page]) =>
          <Route key={page} path={page} element={<JobsPage section="admin" page={page} />} />)}
      </CloudgateBackoffice>
    </Suspense>
  </BrowserRouter>;
}
