# Cloudgate backend for the POS

Everything the app calls at runtime lives on Cloudgate as **workflow actions** under the
`pos` controller, reading and writing the `pos_db` SQLite database (`pos_db_prod` for production). This folder is the
source of truth for that backend; nothing is hand-edited on the canvas.

| Path | Purpose |
| --- | --- |
| `schema.sql` | `pos_db` tables, indexes and guarded seed data. Safe to re-run. |
| `deploy.config.json` | Tenant, controller id/path and database file ids the deployer targets. |
| `deploy.py` | Compiles `workflows/*` into Cloudgate endpoint JSON and creates/updates/publishes them through the workflow MCP, then verifies every node link resolves. |
| `smoke.py` | End-to-end checks through the gateway: shift → cash sale → hold/recall → refund → card checkout → cash-up with a Teller token, plus every admin action with an Admin token. |
| `bundle.py` | Exports the controller as the App Store bundle under `.template/` and splits the sample catalogue out of `schema.sql`. |
| `apply_sql.py` | Applies `schema.sql` to the sandbox and (`--prod --skip-sample`) production databases. |
| `workflows/_shared/lib.py` | Helpers inlined into every Function node (body parsing, SQL quoting, `require_admin` / `require_teller` guards, money and quantity helpers). |
| `workflows/<route>/workflow.json` | One action: route, method, auth flags and the node chain. |
| `workflows/<route>/*.py`, `*.sql` | Node scripts. Function nodes are Python (CPython 3.13); Database nodes are SQLite SQL. |

## Deploying

```bash
npm run cloudgate:deploy            # every workflow
npm run cloudgate:deploy -- pos-sale # one route
npm run cloudgate:list              # what the tenant has
npm run cloudgate:smoke             # POS_TELLER_TOKEN / POS_ADMIN_TOKEN=<idp jwt> drive the two halves
```

The deployer reuses the OAuth token the Claude Code Cloudgate plugin caches under
`~/.mcp-auth` (or `CLOUDGATE_MCP_TOKEN`). It is idempotent per route: existing actions are
updated in place (a draft is opened automatically) and republished to sandbox.

## Conventions

- Every action is `POST {gateway}/{sbx|prod}/pos/<route>` with a JSON body `{ "op": "...", ...params }`.
- Node chain: `IdpAuth` (IdP Authorize) → `Plan` (Function: validate + build SQL) → `Run` (Database: `${Plan}`) → `Shape` (Function: rows → response).
- Node types in `workflow.json`: `idp`, `function`, `condition` (`positive`/`negative` branches), `database`, `request`,
  and `walletpayment` — `{ "type": "walletpayment", "params": { "operation": "create|get|find|refund", "amount": "${PayAmount}", ... } }`
  maps onto the Wallet Payment node's Param slots (operation, amount, currency, description, reference, customerEmail,
  successUrl, cancelUrl, idempotencyKey, paymentId). Its output under `${NodeName}` is the wallet payment
  (`Id`, `Status` 0 pending / 1 succeeded / 2 failed / 3 expired / 4-5 refunded, `PaymentUrl`, `GrossAmount`, `Currency`, `Reference`, `PaidAt`).
  `refund` takes `paymentId`, optional `amount` (blank = everything still refundable) and `description` as the reason; its
  output is `{ PaymentId, RefundId, Amount, Currency, Status pending|succeeded, TotalRefundedAmount, Provider }`. The wallet
  ledger is written when the provider webhook confirms, so the POS records the refund itself (see `pos-payment/apply_refund.py`).
- A Function node returns one value, so values a later node needs individually get their own tiny Function
  (see `pos-payment/pay_*.py`).
- `websocket` nodes: `{ "type": "websocket", "channel": "pos-events", "body": "${NotifyBody}" }` — channels are
  listed in `deploy.config.json` under `websockets` (create them with the realtime MCP `create_web_socket`).
- `"thread": "NodeName"` on a node starts an async branch (a Hangfire `WorkflowThreadBranchJob`) from that node
  once the request's unit of work commits. Use it for slow, non-critical work (the receipt email). Anything the UI
  depends on (the live-channel publish) sits on the main chain so it is delivered before the response returns.
  Cloudgate regenerates node ids on every create/update; before the `feature/shop-platform` fix it remapped the
  next/positive/negative links but not the thread link, so every deployed thread pointed at a dead id and its job
  "succeeded" in a few ms without running anything. `deploy.py` now fails the deploy if any link is dangling.
- There are no anonymous actions. Every action needs the tenant API key (the client signs every request) **and** an
  IdP bearer: till actions (`pos-*`) accept any signed-in user, whatever their role (`require_teller()`), admin
  actions only the roles `admin`, `administrator` or `owner` (`require_admin()`). The IdP Authorize node carries the role
  on the admin actions (`"role": "Admin"` in `workflow.json`), so the engine rejects the wrong role before any script runs.
- Sales are priced on the server from the products table (`pos-sale/compute.py`): the client only sends product ids,
  quantities and discounts. Stock is written through `inventory_movements` and the `StockQty` cache in the same
  transaction as the sale.
- Money is integer cents. Timestamps are UTC. Paging is `skip`/`take` with a `TotalCount` window column.
- Multi-statement SQL runs in order; the response is the first statement that returns rows, so
  writes go first and the final `SELECT` returns the fresh state. Wrap multi-row writes in `BEGIN; … COMMIT;`.
- Errors: `fail("message")` in a Function node → HTTP 400 `{ "Message": "message" }`.
- Condition nodes must `return` a Python **bool**. Returning the string `'True'` is serialised with quotes,
  the engine's boolean parse fails, and the negative branch runs.

## Gotchas (engine behaviour, verified against the Cloudgate source)

- `${key}` substitution is textual and happens before the script runs; `PrepLambda` then doubles any `\"`.
  Never write backslash-quote in a script (use `\x22` in regexes). `load_json()` repairs collapsed backslashes.
- A Database node's result is the first result set only, but every statement executes.
- Never put a JSON-text column inside `json_object(...)` as a string: the value gets escaped twice on the way
  into the next script and no longer parses. Wrap it as `json(col)` (guarded by `json_valid`) so it becomes a
  nested object. One level of escaping (a JSON column selected directly, e.g. `ShippingAddressJson`) is fine.
- Workflows are limited to 25 node steps and 90 seconds per request; SQL to 60 seconds.
- Republishing regenerates node ids — anything bound to a node id (agent watchers) must be re-attached.
