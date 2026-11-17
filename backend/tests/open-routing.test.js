import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenRoutingService,createRequestQueue } from '../services/openRoutingService.js';
import { confirmPlace,verifyPlace } from '../services/confirmedPlaces.js';
import { roadTripSchema } from '../routes/tripRoutes.js';
const pickup={label:'QA station',coordinates:[80.27,13.08]},destination={label:'QA landmark',coordinates:[80.19,12.62]};
const defaults={searchQueue:fn=>fn(),drivingQueue:fn=>fn(),searchCache:new Map(),routeCache:new Map()};
const response=data=>({ok:true,json:async()=>data});
const routed={code:'Ok',routes:[{distance:57201.3,duration:3295.5}],waypoints:[{distance:5},{distance:10}]};
test('open geocoding identifies the app, restricts India and caches normalized searches',async()=>{
  let calls=0;const service=createOpenRoutingService({...defaults,searchCache:new Map(),fetcher:async(url,options)=>{calls++;assert.equal(url.hostname,'nominatim.openstreetmap.org');assert.equal(url.searchParams.get('countrycodes'),'in');assert.equal(url.searchParams.get('limit'),'5');assert.match(options.headers['User-Agent'],/RKR-Tour/);return response([{display_name:'QA place',lat:'13.08',lon:'80.27'}]);}});
  const a=await service.search('QA Station');assert.deepEqual(a[0],{label:'QA place',coordinates:[80.27,13.08]});assert.deepEqual(await service.search('qa station'),a);assert.equal(calls,1);
});
test('OSRM uses a driving route in metres/seconds; fresh booking checks bypass cached routes',async()=>{
  let calls=0;const service=createOpenRoutingService({...defaults,routeCache:new Map(),fetcher:async url=>{calls++;assert.ok(url.pathname.includes('/routed-car/route/v1/driving/80.27,13.08;80.19,12.62'));assert.equal(url.searchParams.get('overview'),'false');return response(routed);}});
  const route=await service.route(pickup,destination);assert.equal(route.distanceKm,57.2013);assert.equal(route.durationSeconds,3295.5);assert.equal(route.source,'OSRM');assert.equal(route.trafficAware,false);
  await service.route(pickup,destination);assert.equal(calls,1);await service.route(pickup,destination,{fresh:true});assert.equal(calls,2);
});
test('route failures, remote road snaps and malformed results never fabricate a distance',async()=>{
  assert.deepEqual(await createOpenRoutingService({...defaults,searchCache:new Map(),fetcher:async()=>response([null,{display_name:'Bad',lon:null,lat:null}])}).search('QA invalid response'),[]);
  for(const data of [{code:'NoRoute'},{code:'NoSegment'},{...routed,routes:[{distance:-1,duration:1}]},{...routed,waypoints:[{distance:5000},{distance:2}]},{...routed,routes:[{distance:1,duration:null}]}])await assert.rejects(createOpenRoutingService({...defaults,routeCache:new Map(),fetcher:async()=>response(data)}).route(pickup,destination),e=>[422,502].includes(e.status));
  await assert.rejects(createOpenRoutingService({...defaults,fetcher:async()=>{throw new Error('network');}}).route(pickup,destination),/unavailable/);
  await assert.rejects(createOpenRoutingService(defaults).route(pickup,pickup),/different/);
  await assert.rejects(createOpenRoutingService(defaults).route({coordinates:[Infinity,0]},destination),/confirmed/);
});
test('shared queue serializes requests and enforces service-wide spacing',async()=>{
  let clock=10000;const starts=[];const queue=createRequestQueue({now:()=>clock,sleep:async ms=>{clock+=ms;}});
  await Promise.all([1,2,3].map(i=>queue(async()=>{starts.push(clock);return i;})));
  assert.deepEqual(starts,[10000,11100,12200]);
  await assert.rejects(queue(async()=>{throw new Error('fixture');}),/fixture/);assert.equal(await queue(async()=>42),42);
});
test('automatically routed trips require distinct signed places and accept no browser distance',()=>{
  const trip={pickup:confirmPlace(pickup),destination:confirmPlace(destination),journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local',package_id:'5h50',rental_hours:5};
  assert.equal(roadTripSchema.safeParse(trip).success,true);assert.deepEqual(verifyPlace(trip.pickup),pickup);
  assert.equal(roadTripSchema.safeParse({...trip,distance_km:1}).success,false);assert.equal(roadTripSchema.safeParse({...trip,destination:trip.pickup}).success,false);assert.throws(()=>verifyPlace({...trip.pickup,coordinates:[1,2]}),/confirmation/);
});
