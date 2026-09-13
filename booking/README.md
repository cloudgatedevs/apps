# Cloudgate Booking

A booking product derived from Cloudgate Shop: two React/Vite entry points, shared Cloudgate client and IdP integration, Python workflow business logic, SQLite, native Wallet Payment nodes, and App Store packaging. The separate Shop and POS refund template updates are documented in their respective `cloudgate/REFUNDS.md` files.

## Version 1.7.1 — Opaque back-office dialogs

Fixes transparent dialogs, form fields and panels in published builds. The back-office palette now uses an explicit light or dark base colour, avoiding undefined CSS variables generated when compiling `light-dark()`. Saved tenant colours are retained. Update the installed app through the App Store to rebuild and publish the corrected frontend.

## Version 1.7.0 — Refreshed back office

The default theme is black (`#000000`), neutral grey (`#737373`) and white (`#ffffff`), with neutral headers, navigation and image overlays. New installations use this palette. Existing saved colours are retained; use **Settings → Theme colours → Restore default colours**, then **Save business settings**, to switch an existing business to the new defaults. Custom palettes remain available.

**Settings → Homepage** is the first settings panel. Change the large background image behind the booking heading/search with Upload (including cropping), Library, or an image URL, then **Save changes**. A wide preview shows the chosen image. Homepage copy and the About photo are under the expandable section below it.

The workspace now shares the customer site's bold typography, rounded cards and consistent controls. A dark sidebar groups navigation into Workspace, Manage and Business. The overview brings together today's schedule, business readiness, team profiles and quick links. The same styling carries through services, media, calendar views, tables, reports, profile screens and edit forms.

Saved brand colours and photos remain in use. The navigation becomes a dismissible drawer on smaller screens, with keyboard focus management and hidden links removed from the tab order while closed. Browser hash navigation keeps the selected page in sync. The team-photo editor retains its square preview and adjacent controls, stacking them on phones.

This release changes frontend presentation only. Existing workflows and databases need no update. Validation and screenshots are recorded in the workspace release handoff.

## Version 1.6.0 — Team and personal profile photos

Open **Team & hours → Edit** to upload/crop, reuse a library image, replace or remove a team member photo. Photos appear on team cards, calendar columns and the public team list. Team members are scheduling records, independent of IdP login accounts. Media usage protection now includes active and inactive team members, and the library has a Team folder.

Open **My profile** in the workspace, or **My account → My profile** on the customer site, to upload, replace or remove your own IdP profile picture. Changes update the account avatar and sidebar immediately. Personal photos use the authenticated IdP profile API and do not require business media permissions.

The Cloudgate backend provides `PUT` (multipart `file`) and `DELETE /api/idp/{tenancyName}/profile/picture`. The target is always the active signed-in IdP user; the route tenant must match the signed identity. Uploads accept PNG/JPEG/WebP/GIF up to 5 MB and 4096 pixels per side, normalize to a single-frame PNG at most 512 pixels, and strip identifying metadata. `GET /profile` returns the photo URL. Public photo URLs serve only pictures currently attached to active users in the named tenant. Existing stock avatars remain supported. Replaced image bytes are retained; reference-aware storage cleanup is a separate maintenance task.

Existing installs need `cloudgate/migrations/1.6.0-team-photos.sql` before updating workflows. It is idempotent; fresh templates include the table. The migration is applied to the current Booking tenant's sandbox and production, and all six workflows are updated and published. Profile endpoints are compiled Cloudgate backend code and require that backend update; there is no extra photo workflow or IdpUser schema migration.

Validation: 98 Booking checks (79 Python, 19 JavaScript), nine IdP photo tests, and the Cloudgate host build pass. Native browser verification is recorded in the release handoff.

## Version 1.5.0 — Back-office media library

Open **Media** in the workspace to manage uploaded service photos, logos, icons and banners. The page uses the same authenticated Cloudgate IdP file service as Shop/POS. It supports multiple uploads with per-image cropping, Services/Branding/General library folders, search, usage filters, copying/opening image URLs, and confirmed individual or bulk deletion of unused images. Service and branding editors reuse this library.

Only `booking/...` folders appear in management; the existing image picker can still reuse images from the wider tenant library. All file-service pages are loaded before filtering. Usage checks cover saved services (including hidden services) and five branding/homepage image settings in the current booking environment. Retired services release their photos for cleanup. Deletion reloads file scope and current references before making authenticated host delete requests; it cannot atomically check references in other environments/apps or copied external links. Built-in `/images/...` assets are source files, not uploaded media.

Local preview supports matching folder metadata, listing and guarded deletion; its tests use isolated temporary files. No additional booking workflow or database migration is needed for this release. The six published workflows remain at the 1.4 service-capable implementation. Existing pre-1.4 installations still need the service migration described below.

