import React, { createContext, useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, ShieldCheck, UserRound, Check, LogOut } from 'lucide-react';
import { auth } from '../shared/services/auth';
import { call, preview, dateLabel, money } from './api';
import { Button, Field, ErrorBox, Empty, Badge } from './ui';
import { accountDestination, customerReturnUrl, signupUrl, hasBackOfficeAccess } from './customer-auth-model';

const CustomerContext = createContext(null);
export const useCustomer = () => useContext(CustomerContext);
let bootstrap;
export function CustomerProvider({ children }) {
  const [session, setSession] = useState(null), [ready, setReady] = useState(false), [profile, setProfile] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    bootstrap ||= preview ? Promise.resolve(null) : auth.init();
    bootstrap.catch(() => null).then(next => {
      if (!active) return;
      setSession(next); setReady(true);
      if (window.location.pathname === '/account/callback') {
        const params = new URLSearchParams(window.location.search);
        const dest = accountDestination(params.get('next') || sessionStorage.getItem('booking.auth.destination'));
        // A configured callback can use a different local hostname. Carry only service
        // choices across that boundary; contact details and private keys never enter URLs.
        const ids = (params.get('services') || '').split(',').map(Number).filter(n => Number.isSafeInteger(n) && n > 0).slice(0,4);
        if (dest === '/book' && ids.length && !sessionStorage.getItem('booking.draft')) sessionStorage.setItem('booking.draft', JSON.stringify({ ids, step: 1, expires: Date.now()+20*60*1000 }));
        sessionStorage.removeItem('booking.auth.destination');
        navigate(next ? dest : '/login', { replace: true });
      }
      if (next) call('account').then(data => { if (active) setProfile(data.profile); }).catch(() => {});
    });
    return () => { active = false; };
  }, []);
  const signIn = (signup = false, destination = '/account') => {
    if (preview) throw new Error('Customer accounts use Cloudgate. Open the connected app to sign in.');
    const dest = accountDestination(destination);
    sessionStorage.setItem('booking.auth.destination', dest);
    const callback = new URL(customerReturnUrl(import.meta.env.VITE_IDP_RETURN_URL, window.location.href));
    callback.searchParams.set('next', dest);
    if (dest === '/book') {
      try { const draft = JSON.parse(sessionStorage.getItem('booking.draft')); if (draft?.ids?.length) callback.searchParams.set('services', draft.ids.slice(0,4).join(',')); } catch {}
    }
    const login = auth.loginUrl(callback.href);
    if (!login) throw new Error('Customer authentication is not configured.');
    window.location.assign(signup ? signupUrl(login) : login);
  };
  const signOut = async () => {
    await auth.logout({ redirectToLogin: false });
    bootstrap = null; setSession(null); setProfile(null);
    localStorage.removeItem('studio.passes'); sessionStorage.removeItem('studio.return'); sessionStorage.removeItem('booking.draft');
    navigate('/', { replace: true });
  };
  return <CustomerContext.Provider value={{ ready, user: session?.user, canManage: preview || hasBackOfficeAccess(session?.user), profile, setProfile, signIn, signOut }}>{children}</CustomerContext.Provider>;
}

export function CustomerAccess() {
  const customer = useCustomer(), location = useLocation();
  const [error, setError] = useState('');
  const signup = location.pathname === '/signup';
  return <section className="customer-access"><div className="access-intro"><span className="eyebrow">YOUR TIME, SIMPLIFIED</span><h1>Good to see you.</h1><p>Make room for your next appointment.</p><div className="account-benefits"><p><CalendarDays/> All your appointments in one place</p><p><UserRound/> Your details, ready for next time</p><p><ShieldCheck/> Reschedule and cancel securely</p></div></div><div className="access-card"><UserRound size={30}/><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{signup ? 'Sign up for a customer account to save your details and manage your visits.' : 'Log in to see your appointments and book your next visit.'}</p><ErrorBox error={error}/>{customer.user ? <Link className="button" to="/account">Go to my account <ArrowRight size={17}/></Link> : <Button disabled={!customer.ready || preview} onClick={() => { try { customer.signIn(signup); } catch (e) { setError(e); } }}>{signup ? 'Create customer account' : 'Continue to log in'} <ArrowRight size={17}/></Button>}{preview && <p className="muted">Customer login and signup are available in the Cloudgate-connected app. Guest bookings work in this local preview.</p>}<p className="access-switch">{signup ? 'Already have an account?' : 'New here?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Sign up'}</Link></p><small>Secure sign-in provided by Cloudgate.</small><Link className="text-link guest-link" to="/book">Book as a guest <ArrowRight size={15}/></Link></div></section>;
}

