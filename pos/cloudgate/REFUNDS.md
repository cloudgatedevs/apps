# Refund changes in template 1.1.1

The template includes the updated frontend, native workflows and schema. Apply the complete
App Store update so the refund callers and backend contract change together. This package
requires the Cloudgate durable Wallet refund backend (`Param9` idempotency key and
`refund-status`). No running tenant was changed while preparing this version.

`POST /refunds` accepts `op: refund`, `id` (order or sale), and a stable `requestKey`.
Shop accepts `amountCents` (omitted for the remaining full amount), `reason`, `restock`.
POS accepts `items: [{saleItemId, qty}]`, `method: card|cash`, and `reason`.
`backOffice: true` permits an administrator's cash refund without an open shift.
The result contains `request` and `items`. A request is confirmed only when `Status` is
`succeeded`; provider IDs are retained as text in `refund_requests`.

The new action owns all refund execution. The old refund operations on `admin-orders`,
`admin-sales`, `pos-payment`, and `pos-sale` reject stale clients before taking action.
Other operations on those actions retain their existing behavior.

The workflow commits a SQLite claim before calling Wallet. One unresolved refund per
order/sale reserves the return intent, amount and items. Wallet receives the persisted key
with a `shop-refund-` or `pos-refund-` prefix. Pending, submitting and reconciliation-required
responses leave totals and stock unchanged. A confirmed response validates payment, amount,
currency, key and provider reference before an atomic trigger records money, inventory and
audit history once. Cash refunds use the same claim and atomic application transaction.

Use `op: list` with `id` for history, `op: refund-status` with `id` and `requestKey` to reconcile
without another provider submission, or `op: retry` to replay the original request. Request
details cannot change on a reused key. The UI persists the intent before sending, retains it
across timeouts, and clears it only after the order/sale refresh succeeds. Requests lost before
a visible claim can be discarded through `discard-unsent`, which writes a failed tombstone
that prevents a delayed submission under that key. An already claimed request cannot be
discarded this way.

POS refunds are capped by the original tender and remaining quantities. Item allocations
include sale discounts and cumulative fractional rounding. Unknown legacy card refund
allocations are reserved conservatively; this may require manual reconciliation before
another refund. Shop retains its existing restock-once-per-order behavior. Shop's delayed
payment polls cannot revert refund statuses or sell the returned stock again. POS keeps
`sale.refunded` refresh events; these notifications can repeat without repeating accounting.

Historical refund discrepancies are not automatically rewritten. Provider responses are
stubbed in the regression suite; actual provider settlement still depends on Cloudgate and
the payment provider. Status recovery is explicit through the refund panel.

## Packaging and checks

- `npm run cloudgate:package-refunds` rebuilds the affected graphs from exported node shapes
  and source scripts, plus the schema, without network calls or publication.
- `npm run test:refunds` runs real SQLite tests, a native graph harness and client retry tests.
- `npm run build` checks the frontend production build.

The schema upgrade is additive and retains existing business data. The standalone SQL is
`cloudgate/migrations/1.1.1-refunds.sql`; App Store updates consume `.template/schema.sql`.
Keep each trigger on one physical line in the packaged schema: Cloudgate's updater splits
statements at semicolon/newline boundaries. `package_refunds.py` performs that formatting,
and a regression test reproduces the updater's splitter on the previous schema.

`refunds.py`, `refund_bridge.py`, the tests, and packaging helper have matching copies in
Shop and POS. Workflow function nodes inline the bridge and engine using their `libraries`
setting. Request and node values are read from the request-local session context rather
than interpolated into Python source.
