# Tax Admin System

Admin-only GST/tax management system built with React + Vite, Node.js/Express and MongoDB.

## Current modules
- Admin authentication
- Dashboard
- Client management with multi-service support
- Service-specific document upload (GST / Income Tax / P Tax / Others)
- Product master and Tax Rate Master
- Inventory: opening stock, stock-in, stock history, low-stock threshold
- Invoice creation with client/product auto-fill
- Central backend tax calculation (CGST/SGST/IGST)
- Invoice issue/cancel with inventory synchronization
- Client/Product/Invoice/Summary/Inventory PDF and Excel exports
- Business/Invoice Settings
- Audit logging
- Protected document access

## Setup

### 1. Backend
```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env`, then fill in your own values: MongoDB Atlas connection string (`MONGO_URI`), admin login (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), a new random `JWT_SECRET`, and `CLIENT_URL` (must match the URL the frontend runs on, e.g. `http://localhost:5173` locally or your production frontend URL - the backend uses this for CORS).

```bash
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## Environment
The backend expects:

```env
PORT=5000
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/tax_admin_system?retryWrites=true&w=majority
JWT_SECRET=use-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
CLIENT_URL=http://localhost:5173
```

Do not commit `.env` or real credentials.

## Important invoice behavior
- Draft invoices do not change stock.
- Issuing an invoice deducts stock atomically when MongoDB transactions are available.
- Cancelling an issued invoice restores the sold quantity.
- Invoice items keep a historical snapshot of product description, HSN/SAC, rate and tax values.
- Final tax amounts are calculated by the backend, not trusted from the browser.

## Document security
Client documents are stored outside MongoDB and accessed through authenticated backend routes. Do not make sensitive files (PAN/Aadhaar/GST certificates) public.

## Validation note
The project can be statically checked in environments without network/database access. Full end-to-end runtime validation requires `npm install` and a reachable MongoDB Atlas instance on the development machine.


## Final completion notes
- Admin-only system; no client login.
- Client services support GST, Income Tax, P Tax and Others with service-specific documents.
- Product/HSN auto matching, tax-rate master, inventory, invoice, summary, PDF and Excel exports are integrated.
- Final financial/tax calculations are performed server-side.
- Audit activity is available under Settings.
- Rotate any credentials previously exposed during development before production use.

## Final reviewed state
This package includes a final static review pass. Invoice creation requires both seller and buyer state/place-of-supply information so the tax engine does not silently assume intra-state supply when state data is missing. Inventory responses include product rate and calculated stock value. Invoice round-off is disabled by default and is only applied when enabled in Settings.


## Production deployment checklist

- Never commit `backend/.env`; use `backend/.env.example` as the template.
- Set `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CLIENT_URL`, and `PORT` in the hosting provider's secret/environment settings.
- Keep MongoDB Atlas Network Access limited to the hosting provider's required outbound access.
- Verify the selected client before creating invoices, changing inventory, or viewing summaries/reports.
- Back up production MongoDB data before application upgrades or migrations.
