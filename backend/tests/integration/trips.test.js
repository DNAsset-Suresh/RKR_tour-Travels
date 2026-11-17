import { test,after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
const realFetch=globalThis.fetch;
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}/api`,marker=`QA-MANUAL-${Date.now()}`;
const call=(path,body)=>realFetch(`${base}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
after(async()=>{globalThis.fetch=realFetch;await pool.query('DELETE FROM bookings WHERE customer_name=$1',[marker]);await new Promise(resolve=>server.close(resolve));await pool.end();});
test('no-key calculator and booking work without any external API requests',async()=>{
  let externalCalls=0;globalThis.fetch=async()=>{externalCalls++;throw new Error('External API use is forbidden in manual mode');};
  const config=await (await call('/trips/config')).json();assert.equal(config.data.mode,'open-routing');assert.equal(config.data.ready,true);assert.equal(config.data.aiReady,false);
  assert.deepEqual(config.data.tripTypes,['local']);assert.equal(config.data.publicToken,undefined);
  const trip={pickup:{label:'QA pickup'},destination:{label:'QA destination'},distance_km:65,journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local',package_id:'5h50',rental_hours:6,travel_days:1,waiting_minutes:0,return_journey:false};
  for(const invalid of [{distance_km:0},{distance_km:-5},{distance_km:10001},{distance_km:'65'},{destination:trip.pickup},{pickup:{label:'x'}},{passenger_count:19},{journey_date:'2020-01-01'},{trip_type:'one_way'},{estimated_fare:1}])assert.equal((await call('/trips/estimate',{...trip,...invalid})).status,422);
  const response=await call('/trips/estimate',trip);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const {data}=await response.json();assert.equal(data.route.distanceKm,65);assert.equal(data.route.durationSeconds,null);assert.equal(data.route.source,'Customer-entered distance');assert.equal(data.vehicles.length,14);
  const swift=data.vehicles.find(v=>v.name==='Swift Dzire');assert.equal(swift.fare.total,1770);assert.ok(swift.fare.assumptions[0].includes('not been verified'));
  const larger=await (await call('/trips/estimate',{...trip,package_id:'10h100',rental_hours:10})).json();assert.equal(larger.data.vehicles.find(v=>v.id===swift.id).fare.total,2600);
  const body={customer_name:marker,mobile_number:'+919876543210',email:'',pickup_location:trip.pickup.label,destination:trip.destination.label,journey_date:trip.journey_date,pickup_time:trip.pickup_time,vehicle_id:swift.id,passenger_count:2,trip_type:'local',additional_requirements:'Disposable no-key integration test.',quote_id:data.quote.id};
  assert.equal((await call('/bookings',{...body,estimated_fare:1})).status,422);
  assert.equal((await call('/bookings',{...body,destination:'Changed address'})).status,422);
  const responseSaved=await call('/bookings',body);assert.equal(responseSaved.status,201);const saved=(await responseSaved.json()).data;
  assert.equal(saved.booking_status,'pending');const {rows:[row]}=await pool.query('SELECT journey_estimate FROM bookings WHERE id=$1',[saved.id]);assert.equal(row.journey_estimate.fare.total,1770);assert.equal(row.journey_estimate.durationSeconds,null);assert.equal(row.journey_estimate.source,'Customer-entered distance');
  const confirm=await realFetch(`${base}/bookings/${saved.id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ADMIN_API_KEY}`},body:JSON.stringify({booking_status:'confirmed'})});assert.equal(confirm.status,200);
  assert.equal((await call('/trips/search?q=Chennai')).status,404);
  assert.equal(externalCalls,0);
});

test('key-free automatic road routes flow through confirmed places, fares and booking revalidation',async()=>{
  let routes=0,distance=65000,queries=0;
  globalThis.fetch=async(input,options)=>{
    const url=new URL(input);
    if(url.hostname==='nominatim.openstreetmap.org'){queries++;const pickup=url.searchParams.get('q').includes('pickup');return {ok:true,json:async()=>[{display_name:pickup?'QA public pickup':'QA public destination',lat:pickup?'13.08':'12.62',lon:pickup?'80.27':'80.19'}]};}
    if(url.hostname==='routing.openstreetmap.de'){routes++;return {ok:true,json:async()=>({code:'Ok',routes:[{distance,duration:3600}],waypoints:[{distance:5},{distance:10}]})};}
    throw new Error('Unexpected provider call');
  };
  const placesResponse=await call('/trips/places',{pickup:'QA public pickup',destination:'QA public destination'});assert.equal(placesResponse.status,200);const places=(await placesResponse.json()).data;assert.equal(queries,2);
  const trip={pickup:places.pickup[0],destination:places.destination[0],journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local',package_id:'5h50',rental_hours:5};
  assert.equal((await call('/trips/road-estimate',{...trip,distance_km:1})).status,422);
  assert.equal((await call('/trips/road-estimate',{...trip,pickup:{...trip.pickup,coordinates:[1,2]}})).status,422);
  const response=await call('/trips/road-estimate',trip);assert.equal(response.status,200);const data=(await response.json()).data;
  assert.equal(data.route.distanceKm,65);assert.equal(data.route.durationSeconds,3600);assert.equal(data.route.source,'OSRM');assert.equal(data.vehicles.length,14);
  const swift=data.vehicles.find(v=>v.name==='Swift Dzire');assert.equal(swift.fare.total,1510);
  const body={customer_name:marker,mobile_number:'+919876543210',pickup_location:trip.pickup.label,destination:trip.destination.label,journey_date:trip.journey_date,pickup_time:trip.pickup_time,vehicle_id:swift.id,passenger_count:2,trip_type:'local',quote_id:data.quote.id};
  distance=66000;assert.equal((await call('/bookings',body)).status,409);distance=65000;
  const saved=await call('/bookings',body);assert.equal(saved.status,201);assert.equal(routes,3);
  const id=(await saved.json()).data.id;const {rows:[row]}=await pool.query('SELECT journey_estimate FROM bookings WHERE id=$1',[id]);assert.equal(row.journey_estimate.source,'OSRM');assert.equal(row.journey_estimate.fare.total,1510);
});
