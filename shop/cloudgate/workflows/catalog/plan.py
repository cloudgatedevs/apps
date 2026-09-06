# Catalog — build the SQL for the requested op. Public; anonymous allowed.
d = body()
op = op_of(d, 'products')

PUBLIC_SETTINGS = ("('store_name','store_tagline','store_logo_url','store_icon_url','store_description','store_url','currency','shipping_flat_cents','free_shipping_threshold_cents','support_email','prices_include_tax','tax_rate_bp',"
                   "'checkout_note','announcement_text','announcement_url','cookie_consent_enabled','cookie_consent_text','contact_phone','contact_address','contact_hours',"
                   "'social_instagram','social_facebook','social_x','social_tiktok','footer_note','theme_primary','theme_secondary')")

if op == 'settings':
    return "SELECT Key, Value FROM settings WHERE Key IN " + PUBLIC_SETTINGS + " ORDER BY Key;"

if op == 'categories':
    return (
        "SELECT c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.ImageUrl, c.SortOrder, "
        "(SELECT COUNT(*) FROM products p WHERE p.CategoryId = c.Id AND p.Status = 'active') AS ProductCount, "
        "(SELECT i.Url FROM product_images i JOIN products p ON p.Id = i.ProductId WHERE p.CategoryId = c.Id AND p.Status = 'active' ORDER BY p.IsFeatured DESC, i.Position, i.Id LIMIT 1) AS SampleImageUrl "
        "FROM categories c WHERE c.IsActive = 1 ORDER BY c.SortOrder, c.Name;"
    )

PRICE = "(SELECT MIN(COALESCE(v.PriceCents, p.PriceCents)) FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1)"

if op in ('products', 'featured'):
    where = ["p.Status = 'active'"]
    if op == 'featured' or qb(d.get('featured')) == '1':
        where.append('p.IsFeatured = 1')
    if d.get('category'):
        where.append('c.Slug = ' + qs(d.get('category'), 120))
    if d.get('categoryId'):
        where.append('p.CategoryId = ' + qi(d.get('categoryId'), 0))
    term = str(d.get('search') or d.get('q') or '').strip()
    if term:
        lk = like(term)
        where.append('(p.Name LIKE ' + lk + ' OR p.ShortDescription LIKE ' + lk + ' OR p.Tags LIKE ' + lk + ' OR p.Brand LIKE ' + lk + ')')
    if qb(d.get('inStock')) == '1':
        where.append("(p.TrackInventory = 0 OR EXISTS (SELECT 1 FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1 AND v.StockQty - v.ReservedQty > 0))")
    # Price range on the cheapest active variant (what the card shows as "from").
    lo = to_int(d.get('minCents'), 0)
    hi = to_int(d.get('maxCents'), 0)
    if lo > 0:
        where.append("COALESCE(" + PRICE + ", p.PriceCents) >= " + str(lo))
    if hi > 0:
        where.append("COALESCE(" + PRICE + ", p.PriceCents) <= " + str(hi))

    sorts = {
        'newest': 'p.CreatedAt DESC, p.Id DESC',
        'price_asc': 'PriceFromCents ASC, p.Name ASC',
        'price_desc': 'PriceFromCents DESC, p.Name ASC',
        'name': 'p.Name ASC',
        'featured': 'p.IsFeatured DESC, p.SortOrder ASC, p.CreatedAt DESC',
    }
    order = sorts.get(str(d.get('sort') or '').lower(), sorts['featured'])
    take = clamp(d.get('take'), 1, 60, 8 if op == 'featured' else 24)
    skip = clamp(d.get('skip'), 0, 1000000, 0)

    return (
        "SELECT p.Id, p.Name, p.Slug, p.Brand, p.ShortDescription, p.PriceCents, p.CompareAtCents, p.Currency, "
        "p.HasVariants, p.IsFeatured, p.TrackInventory, p.CreatedAt, "
        "c.Name AS CategoryName, c.Slug AS CategorySlug, "
        "(SELECT MIN(COALESCE(v.PriceCents, p.PriceCents)) FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS PriceFromCents, "
        "(SELECT MAX(COALESCE(v.PriceCents, p.PriceCents)) FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS PriceToCents, "
        "CASE WHEN p.TrackInventory = 0 THEN 999999 ELSE (SELECT COALESCE(SUM(v.StockQty - v.ReservedQty), 0) FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1) END AS AvailableQty, "
        "(SELECT i.Url FROM product_images i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id LIMIT 1) AS ImageUrl, "
        "(SELECT i.ThumbUrl FROM product_images i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id LIMIT 1) AS ThumbUrl, "
        "COUNT(*) OVER () AS TotalCount "
        "FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId "
        "WHERE " + ' AND '.join(where) + " "
        "ORDER BY " + order + " LIMIT " + str(take) + " OFFSET " + str(skip) + ";"
    )

if op == 'bounds':
    # Cheapest and dearest active product (optionally within a category) for the price filter.
    where = ["p.Status = 'active'"]
    if d.get('category'):
        where.append('c.Slug = ' + qs(d.get('category'), 120))
    return (
        "SELECT MIN(COALESCE(" + PRICE + ", p.PriceCents)) AS MinCents, MAX(COALESCE(" + PRICE + ", p.PriceCents)) AS MaxCents, COUNT(*) AS Products "
        "FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId WHERE " + ' AND '.join(where) + ";"
    )

if op == 'product':
    if d.get('slug'):
        key = 'p.Slug = ' + qs(d.get('slug'), 120)
    elif d.get('id'):
        key = 'p.Id = ' + qi(d.get('id'), 0)
    else:
        fail('slug or id is required.')
    return (
        "SELECT p.*, c.Name AS CategoryName, c.Slug AS CategorySlug, "
        "(SELECT json_group_array(json_object('Id', o.Id, 'Name', o.Name, 'Position', o.Position, "
        "   'Values', json((SELECT json_group_array(json_object('Id', ov.Id, 'Value', ov.Value, 'Position', ov.Position)) "
        "                   FROM (SELECT * FROM product_option_values WHERE OptionId = o.Id ORDER BY Position, Id) ov)))) "
        " FROM (SELECT * FROM product_options WHERE ProductId = p.Id ORDER BY Position, Id) o) AS OptionsJson, "
        "(SELECT json_group_array(json_object('Id', v.Id, 'Sku', v.Sku, 'Title', v.Title, 'Options', json(COALESCE(v.OptionsJson, '{}')), "
        "   'PriceCents', COALESCE(v.PriceCents, p.PriceCents), 'CompareAtCents', COALESCE(v.CompareAtCents, p.CompareAtCents), "
        "   'AvailableQty', CASE WHEN p.TrackInventory = 0 THEN 999999 ELSE v.StockQty - v.ReservedQty END, "
        "   'IsDefault', v.IsDefault, 'ImageId', v.ImageId, 'Position', v.Position)) "
        " FROM (SELECT * FROM product_variants WHERE ProductId = p.Id AND IsActive = 1 ORDER BY Position, Id) v) AS VariantsJson, "
        "(SELECT json_group_array(json_object('Id', i.Id, 'Url', i.Url, 'ThumbUrl', i.ThumbUrl, 'Alt', i.Alt, 'VariantId', i.VariantId, 'Position', i.Position)) "
        " FROM (SELECT * FROM product_images WHERE ProductId = p.Id ORDER BY Position, Id) i) AS ImagesJson "
        "FROM products p LEFT JOIN categories c ON c.Id = p.CategoryId "
        "WHERE " + key + " AND p.Status = 'active' LIMIT 1;"
    )

fail('Unknown op: ' + op)
