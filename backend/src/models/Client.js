import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    clientCode: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    district: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    services: {
      type: [
        {
          type: String,
          enum: ['GST', 'INCOME_TAX', 'P_TAX', 'OTHERS']
        }
      ],
      default: []
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
  },
  { timestamps: true }
);

clientSchema.index({ name: 'text', businessName: 'text', phone: 'text', gstin: 'text', panNumber: 'text' });
clientSchema.index({ services: 1, status: 1 });

export default mongoose.model('Client', clientSchema);
