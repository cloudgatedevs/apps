# Cloudgate Shop

Version 2.0.1 uses `@cloudgatedevs/cloudgate-client-react` for the shared back office and Cloudgate connection. One React application serves the public shop and `/admin`.

## Responsibilities

The SDK supplies sign-in, session refresh, profiles, users and roles, appearance and themes, media, analytics, workflow logs, email settings, payments administration, notifications and developer tools. Those pages and their copied clients have been removed from Shop.

Shop retains its storefront, catalogue and product variants, cart, hosted Wallet checkout and payment returns, customer order history, commerce dashboard, products, categories, stock, orders and refunds, customers, Markdown content pages and contact messages. Domain workflows and their database schema are unchanged by this migration. Business settings live at `/admin/business`; `/admin/settings` controls the public website through the SDK.

## Development and builds

```sh
npm install
npm run dev         # http://127.0.0.1:3000 and /admin
npm run build:dev   # development build with source maps for sandbox rollouts
npm run build       # minified production build
npm test
npm run test:ui
```

Copy `.env.example` to `.env` for manual setup and replace its placeholders. The App Store fills these values during installation. In particular, `VITE_CLOUDGATE_WEB_APP_ID` must be the Shop website ID, not the tenant or workflow controller ID. It scopes native appearance, website settings, media and developer tools. Restart Vite after changing environment values.

`VITE_CLOUDGATE_API_URL`, `VITE_CLOUDGATE_API_ENV` (`sbx` or `prod`) and `VITE_CLOUDGATE_API_PROJECT` compose the workflow base URL. The controller defaults to `shop`. The build mode controls Vite optimisation; the injected API environment selects sandbox or production services. `VITE_IDP_BASE_URL`, `VITE_IDP_API_URL` and `VITE_IDP_TENANCY_NAME` configure hosted login and native APIs. HMAC request signing remains available through `VITE_API_KEY` and `VITE_API_SECRET`.

Both builds emit `dist/`. Static hosting needs a single SPA fallback to `/index.html`, including `/admin/*`, `/pages/*` and `/checkout/return`. There is no separate `admin.html`. Vite allows Cloudgate preview hosts under `.api.cloudgate.dev`.

## Rollout settings and access

`template.json` and the Shop entry in `../apps.json` carry matching SDK `appSettings`: a light default theme, the Shop Classic palette, public website enabled and public login optional. New installs support guest browsing and checkout. The installer supplies the app name. Owners can change branding, theme and website access through SDK pages. Local manual setup needs the same settings on its linked Cloudgate web app.

The storefront reads its name, tagline, description, logo, icon, footer line and colours from native SDK settings. Its catalogue bootstrap still loads currency, shipping, contact details, announcement, cookie notice, categories and content navigation in one request. The Shop business name remains available for workflow-generated order emails. Legacy branding values in the business settings table no longer control the frontend.

Back-office access requires the native `backoffice.access` permission. Shop's custom commerce screens additionally require an Admin, Administrator or Owner role, matching the existing workflow checks. Native SDK pages use their own permission checks. Customer order history stays at `/account`; the SDK profile lives at `/account/profile`. Disabling the public website redirects visitors to the back office; requiring public login protects all storefront routes, including checkout returns.

## Commerce and media

The [workflow guide](cloudgate/README.md) describes the controller and schema. Public catalogue actions are anonymous. Cart tokens identify guest carts; signed-in calls attach the SDK bearer token. Checkout validates current prices and inventory, reserves stock and creates a hosted Wallet session. `/checkout/return?ref=…` polls the payment workflow and clears the cart only after confirmation. Payment reconciliation remains a backend workflow. The optional business `store_url` overrides the current website as the payment-return address.

Order confirmations, shipping updates and contact forwarding use Cloudgate's tenant email pipeline. Optional shared SMTP settings are configured through the SDK. Shop keeps the customer-facing legal and information pages in its own Markdown editor; these are distinct from the SDK About page. Markdown is sanitised before rendering.

Image editors upload through `cloudgate.files` to `shop/media`; branding uses `shop/branding`. The picker reads both folders. Native SDK media deletion is wrapped with a fresh reference check covering all product images, categories, Markdown pages and appearance images, including full/thumbnail file URL variants. Unverifiable references block deletion. This is an application-side guard, not a server-enforced relationship constraint. It applies to the new SDK folders; existing image URLs continue to render.

Back-office pages subscribe to `shop-events` through the SDK WebSocket helper, using `VITE_CLOUDGATE_WS_USER` and `VITE_CLOUDGATE_WS_PASSWORD`. Events such as `order.paid`, `order.status` and `stock.adjusted` trigger fresh queries. The connection closes when the last subscriber unmounts.

## Validation

`npm test` runs refund regression tests, real SQLite catalogue checks, rollout metadata validation and image-reference guard tests. `npm run test:ui` starts temporary loopback servers, executes the actual Shop workflow scripts against a fresh SQLite database, and simulates native identity, appearance, files, WebSockets and Wallet responses. It checks shared/custom routes, permissions, session refresh, settings, image uploads, public content, guest checkout, stock, customer orders, mobile layouts and theme/access settings. It sends no payments or email. Run `npx playwright install chromium` if the browser runtime is missing.

Authenticated live Cloudgate checks still require a configured Shop web app ID and session. The workflow deploy/smoke commands are described in the workflow guide and target a real tenant. Refund recovery details are in [REFUNDS.md](cloudgate/REFUNDS.md).

## Source layout

- `src/platform.js`: SDK platform configuration and media-reference guard.
- `src/App.jsx`, `src/main.jsx`: one SDK provider/router and shared CSS entry.
- `src/admin/routes.jsx`: custom commerce routes under the SDK shell.
- `src/storefront/`: public pages, cart and store context.
- `src/shared/`: domain API wrappers, role checks and commerce UI components.
- `src/sdk.css`: app-scoped mappings to SDK theme tokens.
- `cloudgate/`, `.template/`: existing workflow sources and rollout assets.
