# Cloudgate Jobs

Cloudgate App Store service-business app, version 1.2.0. React/Vite public website, customer portal and staff back office; native Cloudgate workflows, SQLite and Cloudgate Wallet. Built separately from Booking, Shop and POS.

## Run locally

Requires Node 22.12+, Python 3.11+ and timezone data. Tested using Node 24 and Python 3.13.

```sh
npm install
python -m pip install -r requirements.txt
npm run dev:api
# In a second terminal:
npm run dev:preview
```

Public website: http://127.0.0.1:3010/. Customer portal: `/account`. Workspace: `/admin`.

The local preview banner switches between fictional customer, office and technician identities. Payments are explicit simulations and email is never sent. The loopback API checks host/origin and a preview header and must not be exposed to a network. Its database is `.local/jobs.sqlite`; images are `.local/media`. Hosted builds cannot enable these preview identities.

## Implemented journeys

- Branded public site, service catalog, authenticated customer requests, secure request photos and multiple service addresses.
- Office-created requests for customers; owner-controlled linking to an existing verified Cloudgate IdP customer account.
- Quote drafts, immutable revisions, optional extras, decimal quantities, discounts, configurable inclusive/exclusive/no tax, validity dates and deposits. Customer approval records the exact selected quote version and creates one job per request.
- Multi-visit jobs with multiple assigned workers, calendar, unavailability blocks, transactional overlap prevention, status changes, required checklists, internal/customer-visible notes and timers/manual time entries.
- Final invoices, verified deposit and balance payments, payment receipts, credit notes, invoice voiding and durable bounded refunds. PDFs and CSV exports are generated from authorised records.
- Weekly/monthly recurring jobs, month-end anchor handling, reminders and bounded SMTP/payment/refund workers.
- Operational reports and activity history. Owner, office, assigned-technician and customer access enforced inside the workflow domain engine.
- App/business name, logo, app icon, favicon, theme colours and homepage imagery. Cloudgate media library with uploads/cropping, reuse and guarded deletion. Team photos and personal IdP profile photos.

Customer photos are stored separately from public marketing media, in the Jobs database's attachment table. Every private download checks its parent request/job and visibility; no public URL is issued. Images are validated PNGs, maximum 1 MB and 2048 pixels per side. The browser normalises/resizes uploads. Private photos are not included in normal workspace snapshots. Branding/service media uses the existing Cloudgate IdP file server and remains publicly accessible by design.

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
| settings | Owner-only business/theme configuration; SMTP uses the IdP API |
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

## Build and package

```sh
npm test
npm run test:ui
node tests/media-browser.mjs
npm run build
npm run build:dev
npm run cloudgate:package
npm run banner
```

The two browser tests require both preview servers and create labelled local test records. They do not use real customers, money or email. The domain/native tests use isolated in-memory SQLite databases.

Both build modes emit `dist`. Static hosting must route `/admin` and its subpaths to `admin.html`, assets to their actual files, and other app paths to `index.html`. No Python or Node web server is required for the hosted frontend.

The manifest is synchronized between `jobs/template.json` and root `apps.json`. `.template/` contains generated workflow bundle, idempotent schema and sandbox-only sample data. Production begins with empty business records and default settings. Sandbox sample team records are not linked to real IdP account IDs; link accounts explicitly before testing staff access. No credentials, local database, dependencies or build output belong in the template source.

`cloudgate/package.py` generates graphs from an MCP-read prototype and reviewed live node IDs. `resources.json` contains the dedicated source-controller/database identifiers, not credentials. The importer remaps package resource IDs. Do not copy Booking resource IDs. Regenerating files does not update live drafts: validate and apply changes using MCP, then read them back.

## Current verification and release status

Implementation is available in source and the complete local preview. The 17 workflows are published in the connected Jobs tenant after explicit user approval. Their 121 node scripts were read back and compared with generated source before publication; all 17 endpoints were confirmed IsDraft=false afterward. Both Jobs database schemas exist; only sandbox has sample data.

Workflow publication is complete. Gateway checks returned HTTP 200 for sandbox and production catalogues, HTTP 401 for anonymous workspace/settings access, and HTTP 400 for direct calls to all four scheduler-only workers. Production has no sample services. See `cloudgate/hosted-smoke.json`. Frontend deployment has not been performed. The Cloudgate integration catalog reports gateway host `http://jobs.localhost:44301`. This is not evidence of a hosted installation or production readiness.

