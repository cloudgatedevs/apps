# Cloudgate Academy

## Version 1.2.0 — Website analytics

**Back office → Analytics** (`/admin#analytics`) uses the same Cloudgate Web App Insights data and administrator authentication as the verified Jobs implementation. Includes views, sessions, signed-in visitors, previous-period comparisons, bounce rate, session duration, pages, countries, sources and device/browser breakdowns. Period filters, page and visitor pagination, and signed-in visitor workflow calls are included. The page and its dialogs follow this app's back-office theme.

Uses the existing `POST /api/idp/{tenant}/admin/analytics/{overview|pages|sessions}` APIs. The published website ID and analytics environment are derived automatically from Cloudgate's published metadata; local development falls back to the App Store installation mapping. Requests require an active Admin IdP user. No new environment settings, workflows or database migrations are needed. Update/rebuild the app on the Cloudgate server that already supports Jobs Analytics.

Run `npm run test:analytics` and `npm run build` before publishing. Shared Analytics source and client tests are copied unchanged from Jobs; app-specific styles live in `src/shared/cloudgate-app-analytics-theme.css`.

Courses and training sample app for the Cloudgate App Store. Includes a public
catalogue, learner portal, course editor, quizzes, completion certificates,
instructor assignments, live sessions, attendance, discussions, and back office.

The back office integrates Cloudgate files, tenant email settings, user
management, workflow logs, wallet payments/refunds, branding and About.

## Run

Install dependencies with `npm install`. Set the `.env` values shown in
`.env.example`, then run `npm run dev` (port 3004). The tenant must contain the
published native workflows and database schema; see
[deployment notes](cloudgate/DEPLOYMENT-NOTES.md).

For an isolated preview, run `npm run dev:api` and
`npm run dev:preview -- --port 3005`. This mode uses a loopback SQLite database,
test identities and simulated payments; it never sends emails.

## Checks and packaging

- `npm test`: domain invariants and security regression tests.
- `npm run test:hosted`: read-only sandbox checks using your configured gateway.
- `npm run build`: production frontend bundle.
- `npm run cloudgate:package`: regenerate the 13 native workflow graphs and
  `.template` install bundle. Use sample data only in sandbox.

Paid courses require Cloudgate Wallet configuration. Checkout automatically
returns to the browser's website; the website URL setting is an optional override
and a fixed address for email links or server-initiated checkout.
SMTP defaults to Cloudgate; custom SMTP is optional. Certificates
record course completion, not external accreditation. SCORM, proctoring and
subscription billing are outside this sample's scope.

## Themes (v1.1.0)

Open **Settings → Theme & branding** in the back office. Choose Midnight,
Studio, Atelier, Evergreen, Dune or Amethyst, then optionally edit each primary,
accent and background colour. The preview updates immediately; **Save settings**
applies the palette to the public website, classroom and back office. Individual
edits are labelled Custom palette. Text contrast and surface shades are derived
from your choices. Midnight is the default for new installations.

Run `npm run test:theme` to verify preset contrast, matching and custom overrides.
