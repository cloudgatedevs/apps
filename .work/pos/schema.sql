-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Key] NVARCHAR(254) NOT NULL,
    [Value] NVARCHAR(MAX) NULL,
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [categories] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Color] NVARCHAR(MAX) NULL,
    [SortOrder] BIGINT NOT NULL DEFAULT (0),
    [IsActive] BIGINT NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

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

CREATE TABLE [product_barcodes] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [Barcode] NVARCHAR(254) NOT NULL,
    [Label] NVARCHAR(MAX) NULL,
    [PackQty] DECIMAL(28,9) NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

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

CREATE TABLE [stock_receipts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Reference] NVARCHAR(254) NOT NULL,
    [SupplierId] BIGINT NULL,
    [Note] NVARCHAR(MAX) NULL,
    [TotalCostCents] BIGINT NOT NULL DEFAULT (0),
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [stock_receipt_items] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ReceiptId] BIGINT NOT NULL,
    [ProductId] BIGINT NOT NULL,
    [Qty] DECIMAL(28,9) NOT NULL,
    [UnitCostCents] BIGINT NOT NULL DEFAULT (0)
);

CREATE TABLE [registers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Location] NVARCHAR(MAX) NULL,
    [IsActive] BIGINT NOT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

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

CREATE TABLE [cash_movements] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ShiftId] BIGINT NOT NULL,
    [Type] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [Note] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [customers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Email] NVARCHAR(MAX) NULL,
    [Phone] NVARCHAR(MAX) NULL,
    [Notes] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

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

CREATE TABLE [refunds] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [Reference] NVARCHAR(254) NOT NULL,
    [Method] NVARCHAR(MAX) NOT NULL,
    [AmountCents] BIGINT NOT NULL,
    [Reason] NVARCHAR(MAX) NULL,
    [ItemsJson] NVARCHAR(MAX) NULL,
    [ConnectRefundId] BIGINT NULL,
    [Status] NVARCHAR(MAX) NOT NULL DEFAULT ('completed'),
    [ShiftId] BIGINT NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [sale_events] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [SaleId] BIGINT NOT NULL,
    [Type] NVARCHAR(MAX) NOT NULL,
    [Message] NVARCHAR(MAX) NULL,
    [DataJson] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NOT NULL DEFAULT (SYSUTCDATETIME())
);

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

CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([Key]);

CREATE INDEX [ix_products_category] ON [products] ([CategoryId], [Status]);

CREATE INDEX [ix_products_sku] ON [products] ([Sku]);

CREATE INDEX [ix_products_barcode] ON [products] ([Barcode]);

CREATE INDEX [ix_product_barcodes_code] ON [product_barcodes] ([Barcode]);

CREATE INDEX [ix_movements_product] ON [inventory_movements] ([ProductId], [CreatedAt]);

CREATE INDEX [ix_shifts_teller] ON [shifts] ([TellerUserId], [Status]);

CREATE INDEX [ix_shifts_status] ON [shifts] ([Status], [RegisterId]);

CREATE INDEX [ix_cash_movements_shift] ON [cash_movements] ([ShiftId]);

CREATE INDEX [ix_sales_completed] ON [sales] ([CompletedAt]);

CREATE INDEX [ix_sales_shift] ON [sales] ([ShiftId]);

CREATE INDEX [ix_sales_status] ON [sales] ([Status], [CreatedAt]);

CREATE UNIQUE INDEX [ux_sales_3] ON [sales] ([Reference]);

CREATE INDEX [ix_sale_items_sale] ON [sale_items] ([SaleId]);

CREATE INDEX [ix_sale_payments_connect] ON [sale_payments] ([ConnectPaymentId]);

CREATE INDEX [ix_sale_payments_sale] ON [sale_payments] ([SaleId]);

CREATE INDEX [ix_refunds_sale] ON [refunds] ([SaleId]);

CREATE INDEX [ix_refund_business] ON [refund_requests] ([BusinessId], [Id]);

CREATE UNIQUE INDEX [ux_refund_provider] ON [refund_requests] ([PaymentId], [ProviderRefundId]) WHERE ProviderRefundId IS NOT NULL;

CREATE UNIQUE INDEX [ux_refund_unresolved] ON [refund_requests] ([BusinessId]) WHERE Status <> 'succeeded' AND Status <> 'failed';

CREATE UNIQUE INDEX [ux_refund_requests_3] ON [refund_requests] ([RequestKey]);
SET IDENTITY_INSERT [settings] ON;
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (1, N'store_name', N'Cloudgate POS', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (2, N'store_tagline', N'Point of sale', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (3, N'store_address', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (4, N'store_phone', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (5, N'support_email', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (6, N'store_url', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (7, N'store_logo_url', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (8, N'store_icon_url', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (9, N'currency', N'ZAR', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (10, N'tax_rate_bp', N'1500', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (11, N'prices_include_tax', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (12, N'tax_number', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (13, N'sale_reference_prefix', N'R-', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (14, N'sale_reference_seed', N'100000', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (15, N'receipt_header', N'Thank you for shopping with us', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (16, N'receipt_footer', N'Keep this receipt for returns within 14 days.', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (17, N'payment_cash_enabled', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (18, N'payment_card_enabled', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (19, N'allow_negative_stock', N'0', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (20, N'require_shift', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (21, N'low_stock_threshold', N'5', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (22, N'quick_cash_amounts', N'20,50,100,200', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (23, N'label_size', N'50x30', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (24, N'theme_primary', N'#0f172a', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (25, N'theme_secondary', N'#2563eb', N'2026-10-26 02:36:42');
SET IDENTITY_INSERT [settings] OFF;
SET IDENTITY_INSERT [registers] ON;
INSERT INTO [registers] ([Id], [Name], [Location], [IsActive], [CreatedAt]) VALUES (1, N'Till 1', N'Front counter', 1, N'2026-10-26 02:36:42');
SET IDENTITY_INSERT [registers] OFF;
