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
import { ReceiveStock, StockTake, ReceiptDetail } from '@/admin/pages/InventoryOps';
import { Suppliers } from '@/admin/pages/Suppliers';
import { Sales } from '@/admin/pages/Sales';
import { SaleDetail } from '@/admin/pages/SaleDetail';
import { Shifts, ShiftDetail } from '@/admin/pages/Shifts';
import { Registers } from '@/admin/pages/Registers';
import { Tellers } from '@/admin/pages/Tellers';
import { Customers, CustomerDetail } from '@/admin/pages/Customers';
import { Reports } from '@/admin/pages/Reports';
import { Media } from '@/admin/pages/Media';
import { Settings } from '@/admin/pages/Settings';
import { Profile } from '@/admin/pages/Profile';

// Served from admin.html at /admin/* — the router is anchored there so every route below is
// relative to /admin. Only administrators get in; tellers are sent to the till.
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
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/:id" element={<SaleDetail />} />
                <Route path="/shifts" element={<Shifts />} />
                <Route path="/shifts/:id" element={<ShiftDetail />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/new" element={<ProductEdit />} />
                <Route path="/products/:id" element={<ProductEdit />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/inventory/receive" element={<ReceiveStock />} />
                <Route path="/inventory/count" element={<StockTake />} />
                <Route path="/inventory/receipts/:id" element={<ReceiptDetail />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/tellers" element={<Tellers />} />
                <Route path="/registers" element={<Registers />} />
                <Route path="/media" element={<Media />} />
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
