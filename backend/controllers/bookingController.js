import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { bookingQuote, getQuote } from '../services/tripQuotes.js';
import { revalidateQuote } from '../services/quoteValidation.js';
import { TripError } from '../services/mapService.js';
import { sendBookingEmails } from '../services/emailService.js';

const bad = (res, message) => res.status(422).json({ error: { message, fields: { vehicle_id: message } } });

export async function createBooking(req, res) {
  const b = req.body;
  let estimate = bookingQuote(b);
  if (estimate) {
    const quote = getQuote(b.quote_id);
    estimate = await revalidateQuote(quote, b.vehicle_id);
    estimate.verification = {
      trip: quote.trip,
      route: { ...quote.route, options: undefined },
      fares: [quote.fares.find(v => v.id === b.vehicle_id)]
    };
  }

  // MongoDB path
  if (process.env.MONGODB_URI) {
    const { connectMongo } = await import('../config/mongodb.js');
    await connectMongo();
    const { Vehicle } = await import('../models/Vehicle.js');
    const { Booking } = await import('../models/Booking.js');

    const v = await Vehicle.findOne({ id: b.vehicle_id, is_active: true });
    if (!v) return bad(res, 'Please choose a listed vehicle.');
    if (v.availability_status === 'unavailable') return bad(res, 'This vehicle is not accepting requests. Please choose another.');
    if (v.passenger_capacity && b.passenger_count > v.passenger_capacity) {
      return res.status(422).json({
        error: {
          message: 'Passenger count exceeds the configured capacity.',
          fields: { passenger_count: `Choose no more than ${v.passenger_capacity} passengers.` }
        }
      });
    }

    const reference = `RKR-${randomUUID().toUpperCase()}`;
    const newBooking = await Booking.create({
      booking_reference: reference,
      customer_name: b.customer_name,
      mobile_number: b.mobile_number,
      email: b.email || null,
      pickup_location: b.pickup_location,
      destination: b.destination,
      journey_date: b.journey_date,
      pickup_time: b.pickup_time,
      vehicle_id: b.vehicle_id,
      passenger_count: b.passenger_count,
      trip_type: b.trip_type,
      additional_requirements: b.additional_requirements || '',
      journey_estimate: estimate || null,
      booking_status: 'pending'
    });

    // Send email notification to owners and confirmation to customer
    sendBookingEmails({
      booking_reference: reference,
      customer_name: b.customer_name,
      mobile_number: b.mobile_number,
      email: b.email,
      pickup_location: b.pickup_location,
      destination: b.destination,
      journey_date: b.journey_date,
      pickup_time: b.pickup_time,
      vehicle_id: b.vehicle_id,
      vehicle_name: v?.name || 'Fleet Vehicle',
      passenger_count: b.passenger_count,
      trip_type: b.trip_type,
      additional_requirements: b.additional_requirements || '',
      journey_estimate: estimate || null,
      created_at: newBooking.created_at
    }).catch(err => {
      console.error('[BookingController] Email dispatch error:', err.message);
    });

    return res.status(201).json({
      data: {
        id: newBooking._id,
        booking_reference: newBooking.booking_reference,
        booking_status: newBooking.booking_status,
        created_at: newBooking.created_at
      },
      message: 'Your journey request has been saved. Availability and reservation are pending operator confirmation.'
    });
  }

  // PostgreSQL fallback
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [v] } = await client.query('SELECT * FROM vehicles WHERE id=$1 AND is_active=true FOR SHARE', [b.vehicle_id]);
    if (!v) { await client.query('ROLLBACK'); return bad(res, 'Please choose a listed vehicle.'); }
    if (v.availability_status === 'unavailable') { await client.query('ROLLBACK'); return bad(res, 'This vehicle is not accepting requests. Please choose another.'); }
    if (v.passenger_capacity && b.passenger_count > v.passenger_capacity) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: {
          message: 'Passenger count exceeds the configured capacity.',
          fields: { passenger_count: `Choose no more than ${v.passenger_capacity} passengers.` }
        }
      });
    }
    const reference = `RKR-${randomUUID().toUpperCase()}`;
    const { rows: [saved] } = await client.query(`INSERT INTO bookings (booking_reference,customer_name,mobile_number,email,pickup_location,destination,journey_date,pickup_time,vehicle_id,passenger_count,trip_type,additional_requirements,journey_estimate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id,booking_reference,booking_status,created_at`,
      [reference, b.customer_name, b.mobile_number, b.email || null, b.pickup_location, b.destination, b.journey_date, b.pickup_time, b.vehicle_id, b.passenger_count, b.trip_type, b.additional_requirements, estimate ? JSON.stringify(estimate) : null]);
    await client.query('COMMIT');

    // Send email notification to owners and confirmation to customer
    sendBookingEmails({
      booking_reference: reference,
      customer_name: b.customer_name,
      mobile_number: b.mobile_number,
      email: b.email,
      pickup_location: b.pickup_location,
      destination: b.destination,
      journey_date: b.journey_date,
      pickup_time: b.pickup_time,
      vehicle_id: b.vehicle_id,
      vehicle_name: v?.name || 'Fleet Vehicle',
      passenger_count: b.passenger_count,
      trip_type: b.trip_type,
      additional_requirements: b.additional_requirements || '',
      journey_estimate: estimate || null,
      created_at: saved.created_at
    }).catch(err => {
      console.error('[BookingController] Email dispatch error:', err.message);
    });

    res.status(201).json({ data: saved, message: 'Your journey request has been saved. Availability and reservation are pending operator confirmation.' });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
}

