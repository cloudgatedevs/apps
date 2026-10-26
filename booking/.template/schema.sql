-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

IF OBJECT_ID(N'customer_accounts',N'U') IS NULL
CREATE TABLE [customer_accounts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [user_id] NVARCHAR(254) NOT NULL,
    [name] NVARCHAR(MAX) NOT NULL,
    [phone] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [created] BIGINT NOT NULL,
    [updated] BIGINT NOT NULL
);

IF OBJECT_ID(N'booking_accounts',N'U') IS NULL
CREATE TABLE [booking_accounts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [user_id] NVARCHAR(254) NOT NULL,
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'settings',N'U') IS NULL
CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [key] NVARCHAR(254) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL
);

IF OBJECT_ID(N'services',N'U') IS NULL
CREATE TABLE [services] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(MAX) NOT NULL,
    [category] NVARCHAR(MAX) NOT NULL DEFAULT ('Wellness'),
    [description] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [duration] BIGINT NOT NULL,
    [buffer] BIGINT NOT NULL DEFAULT (10),
    [price] BIGINT NOT NULL,
    [deposit_percent] BIGINT NOT NULL DEFAULT (100),
    [resource_type] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [active] BIGINT NOT NULL DEFAULT (1),
    [color] NVARCHAR(MAX) NOT NULL DEFAULT ('#b5c8b5'),
    [intake] NVARCHAR(MAX) NOT NULL DEFAULT ('')
);

IF OBJECT_ID(N'staff',N'U') IS NULL
CREATE TABLE [staff] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(MAX) NOT NULL,
    [title] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [bio] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [color] NVARCHAR(MAX) NOT NULL DEFAULT ('#b5c8b5'),
    [service_ids] NVARCHAR(MAX) NOT NULL DEFAULT ('[]'),
    [hours] NVARCHAR(MAX) NOT NULL DEFAULT ('{}'),
    [active] BIGINT NOT NULL DEFAULT (1)
);

IF OBJECT_ID(N'resources',N'U') IS NULL
CREATE TABLE [resources] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(MAX) NOT NULL,
    [type] NVARCHAR(MAX) NOT NULL,
    [active] BIGINT NOT NULL DEFAULT (1)
);

IF OBJECT_ID(N'blocks',N'U') IS NULL
CREATE TABLE [blocks] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [staff_id] INT NULL,
    [resource_id] INT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL,
    [reason] NVARCHAR(MAX) NOT NULL DEFAULT ('Unavailable')
);

IF OBJECT_ID(N'customers',N'U') IS NULL
CREATE TABLE [customers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [email] NVARCHAR(254) NOT NULL,
    [name] NVARCHAR(MAX) NOT NULL,
    [phone] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [notes] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [marketing] BIGINT NOT NULL DEFAULT (0),
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'bookings',N'U') IS NULL
CREATE TABLE [bookings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [reference] NVARCHAR(254) NOT NULL,
    [token_hash] NVARCHAR(MAX) NOT NULL,
    [request_key] NVARCHAR(254) NOT NULL,
    [customer_id] INT NOT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL,
    [expires] BIGINT NOT NULL,
    [total] BIGINT NOT NULL,
    [due] BIGINT NOT NULL,
    [paid] BIGINT NOT NULL DEFAULT (0),
    [refunded] BIGINT NOT NULL DEFAULT (0),
    [currency] NVARCHAR(MAX) NOT NULL,
    [notes] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [intake] NVARCHAR(MAX) NOT NULL DEFAULT ('{}'),
    [payment_id] NVARCHAR(MAX) NULL,
    [payment_url] NVARCHAR(MAX) NULL,
    [created] BIGINT NOT NULL,
    [updated] BIGINT NOT NULL,
    [version] BIGINT NOT NULL DEFAULT (1)
);

