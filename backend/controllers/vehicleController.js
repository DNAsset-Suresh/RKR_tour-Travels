import { pool } from '../config/database.js';
import { connectMongo } from '../config/mongodb.js';
import { Vehicle } from '../models/Vehicle.js';

export async function listVehicles(req, res) {
  if (process.env.MONGODB_URI) {
    try {
      await connectMongo();
      const vehicles = await Vehicle.find({ is_active: true })
        .sort({ display_order: 1, id: 1 })
        .lean();
      if (vehicles.length > 0) {
        return res.json({ data: vehicles });
      }
    } catch (e) {
      console.warn('MongoDB query failed, falling back to PostgreSQL:', e.message);
    }
  }
  const { rows } = await pool.query(`SELECT v.id, v.name, v.category, v.passenger_capacity,
    v.air_conditioning, v.luggage_info, v.description, v.image_path, v.video_path,
    v.availability_status, v.is_sample,
    CASE WHEN t.vehicle_id IS NULL THEN NULL ELSE json_build_object(
      'currency', t.currency, 'package_5h_50km', t.package_5h_50km,
      'package_10h_100km', t.package_10h_100km, 'extra_hour', t.extra_hour, 'extra_km', t.extra_km
    ) END AS tariff
    FROM vehicles v LEFT JOIN vehicle_tariffs t ON t.vehicle_id=v.id
    WHERE v.is_active=true ORDER BY v.display_order, v.id`);
  res.json({ data: rows });
}
