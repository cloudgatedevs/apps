from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'pos/cloudgate/schema.sql';s=p.read_text().replace('[ConnectRefundId] BIGINT','[ConnectRefundId] NVARCHAR(254)');p.write_text(s)
p=ROOT/'shop/cloudgate/schema.sql';s=p.read_text();s=re.sub(r'(INSERT INTO \[pages\] \([^\n]+?\) VALUES \((\d+),)',lambda m:'IF NOT EXISTS(SELECT 1 FROM [pages] WHERE [Id]='+m[2]+')\n'+m[1],s);p.write_text(s)
for p in (ROOT/'shop/cloudgate/workflows').rglob('*.py'):
 s=p.read_text()
 for aggregate in ['MIN','MAX']:
  s=s.replace('SELECT '+aggregate+'(COALESCE(v.PriceCents, p.PriceCents)) FROM product_variants AS v WHERE v.ProductId = p.Id AND v.IsActive = 1','SELECT '+aggregate+'(priced.PriceCents) FROM (SELECT COALESCE(v.PriceCents,p.PriceCents) AS PriceCents FROM product_variants v WHERE v.ProductId=p.Id AND v.IsActive=1) priced')
 p.write_text(s)
p=ROOT/'shop/cloudgate/workflows/catalog/plan.py';s=p.read_text();start=s.index("    return 'SELECT MIN(COALESCE(");end=s.index('\nif op ==',start)
s=s[:start]+'''    return 'SELECT MIN(priced.PriceCents) AS MinCents,MAX(priced.PriceCents) AS MaxCents,COUNT_BIG(*) AS Products FROM (SELECT COALESCE('+PRICE+',p.PriceCents) AS PriceCents FROM products p LEFT JOIN categories c ON c.Id=p.CategoryId WHERE '+' AND '.join(where)+') priced'
'''+s[end:];p.write_text(s)
