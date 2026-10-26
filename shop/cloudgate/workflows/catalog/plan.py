d = body()
op = op_of(d, 'products')
PUBLIC_SETTINGS = "('store_name','store_tagline','store_logo_url','store_icon_url','store_description','store_url','currency','shipping_flat_cents','free_shipping_threshold_cents','support_email','prices_include_tax','tax_rate_bp','checkout_note','announcement_text','announcement_url','cookie_consent_enabled','cookie_consent_text','contact_phone','contact_address','contact_hours','social_instagram','social_facebook','social_x','social_tiktok','footer_note','theme_primary','theme_secondary')"
PRICE = '(SELECT MIN(priced.PriceCents) FROM (SELECT COALESCE(v.PriceCents, p.PriceCents) AS PriceCents FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS priced)'
SORTS = {'newest': 'p.CreatedAt DESC, p.Id DESC', 'price_asc': 'PriceFromCents ASC, p.Name ASC', 'price_desc': 'PriceFromCents DESC, p.Name ASC', 'name': 'p.Name ASC', 'featured': 'p.IsFeatured DESC, p.SortOrder ASC, p.CreatedAt DESC'}
CARD_COLS = ['Id', 'Name', 'Slug', 'Brand', 'ShortDescription', 'PriceCents', 'CompareAtCents', 'Currency', 'HasVariants', 'IsFeatured', 'TrackInventory', 'CreatedAt', 'CategoryName', 'CategorySlug', 'PriceFromCents', 'PriceToCents', 'AvailableQty', 'ImageUrl', 'ThumbUrl']

def settings_sql(extra_cols=''):
    return 'SELECT [Key], [Value] ' + extra_cols + ' FROM settings WHERE [Key] IN ' + PUBLIC_SETTINGS

def categories_sql(extra_cols=''):
    return 'SELECT c.Id, c.Name, c.Slug, c.Description, c.ParentId, c.ImageUrl, c.SortOrder' + extra_cols + ", (SELECT COUNT_BIG(*) FROM products AS p WHERE p.CategoryId = c.Id AND p.Status = 'active') AS ProductCount, (SELECT TOP 1 i.Url FROM product_images AS i JOIN products AS p ON p.Id = i.ProductId WHERE p.CategoryId = c.Id AND p.Status = 'active' ORDER BY p.IsFeatured DESC, i.Position, i.Id) AS SampleImageUrl FROM categories AS c WHERE c.IsActive = 1"

def card_select(where, order, take, skip, extra_cols=''):
    """The product-card SELECT. `where` is a list of SQL predicates on p/c; `order` an ORDER BY body."""
    return 'SELECT p.Id, p.Name, p.Slug, p.Brand, p.ShortDescription, p.PriceCents, p.CompareAtCents, p.Currency, p.HasVariants, p.IsFeatured, p.TrackInventory, p.CreatedAt, c.Name AS CategoryName, c.Slug AS CategorySlug, (SELECT MIN(priced.PriceCents) FROM (SELECT COALESCE(v.PriceCents, p.PriceCents) AS PriceCents FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS priced) AS PriceFromCents, (SELECT MAX(priced.PriceCents) FROM (SELECT COALESCE(v.PriceCents, p.PriceCents) AS PriceCents FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) AS priced) AS PriceToCents, CASE WHEN p.TrackInventory = 0 THEN 999999 ELSE (SELECT COALESCE(SUM(v.StockQty - v.ReservedQty), 0) FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1) END AS AvailableQty, (SELECT TOP 1 i.Url FROM product_images AS i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id) AS ImageUrl, (SELECT TOP 1 i.ThumbUrl FROM product_images AS i WHERE i.ProductId = p.Id ORDER BY i.Position, i.Id) AS ThumbUrl' + extra_cols + ' FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE ' + ' AND '.join(where) + ' ORDER BY ' + order + ' OFFSET ' + str(skip) + ' ROWS FETCH FIRST ' + str(take) + ' ROWS ONLY'

def json_row(cols, alias='x'):
    """json_object('Col', x.Col, ...) over the named columns of a subquery aliased `alias`."""
    return 'json_object(' + ', '.join(("'" + c + "': " + alias + '.[' + c + ']' for c in cols)) + ')'

def pos(order):
    """Extra column: the row's rank under `order`, so Shape can restore each section's ordering."""
    return ', row_number() OVER (ORDER BY ' + order + ') AS Pos'

def section(name, inner, cols):
    """One UNION ALL member of the bootstrap query; `inner` must select a Pos column (see pos())."""
    return "SELECT '" + name + "' AS Section, x.Pos AS Pos, " + json_row(cols) + ' AS [Row] FROM (' + inner + ') AS x'

def bounds_sql(category):
    where = ["p.Status = 'active'"]
    if category:
        where.append('c.Slug = ' + qs(category, 120))
    return 'SELECT MIN(priced.PriceCents) AS MinCents, MAX(priced.PriceCents) AS MaxCents, COUNT_BIG(*) AS Products FROM (SELECT COALESCE(' + PRICE + ', p.PriceCents) AS PriceCents FROM products AS p LEFT JOIN categories AS c ON c.Id = p.CategoryId WHERE ' + ' AND '.join(where) + ') AS priced'
