# Jobs implementation progress

2026-09-10: Source implementation and local verification complete. App lives in `D:/repos/GitHub/apps/jobs`. Root `apps.json` and `README.md` now include Jobs. Existing Booking, Shop and POS source was not changed.

## Completed

- Public business site, customer portal and separate responsive back office.
- Requests, addresses, quote revisions/optional extras/approval, jobs/visits/multiple staff, checklists, notes, time tracking, final invoices, credit notes, payments/refunds and PDFs.
- Owner/office/technician/customer permissions; customer account linking; private photo access and visibility.
- Custom branding, theme, icons and homepage images, hosted Cloudgate media library, team/profile photo support, locally bundled web fonts.
- Recurrence, reminders, outbox claims, scheduled SMTP/payment/refund workers; operational reporting and exports.
- Seventeen native workflows / 121 nodes built, validated, dry-run inspected and applied with Cloudgate MCP; every node script read back and matched to generated source.
- Dedicated sandbox and production database schemas. Fictional sample records only in sandbox, with no real customer/staff account bindings.
- Marketplace manifest, environment placeholders, idempotent schema, sample data, workflow bundle and screenshot banner.

## Verification

- `npm test`: 38 passing domain/native/package tests.
- `node tests/browser.mjs`: all workspace sections, public/customer flow, quote approval, simulated deposit, visit scheduling/completion, final invoice/PDF download, mobile overflow checks passed.
- `node tests/media-browser.mjs`: persisted theme/logo, in-use public-image deletion guard and cross-customer private-photo denial passed. Original branding restored.
- `npm run build` and `npm run build:dev`: passed, emitting `dist`.
- Invoice PDF rendered and visually reviewed; example subtotal 950, deposit applied 285, outstanding balance 665.
- `npm run banner`: actual running public view captured as 1540Ã—700 banner.
- `git diff --check`: no whitespace errors.

## Running preview

Public site http://127.0.0.1:3010/; portal `/account`; office `/admin`. Local API 3011, Vite 3010. Banner switches between fictional customer/office/technician. Test data remains in the isolated `.local/jobs.sqlite` and is not in production or the package.

## Release gate

User explicitly approved publication on 2026-09-10. All 17 workflows were published through MCP with dry_run=false and confirm_apply=true; list_endpoints verified every IsDraft=false. Sandbox and production catalogues returned HTTP 200. Anonymous workspace/settings returned HTTP 401, and direct calls to all four workers returned scheduler-only HTTP 400. Production catalogue contains no sample services. Evidence: cloudgate/mcp-verification.json and cloudgate/hosted-smoke.json.

Authenticated hosted checks require a Jobs customer/staff login; no authenticated browser session was available in the connected browser inventory. IdP roles, private media, Wallet/payment/refund states, scheduled execution/SMTP, and App Store installation/update still require hosted verification. No real payments, real refunds, outgoing email, Git push or hosted frontend deployment was performed. Use normal App Store/platform pipelines; no cluster interventions.

README documents V1 limits: bounded centralized snapshot (10,000 entities), online-first/single business, standard PDF fonts and hosted-only checks still outstanding. Do not describe this as production-certified or full commercial-platform parity.

Other processes/user work added unrelated backend and management UI changes during this build. None were edited, reverted or committed here; recheck their working trees before future platform work.

## Authenticated sandbox verification — 2026-09-10

Jobs IdP admin login succeeded. All office sections rendered; a R950 draft quotation (QUO-943C8902BAF1) persisted through the published workflow. Existing settings saved successfully. jobs-icon.png uploaded to the Cloudgate media server and appeared in the library, left unused for review. The portal rendered using the admin session; this does not certify a separate customer or technician role. No quote was sent, payment taken, or email triggered by these checks. Full hosted customer/payment/refund, scheduler/SMTP and App Store install/update checks remain. Local development now uses the published sandbox via Git-ignored .env.local; npm run dev:preview still explicitly selects the simulated preview.
