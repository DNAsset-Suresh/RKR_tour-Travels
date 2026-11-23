import { pool } from '../config/database.js';
import { connectMongo } from '../config/mongodb.js';
import { ContactEnquiry } from '../models/ContactEnquiry.js';
import { sendContactEmails } from '../services/emailService.js';

export async function createContact(req, res) {
  const b = req.body;
  let savedRecord = null;

  // 1. Persist enquiry into database (MongoDB Atlas or PostgreSQL fallback)
  if (process.env.MONGODB_URI) {
    try {
      await connectMongo();
      const saved = await ContactEnquiry.create({
        customer_name: b.customer_name,
        mobile_number: b.mobile_number,
        email: b.email || null,
        subject: b.subject,
        message: b.message,
        enquiry_status: 'new'
      });
      savedRecord = { id: String(saved._id), created_at: saved.created_at || new Date().toISOString() };
    } catch (e) {
      console.warn('MongoDB contact save error, falling back to PostgreSQL:', e.message);
    }
  }

  if (!savedRecord) {
    try {
      const { rows: [saved] } = await pool.query(
        'INSERT INTO contact_enquiries (customer_name,mobile_number,email,subject,message) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',
        [b.customer_name, b.mobile_number, b.email || null, b.subject, b.message]
      );
      savedRecord = saved;
    } catch (dbErr) {
      console.error('Database enquiry insert failed:', dbErr.message);
      return res.status(500).json({
        error: { message: 'Unable to save your enquiry at this time. Please contact us directly.' }
      });
    }
  }

  // 2. Dispatch Confirmation & Notification Emails via Nodemailer
  try {
    await sendContactEmails({
      customer_name: b.customer_name,
      mobile_number: b.mobile_number,
      email: b.email,
      subject: b.subject,
      message: b.message,
      created_at: savedRecord.created_at
    });
  } catch (emailError) {
    // Technical error is logged ONLY on the server; never exposed to browser
    console.error('[ContactController] Email delivery failure:', emailError.message);
    return res.status(502).json({
      error: {
        message: 'Something went wrong while submitting your enquiry. Please try again or contact us directly.'
      }
    });
  }

  // 3. Return successful response with friendly message
  return res.status(201).json({
    data: savedRecord,
    message: 'Thank you! Your enquiry has been submitted successfully. We will get back to you shortly.'
  });
}
