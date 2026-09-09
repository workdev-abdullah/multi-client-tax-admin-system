# Tax Invoice Fixes

Changed only the files required for the reported tax/PDF and MongoDB stability issues:

- `backend/src/services/taxEngine.js`
  - Uses configured CGST/SGST/IGST rates per invoice line.
  - Returns `totalTax`.
  - Avoids deriving invoice totals from the sum of tax-rate percentages.

- `backend/src/controllers/reportController.js`
  - Fixes the HSN tax table column mapping that was displaying IGST (0) under `Total Tax`.
  - Calculates and displays `Total Tax = CGST + SGST + IGST`.
  - Shows the actual CGST/SGST percentages per HSN group.

- `frontend/src/pages/invoices/InvoicesPage.jsx`
  - Fixes preview totals for invoices containing products with different GST rates by summing each line's tax instead of multiplying the total taxable amount by the sum of GST rates.

- `backend/src/config/db.js`
  - Adds connection retry/backoff and safer MongoDB driver connection settings for intermittent Atlas TLS/server-selection failures.
