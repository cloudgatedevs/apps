uid = idp_user_id(value('IdpAuth'))
d = body()
rows = rows_of(value('LoadCart'))
if not rows:
    fail('Your cart is empty or has expired. Please add items again.')
s = rows[0]
currency = str(s.get('S_Currency') or 'ZAR').upper()
shipping_flat = to_int(s.get('S_ShippingFlat'), 0)
free_from = to_int(s.get('S_FreeFrom'), 0)
tax_bp = to_int(s.get('S_TaxBp'), 0)
tax_included = str(s.get('S_TaxIncluded') or '1') == '1'
prefix = str(s.get('S_Prefix') or 'SO-')
seed = to_int(s.get('S_Seed'), 100000)
cart_id = to_int(s.get('CartId'), 0)
problems = []
lines = []
for r in rows:
    qty = to_int(r.get('Qty'), 0)
    available = to_int(r.get('AvailableQty'), 0)
    title = str(r.get('Title') or 'Item')
    if to_int(r.get('IsActive'), 0) != 1:
        problems.append(title + ' is no longer available.')
    elif qty <= 0:
        continue
    elif available < qty:
        problems.append('Only ' + str(available) + ' of ' + title + ' available.')
    lines.append({'variantId': to_int(r.get('VariantId'), 0), 'productId': to_int(r.get('ProductId'), 0), 'qty': qty, 'title': title, 'variantTitle': r.get('VariantTitle'), 'sku': r.get('Sku'), 'imageUrl': r.get('ImageUrl'), 'unit': to_int(r.get('UnitPriceCents'), 0), 'track': to_int(r.get('TrackInventory'), 1) == 1})
if problems:
    fail(' '.join(problems) + ' Please review your cart.')
if not lines:
    fail('Your cart is empty.')
subtotal = sum((l['qty'] * l['unit'] for l in lines))
shipping = 0 if free_from > 0 and subtotal >= free_from else shipping_flat
if tax_bp > 0:
    if tax_included:
        tax = subtotal - int(round(subtotal * 10000 / (10000 + tax_bp)))
        total = subtotal + shipping
    else:
        tax = int(round(subtotal * tax_bp / 10000))
        total = subtotal + tax + shipping
else:
    tax = 0
    total = subtotal + shipping
if total <= 0:
    fail('Order total must be greater than zero.')
email = str(d.get('email') or '').strip().lower()
name = str(d.get('name') or '').strip()
surname = str(d.get('surname') or '').strip()
phone = str(d.get('phone') or '').strip()
addr = d.get('shippingAddress') if isinstance(d.get('shippingAddress'), dict) else {}
address = {k: str(addr.get(k) or '').strip()[:120] for k in ('line1', 'line2', 'city', 'region', 'postalCode', 'country')}
address_json = out(address)
note = str(d.get('customerNote') or '').strip()[:1000]
if uid > 0:
    cust_match = 'IdpUserId = ' + str(uid)
    uid_lit = str(uid)
else:
    cust_match = 'IdpUserId IS NULL AND Email = ' + q(email)
    uid_lit = 'NULL'
oid = "(SELECT v FROM #ctx WHERE k = 'oid')"
parts = ['SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRANSACTION;', 'CREATE TABLE #ctx (k nvarchar(128) PRIMARY KEY, v bigint);', 'DELETE FROM #ctx;', 'INSERT INTO customers (IdpUserId, Email, Name, Surname, Phone, DefaultAddressJson) SELECT ' + uid_lit + ', ' + q(email) + ', ' + qs(name, 80) + ', ' + qs(surname, 80) + ', ' + qs(phone, 40) + ', ' + q(address_json) + ' WHERE NOT EXISTS(SELECT 1 FROM customers WHERE ' + cust_match + ');', 'UPDATE customers SET Email = ' + q(email) + ', Name = COALESCE(' + qs(name, 80) + ', Name), Surname = COALESCE(' + qs(surname, 80) + ', Surname), Phone = COALESCE(' + qs(phone, 40) + ', Phone), DefaultAddressJson = ' + q(address_json) + ', UpdatedAt = SYSUTCDATETIME() WHERE ' + cust_match + ';', "INSERT INTO #ctx (k, v) VALUES ('cust', (SELECT TOP 1 Id FROM customers WHERE " + cust_match + ' ORDER BY Id DESC));', 'INSERT INTO orders (Reference, CartId, CustomerId, IdpUserId, Email, Name, Surname, Phone, ShippingAddressJson, BillingAddressJson, Currency, SubtotalCents, DiscountCents, ShippingCents, TaxCents, TotalCents, Status, PaymentStatus, FulfillmentStatus, CustomerNote) VALUES (' + q('TMP-' + str(_uuid.uuid4()) + '') + ', ' + str(cart_id) + ", (SELECT v FROM #ctx WHERE k = 'cust'), " + uid_lit + ', ' + q(email) + ', ' + qs(name, 80) + ', ' + qs(surname, 80) + ', ' + qs(phone, 40) + ', ' + q(address_json) + ', ' + q(address_json) + ', ' + q(currency) + ', ' + str(subtotal) + ', 0, ' + str(shipping) + ', ' + str(tax) + ', ' + str(total) + ", 'pending', 'unpaid', 'unfulfilled', " + qs(note, 1000) + ');', "INSERT INTO #ctx (k, v) VALUES ('oid', CONVERT(BIGINT, SCOPE_IDENTITY()));", 'UPDATE orders SET Reference = CONCAT(' + q(prefix) + ', (' + str(seed) + ' + Id)) WHERE Id = ' + oid + ';']
for l in lines:
    parts.append('INSERT INTO order_items (OrderId, ProductId, VariantId, Sku, Title, VariantTitle, ImageUrl, Qty, UnitPriceCents, LineTotalCents) VALUES (' + oid + ', ' + str(l['productId']) + ', ' + str(l['variantId']) + ', ' + qs(l['sku'], 64) + ', ' + qs(l['title'], 200) + ', ' + qs(l['variantTitle'], 120) + ', ' + qs(l['imageUrl'], 2048) + ', ' + str(l['qty']) + ', ' + str(l['unit']) + ', ' + str(l['qty'] * l['unit']) + ');')
    if l['track']:
        parts.append('UPDATE product_variants SET ReservedQty = ReservedQty + ' + str(l['qty']) + ', UpdatedAt = SYSUTCDATETIME() WHERE Id = ' + str(l['variantId']) + ';')
parts.append('INSERT INTO order_events (OrderId, Type, Message, CreatedBy) VALUES (' + oid + ", 'created', 'Order placed; awaiting payment', 'customer');")
parts.append('COMMIT TRANSACTION;')
parts.append('SELECT o.*, (SELECT Token FROM carts WHERE Id = o.CartId) AS CartToken, ' + q(str(s.get('S_StoreUrl') or '')) + ' AS StoreUrl FROM orders AS o WHERE o.Id = ' + oid + ';')
parts.append('DROP TABLE IF EXISTS #ctx;')
return '\n'.join(parts)
