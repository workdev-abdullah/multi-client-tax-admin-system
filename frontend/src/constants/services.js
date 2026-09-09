export const SERVICES = [
  { key: 'GST', label: 'GST' },
  { key: 'INCOME_TAX', label: 'Income Tax' },
  { key: 'P_TAX', label: 'P Tax' },
  { key: 'OTHERS', label: 'Others' }
];

export const ASSESSMENT_YEARS = ['2026-27', '2027-28'];

export const DOCUMENT_REQUIREMENTS = {
  GST: [
    { documentType: 'Registration Certificate', key: 'gst-registration', required: true },
    { documentType: 'Aadhaar Card', key: 'gst-aadhaar', required: true },
    { documentType: 'PAN Card', key: 'gst-pan', required: true },
    { documentType: 'Other Document', key: 'gst-other', required: false }
  ],
  INCOME_TAX: [
    { documentType: 'Acknowledgement', key: 'it-acknowledgement', required: false },
    { documentType: 'Balance Sheet', key: 'it-balance-sheet', required: false }
  ],
  P_TAX: [
    { documentType: 'Registration Certificate', key: 'pt-registration', required: true }
  ],
  OTHERS: [
    { documentType: 'Other Document', key: 'other-document', required: false }
  ]
};

export const SERVICE_LABELS = Object.fromEntries(SERVICES.map((service) => [service.key, service.label]));
