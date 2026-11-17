import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  passenger_capacity: { type: Number, min: 1 },
  air_conditioning: { type: Boolean, default: true },
  luggage_info: { type: String, default: '' },
  description: { type: String, required: true },
  image_path: { type: String, required: true },
  video_path: { type: String },
  is_active: { type: Boolean, default: true },
  is_sample: { type: Boolean, default: true },
  availability_status: {
    type: String,
    enum: ['unconfirmed', 'available', 'unavailable'],
    default: 'unconfirmed'
  },
  display_order: { type: Number, default: 0 },
  tariff: {
    currency: { type: String, default: 'INR' },
    package_5h_50km: { type: Number, default: 0 },
    package_10h_100km: { type: Number, default: 0 },
    extra_hour: { type: Number, default: 0 },
    extra_km: { type: Number, default: 0 },
    source_note: { type: String, default: '' }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

export const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', vehicleSchema);
