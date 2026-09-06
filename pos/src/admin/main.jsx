import '@/shared/ui/motion.css';
import './admin.css';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Back office entry (admin.html -> /admin/*). Session bootstrap (redirect
// tokens, refresh, bearer headers) is handled by @cloudgatedevs/cloudgate-client
// via src/shared/services/auth.js and the shared AuthProvider.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
