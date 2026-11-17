import { TripError } from './mapService.js';
export function manualJourney(trip) {
  if(!Number.isFinite(trip.distance_km)||trip.distance_km<=0||trip.distance_km>10000)throw new TripError(422,'Enter a trip distance greater than 0 and no more than 10,000 km.');
  return {source:'Customer-entered distance',distanceKm:trip.distance_km,durationSeconds:null,returnIncluded:trip.trip_type==='round_trip'||Boolean(trip.return_journey),trafficAware:false};
}
