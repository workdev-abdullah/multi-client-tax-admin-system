import mongoose from 'mongoose';

const taxRateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    totalRate: { type: mongoose.Types.Decimal128, required: true, min: 0 },
    cgstRate: { type: mongoose.Types.Decimal128, required: true, min: 0 },
    sgstRate: { type: mongoose.Types.Decimal128, required: true, min: 0 },
    igstRate: { type: mongoose.Types.Decimal128, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

taxRateSchema.index({ name: 1 }, { unique: true });

taxRateSchema.set('toJSON', {
  transform: (_doc, ret) => {
    for (const key of ['totalRate', 'cgstRate', 'sgstRate', 'igstRate']) {
      if (ret[key] != null) ret[key] = Number(ret[key].toString());
    }
    return ret;
  }
});

export default mongoose.model('TaxRate', taxRateSchema);
