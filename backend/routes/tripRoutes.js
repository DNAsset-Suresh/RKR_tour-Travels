import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { pool } from '../config/database.js';
import { todayIST,validateRequest } from '../middleware/validateRequest.js';
import { TripError } from '../services/mapService.js';
import { manualJourney } from '../services/manualJourney.js';
import { createOpenRoutingService } from '../services/openRoutingService.js';
import { confirmPlace,verifyPlace } from '../services/confirmedPlaces.js';
import { calculateFare,readPricing } from '../services/fareEngine.js';
import { saveQuote } from '../services/tripQuotes.js';
export const coordinatesSchema=z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90)]);
const placeId=z.string().regex(/^[a-zA-Z0-9_-]{1,256}$/),session=z.uuid();
const place=z.object({label:z.string().trim().min(2).max(200),coordinates:coordinatesSchema,placeId:placeId.optional(),placeToken:z.string().max(3000).optional()}).strict();
export const tripSchema=z.object({
  pickup:place,destination:place,destinations:z.array(place).max(10).optional().default([]),
  journey_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T00:00:00Z`);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v&&v>=todayIST();}),
  pickup_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  passenger_count:z.number().int().min(1).max(18),trip_type:z.enum(['one_way','round_trip','local','outstation']),
  package_id:z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/).default('5h50'),rental_hours:z.number().min(1).max(240).default(5),
  travel_days:z.number().int().min(1).max(30).default(1),waiting_minutes:z.number().int().min(0).max(1440).default(0),return_journey:z.boolean().default(false)
}).strict().refine(v=>{const allD=[v.destination.coordinates,...(v.destinations||[]).map(d=>d.coordinates)];return allD.some(c=>v.pickup.coordinates.some((n,i)=>Math.abs(n-c[i])>0.00001));},{path:['destination'],message:'Choose different pickup and destination locations.'}).refine(v=>new Date(`${v.journey_date}T${v.pickup_time}:00+05:30`)>new Date(),{path:['pickup_time'],message:'Choose a future pickup time (India time).'});
export const manualTripSchema=z.object({...tripSchema.shape,
  pickup:z.object({label:z.string().trim().min(2).max(200)}).strict(),
  destination:z.object({label:z.string().trim().min(2).max(200)}).strict(),
  destinations:z.array(z.object({label:z.string().trim().min(2).max(200)}).strict()).max(10).optional().default([]),
  trip_type:z.enum(['local','round_trip','one_way','outstation']),distance_km:z.number().finite().positive().max(10000),return_journey:z.boolean().default(false)
}).strict().refine(v=>v.pickup.label.toLowerCase()!==v.destination.label.toLowerCase(),{path:['destination'],message:'Enter different pickup and destination locations.'}).refine(v=>new Date(`${v.journey_date}T${v.pickup_time}:00+05:30`)>new Date(),{path:['pickup_time'],message:'Choose a future pickup time (India time).'});
export const tripRoutes=Router();
tripRoutes.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
tripRoutes.use(rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{message:'Please pause briefly before calculating again.'}}}));
tripRoutes.get('/config',async(req,res)=>{
  let packages=[{id:'5h50',hours:5,km:50},{id:'10h100',hours:10,km:100}];
  try{const pricing=await readPricing();const custom=Object.values(pricing.vehicles||{}).flatMap(v=>v.localPackages||[]);packages=[...new Map([...packages,...custom].map(p=>[p.id,{id:p.id,hours:p.hours,km:p.km}])).values()];}catch{}
  res.json({data:{mode:'open-routing',ready:true,aiReady:false,provider:'OpenStreetMap / OSRM',packages,tripTypes:['local','round_trip','one_way','outstation'],setupMessage:'Find your pickup and destination, confirm the matching places, and road distance will be calculated automatically. You can also enter a distance yourself.'}});
});
async function estimate(trip,route){
  let pricing;try{pricing=await readPricing();}catch{throw new TripError(503,'Vehicle pricing configuration could not be read. Please request a quotation.');}
  const {rows}=await pool.query(`SELECT v.*,to_jsonb(t) AS tariff FROM vehicles v LEFT JOIN vehicle_tariffs t ON t.vehicle_id=v.id WHERE v.is_active=true ORDER BY v.display_order,v.id`);
  const fares=rows.map(v=>({id:v.id,name:v.name,category:v.category,image_path:v.image_path,video_path:v.video_path,passenger_capacity:v.passenger_capacity,fare:calculateFare(v,trip,route,pricing)}));
  const quote=saveQuote(trip,route,fares);
  return {quote,route,vehicles:fares};
}
tripRoutes.post('/estimate',validateRequest(manualTripSchema),async(req,res)=>{
  res.json({data:await estimate(req.body,manualJourney(req.body))});
});
// Explicit search only: never autocomplete on keystrokes against public Nominatim.
tripRoutes.post('/places',rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:{message:'Please wait before searching again. You can still enter the distance yourself.'}}}),validateRequest(z.object({pickup:z.string().trim().min(2).max(200).optional(),destination:z.string().trim().min(2).max(200).optional(),destinations:z.array(z.string().trim().min(2).max(200)).optional(),query:z.string().trim().min(2).max(200).optional()}).strict()),async(req,res)=>{
  const service=createOpenRoutingService();
  const data={};
  if(req.body.query){data.matches=(await service.search(req.body.query)).map(confirmPlace);}
  if(req.body.pickup){data.pickup=(await service.search(req.body.pickup)).map(confirmPlace);}
  if(req.body.destination){data.destination=(await service.search(req.body.destination)).map(confirmPlace);}
  if(Array.isArray(req.body.destinations)){
    data.destinations=await Promise.all(req.body.destinations.map(async q=>q?.trim()?(await service.search(q.trim())).map(confirmPlace):[]));
  }
  res.json({data});
});
export const roadTripSchema=tripSchema;
tripRoutes.post('/road-estimate',validateRequest(roadTripSchema),async(req,res)=>{
  const pickup=verifyPlace(req.body.pickup);
  const destination=verifyPlace(req.body.destination);
  const destinations=(req.body.destinations||[]).map(verifyPlace);
  const isRoundTrip=req.body.trip_type==='round_trip'||req.body.return_journey;
  const allDestinations=[destination,...destinations];
  const route=await createOpenRoutingService().route(pickup,allDestinations,{roundTrip:isRoundTrip});
  const trip={...req.body,pickup,destination,destinations,return_journey:isRoundTrip};
  res.json({data:await estimate(trip,route)});
});