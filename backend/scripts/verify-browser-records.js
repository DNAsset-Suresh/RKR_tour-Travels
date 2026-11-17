import { pool } from '../config/database.js';
try {
  const bookings=await pool.query("SELECT booking_status FROM bookings WHERE customer_name='Browser QA Journey'");
  const enquiries=await pool.query("SELECT enquiry_status FROM contact_enquiries WHERE customer_name='Browser QA Contact'");
  if(!bookings.rowCount || !enquiries.rowCount) throw new Error('Browser test records not found.');
  console.log(`Verified browser submissions in PostgreSQL: ${bookings.rowCount} pending booking(s), ${enquiries.rowCount} enquiry/enquiries.`);
  await pool.query("DELETE FROM bookings WHERE customer_name='Browser QA Journey'");
  await pool.query("DELETE FROM contact_enquiries WHERE customer_name='Browser QA Contact'");
  console.log('Removed only the named browser QA records.');
}finally{await pool.end();}
