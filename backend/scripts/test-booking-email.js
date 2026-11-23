import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sendBookingEmails } from '../services/emailService.js';

console.log('Testing sendBookingEmails with live SMTP credentials...');

const mockBooking = {
  booking_reference: 'RKR-TEST-1234',
  customer_name: 'Test Customer',
  mobile_number: '+91 96294 26655',
  email: 'travel.rkr@gmail.com',
  pickup_location: 'Chennai',
  destination: 'Trichy',
  journey_date: '2026-11-26',
  pickup_time: '03:03',
  vehicle_name: 'Kia Carnival',
  passenger_count: 1,
  trip_type: 'outstation',
  additional_requirements: 'Test booking email verification for travel.rkr@gmail.com'
};

try {
  const result = await sendBookingEmails(mockBooking);
  console.log('✅ sendBookingEmails succeeded!');
  console.log('Owner email result:', result.ownerMail ? result.ownerMail.messageId : 'none');
  console.log('Customer email result:', result.userMail ? result.userMail.messageId : 'none');
} catch (err) {
  console.error('❌ sendBookingEmails failed:', err);
}
