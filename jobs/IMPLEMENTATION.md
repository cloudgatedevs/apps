# Cloudgate Jobs — repository analysis and implementation plan

Date: 2026-09-10. Status: planning complete; implementation not started.

## Objective and scope

Build an installable Cloudgate App Store app for service businesses: customer request → versioned quote approval → verified deposit → scheduled and assigned work → completion → final invoice → verified balance payment.

The handover supplies product context and constraints. This task authorizes repository analysis and planning; historical instructions inside that document are not treated as a new instruction to deploy or publish.

V1 includes a configurable public business website, authenticated customer portal, customers and multiple service addresses, quotes, invoices and downloadable PDFs, deposits and balances, team scheduling, checklists, notes, time tracking, completion photos, recurring jobs, reminders, operational reports, activity history, branding/media and marketplace packaging. Milestones below sequence this scope rather than remove it.

Proposed defaults: one business per installation, one configured currency and business timezone, multiple customer addresses, multiple workers and visits per job. No automatic card charging for recurring work; recurrence creates work that follows the normal billing process. Multi-branch operations, route optimisation, offline synchronisation, payroll, inventory procurement and external calendar synchronisation are later extensions. These are planning assumptions, not previously confirmed requirements.

## Current evidence

| Repository | Observed state | Responsibility |
|---|---|---|
| `D:/repos/GitHub/apps` | Clean tracked working tree; HEAD `69cb141`; Booking package 1.7.0; Jobs directory absent | Jobs frontend, domain/workflow code, local preview, tests and App Store package |
| `D:/repos/AzureDevOps/Cloudgate` | HEAD `027dadfa`; existing modified `src/Zero.Web.Host/App_Data/license-state.json` | Identity, files, Wallet execution, workflow runtime, App Store import/build/publish |
| `D:/repos/AzureDevOps/Cloudgate React` | Clean tracked working tree; HEAD `aa9448ac`; package 9.1.52 | Existing management UI, App Store wizard, workflow and platform administration |

No AGENTS.md files were found in the scanned repositories or checked ancestor directories. Leave the existing license-state change untouched. No source code, live resources or repository files were changed during this analysis. No test suites or builds were run; this is a source review, not a runtime certification.

Cloudgate local MCP is callable. A fresh `list_projects` returned only Default, path `api`, ID `04d1e884-079d-4bbb-aad1-08df0f0d38ef`. It does not identify the tenant name or establish Wallet readiness. Do not reuse Booking's controller/database IDs. Endpoint lists, hosted runtime and payment readiness were not revalidated in this task.

## Reuse and required changes

| Area | Evidence | Jobs approach |
|---|---|---|
| Frontend foundation | Booking has React/Vite customer and admin entry points, shared IdP client and responsive components | Selectively copy the foundation into `apps/jobs`; retain `/admin` routing and independent configuration |
| Branding and profiles | Booking has editable theme, logo/icon/favicon, image cropping, library and IdP profile UI | Adapt components and scope public marketing media to `jobs/...` |
| Authentication | Booking engine validates customer ownership and admin roles; team scheduling records are independent of login accounts | Introduce explicit staff-account membership and per-operation permissions; ownership checks on every customer record |
| Scheduling | SQLite allocation conflict triggers and stale-write guards exist | Adapt for job visits and multiple workers; enforce collisions on insert and update and retain transactional reassignment |
| Domain architecture | Booking loads all tables into a snapshot and uses a large dispatcher | Reuse safe SQL/session patterns, but split Jobs domain modules and use bounded, record-scoped reads and paginated lists |
| Payments | Wallet nodes support create/get/find/refund/refund-status/status and durable keys | Reuse verified-state and recovery patterns; add separate deposit/balance obligations and payment allocations |
| Packaging | Booking generator embeds controller/file IDs and a Booking UUID namespace | Parameterise resources, replace namespace/routes and inspect generated output for Booking references before importing |
| Installer | Current backend imports schema/sample data, renders environment files and publishes/releases new-install workflows | Test actual installer behaviour; do not follow stale manual-publication instructions in Booking README |
| Management UI | App Store page uses generic catalogue/install APIs and deployment wizard | Expect no Jobs-specific management UI changes; amend only demonstrated integration gaps |
| Private attachments | `IdpFilesController` returns public file/thumbnail URLs; access to upload/list/delete is permission controlled | Existing library is suitable for marketing assets, not private job attachments; resolve protected storage/download before attaching customer photos or PDFs |