export function CustomerAccount({ catalog }) {
  const customer = useCustomer();
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [saved, setSaved] = useState(false), [tab, setTab] = useState('upcoming');
  const refresh = async () => { setError(''); try { const next = await call('account'); setData(next); customer.setProfile(next.profile); } catch (e) { setError(e); } };
  useEffect(() => { if (customer.ready && customer.user) refresh(); }, [customer.ready, customer.user?.id]);
  if (!customer.ready) return <div className="loading">Loading your account…</div>;
  if (!customer.user) return <CustomerAccess/>;
  const upcoming = b => ['held','confirmed','arrived'].includes(b.status) && b.ends > Date.now()/1000 && (b.status !== 'held' || b.expires > Date.now()/1000);
  const bookings = (data?.bookings || []).filter(b => tab === 'upcoming' ? upcoming(b) : !upcoming(b)).sort((a,b) => tab === 'upcoming' ? a.starts-b.starts : b.starts-a.starts);
  return <section className="account-page"><div className="account-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>Hello, {data?.profile.name?.split(' ')[0] || 'there'}.</h1><p className="muted">A little less admin. A little more you.</p></div><Button secondary onClick={customer.signOut}><LogOut size={16}/> Log out</Button></div><ErrorBox error={error}/><div className="account-layout"><div><div className="section-title"><h2>My appointments</h2><Link className="text-link" to="/book">Book a visit <ArrowRight size={15}/></Link></div><div className="tabs" aria-label="Appointment history"><button className={tab==='upcoming'?'active':''} onClick={()=>setTab('upcoming')}>Upcoming</button><button className={tab==='past'?'active':''} onClick={()=>setTab('past')}>Past & cancelled</button></div>{!data ? <p>Loading appointments…</p> : !bookings.length ? <Empty title={tab==='upcoming'?'Your next visit starts here.':'No past appointments yet.'}>{tab==='upcoming'?'Once you book while signed in, your appointment will appear here.':'Your completed, cancelled and expired appointments will appear here.'}</Empty> : bookings.map(b => <article className="account-booking" key={b.reference}><div className="appointment-date"><CalendarDays size={22}/><strong>{dateLabel(b.starts,catalog.settings.timezone,{hour:undefined,minute:undefined})}</strong></div><div><Badge>{b.status==='held'&&b.expires<=Date.now()/1000?'expired':b.status}</Badge><h3>{b.items.map(i=>i.service_name).join(' + ')}</h3><p>{dateLabel(b.starts,catalog.settings.timezone)} · {b.items[0]?.staff_name}</p><small>{b.reference} · {money(b.total,b.currency)}</small><Link className="text-link" to={'/appointments?ref='+b.reference}>Manage appointment <ArrowRight size={15}/></Link></div></article>)}<details className="guest-booking-link"><summary>Booked as a guest? Add your appointment</summary><p>Use the private access key from your booking confirmation. You only need to do this once.</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const form=e.currentTarget;try{await call('account-link',Object.fromEntries(new FormData(form)));form.reset();await refresh();}catch(err){setError(err);}finally{setBusy(false);}}}><Field label="Booking reference"><input name="reference" required placeholder="ST-…" onChange={e=>{e.target.value=e.target.value.toUpperCase();}}/></Field><Field label="Private booking access key"><input name="token" type="password" required autoComplete="off"/></Field><Button busy={busy}>Add appointment</Button></form></details></div><aside className="profile-card"><h2>Your details</h2><p className="muted">Saved for your next booking.</p>{data&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setSaved(false);setError('');try{const r=await call('account-profile',Object.fromEntries(new FormData(e.currentTarget)));setData({...data,profile:r.profile});customer.setProfile(r.profile);setSaved(true);}catch(err){setError(err);}finally{setBusy(false);}}}><Field label="Full name"><input name="name" autoComplete="name" required minLength={2} defaultValue={data.profile.name}/></Field><Field label="Account email"><input type="email" value={data.profile.email} readOnly/><small>Your sign-in email is managed by Cloudgate.</small></Field><Field label="Phone number"><input name="phone" autoComplete="tel" type="tel" defaultValue={data.profile.phone}/></Field><Button busy={busy} secondary>Save details</Button>{saved&&<p role="status" className="profile-saved"><Check size={15}/> Details saved</p>}</form>}</aside></div></section>;
}
