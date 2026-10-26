-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Key] NVARCHAR(254) NOT NULL,
    [Value] NVARCHAR(MAX) NULL,
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [categories] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Slug] NVARCHAR(254) NOT NULL,
    [Description] NVARCHAR(MAX) NULL,
    [ParentId] BIGINT NULL,
    [ImageUrl] NVARCHAR(MAX) NULL,
    [SortOrder] BIGINT NULL DEFAULT (0),
    [IsActive] BIGINT NULL DEFAULT (1),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [products] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(254) NOT NULL,
    [Slug] NVARCHAR(254) NOT NULL,
    [Sku] NVARCHAR(MAX) NULL,
    [Brand] NVARCHAR(MAX) NULL,
    [ShortDescription] NVARCHAR(MAX) NULL,
    [Description] NVARCHAR(MAX) NULL,
    [CategoryId] BIGINT NULL,
    [Status] NVARCHAR(254) NULL DEFAULT ('draft'),
    [PriceCents] BIGINT NOT NULL DEFAULT (0),
    [CompareAtCents] BIGINT NULL,
    [CostCents] BIGINT NULL,
    [Currency] NVARCHAR(MAX) NULL DEFAULT ('ZAR'),
    [TrackInventory] BIGINT NULL DEFAULT (1),
    [HasVariants] BIGINT NULL DEFAULT (0),
    [WeightGrams] BIGINT NULL,
    [Tags] NVARCHAR(MAX) NULL,
    [IsFeatured] BIGINT NULL DEFAULT (0),
    [SortOrder] BIGINT NULL DEFAULT (0),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [product_options] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [Name] NVARCHAR(MAX) NOT NULL,
    [Position] BIGINT NULL DEFAULT (0)
);

CREATE TABLE [product_option_values] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OptionId] BIGINT NOT NULL,
    [Value] NVARCHAR(MAX) NOT NULL,
    [Position] BIGINT NULL DEFAULT (0)
);