Validation: 93 automated checks pass (75 Python, 18 JavaScript), production build passes. Native Cloudgate browsing, search, folder filters, URL copying and delete-confirmation cancellation were checked. Multiple uploads, crop/original image export, shared service-picker reuse and in-use protection were verified in an isolated preview. Desktop and phone layouts were visually checked; existing tenant files were not deleted.

## Version 1.4.0 — Services for any appointment business

Services now have individual photos with upload, cropping and media-library selection. Administrators can create, edit, hide and delete services, use custom categories, assign team members, set price and deposits, configure timing and optional resources, and add a booking question. Deleted services leave the catalog while existing appointment and payment history stays intact. Rescheduling uses the booked name, price, duration and buffer rather than later catalog edits.

Homepage copy and photos can be changed under Settings. Default controls use service, business and team terminology. The original spa catalog remains optional sample data; images are stored per service and are not inferred from category names.

Apply `cloudgate/migrations/1.4.0-services.sql` to existing databases before updating workflows. It is idempotent and is already applied to this local Cloudgate tenant's sandbox and production. Fresh installs include the schema automatically. The generated bundle still contains six workflows and 68 nodes. Validation: 83 tests pass, production build passes, and native image upload, service edits, public photo display and availability were verified in the browser.
## Run the complete local preview

Requires Node 22.12+ (tested on Node 24), Python 3.11+, and timezone data.

```sh
npm install
python -m pip install -r requirements.txt
npm run dev:api
# In a second terminal:
npm run dev:preview
```

- Customer site: http://127.0.0.1:3002/
- Admin workspace: http://127.0.0.1:3002/admin
- Local database: `.local/booking.sqlite`, persisted across restarts.
- Local preview uses a separate, clearly labelled simulated payment provider. No card data or money is involved. Development API binds to loopback, rejects foreign browser origins, and requires a preview header. Its administrator shortcut is development-only; do not expose that API to a network or use it in production.
- Preview emails are recorded in the outbox but are not sent.
- `npm run dev:preview` explicitly selects the local simulator even when a Cloudgate `.env` exists. `npm run dev` uses the configured Cloudgate environment when present. Production builds always use Cloudgate.

### Branding and theme

Open **Settings → Branding / Theme colours** in the workspace. Set the app name and short name, upload/crop or reuse a logo, app icon and favicon, and choose whether the app name appears beside the logo. Image URL fields support HTTPS and relative paths; local development image hosts are also accepted. Blank app names use the business name; removing icons restores the default leaf.

Primary, accent and background colours have colour pickers, hex inputs, a live preview and a restore-defaults button. Preview changes stay inside the preview until **Save studio settings**. Saving applies the palette and branding to the site, workspace, browser metadata and home-screen manifest, including other open tabs in the same browser. Text on primary buttons and page backgrounds adjusts for contrast. Decorative service/staff colours remain independently configurable.

Hosted images use the existing authenticated Cloudgate IdP file service in `booking/branding`. Local preview images are stored in `.local/media`; local image URLs are for preview only and must be uploaded to Cloudgate before use on a hosted site. Uploads preserve transparency, offer square/wide crops, resize to at most 1600 pixels (512 for icons) and export PNG under 4 MB.

### Local Wallet integration

Setting up the tenant Wallet enables hosted checkout, subject to its environment-specific
readiness. The preview above continues to use its simulated provider until configured for
Cloudgate. Provider webhooks are unavailable in the current local environment.

Cloudgate's current Wallet `get` operation reads its stored payment record; it does not query
the payment provider. Without webhooks, polling that operation cannot confirm a newly paid
hosted checkout locally. The refund `refund-status` operation can query the provider, while
Wallet ledger accounting still waits for webhooks. Keep simulated app tests and hosted
provider/ledger validation separate; a redirect alone is not payment confirmation.

## Implemented product

Version 1.3.0 adds a Booksy-inspired customer experience with an original photo hero, service search, category filters, price/duration sorting, service cards and responsive booking/account pages. Existing tenant logos, icons and theme settings remain configurable.

Customer **Log in / Sign up** uses the Booking tenant's hosted Cloudgate IdP, including its password recovery and registration flow. `/account/callback` consumes the IdP session and returns to the account or an in-progress booking. On a different callback hostname, selected services carry across and availability is selected again. The customer account provides saved name/phone details, upcoming/history views and account-authorized appointment management. Guest booking is still supported. Linking an existing guest appointment requires its private access key; matching an email never grants ownership. An appointment can belong to only one account. Front-desk reservations do not become the staff member's customer appointments.

Customer accounts require the connected Cloudgate environment (`npm run dev`); the isolated local preview retains guest checkout and explicitly explains that account authentication requires Cloudgate. Existing installations need `cloudgate/migrations/1.3.0-customer-accounts.sql` in both databases before updating the workflows. That migration and all six updated workflows have been applied and published for the current Booking tenant.

