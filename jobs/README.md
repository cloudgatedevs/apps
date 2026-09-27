# Cloudgate Jobs

Jobs 2.0 uses `@cloudgatedevs/cloudgate-client-react@^0.1.0`, following Booking, Academy and Events. This project owns field-service workflows and customer pages. The SDK owns the shared back office.

## Ownership

| Jobs | Cloudgate React SDK |
|---|---|
| Public service catalogue, requests and customer account | Sign-in, callback tokens, refresh, profile and account security |
| Quotes, jobs, visits, scheduling, customers and service addresses | Back-office shell, navigation, widgets and developer tools |
| Invoices, receipts, credit notes, job payments and refunds | Users, roles, registration, notifications, analytics and workflow logs |
| Job team, services, recurring work, reports and business settings | Native media library/storage, appearance, themes, website policy and SMTP |
| Private request/job photos, PDF documents and image-reference checks | Shared native payment administration and platform API clients |
| Python workflows, SQLite and Wallet orchestration | Framework-independent gateway helpers, re-exported by the React SDK |

There is no copied `src/shared` platform implementation. Add Jobs features in `src/jobs`; maintain shared functionality in the React SDK project and update its npm dependency here. Job payments and refunds remain custom because they update deposits, invoice allocations, job balances and credit records.

## Routes and access

`src/App.jsx` composes a single browser router and `CloudgateBackoffice`.

- `/`: public website; `/request`: new customer request.
- `/account`: customer overview; `/account/requests`, `/account/quotes`, `/account/jobs`, `/account/invoices`, `/account/addresses` and `/account/calendar`: customer records. `/account/profile` uses the SDK profile.
- `/admin`: work overview; custom modules are `/admin/requests`, `/admin/quotes`, `/admin/jobs`, `/admin/calendar`, `/admin/customers`, `/admin/invoices`, `/admin/recurring`, `/admin/reports`, `/admin/services`, `/admin/team` and `/admin/business`.
- SDK routes include `/admin/profile`, `/admin/media`, `/admin/appearance`, `/admin/theme`, `/admin/settings`, `/admin/analytics`, `/admin/logs`, `/admin/users` and `/admin/roles`.

Serve actual assets first, then fall back to **`index.html` for all application routes**, including `/admin/*`. Separate `admin.html` and hash-based navigation are no longer used. The SDK enforces public-site enablement and required visitor login.

Back-office entry requires the native `backoffice.access` permission. Shared SDK pages also require their corresponding native permissions. Jobs workflows separately enforce owner, office, assigned-technician and customer access. Owner roles are `Admin`, `administrator` and `owner`; active team records can assign `manager`, `dispatcher` or `technician`. Customers see only their own records. Grant staff `backoffice.access` using SDK Roles, then link their Cloudgate user ID in **Job team**. A team record does not grant native SDK permissions.

## Run connected

Requires Node 22.12+; the local simulator and Python tests require Python 3.11+ and timezone data. Run `npm install`, configure `.env` from `.env.example`, then `npm run dev` on port **3010**. The former port 3002 is reserved for Booking.

| Setting | Purpose |
|---|---|
| `VITE_CLOUDGATE_API_URL` | Workflow gateway origin |
| `VITE_CLOUDGATE_API_PROJECT` | Controller path, normally `jobs` |
| `VITE_CLOUDGATE_API_ENV` | `sbx` or `prod` |
| `VITE_IDP_BASE_URL` | Cloudgate sign-in origin |
| `VITE_IDP_API_URL` | Identity and native platform API origin |
| `VITE_IDP_TENANCY_NAME` | Tenant name |
| `VITE_CLOUDGATE_WEB_APP_ID` | This environment's Jobs web app GUID; rollout replaces `{{webAppId}}` |
| `VITE_API_KEY`, `VITE_API_SECRET` | Workflow gateway signing configuration, when required |

