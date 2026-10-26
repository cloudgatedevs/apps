-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

IF OBJECT_ID(N'settings',N'U') IS NULL
CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Key] NVARCHAR(254) NOT NULL,
    [Value] NVARCHAR(MAX) NULL,
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'categories',N'U') IS NULL
CREATE TABLE [categories] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Color] NVARCHAR(MAX) NULL,
    [SortOrder] BIGINT NOT NULL DEFAULT (0),
    [IsActive] BIGINT NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'suppliers',N'U') IS NULL
CREATE TABLE [suppliers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [ContactName] NVARCHAR(MAX) NULL,
    [Email] NVARCHAR(MAX) NULL,
    [Phone] NVARCHAR(MAX) NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [IsActive] BIGINT NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'products',N'U') IS NULL
CREATE TABLE [products] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Sku] NVARCHAR(254) NULL,
    [Barcode] NVARCHAR(254) NULL,
    [CategoryId] BIGINT NULL,
    [SupplierId] BIGINT NULL,
    [PriceCents] BIGINT NOT NULL DEFAULT (0),
    [CostCents] BIGINT NULL,
    [TaxRateBp] BIGINT NULL,
    [TaxExempt] BIGINT NOT NULL DEFAULT (0),
    [TrackInventory] BIGINT NOT NULL DEFAULT (1),
    [StockQty] DECIMAL(28,9) NOT NULL DEFAULT (0),
    [LowStockThreshold] DECIMAL(28,9) NULL,
    [Unit] NVARCHAR(MAX) NOT NULL DEFAULT ('each'),
    [IsWeighed] BIGINT NOT NULL DEFAULT (0),
    [ImageUrl] NVARCHAR(MAX) NULL,
    [ImageFileId] NVARCHAR(MAX) NULL,
    [Color] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(254) NOT NULL DEFAULT ('active'),
    [Notes] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'product_barcodes',N'U') IS NULL
CREATE TABLE [product_barcodes] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [Barcode] NVARCHAR(254) NOT NULL,
    [Label] NVARCHAR(MAX) NULL,
    [PackQty] DECIMAL(28,9) NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'inventory_movements',N'U') IS NULL
CREATE TABLE [inventory_movements] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [Delta] DECIMAL(28,9) NOT NULL,
    [Reason] NVARCHAR(MAX) NOT NULL,
    [Reference] NVARCHAR(254) NULL,
    [Note] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'stock_receipts',N'U') IS NULL
CREATE TABLE [stock_receipts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Reference] NVARCHAR(254) NOT NULL,
    [SupplierId] BIGINT NULL,
    [Note] NVARCHAR(MAX) NULL,
    [TotalCostCents] BIGINT NOT NULL DEFAULT (0),
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'stock_receipt_items',N'U') IS NULL
CREATE TABLE [stock_receipt_items] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ReceiptId] BIGINT NOT NULL,
    [ProductId] BIGINT NOT NULL,
    [Qty] DECIMAL(28,9) NOT NULL,
    [UnitCostCents] BIGINT NOT NULL DEFAULT (0)
);

IF OBJECT_ID(N'registers',N'U') IS NULL
CREATE TABLE [registers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Location] NVARCHAR(MAX) NULL,
    [IsActive] BIGINT NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'shifts',N'U') IS NULL
CREATE TABLE [shifts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [RegisterId] BIGINT NOT NULL,
    [TellerUserId] BIGINT NOT NULL,
    [TellerName] NVARCHAR(MAX) NULL,
    [TellerEmail] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(254) NOT NULL DEFAULT ('open'),
    [OpeningFloatCents] BIGINT NOT NULL DEFAULT (0),
    [ExpectedCashCents] BIGINT NULL,
    [CountedCashCents] BIGINT NULL,
    [DifferenceCents] BIGINT NULL,
    [Note] NVARCHAR(MAX) NULL,
    [OpenedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [ClosedAt] DATETIME2(3) NULL,
    [ClosedBy] NVARCHAR(MAX) NULL
);

IF OBJECT_ID(N'cash_movements',N'U') IS NULL
CREATE TABLE [cash_movements] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ShiftId] BIGINT NOT NULL,
    [Type] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [Note] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'customers',N'U') IS NULL
