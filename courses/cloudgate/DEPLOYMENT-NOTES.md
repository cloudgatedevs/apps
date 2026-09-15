# Academy deployment

Tenant: `learner`. Controller: `courses` (Cloudgate Academy).

All 13 workflows are published. Live action IDs are recorded in `deployment.json`.
Sandbox has three example courses. Production has the schema and default settings,
but no course or learner records. Do not apply sample data to production.

The app uses the existing `.env` and runs at http://localhost:3004/.
The signed workflow base is http://learner.localhost:44301/sbx/courses.
Files, SMTP settings, users, and logs use the tenant IdP APIs with the current
administrator's bearer token. Cloudgate handles email delivery by default.

The notification and payment reconciliation workers run every two minutes and
reject direct public invocation. Payment creation requires a configured HTTPS
website URL for its return URL. No real charges, refunds, or test emails were sent
during verification.

## Verification

- `npm test`: 18 domain tests pass (ownership, permissions, payment validation,
  quiz limits, certificates, refunds, immutable curricula, SQL concurrency, media).
- `node tests/hosted-smoke.mjs`: live sandbox catalogue, preview, nine authenticated
  route guards and three scheduler-only guards pass.
- `npm run build`: production bundle builds.
- Browser: live catalogue and lesson preview render; hosted login targets learner.
- Isolated local preview: course creation, free enrolment, four completed lessons,
  passed assessment, valid certificate, settings and branding screens verified.

Live administrator verification passed for course and lesson creation, curriculum publication and archival, files listing, Cloudgate-default SMTP settings, user listing, and workflow logs. The verification course is archived in sandbox. Background worker success responses are visible in the live logs.
Live wallet transactions and outbound email delivery have not been exercised.

## Reproducible local testing

Run `npm run dev:api` and `npm run dev:preview -- --port 3005` for the separate
loopback simulator. Its role switcher and simulated payments exist only in Vite's
development preview mode. It never sends email or charges money.

Run `npm run cloudgate:package` after domain changes. The package is for new
installations; use MCP exports and preserve deployed IDs when updating this tenant.
