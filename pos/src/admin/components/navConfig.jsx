import { BarChart3, Boxes, Clock, LayoutDashboard, Monitor, Package, Receipt, Settings, Tags, Truck, UserRound, Users } from 'lucide-react';
export const IconCategories = Tags;
export const IconProducts = Package;
export const NAV = [
  ['/', 'Dashboard', LayoutDashboard], ['/sales', 'Sales', Receipt], ['/shifts', 'Shifts', Clock],
  ['/reports', 'Retail reports', BarChart3], ['/products', 'Products', Package], ['/categories', 'Categories', Tags],
  ['/inventory', 'Inventory', Boxes], ['/suppliers', 'Suppliers', Truck], ['/customers', 'Customers', Users],
  ['/tellers', 'Teller activity', UserRound], ['/registers', 'Registers', Monitor], ['/business', 'POS settings', Settings],
].map(([to, label, icon]) => ({ to, label, icon, group: 'Retail', permission: 'backoffice.access' }));
