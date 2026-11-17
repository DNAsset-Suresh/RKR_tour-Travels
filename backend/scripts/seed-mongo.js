import '../config/env.js';
import { connectMongo } from '../config/mongodb.js';
import { Vehicle } from '../models/Vehicle.js';

const vehiclesData = [
  {
    id: 1,
    name: 'Swift Dzire',
    category: 'Sedan',
    description: 'An everyday journey, thoughtfully planned. Ask about the configuration for your trip.',
    image_path: '/assets/swift-dzire.png',
    video_path: '/assets/videos/swift-dzire.mp4',
    passenger_capacity: 4,
    display_order: 1,
    tariff: { package_5h_50km: 1300, package_10h_100km: 2600, extra_hour: 260, extra_km: 14 }
  },
  {
    id: 2,
    name: 'Toyota Etios',
    category: 'Sedan',
    description: 'A familiar sedan option for city journeys and longer escapes.',
    image_path: '/assets/toyota-etios.png',
    video_path: '/assets/videos/toyota-etios.mp4',
    passenger_capacity: 4,
    display_order: 2,
    tariff: { package_5h_50km: 1400, package_10h_100km: 2800, extra_hour: 280, extra_km: 15 }
  },
  {
    id: 3,
    name: 'Toyota Innova',
    category: 'MPV',
    description: 'Bring your group together for the road ahead. Seating is confirmed with the operator.',
    image_path: '/assets/toyota-innova.png',
    video_path: '/assets/videos/toyota-innova-crysta.mp4',
    passenger_capacity: 7,
    display_order: 3,
    tariff: { package_5h_50km: 1800, package_10h_100km: 3600, extra_hour: 360, extra_km: 18 }
  },
  {
    id: 4,
    name: 'Innova Crysta',
    category: 'MPV',
    description: 'A considered choice for family itineraries and journeys beyond the city.',
    image_path: '/assets/innova-crysta.png',
    video_path: '/assets/videos/toyota-innova-crysta.mp4',
    passenger_capacity: 7,
    display_order: 4,
    tariff: { package_5h_50km: 2200, package_10h_100km: 4400, extra_hour: 420, extra_km: 22 }
  },
  {
    id: 5,
    name: 'Honda City',
    category: 'Sedan',
    description: 'A refined sedan to explore for your next transfer or personal itinerary.',
    image_path: '/assets/honda-city.png',
    video_path: '/assets/videos/honda-city.mp4',
    passenger_capacity: 4,
    display_order: 5,
    tariff: { package_5h_50km: 2400, package_10h_100km: 4800, extra_hour: 440, extra_km: 22 }
  },
  {
    id: 6,
    name: 'Toyota Corolla Altis',
    category: 'Sedan',
    description: 'Explore this sedan option for business travel and days away.',
    image_path: '/assets/toyota-corolla-altis.png',
    video_path: '/assets/videos/toyota-corolla-altis.mp4',
    passenger_capacity: 4,
    display_order: 6,
    tariff: { package_5h_50km: 2800, package_10h_100km: 5600, extra_hour: 540, extra_km: 25 }
  },
  {
    id: 7,
    name: 'Mercedes-Benz E-Class',
    category: 'Luxury',
    description: 'An elegant arrival begins with a considered journey. Request the exact specification.',
    image_path: '/assets/mercedes-benz-e-class.png',
    video_path: '/assets/videos/mercedes-benz-e-class.mp4',
    passenger_capacity: 4,
    display_order: 7,
    tariff: { package_5h_50km: 7000, package_10h_100km: 14000, extra_hour: 1500, extra_km: 175 }
  },
  {
    id: 8,
    name: 'Mercedes-Benz S-Class',
    category: 'Luxury',
    description: 'Explore a flagship luxury sedan for the occasions that matter.',
    image_path: '/assets/mercedes-benz-s-class.png',
    video_path: '/assets/videos/mercedes-benz-s-class.mp4',
    passenger_capacity: 4,
    display_order: 8,
    tariff: { package_5h_50km: 12500, package_10h_100km: 25000, extra_hour: 2000, extra_km: 150 }
  },
  {
    id: 9,
    name: 'Toyota Fortuner',
    category: 'SUV',
    description: 'For itineraries with a little more adventure. Discuss your route with the team.',
    image_path: '/assets/toyota-fortuner.png',
    video_path: '/assets/videos/toyota-fortuner.mp4',
    passenger_capacity: 7,
    display_order: 9,
    tariff: { package_5h_50km: 4500, package_10h_100km: 9000, extra_hour: 600, extra_km: 65 }
  },
  {
    id: 10,
    name: 'Kia Carnival',
    category: 'MPV',
    description: 'Explore a spacious travel format for shared experiences. Configuration to be confirmed.',
    image_path: '/assets/kia-carnival.png',
    video_path: '/assets/videos/kia-carnival.mp4',
    passenger_capacity: 7,
    display_order: 10,
    tariff: { package_5h_50km: 2500, package_10h_100km: 5000, extra_hour: 500, extra_km: 40 }
  },
  {
    id: 11,
    name: 'Toyota Innova Hycross',
    category: 'MPV',
    description: 'Plan a shared journey with this contemporary MPV option.',
    image_path: '/assets/toyota-innova-hycross.png',
    video_path: '/assets/videos/toyota-innova-hycross.mp4',
    passenger_capacity: 7,
    display_order: 11,
    tariff: { package_5h_50km: 2500, package_10h_100km: 5000, extra_hour: 500, extra_km: 40 }
  },
  {
    id: 12,
    name: 'Force Urbania',
    category: 'Traveller',
    description: 'Explore a group journey with the Force Urbania. Exact seating and amenities require confirmation.',
    image_path: '/assets/force-urbania.png',
    video_path: '/assets/videos/force-urbania.mp4',
    passenger_capacity: 13,
    display_order: 12,
    tariff: { package_5h_50km: 3000, package_10h_100km: 6000, extra_hour: 500, extra_km: 40 }
  },
  {
    id: 13,
    name: 'Tempo Traveller — 12 Seater Luxury',
    category: 'Traveller',
    description: 'A 12-seater luxury Traveller option for shared journeys. Confirm the actual configuration with the team.',
    image_path: '/assets/tempo-traveller-12-seater-luxury.png',
    video_path: '/assets/videos/tempo-traveller-12-seater-luxury.mp4',
    passenger_capacity: 12,
    display_order: 13,
    tariff: { package_5h_50km: 2500, package_10h_100km: 5000, extra_hour: 500, extra_km: 22 }
  },
  {
    id: 14,
    name: 'Tempo Traveller — 18 Seater Luxury',
    category: 'Traveller',
    description: 'Make the journey part of the group experience. The requested 18-seat configuration requires verification.',
    image_path: '/assets/tempo-traveller-18-seater-luxury.png',
    video_path: '/assets/videos/tempo-traveller-18-seater-luxury.mp4',
    passenger_capacity: 18,
    display_order: 14,
    tariff: { package_5h_50km: 2750, package_10h_100km: 5500, extra_hour: 550, extra_km: 26 }
  }
];

export async function seedMongo() {
  try {
    await connectMongo();
    console.log('Connected to MongoDB. Seeding vehicles and tariffs…');
    for (const v of vehiclesData) {
      await Vehicle.findOneAndUpdate(
        { name: v.name },
        { $set: v },
        { upsert: true, new: true }
      );
    }
    console.log(`Successfully seeded ${vehiclesData.length} vehicles into MongoDB.`);
  } catch (error) {
    console.error('MongoDB seed failed:', error.message);
    throw error;
  }
}

if (process.argv[1]?.endsWith('seed-mongo.js')) {
  seedMongo()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