IF OBJECT_ID(N'allocations',N'U') IS NULL
CREATE TABLE [allocations] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [service_id] INT NOT NULL,
    [staff_id] INT NOT NULL,
    [resource_id] INT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL,
    [service_name] NVARCHAR(MAX) NOT NULL,
    [price] BIGINT NOT NULL,
    [duration] BIGINT NOT NULL,
    [active] BIGINT NOT NULL DEFAULT (1)
);

IF OBJECT_ID(N'payments',N'U') IS NULL
CREATE TABLE [payments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [external_id] NVARCHAR(254) NOT NULL,
    [kind] NVARCHAR(254) NOT NULL,
    [amount] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL,
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'refund_requests',N'U') IS NULL
CREATE TABLE [refund_requests] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [request_key] NVARCHAR(254) NOT NULL,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [amount] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL DEFAULT ('pending'),
    [provider_id] NVARCHAR(MAX) NULL,
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'waitlist',N'U') IS NULL
CREATE TABLE [waitlist] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(MAX) NOT NULL,
    [email] NVARCHAR(MAX) NOT NULL,
    [phone] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [service_id] INT NOT NULL,
    [staff_id] INT NULL,
    [preferred_date] NVARCHAR(MAX) NOT NULL,
    [notes] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [status] NVARCHAR(MAX) NOT NULL DEFAULT ('waiting'),
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'promos',N'U') IS NULL
CREATE TABLE [promos] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [code] NVARCHAR(254) NOT NULL,
    [percent] BIGINT NOT NULL,
    [ends] NVARCHAR(MAX) NOT NULL,
    [active] BIGINT NOT NULL DEFAULT (1)
);

IF OBJECT_ID(N'messages',N'U') IS NULL
CREATE TABLE [messages] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NULL,
    [recipient] NVARCHAR(MAX) NOT NULL,
    [subject] NVARCHAR(MAX) NOT NULL,
    [body] NVARCHAR(MAX) NOT NULL,
    [due] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL DEFAULT ('queued'),
    [attempts] BIGINT NOT NULL DEFAULT (0),
    [last_error] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [dedupe] NVARCHAR(254) NOT NULL
);

IF OBJECT_ID(N'audit',N'U') IS NULL
CREATE TABLE [audit] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NULL,
    [action] NVARCHAR(MAX) NOT NULL,
    [actor] NVARCHAR(MAX) NOT NULL,
    [detail] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'abandoned_booking_requests',N'U') IS NULL
CREATE TABLE [abandoned_booking_requests] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [request_key] NVARCHAR(254) NOT NULL,
    [created] BIGINT NOT NULL
);

IF OBJECT_ID(N'service_metadata',N'U') IS NULL
CREATE TABLE [service_metadata] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [service_id] INT NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [deleted] BIGINT NOT NULL DEFAULT (0)
);