The public-file finding is a concrete integration gap in the inspected reuse path, not proof that the entire platform has no private storage option. Search existing file mechanisms first. If none meet the need, implement a scoped backend extension with tenant and Jobs record access checks, and ship it through the normal pipeline.

## Product structure

Public site: business homepage, services, service area/contact information, request entry and sign-in. Proposed V1 request submission and photo upload require sign-in; customers can browse before signing in. This keeps ownership explicit without inheriting Booking's guest-claim complexity.

Customer portal: request status, addresses, quote review and optional selections, approval history, deposit/balance checkout, upcoming visits, customer-visible job progress, invoices/receipts and profile. Internal notes, worker-only photos and administrative financial data must never enter customer responses.

Staff workspace: overview, requests, quotes, jobs, calendar, customers, invoices/payments, recurring work, reports, media, team and business settings. Field staff get a mobile-focused assigned-work view with address, checklist, time entries, photos and completion actions.

Proposed permissions:

- Owner/admin: setup, memberships, all records, refunds and financial changes.
- Dispatcher/manager: customers, quotes, scheduling and job management; refund permission is separate and denied by default.
- Technician: assigned visits, relevant customer contact/address, own time entries and allowed job updates; no global customer lists or billing edits.
- Customer: records explicitly linked to their authenticated account.
- Internal worker: limited background operations through protected workflows, never a client-supplied role flag.

Use tenant-validated IdP identity, plus Jobs membership for app permissions. An email match must never grant account ownership. Confirm IdP role payloads and account-provisioning capabilities before finalising role integration.

## Proposed domain model

Use SQLite tables with explicit foreign keys, checks, useful indexes and the platform's `Id INTEGER PRIMARY KEY AUTOINCREMENT` convention. Names are proposed, not existing schema.

| Group | Records and invariants |
|---|---|
| Business | settings, service catalog, team members, staff memberships, working hours, leave/blocks |
| Customers | customers, customer-account links, service addresses; retain address snapshots on accepted/issued documents |
| Requests | work requests, requested services, attachment references; conversion links to the originating request |
| Quotes | quotes, immutable quote versions, line items/options, acceptance records; approval records exact version and selected extras |
| Work | jobs, visits, assignments, checklist items, notes with visibility, time entries and completion evidence |
| Billing | invoices, invoice lines, credit/void records, payment obligations, checkout attempts, payment allocations and refund requests |
| Automation | recurring job rules, generated occurrences, outbox messages, worker leases/retry state |
| History | attachment metadata, document snapshots and audit events with actor, time and entity version |

Money: integer minor units for stored amounts; fixed precision/decimal quantities and rates; one documented rounding order. Compute prices, discounts, tax, deposits and balances server-side. Snapshot business/customer details and tax configuration on issued documents. This is configurable operational billing, not a claim of jurisdiction-specific tax certification.

Quote states: draft → sent → accepted / declined / expired / superseded. Editing a sent quote creates a new version. Acceptance uses an expected version and idempotency key and creates at most one linked job.

Job states: awaiting deposit (when required) → ready to schedule → scheduled → in progress → completed; cancelled is an explicit transition with separate financial resolution. A job can have multiple visits. Completing one visit does not automatically finish all work. Job status and invoice/payment status remain separate.

Invoice states: draft → issued → partially paid → paid, with controlled void/credit handling. Overdue is derived from due date and outstanding amount. Issued documents are immutable; corrections preserve history. Apply a deposit once against the linked bill, not as a second sale. Preserve received-payment and refund ledgers separately and explicitly handle overpayments and unresolved payments.

Concurrency: unique business request keys, atomic transitions and revision checks. Schedule all assigned workers together in one transaction. Record UTC instants, display in business timezone and test daylight-saving boundaries. Recurrence has a unique rule/occurrence key, a bounded generation horizon, explicit month-end policy and pause/skip/edit-future behaviour.

## Workflow and runtime design

Keep React/Vite static hosting, Python domain logic and SQLite through native Cloudgate workflows. Use feature modules under `cloudgate/domain/` for requests, quotes, jobs, scheduling, invoices, payments, access and reports. The preview runner and native workflows must execute the same business rules.

