#!/usr/bin/env python3
"""Smoke tests for the shop's Cloudgate backend.

Calls every published action through the gateway exactly the way the apps do (HMAC-signed
requests, IdP bearer for admin actions) and checks the response shapes. Run it after every
deploy; it is the safety net for the whole backend.

    npm run cloudgate:smoke                      # public flows only
    SHOP_ADMIN_TOKEN=<idp jwt> npm run cloudgate:smoke   # + admin actions
    python cloudgate/smoke.py --token <idp jwt> --keep    # keep the test order instead of cancelling it

The admin token is an IdP access token of a user with the admin role (in the back office:
DevTools -> Application -> Local Storage -> idp_access_token). Without it the admin checks are
reported as skipped, not failed.

Reads .env for the gateway (VITE_CLOUDGATE_API_URL / _ENV / _PROJECT) and signing keys
(VITE_API_KEY / VITE_API_SECRET). Hosts under *.localhost only resolve in browsers, so those are
dialled as 127.0.0.1 with a Host header.
"""
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ----------------------------------------------------------------------------- config
def read_env(path):
    values = {}
    if not os.path.exists(path):
        return values
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        values[k.strip()] = v.strip().strip('"').strip("'")
    return values


ENV = read_env(os.path.join(ROOT, ".env"))
GATEWAY = ENV.get("VITE_CLOUDGATE_API_URL", "").rstrip("/")
API_ENV = ENV.get("VITE_CLOUDGATE_API_ENV", "sbx").strip("/")
PROJECT = ENV.get("VITE_CLOUDGATE_API_PROJECT", "shop").strip("/")
API_KEY = ENV.get("VITE_API_KEY", "")
API_SECRET = ENV.get("VITE_API_SECRET", "")


