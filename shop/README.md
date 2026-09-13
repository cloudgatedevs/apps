# Cloudgate Shop

An ecommerce site built entirely on **Cloudgate**: the backend is a set of Cloudgate workflow
actions over a SQLite database, sign-in is the Cloudgate IdP, and card payments run through the
**Cloudgate Wallet** (hosted checkout). The frontend is one Vite project
with two entry points that build into two separate bundles:

| Entry | URL | What it is |
| --- | --- | --- |
| `index.html` → `src/storefront/` | `/` | Public shop (light theme): home, catalogue, product pages, cart, checkout. |
| `admin.html` → `src/admin/` | `/admin` | Back office (light, dense): dashboard, products with variants and images, categories, inventory ledger, orders with shipping/tracking and refunds, customers, media clean-up, settings incl. outgoing email. IdP users with the `admin` role only. |

Shared code lives in `src/shared/` (auth, API client, UI kit, money and error helpers).

## Run it

```bash
npm install
npm run dev              # http://localhost:3000  (storefront)  ·  http://localhost:3000/admin  (back office)
npm run build            # production build -> dist/ (both bundles)
npm run cloudgate:deploy # push cloudgate/workflows/* to the tenant and publish (see cloudgate/README.md)
npm run cloudgate:smoke  # end-to-end checks against the published backend (SHOP_ADMIN_TOKEN=<idp jwt> adds the admin checks)
```

Copy `.env.example` to `.env` and fill in the tenant values. The three gateway keys compose the request base
`{VITE_CLOUDGATE_API_URL}/{VITE_CLOUDGATE_API_ENV}/{VITE_CLOUDGATE_API_PROJECT}`; the controller path is `shop`.
Restart the dev server after changing `.env`.

## Backend

Everything under [`cloudgate/`](./cloudgate/README.md): the `shop_db` schema and seed, the deployer, and one folder
per workflow action. Public actions are gateway-anonymous; admin actions require the tenant API key plus an IdP
admin token and are guarded again inside the workflow.

