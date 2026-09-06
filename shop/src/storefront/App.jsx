import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/shared/auth';
import { CartProvider } from '@/storefront/cart/CartProvider';
import { StoreProvider } from '@/storefront/store/StoreProvider';
import { Layout } from '@/storefront/components/Layout';
import { Home } from '@/storefront/pages/Home';
import { Catalog } from '@/storefront/pages/Catalog';
import { Product } from '@/storefront/pages/Product';
import { Cart } from '@/storefront/pages/Cart';
import { Checkout } from '@/storefront/pages/Checkout';
import { CheckoutReturn } from '@/storefront/pages/CheckoutReturn';
import { CheckoutCancel } from '@/storefront/pages/CheckoutCancel';
import { Account } from '@/storefront/pages/Account';
import { NotFound } from '@/storefront/pages/NotFound';
import { Page } from '@/storefront/pages/Page';
import { Contact } from '@/storefront/pages/Contact';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <StoreProvider>
        <CartProvider>
          <Toaster position="bottom-center" toastOptions={{ duration: 3000, style: { fontFamily: 'inherit', fontSize: '14px', borderRadius: '14px' } }} />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              {/* One route for both forms so switching category keeps the page mounted (no skeleton flash). */}
              <Route path="/shop/:category?" element={<Catalog />} />
              <Route path="/p/:slug" element={<Product />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route path="/checkout/cancel" element={<CheckoutCancel />} />
              <Route path="/account" element={<Account />} />
              <Route path="/account/orders/:reference" element={<Account />} />
              <Route path="/pages/:slug" element={<Page />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </CartProvider>
      </StoreProvider>
    </AuthProvider>
  </BrowserRouter>
);

export { App };
