# Cloudgate Jobs

Cloudgate App Store service-business app, version 1.0.0. React/Vite public website, customer portal and staff back office; native Cloudgate workflows, SQLite and Cloudgate Wallet. Built separately from Booking, Shop and POS.

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

## Authenticated sandbox verification � 2026-09-10

Jobs IdP admin login succeeded. All office sections rendered; a R950 draft quotation (QUO-943C8902BAF1) persisted through the published workflow. Existing settings saved successfully. jobs-icon.png uploaded to the Cloudgate media server and appeared in the library, left unused for review. The portal rendered using the admin session; this does not certify a separate customer or technician role. No quote was sent, payment taken, or email triggered by these checks. Full hosted customer/payment/refund, scheduler/SMTP and App Store install/update checks remain. Local development now uses the published sandbox via Git-ignored .env.local; npm run dev:preview still explicitly selects the simulated preview.

## Shared Cloudgate email delivery

Cloudgate delivers app email by default. Custom SMTP is optional and is configured through `/api/idp/{tenant}/admin/email-settings/details`, `update`, and `delete`, using an active Admin IdP bearer token. Settings are shared by tenant apps and environments. Passwords are encrypted and write-only. App-local `smtp_*` values are no longer read for delivery or edited by these controls; they are not automatically migrated over existing Cloudgate settings.

This release removes SMTP from App Store requirements and in-app setup checklists. Deploy the Cloudgate backend containing `WorkflowAppEmailSender.SendHtmlAsync` and the SMTP APIs before rolling out these app packages. Generated workflow bundles have been updated offline; existing installed workflows need the normal App Store update or reviewed MCP update/publication. No tenant settings or actual email delivery was changed while preparing this release.
