-- Microsoft SQL Server 2022 / Cloudgate managed schema. Fresh installations only.

SET NOCOUNT ON; SET XACT_ABORT ON;

IF OBJECT_ID(N'settings',N'U') IS NULL
CREATE TABLE [settings] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [key] NVARCHAR(254) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL
);

IF OBJECT_ID(N'entities',N'U') IS NULL
CREATE TABLE [entities] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [kind] NVARCHAR(254) NOT NULL,
    [ref] NVARCHAR(254) NOT NULL,
    [owner] NVARCHAR(254) NOT NULL DEFAULT (''),
    [job] NVARCHAR(254) NOT NULL DEFAULT (''),
    [version] BIGINT NOT NULL DEFAULT (1),
    [data] NVARCHAR(MAX) NOT NULL
);

IF OBJECT_ID(N'allocations',N'U') IS NULL
CREATE TABLE [allocations] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [visit] NVARCHAR(254) NOT NULL,
    [staff] NVARCHAR(254) NOT NULL,
    [starts] BIGINT NOT NULL,
    [ends] BIGINT NOT NULL
);

IF OBJECT_ID(N'attachments',N'U') IS NULL
CREATE TABLE [attachments] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [ref] NVARCHAR(254) NOT NULL,
    [content] NVARCHAR(MAX) NOT NULL
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'settings') AND name=N'ux_settings_0')
CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'entities_job')
CREATE INDEX [entities_job] ON [entities] ([job], [kind]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'entities_owner')
CREATE INDEX [entities_owner] ON [entities] ([owner], [kind]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'entities_kind')
CREATE INDEX [entities_kind] ON [entities] ([kind], [Id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'ux_entities_3')
CREATE UNIQUE INDEX [ux_entities_3] ON [entities] ([ref]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'allocations') AND name=N'jobs_staff_time')
CREATE INDEX [jobs_staff_time] ON [allocations] ([staff], [starts], [ends]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'allocations') AND name=N'ux_allocations_1')
CREATE UNIQUE INDEX [ux_allocations_1] ON [allocations] ([visit], [staff]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'attachments') AND name=N'ux_attachments_0')
CREATE UNIQUE INDEX [ux_attachments_0] ON [attachments] ([ref]);
SET IDENTITY_INSERT [settings] ON;
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=1)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=2)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'name', N'Cloudgate Jobs');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=3)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_name', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=4)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'app_short_name', N'Jobs');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=5)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'tagline', N'Good work. From start to finish.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=6)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'description', N'Reliable services for your home and business.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=7)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'phone', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=8)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'email', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=9)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'address', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=10)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'service_area', N'Your local area');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=11)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'website_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=12)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'currency', N'ZAR');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=13)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'timezone', N'Africa/Johannesburg');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=14)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'tax_bps', N'0');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=15)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'tax_label', N'Tax');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=16)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'tax_number', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=17)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'payment_terms', N'14');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=18)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'theme_primary', N'#153d35');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=19)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'theme_accent', N'#a7cf70');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=20)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'theme_background', N'#ffffff');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=21)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'logo_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=22)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'icon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=23)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'favicon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=24)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (24, N'logo_show_name', N'1');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=25)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (25, N'hero_title', N'Your next project, in good hands.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=26)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (26, N'hero_subtitle', N'Tell us what you need. We will take care of the details, from a clear quote to a job well done.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=27)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (27, N'hero_image_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=28)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (28, N'about_image_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=29)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (29, N'smtp_host', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=30)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (30, N'smtp_port', N'587');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=31)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (31, N'smtp_user', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=32)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (32, N'smtp_password', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=33)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (33, N'smtp_from', N'');
SET IDENTITY_INSERT [settings] OFF;

IF OBJECT_ID(N'ck_entities_0',N'C') IS NULL ALTER TABLE [entities] ADD CONSTRAINT [ck_entities_0] CHECK (ISJSON([data])=1);

IF OBJECT_ID(N'ck_allocations_0',N'C') IS NULL ALTER TABLE [allocations] ADD CONSTRAINT [ck_allocations_0] CHECK ([ends] > [starts]);

EXEC(N'CREATE OR ALTER TRIGGER [jobs_no_overlap] ON [allocations] AFTER INSERT,UPDATE AS
BEGIN SET NOCOUNT ON;
IF EXISTS(SELECT 1 FROM inserted i JOIN [allocations] a WITH (UPDLOCK,HOLDLOCK)
ON a.[staff]=i.[staff] AND a.[Id]<>i.[Id] AND a.[starts]<i.[ends] AND a.[ends]>i.[starts])
THROW 50003, ''A team member is already assigned or unavailable at this time.'', 1;
END;');
