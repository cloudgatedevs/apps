#!/usr/bin/env python3
"""Run the catalog / pages workflows locally against a throwaway SQLite database built from
schema.sql + sample-data.sql, emulating the Cloudgate engine (shared lib inlined, `def main()`
wrapper, textual ${body} / ${Run} substitution). No tenant needed.

    python -B cloudgate/test_catalog_local.py
"""
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
LIB = open(os.path.join(HERE, 'workflows', '_shared', 'lib.py'), encoding='utf-8').read()


def run_node(route, script, keys):
    src = open(os.path.join(HERE, 'workflows', route, script), encoding='utf-8').read()
    text = LIB.rstrip('\n') + '\n\n# ---- node script ----\n' + src
    for k, v in keys.items():
        text = text.replace('${' + k + '}', v)
    # PrepLambda doubles any \" — mimic it (this is why lib.load_json repairs backslashes).
    text = text.replace('\\"', '\\\\"')
    body = '\n'.join('    ' + ln for ln in text.splitlines())
    ns = {}
    exec('def main():\n' + body + '\n', ns)  # noqa: S102 — local test harness
    return ns['main']()


def db():
    con = sqlite3.connect(':memory:')
    con.row_factory = sqlite3.Row
    con.executescript(open(os.path.join(APP, '.template', 'schema.sql'), encoding='utf-8').read())
    con.executescript(open(os.path.join(APP, '.template', 'sample-data.sql'), encoding='utf-8').read())
    return con


def call(con, route, body):
    keys = {'body': json.dumps(body)}
    sql = run_node(route, 'plan.py', keys)
    rows = [dict(r) for r in con.execute(sql).fetchall()]
    keys['Run'] = json.dumps(rows) if rows else 'No records found'
    return json.loads(run_node(route, 'shape.py', keys)), sql


def expect(cond, msg):
    if not cond:
        raise SystemExit('FAIL: ' + msg)


def main():
    con = db()
    settings, _ = call(con, 'catalog', {'op': 'settings'})
    cats, _ = call(con, 'catalog', {'op': 'categories'})
    nav, _ = call(con, 'pages', {'op': 'nav'})
    featured, _ = call(con, 'catalog', {'op': 'featured', 'take': 8})
    newest, _ = call(con, 'catalog', {'op': 'products', 'sort': 'newest', 'take': 8})

    boot, sql = call(con, 'catalog', {'op': 'bootstrap', 'home': True})
    expect(boot['settings'] == settings, 'bootstrap.settings differs from settings op')
    expect(boot['categories'] == cats['items'], 'bootstrap.categories differs from categories op')
    expect(boot['pages'] == nav, 'bootstrap.pages differs from pages nav op')
    expect(boot['featured']['items'] == featured['items'], 'bootstrap.featured differs from featured op')
    expect(boot['newest']['items'] == newest['items'], 'bootstrap.newest differs from newest products op')
    lite, _ = call(con, 'catalog', {'op': 'bootstrap'})
    expect('featured' not in lite and lite['categories'] == cats['items'], 'bootstrap without home should skip product grids')
    print(f'bootstrap ok: {len(boot["settings"])} settings, {len(boot["categories"])} categories, '
          f'{len(boot["pages"]["nav"])} nav / {len(boot["pages"]["footer"])} footer pages, '
          f'{len(boot["featured"]["items"])} featured, {len(boot["newest"]["items"])} newest  (SQL {len(sql)} chars)')

    bounds, _ = call(con, 'catalog', {'op': 'bounds'})
    withb, _ = call(con, 'catalog', {'op': 'products', 'withBounds': True, 'take': 5})
    plain, _ = call(con, 'catalog', {'op': 'products', 'take': 5})
    expect(withb['bounds'] == {'minCents': bounds['minCents'], 'maxCents': bounds['maxCents']}, 'withBounds differs from bounds op')
    expect(withb['items'] == plain['items'] and withb['total'] == plain['total'], 'withBounds changed the items')
    expect('BoundsMinCents' not in withb['items'][0], 'bounds columns leaked into items')
    slug = cats['items'][0]['Slug']
    cb, _ = call(con, 'catalog', {'op': 'bounds', 'category': slug})
    cwb, _ = call(con, 'catalog', {'op': 'products', 'withBounds': True, 'category': slug, 'minCents': cb['maxCents']})
    expect(cwb['bounds'] == {'minCents': cb['minCents'], 'maxCents': cb['maxCents']}, 'category bounds should ignore the price filter')
    none, _ = call(con, 'catalog', {'op': 'products', 'withBounds': True, 'search': 'zzz-no-such-product'})
    expect(none['items'] == [] and none['bounds'] is None, 'empty result should carry bounds=null')
    print(f'withBounds ok: {withb["bounds"]}  category "{slug}": {cwb["bounds"]}')

    p, _ = call(con, 'catalog', {'op': 'product', 'slug': plain['items'][0]['Slug']})
    rel, _ = call(con, 'catalog', {'op': 'products', 'category': p['CategorySlug'], 'take': 5})
    rel_ids = [r['Id'] for r in rel['items'] if r['Id'] != p['Id']][:4]
    expect([r['Id'] for r in p['Related']] == rel_ids, f'Related {[r["Id"] for r in p["Related"]]} != products-in-category {rel_ids}')
    expect(all(set(r) == set(plain['items'][0]) for r in p['Related']), 'Related rows should have the product-card columns')
    expect('RelatedJson' not in p and 'CostCents' not in p, 'RelatedJson/CostCents leaked')
    expect(p['Variants'] and p['Images'] is not None, 'product detail lost variants/images')
    byid, _ = call(con, 'catalog', {'op': 'product', 'id': p['Id']})
    expect(byid['Id'] == p['Id'], 'product by id')
    print(f'product ok: {p["Name"]} -> {len(p["Related"])} related ({p["CategoryName"]})')

    try:
        call(con, 'catalog', {'op': 'product', 'slug': "x' OR 1=1 --"})
        raise SystemExit('FAIL: bad slug should not match')
    except Exception as ex:
        expect('Product not found' in str(ex), 'bad slug: ' + str(ex))
    print('all catalog checks passed')


if __name__ == '__main__':
    main()