class Gateway:
    def __init__(self, token=None):
        self.token = token
        parsed = urllib.parse.urlparse(GATEWAY)
        self.host_header = None
        self.base = GATEWAY
        if parsed.hostname and parsed.hostname.endswith(".localhost"):
            # Python cannot resolve *.localhost; the gateway routes tenants by Host header.
            self.host_header = parsed.netloc
            self.base = f"{parsed.scheme}://127.0.0.1:{parsed.port or 80}"

    def post(self, route, body, token=None, expect_error=False, anonymous=False):
        path = f"/{API_ENV}/{PROJECT}/{route.lstrip('/')}"
        payload = json.dumps(body)
        headers = {"Content-Type": "application/json"}
        if self.host_header:
            headers["Host"] = self.host_header
        if API_KEY and API_SECRET:
            ts = str(int(time.time() * 1000))
            sig = hmac.new(API_SECRET.encode(), (ts + "POST" + path + payload).encode(), hashlib.sha512).hexdigest()
            headers.update({"X-Api-Key": API_KEY, "X-Timestamp": ts, "X-Authentication-Signature": sig})
        tok = None if anonymous else (token or self.token)
        if tok:
            headers["Authorization"] = "Bearer " + tok
        req = urllib.request.Request(self.base + path, data=payload.encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read().decode("utf-8", "replace")
                status = r.status
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            status = e.code
        try:
            data = json.loads(raw) if raw else None
        except ValueError:
            data = raw
        if isinstance(data, dict) and "result" in data and len(data) <= 3:
            data = data["result"]
        if status >= 400 and not expect_error:
            raise AssertionError(f"{route} -> HTTP {status}: {str(data)[:300]}")
        return status, data


# ----------------------------------------------------------------------------- harness
RESULTS = []


def check(name, fn):
    started = time.time()
    try:
        detail = fn()
        RESULTS.append(("pass", name, detail or "", time.time() - started))
        print(f"  ok    {name}" + (f"  ({detail})" if detail else ""))
    except SkipTest as ex:
        RESULTS.append(("skip", name, str(ex), time.time() - started))
        print(f"  skip  {name}  ({ex})")
    except Exception as ex:  # noqa: BLE001
        RESULTS.append(("fail", name, str(ex), time.time() - started))
        print(f"  FAIL  {name}\n        {ex}")


class SkipTest(Exception):
    pass


def expect(cond, message):
    if not cond:
        raise AssertionError(message)


def keys(d, *names):
    expect(isinstance(d, dict), f"expected an object, got {type(d).__name__}: {str(d)[:120]}")
    missing = [n for n in names if n not in d]
    expect(not missing, f"missing keys {missing} in {list(d.keys())[:12]}")


# ----------------------------------------------------------------------------- public flows
def run_public(admin_gw, state):
    # Storefront traffic is anonymous: never attach the admin token here, or the admin becomes the
    # owner of the test order and the ownership checks prove nothing.
    class Anon:
        def post(self, route, body, **kw):
            kw.setdefault('anonymous', True)
            return admin_gw.post(route, body, **kw)
    gw = Anon()

    def settings():
        _, s = gw.post("catalog", {"op": "settings"})
        keys(s, "currency", "store_name")
        state["currency"] = s["currency"]
        return s["store_name"]

    def categories():
        _, r = gw.post("catalog", {"op": "categories"})
        items = r.get("items") if isinstance(r, dict) else r
        expect(isinstance(items, list), "categories should be a list")
        return f"{len(items)} categories"

    def products():
        _, r = gw.post("catalog", {"op": "products", "take": 5})
        keys(r, "items", "total")
        expect(len(r["items"]) > 0, "no active products in the catalogue")
        p = r["items"][0]
        keys(p, "Id", "Slug", "Name", "PriceCents")
        state["slug"] = p["Slug"]
        return f"{r['total']} products"

    def featured():
        _, r = gw.post("catalog", {"op": "featured", "take": 4})
        items = r.get("items") if isinstance(r, dict) else r
        expect(isinstance(items, list), "featured should be a list")
        return f"{len(items)} featured"

    def bootstrap():
        # The storefront shell in one call: must match the individual ops exactly.
        _, b = gw.post("catalog", {"op": "bootstrap", "home": True, "take": 4})
        keys(b, "settings", "categories", "pages", "featured", "newest")
        _, s = gw.post("catalog", {"op": "settings"})
        _, c = gw.post("catalog", {"op": "categories"})
        _, n = gw.post("pages", {"op": "nav"})
        _, f = gw.post("catalog", {"op": "featured", "take": 4})
        expect(b["settings"] == s, "bootstrap.settings should equal the settings op")
        expect(b["categories"] == c["items"], "bootstrap.categories should equal the categories op")
        expect(b["pages"] == n, "bootstrap.pages should equal pages nav")
        expect(b["featured"]["items"] == f["items"], "bootstrap.featured should equal the featured op")
        expect(isinstance(b["newest"]["items"], list) and len(b["newest"]["items"]) <= 4, "bootstrap.newest should honour take")
        _, lite = gw.post("catalog", {"op": "bootstrap"})
        expect("featured" not in lite and lite["categories"] == c["items"], "bootstrap without home should skip the grids")
        return f"{len(b['categories'])} categories, {len(b['featured']['items'])} featured, {len(b['newest']['items'])} newest"

    def products_with_bounds():
        _, b = gw.post("catalog", {"op": "bounds"})
        _, r = gw.post("catalog", {"op": "products", "withBounds": True, "take": 3})
        keys(r, "items", "total", "bounds")
        expect(r["bounds"] == {"minCents": b["minCents"], "maxCents": b["maxCents"]}, "withBounds should equal the bounds op")
        expect(all("BoundsMinCents" not in p for p in r["items"]), "bounds columns must not leak into items")
        _, none = gw.post("catalog", {"op": "products", "withBounds": True, "search": "zzz-no-such-product-zzz"})
        expect(none["items"] == [] and none["bounds"] is None, "an empty page should carry bounds=null")
        return f"{r['bounds']['minCents']}–{r['bounds']['maxCents']} cents"

    def product():
        _, p = gw.post("catalog", {"op": "product", "slug": state["slug"], "related": 4})
        keys(p, "Id", "Name", "Variants", "Related")
        expect(isinstance(p["Variants"], list) and p["Variants"], "product has no variants")
        expect(isinstance(p["Related"], list) and len(p["Related"]) <= 4 and all(r["Id"] != p["Id"] for r in p["Related"]), "Related should be up to 4 other products")
        if p.get("CategorySlug"):
            _, same = gw.post("catalog", {"op": "products", "category": p["CategorySlug"], "take": 5})
            expect([r["Id"] for r in p["Related"]] == [r["Id"] for r in same["items"] if r["Id"] != p["Id"]][:4], "Related should be the category's featured-sorted products")
        v = next((v for v in p["Variants"] if (v.get("AvailableQty") or 0) > 0 or not p.get("TrackInventory")), None)
        expect(v is not None, "no variant with stock to test the cart with")
        state["variantId"] = v["Id"]
        return f"{p['Name']} / variant {v['Id']}"

    def cart_add():
        _, c = gw.post("cart", {"op": "add", "variantId": state["variantId"], "qty": 1})
        keys(c, "token", "items")
        expect(len(c["items"]) == 1, "cart should hold one line")
        state["token"] = c["token"]
        return c["token"][:8]

    def cart_get():
        _, c = gw.post("cart", {"op": "get", "token": state["token"]})
        keys(c, "token", "items", "issues")
        expect(c["items"][0]["variantId"] == state["variantId"], "cart line mismatch")

    def cart_update():
        _, c = gw.post("cart", {"op": "update", "token": state["token"], "variantId": state["variantId"], "qty": 2})
        expect(c["items"][0]["qty"] in (1, 2), "qty should be 2 (or clamped to 1 by stock)")
        return f"qty {c['items'][0]['qty']}"

    def bad_variant():
        status, r = gw.post("cart", {"op": "add", "token": state["token"], "variantId": 999999, "qty": 1}, expect_error=True)
        expect(status == 400 or (isinstance(r, dict) and r.get("issues")), "adding a missing variant should be rejected or reported")
        return f"HTTP {status}"

    def checkout_start():
        _, o = gw.post("checkout", {
            "op": "start", "token": state["token"], "email": "smoke@example.com", "name": "Smoke", "surname": "Test",
            "shippingAddress": {"line1": "1 Test Street", "city": "Cape Town", "postalCode": "8001", "country": "ZA"},
        })
        keys(o, "orderId", "reference", "paymentUrl", "totalCents", "status")
        expect(o["status"] == "pending" and o["paymentUrl"].startswith("http"), "checkout should return a pending order with a hosted payment URL")
        state["orderId"], state["reference"] = o["orderId"], o["reference"]
        return f"{o['reference']} total {o['totalCents']} {state.get('currency')}"

    def checkout_requires_email():
        status, _ = gw.post("checkout", {"op": "start", "token": state["token"], "shippingAddress": {"line1": "x", "city": "y", "postalCode": "1", "country": "ZA"}}, expect_error=True)
        expect(status == 400, f"checkout without email should be HTTP 400, got {status}")

    def payment_status():
        _, s = gw.post("payment-status", {"reference": state["reference"], "token": state["token"]})
        keys(s, "reference", "status", "paymentStatus")
        expect(s["paymentStatus"] in ("pending", "unpaid"), f"fresh order should be pending, got {s['paymentStatus']}")
        return s["paymentStatus"]

    def payment_status_wrong_token():
        status, _ = gw.post("payment-status", {"reference": state["reference"], "token": "not-the-token"}, expect_error=True)
        expect(status == 400, f"foreign cart token must not see the order (got {status})")

    def price_bounds():
        _, b = gw.post("catalog", {"op": "bounds"})
        keys(b, "minCents", "maxCents", "products")
        expect(b["maxCents"] >= b["minCents"] > 0, "bounds should be positive and ordered")
        _, r = gw.post("catalog", {"op": "products", "minCents": b["maxCents"], "take": 5})
        expect(r["total"] >= 1 and all((p.get("PriceFromCents") or p["PriceCents"]) >= b["maxCents"] for p in r["items"]), "price filter should keep only the dearest products")
        return f"{b['minCents']}–{b['maxCents']} cents"

    def newsletter():
        _, r = gw.post("newsletter", {"op": "subscribe", "email": "smoke@example.com"})
        keys(r, "subscribed", "email")
        expect(r["subscribed"] is True, "subscribe should report subscribed")
        status, _ = gw.post("newsletter", {"op": "subscribe", "email": "not-an-email"}, expect_error=True)
        expect(status == 400, f"invalid email should be HTTP 400, got {status}")

    def account_requires_login():
        status, _ = gw.post("account", {"op": "orders"}, expect_error=True)
        expect(status in (400, 401), f"account without a token should be rejected, got {status}")
        return f"HTTP {status}"

    print("public")
    for name, fn in [
        ("catalog settings", settings), ("catalog categories", categories), ("catalog products", products),
        ("catalog featured", featured), ("catalog bootstrap", bootstrap), ("catalog products + bounds", products_with_bounds),
        ("catalog product + related", product), ("cart add", cart_add), ("cart get", cart_get),
        ("cart update", cart_update), ("cart rejects unknown variant", bad_variant), ("checkout start", checkout_start),
        ("checkout requires email", checkout_requires_email), ("payment-status pending", payment_status),
        ("payment-status ownership", payment_status_wrong_token), ("catalog price bounds + filter", price_bounds),
        ("newsletter subscribe", newsletter), ("account requires login", account_requires_login),
    ]:
        check(name, fn)


# ----------------------------------------------------------------------------- admin flows
def run_admin(gw, state, keep):
    if not gw.token:
        print("admin  (skipped: set SHOP_ADMIN_TOKEN or --token to run these)")
        for name in ("dashboard", "products", "categories", "inventory", "orders", "customers", "settings", "cleanup test order"):
            RESULTS.append(("skip", "admin " + name, "no admin token", 0))
        return

    def dashboard():
        _, s = gw.post("admin-dashboard", {"op": "stats"})
        keys(s, "Revenue30dCents", "PendingOrders", "LowStockVariants")
        _, r = gw.post("admin-dashboard", {"op": "recent-orders", "take": 3})
        expect(isinstance(r.get("items"), list), "recent-orders items")
        return f"{s['Orders30d']} paid orders (30d)"

    def products():
        _, r = gw.post("admin-products", {"op": "list", "take": 3})
        keys(r, "items", "total")
        _, p = gw.post("admin-products", {"op": "get", "id": r["items"][0]["Id"]})
        keys(p, "Id", "Variants", "Images")
        _, refs = gw.post("admin-products", {"op": "image-refs"})
        keys(refs, "fileIds", "urls")
        return f"{r['total']} products, {len(refs['fileIds'])} image files referenced"

    def categories():
        _, r = gw.post("admin-categories", {"op": "list"})
        expect(isinstance(r.get("items"), list), "categories items")

    def inventory():
        _, r = gw.post("admin-inventory", {"op": "stock", "take": 3})
        keys(r, "items", "total")
        _, m = gw.post("admin-inventory", {"op": "movements", "take": 3})
        keys(m, "items", "total")
        _, low = gw.post("admin-inventory", {"op": "low-stock", "take": 3})
        expect(isinstance(low.get("items"), list), "low-stock items")
        return f"{r['total']} variants"

    def orders():
        _, r = gw.post("admin-orders", {"op": "list", "take": 3})
        keys(r, "items", "total")
        _, o = gw.post("admin-orders", {"op": "get", "id": state["orderId"]})
        keys(o, "Reference", "Items", "Events", "Payments")
        expect(o["Reference"] == state["reference"], "order get returned the wrong order")
        return f"{r['total']} orders"

    def customers():
        _, r = gw.post("admin-customers", {"op": "list", "search": "smoke@example.com"})
        keys(r, "items", "total")
        expect(r["total"] >= 1, "the smoke customer should exist after checkout")
        _, c = gw.post("admin-customers", {"op": "get", "id": r["items"][0]["Id"]})
        keys(c, "Email", "Orders", "SpentCents")

    def settings():
        _, s = gw.post("admin-settings", {"op": "get"})
        keys(s, "values")
        expect("store_name" in s["values"], "settings should include store_name")

    def newsletter_signed_in():
        # A signed-in user owns one customer row (unique IdP id); subscribing with any address must update it, never insert.
        _, r = gw.post("newsletter", {"op": "subscribe", "email": "smoke-signed-in@example.com"})
        expect(r.get("subscribed") is True, "signed-in subscribe should succeed")
        _, r = gw.post("newsletter", {"op": "unsubscribe", "email": "smoke-signed-in@example.com"})
        expect(r.get("subscribed") is False, "signed-in unsubscribe should succeed")

    def cleanup():
        if keep:
            raise SkipTest("--keep")
        _, o = gw.post("admin-orders", {"op": "set-status", "id": state["orderId"], "status": "cancelled", "note": "smoke test", "notifyCustomer": False})
        expect(o["Status"] == "cancelled", "test order should be cancelled")
        return f"{state['reference']} cancelled, stock released"

    print("admin")
    for name, fn in [
        ("admin dashboard", dashboard), ("admin products", products), ("admin categories", categories),
        ("admin inventory", inventory), ("admin orders", orders), ("admin customers", customers),
        ("admin settings", settings), ("newsletter while signed in", newsletter_signed_in), ("admin cleanup test order", cleanup),
    ]:
        check(name, fn)


# ----------------------------------------------------------------------------- main
def main(argv):
    token = os.environ.get("SHOP_ADMIN_TOKEN", "").strip()
    if "--token" in argv:
        token = argv[argv.index("--token") + 1]
    keep = "--keep" in argv
    if not GATEWAY:
        print("VITE_CLOUDGATE_API_URL is not set in .env")
        return 2
    print(f"Smoke testing {GATEWAY}/{API_ENV}/{PROJECT}  (signed: {'yes' if API_KEY and API_SECRET else 'no'}, admin: {'yes' if token else 'no'})")
    gw = Gateway(token or None)
    state = {}
    run_public(gw, state)
    if "orderId" in state:
        run_admin(gw, state, keep)
    else:
        print("admin  (skipped: checkout did not produce an order)")

    passed = sum(1 for r in RESULTS if r[0] == "pass")
    failed = [r for r in RESULTS if r[0] == "fail"]
    skipped = sum(1 for r in RESULTS if r[0] == "skip")
    print(f"\n{passed} passed, {len(failed)} failed, {skipped} skipped")
    if "orderId" in state and (keep or not token):
        print(f"note: test order {state['reference']} is left pending; payment-reconcile expires it within 30 minutes.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
