import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import InvoiceSequence from '../models/InvoiceSequence.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is missing');

  const options = {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 30000),
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
    socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
    heartbeatFrequencyMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 0,
    retryReads: true,
    retryWrites: true,
    family: 4
  };

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await mongoose.connect(uri, options);
      // Remove legacy single-tenant unique indexes once, so invoice sequences/numbers can be scoped per client.
      for (const [Model, indexName] of [[Invoice, 'invoiceNumber_1'], [InvoiceSequence, 'financialYear_1']]) {
        try { await Model.collection.dropIndex(indexName); } catch (e) { if (e?.codeName !== 'IndexNotFound') console.warn(`⚠️ Could not drop legacy index ${indexName}: ${e.message}`); }
      }
      console.log('✅ MongoDB connected');
      return;
    } catch (error) {
      lastError = error;
      console.error(`❌ MongoDB connection attempt ${attempt}/5 failed: ${error.message}`);
      if (attempt < 5) await sleep(attempt * 2000);
    }
  }

  throw lastError;
}

mongoose.connection.on('error', (error) => {
  console.error(`⚠️ MongoDB connection error: ${error.message}`);
});
