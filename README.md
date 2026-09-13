# Cloudgate Apps

Fully built apps for the [Cloudgate](https://cloudgate.dev) **App Store** (hub → Web Apps → App Store).
Unlike the [skeleton templates](https://github.com/cloudgatedevs/app-templates), these are complete
products: the hub runs a guided roll-out that checks the tenant (wallet, identity, builds), records the
accepted terms, imports the app's workflows and databases, builds the app and publishes it to a live URL.

| App | Folder | What it is | Requirements |
| --- | --- | --- | --- |
| [Cloudgate Shop](./shop/) | [`shop/`](./shop/) | Online store with hosted card checkout through Cloudgate Wallet and a full back office. | Wallet, IdP, WebSockets |
| [Cloudgate Booking](./booking/) | [`booking/`](./booking/) | Service appointments, staff and room scheduling, paid booking confirmation, customer management and a studio back office. | Wallet, IdP |
| [Cloudgate Jobs](./jobs/) | [`jobs/`](./jobs/) | Service requests, quotes, job visits, invoices and a customer/staff workspace with custom branding and media. Source package and local preview available; hosted release verification pending. | Wallet, IdP |

An app only appears in the store once it is listed in [`apps.json`](./apps.json).

## Anatomy of an app

```
<app>/
  template.json                  # the same object as its apps.json entry (kept in sync)
  banner.png                     # catalogue image, 11:5, captured from the running app
  .env.example                   # {{placeholders}} the roll-out fills for the tenant and environment
  .template/workflow-template.json   # the controller exported as a template bundle
  .template/schema.sql           # applied to every database the bundle creates
  .template/sample-data.sql      # applied to sandbox databases only
  src/, package.json …           # the app itself; `npm run build` must produce the output folder
```

### Manifest fields beyond a skeleton template

| Field | Purpose |
| --- | --- |
| `category`, `version`, `features[]` | Card content. |
| `adminPath` | Back-office path appended to the live URL on the result screen. |
| `requirements[]` | `wallet`, `idp`, `websockets`: drives the readiness checks. |
| `environments[]` | `sandbox` and/or `production`. |
| `terms` | `{ version, url, summary[] }`: must be accepted; the version is recorded on the install. |
| `compliance[]` | `{ key, label, text, environment }` checkboxes; `environment` is `sandbox`, `production` or `all`. |
| `build` | `installCommand`, `buildCommand` (production), `devBuildCommand` (sandbox, e.g. `npm run build:dev` = Vite development mode) and `outputDir`. |
| `workflows` | `projectPath` (controller path, suffixed when taken), `file`, `schema`, `sampleData`. |

### Environment files

The roll-out renders **`.env.development`** (sandbox gateway slot, `{{environment}}` = `sbx`) and
**`.env.production`** (`prod`) from `.env.example`. Vite picks the file by build mode: `vite build`
reads `.env.production`, `vite build --mode development` (the `build:dev` script) reads
`.env.development`. Sandbox roll-outs therefore build with `devBuildCommand`; production with
`buildCommand`. The same holds when you publish from Web Apps: the wizard defaults to `build:dev`
for sandbox apps.

### `.env.example` placeholders

`{{hubUrl}}`, `{{apiUrl}}`, `{{workflowGatewayUrl}}`, `{{tenancyName}}`, `{{apiKey}}`, `{{apiSecret}}`
(shared with Quick Start) plus `{{environment}}` (`sbx`/`prod`), `{{projectPath}}` (the controller path
actually used), `{{appBaseUrl}}` and `{{idpReturnUrl}}` (the live URL) and `{{wsPassword}}` (a fresh
password for the first basic-auth WebSocket channel in the bundle).

## Packaging an app

From the app folder, after deploying its workflows to the source tenant:

```bash
python cloudgate/bundle.py     # exports the controller bundle + splits the SQL
npm run banner                 # captures banner.png from http://localhost:3000
```

Production builds are served as static files from the `build.outputDir` folder.

## Updating an installed app

Bump `version` in `apps.json` (and the app's `template.json`) and push. Tenants that installed an
older version see **Update to vX** on the card. The update replaces the app's source folder
(keeping `.env*` and `node_modules`), refreshes the controller's endpoints in place (the importer
matches by route and keeps the databases), applies `schema.sql` to the existing databases (write it
idempotently: `IF NOT EXISTS`, guarded `ALTER TABLE`), reuses existing WebSocket channels by route,
then rebuilds and republishes on the same web app. The wizard warns that any local changes to the
source or the workflows are overwritten.

App email uses Cloudgate delivery by default. Custom SMTP is an optional tenant override in the back office, not an App Store readiness requirement. App manifests must not list `smtp` as a rollout prerequisite.
