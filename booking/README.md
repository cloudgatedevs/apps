# Cloudgate Booking

Booking 2.0 uses `@cloudgatedevs/cloudgate-client-react@^0.1.0`. This project contains the booking product; the package supplies shared Cloudgate functionality.

## Ownership

| This app | Cloudgate React SDK |
|---|---|
| Public service discovery and booking wizard | Authentication, session refresh and permission gates |
| Customer appointments, saved contact details and guest-booking claims | Personal profile, profile photos and account security |
| Overview, calendar, appointments, clients, services, team, rooms, waitlist and promotions | Back-office layout, navigation, responsive menu and developer/widget tools |
| Booking reports, appointment email outbox, business details and booking rules | Analytics, workflow logs, users, roles, registration and notifications |
| Service/team/homepage photo editors and image-reference checks | Media storage/library, appearance, theme, website settings, SMTP and payment administration |
| Python booking workflows, SQLite and Wallet orchestration | Native platform API clients |

There is no copied `src/shared` platform implementation. Extend Booking modules in `src/booking`; change shared functionality in the React SDK project and update the npm dependency here.

## Routes and configuration

`src/App.jsx` composes `CloudgateBackoffice` and one browser router. `/` is the customer website, `/book` is checkout, `/appointments` manages guest bookings, `/account` contains customer appointments and contact details, and `/account/profile` renders the SDK profile. Customer sign-in returns to `/account/callback`, preserving the booking destination and selected services.

The back office starts at `/admin`. Custom pages use `/admin/calendar`, `/admin/appointments`, `/admin/services`, etc. Booking-specific settings are at `/admin/business`; `/admin/settings` belongs to the SDK website settings. Hash-based admin routes and `admin.html` have been removed. Serve real assets first and fall back to **`index.html` for all application routes**, including `/admin/*`.

The SDK controls website access policy and self-registration. Back-office entry requires `backoffice.access`; shared pages also require their SDK permissions. Booking management additionally requires the verified `Admin`, `administrator` or `owner` role, matching the existing workflow authorization. Customer records and staff scheduling records remain distinct from IdP accounts.

Configure the values documented in `.env.example`:

- `VITE_CLOUDGATE_API_URL`, `VITE_CLOUDGATE_API_PROJECT`, `VITE_CLOUDGATE_API_ENV`: booking workflow gateway, controller path and `sbx`/`prod` environment.
- `VITE_IDP_BASE_URL`, `VITE_IDP_API_URL`, `VITE_IDP_TENANCY_NAME`: Cloudgate identity and native platform services.
- `VITE_CLOUDGATE_WEB_APP_ID`: rollout fills `{{webAppId}}` with this environment's app GUID. Use your local Booking app ID for connected development. Published sites also discover this from `cg-analytics.json`.
- `VITE_IDP_RETURN_URL`: optional configured origin for the customer callback; back-office sign-in returns to the requested admin page.
- `VITE_API_KEY`, `VITE_API_SECRET`: existing App Store workflow gateway signing configuration, when required. These are browser-visible and do not replace IdP authorization. Never put payment-provider or SMTP secrets in Vite variables.

App name, logo, icon, theme and browser metadata come from the SDK appearance settings. The business name, contact details, About text, homepage content and booking policy remain in Booking settings. Existing app-local branding values are not migrated to Cloudgate appearance; configure appearance through the SDK. No Booking database migration or workflow changes are required for this frontend release.

Image editors use the SDK file client and store files in `booking/media` or `booking/branding`. The shared Media page lists these folders. Before deletion, Booking checks a fresh snapshot of service, team and homepage references, plus SDK appearance references, and blocks removal of an image still in use. Personal profile photos use the SDK profile API. Local preview image URLs are only usable in the local simulator.

## Rollout defaults

`template.json` and the matching `apps.json` entry declare `appSettings`. New installs start
with a light Indigo theme, flexible layout, public booking pages enabled and guest access allowed.
The owner's chosen app name and deployment URL are used automatically. Branding, the full theme
palette and website access can then be changed in the SDK back office.

