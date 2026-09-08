# Cloudgate Shop workflow bundle

Import payload the App Store uses to create the shop's backend on a tenant. Regenerate with
`npm run cloudgate:package-refunds` for the 1.1.1 refund changes. This rebuilds the affected graphs and upgrade-safe schema locally without deploying.

| File | Purpose |
| --- | --- |
| `workflow-template.json` | The `shop` controller exported as a template bundle: every endpoint with its nodes and scripts, the `shop_db` (sandbox) and `shop_db_prod` (production) databases, the `shop-events` WebSocket channel (password rotated on import). |
| `schema.sql` | Tables, indexes, settings and system-page seeds. Applied to both databases. |
| `sample-data.sql` | Demo categories, products, variants and opening stock. Applied to the sandbox database only. |

The roll-out (hub → Web Apps → App Store) imports the bundle, publishes every endpoint, renders
`.env` from `.env.example` for the chosen environment, then builds and publishes the app.
