// "Powered by Cloudgate" badge + About page for the back office. Same file in every App Store
// app (Shop, POS, Booking, Jobs), self-contained like CloudgateWorkflowLogs.jsx: plain React,
// its own stylesheet, no router or UI-kit dependency.
//
//   <PoweredByCloudgate onOpen={…} />     sidebar badge (with the app version); opens the About page
//   <AppVersion />                         "v1.2.3" from template.json, for public footers
//   <CloudgateAbout />                     the page: app + version, tenancy, hub links
//
// Everything shown comes from the build's .env (the values the App Store filled in) plus the
// manifest (template.json) and the signed-in IdP profile — nothing is fetched from workflows.
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Boxes, Globe, LayoutDashboard, Mail, ShoppingBag, Users, Workflow } from 'lucide-react';
import { auth } from './services/auth';
import { getIdpProfile, getProfileDisplayName } from './auth/idpProfileApi';
import manifest from '../../template.json';
import './cloudgate-about.css';

const env = import.meta.env;
const trim = (v) => String(v ?? '').trim().replace(/\/+$/, '');
const hubUrl = trim(env.VITE_IDP_BASE_URL);
const idpApiUrl = trim(env.VITE_IDP_API_URL) || hubUrl;
const gatewayUrl = trim(env.VITE_CLOUDGATE_API_URL);
const apiEnv = String(env.VITE_CLOUDGATE_API_ENV ?? 'sbx').trim().replace(/^\/+|\/+$/g, '') || 'sbx';
const projectPath = String(env.VITE_CLOUDGATE_API_PROJECT ?? '').trim().replace(/^\/+|\/+$/g, '');
const isProduction = /^prod/i.test(apiEnv);
const preview = env.MODE === 'preview';
const hostOf = (url) => { try { return new URL(url).host; } catch { return url || '—'; } };

/** The installed app version, straight from the App Store manifest (template.json). */
export const appVersion = String(manifest?.version ?? '').trim();
export const appName = String(manifest?.name ?? '').trim();

/** Small "v1.2.3" label for footers; renders nothing when the manifest has no version. */
export function AppVersion({ prefix = 'v', className = '', title = `${appName || 'App'} version ${appVersion}` }) {
  if (!appVersion) return null;
  return <span className={`cg-version ${className}`} title={title}>{prefix}{appVersion}</span>;
}

/** Cloudgate's mark, inline so the badge never depends on a public asset path. */
export const CloudgateMark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 128.78 174.18" aria-hidden="true" focusable="false">
    <defs><linearGradient id="cg-mark-grad" x1="4.59" y1="154.92" x2="116.69" y2="42.82" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#3f5efb" /><stop offset="1" stopColor="#ec2f4b" /></linearGradient></defs>
    <path fill="url(#cg-mark-grad)" d="M115.38,142.37A12.77,12.77,0,0,0,99.13,139a77.88,77.88,0,0,1-75.06,0,12.8,12.8,0,0,0-12.23,22.5,103.6,103.6,0,0,0,99.53,0A12.82,12.82,0,0,0,115.38,142.37Zm.67-100.19a24.73,24.73,0,0,1-4.74.45A25.19,25.19,0,0,1,86.14,17.48a25.76,25.76,0,0,1,.17-2.93A61.58,61.58,0,0,0,24.48,120.09a61.57,61.57,0,0,0,91.57-77.91ZM83.3,99.69A36,36,0,1,1,97.62,71,35.86,35.86,0,0,1,83.3,99.69Z" />
    <path fill="#3f5efb" d="M128.78,17.48A17.46,17.46,0,0,1,111.55,35h-.24A17.48,17.48,0,0,1,93.85,18.5c0-.33,0-.68,0-1a17.48,17.48,0,1,1,35,0Z" />
  </svg>
);

/**
 * Sidebar badge. Pass `onOpen` to open the in-app About page (a button), or `href` to make it a
 * plain link (e.g. "/admin/about" in apps that use the router).
 */
export function PoweredByCloudgate({ onOpen, href, className = '', showVersion = true }) {
  const title = appVersion ? `${appName || 'This app'} v${appVersion} — about this app and Cloudgate` : 'About this app and Cloudgate';
  const inner = <><CloudgateMark size={16} /><span><small>Powered by</small><strong>Cloudgate</strong></span>{showVersion && appVersion ? <em className="cg-powered-version">v{appVersion}</em> : null}</>;
  if (href) return <a className={`cg-powered ${className}`} href={href} title={title}>{inner}</a>;
  return <button type="button" className={`cg-powered ${className}`} onClick={onOpen} title={title}>{inner}</button>;
}