CREATE TABLE [product_variants] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [Sku] NVARCHAR(254) NULL,
    [Barcode] NVARCHAR(MAX) NULL,
    [Title] NVARCHAR(MAX) NULL,
    [OptionsJson] NVARCHAR(MAX) NULL,
    [PriceCents] BIGINT NULL,
    [CompareAtCents] BIGINT NULL,
    [CostCents] BIGINT NULL,
    [StockQty] BIGINT NULL DEFAULT (0),
    [ReservedQty] BIGINT NULL DEFAULT (0),
    [LowStockThreshold] BIGINT NULL DEFAULT (5),
    [ImageId] BIGINT NULL,
    [IsDefault] BIGINT NULL DEFAULT (0),
    [IsActive] BIGINT NULL DEFAULT (1),
    [Position] BIGINT NULL DEFAULT (0),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [product_images] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ProductId] BIGINT NOT NULL,
    [VariantId] BIGINT NULL,
    [FileId] NVARCHAR(MAX) NULL,
    [Url] NVARCHAR(MAX) NOT NULL,
    [ThumbUrl] NVARCHAR(MAX) NULL,
    [Alt] NVARCHAR(MAX) NULL,
    [Position] BIGINT NULL DEFAULT (0),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [inventory_movements] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [VariantId] BIGINT NOT NULL,
    [ProductId] BIGINT NOT NULL,
    [Delta] BIGINT NOT NULL,
    [Reason] NVARCHAR(MAX) NOT NULL,
    [Reference] NVARCHAR(254) NULL,
    [Note] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [customers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [IdpUserId] BIGINT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [Name] NVARCHAR(MAX) NULL,
    [Surname] NVARCHAR(MAX) NULL,
    [Phone] NVARCHAR(MAX) NULL,
    [DefaultAddressJson] NVARCHAR(MAX) NULL,
    [MarketingOptIn] BIGINT NULL DEFAULT (0),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [carts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Token] NVARCHAR(254) NOT NULL,
    [IdpUserId] BIGINT NULL,
    [CustomerId] BIGINT NULL,
    [Status] NVARCHAR(MAX) NULL DEFAULT ('open'),
    [Currency] NVARCHAR(MAX) NULL DEFAULT ('ZAR'),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [cart_items] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [CartId] BIGINT NOT NULL,
    [ProductId] BIGINT NOT NULL,
    [VariantId] BIGINT NOT NULL,
    [Qty] BIGINT NOT NULL DEFAULT (1),
    [UnitPriceCents] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [orders] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Reference] NVARCHAR(254) NOT NULL,
    [CartId] BIGINT NULL,
    [CustomerId] BIGINT NULL,
    [IdpUserId] BIGINT NULL,
    [Email] NVARCHAR(254) NOT NULL,
    [Name] NVARCHAR(MAX) NULL,
    [Surname] NVARCHAR(MAX) NULL,
    [Phone] NVARCHAR(MAX) NULL,
    [ShippingAddressJson] NVARCHAR(MAX) NULL,
    [BillingAddressJson] NVARCHAR(MAX) NULL,
    [Currency] NVARCHAR(MAX) NULL DEFAULT ('ZAR'),
    [SubtotalCents] BIGINT NOT NULL DEFAULT (0),
    [DiscountCents] BIGINT NOT NULL DEFAULT (0),
    [ShippingCents] BIGINT NOT NULL DEFAULT (0),
    [TaxCents] BIGINT NOT NULL DEFAULT (0),
    [TotalCents] BIGINT NOT NULL DEFAULT (0),
    [Status] NVARCHAR(254) NULL DEFAULT ('pending'),
    [PaymentStatus] NVARCHAR(MAX) NULL DEFAULT ('unpaid'),
    [FulfillmentStatus] NVARCHAR(MAX) NULL DEFAULT ('unfulfilled'),
    [CustomerNote] NVARCHAR(MAX) NULL,
    [InternalNote] NVARCHAR(MAX) NULL,
    [PaidAt] DATETIME2(3) NULL,
    [ShippedAt] DATETIME2(3) NULL,
    [CancelledAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [order_items] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OrderId] BIGINT NOT NULL,
    [ProductId] BIGINT NOT NULL,
    [VariantId] BIGINT NOT NULL,
    [Sku] NVARCHAR(MAX) NULL,
    [Title] NVARCHAR(MAX) NOT NULL,
    [VariantTitle] NVARCHAR(MAX) NULL,
    [ImageUrl] NVARCHAR(MAX) NULL,
    [Qty] BIGINT NOT NULL,
    [UnitPriceCents] BIGINT NOT NULL,
    [LineTotalCents] BIGINT NOT NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [order_events] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OrderId] BIGINT NOT NULL,
    [Type] NVARCHAR(MAX) NOT NULL,
    [Message] NVARCHAR(MAX) NULL,
    [DataJson] NVARCHAR(MAX) NULL,
    [CreatedBy] NVARCHAR(MAX) NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [payments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [OrderId] BIGINT NOT NULL,
    [Provider] NVARCHAR(MAX) NULL DEFAULT ('cloudgate_wallet'),
    [ConnectPaymentId] BIGINT NULL,
    [IdempotencyKey] NVARCHAR(254) NULL,
    [PaymentUrl] NVARCHAR(MAX) NULL,
    [AmountCents] BIGINT NOT NULL,
    [Currency] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(MAX) NULL DEFAULT ('pending'),
    [RefundedCents] BIGINT NULL DEFAULT (0),
    [IsProduction] BIGINT NULL DEFAULT (0),
    [RawJson] NVARCHAR(MAX) NULL,
    [PaidAt] DATETIME2(3) NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
);

CREATE TABLE [pages] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Slug] NVARCHAR(254) NOT NULL,
    [Title] NVARCHAR(MAX) NOT NULL,
    [Summary] NVARCHAR(MAX) NULL,
    [BodyMarkdown] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [Status] NVARCHAR(MAX) NULL DEFAULT ('published'),
    [ShowInNav] BIGINT NULL DEFAULT (0),
    [ShowInFooter] BIGINT NULL DEFAULT (1),
    [Position] BIGINT NULL DEFAULT (0),
    [IsSystem] BIGINT NULL DEFAULT (0),
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [ShowContact] BIGINT NULL DEFAULT (0)
);

CREATE TABLE [contact_messages] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [Name] NVARCHAR(MAX) NULL,
    [Email] NVARCHAR(MAX) NOT NULL,
    [Subject] NVARCHAR(MAX) NULL,
    [Message] NVARCHAR(MAX) NOT NULL,
    [OrderReference] NVARCHAR(MAX) NULL,
    [Status] NVARCHAR(254) NULL DEFAULT ('new'),
    [IdpUserId] BIGINT NULL,
    [CreatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME()),
    [UpdatedAt] DATETIME2(3) NULL DEFAULT (SYSUTCDATETIME())
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

CREATE INDEX [ix_categories_parent] ON [categories] ([ParentId]);

CREATE UNIQUE INDEX [ux_categories_1] ON [categories] ([Slug]);

CREATE INDEX [ix_products_name] ON [products] ([Name]);

CREATE INDEX [ix_products_status] ON [products] ([Status]);

CREATE INDEX [ix_products_category] ON [products] ([CategoryId]);

CREATE UNIQUE INDEX [ux_products_3] ON [products] ([Slug]);

CREATE INDEX [ix_options_product] ON [product_options] ([ProductId]);