CREATE TABLE [customers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Email] NVARCHAR(MAX) NULL,
    [Phone] NVARCHAR(MAX) NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'sales',N'U') IS NULL
CREATE TABLE [sales] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Reference] NVARCHAR(254) NOT NULL,
    [ShiftId] BIGINT NULL,
    [RegisterId] BIGINT NULL,
    [TellerUserId] BIGINT NULL,
    [TellerName] NVARCHAR(MAX) NULL,
    [CustomerId] BIGINT NULL,
    [CustomerName] NVARCHAR(MAX) NULL,
    [CustomerEmail] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(254) NOT NULL DEFAULT ('open'),
    [Currency] NVARCHAR(MAX) NOT NULL DEFAULT ('ZAR'),
    [SubtotalCents] BIGINT NOT NULL DEFAULT (0),
    [DiscountCents] BIGINT NOT NULL DEFAULT (0),
    [TaxCents] BIGINT NOT NULL DEFAULT (0),
    [TotalCents] BIGINT NOT NULL DEFAULT (0),
    [PaidCents] BIGINT NOT NULL DEFAULT (0),
    [ChangeCents] BIGINT NOT NULL DEFAULT (0),
    [RefundedCents] BIGINT NOT NULL DEFAULT (0),
    [HoldLabel] NVARCHAR(MAX) NULL,
    [Note] NVARCHAR(MAX) NULL,
    [CompletedAt] DATETIME2(3) NULL,
    [VoidedAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'sale_items',N'U') IS NULL
CREATE TABLE [sale_items] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [ProductId] BIGINT NULL,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Sku] NVARCHAR(MAX) NULL,
    [Barcode] NVARCHAR(MAX) NULL,
    [Unit] NVARCHAR(MAX) NOT NULL DEFAULT ('each'),
    [Qty] DECIMAL(28,9) NOT NULL DEFAULT (1),
    [UnitPriceCents] BIGINT NOT NULL DEFAULT (0),
    [DiscountCents] BIGINT NOT NULL DEFAULT (0),
    [TaxRateBp] BIGINT NOT NULL DEFAULT (0),
    [TaxCents] BIGINT NOT NULL DEFAULT (0),
    [LineTotalCents] BIGINT NOT NULL DEFAULT (0),
    [RefundedQty] DECIMAL(28,9) NOT NULL DEFAULT (0),
    [Position] BIGINT NOT NULL DEFAULT (0)
);

IF OBJECT_ID(N'sale_payments',N'U') IS NULL
CREATE TABLE [sale_payments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [Method] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [TenderedCents] BIGINT NULL,
    [ChangeCents] BIGINT NOT NULL DEFAULT (0),
    [Status] NVARCHAR(MAX) NOT NULL DEFAULT ('succeeded'),
    [Reference] NVARCHAR(254) NULL,
    [ConnectPaymentId] BIGINT NULL,
    [PaymentUrl] NVARCHAR(MAX) NULL,
    [IsProduction] BIGINT NOT NULL DEFAULT (0),
    [RawJson] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'refunds',N'U') IS NULL
CREATE TABLE [refunds] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [Reference] NVARCHAR(254) NOT NULL,
    [Method] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [Reason] NVARCHAR(MAX) NULL,
    [ItemsJson] NVARCHAR(MAX) NULL,
    [ConnectRefundId] NVARCHAR(254) NULL,
    [Status] NVARCHAR(MAX) NOT NULL DEFAULT ('completed'),
    [ShiftId] BIGINT NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'sale_events',N'U') IS NULL
CREATE TABLE [sale_events] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [Type] NVARCHAR(MAX) NOT NULL,
    [Message] NVARCHAR(MAX) NULL,
    [DataJson] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'refund_requests',N'U') IS NULL
