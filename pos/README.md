# Cloudgate POS 2.0

POS uses `@cloudgatedevs/cloudgate-client-react` for authentication and the shared back office. The app owns the retail workflows and the cashier till. One Vite SPA serves both from `index.html`.

| Area | Routes | Responsibility |
| --- | --- | --- |
| Cashier till | `/`, `/sales`, `/returns`, `/shift` | Barcode scanning, cart, parked sales, cash and Wallet checkout, receipts, returns, cash movements and closing shifts |
| Retail back office | `/admin`, `/admin/products`, `/admin/inventory`, `/admin/sales`, etc. | Products, categories, stock, suppliers, customers, registers, teller activity, retail reports and sales/shift detail |
| POS settings | `/admin/business` | Legal receipt identity, currency, tax, receipt text/numbering, payment methods and till rules |
| Shared back office | `/admin/appearance`, `/admin/theme`, `/admin/users`, `/admin/roles`, `/admin/media`, `/admin/analytics`, `/admin/logs`, etc. | SDK appearance, theme, identity, users/roles, media, website settings, email configuration, notifications and developer tools |
| Cashier profile | `/account/profile` | SDK profile, available to signed-in tellers without back-office access |
| Customer payment return | `/pay/done`, `/pay/cancel` | Public customer phone return; the cashier independently checks Wallet status |

The SDK requires native `backoffice.access` permission for the back office and its feature permissions for shared pages. Retail modules additionally require the POS Admin role, also checked by their workflows. Any active signed-in IdP user can use the till. “Teller activity” is the retail sales/shift history; account administration lives in the SDK Users page.

## Run and build

```bash
npm install
npm run dev          # http://localhost:3001 and /admin
npm run build:dev    # sandbox build, development mode, dist/
npm run build        # production build, production mode, dist/
```

Copy `.env.example` to `.env` and replace the placeholders with your local tenant values. Set `VITE_CLOUDGATE_WEB_APP_ID` to the POS web app ID so the SDK can load app-specific settings. Published app metadata can also resolve its identity. The workflow request base is `{VITE_CLOUDGATE_API_URL}/{VITE_CLOUDGATE_API_ENV}/{VITE_CLOUDGATE_API_PROJECT}`. The default controller path is `pos`; use the assigned path if installation adds a suffix. Restart Vite after environment changes.

Use `.env.development` with `VITE_CLOUDGATE_API_ENV=sbx` for sandbox and `.env.production` with `VITE_CLOUDGATE_API_ENV=prod` for production. Each file must contain the matching tenant, app identity, gateway and signing credentials. Vite also loads `.env` and `.env.local`; avoid conflicting overrides. Build mode selects files, it does not automatically change an explicitly configured API environment.

Cloudgate previews under `.api.cloudgate.dev` are allowed by Vite. Serve the generated SPA with an `index.html` fallback for `/admin/*`, till paths and `/pay/*`.

## App Store rollout

`template.json` and the POS entry in `../apps.json` carry the same version, development/production build commands, workflow package and native `appSettings` defaults. The rollout fills `{{webAppId}}`, tenant, controller and environment credentials in the Vite configuration. Defaults enable the website with sign-in required, which makes the cashier till available while keeping it private. Payment return pages remain public even if the website is disabled.

The POS Slate palette and compact back-office layout are native SDK settings. The till follows the same colours and appearance, including the app name/logo. Legal business details printed on receipts remain in POS settings. Browser receipts use the SDK logo; the existing receipt-email workflow and its business data remain in the workflow package.

Product photos upload through the SDK to `pos/media`; shared branding uses `pos/branding`. The app checks fresh product references (including inactive products) and native appearance before allowing deletion through its media UI. This is an app-side guard, not a transactional server-side foreign-key constraint.

## Validation

```bash
npm test             # real SQLite refund regressions, client recovery, media guard and rollout checks
npx playwright install chromium  # once, if Chromium is not installed
npm run test:ui      # isolated SQLite workflows + browser SDK integration
```

The browser test starts temporary loopback servers on 3594/3595, uses a new temporary database, and shuts them down afterwards. It simulates native SDK services, identity and Wallet responses. It does not call a live tenant, charge a card or send email. Real camera hardware, receipt printers and hosted payment settlement still require testing in the configured environment.

## Backend