Published apps also resolve their identity through `cg-analytics.json`; local connected development needs the Jobs app ID. The SDK returns sign-in to the requested workspace route, customer account or request form. Gateway signing values are browser-visible and do not replace IdP authorization. Wallet-provider and SMTP credentials stay on the server.

## Appearance, content and photos

The SDK controls app name, logo, icon, browser metadata, theme and website access. Jobs' public and custom workspace styles are scoped to `.jobs-ui` and inherit the SDK palette without styling SDK pages. The public footer displays **Powered by Cloudgate SDK** and its actual package version.

**Business settings → Business details** contains business contact/legal identity, payment-return URL, currency, timezone, tax and payment terms. **Homepage** contains the banner, headline, introduction and service area. SDK Appearance/Theme/Settings replace the copied branding and website controls. Existing workflow-local appearance values are not automatically imported into native settings. Document PDFs retain the legal business name and use the SDK logo and primary colour.

Service/team image editors use SDK storage under `jobs/media`; homepage imagery uses `jobs/branding`. Before a deletion through SDK Media, Jobs checks fresh references from all services, including hidden ones, team members, homepage content and native appearance. Partial technician/customer snapshots cannot authorise deletion.

Private request/job photos remain in the Jobs attachment table. Each upload/read/visibility change checks the parent record and authenticated identity; no public URL is issued. Images are validated PNGs, maximum 1 MB and 2048 pixels per side. The browser normalises/resizes uploads. Only attachment metadata appears in workspace snapshots. Customer photos are never uploaded to the public SDK media library. Personal profile photos use the SDK profile API.

## Rollout

`template.json` and the matching root `apps.json` entry declare version 2.0 and native `appSettings`: the full Jobs Evergreen light palette, flexible layout, public website enabled and guest access allowed. The installation supplies the selected app name and deployment URL. Owners can change theme, appearance and public-site policy in the SDK.

