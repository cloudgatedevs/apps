# Cloudgate Academy

Academy 2.0 uses `@cloudgatedevs/cloudgate-client-react@^0.1.0`, following the Booking app. The SDK supplies shared Cloudgate features; this project owns the learning product.

## Ownership

| Academy | Cloudgate React SDK |
|---|---|
| Public catalogue, course details, learner portal and classroom | Authentication, session refresh, profile and account security |
| Courses, curriculum, immutable releases, enrolments, progress and quizzes | Back-office shell, responsive navigation, widgets and developer tools |
| Instructors, sessions, attendance, discussions and learning reports | Users, roles, registration, notifications, analytics and workflow logs |
| Certificates, course payments/refunds, Academy email outbox and business settings | Appearance, themes, website access, media storage/library, SMTP and payment administration |
| Course/homepage image editors and image-reference checks | Native Cloudgate platform API clients |
| Python workflows, SQLite schema and Wallet orchestration | Framework-independent gateway helpers, re-exported by the React SDK |

There is no copied `src/shared` platform implementation. Extend the learning features in `src/academy`; maintain shared features in the React SDK project and update its npm dependency here. Course payments remain separate because a course refund must end enrolment access and revoke the certificate.

## Routes and permissions

`src/App.jsx` composes one browser router with `CloudgateBackoffice`:

- `/`: public searchable catalogue; `/course?id=...`: course details and lesson previews.
- `/learn`: enrolments, checkout and classroom; `/learn/profile`: the SDK personal profile.
- `/certificate?code=...`: public certificate verification.
- `/admin`: Academy overview. Custom modules use `/admin/courses`, `/admin/enrollments`, `/admin/sessions`, `/admin/discussions`, `/admin/reports`, `/admin/instructors`, `/admin/course-payments`, `/admin/certificates`, `/admin/messages` and `/admin/business`.
- Shared pages include `/admin/profile`, `/admin/media`, `/admin/appearance`, `/admin/theme`, `/admin/settings`, `/admin/analytics`, `/admin/logs`, `/admin/users` and `/admin/roles`.

The SDK owns website access policy, sign-in redirects, token callbacks and logout. Serve real assets first, then fall back to **`index.html` for all application routes**, including `/admin/*`. Old hash-based admin routes are no longer used.

Back-office access requires the SDK permission `backoffice.access`. Shared pages require their corresponding SDK permissions. Academy workflows independently enforce the verified IdP role: `Admin`, `administrator` or `owner` manages the academy; an active instructor with the matching IdP user ID can teach assigned courses. For instructors, grant `backoffice.access` through the SDK Roles page, add the instructor record, and assign courses. Learners cannot enter the back office. The frontend does not manufacture permissions from an instructor record.

## Connected development

Run `npm install`, configure `.env` from `.env.example`, then `npm run dev` (port 3004).

| Setting | Purpose |
|---|---|
| `VITE_CLOUDGATE_API_URL` | Workflow gateway origin |
| `VITE_CLOUDGATE_API_PROJECT` | Controller path, normally `courses` |
| `VITE_CLOUDGATE_API_ENV` | `sbx` or `prod` |
| `VITE_IDP_BASE_URL` | Hosted Cloudgate sign-in origin |
| `VITE_IDP_API_URL` | Identity and native platform API origin |
| `VITE_IDP_TENANCY_NAME` | Tenant name |
| `VITE_CLOUDGATE_WEB_APP_ID` | This environment's web app GUID; rollout replaces `{{webAppId}}` |
| `VITE_API_KEY`, `VITE_API_SECRET` | Existing workflow gateway signing configuration, when required |

Gateway signing values are browser-visible and do not replace IdP authorization. Keep Wallet-provider and SMTP secrets on the server. Public deployments also resolve their app identity from `cg-analytics.json`. For local development, supply the Courses app ID explicitly. SDK sign-in returns to the current back-office page or the learner portal.

Native appearance settings control the app name, logo, icon and theme across the public site and back office. Academy settings retain the business name, contact details, certificate issuer, homepage content, currency, timezone and optional payment-return URL. Existing workflow-local branding is not imported. Configure branding through the SDK after updating an older installation.

Course and homepage uploads use the SDK file client in `courses/media` and `courses/branding`. Before deletion, the app checks fresh references from course drafts, published curriculum versions, instructors, homepage content and native appearance. An image still in use cannot be deleted through this app. Profile photos use the SDK profile API.

## Sandbox and production rollout

`template.json` and its matching entry in `apps.json` declare the native `appSettings` defaults:

- Academy Midnight dark theme with a complete configurable palette and flexible layout.
- Public website enabled, visitor sign-in optional.
- App name and deployment URL supplied from the installation.

The App Store initializes these native settings separately for sandbox and production. Updates preserve saved owner choices, including a disabled public site or required visitor login. The owner can change them later under the SDK Appearance, Theme and Website settings pages. See the [native defaults contract](../README.md#native-sdk-defaults).

Sandbox uses **`npm run build:dev`** and `.env.development`; production uses **`npm run build`** and `.env.production`. The App Store writes the file for the selected environment, including its own web app ID and gateway keys. Both commands generate a deployable `dist` directory. Development builds include source maps. The role-switching simulator is excluded from both release builds.

This frontend migration does not change the 13 Academy workflows or the database schema. Existing curricula and enrolments remain intact. New installations use `.template/workflow-template.json`, `.template/schema.sql` and sandbox-only sample data. Run `npm run cloudgate:package` after changing workflows or schema, not for a frontend-only update. See [deployment notes](cloudgate/DEPLOYMENT-NOTES.md).

Paid courses require Cloudgate Wallet configuration. Notification and reconciliation workers retain their server-only scheduling. Certificates record completion, not external accreditation.

## Local preview and checks

Run `npm run dev:api` and `npm run dev:preview` in separate terminals, then open `http://localhost:3004`. The loopback simulator uses `.local/academy.sqlite`, test identities, simulated payments and no outbound email. It also provides development-only adapters for SDK profile, appearance and media. Other platform features require a connected tenant. Preview appearance changes are in memory and reset on reload.

| Command | Checks |
|---|---|
| `npm test` | Domain/security regressions, image-reference protection and manifest consistency |
| `npm run test:ui` | Isolated browser learning/payment journeys, instructor restrictions, responsive SDK shell, native SDK composition with mocked APIs, session refresh and website access policy |
| `npm run test:hosted` | Read-only configured sandbox catalogue, preview and protected-route checks |
| `npm run build:dev` | Sandbox release bundle |
| `npm run build` | Production release bundle |

Browser tests start their own loopback API and Vite server on ports 3393/3392, use a temporary database, and remove it on exit. Install Playwright Chromium with `npx playwright install chromium` if it is unavailable. Mocked native API checks are separate from live administrator verification; simulated payments do not validate a real Wallet transaction.
