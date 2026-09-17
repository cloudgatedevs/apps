# Cloudgate Events

## Version 1.2.0 — Website analytics

**Back office → Analytics** (`/admin#analytics`) uses the same Cloudgate Web App Insights data and administrator authentication as the verified Jobs implementation. Includes views, sessions, signed-in visitors, previous-period comparisons, bounce rate, session duration, pages, countries, sources and device/browser breakdowns. Period filters, page and visitor pagination, and signed-in visitor workflow calls are included. The page and its dialogs follow this app's back-office theme.

Uses the existing `POST /api/idp/{tenant}/admin/analytics/{overview|pages|sessions}` APIs. The published website ID and analytics environment are derived automatically from Cloudgate's published metadata; local development falls back to the App Store installation mapping. Requests require an active Admin IdP user. No new environment settings, workflows or database migrations are needed. Update/rebuild the app on the Cloudgate server that already supports Jobs Analytics.

Run `npm run test:analytics` and `npm run build` before publishing. Shared Analytics source and client tests are copied unchanged from Jobs; app-specific styles live in `src/shared/cloudgate-app-analytics-theme.css`.

[Live app](https://events.app.cloudgate.dev/) · [Back office](https://events.app.cloudgate.dev/admin)

Events & Ticketing sample for the Cloudgate App Store. React frontend, native Cloudgate workflows, separate sandbox/production SQLite databases, hosted identity, Wallet payments and shared tenant services.

## Run locally

Install with `npm install`. Configure the values in `.env.example` in an ignored `.env`, using the Events tenant's gateway, IdP URLs and return URL. `npm run dev` serves the connected app at http://localhost:3006; `/admin` is the organiser workspace. Sign in through Cloudgate with an active built-in **Admin** app user. The current verification session runs at http://localhost:3007 with a matching return URL override.

For an isolated simulation, run `npm run dev:api` and `npm run dev:preview` in separate terminals. The development-only role switcher uses fake local identities. The simulator listens on loopback port 3016, writes `.local/events.sqlite`, and never sends real mail or charges money. Preview role selection is excluded from production builds.

## Visual design

Version 1.1 introduces the Nocturne editorial design: Instrument Serif display type, original theatre/gallery/supper imagery, an immersive storefront and a compact organiser console. Theme presets: Nocturne, Porcelain, Velvet, Botanical, Blue hour and Terracotta. Primary, accent and background colours remain individually editable. Only the previous untouched Signal default upgrades automatically; custom colour choices remain intact. Artwork and full generation prompts are documented in `artwork/ASSETS.md`.

## Website images

Generated photos are supplied separately in `events-artwork.zip` and `artwork/`, outside the deployed public folder. Upload them through Files & media, then select the Homepage hero and Editorial image under Settings → Theme & branding → Website imagery. Choose event-specific artwork under Events → Edit event. See `artwork/README.md` for the suggested image mapping. The site uses the saved media-server URLs; unconfigured image slots display neutral backgrounds or placeholders.

## Included

- Public event discovery, category/search filters, event details, ticket tiers, availability, waitlists and accessible event information.
- Server-priced capacity reservations, free bookings, hosted Wallet checkout, verified paid ticket issuance, downloadable QR images and an attendee account.
- Organiser overview, draft/published/archived/cancelled events, ticket tiers, bookings, attendees, full refunds, waitlists, staff assignments, reports and CSV exports.
- Online QR camera scanning or ticket-reference admission, event-scoped staff access, duplicate scan detection and administrator admission reversal.
- Shared Cloudgate files/media, tenant email settings, user management, account photos, workflow logs, About, branding and six editable colour presets.

Cloudgate sends email by default. SMTP setup is **not** an installation requirement. Custom SMTP is optional and shared by every app in the tenant across sandbox and production. Checkout automatically returns to the browser's website. The website URL in Settings is an optional override and supplies a fixed address for email links or server-initiated checkout.

## Booking and payment rules

Prices and capacity are checked in the workflows. Orders hold capacity for 15 minutes before checkout starts. An open provider checkout retains its reservation until the provider reports a terminal state. Tickets are issued only after a verified matching payment succeeds. Failed/expired payments release capacity; unexpected late success is flagged for review instead of overselling. Reservation, checkout, issuance and refund operations use idempotency keys.

Cancelling an event stops sales and voids admission; it does not silently issue refunds. Organisers review and refund paid bookings. Full refunds place tickets on hold before contacting Wallet. Admitted tickets must have admission reversed before refunding. Payment and refund workers reconcile unresolved provider states; the notification worker leases and retries queued mail.

## Packaging and validation

`npm test` runs booking, permissions, concurrency, admission, payment/refund and mail-queue tests. `npm run test:theme` checks theme contrast and overrides. `npm run test:hosted` checks public, authenticated and scheduler-only route boundaries without writes. `npm run build` produces `dist`.

`npm run cloudgate:package` regenerates 14 workflow graphs and `.template/` from the live-read node prototype and current engine. App Store metadata is in `template.json` and the repository's `apps.json`. Sandbox installation seeds sample events only; production starts with settings and no event/customer data. Workflow logging is enabled and masking disabled on every packaged workflow.

The sample implements general-admission ticketing, full refunds and online admission. It does not include reserved-seat maps, ticket transfers, partial refunds, offline scanner synchronisation or tax invoicing. The JSON-entity SQLite implementation rejects snapshots above 20,000 records; larger installations need indexed queries/pagination before raising that limit. Test the real payment provider, refund settlement and email delivery in hosted sandbox before a production launch.