The backend validates these defaults before rollout and initializes native settings before building.
Sandbox and production have separate settings and web app IDs. Updates initialize missing native
settings but preserve every saved owner choice, including a disabled site or required visitor login.
Existing workflow-local branding is not imported. Use the [manifest contract](../README.md#native-sdk-defaults)
when packaging another app. Release the updated Cloudgate backend before using this manifest;
tenant registration, IdP return URLs, Wallet readiness and Booking business policies are separate setup.

## Local development

```sh
npm ci
npm run dev:api
# In a second terminal:
npm run dev:preview
```

Open `http://127.0.0.1:3002/` or `/admin`. The Python API runs on port 3003 with `.local/booking.sqlite`. Preview has a development-only administrator adapter, simulated payments and local PNG media storage. Its appearance changes are temporary. Customer login, analytics, email, real Wallet payments and other native platform features require a connected Cloudgate environment. The preview adapter is excluded from production builds.

For connected development, set `.env` and run `npm run dev`. Do not use the preview simulator for hosted payment verification. The Vite configuration accepts Cloudgate's generated `*.api.cloudgate.dev` preview hosts.

## Validation and build

```sh
npm test
npx playwright install chromium   # Once, if Chromium is not installed
npm run test:ui
npm run build
```

`npm test` checks the Python engine, generated workflows and frontend domain helpers. `test:ui` starts its own Vite server and isolated temporary SQLite API on ports 3292/3293, then cleans them up. It exercises checkout, payment confirmation, rescheduling, administrative actions, refunds, custom settings, media protection, responsive navigation and SDK integration. Native Cloudgate APIs are mocked for these tests; they do not mutate hosted data. Optional `BOOKING_TEST_OUTPUT_DIR` saves screenshots.

Production output is `dist/`. `npm run build:dev` produces a build with source maps. The App Store entry is in `../apps.json` and `template.json`; keep them in sync. Only run `npm run cloudgate:package` when regenerating the workflow bundle from the Python sources. Publishing or updating an installed app is a separate deployment step.

## Booking backend

The backend remains a snapshot-to-transaction Python engine with SQLite collision/revision guards. Prices use integer minor units, holds expire, and payments are confirmed only after checking the provider result's payment ID, amount and currency. A redirect alone is not payment confirmation. Late payments enter review instead of reclaiming an occupied slot. Refund intents reserve their amount and retain a stable request key; pending or uncertain results never become a successful ledger entry until verified.

All workflow actions are POST under `/{sbx|prod}/{projectPath}/`:

| Action | Purpose |
|---|---|
| `booking` | Catalog, availability, reservations, customer accounts and administrator operations |
| `checkout` | Create an idempotent hosted Wallet checkout after checking booking access |
| `payment-status` | Verify Wallet payment and finalize the booking once |
| `refund` | Administrator refund submission or read-only status recovery |
| `reconcile` | Scheduled payment/refund recovery and hold expiry |
| `notifications` | Scheduled appointment email delivery with bounded retries |

Sandbox and production use separate SQLite files; sandbox receives sample services, staff and rooms. Cloudgate handles outgoing email by default; optional SMTP configuration belongs to the SDK. Booking's email outbox shows appointment messages and delivery state.

Native scripts read request data through `WorkflowSessionKeyExecutionContext.GetKeys(sessionId)` and encode SQL values as UTF-8 hex literals. They require the Cloudgate Python bridge, SQLite JSON support and the existing Wallet durable-refund APIs. Preserve these boundaries and the generated-workflow tests when changing business logic.

This is a single-location booking app. Staff self-service permissions, recurring memberships, multi-location operations, calendar synchronization, payroll and SMS/WhatsApp delivery are not implemented. Waitlist follow-up is manual. The engine reads a full studio snapshot per action; larger deployments should add bounded queries. Email delivery is at least once, and uncertain provider refunds require reconciliation in Cloudgate Wallet.