CREATE INDEX [ix_option_values_option] ON [product_option_values] ([OptionId]);

CREATE INDEX [ix_variants_sku] ON [product_variants] ([Sku]);

CREATE INDEX [ix_variants_product] ON [product_variants] ([ProductId]);

CREATE INDEX [ix_images_product] ON [product_images] ([ProductId], [Position]);

CREATE INDEX [ix_movements_variant] ON [inventory_movements] ([VariantId], [CreatedAt]);

CREATE INDEX [ix_customers_email] ON [customers] ([Email]);

CREATE UNIQUE INDEX [ux_customers_1] ON [customers] ([IdpUserId]) WHERE [IdpUserId] IS NOT NULL;

CREATE INDEX [ix_carts_user] ON [carts] ([IdpUserId]);

CREATE UNIQUE INDEX [ux_carts_1] ON [carts] ([Token]);

CREATE INDEX [ix_cart_items_cart] ON [cart_items] ([CartId]);

CREATE UNIQUE INDEX [ux_cart_items_1] ON [cart_items] ([CartId], [VariantId]);

CREATE INDEX [ix_orders_created] ON [orders] ([CreatedAt]);

CREATE INDEX [ix_orders_status] ON [orders] ([Status]);

CREATE INDEX [ix_orders_user] ON [orders] ([IdpUserId]);

CREATE INDEX [ix_orders_email] ON [orders] ([Email]);

CREATE UNIQUE INDEX [ux_orders_4] ON [orders] ([Reference]);

CREATE INDEX [ix_order_items_order] ON [order_items] ([OrderId]);

CREATE INDEX [ix_order_events_order] ON [order_events] ([OrderId], [CreatedAt]);

CREATE INDEX [ix_payments_connect] ON [payments] ([ConnectPaymentId]);

CREATE INDEX [ix_payments_order] ON [payments] ([OrderId]);

CREATE UNIQUE INDEX [ux_payments_2] ON [payments] ([IdempotencyKey]) WHERE [IdempotencyKey] IS NOT NULL;

CREATE UNIQUE INDEX [ux_pages_0] ON [pages] ([Slug]);

CREATE INDEX [ix_contact_status] ON [contact_messages] ([Status], [CreatedAt]);

CREATE INDEX [ix_refund_business] ON [refund_requests] ([BusinessId], [Id]);

CREATE UNIQUE INDEX [ux_refund_provider] ON [refund_requests] ([PaymentId], [ProviderRefundId]) WHERE ProviderRefundId IS NOT NULL;

CREATE UNIQUE INDEX [ux_refund_unresolved] ON [refund_requests] ([BusinessId]) WHERE Status <> 'succeeded' AND Status <> 'failed';

