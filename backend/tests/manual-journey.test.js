import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manualJourney } from '../services/manualJourney.js';
import { manualTripSchema } from '../routes/tripRoutes.js';
import { calculateFare } from '../services/fareEngine.js';
import { revalidateQuote } from '../services/quoteValidation.js';
import { journeyText,whatsappMessage } from '../../frontend/booking-service.js';
const vehicle={id:1,name:'Swift Dzire',passenger_capacity:4,tariff:{package_5h_50km:1300,package_10h_100km:2600,extra_hour:260,extra_km:14}};
const pricing={version:'test',vehicles:{'Swift Dzire':{}}};
const trip={pickup:{label:'Pickup'},destination:{label:'Destination'},journey_date:'2099-12-01',pickup_time:'09:00',passenger_count:2,trip_type:'local',package_id:'5h50',rental_hours:6,travel_days:1,waiting_minutes:0,return_journey:false,distance_km:65};
test('manual distance gives honest package totals and never fabricates travel duration',()=>{
  assert.equal(manualTripSchema.safeParse(trip).success,true);const route=manualJourney(trip);assert.equal(route.durationSeconds,null);
  const fare=calculateFare(vehicle,trip,route,pricing);assert.equal(fare.total,1770);assert.ok(fare.assumptions[0].includes('not been verified'));
  assert.ok(journeyText(route).includes('customer-entered'));
  const message=whatsappMessage({...trip,pickup_location:'Pickup',destination:'Destination'}, {route},{...vehicle,fare});assert.ok(message.includes('Driving time: not calculated'));assert.ok(!message.includes('0 min'));
  for(const distance_km of [0,-1,Infinity,NaN,10001])assert.throws(()=>manualJourney({...trip,distance_km}));
});
test('manual booking revalidates rates without calling a route provider',async()=>{
  const route=manualJourney(trip),fare=calculateFare(vehicle,trip,route,pricing),quote={trip,route,fares:[{...vehicle,fare}]};let row=vehicle;
  const options={service:{routes:async()=>{throw new Error('External route call forbidden');}},pricingReader:async()=>pricing,db:{query:async()=>({rows:[row]})}};
  assert.equal((await revalidateQuote(quote,1,options)).fare.total,1770);
  row={...vehicle,tariff:{...vehicle.tariff,extra_km:15}};await assert.rejects(revalidateQuote(quote,1,options),/changed/);
});
