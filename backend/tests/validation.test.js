import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookingSchema,contactSchema } from '../middleware/validateRequest.js';
const valid={customer_name:'Test Traveller',mobile_number:'+91 98765 43210',email:'',pickup_location:'Chennai',destination:'Munnar',journey_date:'2099-12-01',pickup_time:'08:00',vehicle_id:1,passenger_count:2,trip_type:'outstation',additional_requirements:''};
test('booking accepts a future journey and optional email',()=>assert.equal(bookingSchema.safeParse(valid).success,true));
test('invalid dates, impossible dates, phones, counts, time and unexpected fields are rejected',()=>{
  for(const change of [{journey_date:'2020-01-01'},{journey_date:'2099-02-31'},{mobile_number:'123'},{passenger_count:0},{passenger_count:1.5},{pickup_time:'25:00'},{vehicle_id:0},{booking_status:'confirmed'},{email:'invalid'},{customer_name:'  '}]) assert.equal(bookingSchema.safeParse({...valid,...change}).success,false,JSON.stringify(change));
});
test('contact rejects missing and invalid details',()=>{
  assert.equal(contactSchema.safeParse({}).success,false);
  assert.equal(contactSchema.safeParse({customer_name:'QA Tester',mobile_number:'+91 98765 43210',email:'',subject:'Travel plans',message:'A detailed test enquiry.'}).success,true);
});
