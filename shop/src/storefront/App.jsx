import { CartProvider } from './cart/CartProvider';
import { StoreProvider } from './store/StoreProvider';
import { Layout } from './components/Layout';
import { UiScopeProvider } from '@/shared/ui/scope';
import { useSettings } from '@cloudgatedevs/cloudgate-client-react/react';
import { foreground } from '@cloudgatedevs/cloudgate-client-react/platform';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { Product } from './pages/Product';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { CheckoutReturn } from './pages/CheckoutReturn';
import { CheckoutCancel } from './pages/CheckoutCancel';
import { Account } from './pages/Account';
import { NotFound } from './pages/NotFound';
import { Page } from './pages/Page';
import { Contact } from './pages/Contact';
const screens = { Home, Catalog, Product, Cart, Checkout, CheckoutReturn, CheckoutCancel, Account, NotFound, Page, Contact };
export function Storefront({ screen = 'Home' }) {
  const { settings } = useSettings();
  const Screen = screens[screen] || NotFound;
  return <UiScopeProvider value="shop-store"><div className="shop-store" style={{ '--secondary-fg': foreground(settings.theme_secondary) }}><StoreProvider><CartProvider><Layout><Screen /></Layout></CartProvider></StoreProvider></div></UiScopeProvider>;
}
