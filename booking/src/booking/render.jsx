import { createRoot } from 'react-dom/client';

// Reuse the React root when Vite replaces an entry module during local editing.
export function renderApp(element) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(element);
}
