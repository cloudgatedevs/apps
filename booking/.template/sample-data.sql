INSERT OR IGNORE INTO services(Id,name,category,description,duration,buffer,price,deposit_percent,resource_type,color,intake) VALUES
(1,'Signature relaxation massage','Massage','Unwind with flowing, restorative massage tailored to your body.',60,15,75000,100,'treatment','#d4ddce','Any areas to avoid, allergies, or preferences we should know about?'),
(2,'Deep tissue reset','Massage','Focused work to ease tension and help you move more freely.',90,15,105000,100,'treatment','#c9d4c1','Tell us about any injuries or areas requiring special care.'),
(3,'The everyday manicure','Nails','Beautifully shaped nails, detailed cuticle care, and your perfect polish.',45,10,35000,100,'nail','#efd8cc','Any product allergies?'),
(4,'Gel manicure','Nails','A glossy, lasting finish. Careful preparation, shaping, and gel colour.',60,10,45000,100,'nail','#dfcbbf','Do you need an existing gel application removed?'),
(5,'Restore facial','Skin','A personalised cleanse, gentle exfoliation, and deeply hydrating finish.',60,15,68000,100,'treatment','#e2dfc7','Please tell us about skin sensitivities or active products you use.'),
(6,'Express neck & shoulders','Massage','A focused half-hour to soften the tension of a busy week.',30,10,42000,100,'treatment','#c5d5cf','Any areas to avoid?');
INSERT OR IGNORE INTO resources(Id,name,type) VALUES(1,'Treatment room 01','treatment'),(2,'Treatment room 02','treatment'),(3,'Nail station 01','nail'),(4,'Nail station 02','nail');
INSERT OR IGNORE INTO staff(Id,name,title,bio,color,service_ids,hours) VALUES
(1,'Maya Daniels','Massage & skin therapist','A calming approach and a gift for finding exactly where you hold tension.','#b6c6b2','[1,2,5,6]','{"0":[["09:00","13:00"],["14:00","18:00"]],"1":[["09:00","13:00"],["14:00","18:00"]],"2":[["09:00","13:00"],["14:00","18:00"]],"3":[["09:00","13:00"],["14:00","18:00"]],"4":[["09:00","13:00"],["14:00","18:00"]],"5":[["09:00","14:00"]]}'),
(2,'Leah Jacobs','Nail artist','Considered details, beautiful colour, and nails that feel like you.','#ddc1b4','[3,4]','{"0":[["09:00","13:00"],["14:00","18:00"]],"1":[["09:00","13:00"],["14:00","18:00"]],"2":[["09:00","13:00"],["14:00","18:00"]],"3":[["09:00","13:00"],["14:00","18:00"]],"4":[["09:00","13:00"],["14:00","18:00"]],"5":[["09:00","14:00"]]}'),
(3,'Zoe Williams','Wellness therapist','Restorative treatments with a thoughtful, personal touch.','#d6cda9','[1,2,3,4,5,6]','{"0":[["10:00","14:00"],["15:00","19:00"]],"1":[["10:00","14:00"],["15:00","19:00"]],"2":[["10:00","14:00"],["15:00","19:00"]],"3":[["10:00","14:00"],["15:00","19:00"]],"4":[["10:00","14:00"],["15:00","19:00"]],"5":[["09:00","14:00"]]}');

-- Preserve the original example photos as per-service data, never as category rules.
INSERT OR IGNORE INTO service_metadata(service_id,image_url,deleted)
SELECT Id,CASE Id WHEN 3 THEN '/images/nails.png' WHEN 4 THEN '/images/nails.png' WHEN 5 THEN '/images/facial.png' ELSE '/images/massage.png' END,0 FROM services
WHERE (Id=1 AND name='Signature relaxation massage') OR (Id=2 AND name='Deep tissue reset') OR (Id=3 AND name='The everyday manicure') OR (Id=4 AND name='Gel manicure') OR (Id=5 AND name='Restore facial') OR (Id=6 AND name='Express neck & shoulders');
