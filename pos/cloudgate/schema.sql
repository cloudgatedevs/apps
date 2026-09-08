-- Cloudgate POS — SQLite schema (pos_db)
-- Conventions: every table has Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL (Cloudgate rule),
-- PascalCase columns, money as INTEGER minor units (cents) to match the Cloudgate Wallet API,
-- quantities as REAL (weighed goods), booleans as INTEGER 0/1, timestamps as UTC DATETIME text.
-- Safe to re-run: IF NOT EXISTS everywhere, seed rows guarded by NOT EXISTS.

-- ---------------------------------------------------------------- settings
CREATE TABLE IF NOT EXISTS settings (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Key TEXT NOT NULL UNIQUE,
  Value TEXT,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- catalogue
CREATE TABLE IF NOT EXISTS categories (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Name TEXT NOT NULL,
  Color TEXT,                            -- tile colour on the POS grid (hex)
  SortOrder INTEGER NOT NULL DEFAULT 0,
  IsActive INTEGER NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Name TEXT NOT NULL,
  ContactName TEXT,
  Email TEXT,
  Phone TEXT,
  Notes TEXT,
  IsActive INTEGER NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Name TEXT NOT NULL,
  Sku TEXT,
  Barcode TEXT,                          -- primary barcode (EAN/UPC/Code128); extra ones in product_barcodes
  CategoryId INTEGER,
  SupplierId INTEGER,
  PriceCents INTEGER NOT NULL DEFAULT 0, -- selling price incl. tax when prices_include_tax = 1
  CostCents INTEGER,
  TaxRateBp INTEGER,                     -- NULL = store default (settings.tax_rate_bp)
  TaxExempt INTEGER NOT NULL DEFAULT 0,
  TrackInventory INTEGER NOT NULL DEFAULT 1,
  StockQty REAL NOT NULL DEFAULT 0,
  LowStockThreshold REAL,
  Unit TEXT NOT NULL DEFAULT 'each',     -- each | kg | g | l | m
  IsWeighed INTEGER NOT NULL DEFAULT 0,  -- quantity entered/scale, price per unit
  ImageUrl TEXT,
  ImageFileId TEXT,
  Color TEXT,                            -- tile colour override
  Status TEXT NOT NULL DEFAULT 'active', -- active | inactive
  Notes TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Additional barcodes for the same product (pack sizes, supplier codes).
CREATE TABLE IF NOT EXISTS product_barcodes (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  ProductId INTEGER NOT NULL,
  Barcode TEXT NOT NULL,
  Label TEXT,
  PackQty REAL NOT NULL DEFAULT 1,       -- units of the product one scan adds (e.g. 6 for a six-pack)
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Append-only stock ledger; StockQty on the product is the materialised sum.
CREATE TABLE IF NOT EXISTS inventory_movements (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  ProductId INTEGER NOT NULL,
  Delta REAL NOT NULL,
  Reason TEXT NOT NULL,                  -- sale | refund | receive | adjust | count | void
  Reference TEXT,
  Note TEXT,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Goods received (a delivery from a supplier).
CREATE TABLE IF NOT EXISTS stock_receipts (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Reference TEXT NOT NULL,
  SupplierId INTEGER,
  Note TEXT,
  TotalCostCents INTEGER NOT NULL DEFAULT 0,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  ReceiptId INTEGER NOT NULL,
  ProductId INTEGER NOT NULL,
  Qty REAL NOT NULL,
  UnitCostCents INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------- registers & shifts
CREATE TABLE IF NOT EXISTS registers (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Name TEXT NOT NULL,
  Location TEXT,
  IsActive INTEGER NOT NULL DEFAULT 1,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A teller's session on a register: opened with a float, closed with a cash count.
CREATE TABLE IF NOT EXISTS shifts (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  RegisterId INTEGER NOT NULL,
  TellerUserId INTEGER NOT NULL,
  TellerName TEXT,
  TellerEmail TEXT,
  Status TEXT NOT NULL DEFAULT 'open',   -- open | closed
  OpeningFloatCents INTEGER NOT NULL DEFAULT 0,
  ExpectedCashCents INTEGER,             -- filled at close: float + cash sales - cash refunds + pay-ins - pay-outs
  CountedCashCents INTEGER,
  DifferenceCents INTEGER,
  Note TEXT,
  OpenedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ClosedAt DATETIME,
  ClosedBy TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  ShiftId INTEGER NOT NULL,
  Type TEXT NOT NULL,                    -- payin | payout | drop
  AmountCents INTEGER NOT NULL,
  Note TEXT,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- customers
CREATE TABLE IF NOT EXISTS customers (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Name TEXT NOT NULL,
  Email TEXT,
  Phone TEXT,
  Notes TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- sales
CREATE TABLE IF NOT EXISTS sales (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  Reference TEXT NOT NULL UNIQUE,        -- receipt number, e.g. R-100042
  ShiftId INTEGER,
  RegisterId INTEGER,
  TellerUserId INTEGER,
  TellerName TEXT,
  CustomerId INTEGER,
  CustomerName TEXT,
  CustomerEmail TEXT,
  Status TEXT NOT NULL DEFAULT 'open',   -- open | held | completed | voided | refunded | partially_refunded
  Currency TEXT NOT NULL DEFAULT 'ZAR',
  SubtotalCents INTEGER NOT NULL DEFAULT 0,   -- sum of line totals after line discounts
  DiscountCents INTEGER NOT NULL DEFAULT 0,   -- sale-level discount
  TaxCents INTEGER NOT NULL DEFAULT 0,
  TotalCents INTEGER NOT NULL DEFAULT 0,
  PaidCents INTEGER NOT NULL DEFAULT 0,
  ChangeCents INTEGER NOT NULL DEFAULT 0,
  RefundedCents INTEGER NOT NULL DEFAULT 0,
  HoldLabel TEXT,
  Note TEXT,
  CompletedAt DATETIME,
  VoidedAt DATETIME,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  SaleId INTEGER NOT NULL,
  ProductId INTEGER,
  Name TEXT NOT NULL,
  Sku TEXT,
  Barcode TEXT,
  Unit TEXT NOT NULL DEFAULT 'each',
  Qty REAL NOT NULL DEFAULT 1,
  UnitPriceCents INTEGER NOT NULL DEFAULT 0,
  DiscountCents INTEGER NOT NULL DEFAULT 0, -- per line, absolute
  TaxRateBp INTEGER NOT NULL DEFAULT 0,
  TaxCents INTEGER NOT NULL DEFAULT 0,
  LineTotalCents INTEGER NOT NULL DEFAULT 0, -- qty * unit - discount (incl. tax when tax-inclusive)
  RefundedQty REAL NOT NULL DEFAULT 0,
  Position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sale_payments (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  SaleId INTEGER NOT NULL,
  Method TEXT NOT NULL,                  -- cash | card (Cloudgate Wallet hosted page)
  AmountCents INTEGER NOT NULL,          -- applied to the sale
  TenderedCents INTEGER,                 -- cash handed over
  ChangeCents INTEGER NOT NULL DEFAULT 0,
  Status TEXT NOT NULL DEFAULT 'succeeded', -- pending | succeeded | failed | expired | refunded
  Reference TEXT,
  ConnectPaymentId INTEGER,
  PaymentUrl TEXT,
  IsProduction INTEGER NOT NULL DEFAULT 0,
  RawJson TEXT,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  SaleId INTEGER NOT NULL,
  Reference TEXT NOT NULL,
  Method TEXT NOT NULL,                  -- cash | card
  AmountCents INTEGER NOT NULL,
  Reason TEXT,
  ItemsJson TEXT,                        -- [{saleItemId, qty, amountCents}]
  ConnectRefundId INTEGER,
  Status TEXT NOT NULL DEFAULT 'completed',
  ShiftId INTEGER,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_events (
  Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  SaleId INTEGER NOT NULL,
  Type TEXT NOT NULL,
  Message TEXT,
  DataJson TEXT,
  CreatedBy TEXT,
  CreatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- indexes
CREATE INDEX IF NOT EXISTS ix_products_barcode ON products(Barcode);
CREATE INDEX IF NOT EXISTS ix_products_sku ON products(Sku);
CREATE INDEX IF NOT EXISTS ix_products_category ON products(CategoryId, Status);
CREATE INDEX IF NOT EXISTS ix_product_barcodes_code ON product_barcodes(Barcode);
CREATE INDEX IF NOT EXISTS ix_movements_product ON inventory_movements(ProductId, CreatedAt);
CREATE INDEX IF NOT EXISTS ix_shifts_status ON shifts(Status, RegisterId);
CREATE INDEX IF NOT EXISTS ix_shifts_teller ON shifts(TellerUserId, Status);
CREATE INDEX IF NOT EXISTS ix_sales_status ON sales(Status, CreatedAt);
CREATE INDEX IF NOT EXISTS ix_sales_shift ON sales(ShiftId);
CREATE INDEX IF NOT EXISTS ix_sales_completed ON sales(CompletedAt);
CREATE INDEX IF NOT EXISTS ix_sale_items_sale ON sale_items(SaleId);
CREATE INDEX IF NOT EXISTS ix_sale_payments_sale ON sale_payments(SaleId);
CREATE INDEX IF NOT EXISTS ix_sale_payments_connect ON sale_payments(ConnectPaymentId);
CREATE INDEX IF NOT EXISTS ix_refunds_sale ON refunds(SaleId);
CREATE INDEX IF NOT EXISTS ix_cash_movements_shift ON cash_movements(ShiftId);

-- ---------------------------------------------------------------- seed: settings
INSERT INTO settings (Key, Value)
SELECT v.Key, v.Value FROM (
  SELECT 'store_name' AS Key, 'Cloudgate POS' AS Value UNION ALL
  SELECT 'store_tagline', 'Point of sale' UNION ALL
  SELECT 'store_address', '' UNION ALL
  SELECT 'store_phone', '' UNION ALL
  SELECT 'support_email', '' UNION ALL
  SELECT 'store_url', '' UNION ALL
  SELECT 'store_logo_url', '' UNION ALL
  SELECT 'store_icon_url', '' UNION ALL
  SELECT 'currency', 'ZAR' UNION ALL
  SELECT 'tax_rate_bp', '1500' UNION ALL           -- 15% VAT
  SELECT 'prices_include_tax', '1' UNION ALL
  SELECT 'tax_number', '' UNION ALL
  SELECT 'sale_reference_prefix', 'R-' UNION ALL
  SELECT 'sale_reference_seed', '100000' UNION ALL
  SELECT 'receipt_header', 'Thank you for shopping with us' UNION ALL
  SELECT 'receipt_footer', 'Keep this receipt for returns within 14 days.' UNION ALL
  SELECT 'payment_cash_enabled', '1' UNION ALL
  SELECT 'payment_card_enabled', '1' UNION ALL
  SELECT 'allow_negative_stock', '0' UNION ALL
  SELECT 'require_shift', '1' UNION ALL
  SELECT 'low_stock_threshold', '5' UNION ALL
  SELECT 'quick_cash_amounts', '20,50,100,200' UNION ALL
  SELECT 'label_size', '50x30' UNION ALL
  SELECT 'theme_primary', '#0f172a' UNION ALL
  SELECT 'theme_secondary', '#2563eb'
) v
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.Key = v.Key);

INSERT INTO registers (Name, Location)
SELECT 'Till 1', 'Front counter' WHERE NOT EXISTS (SELECT 1 FROM registers);

-- @sample-catalog:start (skipped with apply_sql.py --skip-sample / bundle sample-data.sql)
-- ---------------------------------------------------------------- seed: sample catalogue (dev only)
INSERT INTO categories (Name, Color, SortOrder)
SELECT v.Name, v.Color, v.SortOrder FROM (
  SELECT 'Drinks' AS Name, '#0ea5e9' AS Color, 1 AS SortOrder UNION ALL
  SELECT 'Snacks', '#f59e0b', 2 UNION ALL
  SELECT 'Groceries', '#10b981', 3 UNION ALL
  SELECT 'Household', '#8b5cf6', 4
) v
WHERE NOT EXISTS (SELECT 1 FROM categories);

INSERT INTO products (Name, Sku, Barcode, CategoryId, PriceCents, CostCents, StockQty, LowStockThreshold, Unit, IsWeighed)
SELECT v.Name, v.Sku, v.Barcode, (SELECT Id FROM categories WHERE Name = v.Cat), v.PriceCents, v.CostCents, v.StockQty, 5, v.Unit, v.IsWeighed FROM (
  SELECT 'Sparkling water 500ml' AS Name, 'DR-001' AS Sku, '6001234500017' AS Barcode, 'Drinks' AS Cat, 1499 AS PriceCents, 800 AS CostCents, 48 AS StockQty, 'each' AS Unit, 0 AS IsWeighed UNION ALL
  SELECT 'Cola 330ml can', 'DR-002', '6001234500024', 'Drinks', 1799, 1000, 36, 'each', 0 UNION ALL
  SELECT 'Orange juice 1L', 'DR-003', '6001234500031', 'Drinks', 3499, 2200, 12, 'each', 0 UNION ALL
  SELECT 'Salted peanuts 100g', 'SN-001', '6001234500048', 'Snacks', 2299, 1300, 24, 'each', 0 UNION ALL
  SELECT 'Potato chips 125g', 'SN-002', '6001234500055', 'Snacks', 2499, 1400, 3, 'each', 0 UNION ALL
  SELECT 'Milk chocolate bar', 'SN-003', '6001234500062', 'Snacks', 1899, 1100, 40, 'each', 0 UNION ALL
  SELECT 'Brown bread 700g', 'GR-001', '6001234500079', 'Groceries', 1999, 1200, 10, 'each', 0 UNION ALL
  SELECT 'Full cream milk 2L', 'GR-002', '6001234500086', 'Groceries', 3299, 2400, 15, 'each', 0 UNION ALL
  SELECT 'Bananas', 'GR-003', '2000000000012', 'Groceries', 1999, 1100, 20, 'kg', 1 UNION ALL
  SELECT 'Dishwashing liquid 750ml', 'HH-001', '6001234500093', 'Household', 4599, 2800, 8, 'each', 0
) v
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy)
SELECT p.Id, p.StockQty, 'receive', 'SEED', 'Opening stock', 'system'
FROM products p
WHERE p.StockQty > 0 AND NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.ProductId = p.Id AND m.Reference = 'SEED');
-- @sample-catalog:end

-- @durable-refunds
-- Durable refund requests. Safe to apply to existing sandbox/production databases.
CREATE TABLE IF NOT EXISTS refund_requests (
 Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 RequestKey TEXT NOT NULL UNIQUE,
 BusinessId INTEGER NOT NULL,
 Method TEXT NOT NULL CHECK(Method IN ('card','cash')),
 AmountCents INTEGER NOT NULL CHECK(AmountCents > 0 OR (AmountCents=0 AND Status='failed')),
 Currency TEXT NOT NULL,
 PaymentRowId INTEGER,
 PaymentId INTEGER,
 IntentJson TEXT NOT NULL CHECK(json_valid(IntentJson)),
 LinesJson TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(LinesJson)),
 SnapshotRefunded INTEGER NOT NULL,
 Status TEXT NOT NULL DEFAULT 'submitting' CHECK(Status IN ('submitting','pending','succeeded','failed','reconciliation_required')),
 ProviderRefundId TEXT,
 Applied INTEGER NOT NULL DEFAULT 0,
 ShiftId INTEGER,
 CreatedBy TEXT,
 RawJson TEXT,
 CreatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UpdatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_refund_unresolved ON refund_requests(BusinessId) WHERE Status NOT IN ('succeeded','failed');
CREATE UNIQUE INDEX IF NOT EXISTS ux_refund_provider ON refund_requests(PaymentId,ProviderRefundId) WHERE ProviderRefundId IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_refund_business ON refund_requests(BusinessId,Id);
CREATE TRIGGER IF NOT EXISTS refund_key_guard BEFORE INSERT ON refund_requests
WHEN EXISTS(SELECT 1 FROM refund_requests WHERE RequestKey=NEW.RequestKey AND (BusinessId<>NEW.BusinessId OR IntentJson<>NEW.IntentJson))
BEGIN SELECT RAISE(ROLLBACK,'Refund request key is already bound to different details.'); END;

CREATE TRIGGER IF NOT EXISTS refund_claim_guard BEFORE INSERT ON refund_requests
WHEN NEW.Status<>'failed' AND NOT EXISTS(SELECT 1 FROM refund_requests WHERE RequestKey=NEW.RequestKey)
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sales WHERE Id=NEW.BusinessId AND Status IN ('completed','partially_refunded')
 AND RefundedCents=NEW.SnapshotRefunded AND NEW.AmountCents<=TotalCents-RefundedCents AND upper(Currency)=NEW.Currency)
 THEN RAISE(ROLLBACK,'Sale balance changed. Reload the sale before refunding.') END;
 SELECT CASE WHEN NEW.AmountCents>(SELECT COALESCE(SUM(AmountCents),0) FROM sale_payments WHERE SaleId=NEW.BusinessId AND Method=NEW.Method AND Status='succeeded')
 -(SELECT COALESCE(SUM(AmountCents),0) FROM refunds WHERE SaleId=NEW.BusinessId AND Method=NEW.Method AND Status='completed')
 THEN RAISE(ROLLBACK,'Refund exceeds the amount paid by this method.') END;
 SELECT CASE WHEN NEW.Method='card' AND NOT EXISTS(SELECT 1 FROM sale_payments WHERE Id=NEW.PaymentRowId AND SaleId=NEW.BusinessId AND ConnectPaymentId=NEW.PaymentId AND Method='card' AND Status='succeeded' AND AmountCents>=NEW.AmountCents)
 THEN RAISE(ROLLBACK,'Original card payment is not refundable.') END;
 SELECT CASE WHEN json_array_length(NEW.LinesJson)=0 OR EXISTS(SELECT 1 FROM json_each(NEW.LinesJson) l LEFT JOIN sale_items i ON i.Id=json_extract(l.value,'$.saleItemId')
 WHERE i.Id IS NULL OR i.SaleId<>NEW.BusinessId OR abs(i.RefundedQty-json_extract(l.value,'$.expectedRefundedQty'))>0.000000001
 OR json_extract(l.value,'$.qty')<=0 OR json_extract(l.value,'$.qty')>i.Qty-i.RefundedQty+0.000000001)
 THEN RAISE(ROLLBACK,'Returned quantities changed. Reload the sale.') END;
 SELECT CASE WHEN NEW.ShiftId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shifts WHERE Id=NEW.ShiftId AND Status='open')
 THEN RAISE(ROLLBACK,'The cash refund shift has closed.') END;
END;
CREATE TRIGGER IF NOT EXISTS refund_apply AFTER UPDATE OF Status ON refund_requests
WHEN NEW.Status='succeeded' AND OLD.Applied=0 AND OLD.Status<>'succeeded'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sales WHERE Id=NEW.BusinessId AND RefundedCents=NEW.SnapshotRefunded)
 THEN RAISE(ROLLBACK,'Refund needs reconciliation: local sale balance changed.') END;
 INSERT INTO refunds(SaleId,Reference,Method,AmountCents,Reason,ItemsJson,ConnectRefundId,ShiftId,CreatedBy)
 VALUES(NEW.BusinessId,(SELECT Reference FROM sales WHERE Id=NEW.BusinessId)||'-RF-'||NEW.Id,NEW.Method,NEW.AmountCents,json_extract(NEW.IntentJson,'$.reason'),NEW.LinesJson,NEW.ProviderRefundId,NEW.ShiftId,NEW.CreatedBy);
 UPDATE sale_items SET RefundedQty=RefundedQty+(SELECT json_extract(value,'$.qty') FROM json_each(NEW.LinesJson) WHERE json_extract(value,'$.saleItemId')=sale_items.Id)
 WHERE Id IN (SELECT json_extract(value,'$.saleItemId') FROM json_each(NEW.LinesJson));
 UPDATE products SET StockQty=StockQty+(SELECT SUM(json_extract(value,'$.qty')) FROM json_each(NEW.LinesJson) WHERE json_extract(value,'$.productId')=products.Id),UpdatedAt=CURRENT_TIMESTAMP
 WHERE Id IN (SELECT json_extract(value,'$.productId') FROM json_each(NEW.LinesJson)) AND TrackInventory=1;
 INSERT INTO inventory_movements(ProductId,Delta,Reason,Reference,Note,CreatedBy)
 SELECT p.Id,json_extract(l.value,'$.qty'),'refund',(SELECT Reference FROM sales WHERE Id=NEW.BusinessId),'Confirmed refund '||NEW.RequestKey,NEW.CreatedBy
 FROM json_each(NEW.LinesJson) l JOIN products p ON p.Id=json_extract(l.value,'$.productId') WHERE p.TrackInventory=1;
 UPDATE sales SET RefundedCents=RefundedCents+NEW.AmountCents,
 Status=CASE WHEN RefundedCents+NEW.AmountCents>=TotalCents THEN 'refunded' ELSE 'partially_refunded' END,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.BusinessId;
 INSERT INTO sale_events(SaleId,Type,Message,DataJson,CreatedBy)
 VALUES(NEW.BusinessId,'refund',NEW.Method||' refund confirmed',json_object('requestKey',NEW.RequestKey,'refundId',NEW.ProviderRefundId,'reason',json_extract(NEW.IntentJson,'$.reason')),NEW.CreatedBy);
 UPDATE refund_requests SET Applied=1,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.Id;
END;
