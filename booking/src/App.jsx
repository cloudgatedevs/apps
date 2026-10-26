import { lazy, Suspense } from 'react';
import { BrowserRouter, Route } from 'react-router-dom';
import { CloudgateBackoffice } from '@cloudgatedevs/cloudgate-client-react/react';
import { cloudgate, preview } from './booking/platform';
import { BOOKING_PAGES, bookingNavigation } from './booking/navigation';
import metadata from '../template.json';
const CustomerSite = lazy(() => import('./booking/main').then(module => ({ default: module.CustomerSite })));
const BookingAdmin = lazy(() => import('./booking/admin').then(module => ({ default: module.BookingAdmin })));
export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Suspense fallback={<p className="p-8">Loading Booking…</p>}>
    <CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={bookingNavigation}
      fallback="/" basePath="/admin" developerMode={!preview} publicHome={<CustomerSite />}
      publicRoutes={<>
        {['/book', '/appointments', '/checkout/return', '/account', '/account/callback', '/login', '/signup', '/test-checkout'].map(path => <Route key={path} path={path} element={<CustomerSite />} />)}
      </>}>
      <Route index element={<BookingAdmin page="overview" />} />
      {BOOKING_PAGES.filter(([page]) => page !== 'overview').map(([page]) => <Route key={page} path={page} element={<BookingAdmin page={page} />} />)}
    </CloudgateBackoffice>
  </Suspense></BrowserRouter>;
}
