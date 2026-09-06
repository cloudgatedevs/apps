d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')
if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})
if op in ('labels',):
    return out({'items': rows})
if op == 'import':
    return out({'imported': True, 'total': to_int(rows[0].get('Total'), 0) if rows else 0})
if op == 'image-refs':
    return out({'fileIds': sorted({str(r.get('FileId')) for r in rows if r.get('FileId')}), 'urls': sorted({str(r.get('Url')) for r in rows if r.get('Url')})})
if op == 'delete':
    r = rows[0] if rows else {}
    return out({'id': to_int(r.get('Id'), 0), 'deleted': to_int(r.get('StillExists'), 0) == 0, 'archived': to_int(r.get('StillExists'), 0) == 1})
if op == 'barcode-owner':
    return out({'owner': rows[0] if rows else None})
if not rows:
    fail('Product not found.')
p = dict(rows[0])
p['Barcodes'] = load_json(p.pop('BarcodesJson', None), []) or []
return out(p)
