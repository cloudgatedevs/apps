# Cloudgate backend for the shop

Everything the app calls at runtime lives on Cloudgate as **workflow actions** under the
`shop` controller, reading and writing the `shop_db` SQLite database. This folder is the
source of truth for that backend; nothing is hand-edited on the canvas.

| Path | Purpose |
| --- | --- |
| `schema.sql` | `shop_db` tables, indexes and guarded seed data. Safe to re-run. |
| `deploy.config.json` | Tenant, controller id/path and database file ids the deployer targets. |
| `deploy.py` | Compiles `workflows/*` into Cloudgate endpoint JSON and creates/updates/publishes them through the workflow MCP, then verifies every node link resolves. |
| `smoke.py` | End-to-end checks through the gateway: public catalogue → cart → checkout → status, plus every admin action with an IdP admin token. Cancels the order it creates. |
| `workflows/_shared/lib.py` | Helpers inlined into every Function node (body parsing, SQL quoting, admin guard). |
| `workflows/<route>/workflow.json` | One action: route, method, auth flags and the node chain. |
| `workflows/<route>/*.py`, `*.sql` | Node scripts. Function nodes are Python (CPython 3.13); Database nodes are SQLite SQL. |

## Deploying

```bash
npm run cloudgate:deploy            # every workflow
npm run cloudgate:deploy -- catalog # one route
npm run cloudgate:list              # what the tenant has
npm run cloudgate:smoke             # public checks; SHOP_ADMIN_TOKEN=<idp jwt> adds the admin checks
npm run cloudgate:test-local        # catalog + pages workflows against a throwaway SQLite copy (no tenant)
npm run cloudgate:package -- catalog pages   # refresh those graphs in .template/workflow-template.json offline
```

The deployer reuses the OAuth token the Claude Code Cloudgate plugin caches under
`~/.mcp-auth` (or `CLOUDGATE_MCP_TOKEN`). It is idempotent per route: existing actions are
updated in place (a draft is opened automatically) and republished to sandbox.

## Conventions

- Every action is `POST {gateway}/{sbx|prod}/shop/<route>` with a JSON body `{ "op": "...", ...params }`.
- Node chain: `IdpAuth` (IdP Authorize) → `Plan` (Function: validate + build SQL) → `Run` (Database: `${Plan}`) → `Shape` (Function: rows → response).
  Public reads that never look at the caller (`catalog`, `pages`, `payments`) skip `IdpAuth` and start at `Plan`: every node is
  an engine hop (~0.1 s), so a node that nothing reads is pure latency. Keep it wherever a script uses `${IdpAuth}`.
- Node types in `workflow.json`: `idp`, `function`, `condition` (`positive`/`negative` branches), `database`, `request`,
  and `walletpayment` — `{ "type": "walletpayment", "params": { "operation": "create|get|find|refund", "amount": "${PayAmount}", ... } }`
  maps onto the Wallet Payment node's Param slots (operation, amount, currency, description, reference, customerEmail,
  successUrl, cancelUrl, idempotencyKey, paymentId). Its output under `${NodeName}` is the wallet payment
  (`Id`, `Status` 0 pending / 1 succeeded / 2 failed / 3 expired / 4-5 refunded, `PaymentUrl`, `GrossAmount`, `Currency`, `Reference`, `PaidAt`).
  `refund` takes `paymentId`, optional `amount` (blank = everything still refundable) and `description` as the reason; its
  output is `{ PaymentId, RefundId, Amount, Currency, Status pending|succeeded, TotalRefundedAmount, Provider }`. The wallet
  ledger is written when the provider webhook confirms, so the shop records the refund itself (see `admin-orders/apply_refund.py`).
- A Function node returns one value, so values a later node needs individually get their own tiny Function
  (see `checkout/pay_*.py`).
- `websocket` nodes: `{ "type": "websocket", "channel": "shop-events", "body": "${NotifyBody}" }` — channels are
  listed in `deploy.config.json` under `websockets` (create them with the realtime MCP `create_web_socket`).
- `"thread": "NodeName"` on a node starts an async branch (a Hangfire `WorkflowThreadBranchJob`) from that node
  once the request's unit of work commits. Use it for slow, non-critical work (the receipt email). Anything the UI
  depends on (the live-channel publish) sits on the main chain so it is delivered before the response returns.
  Cloudgate regenerates node ids on every create/update; before the `feature/shop-platform` fix it remapped the
  next/positive/negative links but not the thread link, so every deployed thread pointed at a dead id and its job
  "succeeded" in a few ms without running anything. `deploy.py` now fails the deploy if any link is dangling.
- Public actions (`catalog`, later `cart`, `checkout`) are gateway-anonymous with the IdP node set to allow anonymous.
  Admin actions need the tenant API key (the client signs every request) **and** an IdP user whose role is
  `admin`, `administrator` or `owner` — enforced by `require_admin()` in every admin `plan.py`.
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