Everything under [`cloudgate/`](./cloudgate/README.md): the `pos_db` schema and seed, the deployer, and one folder
per workflow action. Every action requires the tenant API key (the client signs each request) **and** an IdP bearer
token; till actions accept any signed-in user, admin actions only the admin roles (`require_teller` / `require_admin`).

| Action | Who | Ops |
| --- | --- | --- |
| `pos-catalog` | any user | `settings`, `categories`, `products` (category, search), `lookup` (barcode, alias barcode or SKU → product + pack quantity) |
| `pos-shift` | any user | `registers`, `current`, `open` (register + float), `movement` (payin/payout/drop), `close` (counted cash → expected, difference), `summary` |
| `pos-sale` | any user | `complete` (lines + cash payments, server-priced, stock checked and written), `create` (open sale for a card payment), `hold`/`held`/`recall`/`discard`, `get` (id or reference), `recent`; refunds use `refunds` |
| `pos-payment` | any user | `start` (Wallet Payment `create` → hosted URL for the QR code), `status` (re-reads the wallet payment; completes the sale and sells the stock on success), `cancel`, `wallet-status`; refunds use `refunds` |
| `pos-receipt` | any user | `email` (receipt e-mail through Cloudgate tenant delivery, on a thread branch) |
| `admin-products` | admin | `list`, `get`, `create`, `update`, `set-status`, `delete` (deactivates sold products), `add-barcode`, `remove-barcode`, `barcode-owner`, `labels`, `import` (CSV rows, upsert by barcode/SKU/name), `image-refs` |
| `admin-categories`, `admin-suppliers`, `admin-registers`, `admin-customers` | admin | `list`, `create`, `update`, `delete` (+ `reorder` for categories, `get` for customers) |
| `admin-inventory` | admin | `levels`, `movements`, `adjust` (delta or new quantity, with reason), `receive` (goods received note), `receipts`, `receipt`, `count` (stock take) |
| `admin-sales` | admin | `list` (status, dates, teller, register, shift, search), `get`, `void` (open/parked); refunds use `refunds` |
| `admin-shifts` | admin | `list`, `get` (Z report with movements), `force-close` |
| `admin-tellers` | admin | `list` (derived from shifts and sales) |
| `admin-dashboard` | admin | `stats`, `by-hour`, `by-day`, `top`, `by-teller`, `by-category`, `by-method`, `recent`, `wallet-status` |
| `admin-reports` | admin | `summary`, `products`, `categories`, `tellers`, `methods`, `tax`, `z-reports` for a date range |
| `admin-settings` | admin | Business settings: `get`, `set`; email transport is configured in the SDK |

Workflows publish small events on the Cloudgate WebSocket channel **`pos-events`** (`sale.completed`, `sale.refunded`,
`stock.adjusted`); the till and the back office subscribe with Basic credentials from `.env` and refetch.

## Payments

Cash is settled in one call (`pos-sale complete`) with tendered amount and change. Card payments create the sale
open, start a Cloudgate Wallet checkout for the outstanding amount and show the hosted page as a **QR code** the
customer scans with their phone (or opens on a customer-facing display); the till polls `pos-payment status` until
the wallet reports success, then the sale completes and stock is written. The customer lands on `/pay/done` or
`/pay/cancel` (the only public pages). Refunds go back to the card through the wallet.

## Project layout

```text
src/main.jsx, App.jsx, platform.js  SDK composition, routing and platform configuration
src/pos/                          cashier screens, cart, scanner, payment and receipt UI
src/admin/                        retail routes, pages and workflow services
src/shared/                       retail UI, SDK adapters, refund recovery and money helpers
cloudgate/                        existing schema, workflows, deployment and refund tests
.template/                        installable workflow/schema/sample-data package
tests/                            SDK integration, rollout and media guard checks
```

Barcode scanning uses ZXing for cameras and a keyboard-wedge hook for USB/Bluetooth scanners. Camera access requires HTTPS or localhost. Product forms, goods received and stock take retain barcode capture, CSV import and label printing.

Cloudgate delivers receipt email through tenant delivery; configure optional SMTP in the SDK. App-local legacy SMTP values are not used for delivery. Refunds use the existing durable `refunds` action with stable request keys and confirmed-status accounting; see `cloudgate/REFUNDS.md` for the contract. The SDK migration does not modify the workflow package or database schema.
