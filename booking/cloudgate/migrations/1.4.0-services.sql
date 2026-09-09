CREATE TABLE IF NOT EXISTS service_metadata (Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, service_id INTEGER NOT NULL UNIQUE REFERENCES services(Id), image_url TEXT NOT NULL DEFAULT '', deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)));
INSERT OR IGNORE INTO settings(key,value) VALUES
('hero_image_url','/images/studio.png'),('about_image_url','/images/studio.png'),
('hero_kicker','BOOK ONLINE'),('hero_title','Book your next appointment.'),
('hero_subtitle','Choose a service. Find a time that works for you.'),
('services_title','Explore our services.'),('services_intro','Browse services, compare options and book your preferred time.');

-- Preserve the original example photos as per-service data, never as category rules.
INSERT OR IGNORE INTO service_metadata(service_id,image_url,deleted)
SELECT Id,CASE Id WHEN 3 THEN '/images/nails.png' WHEN 4 THEN '/images/nails.png' WHEN 5 THEN '/images/facial.png' ELSE '/images/massage.png' END,0 FROM services
WHERE (Id=1 AND name='Signature relaxation massage') OR (Id=2 AND name='Deep tissue reset') OR (Id=3 AND name='The everyday manicure') OR (Id=4 AND name='Gel manicure') OR (Id=5 AND name='Restore facial') OR (Id=6 AND name='Express neck & shoulders');