Before release: configure IdP return URL, gateway environment, Wallet and the live HTTPS site URL; verify real customer/staff login and private media; exercise a hosted sandbox request → quote → deposit → visit → invoice → balance/refund journey; test scheduler/SMTP delivery and App Store fresh installation/update. The current App Store installer publishes/releases imported workflows for new installations. No manual Kubernetes or image changes are needed or permitted by this project.

Local provider webhooks are unavailable according to the handover. Real Wallet confirmation/refund-ledger checks require a supported hosted sandbox; simulations and browser redirects cannot replace them. No real payment, refund or outbound email was sent during this build.

## V1 boundaries

This is a single-business, online-first V1. It does not implement route optimisation, offline sync, payroll, stock procurement, accounting integrations, two-way calendar sync, automatic recurring card charges or jurisdiction-specific tax certification. Recurrence creates work at the template price without recharging a card. Credit notes adjust billable balances separately from actual money refunds.

The current engine uses a bounded workspace snapshot with a 10,000-entity safety ceiling and a global write revision. This is a small-business baseline, not a high-volume storage design. Add record-scoped database queries, archival and pagination before large deployments. The original plan's domain-module and fully scoped-query architecture remains a follow-up; the implemented engine is centralized to keep preview/native rules identical.

PDFs use the standard jsPDF font set; English/Latin examples were visually checked. Public PNG/JPEG logos are embedded when the image service permits retrieval; inaccessible external logos fall back to the business name. Full multilingual typography and advanced tax-document layouts need further work. The website supports locally bundled web fonts and configurable imagery independently.

Existing backend and management UI source were inspected but not changed. Preserve the unrelated pre-existing backend `license-state.json` modification.

## Authenticated sandbox verification — 2026-09-10

Jobs IdP admin login succeeded. All office sections rendered; a R950 draft quotation (QUO-943C8902BAF1) persisted through the published workflow. Existing settings saved successfully. jobs-icon.png uploaded to the Cloudgate media server and appeared in the library, left unused for review. The portal rendered using the admin session; this does not certify a separate customer or technician role. No quote was sent, payment taken, or email triggered by these checks. Full hosted customer/payment/refund, scheduler/SMTP and App Store install/update checks remain. Local development now uses the published sandbox via Git-ignored .env.local; npm run dev:preview still explicitly selects the simulated preview.

## Shared Cloudgate email delivery

Cloudgate delivers app email by default. Custom SMTP is optional and is configured through `/api/idp/{tenant}/admin/email-settings/details`, `update`, and `delete`, using an active Admin IdP bearer token. Settings are shared by tenant apps and environments. Passwords are encrypted and write-only. App-local `smtp_*` values are no longer read for delivery or edited by these controls; they are not automatically migrated over existing Cloudgate settings.

This release removes SMTP from App Store requirements and in-app setup checklists. Deploy the Cloudgate backend containing `WorkflowAppEmailSender.SendHtmlAsync` and the SMTP APIs before rolling out these app packages. Generated workflow bundles have been updated offline; existing installed workflows need the normal App Store update or reviewed MCP update/publication. No tenant settings or actual email delivery was changed while preparing this release.

## Workflow logs in the back office (1.1.0)

**About & Powered by Cloudgate.** A *Powered by Cloudgate* badge in the workspace navigation opens **Administration → About** (office and owner roles): the app and its version, the tenancy this build talks to and links into the Cloudgate hub. Shared files `src/shared/CloudgateAbout.jsx` + `cloudgate-about.css`, the same in every App Store app.

**Administration → Logs** (owners only) shows every workflow call this app makes to Cloudgate — the public
site, the customer portal, the workspace and the scheduled `automation`, `notifications`, `reconcile` and
`refund-reconcile` workers — read from Cloudgate's own log store. Stat tiles (calls, success rate, errors,
average and p95 duration against the previous period), calls per hour/day, a per-action table and a paged
list with outcome / action / minimum-duration filters. The detail drawer shows one call's request and
response (masked when the action has *Mask data* on in Cloudgate) and its node-by-node session logs.

