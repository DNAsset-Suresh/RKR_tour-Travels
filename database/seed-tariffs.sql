-- Owner-supplied screenshots, received 28 October 2026. Amounts are INR.
-- E-Class extra km is 175 and S-Class extra km is 150, exactly as supplied.
-- Do not overwrite future operator updates when initialization is rerun.
BEGIN;
INSERT INTO vehicles (name,category,description,image_path,display_order) VALUES
 ('Force Urbania','Traveller','Explore a group journey with the Force Urbania. Exact seating and amenities require confirmation.','/assets/force-urbania.png',12),
 ('Tempo Traveller — 12 Seater Luxury','Traveller','A 12-seater luxury Traveller option for shared journeys. Confirm the actual configuration with the team.','/assets/tempo-traveller-12-seater-luxury.png',13)
ON CONFLICT (name) DO NOTHING;
UPDATE vehicles SET display_order=14 WHERE name='Tempo Traveller — 18 Seater Luxury' AND display_order=12;
INSERT INTO vehicle_tariffs (vehicle_id,package_5h_50km,package_10h_100km,extra_hour,extra_km,source_note)
SELECT v.id,r.short_package,r.long_package,r.hourly,r.per_km,'Owner-supplied tariff screenshots — 28 October 2026'
FROM (VALUES
 ('Swift Dzire',1300,2600,260,14),
 ('Toyota Etios',1400,2800,280,15),
 ('Toyota Innova',1800,3600,360,18),
 ('Innova Crysta',2200,4400,420,22),
 ('Honda City',2400,4800,440,22),
 ('Toyota Corolla Altis',2800,5600,540,25),
 ('Mercedes-Benz E-Class',7000,14000,1500,175),
 ('Mercedes-Benz S-Class',12500,25000,2000,150),
 ('Toyota Fortuner',4500,9000,600,65),
 ('Kia Carnival',2500,5000,500,40),
 ('Toyota Innova Hycross',2500,5000,500,40),
 ('Force Urbania',3000,6000,500,40),
 ('Tempo Traveller — 12 Seater Luxury',2500,5000,500,22),
 ('Tempo Traveller — 18 Seater Luxury',2750,5500,550,26)
) AS r(name,short_package,long_package,hourly,per_km)
JOIN vehicles v ON v.name=r.name
ON CONFLICT (vehicle_id) DO NOTHING;
COMMIT;