IF OBJECT_ID(N'staff_metadata',N'U') IS NULL
CREATE TABLE [staff_metadata] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [staff_id] INT NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL DEFAULT ('')
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'customer_accounts') AND name=N'ux_customer_accounts_0')
CREATE UNIQUE INDEX [ux_customer_accounts_0] ON [customer_accounts] ([user_id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'booking_accounts') AND name=N'booking_account_user')
CREATE INDEX [booking_account_user] ON [booking_accounts] ([user_id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'booking_accounts') AND name=N'ux_booking_accounts_1')
CREATE UNIQUE INDEX [ux_booking_accounts_1] ON [booking_accounts] ([booking_ref]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'settings') AND name=N'ux_settings_0')
CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'customers') AND name=N'ux_customers_0')
CREATE UNIQUE INDEX [ux_customers_0] ON [customers] ([email]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'bookings') AND name=N'ux_bookings_0')
CREATE UNIQUE INDEX [ux_bookings_0] ON [bookings] ([request_key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'bookings') AND name=N'ux_bookings_1')
CREATE UNIQUE INDEX [ux_bookings_1] ON [bookings] ([reference]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'allocations') AND name=N'allocations_resource_time')
CREATE INDEX [allocations_resource_time] ON [allocations] ([resource_id], [starts], [ends], [active]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'allocations') AND name=N'allocations_staff_time')
CREATE INDEX [allocations_staff_time] ON [allocations] ([staff_id], [starts], [ends], [active]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'payments') AND name=N'ux_payments_0')
CREATE UNIQUE INDEX [ux_payments_0] ON [payments] ([external_id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'one_pending_refund')
CREATE UNIQUE INDEX [one_pending_refund] ON [refund_requests] ([booking_ref]) WHERE status <> 'succeeded' AND status <> 'failed';

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'refund_requests') AND name=N'ux_refund_requests_1')
CREATE UNIQUE INDEX [ux_refund_requests_1] ON [refund_requests] ([request_key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'promos') AND name=N'ux_promos_0')
CREATE UNIQUE INDEX [ux_promos_0] ON [promos] ([code]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'messages') AND name=N'ux_messages_0')
CREATE UNIQUE INDEX [ux_messages_0] ON [messages] ([dedupe]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'abandoned_booking_requests') AND name=N'ux_abandoned_booking_requests_0')
CREATE UNIQUE INDEX [ux_abandoned_booking_requests_0] ON [abandoned_booking_requests] ([request_key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'service_metadata') AND name=N'ux_service_metadata_0')
CREATE UNIQUE INDEX [ux_service_metadata_0] ON [service_metadata] ([service_id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'staff_metadata') AND name=N'ux_staff_metadata_0')
CREATE UNIQUE INDEX [ux_staff_metadata_0] ON [staff_metadata] ([staff_id]);

IF OBJECT_ID(N'fk_booking_accounts_booking_ref',N'F') IS NULL
ALTER TABLE [booking_accounts] ADD CONSTRAINT [fk_booking_accounts_booking_ref] FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

IF OBJECT_ID(N'fk_blocks_resource_id',N'F') IS NULL
ALTER TABLE [blocks] ADD CONSTRAINT [fk_blocks_resource_id] FOREIGN KEY ([resource_id]) REFERENCES [resources] ([Id]);

