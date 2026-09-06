import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="container-x py-24 text-center">
    <p className="text-6xl font-semibold text-zinc-200">404</p>
    <p className="mt-2 text-lg font-medium text-zinc-900">That page doesn’t exist.</p>
    <Link to="/" className="btn-primary mt-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to the shop</span></Link>
  </div>
);

export { NotFound };