CREATE TABLE [refund_requests] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [RequestKey] NVARCHAR(254) NOT NULL,
    [BusinessId] BIGINT NOT NULL,
    [Method] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [Currency] NVARCHAR(MAX) NOT NULL,
    [PaymentRowId] BIGINT NULL,
    [PaymentId] BIGINT NULL,
    [IntentJson] NVARCHAR(MAX) NOT NULL,
    [LinesJson] NVARCHAR(MAX) NOT NULL DEFAULT ('[]'),
    [SnapshotRefunded] BIGINT NOT NULL,
    [Status] NVARCHAR(MAX) NOT NULL DEFAULT ('submitting'),
    [ProviderRefundId] NVARCHAR(254) NULL,
    [Applied] BIGINT NOT NULL DEFAULT (0),
    [ShiftId] BIGINT NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [RawJson] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'settings') AND name=N'ux_settings_0')
CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([Key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'products') AND name=N'ix_products_category')
CREATE INDEX [ix_products_category] ON [products] ([CategoryId], [Status]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'products') AND name=N'ix_products_sku')
CREATE INDEX [ix_products_sku] ON [products] ([Sku]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'products') AND name=N'ix_products_barcode')
CREATE INDEX [ix_products_barcode] ON [products] ([Barcode]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'product_barcodes') AND name=N'ix_product_barcodes_code')
CREATE INDEX [ix_product_barcodes_code] ON [product_barcodes] ([Barcode]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'inventory_movements') AND name=N'ix_movements_product')
CREATE INDEX [ix_movements_product] ON [inventory_movements] ([ProductId], [CreatedAt]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'shifts') AND name=N'ix_shifts_teller')
CREATE INDEX [ix_shifts_teller] ON [shifts] ([TellerUserId], [Status]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'shifts') AND name=N'ix_shifts_status')
CREATE INDEX [ix_shifts_status] ON [shifts] ([Status], [RegisterId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'cash_movements') AND name=N'ix_cash_movements_shift')
CREATE INDEX [ix_cash_movements_shift] ON [cash_movements] ([ShiftId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sales') AND name=N'ix_sales_completed')
CREATE INDEX [ix_sales_completed] ON [sales] ([CompletedAt]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sales') AND name=N'ix_sales_shift')
CREATE INDEX [ix_sales_shift] ON [sales] ([ShiftId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sales') AND name=N'ix_sales_status')
CREATE INDEX [ix_sales_status] ON [sales] ([Status], [CreatedAt]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sales') AND name=N'ux_sales_3')
CREATE UNIQUE INDEX [ux_sales_3] ON [sales] ([Reference]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sale_items') AND name=N'ix_sale_items_sale')
CREATE INDEX [ix_sale_items_sale] ON [sale_items] ([SaleId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sale_payments') AND name=N'ix_sale_payments_connect')
CREATE INDEX [ix_sale_payments_connect] ON [sale_payments] ([ConnectPaymentId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'sale_payments') AND name=N'ix_sale_payments_sale')
CREATE INDEX [ix_sale_payments_sale] ON [sale_payments] ([SaleId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refunds') AND name=N'ix_refunds_sale')
CREATE INDEX [ix_refunds_sale] ON [refunds] ([SaleId]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'ix_refund_business')
CREATE INDEX [ix_refund_business] ON [refund_requests] ([BusinessId], [Id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'ux_refund_provider')
CREATE UNIQUE INDEX [ux_refund_provider] ON [refund_requests] ([PaymentId], [ProviderRefundId]) WHERE ProviderRefundId IS NOT NULL;

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'ux_refund_unresolved')
CREATE UNIQUE INDEX [ux_refund_unresolved] ON [refund_requests] ([BusinessId]) WHERE Status <> 'succeeded' AND Status <> 'failed';

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'ux_refund_requests_3')
CREATE UNIQUE INDEX [ux_refund_requests_3] ON [refund_requests] ([RequestKey]);
SET IDENTITY_INSERT [settings] ON;
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=1)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (1, N'store_name', N'Cloudgate POS', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=2)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (2, N'store_tagline', N'Point of sale', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=3)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (3, N'store_address', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=4)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (4, N'store_phone', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=5)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (5, N'support_email', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=6)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (6, N'store_url', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=7)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (7, N'store_logo_url', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=8)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (8, N'store_icon_url', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=9)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (9, N'currency', N'ZAR', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=10)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (10, N'tax_rate_bp', N'1500', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=11)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (11, N'prices_include_tax', N'1', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=12)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (12, N'tax_number', N'', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=13)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (13, N'sale_reference_prefix', N'R-', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=14)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (14, N'sale_reference_seed', N'100000', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=15)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (15, N'receipt_header', N'Thank you for shopping with us', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=16)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (16, N'receipt_footer', N'Keep this receipt for returns within 14 days.', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=17)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (17, N'payment_cash_enabled', N'1', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=18)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (18, N'payment_card_enabled', N'1', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=19)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (19, N'allow_negative_stock', N'0', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=20)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (20, N'require_shift', N'1', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=21)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (21, N'low_stock_threshold', N'5', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=22)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (22, N'quick_cash_amounts', N'20,50,100,200', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=23)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (23, N'label_size', N'50x30', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=24)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (24, N'theme_primary', N'#0f172a', N'2026-10-26 02:36:42');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=25)
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (25, N'theme_secondary', N'#2563eb', N'2026-10-26 02:36:42');
SET IDENTITY_INSERT [settings] OFF;
SET IDENTITY_INSERT [registers] ON;
IF NOT EXISTS(SELECT 1 FROM [registers] WHERE [Id]=1)
INSERT INTO [registers] ([Id], [Name], [Location], [IsActive], [CreatedAt]) VALUES (1, N'Till 1', N'Front counter', 1, N'2026-10-26 02:36:42');
SET IDENTITY_INSERT [registers] OFF;

IF OBJECT_ID(N'ck_refund_requests_0',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_0] CHECK ([Method] IN ('card', 'cash'));

IF OBJECT_ID(N'ck_refund_requests_1',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_1] CHECK ([AmountCents] > 0 OR ([AmountCents] = 0 AND [Status] = 'failed'));

IF OBJECT_ID(N'ck_refund_requests_2',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_2] CHECK (ISJSON([IntentJson])=1);

IF OBJECT_ID(N'ck_refund_requests_3',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_3] CHECK (ISJSON([LinesJson])=1);

IF OBJECT_ID(N'ck_refund_requests_4',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_4] CHECK ([Status] IN ('submitting', 'pending', 'succeeded', 'failed', 'reconciliation_required'));

EXEC(N'CREATE OR ALTER TRIGGER [refund_claim_guard] ON [refund_requests] AFTER INSERT AS
BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @Id INT, @RequestKey NVARCHAR(254), @BusinessId BIGINT, @Method NVARCHAR(MAX), @AmountCents BIGINT, @Currency NVARCHAR(MAX), @PaymentRowId BIGINT, @PaymentId BIGINT, @IntentJson NVARCHAR(MAX), @LinesJson NVARCHAR(MAX), @SnapshotRefunded BIGINT, @Status NVARCHAR(MAX), @ProviderRefundId NVARCHAR(254), @Applied BIGINT, @ShiftId BIGINT, @CreatedBy NVARCHAR(MAX), @RawJson NVARCHAR(MAX), @CreatedAt DATETIME2(3), @UpdatedAt DATETIME2(3);
DECLARE refund_rows CURSOR LOCAL FAST_FORWARD FOR SELECT i.[Id], i.[RequestKey], i.[BusinessId], i.[Method], i.[AmountCents], i.[Currency], i.[PaymentRowId], i.[PaymentId], i.[IntentJson], i.[LinesJson], i.[SnapshotRefunded], i.[Status], i.[ProviderRefundId], i.[Applied], i.[ShiftId], i.[CreatedBy], i.[RawJson], i.[CreatedAt], i.[UpdatedAt] FROM inserted i WHERE i.[Status]<>''failed'';
OPEN refund_rows; FETCH NEXT FROM refund_rows INTO @Id, @RequestKey, @BusinessId, @Method, @AmountCents, @Currency, @PaymentRowId, @PaymentId, @IntentJson, @LinesJson, @SnapshotRefunded, @Status, @ProviderRefundId, @Applied, @ShiftId, @CreatedBy, @RawJson, @CreatedAt, @UpdatedAt;
WHILE @@FETCH_STATUS=0 BEGIN
IF NOT EXISTS(SELECT 1 FROM sales WHERE Id = @BusinessId AND Status IN (''completed'', ''partially_refunded'') AND RefundedCents = @SnapshotRefunded AND @AmountCents <= TotalCents - RefundedCents AND UPPER(Currency) = @Currency) THROW 50002, N''Sale balance changed. Reload the sale before refunding.'', 1;
IF @AmountCents > (SELECT COALESCE(SUM(AmountCents), 0) FROM sale_payments WHERE SaleId = @BusinessId AND Method = @Method AND Status = ''succeeded'') - (SELECT COALESCE(SUM(AmountCents), 0) FROM refunds WHERE SaleId = @BusinessId AND Method = @Method AND Status = ''completed'') THROW 50002, N''Refund exceeds the amount paid by this method.'', 1;
IF @Method = ''card'' AND NOT EXISTS(SELECT 1 FROM sale_payments WHERE Id = @PaymentRowId AND SaleId = @BusinessId AND ConnectPaymentId = @PaymentId AND Method = ''card'' AND Status = ''succeeded'' AND AmountCents >= @AmountCents) THROW 50002, N''Original card payment is not refundable.'', 1;
IF (SELECT COUNT(*) FROM OPENJSON(@LinesJson)) = 0 OR EXISTS(SELECT 1 FROM OPENJSON(@LinesJson) AS l LEFT JOIN sale_items AS i ON i.Id = TRY_CONVERT(BIGINT, JSON_VALUE(l.value, ''$.saleItemId'')) WHERE i.Id IS NULL OR i.SaleId <> @BusinessId OR ABS(i.RefundedQty - TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(l.value, ''$.expectedRefundedQty''))) > 0.000000001 OR TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(l.value, ''$.qty'')) <= 0 OR TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(l.value, ''$.qty'')) > i.Qty - i.RefundedQty + 0.000000001) THROW 50002, N''Returned quantities changed. Reload the sale.'', 1;
IF NOT @ShiftId IS NULL AND NOT EXISTS(SELECT 1 FROM shifts WHERE Id = @ShiftId AND Status = ''open'') THROW 50002, N''The cash refund shift has closed.'', 1;
FETCH NEXT FROM refund_rows INTO @Id, @RequestKey, @BusinessId, @Method, @AmountCents, @Currency, @PaymentRowId, @PaymentId, @IntentJson, @LinesJson, @SnapshotRefunded, @Status, @ProviderRefundId, @Applied, @ShiftId, @CreatedBy, @RawJson, @CreatedAt, @UpdatedAt;
END; CLOSE refund_rows; DEALLOCATE refund_rows; END;');

EXEC(N'CREATE OR ALTER TRIGGER [refund_apply] ON [refund_requests] AFTER UPDATE AS
BEGIN SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @Id INT, @RequestKey NVARCHAR(254), @BusinessId BIGINT, @Method NVARCHAR(MAX), @AmountCents BIGINT, @Currency NVARCHAR(MAX), @PaymentRowId BIGINT, @PaymentId BIGINT, @IntentJson NVARCHAR(MAX), @LinesJson NVARCHAR(MAX), @SnapshotRefunded BIGINT, @Status NVARCHAR(MAX), @ProviderRefundId NVARCHAR(254), @Applied BIGINT, @ShiftId BIGINT, @CreatedBy NVARCHAR(MAX), @RawJson NVARCHAR(MAX), @CreatedAt DATETIME2(3), @UpdatedAt DATETIME2(3);
DECLARE refund_rows CURSOR LOCAL FAST_FORWARD FOR SELECT i.[Id], i.[RequestKey], i.[BusinessId], i.[Method], i.[AmountCents], i.[Currency], i.[PaymentRowId], i.[PaymentId], i.[IntentJson], i.[LinesJson], i.[SnapshotRefunded], i.[Status], i.[ProviderRefundId], i.[Applied], i.[ShiftId], i.[CreatedBy], i.[RawJson], i.[CreatedAt], i.[UpdatedAt] FROM inserted i JOIN deleted d ON d.Id=i.Id WHERE i.[Status]=''succeeded'' AND d.[Applied]=0 AND d.[Status]<>''succeeded'';
OPEN refund_rows; FETCH NEXT FROM refund_rows INTO @Id, @RequestKey, @BusinessId, @Method, @AmountCents, @Currency, @PaymentRowId, @PaymentId, @IntentJson, @LinesJson, @SnapshotRefunded, @Status, @ProviderRefundId, @Applied, @ShiftId, @CreatedBy, @RawJson, @CreatedAt, @UpdatedAt;
WHILE @@FETCH_STATUS=0 BEGIN
IF NOT EXISTS(SELECT 1 FROM sales WHERE Id = @BusinessId AND RefundedCents = @SnapshotRefunded) THROW 50002, N''Refund needs reconciliation: local sale balance changed.'', 1;
INSERT INTO refunds (SaleId, Reference, Method, AmountCents, Reason, ItemsJson, ConnectRefundId, ShiftId, CreatedBy) VALUES (@BusinessId, CONCAT((SELECT Reference FROM sales WHERE Id = @BusinessId), ''-RF-'', @Id), @Method, @AmountCents, ISNULL(JSON_QUERY(@IntentJson, ''$.reason''), JSON_VALUE(@IntentJson, ''$.reason'')), @LinesJson, @ProviderRefundId, @ShiftId, @CreatedBy);
UPDATE sale_items SET RefundedQty = RefundedQty + (SELECT TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(value, ''$.qty'')) FROM OPENJSON(@LinesJson) WHERE TRY_CONVERT(BIGINT, JSON_VALUE(value, ''$.saleItemId'')) = sale_items.Id) WHERE Id IN (SELECT TRY_CONVERT(BIGINT, JSON_VALUE(value, ''$.saleItemId'')) FROM OPENJSON(@LinesJson));
UPDATE products SET StockQty = StockQty + (SELECT SUM(TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(value, ''$.qty''))) FROM OPENJSON(@LinesJson) WHERE TRY_CONVERT(BIGINT, JSON_VALUE(value, ''$.productId'')) = products.Id), UpdatedAt = GETDATE() WHERE Id IN (SELECT TRY_CONVERT(BIGINT, JSON_VALUE(value, ''$.productId'')) FROM OPENJSON(@LinesJson)) AND TrackInventory = 1;
INSERT INTO inventory_movements (ProductId, Delta, Reason, Reference, Note, CreatedBy) SELECT p.Id, TRY_CONVERT(NUMERIC(28, 9), JSON_VALUE(l.value, ''$.qty'')), ''refund'', (SELECT Reference FROM sales WHERE Id = @BusinessId), CONCAT(''Confirmed refund '', @RequestKey), @CreatedBy FROM OPENJSON(@LinesJson) AS l JOIN products AS p ON p.Id = TRY_CONVERT(BIGINT, JSON_VALUE(l.value, ''$.productId'')) WHERE p.TrackInventory = 1;
UPDATE sales SET RefundedCents = RefundedCents + @AmountCents, Status = CASE WHEN RefundedCents + @AmountCents >= TotalCents THEN ''refunded'' ELSE ''partially_refunded'' END, UpdatedAt = GETDATE() WHERE Id = @BusinessId;
INSERT INTO sale_events (SaleId, Type, Message, DataJson, CreatedBy) VALUES (@BusinessId, ''refund'', CONCAT(@Method, '' refund confirmed''), JSON_OBJECT(''requestKey'': @RequestKey, ''refundId'': @ProviderRefundId, ''reason'': ISNULL(JSON_QUERY(@IntentJson, ''$.reason''), JSON_VALUE(@IntentJson, ''$.reason''))), @CreatedBy);
UPDATE refund_requests SET Applied = 1, UpdatedAt = GETDATE() WHERE Id = @Id;
FETCH NEXT FROM refund_rows INTO @Id, @RequestKey, @BusinessId, @Method, @AmountCents, @Currency, @PaymentRowId, @PaymentId, @IntentJson, @LinesJson, @SnapshotRefunded, @Status, @ProviderRefundId, @Applied, @ShiftId, @CreatedBy, @RawJson, @CreatedAt, @UpdatedAt;
END; CLOSE refund_rows; DEALLOCATE refund_rows; END;');
