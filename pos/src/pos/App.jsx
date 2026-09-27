import { RequireAuth } from '@cloudgatedevs/cloudgate-client-react/react';
import { TillProvider } from '@/pos/state/TillProvider';
import { Shell } from '@/pos/components/Shell';
import { Register } from '@/pos/pages/Register';
import { Sales } from '@/pos/pages/Sales';
import { Returns } from '@/pos/pages/Returns';
import { ShiftPage } from '@/pos/pages/ShiftPage';

// All teller screens share one session/cart beneath the SDK's authentication provider.
const screens = { register: Register, sales: Sales, returns: Returns, shift: ShiftPage };
const App = ({ screen = 'register' }) => {
  const Screen = screens[screen] || Register;
  return <RequireAuth><div className="pos-ui"><TillProvider><Shell><Screen /></Shell></TillProvider></div></RequireAuth>;
};
export { App };
