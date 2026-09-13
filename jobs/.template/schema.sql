PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS settings (Id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL);
INSERT OR IGNORE INTO settings(key,value) VALUES('_revision','0');
CREATE TABLE IF NOT EXISTS entities (Id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, ref TEXT UNIQUE NOT NULL, owner TEXT NOT NULL DEFAULT '', job TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL CHECK(json_valid(data)));
CREATE INDEX IF NOT EXISTS entities_kind ON entities(kind,Id);
CREATE INDEX IF NOT EXISTS entities_owner ON entities(owner,kind);
CREATE INDEX IF NOT EXISTS entities_job ON entities(job,kind);
CREATE TABLE IF NOT EXISTS write_guard (Id INTEGER PRIMARY KEY AUTOINCREMENT, expected TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS jobs_revision BEFORE INSERT ON write_guard BEGIN SELECT RAISE(ABORT,'The workspace changed. Refresh and try again.') WHERE NEW.expected<>(SELECT value FROM settings WHERE key='_revision'); END;
CREATE TABLE IF NOT EXISTS allocations (Id INTEGER PRIMARY KEY AUTOINCREMENT, visit TEXT NOT NULL, staff TEXT NOT NULL, starts INTEGER NOT NULL, ends INTEGER NOT NULL CHECK(ends>starts), UNIQUE(visit,staff));
CREATE INDEX IF NOT EXISTS jobs_staff_time ON allocations(staff,starts,ends);
CREATE TRIGGER IF NOT EXISTS jobs_no_overlap BEFORE INSERT ON allocations BEGIN SELECT RAISE(ABORT,'A team member is already assigned or unavailable at this time.') WHERE EXISTS(SELECT 1 FROM allocations a WHERE a.staff=NEW.staff AND a.starts<NEW.ends AND a.ends>NEW.starts); END;
CREATE TRIGGER IF NOT EXISTS jobs_no_overlap_update BEFORE UPDATE ON allocations BEGIN SELECT RAISE(ABORT,'A team member is already assigned or unavailable at this time.') WHERE EXISTS(SELECT 1 FROM allocations a WHERE a.Id<>NEW.Id AND a.staff=NEW.staff AND a.starts<NEW.ends AND a.ends>NEW.starts); END;
CREATE TABLE IF NOT EXISTS attachments (Id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT UNIQUE NOT NULL, content TEXT NOT NULL);
INSERT OR IGNORE INTO settings(key,value) VALUES
('name','Cloudgate Jobs'),('app_name',''),('app_short_name','Jobs'),('tagline','Good work. From start to finish.'),('description','Reliable services for your home and business.'),
('phone',''),('email',''),('address',''),('service_area','Your local area'),('website_url',''),('currency','ZAR'),('timezone','Africa/Johannesburg'),('tax_bps','0'),('tax_label','Tax'),('tax_number',''),('payment_terms','14'),
('theme_primary','#153d35'),('theme_accent','#a7cf70'),('theme_background','#ffffff'),('logo_url',''),('icon_url',''),('favicon_url',''),('logo_show_name','1'),
('hero_title','Your next project, in good hands.'),('hero_subtitle','Tell us what you need. We will take care of the details, from a clear quote to a job well done.'),('hero_image_url',''),('about_image_url',''),('smtp_host',''),('smtp_port','587'),('smtp_user',''),('smtp_password',''),('smtp_from','');
