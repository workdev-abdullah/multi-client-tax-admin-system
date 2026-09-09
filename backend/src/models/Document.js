import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    serviceType: { type: String, enum: ['GST', 'INCOME_TAX', 'P_TAX', 'OTHERS'], required: true, index: true },
    documentType: { type: String, required: true, trim: true },
    financialYear: { type: String, trim: true, default: '' },
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, unique: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: String, default: '' }
  },
  { timestamps: true }
);

documentSchema.index({ clientId: 1, serviceType: 1, financialYear: 1, documentType: 1 });

export default mongoose.model('Document', documentSchema);
