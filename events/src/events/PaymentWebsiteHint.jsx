import React from 'react';

export default function PaymentWebsiteHint({ value }) {
  return <small className="muted" style={{display:'block',marginTop:6}}>
    {value?.trim()
      ? 'Payments return to this website. Clear it to use the website where checkout starts.'
      : 'Optional. Payments automatically return to the website where checkout starts. Set a URL to override it or provide a fixed address for email links.'}
  </small>;
}
