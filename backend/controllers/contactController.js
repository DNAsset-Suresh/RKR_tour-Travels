
import { pool } from '../config/database.js';
import { connectMongo } from '../config/mongodb.js';
import { ContactEnquiry } from '../models/ContactEnquiry.js';

export async function createContact(req, res) {
  const b = req.body;
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
      return res.status(201).json({
        data: { id: saved._id, created_at: saved.created_at },
        message: 'Your enquiry has been saved for the team to review.'
      });
    } catch (e) {
      console.warn('MongoDB contact save error, falling back to PostgreSQL:', e.message);
    }
  }

  const { rows: [saved] } = await pool.query(
    'INSERT INTO contact_enquiries (customer_name,mobile_number,email,subject,message) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',
    [b.customer_name, b.mobile_number, b.email || null, b.subject, b.message]
  );
  res.status(201).json({ data: saved, message: 'Your enquiry has been saved for the team to review.' });
}
