import { randomUUID } from 'node:crypto';
import { TripError } from './mapService.js';
const quotes=new Map();
export function saveQuote(trip,route,fares){
  const now=Date.now();for(const [id,q] of quotes)if(q.expiresAt<=now)quotes.delete(id);
  if(quotes.size>=250)quotes.delete(quotes.keys().next().value);
  const id=randomUUID(),expiresAt=now+30*60*1000;
  quotes.set(id,structuredClone({trip,route,fares,expiresAt}));
  return {id,expiresAt};
}
export function getQuote(id){
  const q=quotes.get(id);
  if(!q||q.expiresAt<=Date.now())throw new TripError(409,'This estimate expired or the service restarted. Please calculate your route again.');
  return structuredClone(q);
}
export function bookingQuote(body){
  if(!body.quote_id)return null;
  const q=getQuote(body.quote_id);
  const t=q.trip;
  if(body.pickup_location!==t.pickup.label||body.destination!==t.destination.label||['journey_date','pickup_time','passenger_count','trip_type'].some(k=>body[k]!==t[k]))throw new TripError(422,'Trip details changed after this estimate. Recalculate before booking.');
  const item=q.fares.find(v=>v.id===body.vehicle_id);
  if(!item||['unavailable','capacity_exceeded'].includes(item.fare.status))throw new TripError(422,'Select a suitable vehicle and recalculate your estimate.');
  return {source:q.route.source||'Mapbox Directions',calculatedAt:new Date(q.expiresAt-30*60*1000).toISOString(),distanceKm:q.route.distanceKm,durationSeconds:q.route.durationSeconds,returnIncluded:q.route.returnIncluded,tripOptions:{package_id:t.package_id,rental_hours:t.rental_hours,travel_days:t.travel_days,waiting_minutes:t.waiting_minutes},fare:item.fare,vehicleName:item.name,confirmation:'Pending operator confirmation'};
}
