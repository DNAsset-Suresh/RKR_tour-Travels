import { createGoogleMapsService,googleJourney } from './googleMapsService.js';
import { calculateFare,readPricing } from './fareEngine.js';
import { TripError } from './mapService.js';
import { pool } from '../config/database.js';
import { isDeepStrictEqual } from 'node:util';
import { manualJourney } from './manualJourney.js';
import { createOpenRoutingService } from './openRoutingService.js';

async function findActiveVehicle(vehicleId, db) {
  if (db === pool && process.env.MONGODB_URI) {
    try {
      const { connectMongo } = await import('../config/mongodb.js');
      const { Vehicle } = await import('../models/Vehicle.js');
      await connectMongo();
      const v = await Vehicle.findOne({ id: vehicleId, is_active: true }).lean();
      if (v) return v;
    } catch (e) { console.warn('MongoDB quote validation query failed:', e.message); }
  }
  const result = await db.query('SELECT v.*,to_jsonb(t) AS tariff FROM vehicles v LEFT JOIN vehicle_tariffs t ON t.vehicle_id=v.id WHERE v.id=$1 AND v.is_active=true', [vehicleId]);
  return result.rows[0];
}

export async function revalidateQuote(quote,vehicleId,{service=createGoogleMapsService(),openService=createOpenRoutingService(),pricingReader=readPricing,db=pool}={}) {
  const original=quote.fares.find(v=>v.id===vehicleId);
  if(!original)throw new TripError(422,'Select a vehicle from the current estimate.');
  const [route,pricing,vehicle]=await Promise.all([
    quote.route.source==='Customer-entered distance'?manualJourney(quote.trip):quote.route.source==='OSRM'?openService.route(quote.trip.pickup,quote.trip.destination,{fresh:true}):googleJourney(service,quote.trip,quote.route.selection),pricingReader(),
    findActiveVehicle(vehicleId, db)
  ]);
  if(!vehicle)throw new TripError(409,'This vehicle is no longer listed. Please select another vehicle.');
  const fare=calculateFare(vehicle,quote.trip,route,pricing);
  if(['unavailable','capacity_exceeded'].includes(fare.status))throw new TripError(409,'This vehicle is no longer suitable or accepting requests. Please choose another vehicle.');
  // Reject changed routes and amounts; the customer must review the new estimate.
  if(!isDeepStrictEqual(fare,original.fare)||route.distanceKm!==quote.route.distanceKm||route.durationSeconds!==quote.route.durationSeconds||route.outbound?.description!==quote.route.outbound?.description||route.inbound?.description!==quote.route.inbound?.description)throw new TripError(409,'The route or fare has changed. Please calculate and review a fresh estimate before proceeding.');
  return {source:route.source,calculatedAt:new Date().toISOString(),distanceKm:route.distanceKm,durationSeconds:route.durationSeconds,returnIncluded:route.returnIncluded,trafficAware:false,tripOptions:{package_id:quote.trip.package_id,rental_hours:quote.trip.rental_hours,travel_days:quote.trip.travel_days,waiting_minutes:quote.trip.waiting_minutes},fare,vehicleName:vehicle.name,confirmation:'Pending operator confirmation'};
}
