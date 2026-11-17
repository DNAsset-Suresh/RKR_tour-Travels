-- Illustrative catalogue only. Capacities, AC, luggage and actual availability are unverified.
-- The requested '18 Seater Luxury' is a display name, not a verified capacity.
INSERT INTO vehicles (name,category,description,image_path,display_order) VALUES
('Swift Dzire','Sedan','An everyday journey, thoughtfully planned. Ask about the configuration for your trip.','/assets/swift-dzire.png',1),
('Toyota Etios','Sedan','A familiar sedan option for city journeys and longer escapes.','/assets/toyota-etios.png',2),
('Toyota Innova','MPV','Bring your group together for the road ahead. Seating is confirmed with the operator.','/assets/toyota-innova.png',3),
('Innova Crysta','MPV','A considered choice for family itineraries and journeys beyond the city.','/assets/innova-crysta.png',4),
('Honda City','Sedan','A refined sedan to explore for your next transfer or personal itinerary.','/assets/honda-city.png',5),
('Toyota Corolla Altis','Sedan','Explore this sedan option for business travel and days away.','/assets/toyota-corolla-altis.png',6),
('Mercedes-Benz E-Class','Luxury','An elegant arrival begins with a considered journey. Request the exact specification.','/assets/mercedes-benz-e-class.png',7),
('Mercedes-Benz S-Class','Luxury','Explore a flagship luxury sedan for the occasions that matter.','/assets/mercedes-benz-s-class.png',8),
('Toyota Fortuner','SUV','For itineraries with a little more adventure. Discuss your route with the team.','/assets/toyota-fortuner.png',9),
('Kia Carnival','MPV','Explore a spacious travel format for shared experiences. Configuration to be confirmed.','/assets/kia-carnival.png',10),
('Toyota Innova Hycross','MPV','Plan a shared journey with this contemporary MPV option.','/assets/toyota-innova-hycross.png',11),
('Tempo Traveller — 18 Seater Luxury','Traveller','Make the journey part of the group experience. The requested 18-seat configuration requires verification.','/assets/tempo-traveller-18-seater-luxury.png',12)
ON CONFLICT (name) DO NOTHING;

-- Supplied media from the owner's Desktop/asset folder. Configure existing media only if blank.
UPDATE vehicles AS v SET video_path=m.path FROM (VALUES
 ('Swift Dzire','/assets/videos/swift-dzire.mp4'),
 ('Toyota Etios','/assets/videos/toyota-etios.mp4'),
 ('Toyota Innova','/assets/videos/toyota-innova-crysta.mp4'),
 ('Innova Crysta','/assets/videos/toyota-innova-crysta.mp4'),
 ('Honda City','/assets/videos/honda-city.mp4'),
 ('Toyota Corolla Altis','/assets/videos/toyota-corolla-altis.mp4'),
 ('Mercedes-Benz E-Class','/assets/videos/mercedes-benz-e-class.mp4'),
 ('Mercedes-Benz S-Class','/assets/videos/mercedes-benz-s-class.mp4'),
 ('Toyota Fortuner','/assets/videos/toyota-fortuner.mp4'),
 ('Kia Carnival','/assets/videos/kia-carnival.mp4'),
 ('Toyota Innova Hycross','/assets/videos/toyota-innova-hycross.mp4'),
 ('Force Urbania','/assets/videos/force-urbania.mp4'),
 ('Tempo Traveller — 12 Seater Luxury','/assets/videos/tempo-traveller-12-seater-luxury.mp4'),
 ('Tempo Traveller — 18 Seater Luxury','/assets/videos/tempo-traveller-18-seater-luxury.mp4')
) AS m(name,path) WHERE v.name=m.name AND v.video_path IS NULL;
