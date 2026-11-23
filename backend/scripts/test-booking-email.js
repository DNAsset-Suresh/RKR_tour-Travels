import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { sendBookingEmails } from '../services/emailService.js';

console.log('Testing sendBookingEmails with customer message and new app password...');

const mockBooking = {
  booking_reference: 'RKR-MESSAGE-VERIFY-01',
  customer_name: 'Suresh Kumar',
  mobile_number: '+91 96294 26655',
  email: 'travel.rkr@gmail.com',
  pickup_location: 'Chennai Airport',
  destination: 'Trichy Central',
  journey_date: '2026-11-25',
  pickup_time: '09:59',
  vehicle_name: 'Force Urbania (12 Seater)',
  passenger_count: 12,
  trip_type: 'one_way',
  additional_requirements: 'Customer Message: Need vehicle with extra luggage space for 6 suitcases. Driver should speak Tamil and English.'
};

try {
  const result = await sendBookingEmails(mockBooking);
  console.log('✅ sendBookingEmails with message succeeded!');
  console.log('Owner email result:', result.ownerMail ? result.ownerMail.messageId : 'none');
  console.log('Customer email result:', result.userMail ? result.userMail.messageId : 'none');
} catch (err) {
  console.error('❌ sendBookingEmails failed:', err);
}
