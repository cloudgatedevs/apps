import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/ui/menus';
import { AuthProvider, RequireAuth } from '@/shared/auth';
import { Layout } from '@/admin/components/Layout';
import { RequireAdmin } from '@/admin/components/RequireAdmin';
import { Dashboard } from '@/admin/pages/Dashboard';
import { Products } from '@/admin/pages/Products';
import { ProductEdit } from '@/admin/pages/ProductEdit';
import { Categories } from '@/admin/pages/Categories';
import { Inventory } from '@/admin/pages/Inventory';
import { Orders } from '@/admin/pages/Orders';
import { OrderDetail } from '@/admin/pages/OrderDetail';
import { Customers } from '@/admin/pages/Customers';
import { CustomerDetail } from '@/admin/pages/CustomerDetail';
import { Media } from '@/admin/pages/Media';
import { Pages } from '@/admin/pages/Pages';
import { PageEdit } from '@/admin/pages/PageEdit';
import { Messages } from '@/admin/pages/Messages';
import { Settings } from '@/admin/pages/Settings';
import { Profile } from '@/admin/pages/Profile';

// Served from admin.html at /admin/* — the router is anchored there so every
// route below is relative to /admin.
const App = () => (
  <BrowserRouter basename="/admin">
    <AuthProvider>
      <TooltipProvider>
      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 3500, style: { fontFamily: 'inherit', fontSize: '13px' } }} />
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<RequireAdmin />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/new" element={<ProductEdit />} />
              <Route path="/products/:id" element={<ProductEdit />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/media" element={<Media />} />
              <Route path="/pages" element={<Pages />} />
              <Route path="/pages/new" element={<PageEdit />} />
              <Route path="/pages/:id" element={<PageEdit />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
);

export { App };
