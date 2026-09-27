import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route } from 'react-router-dom';
import { CloudgateBackoffice, Profile, RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { Toaster } from 'sonner';
import { TooltipProvider } from './shared/ui/menus';
import { cloudgate } from './platform';
import { commerceRoutes } from './admin/routes';
import { NAV } from './admin/components/navConfig';
import metadata from '../template.json';
const Storefront = lazy(() => import('./storefront/App').then(module => ({ default: module.Storefront })));
export function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TooltipProvider>
    <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 3500 }} />
    <Suspense fallback={<p className="p-8">Opening Shop…</p>}>
      <CloudgateBackoffice client={cloudgate} metadata={metadata} navigation={NAV} basePath="/admin" fallback="/" publicHome={<Storefront />}
        publicRoutes={<>
          <Route path="/account/profile" element={<RequireAuth><main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link to="/account" className="text-accent">← Your orders</Link><Profile /></main></RequireAuth>} />
          <Route path="/shop/:category?" element={<Storefront screen="Catalog" />} />
          <Route path="/p/:slug" element={<Storefront screen="Product" />} />
          <Route path="/cart" element={<Storefront screen="Cart" />} />
          <Route path="/checkout" element={<Storefront screen="Checkout" />} />
          <Route path="/checkout/return" element={<Storefront screen="CheckoutReturn" />} />
          <Route path="/checkout/cancel" element={<Storefront screen="CheckoutCancel" />} />
          <Route path="/account" element={<Storefront screen="Account" />} />
          <Route path="/account/orders/:reference" element={<Storefront screen="Account" />} />
          <Route path="/pages/:slug" element={<Storefront screen="Page" />} />
          <Route path="/contact" element={<Storefront screen="Contact" />} />
          <Route path="*" element={<Storefront screen="NotFound" />} />
        </>}>{commerceRoutes}</CloudgateBackoffice>
    </Suspense>
  </TooltipProvider></BrowserRouter>;
}