| Action | Auth | Ops |
| --- | --- | --- |
| `catalog` | anonymous | `bootstrap` (settings + categories + nav pages in one call; `home: true` adds the `featured` and `newest` grids), `settings`, `categories`, `products` (search, category, sort, `inStock`, `minCents`/`maxCents`; `withBounds: true` returns the category's price range with the page), `featured`, `product` (with `Related[]`, up to `related` cards from the same category), `bounds` (price range for the filter) |
| `cart` | anonymous (cart token) | `get`, `add`, `update`, `remove`, `clear` — lines re-priced and stock-clamped on every call; `issues[]` reports changes |
| `checkout` | anonymous (cart token) | `start` — validates the cart against live stock, creates customer + order + items, reserves stock, opens a Cloudgate Wallet checkout session (Wallet Payment node) and returns `paymentUrl` |
| `payment-status` | anonymous (reference + cart token, or signed-in owner) | re-reads the wallet payment while pending; on success sells the reserved stock, writes the ledger, converts the cart and marks the order paid; on failure cancels the order and releases the reservation |
| `admin-products` | admin | `list`, `get`, `create`, `update`, `set-status`, `delete`, `add-image`, `remove-image`, `reorder-images`, `image-refs` (every file id / URL still referenced, for the Media clean-up page) |
| `admin-categories` | admin | `list`, `create`, `update`, `reorder`, `delete` |
| `admin-inventory` | admin | `stock`, `low-stock`, `adjust`, `set-threshold`, `movements` |
| `admin-orders` | admin | `list`, `get`, `set-status` (shipped takes carrier/tracking; publishes `order.status` and emails the customer on a thread branch unless `notifyCustomer` is false), `add-note`; refunds use `refunds` |
| `admin-customers` | admin | `list` (search, accounts/guests, sort by recent/spend/name), `get` (profile, lifetime value, orders) |
| `admin-dashboard` | admin | `stats`, `recent-orders`, `sales-by-day`, `top-products` |
| `admin-settings` | admin | `get` (shared SMTP configured through IdP), `set`, `send-test` (sends a test message through Cloudgate tenant delivery). Also holds the storefront chrome: announcement bar, cookie notice, contact details, social links |
| `payment-reconcile` | anonymous, scheduled every 5 min (sandbox) | expires orders that never reached the payment page (30 min) or whose session lapsed (24 h) and releases stock; re-reads one pending wallet payment per run so orders paid by customers who never returned still finalise |
| `account` | IdP token required | `orders`, `order`, `me` — the signed-in customer's own history (including guest orders placed with the same email) |
| `newsletter` | anonymous | `subscribe`, `unsubscribe` — marketing opt-in by email (creates a guest customer row when needed) |
| `pages` | anonymous | `nav` (published pages for header/footer), `get` (one page by slug, Markdown body) |
| `contact` | anonymous | `send` — stores a contact-form message (honeypot-protected) and emails the support address on a thread branch |
| `admin-pages` | admin | `list`, `get`, `create`, `update`, `delete` (non-system), `reorder` — content pages written in Markdown |
| `admin-messages` | admin | `list` (open/replied/archived, search), `get` (marks read), `set-status`, `delete` |

Customer emails run on async thread branches (Hangfire jobs that start once the request commits), so the
request never waits on the mail server: the order confirmation branches off the finalisation step in
`payment-status` and `payment-reconcile` (`cloudgate/workflows/_shared/order_email.py`), and the shipped /
delivered / cancelled notices branch off `set-status` in `admin-orders` (`_shared/status_email.py`, with carrier,
tracking link and the note typed in the Ship dialog). `_shared/send_email.py` uses Cloudgate's tenant email pipeline, preserving HTML and Reply-To. Cloudgate provides delivery by default. Settings > Email can optionally configure a shared tenant SMTP override through the Admin IdP APIs. Blank passwords preserve the encrypted secret. The test-send button uses saved Cloudgate settings. No app-local SMTP credentials are required. The back office can untick "Email the customer" per status change.

## Live back-office updates

Workflows publish small events on the Cloudgate WebSocket channel **`shop-events`** (`/ws/{env}/shop-events`, Basic
auth): `order.paid` from the finalisation step in `payment-status` / `payment-reconcile`, `order.status` from
`admin-orders` (an open order page picks up a change made elsewhere), and `stock.adjusted` from `admin-inventory`. The back office subscribes through `src/admin/services/live.js` (built on
`createCloudgateWebSockets` from the client package) and simply refetches: dashboard, orders list and inventory
update without a reload. Credentials come from `VITE_CLOUDGATE_WS_USER` / `VITE_CLOUDGATE_WS_PASSWORD`; they ship in
the admin bundle, so payloads carry ids and totals only, never customer details. Rotate them under Cloudgate →
WebSockets if the bundle is ever exposed.

Coming next: discount codes, storefront SEO (per-product meta, sitemap), production wallet switch-over.

## Payments

Card payments run through the tenant's **Cloudgate Wallet**. The `checkout` workflow
uses the **Wallet Payment** node (added to Cloudgate on branch `feature/shop-platform`) to create a hosted checkout
session in-process, so no host credentials ever leave Cloudgate. The customer pays on the provider's page and returns
to `/checkout/return?ref=…`, which polls `payment-status` until the wallet reports success. Sandbox and production
follow the gateway environment (`/sbx` vs `/prod`). The storefront's public address must be saved as the `store_url`
setting (Back office → Settings) so providers can send customers back.

## Images

Product images are uploaded from the back office straight to the Cloudgate host
(`POST /api/idp/{tenancy}/files/upload`, IdP bearer token, admin role) and served publicly through
`File/GetPublicFileById` / `GetPublicFileByIdSmall`. The workflow only stores the URLs. The **Media** page lists
what is stored (`GET /api/idp/{tenancy}/files?path=shop/products`), marks files no product, category or logo
references (via `admin-products` `image-refs`) and deletes the leftovers.

## UI foundations

Both apps share `src/shared/ui`: `skeleton.jsx` (shape-matched loaders used on every page), `forms.jsx` (the `Modal`
is a Radix Dialog with enter/exit animation that becomes a bottom sheet on phones; `variant="drawer-left|right"`
turns it into a side drawer), `menus.jsx` (Radix dropdown and tooltip), `ImageUploader.jsx` (Uppy Dashboard →
react-easy-crop crop step → XHR upload to the IdP files endpoint, the same stack as the Cloudgate hub) and
`motion.css` (keyframes, `prefers-reduced-motion`, focus rings, image fade-in). Toasts come from `sonner`.

Back office extras: Ctrl/Cmd+K command palette (orders, products, customers, pages), bulk actions with a selection
bar on products and orders, sortable columns, dense tables, dashboard charts (sales by day,
top products, 7/30/90 days), optimistic status and stock updates with rollback, drag-to-reorder product images.

Storefront extras: page transitions, cart badge bounce and "Added" feedback, remove-with-undo, free-shipping
progress, category/price/stock filters (drawer on mobile), product gallery with hover zoom, lightbox and colour
swatches, sticky mobile buy bar, related products, three-step checkout with review, order progress tracker,
trust badges and a newsletter signup (`newsletter` action, marketing opt-in on the customer row).

## Content pages, contact and cookie notice

The storefront's About, Shipping & returns, Terms, Privacy and FAQ pages are rows in the `pages` table, seeded
with template text and edited in Back office → Pages (Markdown with live preview; system pages can be edited and
unpublished but not deleted; any new page can appear in the top navigation and/or the footer). `/pages/{slug}`
renders the sanitised Markdown. `/contact` posts to the `contact` action, which stores the message (visible under
Back office → Messages) and forwards it to the support address. The announcement bar, cookie notice text and
toggle, phone, address, hours and social links live under Settings → Storefront. Run `python cloudgate/apply_sql.py
cloudgate/schema.sql` after pulling schema changes; it is idempotent.

## Hosting

Any static host works. Serve `dist/` and add two rewrite rules: `/admin` and `/admin/*` → `/admin.html`,
everything else → `/index.html`. The Vite dev and preview servers already do this.

## Structure

```
src/
  shared/
    auth/            AuthProvider, RequireAuth, IdP profile API
    services/        api.js (signed gateway client), auth.js (IdP session), files.js (image upload)
    ui/              ui.jsx (Table, Pager, StatCard, …), forms.jsx (Field, Modal, Notice, ConfirmButton)
    lib/             money.js (cents helpers), errors.js (gateway error mapping)
  storefront/        main.jsx, App.jsx, storefront.css, store/, cart/, components/, pages/, services/shopApi.js
  admin/             main.jsx, App.jsx, admin.css, components/ (Layout, nav, RequireAdmin), pages/, services/adminApi.js
cloudgate/           schema.sql, deploy.py, deploy.config.json, workflows/<route>/
```

### Template 1.2.0 — faster storefront

Every workflow call costs the same engine overhead (~0.3 s from the gateway plus ~0.1 s per node) no matter
how little it returns, and calls made in parallel queue behind each other, so the storefront now makes
fewer, fuller calls instead of many small ones — no caching anywhere:

| Page | Before | After |
| --- | --- | --- |
| Home (first paint) | 5 calls — `settings`, `categories`, `pages nav`, `featured`, `products newest` | 1 call — `catalog bootstrap { home: true }` |
| Any other page (shell) | 3 calls | 1 call — `catalog bootstrap` |
| Catalogue / category | 2 calls — `products` + `bounds` | 1 call — `products { withBounds: true }` |
| Product | 2 calls in sequence — `product`, then `products` in its category | 1 call — `product` carries `Related[]` |

The public read actions `catalog`, `pages` and `payments` also lost their IdP Authorize node — nothing in
them is per-user, so the chain is `Plan → Run → Shape` (one hop fewer per call). `cart`, `account` and the
admin actions keep it. The old ops still exist, so older builds keep working against an updated backend.
`python -B cloudgate/test_catalog_local.py` runs the catalog and pages workflows against a throwaway SQLite
copy of the schema (no tenant needed); `npm run cloudgate:smoke` checks the published backend end to end.

### Template 1.1.1 — refund safety

Refunds now use the durable `refunds` action with stable request keys, confirmed-status accounting, and recovery controls. The package contains the schema upgrade and matching callers. See [cloudgate/REFUNDS.md](cloudgate/REFUNDS.md) for the contract and checks.

## Shared Cloudgate email delivery

Cloudgate delivers app email by default. Custom SMTP is optional and is configured through `/api/idp/{tenant}/admin/email-settings/details`, `update`, and `delete`, using an active Admin IdP bearer token. Settings are shared by tenant apps and environments. Passwords are encrypted and write-only. App-local `smtp_*` values are no longer read for delivery or edited by these controls; they are not automatically migrated over existing Cloudgate settings.

This release removes SMTP from App Store requirements and in-app setup checklists. Deploy the Cloudgate backend containing `WorkflowAppEmailSender.SendHtmlAsync` and the SMTP APIs before rolling out these app packages. Generated workflow bundles have been updated offline; existing installed workflows need the normal App Store update or reviewed MCP update/publication. No tenant settings or actual email delivery was changed while preparing this release.

## Shared Cloudgate email delivery

Cloudgate delivers app email by default. Custom SMTP is optional and is configured through `/api/idp/{tenant}/admin/email-settings/details`, `update`, and `delete`, using an active Admin IdP bearer token. Settings are shared by tenant apps and environments. Passwords are encrypted and write-only. App-local `smtp_*` values are no longer read for delivery or edited by these controls; they are not automatically migrated over existing Cloudgate settings.

This release removes SMTP from App Store requirements and in-app setup checklists. Deploy the Cloudgate backend containing `WorkflowAppEmailSender.SendHtmlAsync` and the SMTP APIs before rolling out these app packages. Generated workflow bundles have been updated offline; existing installed workflows need the normal App Store update or reviewed MCP update/publication. No tenant settings or actual email delivery was changed while preparing this release.
