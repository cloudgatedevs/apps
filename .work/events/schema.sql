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
    [version] BIGINT NOT NULL,
    [data] NVARCHAR(MAX) NOT NULL
);

CREATE TABLE [write_guard] (
    [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [expected] NVARCHAR(MAX) NOT NULL
);

CREATE UNIQUE INDEX [ux_settings_0] ON [settings] ([key]);

CREATE INDEX [events_owner] ON [entities] ([owner], [kind]);

CREATE INDEX [events_kind] ON [entities] ([kind], [Id]);

CREATE UNIQUE INDEX [ux_entities_2] ON [entities] ([ref]);
SET IDENTITY_INSERT [settings] ON;
INSERT INTO [settings] ([Id], [key], [value]) VALUES (1, N'_revision', N'0');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (2, N'name', N'Cloudgate Events');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (3, N'app_name', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (4, N'app_short_name', N'Events');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (5, N'tagline', N'Good things happen together.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (6, N'description', N'Find your next unforgettable experience. Live music, ideas, culture and community.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (7, N'email', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (8, N'phone', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (9, N'address', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (10, N'website_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (11, N'currency', N'USD');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (12, N'timezone', N'UTC');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (13, N'theme_primary', N'#d6be91');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (14, N'theme_accent', N'#9eab90');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (15, N'theme_background', N'#171916');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (16, N'logo_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (17, N'icon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (18, N'favicon_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (19, N'logo_show_name', N'1');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (20, N'hero_title', N'Be there. Feel everything.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (21, N'hero_subtitle', N'A good night. A new perspective. A room full of your people. Discover events worth showing up for.');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (22, N'hero_image_url', N'');
INSERT INTO [settings] ([Id], [key], [value]) VALUES (23, N'about_image_url', N'');
SET IDENTITY_INSERT [settings] OFF;
