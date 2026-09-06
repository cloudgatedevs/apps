# Cart — shape the cart row into the response the storefront renders.
rows = rows_of('''${Run}''')
d = body()

EMPTY = {'token': None, 'items': [], 'count': 0, 'subtotalCents': 0, 'currency': None, 'issues': []}

if not rows or rows[0].get('Id') in (None, ''):
    return out(EMPTY)

c = rows[0]
items = load_json(c.pop('ItemsJson', None), []) or []
issues = []
shaped = []
subtotal = 0
count = 0
for it in items:
    qty = to_int(it.get('Qty'), 0)
    available = to_int(it.get('AvailableQty'), 0)
    price = to_int(it.get('UnitPriceCents'), 0)
    added = to_int(it.get('AddedPriceCents'), price)
    active = to_int(it.get('IsActive'), 0) == 1
    line = {
        'variantId': it.get('VariantId'), 'productId': it.get('ProductId'), 'slug': it.get('Slug'),
        'title': it.get('Title'), 'variantTitle': it.get('VariantTitle'), 'sku': it.get('Sku'),
        'qty': qty, 'unitPriceCents': price, 'lineTotalCents': qty * price,
        'imageUrl': it.get('ImageUrl'), 'availableQty': available, 'isActive': active,
    }
    if not active:
        issues.append({'variantId': it.get('VariantId'), 'code': 'unavailable', 'message': str(it.get('Title')) + ' is no longer available.'})
    elif available <= 0:
        issues.append({'variantId': it.get('VariantId'), 'code': 'out_of_stock', 'message': str(it.get('Title')) + ' is out of stock.'})
    elif qty > available:
        issues.append({'variantId': it.get('VariantId'), 'code': 'reduced', 'message': 'Only ' + str(available) + ' of ' + str(it.get('Title')) + ' available.'})
    if price != added:
        issues.append({'variantId': it.get('VariantId'), 'code': 'price_changed', 'message': 'The price of ' + str(it.get('Title')) + ' has changed.'})
    shaped.append(line)
    if active:
        subtotal += qty * price
        count += qty

# An add for a variant that is unknown, inactive or archived inserts nothing; say so.
if op_of(d, 'get') == 'add':
    wanted = to_int(d.get('variantId'), 0)
    if wanted > 0 and not any(to_int(l.get('variantId'), 0) == wanted for l in shaped):
        issues.append({'variantId': wanted, 'code': 'not_added', 'message': 'That item could not be added — it is not available.'})

return out({
    'token': c.get('Token'), 'id': c.get('Id'), 'userId': c.get('IdpUserId'), 'currency': c.get('Currency'),
    'items': shaped, 'count': count, 'subtotalCents': subtotal, 'issues': issues, 'updatedAt': c.get('UpdatedAt'),
})
