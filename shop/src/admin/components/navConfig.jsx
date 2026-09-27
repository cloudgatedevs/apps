import { LayoutDashboard, Package, Tags, Boxes, Receipt, Users, FileText, Mail, Settings } from 'lucide-react';
export const IconProducts = Package;
export const IconCategories = Tags;
export const IconInventory = Boxes;
export const IconOrders = Receipt;
export const IconCustomers = Users;
export const IconPages = FileText;
export const IconMessages = Mail;
export const NAV = [
  ['/', 'Dashboard', LayoutDashboard], ['/products', 'Products', Package], ['/categories', 'Categories', Tags],
  ['/inventory', 'Inventory', Boxes], ['/orders', 'Orders', Receipt], ['/customers', 'Customers', Users],
  ['/pages', 'Store pages', FileText], ['/messages', 'Customer messages', Mail], ['/business', 'Shop settings', Settings],
].map(([to, label, icon]) => ({ to, label, icon, group: 'Commerce', permission: 'backoffice.access' }));
