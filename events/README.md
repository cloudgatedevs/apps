# Cloudgate Events

Events 2.0.1 uses `@cloudgatedevs/cloudgate-client-react@0.1.6`, following Booking and Academy. The SDK owns shared platform features; this project owns events and ticketing.

## Ownership

| Events | Cloudgate React SDK |
|---|---|
| Public discovery, event details, ticket selection and attendee account | Authentication, token callbacks, refresh, profile and account security |
| Organiser overview, events, tiers, bookings, attendees and waitlists | Back-office shell, responsive navigation, widgets and developer tools |
| QR tickets, online admission, duplicate detection and admission reversal | Users, roles, registration, notifications, analytics and workflow logs |
| Event staff assignments, reports, refunds and event email outbox | Media storage/library, appearance, themes, website policy, SMTP and payment administration |
| Business/homepage settings, image editors and image-reference checks | Native platform API clients |
| Python workflows, SQLite and Wallet orchestration | Framework-independent gateway helpers, re-exported by the React SDK |

There is no copied `src/shared` platform implementation. Add ticketing features in `src/events`; maintain shared functionality in the React SDK project and update its npm dependency here. Event refunds remain a custom module because they must hold or revoke admission tickets and enforce admission reversal before refunding.

## Routes and permissions

`src/App.jsx` composes one browser router and `CloudgateBackoffice`.

- `/`: event discovery; `/event?id=...`: event details, tickets and waitlist.
- `/account`: bookings and QR passes; `/account/profile`: the SDK personal profile.
- `/admin`: organiser overview. Custom modules are `/admin/events`, `/admin/orders`, `/admin/attendees`, `/admin/checkin`, `/admin/waitlist`, `/admin/reports`, `/admin/staff`, `/admin/refunds`, `/admin/messages` and `/admin/business`.
- Shared routes include `/admin/profile`, `/admin/media`, `/admin/appearance`, `/admin/theme`, `/admin/settings`, `/admin/analytics`, `/admin/logs`, `/admin/users` and `/admin/roles`.

Serve real assets first, then fall back to **`index.html` for every application route**, including `/admin/*`. Old hash-based admin links are no longer used. The SDK controls whether the public site is enabled and whether visitors must sign in.

Back-office entry requires `backoffice.access`; shared SDK pages also require their corresponding permissions. Event workflows independently enforce the verified IdP role: `Admin`, `administrator` or `owner` manages the organiser workspace. Other active users can perform admission only for events assigned through an active staff record. Grant event staff `backoffice.access` using SDK Roles, then add their Cloudgate user ID and event assignments in Event staff. Attendees cannot enter the back office. The frontend does not grant permissions from a staff record.

## Run connected

Run `npm install`, configure `.env` from `.env.example`, then `npm run dev` (port 3006).

| Setting | Purpose |
|---|---|
| `VITE_CLOUDGATE_API_URL` | Workflow gateway origin |
| `VITE_CLOUDGATE_API_PROJECT` | Controller path, normally `events` |
| `VITE_CLOUDGATE_API_ENV` | `sbx` or `prod` |
| `VITE_IDP_BASE_URL` | Hosted Cloudgate sign-in origin |
| `VITE_IDP_API_URL` | Identity and native platform API origin |
| `VITE_IDP_TENANCY_NAME` | Tenant name |
| `VITE_CLOUDGATE_WEB_APP_ID` | This environment's Events web app GUID; rollout replaces `{{webAppId}}` |
| `VITE_API_KEY`, `VITE_API_SECRET` | Existing workflow gateway signing configuration, when required |

Gateway signing values are browser-visible and do not replace IdP authorization. Keep Wallet-provider and SMTP secrets on the server. Published sites also resolve their identity from `cg-analytics.json`. Local connected development needs an explicit Events app ID. SDK sign-in returns to the requested back-office page or attendee account.

## Appearance and website content