Sandbox and production have separate native settings and app IDs. Updates preserve saved owner choices, including a disabled public website. See the [native defaults contract](../README.md#native-sdk-defaults).

Sandbox uses **`npm run build:dev`** with `.env.development`; production uses **`npm run build`** with `.env.production`. Rollout writes the selected environment's configuration, including its web app ID. Both produce `dist`; development builds include source maps. Role-switching preview code is excluded from both release builds.

The migration leaves all 17 workflows, their schema and deployed resource IDs unchanged. Production starts with settings but no sample business records; sample services, requests and team records are sandbox-only. Link real staff IdP accounts explicitly. `npm run cloudgate:package` regenerates the installation bundle after workflow/schema changes; generation does not publish live drafts.

## Local simulator and tests

```sh
npm install
python -m pip install -r requirements.txt
npm run dev:api
# In another terminal:
npm run dev:preview
```

Open http://127.0.0.1:3010/. The loopback API runs on 3011. Preview explicitly requires Vite's `preview` mode; missing connection settings never silently enable fake identities. The preview banner switches between fictional customer, office and technician accounts. Payments are simulations and no email is sent. Native profile, appearance and media are simulated; other SDK administration requires a connected tenant.

The default database is `.local/jobs.sqlite`, with public preview images in `.local/media`. Use `python cloudgate/local_server.py --port 3011 --db .local/sdk-preview/jobs.sqlite` for an isolated review database and media folder. Never expose the preview API to a network.

```sh
npm test
npm run test:ui
node tests/hosted-smoke.mjs
npm run build
npm run build:dev
```

`npm test` exercises domain rules, native workflow generation, package consistency, SDK rollout defaults and media-reference protection. `test:ui` starts and stops its own isolated SQLite simulator and Vite server on ports 3593/3592. It checks customer/office/technician journeys, quotes, scheduling, simulated payments/refunds, private photos, service media, addresses, PDF downloads and responsive navigation. A connected-mode section mocks native APIs to verify SDK callbacks, refresh/retry, permissions, profile and public-site access policies. Set `JOBS_TEST_OUTPUT_DIR` to save screenshots.

`hosted-smoke.mjs` performs read-only checks against the running local Jobs gateway in both environments. Override `JOBS_GATEWAY` and `JOBS_PROJECT` if needed. It checks the public catalogue, protected routes and scheduler guards without authenticated writes, payments or email. A real logged-in Jobs session is still needed to verify connected SDK administration; real Wallet and email delivery require a hosted sandbox. This migration does not deploy the frontend or publish workflows.

## Native Cloudgate backend

The controller was created and all 17 workflows were created/updated through `mcp__cloudgate_local__*`, after validation and dry-run inspection. `cloudgate/mcp-verification.json` records read-back IDs and script comparison results. The controller is `Cloudgate Jobs`, path `jobs`.

| Workflow | Purpose |
|---|---|
| catalog | Anonymous public settings and active services |
| workspace | Identity-scoped customer/staff records |
| requests | Customer requests and office request management |
| quotes | Quote revisions, sending, customer pricing review and approval |
| jobs | Customers, addresses, team, services, visits, job updates and recurrence rules |
| invoices | Issue, void and credit invoices |
| settings | Owner-only business and homepage content; appearance and SMTP use SDK native APIs |
| documents | Authorised document snapshots for PDF download |
| attachments | Protected PNG upload, read and visibility |
| checkout | Idempotent native Wallet checkout |
| payment-status | Verified Wallet state and payment allocation |
| refund | Owner refund claim, submission and status recovery |
| maintenance | Owner-triggered recurrence/reminder maintenance |
| automation | Scheduled recurrence, expiry and reminder generation |
| notifications | Claim outbox messages, send via Cloudgate tenant email and record results |
| reconcile | Scheduled read-only Wallet payment recovery |
| refund-reconcile | Scheduled read-only refund recovery |

Native functions use `WorkflowSessionKeyExecutionContext.GetKeys` to read request/node values as data. They do not interpolate customer text into Python. SQL uses UTF-8 hex literals. Mutations use an atomic transaction and optimistic revision guard. Database triggers enforce worker-time collisions. Shared business rules run in the preview and generated native scripts.

Worker entry functions verify the platform-owned `route` session value is `Scheduled Job`, as supplied by `ExecutionJob`; external calls are rejected. Schedules are declared at two-minute intervals in the package, with bounded batches. SMTP delivery is at least once: a crash after provider delivery can lead to a retry. Queue claims reduce concurrent sends but cannot guarantee exactly-once email.

Money is stored in integer minor units. Wallet payment success requires DTO Status `1`, matching ID, gross amount and currency. A checkout redirect is not proof of payment. Refunds verify PaymentId, Amount, Currency, IdempotencyKey and RefundId. Pending/uncertain requests reserve their amount and reuse the same key. Late/superseded/cancelled payments are marked for review rather than allocated to new work.

## V1 boundaries

This is a single-business, online-first V1. It does not implement route optimisation, offline sync, payroll, stock procurement, accounting integrations, two-way calendar sync, automatic recurring card charges or jurisdiction-specific tax certification. Recurrence creates work at the template price without recharging a card. Credit notes adjust billable balances separately from actual money refunds.

The current engine uses a bounded workspace snapshot with a 10,000-entity safety ceiling and a global write revision. This is a small-business baseline, not a high-volume storage design. Add record-scoped database queries, archival and pagination before large deployments. The original plan's domain-module and fully scoped-query architecture remains a follow-up; the implemented engine is centralized to keep preview/native rules identical.

PDFs use the standard jsPDF font set; English/Latin examples were visually checked. Public PNG/JPEG logos are embedded when the image service permits retrieval; inaccessible external logos fall back to the business name. Full multilingual typography and advanced tax-document layouts need further work. The website supports locally bundled web fonts and configurable imagery independently.
