# Shop 1.3.4 / POS 1.2.4 — repair WebSocket selections on update

These releases make an App Store update available for installations affected by
`WebSocket node requires a WebSocket to be selected.`

The app templates already include the correct channel definitions and node
references. Cloudgate's update preparation resolves them to the existing tenant
channels and omits the channel definitions to preserve their settings and passwords.
The template importer previously cleared those references because there was no
new-channel mapping. The Cloudgate server fix retains references that resolve to
an existing, non-deleted channel in the target tenant.

## Rollout order

1. Deploy the Cloudgate server fix in `TemplateService.ResolveNodeWebSocketReferenceAsync`.
2. Push these app versions and refresh the App Store catalogue.
3. Choose **Update** for the installed Shop and POS apps in each environment in use.
   The normal workflow import and publication/release process restores channel
   selections throughout each controller. Production release rules still apply.
4. Refresh the existing Shop payment return page to check the same order.

Updating the app before deploying the server fix can clear the selections again.
This requires no database reset, order deletion, channel recreation, or password
rotation. The update reuses existing databases and channels.

Shop channel: `shop-events`, used by `payment-status`, `payment-reconcile`,
`admin-orders`, and `admin-inventory`.

POS channel: `pos-events`, used by `pos-payment`, `pos-sale`, `refunds`, and
`admin-inventory`.

Server regression tests cover the real App Store preparation and JSON import
boundary for both apps, fresh-import mappings, and invalid/deleted/other-tenant
references. The same importer fix applies to other templates that reuse channels.
