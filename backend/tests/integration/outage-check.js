// Run ONLY while this project's isolated database is stopped; the external API must be running.
import assert from 'node:assert/strict';
const base='http://localhost:5000/api';
const health=await fetch(`${base}/health`);assert.equal(health.status,503);assert.equal((await health.json()).database,'unavailable');
const payload={customer_name:'Outage QA',mobile_number:'+91 98765 43210',pickup_location:'Chennai',destination:'Munnar',journey_date:'2099-12-01',pickup_time:'08:00',vehicle_id:1,passenger_count:2,trip_type:'one_way',email:'',additional_requirements:''};
for(const [endpoint,data] of [['bookings',payload],['contact',{customer_name:'Outage QA',mobile_number:payload.mobile_number,email:'',subject:'Outage test',message:'This should not be saved while the database is offline.'}]]){
  const response=await fetch(`${base}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal(response.status,503);const body=await response.json();assert.ok(body.error.message);assert.equal(body.data,undefined);
}
console.log('Database outage: health, booking and contact correctly return 503 without a success payload.');
