import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route } from 'react-router-dom';
import { CloudgateBackoffice, Profile, RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { cloudgate, preview } from './events/platform';
import { EVENT_PAGES, eventNavigation } from './events/navigation';
import metadata from '../template.json';
const EventsPage = lazy(() => import('./events/main'));

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Suspense fallback={<p className="p-8">Opening Events…</p>}>
      <CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={eventNavigation}
        fallback="/" basePath="/admin" developerMode={!preview} publicHome={<EventsPage />}
        publicRoutes={<>
          <Route path="/event" element={<EventsPage />} />
          <Route path="/account" element={<EventsPage section="account" />} />
          <Route path="/account/profile" element={<RequireAuth><main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="text-accent" to="/account">← My tickets</Link><Profile /></main></RequireAuth>} />
        </>}>
        <Route index element={<EventsPage section="admin" />} />
        {EVENT_PAGES.filter(([page]) => page !== 'overview').map(([page]) =>
          <Route key={page} path={page} element={<EventsPage section="admin" page={page} />} />)}
      </CloudgateBackoffice>
    </Suspense>
  </BrowserRouter>;
}
