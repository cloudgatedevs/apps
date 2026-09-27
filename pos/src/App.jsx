import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { CloudgateBackoffice, Profile, RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { Toaster } from 'sonner';
import { TooltipProvider } from './shared/ui/menus';
import { ConfirmProvider } from './shared/ui/confirm';
import { cloudgate } from './platform';
import { retailRoutes } from './admin/routes';
import { NAV } from './admin/components/navConfig';
import metadata from '../template.json';
const Till = lazy(() => import('./pos/App').then(module => ({ default: module.App })));
const PayDone = lazy(() => import('./pos/pages/PayDone').then(module => ({ default: module.PayDone })));

export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <TooltipProvider><ConfirmProvider>
      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 3500 }} />
      <Suspense fallback={<p className="p-8">Opening POS…</p>}><Routes>
        {/* Customers return from Wallet on their own phone, without a cashier session. */}
        <Route path="/pay/done" element={<div className="pos-ui"><PayDone kind="done" /></div>} />
        <Route path="/pay/cancel" element={<div className="pos-ui"><PayDone kind="cancel" /></div>} />
        <Route path="*" element={<CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={NAV}
          basePath="/admin" fallback="/" publicHome={<Till />}
          publicRoutes={<>
            {['sales','returns','shift'].map(path => <Route key={path} path={'/' + path} element={<Till screen={path} />} />)}
            <Route path="/account/profile" element={<RequireAuth><main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="text-accent" to="/">← Back to till</Link><Profile /></main></RequireAuth>} />
          </>}>{retailRoutes}</CloudgateBackoffice>} />
      </Routes></Suspense>
    </ConfirmProvider></TooltipProvider>
  </BrowserRouter>;
}
