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
    [version] BIGINT NOT NULL,
    [data] NVARCHAR(MAX) NOT NULL
);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'settings') AND name=N'ux_settings_0')
CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'events_owner')
CREATE INDEX [events_owner] ON [entities] ([owner], [kind]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'events_kind')
CREATE INDEX [events_kind] ON [entities] ([kind], [Id]);

IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'entities') AND name=N'ux_entities_2')
CREATE UNIQUE INDEX [ux_entities_2] ON [entities] ([ref]);
SET IDENTITY_INSERT [settings] ON;
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=1)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=2)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'name', N'Cloudgate Events');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=3)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_name', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=4)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'app_short_name', N'Events');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=5)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'tagline', N'Good things happen together.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=6)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'description', N'Find your next unforgettable experience. Live music, ideas, culture and community.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=7)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'email', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=8)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'phone', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=9)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'address', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=10)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'website_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=11)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'currency', N'USD');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=12)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'timezone', N'UTC');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=13)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'theme_primary', N'#d6be91');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=14)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'theme_accent', N'#9eab90');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=15)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'theme_background', N'#171916');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=16)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'logo_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=17)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'icon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=18)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'favicon_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=19)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'logo_show_name', N'1');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=20)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'hero_title', N'Be there. Feel everything.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=21)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'hero_subtitle', N'A good night. A new perspective. A room full of your people. Discover events worth showing up for.');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=22)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'hero_image_url', N'');
IF NOT EXISTS(SELECT 1 FROM [settings] WHERE [Id]=23)
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'about_image_url', N'');
SET IDENTITY_INSERT [settings] OFF;

IF OBJECT_ID(N'ck_entities_0',N'C') IS NULL ALTER TABLE [entities] ADD CONSTRAINT [ck_entities_0] CHECK (ISJSON([data])=1);