export async function getBooking(req, res) {
  if (process.env.MONGODB_URI) {
    const { connectMongo } = await import('../config/mongodb.js');
    await connectMongo();
    const { Booking } = await import('../models/Booking.js');
    const booking = await Booking.findOne({
      $or: [{ booking_reference: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }]
    });
    if (!booking) return res.status(404).json({ error: { message: 'Booking not found.' } });
    return res.set('Cache-Control', 'no-store').json({ data: booking });
  }
  if (!/^[1-9]\d{0,17}$/.test(req.params.id)) return res.status(400).json({ error: { message: 'Invalid booking ID.' } });
  const { rows: [booking] } = await pool.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
  if (!booking) return res.status(404).json({ error: { message: 'Booking not found.' } });
  res.set('Cache-Control', 'no-store').json({ data: booking });
}

export async function listBookings(req, res) {
  const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
  if (process.env.MONGODB_URI) {
    const { connectMongo } = await import('../config/mongodb.js');
    await connectMongo();
    const { Booking } = await import('../models/Booking.js');
    const rows = await Booking.find().sort({ created_at: -1 }).skip((page - 1) * 50).limit(50);
    return res.set('Cache-Control', 'no-store').json({ data: rows, page });
  }
  const { rows } = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 50 OFFSET $1', [(page - 1) * 50]);
  res.set('Cache-Control', 'no-store').json({ data: rows, page });
}

export async function updateBooking(req, res) {
  if (process.env.MONGODB_URI) {
    const { connectMongo } = await import('../config/mongodb.js');
    await connectMongo();
    const { Booking } = await import('../models/Booking.js');
    const booking = await Booking.findOneAndUpdate(
      { $or: [{ booking_reference: req.params.id }, { _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }] },
      { $set: { booking_status: req.body.booking_status } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: { message: 'Booking not found.' } });
    return res.json({ data: booking });
  }
  if (!/^[1-9]\d{0,17}$/.test(req.params.id)) return res.status(400).json({ error: { message: 'Invalid booking ID.' } });
  if (req.body.booking_status === 'confirmed') {
    const { rows: [saved] } = await pool.query('SELECT vehicle_id,journey_estimate FROM bookings WHERE id=$1', [req.params.id]);
    const estimate = saved?.journey_estimate;
    if (estimate?.verification) {
      if (estimate.fare.total === null) throw new TripError(409, 'This request needs an approved quotation before confirmation.');
      await revalidateQuote(estimate.verification, saved.vehicle_id);
    }
  }
  const { rows: [booking] } = await pool.query('UPDATE bookings SET booking_status=$1 WHERE id=$2 RETURNING id,booking_reference,booking_status', [req.body.booking_status, req.params.id]);
  if (!booking) return res.status(404).json({ error: { message: 'Booking not found.' } });
  res.json({ data: booking });
}
