import '@/shared/ui/motion.css';
import './storefront.css';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Public storefront entry (index.html -> /). Customers may browse and buy
// without an account; signing in through the Cloudgate IdP is optional and
// handled by the shared AuthProvider.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
