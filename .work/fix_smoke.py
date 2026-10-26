from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
for app in ['shop','pos']:
 for p in (ROOT/app/'cloudgate/workflows').rglob('*.py'):
  s=p.read_text(encoding='utf8').replace('[[Value]]]','[Value]').replace('[[Key]]]','[Key]').replace(' NULLS LAST','')
  s=s.replace('ORDER BY NOT c.ParentId IS NULL','ORDER BY CASE WHEN c.ParentId IS NULL THEN 0 ELSE 1 END').replace('ORDER BY i.VariantId IS NULL','ORDER BY CASE WHEN i.VariantId IS NULL THEN 1 ELSE 0 END')
  s=s.replace('SELECT * FROM product_option_values WHERE','SELECT TOP 2147483647 * FROM product_option_values WHERE')
  s=s.replace("ORDER BY (p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS FLOAT) FROM settings WHERE [Key] = 'low_stock_threshold'), 5)) DESC", "ORDER BY CASE WHEN p.StockQty <= COALESCE(p.LowStockThreshold, (SELECT CAST([Value] AS FLOAT) FROM settings WHERE [Key] = 'low_stock_threshold'), 5) THEN 1 ELSE 0 END DESC")
  p.write_text(s,encoding='utf8')
 p=ROOT/app/'tests/workflow_fixture.py';s=p.read_text(encoding='utf8');start=s.index("            source += '\\ndef payment_request_value");end=s.index('        elif kind == \'database\':',start)
 s=s[:start]+"            source += (directory / node['script']).read_text(encoding='utf-8')\n            result = python_workflow.run(source,values)\n"+s[end:];p.write_text(s,encoding='utf8')
p=ROOT/'pos/cloudgate/workflows/admin-reports/plan.py';s=p.read_text(encoding='utf8');s=s.replace('COALESCE(SUM((SELECT SUM(i.Qty * COALESCE(p.CostCents, 0)) FROM sale_items AS i LEFT JOIN products AS p ON p.Id = i.ProductId WHERE i.SaleId = x.Id)), 0) AS CostCents FROM sales AS x','COALESCE(SUM(cost.CostCents),0) AS CostCents FROM sales x OUTER APPLY (SELECT SUM(i.Qty*COALESCE(p.CostCents,0)) AS CostCents FROM sale_items i LEFT JOIN products p ON p.Id=i.ProductId WHERE i.SaleId=x.Id) cost');p.write_text(s,encoding='utf8')
