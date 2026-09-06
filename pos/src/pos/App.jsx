import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/ui/menus';
import { AuthProvider, RequireAuth } from '@/shared/auth';
import { RequireTeller } from '@/pos/components/RequireTeller';
import { TillProvider } from '@/pos/state/TillProvider';
import { Shell } from '@/pos/components/Shell';
import { Register } from '@/pos/pages/Register';
import { Sales } from '@/pos/pages/Sales';
import { Returns } from '@/pos/pages/Returns';
import { ShiftPage } from '@/pos/pages/ShiftPage';
import { PayDone } from '@/pos/pages/PayDone';

// The till at /; the back office is a separate bundle at /admin. Sign-in is required for
// everything except the customer's "payment done" landing page.
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 3000, style: { fontFamily: 'inherit', fontSize: '14px' } }} />
        <Routes>
          <Route path="/pay/done" element={<PayDone kind="done" />} />
          <Route path="/pay/cancel" element={<PayDone kind="cancel" />} />
          <Route element={<RequireAuth />}>
            <Route element={<RequireTeller />}>
              <Route element={<TillProvider />}>
                <Route element={<Shell />}>
                  <Route path="/" element={<Register />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/returns" element={<Returns />} />
                  <Route path="/shift" element={<ShiftPage />} />
                </Route>
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