The SDK controls the app name, logo, icon, theme and browser metadata across the public site and back office. The Nocturne design retains its Instrument Serif headings and event layouts, with colours inherited from the SDK palette. Existing workflow-local branding is not imported; configure it through the SDK when upgrading an older installation.

**Event settings → Business details** contains business contact information, the optional payment-return URL and footer description. **Event settings → Homepage** contains the headline, introduction, homepage hero and editorial image. Event artwork remains under **Events → Edit event**. The generated artwork is supplied separately in `artwork/` and `events-artwork.zip`; see [image setup](artwork/README.md).

Image editors use SDK storage in `events/media` and `events/branding`. The SDK Media page lists those folders. Before deletion, Events checks fresh references from published, draft and unlisted events, homepage/editorial content, staff and native appearance. Images still in use cannot be removed through this app. Profile photos use the SDK profile API.

## Rollout

`template.json` and the matching `apps.json` entry declare version 2.0.1 and native `appSettings`: the complete Events Nocturne dark palette, flexible layout, public website enabled and guest access allowed. The installation supplies the chosen app name and deployment URL. Owners can change appearance, theme and website access in the SDK back office.

Sandbox and production have separate native settings and app IDs. App Store updates preserve saved owner choices, including a disabled public site or required visitor login. See the [native defaults contract](../README.md#native-sdk-defaults).

Sandbox uses **`npm run build:dev`** and `.env.development`; production uses **`npm run build`** and `.env.production`. Rollout writes only the selected environment's file, with its app ID and gateway keys. Both commands produce `dist`; development builds include source maps. The role-switching simulator is excluded from both release bundles.

This frontend migration leaves the 14 workflows, schema and deployed IDs unchanged. Use `npm run cloudgate:package` after workflow/schema changes to regenerate the installation bundle. Sample events are sandbox-only; new production databases contain settings but no event or customer records. See [deployment notes](cloudgate/DEPLOYMENT-NOTES.md).

## Ticketing rules

Workflows own prices and capacity. Reservations hold capacity for 15 minutes before checkout; an open provider checkout retains its hold until a terminal state is confirmed. Tickets are issued only after a matching verified payment succeeds. Unexpected late success is flagged for review. Reservation, checkout, issuance and refund operations retain their idempotency rules.

Cancellation stops sales and voids admission without automatically refunding paid bookings. Organisers review and refund those bookings. Full refunds hold tickets while processing; admitted tickets must have admission reversed first. Reconciliation and mail workers remain server-only. Cloudgate email is the default; custom SMTP is optional.

The app supports general admission, full refunds and online check-in. Seat maps, ticket transfers, partial refunds and offline scanning are outside this sample's scope. The existing SQLite snapshot guard rejects workspaces above 20,000 records; larger installations need indexed queries and pagination.

## Preview and verification

Run `npm run dev:api` and `npm run dev:preview` in separate terminals, then open `http://localhost:3006`. The loopback API on port 3016 uses `.local/events.sqlite`, fake identities, simulated payments and no outbound email. Development adapters support SDK profile, appearance and media; other native services require a connected tenant. Preview appearance changes reset on reload.

| Command | Checks |
|---|---|
| `npm test` | Domain/security regressions, image-reference protection and manifest consistency |
| `npm run test:ui` | Isolated event creation, reservations, payment/refund, QR download, admission, staff restrictions, responsive SDK pages, auth refresh and website access policy |
| `npm run test:hosted` | Read-only public catalogue and authenticated/scheduler route boundaries in sandbox and production |
| `npm run build:dev` | Sandbox release bundle |
| `npm run build` | Production release bundle |

Browser tests use a temporary database and their own API/Vite ports 3493/3492, then clean up. Install Chromium with `npx playwright install chromium` if needed. Native API integration checks use mocks; simulated payments and ticket-code entry do not validate real Wallet settlement, email delivery or physical camera hardware. Verify those in hosted sandbox before launch.
