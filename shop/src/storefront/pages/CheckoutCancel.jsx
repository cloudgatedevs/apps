import { Link, useSearchParams } from 'react-router-dom';

/** The provider sends the customer here when they leave the payment page without paying. */
const CheckoutCancel = () => {
  const [params] = useSearchParams();
  const reference = params.get('ref');
  return (
    <div className="container-x py-16">
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="font-display text-3xl tracking-tight">Payment cancelled</h1>
        <p className="mt-2 text-zinc-600">
          Nothing was charged{reference ? <> for order <span className="font-mono">{reference}</span></> : null}. Your cart is exactly as you left it.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/cart" className="btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-0.5 h-4 w-4" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg><span>Back to cart</span></Link>
          <Link to="/shop" className="btn-ghost">Keep shopping</Link>
        </div>
      </div>
    </div>
  );
};

export { CheckoutCancel };
