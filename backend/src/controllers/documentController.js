import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Document from '../models/Document.js';
import Client from '../models/Client.js';

const allowedServices = new Set(['GST', 'INCOME_TAX', 'P_TAX', 'OTHERS']);
const allowedMimes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export async function uploadDocument(req, res) {
  try {
    const { clientId } = req.params;
    const { serviceType, documentType, financialYear = '' } = req.body;

    if (!allowedServices.has(serviceType)) return res.status(400).json({ message: 'Invalid service type' });
    if (!documentType?.trim()) return res.status(400).json({ message: 'Document type is required' });
    if (!req.file) return res.status(400).json({ message: 'Please select a document' });
    if (!allowedMimes.has(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Only PDF, JPG, PNG or WEBP files are allowed' });
    }

    const client = await Client.findById(clientId).select('_id');
    if (!client) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Client not found' });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const finalPath = path.join(path.dirname(req.file.path), storedName);
    fs.renameSync(req.file.path, finalPath);

    const document = await Document.create({
      clientId,
      serviceType,
      documentType: documentType.trim(),
      financialYear: String(financialYear || '').trim(),
      originalName: req.file.originalname,
      storedName,
      storagePath: finalPath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.admin?.email || ''
    });

    res.status(201).json({ document: {
      _id: document._id,
      serviceType: document.serviceType,
      documentType: document.documentType,
      financialYear: document.financialYear,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt
    }});
  } catch (error) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error(error);
    res.status(500).json({ message: 'Failed to upload document' });
  }
}

export async function listClientDocuments(req, res) {
  try {
    const client = await Client.findById(req.params.clientId).select('_id');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    const documents = await Document.find({ clientId: req.params.clientId }).sort({ createdAt: -1 }).lean();
    res.json({ documents });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid client id' });
  }
}


export async function getDocument(req, res) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document not found' });
    res.sendFile(document.storagePath, { headers: { 'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"` } }, (error) => {
      if (error && !res.headersSent) res.status(404).json({ message: 'Document file not found' });
    });
  } catch (error) {
    res.status(400).json({ message: 'Invalid document id' });
  }
}
