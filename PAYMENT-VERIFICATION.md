# Payment verification — 16 September 2026

## Checkout blocker in the hosted demos

The public settings APIs on `https://docs.api.cloudgate.dev/sbx` return an empty
`website_url` for Events, Courses, Jobs and Booking. Each checkout workflow
requires that URL before it creates a wallet payment. This reproduces the
checkout rejection in the generated workflow tests. The frontend previously
hid the workflow's explanation behind `Cloudgate responded 400`.

The fix now derives the return address from the checkout request's browser Origin.
No manual website setting is needed for browser checkout. An existing saved URL
remains an optional override; it also supplies a fixed address for email links
and server-initiated payments. All six templates use the same validation rules:
HTTPS for public sites, HTTP for loopback/localhost development, no credentials,
query strings or fragments. Browser origins cannot supply callback paths.
Shop/POS preserve their legacy `returnBase` fallback for clients without Origin.

The hosted Docs sandbox wallet reports `ready: true`, provider `StripeConnect`,
status `Active`, `production: false`. This confirms onboarding readiness, not
successful card settlement.

## Changes prepared

- All six apps show actionable Cloudgate 4xx error messages, including after an
  authentication refresh, while preserving HTTP status and error metadata.
- All six checkout workflows derive their return address automatically and add
  the app's fixed callback path. Settings describe the saved URL as optional;
  Booking, Shop and POS no longer require it in their setup checklist.
- Booking no longer blocks browser checkout when the website setting is empty,
  and private booking/payment links fall back to the current website.
- Shop payment status and scheduled reconciliation verify payment ID, amount and
  currency against the order before updating payment, inventory or order state.
- POS verifies the same wallet fields and permits another status check after a
  successful card payment without recording payment or reducing stock twice.
- Shop/POS also validate the returned checkout amount, currency and HTTPS link
  before redirecting the customer.
- Shop/POS version tests compare package and manifest versions instead of an
  obsolete hard-coded release number.

| App | New version | Existing Python suite |
| --- | --- | --- |
| Shop | 1.3.3 | 27 tests, 4 app-specific skips |
| POS | 1.2.3 | 27 tests, 3 app-specific skips |
| Booking | 1.8.3 | 80 tests |
| Jobs | 1.1.3 | 38 tests |
| Courses | 1.1.2 | 18 tests |
| Events | 1.1.1 | 30 tests |

All six production builds passed. Package, lockfile, template and catalogue
versions agree. Workflow logging remains enabled and data masking remains off.

## Regression coverage

`tests/test_payment_workflows.py` executes the actual installable graph scripts,
including Python interpolation, SQLite transactions and native Wallet node
parameters, against a simulated wallet with Cloudgate's DTO fields. It covers:

- Events/Courses/Jobs: automatic return URL, localhost, override precedence,
  rejection of missing/malformed origins before wallet creation, same-key retry,
  pending and verified payment status, repeated confirmation, pending refund and
  scheduled refund completion; ticket/access revocation where applicable.
- Shop/POS: automatic return URL, localhost, checkout creation, pending/succeeded/failed/expired status, inventory
  and ledger effects, repeated success checks, mismatched ID/amount/currency.
- Booking's existing native workflow suite additionally covers checkout, payment
  confirmation, partial refund, refund retry, uncertainty and reconciliation.

`tests/test_payment_return.py` checks address validation, override precedence and
legacy client fallback across all six independently installable apps. Booking's
native suite also verifies automatic return URLs with its website setting empty.

`tests/api-errors.test.mjs` contains 12 checks using the real SDK's error class
and HTTP parsing with a stubbed transport, across all six apps.

Run from the repository root:

```powershell
python -B -m unittest discover -s tests -p test_payment_workflows.py -v
python -B -m unittest discover -s tests -p test_payment_return.py -v
node --test tests/api-errors.test.mjs
```

The SQLite and SDK tests make no provider requests and send no email. They do
not replace a hosted sandbox card payment and refund after rollout.

## Hosted verification / rollout remaining

- Hosted admin sign-in is still needed to verify authenticated checkout redirects
  after rollout, but saving the four demo website URLs is no longer required.
- The last confirmed MCP connection was local Events, not hosted Docs. The latest
  controller-list request did not respond and was stopped. All six workflow
  changes are prepared in source and `.template/workflow-template.json`; they
  have not been applied or published to the hosted tenant.
- The hosted Shop catalogue rejects the `bootstrap` operation supported by the
  current source. Upgrade its workflows together with the new frontend.
- No source changes have been committed, pushed or deployed by this check.
- Real-money payment/refund settlement has not been tested.

### Shop hosted sandbox results

- Guest cart and checkout were exercised in the browser using synthetic
  `payment-check@example.invalid` contact details and a “do not dispatch” address.
- The initial checkout returned a Stripe link that displayed “completed or timed
  out” without presenting a card form. This needs the hosted payment records to
  distinguish a reused session from a provider expiry issue.
- A second checkout created order **SO-100002**, wallet payment **4**, for
  **ZAR 288.00**. Its unmodified Stripe URL opened the sandbox card form, and the
  app's payment-status API returned `pending`.
- Stripe's back link returned to `/checkout/cancel?ref=SO-100002` successfully.
- No card details were entered, no payment was completed and no refund was sent.
  The two sandbox checkout attempts remain for inspection; abandoning Stripe
  does not immediately release Shop's pending reservations. The reconciliation
  workflow handles expiry, or an administrator can review the test orders.
