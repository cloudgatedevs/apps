import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RequireAdmin } from './components/RequireAdmin';
const page = (load, name) => lazy(() => load().then(module => ({ default: module[name] })));
const Dashboard = page(() => import('@/admin/pages/Dashboard'), 'Dashboard');
const Products = page(() => import('@/admin/pages/Products'), 'Products');
const ProductEdit = page(() => import('@/admin/pages/ProductEdit'), 'ProductEdit');
const Categories = page(() => import('@/admin/pages/Categories'), 'Categories');
const Inventory = page(() => import('@/admin/pages/Inventory'), 'Inventory');
const ReceiveStock = page(() => import('@/admin/pages/InventoryOps'), 'ReceiveStock');
const StockTake = page(() => import('@/admin/pages/InventoryOps'), 'StockTake');
const ReceiptDetail = page(() => import('@/admin/pages/InventoryOps'), 'ReceiptDetail');
const Suppliers = page(() => import('@/admin/pages/Suppliers'), 'Suppliers');
const Sales = page(() => import('@/admin/pages/Sales'), 'Sales');
const SaleDetail = page(() => import('@/admin/pages/SaleDetail'), 'SaleDetail');
const Shifts = page(() => import('@/admin/pages/Shifts'), 'Shifts');
const ShiftDetail = page(() => import('@/admin/pages/Shifts'), 'ShiftDetail');
const Registers = page(() => import('@/admin/pages/Registers'), 'Registers');
const Tellers = page(() => import('@/admin/pages/Tellers'), 'Tellers');
const Customers = page(() => import('@/admin/pages/Customers'), 'Customers');
const CustomerDetail = page(() => import('@/admin/pages/Customers'), 'CustomerDetail');
const Reports = page(() => import('@/admin/pages/Reports'), 'Reports');
const Settings = page(() => import('@/admin/pages/Settings'), 'Settings');
export const retailRoutes = <Route element={<RequireAdmin />}>
<Route index element={<Dashboard />} />
<Route path="sales" element={<Sales />} />
<Route path="sales/:id" element={<SaleDetail />} />
<Route path="shifts" element={<Shifts />} />
<Route path="shifts/:id" element={<ShiftDetail />} />
<Route path="reports" element={<Reports />} />
<Route path="products" element={<Products />} />
<Route path="products/new" element={<ProductEdit />} />
<Route path="products/:id" element={<ProductEdit />} />
<Route path="categories" element={<Categories />} />
<Route path="inventory" element={<Inventory />} />
<Route path="inventory/receive" element={<ReceiveStock />} />
<Route path="inventory/count" element={<StockTake />} />
<Route path="inventory/receipts/:id" element={<ReceiptDetail />} />
<Route path="suppliers" element={<Suppliers />} />
<Route path="customers" element={<Customers />} />
<Route path="customers/:id" element={<CustomerDetail />} />
<Route path="tellers" element={<Tellers />} />
<Route path="registers" element={<Registers />} />
<Route path="business" element={<Settings />} />
</Route>;