The page is `src/shared/CloudgateWorkflowLogs.jsx` (+ `cloudgate-workflow-logs.css`) and
`src/shared/services/workflowLogsApi.js`, the same files as in Shop, POS and Booking. It calls the IdP admin
API `POST /api/idp/{tenant}/admin/workflow-logs/{list|summary|get|nodes}` with the IdP bearer token (Admin
role required) and names its own scope from `VITE_CLOUDGATE_API_PROJECT` and `VITE_CLOUDGATE_API_ENV`; the
backend resolves that through the tenant's App Store installs. The local preview shows an explanatory empty
state. Requires a Cloudgate host with that API. Frontend only: no workflow or database change.

## Website analytics in the back office (1.2.0)

**Administration → Analytics** is available to Jobs owners, with an active Cloudgate Admin IdP account required by the API. It uses the same `WebAppAnalyticsService` calculations and recorded website traffic as the Hub's per-web-app Insights dashboard: views, sessions, signed-in visitors, previous-period comparisons, bounce rate, average session duration, pages, countries, referrers, devices, browsers and operating systems. Page and visitor lists are paginated; selecting a page filters visitor sessions. Signed-in visitors have a shortcut to their workflow calls in Logs. Anonymous visitors remain anonymous.

Reporting periods use UTC and match the Hub. Countries count recorded website activity, including session-ending events, while source and device breakdowns count page views. Counts may therefore differ between these breakdowns. The page follows the configured Jobs colours and supports narrow screens, keyboard navigation and reduced motion. No extra tracking script or third-party analytics service is installed.

The component is `src/shared/CloudgateAppAnalytics.jsx`. Its client uses the same IdP bearer authentication and one refresh on expiry as Logs:

| API | Response |
| --- | --- |
| `POST /api/idp/{tenant}/admin/analytics/overview` | Website identity, summary, countries, referrers and devices |
| `POST /api/idp/{tenant}/admin/analytics/pages` | `{totalCount, items}` grouped by page path |
| `POST /api/idp/{tenant}/admin/analytics/sessions` | `{totalCount, items}` for visitor sessions, optionally filtered by `pagePath` |

All requests include `projectPath`, `environment` (`sbx` or `prod`), and `timePeriod` (0 all time, 1 three months, 2 one month, 3 one week, 4 yesterday, 5 today, 6 last hour). List requests use `skip` and `take` (1–100). On a published site, `publishedWebAppId` and the analytics environment come automatically from Cloudgate's injected `__CG_ANALYTICS__` metadata or its same-origin `/cg-analytics.json`. Only the site ID and environment are used; its public beacon token does not authorize admin access. The server checks that the authenticated tenant owns the requested, non-deleted website. When public metadata is absent, it resolves the unique website from the tenant's App Store installation for the configured controller and environment. This supports local development against an installed site without adding an environment variable. Directly published sites should be verified at their hosted URL.

**Deployment:** deploy the Cloudgate server changes in `AppAnalyticsService.cs`, `IdpAuthController.AdminAnalytics.cs` and the controller constructor, then update Jobs to 1.2.0 and rebuild/publish it. No workflow publication or database migration is required. Older servers and missing website mappings show an explanatory message; they are not displayed as zero traffic. Preview mode does not request live analytics. Following verification in Jobs, this feature is also available in Shop 1.4.0, POS 1.3.0, Booking 1.9.0, Courses 1.2.0 and Events 1.2.0.

`npm test` includes the analytics client's authentication, metadata discovery, filter and UTC-window tests alongside the existing Jobs domain tests. Backend tests cover tenant/environment isolation, active Admin access, published-site ownership, ambiguous installations and reuse of Hub results.

## Back office navigation (1.0.2)

Compact grouped sidebar, navigation search, accessible mobile drawer, website shortcut and account controls. Administration provides Files & media (Cloudgate images and usage-aware cleanup), Email delivery (shared tenant SMTP with Cloudgate delivery by default), User management and Settings. Branding and Jobs business screens remain available.

User management uses tenant Admin IdP APIs for paginated search, details, create/update, enable/disable, confirmed deletion and confirmed password-reset emails. Calls use the current IdP bearer token with one refresh on expiry. Administrators are read-only here. Jobs team records and assignments remain separate from app identities. Preview does not change identities or send mail.

Validation: production build, 38 regression tests, cross-app metadata checks, isolated sidebar/mobile and mocked user CRUD browser checks. The browser scripts use a preview Vite server on port 3024 with mocked APIs. No real account changes or emails were made. Deployment requires the existing Cloudgate Admin IdP APIs; no additional workflow publication is needed for this frontend change.
