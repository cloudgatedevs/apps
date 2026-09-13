import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowUpRight, LoaderCircle, Wrench, Check } from 'lucide-react';
import { useBranding } from './branding';
import { brandIdentity } from './branding-model';
export function Brand({ settings, small = false }) {
 const saved = useBranding(), brand = brandIdentity(settings || saved || {}), [failed, setFailed] = useState(false);
 useEffect(() => setFailed(false), [brand.logo]);
 return <a className={'brand ' + (small ? 'small' : '')} href="/" aria-label={brand.name + ' home'} onClick={settings ? e => e.preventDefault() : undefined}>{brand.logo && !failed ? <img className="brand-logo" src={brand.logo} alt={brand.showName ? '' : brand.name} onError={() => setFailed(true)}/> : <span className="brand-mark"><Wrench size={20}/></span>}{(brand.showName || failed) && <span className="brand-name">{brand.name}</span>}</a>;
}
export function Button({ children, secondary, className = '', busy, ...props }) { return <button {...props} disabled={busy || props.disabled} className={(secondary ? 'button secondary ' : 'button ') + className}>{busy && <LoaderCircle size={16} className="spin"/>}{children}</button>; }
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function Empty({ title, children }) { return <div className="empty"><Wrench size={32}/><h3>{title}</h3><p>{children}</p></div>; }
export function ErrorBox({ error }) { return error ? <div className="error" role="alert">{error.message || error}</div> : null; }
export function Badge({ children, status }) { return <span className={'badge ' + (status || children)}>{String(children).replaceAll('_', ' ')}</span>; }
export function Modal({ title, children, close, wide }) {
 const ref=useRef(), closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{ const previous=document.activeElement,overflow=document.body.style.overflow; const handler=e=>{if([...document.querySelectorAll('.modal[role="dialog"]')].at(-1)!==ref.current)return;if(e.key==='Escape') closeRef.current(); if(e.key==='Tab'){const els=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}; document.addEventListener('keydown',handler);document.body.style.overflow='hidden';ref.current.querySelector('button')?.focus();return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={'modal '+(wide?'wide':'')}><header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X/></button></header>{children}</section></div>;
}
export function CheckLine({ children }) { return <span className="check-line"><Check size={15}/>{children}</span>; }
export function SectionTitle({ eyebrow, title, children }) { return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{children}</div>; }
