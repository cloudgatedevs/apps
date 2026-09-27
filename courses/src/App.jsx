import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route } from 'react-router-dom';
import { CloudgateBackoffice, Profile, RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { cloudgate, preview } from './academy/platform';
import { ACADEMY_PAGES, academyNavigation } from './academy/navigation';
import metadata from '../template.json';
const AcademyPage = lazy(() => import('./academy/main'));

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Suspense fallback={<p className="p-8">Opening your academy…</p>}>
      <CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={academyNavigation}
        fallback="/" basePath="/admin" developerMode={!preview} publicHome={<AcademyPage />}
        publicRoutes={<>
          <Route path="/learn" element={<AcademyPage section="learn" />} />
          <Route path="/learn/profile" element={<RequireAuth><main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="text-accent" to="/learn">← My learning</Link><Profile /></main></RequireAuth>} />
          <Route path="/course" element={<AcademyPage />} />
          <Route path="/certificate" element={<AcademyPage section="certificate" />} />
        </>}>
        <Route index element={<AcademyPage section="admin" />} />
        {ACADEMY_PAGES.filter(([page]) => page !== 'overview').map(([page]) =>
          <Route key={page} path={page} element={<AcademyPage section="admin" page={page} />} />)}
      </CloudgateBackoffice>
    </Suspense>
  </BrowserRouter>;
}
