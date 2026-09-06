# Admin Products — shape rows into the response.
d = body()
op = op_of(d, 'list')
rows = rows_of('''${Run}''')

if op == 'list':
    total = to_int(rows[0].get('TotalCount'), 0) if rows else 0
    for r in rows:
        r.pop('TotalCount', None)
    return out({'items': rows, 'total': total})

if op == 'image-refs':
    file_ids = sorted({str(r.get('FileId')) for r in rows if r.get('FileId')})
    urls = sorted({str(u) for r in rows for u in (r.get('Url'), r.get('ThumbUrl')) if u})
    return out({'fileIds': file_ids, 'urls': urls, 'items': rows})

if op == 'delete':
    r = rows[0] if rows else {}
    return out({'id': to_int(r.get('Id'), 0), 'deleted': to_int(r.get('StillExists'), 0) == 0,
                'archived': to_int(r.get('StillExists'), 0) == 1})

# get / create / update / set-status / image ops -> full product
if not rows:
    fail('Product not found.')
p = rows[0]
p['Options'] = load_json(p.pop('OptionsJson', None), []) or []
p['Variants'] = load_json(p.pop('VariantsJson', None), []) or []
p['Images'] = load_json(p.pop('ImagesJson', None), []) or []
for o in p['Options']:
    if isinstance(o.get('Values'), str):
        o['Values'] = load_json(o['Values'], []) or []
for v in p['Variants']:
    if isinstance(v.get('Options'), str):
        v['Options'] = load_json(v['Options'], {}) or {}
return out(p)