Version 1.2.0 adds app branding, separate icons, image uploads/media reuse, theme colours, live preview, browser/home-screen metadata and explicit local preview mode.

Version 1.1.0 adds an in-dashboard front-desk reservation wizard with existing-client lookup, server-checked availability, private payment links, and recoverable submission. The client pays from that link before confirmation. A released request is recorded so a delayed submission cannot create a replacement hold. The calendar now has a Monday–Sunday week view with staff filtering, multi-day leave, and appointment details. Both checkout flows display server-verified discounts, deposits, and balances; changed prices must be reviewed again.

Customer experience: configurable branded site; categorized treatments; multi-service appointments (up to four services with one qualified therapist); therapist or first-available selection; business-local slot availability; intake questions; contact details and marketing consent; promotion codes; secure booking access links; full payment or percentage deposits; hosted checkout; payment verification; appointment view, calendar download, rescheduling and cancellation; waitlist registration.

Back office: daily staff calendar, date and therapist filters; all appointments with search; check-in, completion and no-show states; cancellation and rescheduling; partial/full Wallet refunds; cash balance collection; client contact details, private notes and visit/payment history; service duration, cleanup buffer, pricing, deposits, intake and resource requirements; staff qualifications and weekly hours including split shifts; rooms; leave/blocked time; manual waitlist follow-up; expiring promotions; date-filtered financial and treatment reports; CSV exports; email outbox; business, booking-policy and SMTP settings; audit history.

Payment and scheduling rules: prices are computed on the server in integer minor units. Holds expire after a configurable interval. Confirmation requires a verified provider result with matching payment ID, amount and currency. Repeated successful polls do not double-charge the ledger. Late payment changes the booking to `payment_review` and does not take a slot from a later customer. SQLite triggers enforce staff/resource conflicts and blocked-time conflicts; a revision guard rejects mutations computed from stale snapshots. Rescheduling and allocations change in one transaction. Refund requests are claimed locally and use the same stable key in Cloudgate Wallet. The backend persists each intent and reserves its amount before provider submission. Only a succeeded result with matching payment, amount, currency and request key changes the booking ledger. Pending and uncertain refunds remain visible in the dashboard; the recovery worker and Check refund status action perform read-only provider checks. Retrying an existing request reuses its original key.

## Architecture

```
src/booking/main.jsx       Customer site and booking flow
src/booking/admin.jsx      Admin workspace
src/booking/style.css      Responsive design system
src/booking/api.js         Cloudgate / local API transport, money and calendar helpers
src/shared/               Reused Shop auth, client, file and UI infrastructure
cloudgate/engine.py        Pure snapshot -> SQL transaction plan and result
cloudgate/schema.sql       Tables, indexes, collision and revision guards
cloudgate/seed.sql         Local sample studio
cloudgate/local_server.py  Loopback test runtime, same engine and SQLite schema
cloudgate/package.py       Native Cloudgate graph and App Store bundle generation
cloudgate/notifications.py SMTP worker with bounded retries
cloudgate/workflows/       Six generated graphs and node scripts
.template/                Installable graph bundle, schema and sandbox sample data
tests/                    Domain, generated-workflow and browser tests
```

The native Python bridge reads request and prior-node values as data through `WorkflowSessionKeyExecutionContext.GetKeys(sessionId)`. It never embeds request bodies or customer text in executable Python. Only Cloudgate's platform-owned `sessionid` is substituted. SQL strings use UTF-8 hex literals, protecting both SQL quoting and Cloudgate placeholder expansion. This requires the Cloudgate host API verified in the local platform source, CPython/pythonnet, SQLite JSON functions and the `Web.Core.Shared` assembly.

## Native Cloudgate actions

All actions are POST under `/{sbx|prod}/{projectPath}/`.

| Action | Role |
|---|---|
| `booking` | Public catalog, slots, holds, management and waitlist; admin operations enforce the verified IdP role inside the engine |
| `checkout` | Verify booking access, then create an idempotent hosted Wallet checkout |
| `payment-status` | Read Wallet status, verify amount/currency, finalize once, queue email |
| `refund` | IdP administrator, claim/refund or read-only refund-status, validate actual Wallet response and record confirmed result |
| `reconcile` | Scheduled payment/refund recovery and hold expiry; separate gateway-protected worker |
| `notifications` | Scheduled SMTP outbox with bounded retry; separate gateway-protected worker |

Sandbox and production use separate SQLite files. Sample services, staff and rooms are applied to sandbox only. A production install begins with settings and an empty business catalog.

