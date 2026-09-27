import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAdmin } from './components/RequireAdmin';
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Products = lazy(() => import('./pages/Products').then(module => ({ default: module.Products })));
const ProductEdit = lazy(() => import('./pages/ProductEdit').then(module => ({ default: module.ProductEdit })));
const Categories = lazy(() => import('./pages/Categories').then(module => ({ default: module.Categories })));
const Inventory = lazy(() => import('./pages/Inventory').then(module => ({ default: module.Inventory })));
const Orders = lazy(() => import('./pages/Orders').then(module => ({ default: module.Orders })));
const OrderDetail = lazy(() => import('./pages/OrderDetail').then(module => ({ default: module.OrderDetail })));
const Customers = lazy(() => import('./pages/Customers').then(module => ({ default: module.Customers })));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail').then(module => ({ default: module.CustomerDetail })));
const Pages = lazy(() => import('./pages/Pages').then(module => ({ default: module.Pages })));
const PageEdit = lazy(() => import('./pages/PageEdit').then(module => ({ default: module.PageEdit })));
const Messages = lazy(() => import('./pages/Messages').then(module => ({ default: module.Messages })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
export const commerceRoutes = <Route element={<RequireAdmin />}><Route index element={<Dashboard />} />
<Route path="products" element={<Products />} />
<Route path="products/new" element={<ProductEdit />} />
<Route path="products/:id" element={<ProductEdit />} />
<Route path="categories" element={<Categories />} />
<Route path="inventory" element={<Inventory />} />
<Route path="orders" element={<Orders />} />
<Route path="orders/:id" element={<OrderDetail />} />
<Route path="customers" element={<Customers />} />
<Route path="customers/:id" element={<CustomerDetail />} />
<Route path="pages" element={<Pages />} />
<Route path="pages/new" element={<PageEdit />} />
<Route path="pages/:id" element={<PageEdit />} />
<Route path="messages" element={<Messages />} />
<Route path="business" element={<Settings />} />
</Route>;
