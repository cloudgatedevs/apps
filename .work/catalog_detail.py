from pathlib import Path
p=Path('shop/cloudgate/workflows/catalog/plan.py');s=p.read_text(encoding='utf8');start=s.index('    return "SELECT TOP 1 p0.');end=s.index("\nfail('Unknown",start)
s=s[:start]+'''    return ("SELECT p0.*,c.Name AS CategoryName,c.Slug AS CategorySlug,"
        "(SELECT o.Id,o.Name,o.Position,JSON_QUERY(COALESCE((SELECT ov.Id,ov.[Value],ov.Position FROM product_option_values ov WHERE ov.OptionId=o.Id ORDER BY ov.Position,ov.Id FOR JSON PATH,INCLUDE_NULL_VALUES),'[]')) AS [Values] FROM product_options o WHERE o.ProductId=p0.Id ORDER BY o.Position,o.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS OptionsJson,"
        "(SELECT v.Id,v.Sku,v.Title,JSON_QUERY(COALESCE(v.OptionsJson,'{}')) AS Options,COALESCE(v.PriceCents,p0.PriceCents) AS PriceCents,COALESCE(v.CompareAtCents,p0.CompareAtCents) AS CompareAtCents,CASE WHEN p0.TrackInventory=0 THEN 999999 ELSE v.StockQty-v.ReservedQty END AS AvailableQty,v.IsDefault,v.ImageId,v.Position FROM product_variants v WHERE v.ProductId=p0.Id AND v.IsActive=1 ORDER BY v.Position,v.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS VariantsJson,"
        "(SELECT i.Id,i.Url,i.ThumbUrl,i.Alt,i.VariantId,i.Position FROM product_images i WHERE i.ProductId=p0.Id ORDER BY i.Position,i.Id FOR JSON PATH,INCLUDE_NULL_VALUES) AS ImagesJson,"+related+
        " FROM products p0 LEFT JOIN categories c ON c.Id=p0.CategoryId WHERE "+key+" AND p0.Status='active';")
'''+s[end:];p.write_text(s,encoding='utf8')
p=Path('pos/cloudgate/workflows/admin-inventory/plan.py');s=p.read_text().replace("DATETIME('now', '-1 minute')","DATEADD(minute,-1,SYSUTCDATETIME())");p.write_text(s)