Proposed workflow boundaries: public catalog; customer portal; staff requests/quotes; jobs/scheduling; invoices; checkout; payment-status; refund; reconciliation; reminders/recurrence. Final action count depends on live node models, execution cost and maintainability. Do not blindly preserve Booking's six-action layout.

Before graph generation, read live execution/database/node models and a real exported graph. Build using validated node shapes, inspect dry runs, validate generated graphs and read back applied drafts. Bind fresh Jobs resources and maintain sandbox/production separation. Exclude local credentials, databases, generated build output and dependencies from the copy/template.

Use request-local session values as data rather than interpolating customer content into Python. SQL plans must preserve safe quoting/parameter handling and atomic rollback. Scoped queries must enforce identity before returning data, with bounded worker batches and paginated administrative lists.

Wallet flow: persist the obligation/attempt → create checkout with durable key → obtain verified Wallet state → validate payment identity, amount, currency and environment → allocate once. Return URLs only navigate. Delayed/duplicate events and payments against superseded obligations require an explicit review path. Reserve refundable amounts before provider submission; retries reuse the original key; uncertain refunds stay unresolved until verified.

Private files: authorise upload and download against tenant, account membership, job assignment and visibility. Do not grant customers the broad business media-management permission. Validate file types/sizes; preserve reference ownership; prevent unauthorised attachment reuse or public discovery. Prefer authenticated download rather than permanent public URLs. Determine the platform implementation in milestone 1.

PDFs: create actual downloadable PDFs from immutable, server-authorised quote/invoice snapshots, including branding, numbering, dates, line items, selected extras, tax, deposits and balance. Select rendering approach after a small runtime/Unicode/pagination spike. A print button alone does not meet this requirement.

Notifications: persisted outbox with dedupe keys and bounded retries; preview captures messages without delivery. Document at-least-once delivery limits. Recurrence and reminders need restart-safe worker claims, bounded batches and observable failures.

## Implementation milestones and acceptance gates

### 1. Isolated foundation and integration decisions

Create `apps/jobs` from an allowlist of Booking foundation files. Add implementation/progress documents in the app, separate names, routes, media prefix, UUID namespace and `.local/jobs.sqlite`. Proposed preview ports are 3010/3011, subject to availability. Add clean environment examples and sample identities for local customer/staff permission testing. Resolve private attachment access, staff membership and PDF rendering design. Confirm current tenant/resource scope before any live creation.

Gate: independent customer/admin shell runs; both build modes emit `dist`; no source-tenant secrets/IDs or Booking configuration are carried into distributable output; platform gaps are documented with concrete implementation paths.

### 2. First complete business journey

Implement customer/address/request records, quote versions and approval, deposit obligation/verification, a scheduled assigned visit, completion, invoice issue and balance settlement. Build corresponding customer and staff screens, basic document PDFs and protected attachment support needed by that journey.

Gate: one complete local simulated journey using real domain/storage code. Duplicate approval cannot create duplicate jobs; quote changes cannot alter accepted terms; deposit allocation cannot be counted twice; unauthorised account/technician requests fail server-side. Hosted identity and payment remain separate checks.

### 3. Full working-job operations

Add multi-visit jobs, multiple assignees, day/week calendar, leave and conflict handling, checklists, internal/customer-visible notes, timers/manual time records and completion photos. Add clear cancellation and reschedule paths with audit events.

Gate: concurrent conflicting assignments are rejected without partial changes; technicians only access assigned work; customer views hide internal content; phone layouts support on-site updates.

### 4. Billing and operational automation

Complete optional extras, discounts, tax modes, partial payments, refunds and recovery, document correction/credit handling, recurring jobs, email reminders and operational reports. Reports distinguish quoted, invoiced, collected, refunded and outstanding amounts.

Gate: financial invariants pass failure/retry tests; PDF totals match persisted documents; recurrence reruns create no duplicates; worker failure does not silently lose pending work; reminder scheduling respects timezone and cancellation state.

### 5. Product finish and marketplace package

