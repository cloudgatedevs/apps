# Events deployment

The Events controller is published in the `events` tenant. The development gateway is `http://events.localhost:44301`, with `/sbx/events` and `/prod/events` routes. IDs are recorded in `deployment.json` and `resources.json`.

All 14 workflows have logging enabled and data masking disabled. `catalog` allows anonymous access; normal business routes validate Cloudgate IdP identity and perform server-side role/ownership checks. `reconcile`, `refund-reconcile` and `notifications` accept scheduler invocations only. Both environments have their own database file. The production database contains no sample events or customer data.

| Route | Operations |
| --- | --- |
| catalog | catalog |
| workspace | workspace (role-filtered records) |
| events | event-save, event-publish, event-archive, event-cancel, tier-save |
| orders | reserve, order-cancel |
| checkout | Wallet checkout for an owned reservation |
| payment-status | Verified Wallet status and ticket issuance |
| refund | Administrator full refund |
| waitlist | waitlist-join, waitlist-notify |
| checkin | check-in, check-in-undo |
| staff | staff-save |
| settings | settings |
| reconcile | Scheduled payment reconciliation |
| refund-reconcile | Scheduled refund reconciliation |
| notifications | Scheduled Cloudgate email delivery |

Use POST JSON with `op` and the operation fields shown in `engine.py` and `src/events/main.jsx`. Identity comes from the validated IdP node, never the request body. Payment responses are obtained directly from native Wallet nodes, never trusted browser callbacks. Shared files, users, SMTP, profile and logs use Cloudgate's own service APIs rather than duplicated workflows.

Publication was explicitly authorised by the user. Paid checkout requires a configured HTTPS website return URL. No real payment or email was sent during the initial build verification; simulator tests exercise payment and refund transitions without external transactions.