if op == 'settings':
    return settings_sql() + ' ORDER BY [Key];'
if op == 'categories':
    return categories_sql() + ' ORDER BY c.SortOrder, c.Name;'
if op == 'bootstrap':
    parts = [section('settings', settings_sql(pos('[Key]')), ['Key', 'Value']), section('categories', categories_sql(pos('c.SortOrder, c.Name')), ['Id', 'Name', 'Slug', 'Description', 'ParentId', 'ImageUrl', 'SortOrder', 'ProductCount', 'SampleImageUrl']), section('pages', 'SELECT Slug, Title, Summary, ShowInNav, ShowInFooter, Position' + pos('Position, Title') + " FROM pages WHERE Status = 'published'", ['Slug', 'Title', 'Summary', 'ShowInNav', 'ShowInFooter', 'Position'])]
    if qb(d.get('home')) == '1':
        take = clamp(d.get('take'), 1, 24, 8)
        parts.append(section('featured', card_select(["p.Status = 'active'", 'p.IsFeatured = 1'], SORTS['featured'], take, 0, pos(SORTS['featured'])), CARD_COLS))
        parts.append(section('newest', card_select(["p.Status = 'active'"], SORTS['newest'], take, 0, pos(SORTS['newest'])), CARD_COLS))
    return 'SELECT Section, Pos, [Row] FROM (' + ' UNION ALL '.join(parts) + ') AS sections ORDER BY Section, Pos;'
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
        where.append('(p.TrackInventory = 0 OR EXISTS (SELECT 1 FROM product_variants v WHERE v.ProductId = p.Id AND v.IsActive = 1 AND v.StockQty - v.ReservedQty > 0))')
    lo = to_int(d.get('minCents'), 0)
    hi = to_int(d.get('maxCents'), 0)
    if lo > 0:
        where.append('COALESCE(' + PRICE + ', p.PriceCents) >= ' + str(lo))
    if hi > 0:
        where.append('COALESCE(' + PRICE + ', p.PriceCents) <= ' + str(hi))
    order = SORTS.get(str(d.get('sort') or '').lower(), SORTS['featured'])
    take = clamp(d.get('take'), 1, 60, 8 if op == 'featured' else 24)
    skip = clamp(d.get('skip'), 0, 1000000, 0)
    extra = ', COUNT(*) OVER () AS TotalCount'
    if qb(d.get('withBounds')) == '1':
        b = bounds_sql(d.get('category'))
        extra += ', (SELECT MinCents FROM (' + b + ') AS bounds_min) AS BoundsMinCents, (SELECT MaxCents FROM (' + b + ') AS bounds_max) AS BoundsMaxCents'
    return card_select(where, order, take, skip, extra) + ';'
if op == 'bounds':
    return bounds_sql(d.get('category')) + ';'
if op == 'product':
    if d.get('slug'):
        key = 'p0.Slug = ' + qs(d.get('slug'), 120)
    elif d.get('id'):
        key = 'p0.Id = ' + qi(d.get('id'), 0)
    else:
        fail('slug or id is required.')
    related_take = clamp(d.get('related'), 0, 12, 4)
    related = "(SELECT JSON_QUERY(CONCAT(N'[', STRING_AGG(CONVERT(NVARCHAR(MAX), " + json_row(CARD_COLS, 'r') + "), N','), N']'), '$') FROM (" + card_select(["p.Status = 'active'", 'p.CategoryId = p0.CategoryId', 'p.Id <> p0.Id'], SORTS['featured'], related_take, 0) + ') AS r) AS RelatedJson'
    return "SELECT p0.*,c.Name AS CategoryName,c.Slug AS CategorySlug,(SELECT o.Id,o.Name,o.Position,JSON_QUERY(COALESCE((SELECT ov.Id,ov.[Value],ov.Position FROM product_option_values ov WHERE ov.OptionId=o.Id ORDER BY ov.Position,ov.Id FOR JSON PATH,INCLUDE_NULL_VALUES),'[]')) AS [Values] FROM product_options o WHERE o.ProductId=p0.Id ORDER BY o.Position,o.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS OptionsJson,(SELECT v.Id,v.Sku,v.Title,JSON_QUERY(COALESCE(v.OptionsJson,'{}')) AS Options,COALESCE(v.PriceCents,p0.PriceCents) AS PriceCents,COALESCE(v.CompareAtCents,p0.CompareAtCents) AS CompareAtCents,CASE WHEN p0.TrackInventory=0 THEN 999999 ELSE v.StockQty-v.ReservedQty END AS AvailableQty,v.IsDefault,v.ImageId,v.Position FROM product_variants v WHERE v.ProductId=p0.Id AND v.IsActive=1 ORDER BY v.Position,v.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS VariantsJson,(SELECT i.Id,i.Url,i.ThumbUrl,i.Alt,i.VariantId,i.Position FROM product_images i WHERE i.ProductId=p0.Id ORDER BY i.Position,i.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS ImagesJson," + related + ' FROM products p0 LEFT JOIN categories c ON c.Id=p0.CategoryId WHERE ' + key + " AND p0.Status='active';"
fail('Unknown op: ' + op)