CREATE UNIQUE INDEX [ux_refund_requests_3] ON [refund_requests] ([RequestKey]);
SET IDENTITY_INSERT [settings] ON;
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (1, N'store_name', N'Cloudgate Shop', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (2, N'currency', N'ZAR', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (3, N'tax_rate_bp', N'1500', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (4, N'prices_include_tax', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (5, N'shipping_flat_cents', N'9900', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (6, N'free_shipping_threshold_cents', N'100000', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (7, N'order_reference_prefix', N'SO-', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (8, N'order_reference_seed', N'100000', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (9, N'support_email', N'support@example.com', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (10, N'store_tagline', N'Considered essentials for everyday life.', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (11, N'announcement_text', N'Free shipping on orders over R1 000', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (12, N'announcement_url', N'/shop', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (13, N'cookie_consent_enabled', N'1', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (14, N'cookie_consent_text', N'We use cookies to keep your cart, remember your preferences and understand how the store is used.', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (15, N'contact_phone', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (16, N'contact_address', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (17, N'contact_hours', N'Monday to Friday, 9:00-17:00', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (18, N'social_instagram', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (19, N'social_facebook', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (20, N'social_x', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (21, N'social_tiktok', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (22, N'footer_note', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (23, N'theme_primary', N'#18181b', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (24, N'theme_secondary', N'#4f46e5', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (25, N'store_icon_url', N'', N'2026-10-26 02:36:42');
INSERT INTO [settings] ([Id], [Key], [Value], [UpdatedAt]) VALUES (26, N'store_description', N'Thoughtfully made pieces, priced honestly, delivered with care.', N'2026-10-26 02:36:42');
SET IDENTITY_INSERT [settings] OFF;
SET IDENTITY_INSERT [pages] ON;
INSERT INTO [pages] ([Id], [Slug], [Title], [Summary], [BodyMarkdown], [Status], [ShowInNav], [ShowInFooter], [Position], [IsSystem], [CreatedAt], [UpdatedAt], [ShowContact]) VALUES (1, N'about', N'About us', N'Who we are and why we make what we make.', N'## Our story

Write a few paragraphs about the people behind the store, what you make or curate, and what you care about. Customers buy from people, not catalogues.

## What we stand for

- **Quality first.** Describe how you choose or make your products.
- **Honest pricing.** Say something about value.
- **Real support.** Explain how customers can reach you.', N'published', 1, 1, 10, 1, N'2026-10-26 02:36:42', N'2026-10-26 02:36:42', 1);
INSERT INTO [pages] ([Id], [Slug], [Title], [Summary], [BodyMarkdown], [Status], [ShowInNav], [ShowInFooter], [Position], [IsSystem], [CreatedAt], [UpdatedAt], [ShowContact]) VALUES (2, N'shipping-returns', N'Shipping & returns', N'Delivery times, costs and how to return something.', N'## Shipping

Orders are dispatched within 1-2 working days. Delivery within South Africa usually takes 2-4 working days with tracking sent by email once your parcel is on its way.

Shipping is a flat rate per order, and free above the threshold shown in your cart.

## Returns

Changed your mind? Contact us within 14 days of delivery. Items must be unused and in their original packaging. Refunds go back to the original card once the return has been received and checked.

## Damaged or wrong items

Send us a photo within 48 hours of delivery and we will sort it out at no cost to you.', N'published', 0, 1, 20, 1, N'2026-10-26 02:36:42', N'2026-10-26 02:36:42', 0);
INSERT INTO [pages] ([Id], [Slug], [Title], [Summary], [BodyMarkdown], [Status], [ShowInNav], [ShowInFooter], [Position], [IsSystem], [CreatedAt], [UpdatedAt], [ShowContact]) VALUES (3, N'terms', N'Terms of service', N'The agreement between you and the store when you buy from us.', N'_Last updated: 2026-10-26_

## 1. About these terms

These terms apply to every order placed through this store. By placing an order you agree to them. Please replace this template with terms reviewed for your business and jurisdiction.

## 2. Orders and payment

An order is accepted when payment has been confirmed and you receive an order confirmation. Prices include VAT unless stated otherwise. Payments are processed securely by our payment provider; we never see or store your card details.

## 3. Delivery

Delivery times are estimates. Risk in the goods passes to you on delivery.

## 4. Returns and refunds

See our Shipping & returns page for how returns work. Your statutory rights are not affected.

## 5. Liability

To the extent permitted by law, our liability for any claim is limited to the amount you paid for the order concerned.

## 6. Contact

Questions about these terms? Use the Contact page.', N'published', 0, 1, 30, 1, N'2026-10-26 02:36:42', N'2026-10-26 02:36:42', 0);
INSERT INTO [pages] ([Id], [Slug], [Title], [Summary], [BodyMarkdown], [Status], [ShowInNav], [ShowInFooter], [Position], [IsSystem], [CreatedAt], [UpdatedAt], [ShowContact]) VALUES (4, N'privacy', N'Privacy policy', N'What we collect, why, and how we look after it.', N'_Last updated: 2026-10-26_

## What we collect

When you order we collect your name, email address, phone number and delivery address so we can fulfil and support your order. If you create an account, your login is handled by our identity provider.

## How we use it

- To process, deliver and support your orders.
- To send order confirmations and shipping updates.
- To send marketing email only if you opted in; every email has an unsubscribe link.

## Cookies

We use a small number of cookies and local storage entries to keep your cart, remember your preferences and understand how the store is used. See the cookie notice for details.

## Payments

Card payments are processed by our payment provider. We never receive your full card number.

## Your rights

You can ask us to show, correct or delete the personal information we hold about you. Contact us and we will respond within a reasonable time.', N'published', 0, 1, 40, 1, N'2026-10-26 02:36:42', N'2026-10-26 02:36:42', 0);
INSERT INTO [pages] ([Id], [Slug], [Title], [Summary], [BodyMarkdown], [Status], [ShowInNav], [ShowInFooter], [Position], [IsSystem], [CreatedAt], [UpdatedAt], [ShowContact]) VALUES (5, N'faq', N'Frequently asked questions', N'Quick answers about ordering, delivery and returns.', N'## Do I need an account to order?

No. You can check out as a guest with just an email address. Creating an account lets you see your order history.

## How do I track my order?

When your order ships you receive an email with the carrier and tracking number. Signed-in customers can also see it under Your orders.

## Which payment methods do you accept?

All major debit and credit cards through our secure payment page.

## Can I change or cancel an order?

Contact us as soon as possible. Orders that have not shipped can usually be changed or cancelled.', N'published', 0, 1, 50, 1, N'2026-10-26 02:36:42', N'2026-10-26 02:36:42', 0);
SET IDENTITY_INSERT [pages] OFF;
