import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { imageUrl } from './branding-model';
import './services.css';

export default function ServicePhoto({ service, className = '' }) {
  const src = imageUrl(service.image_url), [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={'service-photo ' + className}>
    {src && !failed ? <img src={src} alt={service.name} loading="lazy" onError={() => setFailed(true)}/> : <span className="service-photo-placeholder" aria-label="No service photo"><ImageIcon size={28}/></span>}
  </span>;
}