Complete public homepage/service content, branding/icons, shared public media, profiles, empty states, onboarding and realistic service-business sandbox data. Produce synchronized `jobs/template.json` and `apps.json` entry, supported `.env.example`, workflow template, idempotent schema and sandbox-only samples. Capture the 11:5 banner from the running Jobs app. Update root catalogue documentation only when the app is ready to be listed.

Gate: package inspection, fresh-install and repeat-migration checks, production/sandbox builds, desktop/phone visual review, accessible forms/dialogs and no advertised unfinished features.

### 6. Hosted sandbox verification and release readiness

Verify current platform deployment supports every used API. Exercise genuine IdP ownership/roles, private attachment access, workflow execution, payment confirmation, refund recovery, documents, schedules, static route fallback and App Store installation/update in an appropriate isolated sandbox. New App Store installs currently publish/release imported workflows; account for that before invoking installation.

Gate: hosted results recorded separately from local simulations; environment separation and update data preservation demonstrated; all hosted-only limitations are explicit. Local provider webhooks are unavailable according to the handover, so simulated checkout or redirects cannot close the real-payment verification gate. No manual cluster/image interventions.

## Verification priorities

- Cross-customer, cross-tenant and unassigned-technician access, including direct attachment/document URLs.
- Stale quote acceptance, double conversion, price/tax snapshot integrity and invoice numbering under concurrency.
- Multiple workers/visits, leave overlap, update-time collisions, transactional rescheduling and timezone edge cases.
- Duplicate checkout/status/refund requests; wrong amount/currency/payment; late success; partial refunds and uncertain provider outcomes.
- Lost updates, failed SQL plans and recovery after worker/process restart.
- Recurrence uniqueness, month-end rules, cancellation, reminder dedupe and overdue calculations.
- Unicode and multi-page PDFs, responsive customer/staff journeys, keyboard access and useful error recovery.
- Native generated scripts against SQLite with mocked platform boundaries, followed by real hosted sandbox integration checks.
- Idempotent schema installation, sandbox-only sample records, production empty-business setup and upgrades that preserve business data.

Run targeted platform tests/builds only if platform source changes. Run existing-app regressions when shared behaviour is affected. Preserve Booking, Shop and POS and avoid unrelated refactors.

## Risks and unresolved implementation facts

1. Tenant name, hosted deployment version and Wallet readiness are not established by the MCP controller listing.
2. Protected attachments are the earliest potential backend dependency; existing public media APIs cannot simply be reused for private documents.
3. Staff account binding/provisioning needs verification against actual IdP payloads; Booking's admin-only workspace is insufficient for field staff.
4. Booking's full-database snapshot and global revision approach will become costly for longer-lived Jobs history; use bounded access from the start.
5. Existing README validation counts/publication instructions mix historical releases. Source and newly run checks take precedence.
6. PDF rendering, worker provisioning through packaging, and clean install/upgrade behaviour need implementation spikes/tests, not assumptions.

## Source map for resumption

All paths below are relative to their repository roots named above.

Apps: `README.md`, `booking/package.json`, `booking/README.md`, `booking/template.json`, `booking/vite.config.js`, `booking/src/shared/auth/roles.js`, `booking/cloudgate/engine.py`, `booking/cloudgate/schema.sql`, `booking/cloudgate/local_server.py`, `booking/cloudgate/package.py`. Booking shared auth/media/branding/calendar and workflow/test files were inventoried for reuse. A source text search in Shop/POS did not locate a PDF implementation to reuse; it was not a full audit of those apps.

Backend: `src/Services/Web/Web.Core.Shared/Services/WebApps/WebAppService.AppStore.cs`, `src/Services/Web/Web.Core.Shared/Services/Nodes/NodeLibrary/Nodes/WalletPayment.cs`, `src/Services/Web/Web.Core.Shared/Services/Endpoints/Engine/EngineService.cs`, `src/Zero.Web.Core/Controllers/IdpFilesController.cs`. Related IdP profile, session-context, App Store update and test files were located for follow-up.

Management UI: `package.json`, `src/pages/web-apps/app-store/AppStorePage.jsx`; follow its existing `DeployWizard`, `appStoreApi` and progress integration when testing rollout.

Next executable milestone: foundation plus private-file/staff/PDF integration decisions, then the first complete request-to-paid-invoice journey. Maintain this scope and record actual progress inside Jobs once implementation begins.