const HUB_LINKS = [
  { label: 'Cloudgate hub', text: 'Your tenant home: controllers, apps, users and billing.', path: '/', icon: Globe },
  { label: 'Web Apps dashboard', text: 'Traffic, sessions and releases for this and your other apps.', path: '/web-apps/dashboard', icon: LayoutDashboard },
  { label: 'App Store', text: 'Update this app when a new version is published, or install another.', path: '/web-apps/app-store', icon: ShoppingBag },
  { label: 'Workflows', text: `The actions behind this app${projectPath ? ` (controller /${projectPath})` : ''}.`, path: '/flows/workflows', icon: Workflow },
  { label: 'App users', text: 'The identity provider accounts that sign in to this app.', path: '/web-apps/users', icon: Users },
  { label: 'Email delivery', text: 'Tenant-wide email settings; custom SMTP is optional.', path: '/flows/identity/email-settings', icon: Mail },
];

export function CloudgateAbout({ appName = manifest?.name, appVersion = manifest?.version, showTitle = true }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (preview) return undefined;
    let alive = true;
    const token = String(auth.authHeader?.()?.Authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return undefined;
    getIdpProfile(token, auth.tenancyName).then((p) => { if (alive && p && typeof p === 'object') setProfile(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const facts = [
    ['Tenancy', auth.tenancyName || '—'],
    ['Environment', isProduction ? 'Production' : 'Sandbox'],
    ['Controller', projectPath ? `/${projectPath}` : '—'],
    ['Workflow gateway', hostOf(gatewayUrl)],
    ['Identity provider', hostOf(idpApiUrl)],
    ['Signed in as', profile ? `${getProfileDisplayName(profile)}${profile.email ? ` · ${profile.email}` : ''}${profile.role ? ` (${profile.role})` : ''}` : preview ? 'Preview administrator' : '—'],
  ];

  return (
    <div className="cg-about">
      {showTitle ? <h2>About</h2> : null}
      <section className="cg-about-hero">
        <div className="cg-about-hero-mark"><CloudgateMark size={40} /></div>
        <div className="cg-about-hero-text">
          <p className="cg-about-eyebrow">Powered by Cloudgate</p>
          <h3>{appName || 'This app'} <span className="cg-about-version">v{appVersion || '—'}</span></h3>
          <p>{manifest?.description || 'Built on Cloudgate: sign-in through the tenant identity provider, workflow actions for every operation, Cloudgate Wallet for payments, tenant email delivery and hosted publishing.'}</p>
        </div>
      </section>

      <div className="cg-about-grid">
        <section className="cg-about-card">
          <h4>Your Cloudgate tenancy</h4>
          <p className="cg-about-muted">The environment this build talks to. Set by the App Store when the app was installed; edit <code>.env</code> to change it.</p>
          <dl>
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {preview ? <p className="cg-about-note">Local preview: this copy runs against a simulated backend and is not connected to a Cloudgate tenancy.</p> : null}
        </section>

        <section className="cg-about-card">
          <h4>Cloudgate hub</h4>
          <p className="cg-about-muted">{hubUrl ? <>Manage the tenancy at <a href={hubUrl} target="_blank" rel="noreferrer">{hostOf(hubUrl)}</a>. These links open the hub in a new tab; a Cloudgate account for the tenancy is required.</> : 'The hub URL is not configured for this build (VITE_IDP_BASE_URL).'}</p>
          <ul className="cg-about-links">
            {HUB_LINKS.map(({ label, text, path, icon: Icon }) => (
              <li key={path}>
                <a href={hubUrl ? `${hubUrl}${path}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!hubUrl} onClick={(e) => { if (!hubUrl) e.preventDefault(); }}>
                  <span className="cg-about-link-icon"><Icon size={16} /></span>
                  <span><strong>{label}</strong><small>{text}</small></span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </li>
            ))}
            <li>
              <a href="https://cloudgate.dev" target="_blank" rel="noreferrer">
                <span className="cg-about-link-icon"><BookOpen size={16} /></span>
                <span><strong>cloudgate.dev</strong><small>Documentation, platform terms and support.</small></span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </li>
          </ul>
        </section>
      </div>

      <section className="cg-about-card">
        <h4>What Cloudgate provides for this app</h4>
        <ul className="cg-about-facts">
          <li><Boxes size={15} /><span><strong>Workflows.</strong> Every operation — catalogue, orders, bookings, quotes, refunds — is a published workflow action under this app's controller. The Logs page shows each call.</span></li>
          <li><Users size={15} /><span><strong>Identity.</strong> Sign-in, roles and password recovery come from the tenant identity provider; administrators get this back office.</span></li>
          <li><ShoppingBag size={15} /><span><strong>Wallet.</strong> Card payments and refunds settle through the tenant's Cloudgate Wallet in sandbox or production.</span></li>
          <li><Mail size={15} /><span><strong>Email.</strong> Customer emails go out through Cloudgate delivery by default, or your own SMTP server when enabled under Settings.</span></li>
          <li><Globe size={15} /><span><strong>Hosting.</strong> The app is built and published from the hub; updates arrive through the App Store.</span></li>
        </ul>
      </section>
    </div>
  );
}
