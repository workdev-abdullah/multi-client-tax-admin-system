import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    description: { type: String, required: true, trim: true },
    hsnSac: { type: String, required: true, trim: true },
    rate: { type: mongoose.Types.Decimal128, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, default: 'Pcs' },
    taxRateId: { type: mongoose.Schema.Types.ObjectId, ref: 'TaxRate', required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

productSchema.index({ clientId: 1, description: 1 });
productSchema.index({ clientId: 1, hsnSac: 1 });

productSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.rate != null) ret.rate = Number(ret.rate.toString());
    return ret;
  }
});

export default mongoose.model('Product', productSchema);
