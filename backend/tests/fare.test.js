import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFare,readPricing } from '../services/fareEngine.js';
import { createMapService,drivingJourney,mapSettings } from '../services/mapService.js';
import { bookingQuote,saveQuote } from '../services/tripQuotes.js';
import { tripSchema } from '../routes/tripRoutes.js';
import { bookingSchema } from '../middleware/validateRequest.js';
import { whatsappMessage,whatsappUrl } from '../../frontend/booking-service.js';
const vehicle={id:1,name:'Swift Dzire',passenger_capacity:4,tariff:{package_5h_50km:1300,package_10h_100km:2600,extra_hour:260,extra_km:14}};
const pricing={version:'test-fixture',vehicles:{'Swift Dzire':{one_way:null}}};
const trip={pickup:{label:'Fixture pickup',coordinates:[80.27,13.08]},destination:{label:'Fixture drop-off',coordinates:[80.16,12.99]},journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local',package_id:'5h50',rental_hours:5,travel_days:1,waiting_minutes:0,return_journey:false};
const route={distanceKm:50,durationSeconds:3600,returnIncluded:false};
test('approved local package boundaries, excess and proportional charges',()=>{
  assert.equal(calculateFare(vehicle,trip,route,pricing).total,1300);
  assert.equal(calculateFare(vehicle,{...trip,rental_hours:6},{...route,distanceKm:60},pricing).total,1700);
  assert.equal(calculateFare(vehicle,{...trip,rental_hours:5.5},{...route,distanceKm:50.5},pricing).total,1437);
  assert.equal(calculateFare(vehicle,{...trip,package_id:'10h100',rental_hours:10},{...route,distanceKm:100},pricing).total,2600);
  assert.equal(calculateFare(vehicle,trip,{...route,durationSeconds:21600},pricing).total,1560);
  assert.equal(calculateFare(vehicle,{...trip,package_id:'unknown'},route,pricing).total,null);
});
test('missing rates and route failures never become free or fabricated fares',()=>{
  for(const mode of ['one_way','round_trip','outstation'])assert.equal(calculateFare(vehicle,{...trip,trip_type:mode},route,pricing).status,'quote_required');
  for(const bad of [NaN,Infinity,-1,0])assert.equal(calculateFare(vehicle,trip,{...route,distanceKm:bad},pricing).total,null);
  assert.equal(calculateFare({...vehicle,tariff:null},trip,route,pricing).total,null);
  assert.equal(calculateFare(vehicle,trip,route,{vehicles:{}}).total,null);
  assert.ok(calculateFare(vehicle,trip,route,pricing).exclusions.includes('Tolls'));
});
test('capacity and availability restrictions are enforced',()=>{
  assert.equal(calculateFare(vehicle,{...trip,passenger_count:5},route,pricing).status,'capacity_exceeded');
  assert.equal(calculateFare({...vehicle,availability_status:'unavailable'},trip,route,pricing).status,'unavailable');
});
test('explicit fixture rates apply only configured charges and minimums',()=>{
  const config={version:'test-only',vehicles:{'Swift Dzire':{outstation:{baseFare:100,ratePerKm:10,minimumFare:500,minimumKmPerDay:100,driverAllowancePerDay:50,nightCharge:75,tolls:20,parking:10,taxPercent:5,waitingPerHour:60,returnRequired:true}}}};
  const result=calculateFare(vehicle,{...trip,trip_type:'outstation',travel_days:2,pickup_time:'23:00',waiting_minutes:30},{...route,returnIncluded:true},config);
  assert.equal(result.total,2451.75);assert.deepEqual(result.exclusions,[]);
  assert.equal(calculateFare(vehicle,{...trip,trip_type:'outstation'},route,config).total,null);
});
test('all configured vehicles default to Quote Required for unapproved road tariffs',async()=>{
  const config=await readPricing();assert.equal(Object.keys(config.vehicles).length,14);
  for(const name of Object.keys(config.vehicles))for(const mode of ['one_way','round_trip','outstation'])assert.equal(calculateFare({...vehicle,name},{...trip,trip_type:mode},route,config).status,'quote_required');
});
test('Mapbox metres become kilometres; return route is a separate request',async()=>{
  const calls=[];const service=createMapService({token:'test-only',fetcher:async url=>{calls.push(url);return {ok:true,json:async()=>({code:'Ok',routes:[{distance:calls.length===1?12345:14567,duration:1800,geometry:{type:'LineString',coordinates:[[80,13],[81,14]]}}]})};}});
  const result=await drivingJourney(service,{...trip,trip_type:'round_trip'});assert.equal(result.distanceKm,26.912);assert.equal(result.durationSeconds,3600);assert.equal(calls.length,2);assert.ok(calls[1].pathname.endsWith('80.16,12.99;80.27,13.08'));
});
test('map service errors are explicit and credentials never appear in messages',async()=>{
  await assert.rejects(createMapService({token:''}).route([1,2],[3,4]),/setup required/);
  for(const response of [{ok:false,status:401},{ok:true,json:async()=>({code:'NoRoute'})},{ok:true,json:async()=>({code:'Ok',routes:[{distance:-2,duration:3}]})}])await assert.rejects(createMapService({token:'SECRET_TEST',fetcher:async()=>response}).route([1,2],[3,4]),error=>!error.message.includes('SECRET_TEST')&&!!error.status);
  await assert.rejects(createMapService({token:'test',fetcher:async()=>{throw new Error('timeout');}}).route([1,2],[3,4]),/timed out/);
  assert.equal(mapSettings({MAPBOX_PUBLIC_TOKEN:'sk.secret',MAPBOX_SERVER_TOKEN:'server'}).publicToken,null);
});
test('trip validation rejects bad coordinates, duplicate locations, dates and counts',()=>{
  assert.equal(tripSchema.safeParse(trip).success,true);
  for(const change of [{passenger_count:19},{passenger_count:0},{destination:trip.pickup},{journey_date:'2099-02-31'},{pickup_time:'24:60'},{pickup:{...trip.pickup,coordinates:[Infinity,13]}},{travel_days:0},{rental_hours:-1},{fare:1}])assert.equal(tripSchema.safeParse({...trip,...change}).success,false);
});
test('booking uses server snapshots; mismatches, stale IDs and client prices are rejected',()=>{
  const fare=calculateFare(vehicle,trip,route,pricing),quote=saveQuote(trip,route,[{id:1,name:vehicle.name,fare}]);
  const body={customer_name:'Test Customer',mobile_number:'+919876543210',pickup_location:trip.pickup.label,destination:trip.destination.label,journey_date:trip.journey_date,pickup_time:trip.pickup_time,passenger_count:2,trip_type:'local',vehicle_id:1,quote_id:quote.id};
  assert.equal(bookingSchema.safeParse(body).success,true);assert.equal(bookingQuote(body).fare.total,1300);
  assert.throws(()=>bookingQuote({...body,passenger_count:3}),/changed/);
  assert.throws(()=>bookingQuote({...body,vehicle_id:2}),/suitable/);
  assert.throws(()=>bookingQuote({...body,quote_id:'9c198392-e3f1-4a57-ad0b-e9951288eb4b'}),/expired/);
  assert.equal(bookingSchema.safeParse({...body,estimated_fare:1}).success,false);
});
test('WhatsApp links require a configured real-format number and preserve estimate details',()=>{
  const message=whatsappMessage({customer_name:'Test Customer',mobile_number:'+919876543210',pickup_location:'A & B',destination:'C',journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local'}, {route}, {...vehicle,fare:calculateFare(vehicle,trip,route,pricing)});
  assert.equal(whatsappUrl('',message),null);assert.equal(whatsappUrl('placeholder',message),null);
  assert.ok(message.includes('50.00 km'));assert.ok(message.includes('not a confirmed booking'));
  assert.equal(new URL(whatsappUrl('+919876543210',message)).searchParams.get('text'),message);
});
