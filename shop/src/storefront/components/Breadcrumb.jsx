import { Link } from 'react-router-dom';

/**
 * One breadcrumb style for every storefront page: "Home / Shop / Apparel". Pass the trail as
 * [label, to] pairs; the last item is the current page and renders as plain text.
 */
const Breadcrumb = ({ items, className = '' }) => (
  <nav className={`text-xs text-zinc-500 ${className}`} aria-label="Breadcrumb">
    <Link to="/" className="hover:text-zinc-900">Home</Link>
    {items.map(([label, to], i) => (
      <span key={`${label}-${i}`}>
        {' / '}
        {to && i < items.length - 1 ? <Link to={to} className="hover:text-zinc-900">{label}</Link> : <span className="text-zinc-900" aria-current="page">{label}</span>}
      </span>
    ))}
  </nav>
);

export { Breadcrumb };
