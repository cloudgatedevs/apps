# Cloudgate POS

A point-of-sale system built entirely on **Cloudgate**: the backend is a set of Cloudgate workflow
actions over a SQLite database, sign-in is the Cloudgate IdP, and card payments run through the
**Cloudgate Wallet** (hosted checkout the customer pays on their phone). The frontend is one Vite
project with two entry points that build into two separate bundles:

| Entry | URL | Who | What it is |
| --- | --- | --- | --- |
| `index.html` → `src/pos/` | `/` | IdP users with the **Teller** role (also `cashier`, `manager`) | The till: sign in, open a shift on a register, scan or tap products, take cash or card, print or e-mail the receipt. Parked sales, returns, cash in/out, cash-up. |
| `admin.html` → `src/admin/` | `/admin` | IdP users with the **Admin** role | The back office: dashboard, products (camera barcode capture, labels, CSV import), categories, inventory (adjustments, goods received, stock take, ledger), suppliers, sales with refunds and voids, shifts with Z reports, tellers, customers, reports with CSV export, media, settings (store, receipts, money, till rules, e-mail, theme). |

Sign-in is required before either screen shows anything. Administrators are kept out of the till and
tellers out of the back office, on the client and again in every workflow.

Shared code lives in `src/shared/` (auth, API client, UI kit, money and error helpers).

## Barcode scanning

The main feature. Two inputs work everywhere a barcode is expected (the till, the product form, goods
received, stock take):

- **Camera** (`src/pos/components/BarcodeScanner.jsx`): ZXing in the browser reads EAN-13/8, UPC-A/E,
  Code 128/39, ITF and QR from any camera (rear camera preferred on phones), with a cooldown so a code
  held in front of the lens is not added ten times. Needs HTTPS (or localhost) for camera access.
- **USB / Bluetooth scanner** (`src/pos/components/useScannerInput.js`): keyboard-wedge scanners type
  the code and press Enter; the hook recognises the fast burst and hands it over without touching the
  focused field.

Products have one primary barcode plus any number of extra barcodes (multipacks with a pack quantity,
alternative packaging), and the till also resolves SKUs. The product form warns when a code already
belongs to another product.

## Run it

```bash
npm install
npm run dev              # http://localhost:3001  (till)  ·  http://localhost:3001/admin  (back office)
npm run build            # production build -> dist/ (both bundles, reads .env.production)
npm run build:dev        # sandbox build (reads .env.development)
npm run cloudgate:deploy # push cloudgate/workflows/* to the tenant and publish (see cloudgate/README.md)
npm run cloudgate:smoke  # end-to-end checks; POS_TELLER_TOKEN / POS_ADMIN_TOKEN=<idp jwt> drive the two halves
```

Copy `.env.example` to `.env` and fill in the tenant values. The three gateway keys compose the request base
`{VITE_CLOUDGATE_API_URL}/{VITE_CLOUDGATE_API_ENV}/{VITE_CLOUDGATE_API_PROJECT}`; the controller path is `pos`.
Restart the dev server after changing `.env`.

## Backend

Everything under [`cloudgate/`](./cloudgate/README.md): the `pos_db` schema and seed, the deployer, and one folder
per workflow action. Every action requires the tenant API key (the client signs each request) **and** an IdP bearer
token; teller actions accept the teller roles, admin actions only the admin roles (`require_teller` / `require_admin`).

| Action | Role | Ops |
| --- | --- | --- |
| `pos-catalog` | teller | `settings`, `categories`, `products` (category, search), `lookup` (barcode, alias barcode or SKU → product + pack quantity) |
| `pos-shift` | teller | `registers`, `current`, `open` (register + float), `movement` (payin/payout/drop), `close` (counted cash → expected, difference), `summary` |
| `pos-sale` | teller | `complete` (lines + cash payments, server-priced, stock checked and written), `create` (open sale for a card payment), `hold`/`held`/`recall`/`discard`, `get` (id or reference), `recent`, `refund` (cash, per item) |
| `pos-payment` | teller | `start` (Wallet Payment `create` → hosted URL for the QR code), `status` (re-reads the wallet payment; completes the sale and sells the stock on success), `cancel`, `refund` (card, through the wallet), `wallet-status` |
| `pos-receipt` | teller | `email` (receipt e-mail through the SMTP settings, on a thread branch) |
| `admin-products` | admin | `list`, `get`, `create`, `update`, `set-status`, `delete` (deactivates sold products), `add-barcode`, `remove-barcode`, `barcode-owner`, `labels`, `import` (CSV rows, upsert by barcode/SKU/name), `image-refs` |
| `admin-categories`, `admin-suppliers`, `admin-registers`, `admin-customers` | admin | `list`, `create`, `update`, `delete` (+ `reorder` for categories, `get` for customers) |
| `admin-inventory` | admin | `levels`, `movements`, `adjust` (delta or new quantity, with reason), `receive` (goods received note), `receipts`, `receipt`, `count` (stock take) |
| `admin-sales` | admin | `list` (status, dates, teller, register, shift, search), `get`, `void` (open/parked), `refund` (cash, or card through the wallet) |
| `admin-shifts` | admin | `list`, `get` (Z report with movements), `force-close` |
| `admin-tellers` | admin | `list` (derived from shifts and sales) |
| `admin-dashboard` | admin | `stats`, `by-hour`, `by-day`, `top`, `by-teller`, `by-category`, `by-method`, `recent`, `wallet-status` |
| `admin-reports` | admin | `summary`, `products`, `categories`, `tellers`, `methods`, `tax`, `z-reports` for a date range |
| `admin-settings` | admin | `get` (never returns the SMTP password), `set`, `send-test` |

Workflows publish small events on the Cloudgate WebSocket channel **`pos-events`** (`sale.completed`, `sale.refunded`,
`stock.adjusted`); the till and the back office subscribe with Basic credentials from `.env` and refetch.

## Payments

Cash is settled in one call (`pos-sale complete`) with tendered amount and change. Card payments create the sale
open, start a Cloudgate Wallet checkout for the outstanding amount and show the hosted page as a **QR code** the
customer scans with their phone (or opens on a customer-facing display); the till polls `pos-payment status` until
the wallet reports success, then the sale completes and stock is written. The customer lands on `/pay/done` or
`/pay/cancel` (the only public pages). Refunds go back to the card through the wallet.

## Project layout

```
cloudgate/           schema.sql, deploy.py, smoke.py, bundle.py, workflows/<route>/
src/
  pos/               main.jsx, App.jsx, pos.css, state/TillProvider.jsx, pages/ (Register, Sales, Returns, ShiftPage, PayDone),
                     components/ (BarcodeScanner, useScannerInput, TenderModal, Receipt, Keypad, LineEditor, HeldSales, SaleExtras, Shell)
  admin/             main.jsx, App.jsx, admin.css, components/, pages/, services/adminApi.js, services/live.js
  shared/            auth/, services/ (api, auth, files), ui/ (ui, forms, menus, skeleton, ImageUploader, MediaPicker), lib/ (money, errors)
.template/           App Store bundle: workflow-template.json, schema.sql, sample-data.sql (generated by cloudgate/bundle.py)
template.json        the App Store manifest entry (mirrored into ../apps.json)
```
