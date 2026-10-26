-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

CREATE TABLE [customer_accounts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [user_id] NVARCHAR(254) NOT NULL,
    [name] NVARCHAR(MAX) NOT NULL,
    [phone] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [created] BIGINT NOT NULL,
    [updated] BIGINT NOT NULL
);

CREATE TABLE [booking_accounts] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [user_id] NVARCHAR(254) NOT NULL,
    [created] BIGINT NOT NULL
);

CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [key] NVARCHAR(254) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL
);

CREATE TABLE [write_guard] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [expected] NVARCHAR(MAX) NOT NULL
);

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

CREATE TABLE [resources] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [name] NVARCHAR(MAX) NOT NULL,
    [type] NVARCHAR(MAX) NOT NULL,
    [active] BIGINT NOT NULL DEFAULT (1)
);

CREATE TABLE [blocks] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [staff_id] INT NULL,
    [resource_id] INT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL,
    [reason] NVARCHAR(MAX) NOT NULL DEFAULT ('Unavailable')
);

CREATE TABLE [customers] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [email] NVARCHAR(254) NOT NULL,
    [name] NVARCHAR(MAX) NOT NULL,
    [phone] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [notes] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [marketing] BIGINT NOT NULL DEFAULT (0),
    [created] BIGINT NOT NULL
);

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

CREATE TABLE [payments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [external_id] NVARCHAR(254) NOT NULL,
    [kind] NVARCHAR(254) NOT NULL,
    [amount] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL,
    [created] BIGINT NOT NULL
);

CREATE TABLE [refund_requests] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [request_key] NVARCHAR(254) NOT NULL,
    [booking_ref] NVARCHAR(254) NOT NULL,
    [amount] BIGINT NOT NULL,
    [status] NVARCHAR(MAX) NOT NULL DEFAULT ('pending'),
    [provider_id] NVARCHAR(MAX) NULL,
    [created] BIGINT NOT NULL
);

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

CREATE TABLE [promos] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [code] NVARCHAR(254) NOT NULL,
    [percent] BIGINT NOT NULL,
    [ends] NVARCHAR(MAX) NOT NULL,
    [active] BIGINT NOT NULL DEFAULT (1)
);

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

CREATE TABLE [audit] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [booking_ref] NVARCHAR(254) NULL,
    [action] NVARCHAR(MAX) NOT NULL,
    [actor] NVARCHAR(MAX) NOT NULL,
    [detail] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [created] BIGINT NOT NULL
);

CREATE TABLE [abandoned_booking_requests] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [request_key] NVARCHAR(254) NOT NULL,
    [created] BIGINT NOT NULL
);

CREATE TABLE [service_metadata] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [service_id] INT NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL DEFAULT (''),
    [deleted] BIGINT NOT NULL DEFAULT (0)
);

CREATE TABLE [staff_metadata] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [staff_id] INT NOT NULL,
    [image_url] NVARCHAR(MAX) NOT NULL DEFAULT ('')
);

CREATE UNIQUE INDEX [ux_customer_accounts_0] ON [customer_accounts] ([user_id]);

CREATE INDEX [booking_account_user] ON [booking_accounts] ([user_id]);

CREATE UNIQUE INDEX [ux_booking_accounts_1] ON [booking_accounts] ([booking_ref]);

CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

CREATE UNIQUE INDEX [ux_customers_0] ON [customers] ([email]);

CREATE UNIQUE INDEX [ux_bookings_0] ON [bookings] ([request_key]);

CREATE UNIQUE INDEX [ux_bookings_1] ON [bookings] ([reference]);

CREATE INDEX [allocations_resource_time] ON [allocations] ([resource_id], [starts], [ends], [active]);

CREATE INDEX [allocations_staff_time] ON [allocations] ([staff_id], [starts], [ends], [active]);

CREATE UNIQUE INDEX [ux_payments_0] ON [payments] ([external_id]);

CREATE UNIQUE INDEX [one_pending_refund] ON [refund_requests] ([booking_ref]) WHERE status <> 'succeeded' AND status <> 'failed';

CREATE UNIQUE INDEX [ux_refund_requests_1] ON [refund_requests] ([request_key]);

CREATE UNIQUE INDEX [ux_promos_0] ON [promos] ([code]);

CREATE UNIQUE INDEX [ux_messages_0] ON [messages] ([dedupe]);

CREATE UNIQUE INDEX [ux_abandoned_booking_requests_0] ON [abandoned_booking_requests] ([request_key]);

CREATE UNIQUE INDEX [ux_service_metadata_0] ON [service_metadata] ([service_id]);

CREATE UNIQUE INDEX [ux_staff_metadata_0] ON [staff_metadata] ([staff_id]);

ALTER TABLE [booking_accounts] ADD FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

ALTER TABLE [blocks] ADD FOREIGN KEY ([resource_id]) REFERENCES [resources] ([Id]);

ALTER TABLE [blocks] ADD FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

ALTER TABLE [bookings] ADD FOREIGN KEY ([customer_id]) REFERENCES [customers] ([Id]);

ALTER TABLE [allocations] ADD FOREIGN KEY ([resource_id]) REFERENCES [resources] ([Id]);

ALTER TABLE [allocations] ADD FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

ALTER TABLE [allocations] ADD FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

ALTER TABLE [allocations] ADD FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

ALTER TABLE [payments] ADD FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

ALTER TABLE [refund_requests] ADD FOREIGN KEY ([booking_ref]) REFERENCES [bookings] ([reference]);

ALTER TABLE [waitlist] ADD FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);

ALTER TABLE [waitlist] ADD FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

ALTER TABLE [service_metadata] ADD FOREIGN KEY ([service_id]) REFERENCES [services] ([Id]);

ALTER TABLE [staff_metadata] ADD FOREIGN KEY ([staff_id]) REFERENCES [staff] ([Id]);
SET IDENTITY_INSERT [settings] ON;
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'app_name', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_short_name', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'logo_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'icon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'favicon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'logo_show_name', N'1');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'theme_primary', N'#000000');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'theme_accent', N'#737373');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'theme_background', N'#ffffff');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'hero_image_url', N'/images/studio.png');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'about_image_url', N'/images/studio.png');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'hero_kicker', N'BOOK ONLINE');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'hero_title', N'Book your next appointment.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'hero_subtitle', N'Choose a service. Find a time that works for you.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'services_title', N'Explore our services.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'services_intro', N'Browse services, compare options and book your preferred time.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'name', N'Still Studio');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'tagline', N'A little time. Entirely yours.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'description', N'Thoughtful treatments, talented people, and a moment to slow down. Book your next massage, manicure, or reset.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'currency', N'ZAR');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'timezone', N'Africa/Johannesburg');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'address', N'12 Kloof Street, Cape Town');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (24, N'phone', N'+27 21 555 0120');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (25, N'email', N'hello@example.com');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (26, N'lead_minutes', N'60');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (27, N'horizon_days', N'90');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (28, N'cancel_hours', N'24');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (29, N'hold_minutes', N'10');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (30, N'slot_minutes', N'15');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (31, N'website_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (32, N'cancellation_policy', N'You can reschedule or cancel online up to 24 hours before your appointment. Eligible paid cancellations are reviewed for a refund by our team. Late cancellations: please contact the studio.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (33, N'smtp_host', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (34, N'smtp_port', N'587');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (35, N'smtp_user', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (36, N'smtp_password', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (37, N'smtp_from', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (38, N'smtp_mode', N'starttls');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (39, N'reminder_hours', N'24');
SET IDENTITY_INSERT [settings] OFF;
