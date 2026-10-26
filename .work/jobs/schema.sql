-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [key] NVARCHAR(254) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL
);

CREATE TABLE [entities] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [kind] NVARCHAR(254) NOT NULL,
    [ref] NVARCHAR(254) NOT NULL,
    [owner] NVARCHAR(254) NOT NULL DEFAULT (''),
    [job] NVARCHAR(254) NOT NULL DEFAULT (''),
    [version] BIGINT NOT NULL DEFAULT (1),
    [data] NVARCHAR(MAX) NOT NULL
);

CREATE TABLE [write_guard] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [expected] NVARCHAR(MAX) NOT NULL
);

CREATE TABLE [allocations] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [visit] NVARCHAR(254) NOT NULL,
    [staff] NVARCHAR(254) NOT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL
);

CREATE TABLE [attachments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ref] NVARCHAR(254) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL
);

CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

CREATE INDEX [entities_job] ON [entities] ([job], [kind]);

CREATE INDEX [entities_owner] ON [entities] ([owner], [kind]);

CREATE INDEX [entities_kind] ON [entities] ([kind], [Id]);

CREATE UNIQUE INDEX [ux_entities_3] ON [entities] ([ref]);

CREATE INDEX [jobs_staff_time] ON [allocations] ([staff], [starts], [ends]);

CREATE UNIQUE INDEX [ux_allocations_1] ON [allocations] ([visit], [staff]);

CREATE UNIQUE INDEX [ux_attachments_0] ON [attachments] ([ref]);
SET IDENTITY_INSERT [settings] ON;
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'name', N'Cloudgate Jobs');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_name', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'app_short_name', N'Jobs');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'tagline', N'Good work. From start to finish.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'description', N'Reliable services for your home and business.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'phone', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'email', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'address', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'service_area', N'Your local area');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'website_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'currency', N'ZAR');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'timezone', N'Africa/Johannesburg');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'tax_bps', N'0');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'tax_label', N'Tax');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'tax_number', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'payment_terms', N'14');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'theme_primary', N'#153d35');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'theme_accent', N'#a7cf70');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'theme_background', N'#ffffff');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'logo_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'icon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'favicon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (24, N'logo_show_name', N'1');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (25, N'hero_title', N'Your next project, in good hands.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (26, N'hero_subtitle', N'Tell us what you need. We will take care of the details, from a clear quote to a job well done.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (27, N'hero_image_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (28, N'about_image_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (29, N'smtp_host', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (30, N'smtp_port', N'587');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (31, N'smtp_user', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (32, N'smtp_password', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (33, N'smtp_from', N'');
SET IDENTITY_INSERT [settings] OFF;
