import mongoose from 'mongoose';

const contactEnquirySchema = new mongoose.Schema({
  customer_name: { type: String, required: true },
  mobile_number: { type: String, required: true },
  email: { type: String, default: null },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  enquiry_status: {
    type: String,
    enum: ['new', 'reviewed', 'closed'],
    default: 'new'
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

contactEnquirySchema.index({ enquiry_status: 1, created_at: -1 });

export const ContactEnquiry = mongoose.models.ContactEnquiry || mongoose.model('ContactEnquiry', contactEnquirySchema);