IF OBJECT_ID(N'fk_blocks_staff_id',N'F') IS NULL
ALTER TABLE [blocks] ADD CONSTRAINT [fk_blocks_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

IF OBJECT_ID(N'fk_bookings_customer_id',N'F') IS NULL
ALTER TABLE [bookings] ADD CONSTRAINT [fk_bookings_customer_id] FOREIGN KEY ([customer_id]) REFERENCES [customers] ([Id]);

IF OBJECT_ID(N'fk_allocations_resource_id',N'F') IS NULL
ALTER TABLE [allocations] ADD CONSTRAINT [fk_allocations_resource_id] FOREIGN KEY ([resource_id]) REFERENCES [resources] ([Id]);

IF OBJECT_ID(N'fk_allocations_staff_id',N'F') IS NULL
ALTER TABLE [allocations] ADD CONSTRAINT [fk_allocations_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

IF OBJECT_ID(N'fk_allocations_service_id',N'F') IS NULL
ALTER TABLE [allocations] ADD CONSTRAINT [fk_allocations_service_id] FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

IF OBJECT_ID(N'fk_allocations_booking_ref',N'F') IS NULL
ALTER TABLE [allocations] ADD CONSTRAINT [fk_allocations_booking_ref] FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

IF OBJECT_ID(N'fk_payments_booking_ref',N'F') IS NULL
ALTER TABLE [payments] ADD CONSTRAINT [fk_payments_booking_ref] FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

IF OBJECT_ID(N'fk_refund_requests_booking_ref',N'F') IS NULL
ALTER TABLE [refund_requests] ADD CONSTRAINT [fk_refund_requests_booking_ref] FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

IF OBJECT_ID(N'fk_waitlist_staff_id',N'F') IS NULL
ALTER TABLE [waitlist] ADD CONSTRAINT [fk_waitlist_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

IF OBJECT_ID(N'fk_waitlist_service_id',N'F') IS NULL
ALTER TABLE [waitlist] ADD CONSTRAINT [fk_waitlist_service_id] FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

IF OBJECT_ID(N'fk_service_metadata_service_id',N'F') IS NULL
ALTER TABLE [service_metadata] ADD CONSTRAINT [fk_service_metadata_service_id] FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

IF OBJECT_ID(N'fk_staff_metadata_staff_id',N'F') IS NULL
ALTER TABLE [staff_metadata] ADD CONSTRAINT [fk_staff_metadata_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);
SET IDENTITY_INSERT [settings] ON;
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=1)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=2)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'app_name', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=3)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_short_name', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=4)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'logo_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=5)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'icon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=6)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'favicon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=7)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'logo_show_name', N'1');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=8)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'theme_primary', N'#000000');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=9)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'theme_accent', N'#737373');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=10)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'theme_background', N'#ffffff');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=11)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'hero_image_url', N'/images/studio.png');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=12)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'about_image_url', N'/images/studio.png');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=13)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'hero_kicker', N'BOOK ONLINE');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=14)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'hero_title', N'Book your next appointment.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=15)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'hero_subtitle', N'Choose a service. Find a time that works for you.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=16)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'services_title', N'Explore our services.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=17)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'services_intro', N'Browse services, compare options and book your preferred time.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=18)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'name', N'Still Studio');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=19)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'tagline', N'A little time. Entirely yours.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=20)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'description', N'Thoughtful treatments, talented people, and a moment to slow down. Book your next massage, manicure, or reset.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=21)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'currency', N'ZAR');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=22)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'timezone', N'Africa/Johannesburg');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=23)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'address', N'12 Kloof Street, Cape Town');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=24)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (24, N'phone', N'+27 21 555 0120');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=25)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (25, N'email', N'hello@example.com');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=26)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (26, N'lead_minutes', N'60');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=27)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (27, N'horizon_days', N'90');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=28)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (28, N'cancel_hours', N'24');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=29)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (29, N'hold_minutes', N'10');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=30)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (30, N'slot_minutes', N'15');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=31)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (31, N'website_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=32)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (32, N'cancellation_policy', N'You can reschedule or cancel online up to 24 hours before your appointment. Eligible paid cancellations are reviewed for a refund by our team. Late cancellations: please contact the studio.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=33)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (33, N'smtp_host', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=34)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (34, N'smtp_port', N'587');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=35)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (35, N'smtp_user', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=36)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (36, N'smtp_password', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=37)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (37, N'smtp_from', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=38)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (38, N'smtp_mode', N'starttls');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=39)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (39, N'reminder_hours', N'24');
SET IDENTITY_INSERT [settings] OFF;

IF OBJECT_ID(N'ck_services_0',N'C') IS NULL ALTER TABLE [services] ADD CONSTRAINT [ck_services_0] CHECK ([duration] BETWEEN 5 AND 480);

IF OBJECT_ID(N'ck_services_1',N'C') IS NULL ALTER TABLE [services] ADD CONSTRAINT [ck_services_1] CHECK ([buffer] BETWEEN 0 AND 120);

IF OBJECT_ID(N'ck_services_2',N'C') IS NULL ALTER TABLE [services] ADD CONSTRAINT [ck_services_2] CHECK ([price] >= 0);

IF OBJECT_ID(N'ck_services_3',N'C') IS NULL ALTER TABLE [services] ADD CONSTRAINT [ck_services_3] CHECK ([deposit_percent] BETWEEN 1 AND 100);

IF OBJECT_ID(N'ck_blocks_0',N'C') IS NULL ALTER TABLE [blocks] ADD CONSTRAINT [ck_blocks_0] CHECK ([ends] > [starts]);

