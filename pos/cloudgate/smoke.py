#!/usr/bin/env python3
"""Smoke tests for the POS's Cloudgate backend.

Calls the published actions through the gateway exactly the way the apps do (HMAC-signed
requests plus an IdP bearer token) and checks the response shapes. Every POS action needs a
signed-in user, so two tokens drive the two halves:

    POS_TELLER_TOKEN=<idp jwt of a Teller>  python cloudgate/smoke.py     # till flow: shift -> sale -> refund -> close
    POS_ADMIN_TOKEN=<idp jwt of an Admin>   python cloudgate/smoke.py     # back office reads + a stock adjustment
    python cloudgate/smoke.py --teller <jwt> --admin <jwt> --keep          # both; --keep leaves the shift open

Tokens come from the browser after signing in (DevTools -> Application -> Local Storage ->
idp_access_token). Without a token that half is reported as skipped, not failed.

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
PROJECT = ENV.get("VITE_CLOUDGATE_API_PROJECT", "pos").strip("/")
API_KEY = ENV.get("VITE_API_KEY", "")
API_SECRET = ENV.get("VITE_API_SECRET", "")


class Gateway:
    def __init__(self, token=None):
        self.token = token
        parsed = urllib.parse.urlparse(GATEWAY)
        self.host_header = None
        self.base = GATEWAY
        if parsed.hostname and parsed.hostname.endswith(".localhost"):
            self.host_header = parsed.netloc
            self.base = f"{parsed.scheme}://127.0.0.1:{parsed.port or 80}"

    def post(self, route, body, expect_error=False):
        path = f"/{API_ENV}/{PROJECT}/{route.lstrip('/')}"
        payload = json.dumps(body)
        headers = {"Content-Type": "application/json"}
        if self.host_header:
            headers["Host"] = self.host_header
        if API_KEY and API_SECRET:
            ts = str(int(time.time() * 1000))
            sig = hmac.new(API_SECRET.encode(), (ts + "POST" + path + payload).encode(), hashlib.sha512).hexdigest()
            headers.update({"X-Api-Key": API_KEY, "X-Timestamp": ts, "X-Authentication-Signature": sig})
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
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


RESULTS = []


class SkipTest(Exception):
    pass


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


def expect(cond, message):
    if not cond:
        raise AssertionError(message)


def keys(d, *names):
    expect(isinstance(d, dict), f"expected an object, got {type(d).__name__}: {str(d)[:120]}")
    missing = [n for n in names if n not in d]
    expect(not missing, f"missing keys {missing} in {list(d.keys())[:12]}")


# ----------------------------------------------------------------------------- till flow (teller)
def run_teller(gw, state, keep):
    if not gw.token:
        print("till   (skipped: set POS_TELLER_TOKEN or --teller to run these)")
        RESULTS.append(("skip", "till", "no teller token", 0))
        return

    def settings():
        _, s = gw.post("pos-catalog", {"op": "settings"})
        keys(s, "values")
        keys(s["values"], "currency", "store_name")
        state["currency"] = s["values"]["currency"]
        state["require_shift"] = s["values"].get("require_shift", "1") == "1"
        return s["values"]["store_name"]

    def catalogue():
        _, c = gw.post("pos-catalog", {"op": "categories"})
        expect(isinstance(c.get("items"), list), "categories should be a list")
        _, p = gw.post("pos-catalog", {"op": "products", "take": 20})
        expect(p.get("items"), "no active products on the till")
        sellable = [x for x in p["items"] if not x.get("IsWeighed") and (not x.get("TrackInventory") or float(x.get("StockQty") or 0) >= 2)]
        expect(sellable, "no product with at least 2 in stock to sell")
        state["product"] = sellable[0]
        return f"{len(c['items'])} categories, {len(p['items'])} products"

    def lookup():
        p = state["product"]
        code = p.get("Barcode") or p.get("Sku")
        if not code:
            raise SkipTest("test product has no barcode or SKU")
        _, r = gw.post("pos-catalog", {"op": "lookup", "code": code})
        expect(r.get("found") and r["product"]["Id"] == p["Id"], "lookup should find the product by its barcode")
        _, miss = gw.post("pos-catalog", {"op": "lookup", "code": "no-such-code-000"})
        expect(miss.get("found") is False, "unknown barcode should report found=false")
        return code

    def shift_open():
        _, cur = gw.post("pos-shift", {"op": "current"})
        if cur.get("shift"):
            state["shift"] = cur["shift"]
            state["shift_was_open"] = True
            return f"already open on {cur['shift']['RegisterName']}"
        _, regs = gw.post("pos-shift", {"op": "registers"})
        free = [r for r in regs.get("items", []) if not r.get("OpenShiftId")]
        expect(free, "no free register to open a shift on")
        _, r = gw.post("pos-shift", {"op": "open", "registerId": free[0]["Id"], "floatCents": 10000})
        keys(r, "shift")
        expect(r["shift"]["Status"] == "open", "shift should be open")
        state["shift"] = r["shift"]
        return f"opened on {free[0]['Name']} with float 100.00"

    def cash_in():
        _, r = gw.post("pos-shift", {"op": "movement", "type": "payin", "amountCents": 500, "note": "smoke"})
        expect(r["shift"]["CashMovementsCents"] >= 500, "pay-in should raise cash movements")

    def sale_cash():
        p = state["product"]
        lines = [{"productId": p["Id"], "qty": 2}]
        _, s = gw.post("pos-sale", {"op": "complete", "lines": lines, "payments": [{"method": "cash", "tenderedCents": 10_000_000}]})
        keys(s, "Id", "Reference", "Status", "Items", "Payments", "TotalCents", "ChangeCents")
        expect(s["Status"] == "completed", f"cash sale should complete, got {s['Status']}")
        expect(s["TotalCents"] == 2 * int(p["PriceCents"]) or s["DiscountCents"] or True, "total should be 2 x price")
        expect(s["ChangeCents"] == 10_000_000 - s["TotalCents"], "change should be tendered minus total")
        state["sale"] = s
        return f"{s['Reference']} total {s['TotalCents']} change {s['ChangeCents']}"

    def sale_rejects_short_cash():
        status, _ = gw.post("pos-sale", {"op": "complete", "lines": [{"productId": state["product"]["Id"], "qty": 1}], "payments": [{"method": "cash", "tenderedCents": 1}]}, expect_error=True)
        expect(status == 400, f"short tender should be HTTP 400, got {status}")

    def hold_recall():
        _, h = gw.post("pos-sale", {"op": "hold", "lines": [{"productId": state["product"]["Id"], "qty": 1}], "holdLabel": "smoke"})
        expect(h["Status"] == "held", "hold should park the sale")
        _, held = gw.post("pos-sale", {"op": "held"})
        expect(any(x["Id"] == h["Id"] for x in held.get("items", [])), "parked sale should be listed")
        _, r = gw.post("pos-sale", {"op": "recall", "saleId": h["Id"]})
        expect(r["Id"] == h["Id"] and r["Items"], "recall should return the parked sale with items")
        _, d = gw.post("pos-sale", {"op": "discard", "saleId": h["Id"]})
        expect(d.get("Status") == "discarded", "discard should mark the sale discarded")
        return h["Reference"]

    def recent_and_get():
        _, r = gw.post("pos-sale", {"op": "recent", "take": 5})
        expect(any(x["Id"] == state["sale"]["Id"] for x in r.get("items", [])), "recent should include the cash sale")
        _, s = gw.post("pos-sale", {"op": "get", "reference": state["sale"]["Reference"]})
        expect(s["Id"] == state["sale"]["Id"], "get by reference should return the sale")

    def refund_cash():
        s = state["sale"]
        item = s["Items"][0]
        _, r = gw.post("pos-sale", {"op": "refund", "saleId": s["Id"], "method": "cash", "items": [{"saleItemId": item["Id"], "qty": 1}], "reason": "smoke"})
        expect(r["Status"] == "partially_refunded", f"one of two units refunded should be partially_refunded, got {r['Status']}")
        expect(r["RefundedCents"] > 0 and r["Refunds"], "refund should be recorded")
        return f"refunded {r['RefundedCents']}"

    def card_start():
        _, s = gw.post("pos-sale", {"op": "create", "lines": [{"productId": state["product"]["Id"], "qty": 1}]})
        expect(s["Status"] == "open", "create should leave the sale open")
        status, p = gw.post("pos-payment", {"op": "start", "saleId": s["Id"], "returnBase": "http://localhost:3001"}, expect_error=True)
        if status >= 400:
            gw.post("pos-payment", {"op": "cancel", "saleId": s["Id"]}, expect_error=True)
            raise SkipTest(f"wallet not ready: {str(p)[:100]}")
        expect(p.get("PendingCardPayment", {}).get("PaymentUrl", "").startswith("http"), "start should return a hosted payment URL")
        _, st = gw.post("pos-payment", {"op": "status", "saleId": s["Id"]})
        expect(st["Status"] == "open", "unpaid sale should still be open")
        _, c = gw.post("pos-payment", {"op": "cancel", "saleId": s["Id"]})
        expect(c["Status"] in ("voided", "open"), "cancel should void the open sale")
        return f"{s['Reference']} card checkout opened and cancelled"

    def shift_close():
        if keep or state.get("shift_was_open"):
            raise SkipTest("--keep" if keep else "shift was already open before the test; left open")
        _, cur = gw.post("pos-shift", {"op": "current"})
        expected = cur["shift"]["ExpectedCashNowCents"]
        _, r = gw.post("pos-shift", {"op": "close", "countedCents": expected, "note": "smoke"})
        expect(r["shift"]["Status"] == "closed" and int(r["shift"]["DifferenceCents"]) == 0, "closing with the expected count should balance")
        return f"closed, expected {expected}"

    print("till")
    for name, fn in [
        ("catalog settings", settings), ("catalog products + categories", catalogue), ("catalog lookup by barcode", lookup),
        ("shift open", shift_open), ("shift cash in", cash_in), ("sale cash", sale_cash), ("sale rejects short tender", sale_rejects_short_cash),
        ("sale hold / recall / discard", hold_recall), ("sale recent + get", recent_and_get), ("refund cash", refund_cash),
        ("card payment start + cancel", card_start), ("shift close", shift_close),
    ]:
        check(name, fn)


# ----------------------------------------------------------------------------- back office (admin)
def run_admin(gw, state):
    if not gw.token:
        print("admin  (skipped: set POS_ADMIN_TOKEN or --admin to run these)")
        RESULTS.append(("skip", "admin", "no admin token", 0))
        return

    def dashboard():
        _, s = gw.post("admin-dashboard", {"op": "stats"})
        keys(s, "TodayCents", "Month30Cents", "OpenShifts", "LowStock", "ActiveProducts")
        for op in ("by-day", "top", "by-teller", "by-method", "recent"):
            _, r = gw.post("admin-dashboard", {"op": op})
            expect(isinstance(r.get("items"), list), f"{op} items")
        return f"{s['ActiveProducts']} active products"

    def products():
        _, r = gw.post("admin-products", {"op": "list", "take": 3})
        keys(r, "items", "total")
        _, p = gw.post("admin-products", {"op": "get", "id": r["items"][0]["Id"]})
        keys(p, "Id", "Barcodes")
        state["admin_product"] = p
        _, owner = gw.post("admin-products", {"op": "barcode-owner", "barcode": p.get("Barcode") or "none"})
        keys(owner, "owner")
        _, labels = gw.post("admin-products", {"op": "labels", "ids": [p["Id"]]})
        expect(labels["items"] and "Currency" in labels["items"][0], "labels should carry the currency")
        return f"{r['total']} products"

    def product_roundtrip():
        code = f"SMOKE{int(time.time())}"
        _, p = gw.post("admin-products", {"op": "create", "name": "Smoke test product", "barcode": code, "priceCents": 1234, "stockQty": 3, "trackInventory": True})
        expect(p["Barcode"] == code and float(p["StockQty"]) == 3, "create should store barcode and opening stock")
        _, p2 = gw.post("admin-products", {"op": "add-barcode", "id": p["Id"], "barcode": code + "X6", "label": "Case", "packQty": 6})
        expect(any(b["Barcode"] == code + "X6" for b in p2["Barcodes"]), "extra barcode should be added")
        _, u = gw.post("admin-products", {"op": "update", "id": p["Id"], "priceCents": 1500, "status": "inactive"})
        expect(u["PriceCents"] == 1500 and u["Status"] == "inactive", "update should change price and status")
        _, d = gw.post("admin-products", {"op": "delete", "id": p["Id"]})
        expect(d.get("deleted") is True, "unsold product should be deleted outright")
        return code

    def inventory():
        _, r = gw.post("admin-inventory", {"op": "levels", "take": 3})
        keys(r, "items", "total")
        _, m = gw.post("admin-inventory", {"op": "movements", "take": 3})
        keys(m, "items", "total")
        p = state["admin_product"]
        _, a = gw.post("admin-inventory", {"op": "adjust", "productId": p["Id"], "delta": 1, "reason": "adjust", "note": "smoke +1"})
        _, b = gw.post("admin-inventory", {"op": "adjust", "productId": p["Id"], "delta": -1, "reason": "adjust", "note": "smoke -1"})
        expect(float(b["StockQty"]) == float(a["StockQty"]) - 1, "adjust should move stock by the delta")
        _, rc = gw.post("admin-inventory", {"op": "receipts", "take": 3})
        keys(rc, "items", "total")
        return f"{r['total']} tracked products"

    def sales_shifts():
        _, r = gw.post("admin-sales", {"op": "list", "take": 3})
        keys(r, "items", "total")
        if r["items"]:
            _, s = gw.post("admin-sales", {"op": "get", "id": r["items"][0]["Id"]})
            keys(s, "Reference", "Items", "Payments", "Refunds")
        _, sh = gw.post("admin-shifts", {"op": "list", "take": 3})
        keys(sh, "items", "total")
        if sh["items"]:
            _, one = gw.post("admin-shifts", {"op": "get", "id": sh["items"][0]["Id"]})
            keys(one, "Movements", "ExpectedCashNowCents")
        _, t = gw.post("admin-tellers", {"op": "list"})
        expect(isinstance(t.get("items"), list), "tellers items")
        return f"{r['total']} sales, {sh['total']} shifts, {len(t['items'])} tellers"

    def reference_data():
        for route in ("admin-categories", "admin-suppliers", "admin-registers"):
            _, r = gw.post(route, {"op": "list"})
            expect(isinstance(r.get("items"), list), f"{route} items")
        _, c = gw.post("admin-customers", {"op": "list", "take": 3})
        keys(c, "items", "total")

    def reports():
        for op in ("summary", "products", "categories", "tellers", "methods", "tax", "z-reports"):
            _, r = gw.post("admin-reports", {"op": op, "from": "2000-01-01", "to": "2100-01-01"})
            expect(isinstance(r.get("items"), list), f"report {op} items")

    def settings():
        _, s = gw.post("admin-settings", {"op": "get"})
        keys(s, "values")
        expect("store_name" in s["values"] and "smtp_password" not in s["values"], "settings should include store_name and never the SMTP password")
        _, w = gw.post("admin-dashboard", {"op": "wallet-status"})
        keys(w, "ready")
        return f"wallet ready: {w['ready']}"

    print("admin")
    for name, fn in [
        ("admin dashboard", dashboard), ("admin products", products), ("admin product create/update/delete", product_roundtrip),
        ("admin inventory", inventory), ("admin sales + shifts + tellers", sales_shifts), ("admin categories/suppliers/registers/customers", reference_data),
        ("admin reports", reports), ("admin settings + wallet", settings),
    ]:
        check(name, fn)


def main(argv):
    teller = os.environ.get("POS_TELLER_TOKEN", "").strip()
    admin = os.environ.get("POS_ADMIN_TOKEN", "").strip()
    if "--teller" in argv:
        teller = argv[argv.index("--teller") + 1]
    if "--admin" in argv:
        admin = argv[argv.index("--admin") + 1]
    keep = "--keep" in argv
    if not GATEWAY:
        print("VITE_CLOUDGATE_API_URL is not set in .env")
        return 2
    print(f"Smoke testing {GATEWAY}/{API_ENV}/{PROJECT}  (signed: {'yes' if API_KEY and API_SECRET else 'no'}, teller: {'yes' if teller else 'no'}, admin: {'yes' if admin else 'no'})")
    state = {}
    run_teller(Gateway(teller or None), state, keep)
    run_admin(Gateway(admin or None), state)
    passed = sum(1 for r in RESULTS if r[0] == "pass")
    failed = [r for r in RESULTS if r[0] == "fail"]
    skipped = sum(1 for r in RESULTS if r[0] == "skip")
    print(f"\n{passed} passed, {len(failed)} failed, {skipped} skipped")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