Current connected tenant: `booking` (ID `5072`, display name `WebApp-project-booking@cloudgate.dev`). Open **Controllers → Still Studio Booking** to see its six published workflows. Controller ID: `7bf672cf-2d01-474f-0df8-08df0d4ae348`. Both `/sbx/booking/…` and `/prod/booking/…` routes are callable. Sandbox contains sample services/team; the production catalog is empty. All 68 nodes were read back after publication and checked against the reviewed scripts and wiring. No hosted customer payment, refund or outgoing email has been performed.

The main `booking` workflow dispatches 20 public/admin operations through a shared Python engine (25 including internal operations). It serves catalog, availability, reservations and management plus the back-office entities/settings. The remaining five workflows isolate checkout, status, refunds, recovery and notifications. This is a compact implementation; splitting the main dispatcher by feature would improve workflow-level visibility and maintenance.

Requires the Cloudgate backend migration `20260908032127_Added_DurableRefundRequests` and Wallet `refund-status` support. Older Wallet builds are not compatible with this refund flow.

## Build and install

```sh
npm test
npm run test:ui     # Start both local servers first; adds labelled test records locally
npm run build
npm run cloudgate:package
```

`npm run build` produces `dist/`. Static hosting must route `/admin` and `/admin/*` to `admin.html`, and all other application routes to `index.html`. Actual assets must be served before these fallbacks. No Node or Python web server is needed for the production frontend.

The package is listed in the repository's `apps.json` and `booking/template.json`. For a new installation, review and publish the six imported drafts using the Cloudgate builder, configure IdP return URL and gateway environment, complete Wallet onboarding, set the live HTTPS website URL in Settings, add real services/team/hours/rooms, and configure SMTP. Confirm the two schedules are enabled in the intended environment after publication. Run a hosted sandbox booking, cancellation, recovery, and refund before switching to production. Never put SMTP or payment-provider secrets in Vite variables; gateway signing credentials are browser-visible and are not a substitute for IdP authorization.

## Validation and limits

The current `npm test` runs 54 Python tests and 8 JavaScript tests (62 total). Branding tests cover authorization, atomic validation, preservation of existing settings, safe asset URLs, removal/fallbacks, PNG storage and text contrast across 4,096 colours. The in-app browser verified cropping/upload, media reuse, separate icons, logo-only mode, dark/light palettes, save/reload, cross-tab updates and a 390px layout without horizontal overflow. Original preview settings were restored after verification. A real Booking IdP administrator login and sign-out/re-login were also verified. The callback now uses the configured origin with a clean `/admin` path, without query parameters or fragments, so the SDK can consume and remove the returned credentials. The six workflows are now published, and the signed-in workspace, public catalog, quotes, image uploads and branding saves work against Cloudgate sandbox. A native unpaid reservation was retried, checked and cancelled successfully; its slot was released. Settings saves cannot reset the internal concurrent-write revision.

Upgrades require `cloudgate/migrations/1.1.0-frontdesk.sql` and `cloudgate/migrations/1.2.0-branding.sql` before updating workflow scripts. Both are already applied to sandbox and production databases in the connected booking tenant and included in fresh installs. The six graphs were updated, published and read back to verify scripts and wiring. No drafts remain. The two background workers are configured to run every two minutes in both environments.

The regression suite covers collisions, stale writes, payment idempotency, late payment, server pricing, deposits, cancellation cutoff, refund bounds, access control, malicious-looking text round trips and sandbox/production data separation. Refund tests use the actual Cloudgate DTO fields and cover pending-to-success recovery, failed/uncertain results, response validation and read-only status checks. Generated native scripts and graph branches execute against SQLite with stubbed session and Wallet boundaries. Earlier browser checks covered booking, simulated payment, confirmation, rescheduling, check-in, completion, partial refund, all admin screens, service creation and hiding and waitlist. `node tests/refund-browser.mjs` checks pending-refund UI and stable-key recovery. Production build passes.

This is a substantial single-location booking V1, not full feature parity with every commercial salon platform. It does not include SMS/WhatsApp delivery, recurring memberships, gift-card liabilities, loyalty points, group-class capacity, marketplace discovery, payroll, multi-location operations, card-terminal integration, two-way Google/Outlook calendar sync, or staff self-service permissions. Waitlist matching/follow-up is manual. Reports are operational and do not constitute tax-accounting software. The calendar supports daily staff columns and a weekly appointment view. The backend currently loads a complete studio snapshot per action, suitable as a small-business baseline; high-volume deployment should add bounded queries and pagination. SMTP delivery is at least once; a crash after sending and before recording can produce a duplicate message. Refunds whose provider result is uncertain require manual reconciliation in Cloudgate Wallet.

Future upgrades should preserve the database conflict guards and add migrations, payment-provider integration tests, role-specific staff access, and worker telemetry before broadening the product.