IF OBJECT_ID(N'ck_bookings_0',N'C') IS NULL ALTER TABLE [bookings] ADD CONSTRAINT [ck_bookings_0] CHECK ([status] IN ('held', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show', 'expired', 'payment_review'));

IF OBJECT_ID(N'ck_allocations_0',N'C') IS NULL ALTER TABLE [allocations] ADD CONSTRAINT [ck_allocations_0] CHECK ([ends] > [starts]);

IF OBJECT_ID(N'ck_payments_0',N'C') IS NULL ALTER TABLE [payments] ADD CONSTRAINT [ck_payments_0] CHECK ([kind] IN ('payment', 'refund', 'cash'));

IF OBJECT_ID(N'ck_payments_1',N'C') IS NULL ALTER TABLE [payments] ADD CONSTRAINT [ck_payments_1] CHECK ([amount] > 0);

IF OBJECT_ID(N'ck_refund_requests_0',N'C') IS NULL ALTER TABLE [refund_requests] ADD CONSTRAINT [ck_refund_requests_0] CHECK ([amount] > 0);

IF OBJECT_ID(N'ck_promos_0',N'C') IS NULL ALTER TABLE [promos] ADD CONSTRAINT [ck_promos_0] CHECK ([percent] BETWEEN 1 AND 100);

IF OBJECT_ID(N'ck_service_metadata_0',N'C') IS NULL ALTER TABLE [service_metadata] ADD CONSTRAINT [ck_service_metadata_0] CHECK ([deleted] IN (0, 1));

EXEC(N'CREATE OR ALTER TRIGGER [allocation_no_overlap] ON [allocations] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON i.[active]=1 AND a.[active]=1 AND a.[Id]<>i.[Id] AND a.[starts]<i.[ends] AND a.[ends]>i.[starts]
AND (a.[staff_id]=i.[staff_id] OR (i.[resource_id] IS NOT NULL AND a.[resource_id]=i.[resource_id]))
JOIN [bookings] b ON b.[reference]=a.[booking_ref]
WHERE b.[status]<>''held'' OR b.[expires]>DATEDIFF_BIG(SECOND,''1970-01-01'',SYSUTCDATETIME()))
THROW 50003, ''That time was just booked. Please choose another slot.'', 1;
IF EXISTS(SELECT 1 FROM inserted i JOIN [blocks] b WITH (UPDLOCK,HOLDLOCK)
ON i.[active]=1 AND b.[starts]<i.[ends] AND b.[ends]>i.[starts]
AND ((b.[staff_id] IS NULL AND b.[resource_id] IS NULL) OR b.[staff_id]=i.[staff_id]
OR (i.[resource_id] IS NOT NULL AND b.[resource_id]=i.[resource_id])))
THROW 50003, ''This time is blocked.'', 1;
END;');

EXEC(N'CREATE OR ALTER TRIGGER [blocks_no_booking] ON [blocks] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON a.[active]=1 AND a.[starts]<i.[ends] AND a.[ends]>i.[starts]
AND ((i.[staff_id] IS NULL AND i.[resource_id] IS NULL) OR a.[staff_id]=i.[staff_id]
OR (i.[resource_id] IS NOT NULL AND a.[resource_id]=i.[resource_id]))
JOIN [bookings] b ON b.[reference]=a.[booking_ref]
WHERE b.[status]<>''held'' OR b.[expires]>DATEDIFF_BIG(SECOND,''1970-01-01'',SYSUTCDATETIME()))
THROW 50003, ''Move or cancel the affected appointments before blocking this time.'', 1;
END;');

EXEC(N'CREATE OR ALTER TRIGGER [prevent_abandoned_booking] ON [bookings] AFTER INSERT AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [abandoned_booking_requests] a WITH (UPDLOCK,HOLDLOCK) ON a.[request_key]=i.[request_key])
THROW 50003, ''This reservation request was released. Start a new booking.'', 1;
END;');
