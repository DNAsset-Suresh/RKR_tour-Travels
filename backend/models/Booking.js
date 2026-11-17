import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  booking_reference: { type: String, required: true, unique: true },
  customer_name: { type: String, required: true },
  mobile_number: { type: String, required: true },
  email: { type: String, default: null },
  pickup_location: { type: String, required: true },
  destination: { type: String, required: true },
  journey_date: { type: String, required: true },
  pickup_time: { type: String, required: true },
  vehicle_id: { type: Number, required: true, ref: 'Vehicle' },
  passenger_count: { type: Number, required: true, min: 1, max: 500 },
  trip_type: {
    type: String,
    required: true,
    enum: ['one_way', 'round_trip', 'local', 'outstation', 'airport']
  },
  additional_requirements: { type: String, default: '' },
  journey_estimate: { type: mongoose.Schema.Types.Mixed, default: null },
  booking_status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

bookingSchema.index({ journey_date: 1 });
bookingSchema.index({ booking_status: 1, created_at: -1 });
bookingSchema.index({ vehicle_id: 1 });

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
