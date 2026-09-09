import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

import Invoice from '../models/Invoice.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Inventory from '../models/Inventory.js';
import Settings from '../models/Settings.js';
import StockMovement from '../models/StockMovement.js';

// ---------------------------------------------------------
// FONT PATHS
// backend/src/controllers/reportController.js
// backend/fonts/NotoSans-*.ttf
// ---------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONT_REGULAR = path.resolve(
  __dirname,
  '../../fonts/NotoSans-Regular.ttf'
);

const FONT_BOLD = path.resolve(
  __dirname,
  '../../fonts/NotoSans-Bold.ttf'
);

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

const val = (x) =>
  Number(x?.toString?.() ?? x ?? 0);

const money = (x) =>
  `₹${val(x).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const wordsBelow1000 = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const tens = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function two(n) {
  if (n < 20) return wordsBelow1000[n];

  return (
    tens[Math.floor(n / 10)] +
    (n % 10 ? ` ${wordsBelow1000[n % 10]}` : '')
  );
}

function three(n) {
  if (n < 100) return two(n);

  return `${wordsBelow1000[Math.floor(n / 100)]} hundred${
    n % 100 ? ` ${two(n % 100)}` : ''
  }`;
}

function inrWords(num) {
  const value = Math.max(Number(num) || 0, 0);

  const whole = Math.floor(value);
  const paise = Math.round((value - whole) * 100);

  if (whole === 0 && paise === 0) {
    return 'Zero rupees only';
  }

  let n = whole;
  const parts = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  if (crore) parts.push(`${three(crore)} crore`);
  if (lakh) parts.push(`${three(lakh)} lakh`);
  if (thousand) parts.push(`${three(thousand)} thousand`);
  if (n) parts.push(three(n));

  const rupees = parts.join(' ') || 'zero';

  return paise
    ? `${rupees} rupees and ${two(paise)} paise only`
    : `${rupees} rupees only`;
}

function safeFile(s) {
  return String(s || 'invoice')
    .replaceAll('/', '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ---------------------------------------------------------
// PDF CELL
// IMPORTANT: Use Noto Sans so ₹ works correctly.
// ---------------------------------------------------------

function drawCell(
  doc,
  x,
  y,
  w,
  h,
  text,
  {
    bold = false,
    align = 'left',
    fill = false,
    fontSize = 7,
  } = {}
) {
  if (fill) {
    doc
      .rect(x, y, w, h)
      .fillAndStroke('#f1f3f5', '#555');
  } else {
    doc
      .rect(x, y, w, h)
      .stroke('#555');
  }

  doc
    .fillColor('#000')
    .font(bold ? FONT_BOLD : FONT_REGULAR)
    .fontSize(fontSize)
    .text(
      String(text ?? ''),
      x + 3,
      y + 3,
      w - 6,
      {
        align,
        ellipsis: true,
      }
    );
}

// ---------------------------------------------------------
// TABLE
// ---------------------------------------------------------

function drawTable(
  doc,
  columns,
  rows,
  startY,
  rowH = 24
) {
  let x = 40;

  const totalW = 515;

  const scale =
    totalW /
    columns.reduce(
      (a, c) => a + c.w,
      0
    );

  let cx = x;

  for (const c of columns) {
    c._w = c.w * scale;

    drawCell(
      doc,
      cx,
      startY,
      c._w,
      rowH,
      c.label,
      {
        bold: true,
        align: c.align || 'left',
        fill: true,
        fontSize: 7,
      }
    );

    cx += c._w;
  }

  let y = startY + rowH;

  for (const row of rows) {
    cx = x;

    for (
      let i = 0;
      i < columns.length;
      i++
    ) {
      const c = columns[i];

      drawCell(
        doc,
        cx,
        y,
        c._w,
        rowH,
        row[i],
        {
          align: c.align || 'left',
          fontSize: 7,
        }
      );

      cx += c._w;
    }

    y += rowH;
  }

  return y;
}

// ---------------------------------------------------------
// INVOICE PDF
// ---------------------------------------------------------

// ---------------------------------------------------------
// INVOICE PDF
// ---------------------------------------------------------

export async function invoicePdf(
  req,
  res
) {
  try {
    // -------------------------------------------------------
    // SELECTED CLIENT
    // -------------------------------------------------------

    const clientId = String(
      req.query.clientId || ''
    ).trim();

    if (!clientId) {
      return res.status(400).json({
        message: 'Client is required',
      });
    }

    if (!mongoose.isValidObjectId(clientId)) {
      return res.status(400).json({
        message: 'Invalid client',
      });
    }

    const clientObjectId =
      new mongoose.Types.ObjectId(clientId);

    // -------------------------------------------------------
    // LOAD INVOICE + SELECTED CLIENT + CLIENT SETTINGS
    // -------------------------------------------------------

    const [inv, client, settings] =
      await Promise.all([
        Invoice.findOne({
          _id: req.params.id,
          clientId: clientObjectId,
        })
          .populate('clientId')
          .lean(),

        Client.findById(
          clientObjectId
        ).lean(),

        Settings.findOne({
          clientId: clientObjectId,
        }).lean(),
      ]);

    if (!inv) {
      return res.status(404).json({
        message: 'Invoice not found',
      });
    }

    if (!client) {
      return res.status(404).json({
        message: 'Client not found',
      });
    }

    // -------------------------------------------------------
    // IMPORTANT
    //
    // Selected Client = SELLER / BUSINESS
    //
    // buyerSnapshot = actual customer/buyer of invoice
    //
    // This keeps the existing invoice workflow intact.
    // -------------------------------------------------------

    const seller = {
      businessName:
        client.businessName ||
        client.name ||
        '',

      address:
        client.address ||
        '',

      city:
        client.city ||
        '',

      district:
        client.district ||
        '',

      state:
        client.state ||
        '',

      stateCode:
        client.stateCode ||
        '',

      pincode:
        client.pincode ||
        '',

      phone:
        client.phone ||
        '',

      email:
        client.email ||
        '',

      gstin:
        client.gstin ||
        '',

      pan:
        client.panNumber ||
        client.pan ||
        '',

      paymentTerms:
        settings?.paymentTerms ||
        '',

      declaration:
        settings?.declaration ||
        'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    };

    // -------------------------------------------------------
    // BUYER
    //
    // Buyer must NOT be replaced by selected client.
    // Buyer remains the customer stored in buyerSnapshot.
    // -------------------------------------------------------

    const buyer =
      inv.buyerSnapshot ||
      {};

    // -------------------------------------------------------
    // SELLER ADDRESS
    // -------------------------------------------------------

    const sellerAddress = [
      seller.address,
      seller.city,
      seller.district,
      seller.state,
      seller.pincode,
    ]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
      )
      .map((value) =>
        String(value).trim()
      )
      .join(', ');

    // -------------------------------------------------------
    // BUYER ADDRESS
    // -------------------------------------------------------

    const buyerAddress = [
      buyer.address,
      buyer.city,
      buyer.district,
      buyer.state,
      buyer.pincode,
    ]
      .filter(
        (value) =>
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
      )
      .map((value) =>
        String(value).trim()
      )
      .join(', ');

    // -------------------------------------------------------
    // PDF RESPONSE
    // -------------------------------------------------------

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${safeFile(
        inv.invoiceNumber
      )}.pdf"`
    );

    const doc =
      new PDFDocument({
        size: 'A4',
        margin: 40,
      });

    doc.pipe(res);

    const W = 515;
    const x = 40;

    let y = 32;

    // -------------------------------------------------------
    // TITLE
    // -------------------------------------------------------

    doc
      .font(FONT_BOLD)
      .fontSize(14)
      .text(
        'TAX INVOICE',
        x,
        y,
        {
          align: 'center',
          width: W,
        }
      );

    y += 20;

    // -------------------------------------------------------
    // SELLER / INVOICE HEADER
    // -------------------------------------------------------

    const headerH = 92;
    const half = W / 2;

    doc
      .rect(
        x,
        y,
        W,
        headerH
      )
      .stroke('#333');

    doc
      .moveTo(
        x + half,
        y
      )
      .lineTo(
        x + half,
        y + headerH
      )
      .stroke('#333');

    // -------------------------------------------------------
    // SELLER INFORMATION
    // -------------------------------------------------------

    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .text(
        seller.businessName ||
          'BUSINESS NAME',
        x + 7,
        y + 7,
        {
          width: half - 14,
        }
      );

    doc
      .font(FONT_REGULAR)
      .fontSize(7.5)
      .text(
        sellerAddress ||
          'Address not configured',
        x + 7,
        y + 20,
        {
          width: half - 14,
          height: 30,
          ellipsis: true,
        }
      );

    doc
      .font(FONT_REGULAR)
      .text(
        `Phone: ${
          seller.phone || '—'
        }`,
        x + 7,
        y + 53
      );

    doc.text(
      `GSTIN: ${
        seller.gstin || '—'
      }`,
      x + 7,
      y + 65
    );

    doc.text(
      `PAN: ${
        seller.pan || '—'
      }`,
      x + 7,
      y + 77
    );

    // -------------------------------------------------------
    // INVOICE DETAILS
    // -------------------------------------------------------

    doc
      .font(FONT_BOLD)
      .fontSize(7.5)
      .text(
        'Invoice No.',
        x + half + 7,
        y + 7
      );

    doc
      .font(FONT_REGULAR)
      .text(
        inv.invoiceNumber || '',
        x + half + 78,
        y + 7
      );

    doc
      .font(FONT_BOLD)
      .text(
        'Date',
        x + half + 7,
        y + 22
      );

    doc
      .font(FONT_REGULAR)
      .text(
        inv.invoiceDate
          ? new Date(
              inv.invoiceDate
            ).toLocaleDateString(
              'en-IN'
            )
          : '',
        x + half + 78,
        y + 22
      );

    doc
      .font(FONT_BOLD)
      .text(
        'Mode/Terms of Payment',
        x + half + 7,
        y + 37
      );

    doc
      .font(FONT_REGULAR)
      .text(
        seller.paymentTerms || '',
        x + half + 7,
        y + 51,
        {
          width: half - 14,
        }
      );

    doc
      .font(FONT_BOLD)
      .text(
        'Place of Supply',
        x + half + 7,
        y + 66
      );

    doc
      .font(FONT_REGULAR)
      .text(
        inv.placeOfSupply ||
          seller.stateCode ||
          seller.state ||
          '',
        x + half + 78,
        y + 66
      );

    y += headerH;

    // -------------------------------------------------------
    // BUYER / SHIP TO
    // -------------------------------------------------------

    const partyH = 86;

    doc
      .rect(
        x,
        y,
        W,
        partyH
      )
      .stroke('#333');

    doc
      .moveTo(
        x + half,
        y
      )
      .lineTo(
        x + half,
        y + partyH
      )
      .stroke('#333');

    // -------------------------------------------------------
    // BUYER
    // -------------------------------------------------------

    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .text(
        'Buyer (Bill To)',
        x + 7,
        y + 6
      );

    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .text(
        buyer.businessName ||
          buyer.name ||
          '',
        x + 7,
        y + 20,
        {
          width: half - 14,
        }
      );

    doc.text(
      `Name: ${
        buyer.name || '—'
      }`,
      x + 7,
      y + 33
    );

    doc.text(
      `Address: ${
        buyerAddress || '—'
      }`,
      x + 7,
      y + 46,
      {
        width: half - 14,
        height: 23,
        ellipsis: true,
      }
    );

    doc.text(
      `GSTIN: ${
        buyer.gstin || '—'
      }   Phone: ${
        buyer.phone || '—'
      }`,
      x + 7,
      y + 70,
      {
        width: half - 14,
      }
    );

    // -------------------------------------------------------
    // SHIP TO
    // -------------------------------------------------------

    doc
      .font(FONT_BOLD)
      .text(
        'Ship To',
        x + half + 7,
        y + 6
      );

    doc
      .font(FONT_REGULAR)
      .text(
        buyer.shippingAddress ||
          buyerAddress ||
          '—',
        x + half + 7,
        y + 20,
        {
          width: half - 14,
          height: 45,
          ellipsis: true,
        }
      );

    doc.text(
      `State: ${
        buyer.state || '—'
      }   PIN: ${
        buyer.pincode || '—'
      }`,
      x + half + 7,
      y + 67,
      {
        width: half - 14,
      }
    );

    y += partyH + 8;

    // -------------------------------------------------------
    // ITEMS
    // -------------------------------------------------------

    const itemRows =
      (inv.items || []).map(
        (it, i) => [
          i + 1,
          it.description || '',
          it.hsnSac || '',
          val(it.quantity),
          money(it.rate),
          it.unit || '',
          money(
            it.taxableValue
          ),
        ]
      );

    const cols = [
      {
        label: 'Sl.No.',
        w: 42,
        align: 'center',
      },
      {
        label:
          'Description of Goods/Services',
        w: 190,
      },
      {
        label: 'HSN/SAC',
        w: 72,
        align: 'center',
      },
      {
        label: 'Quantity',
        w: 60,
        align: 'right',
      },
      {
        label: 'Rate',
        w: 70,
        align: 'right',
      },
      {
        label: 'Per',
        w: 45,
        align: 'center',
      },
      {
        label: 'Amount',
        w: 90,
        align: 'right',
      },
    ];

    y = drawTable(
      doc,
      cols,
      itemRows,
      y,
      24
    );

    // -------------------------------------------------------
    // NEW PAGE IF NECESSARY
    // -------------------------------------------------------

    if (y > 720) {
      doc.addPage();
      y = 40;
    }

    // -------------------------------------------------------
    // TAX SUMMARY
    // -------------------------------------------------------

    const totalTax =
      val(inv.cgstTotal) +
      val(inv.sgstTotal) +
      val(inv.igstTotal);

    const summaryH = 78;

    doc
      .rect(
        x,
        y,
        W,
        summaryH
      )
      .stroke('#333');

    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .text(
        'Tax / Invoice Summary',
        x + 7,
        y + 7
      );

    doc
      .font(FONT_REGULAR)
      .text(
        `Taxable Value: ${money(
          inv.taxableTotal
        )}`,
        x + 7,
        y + 22
      );

    doc.text(
      `CGST: ${money(
        inv.cgstTotal
      )}`,
      x + 7,
      y + 36
    );

    doc.text(
      `SGST: ${money(
        inv.sgstTotal
      )}`,
      x + 7,
      y + 50
    );

    doc.text(
      `IGST: ${money(
        inv.igstTotal
      )}`,
      x + 180,
      y + 36
    );

    doc.text(
      `Total Tax: ${money(
        totalTax
      )}`,
      x + 180,
      y + 50
    );

    if (
      val(inv.roundOff) !== 0
    ) {
      doc.text(
        `Round Off: ${money(
          inv.roundOff
        )}`,
        x + W - 170,
        y + 36,
        {
          width: 160,
          align: 'right',
        }
      );
    }

    doc
      .font(FONT_BOLD)
      .text(
        `Total: ${money(
          inv.grandTotal
        )}`,
        x + W - 170,
        y + 50,
        {
          width: 160,
          align: 'right',
        }
      );

    y += summaryH + 8;

    // -------------------------------------------------------
    // HSN TAX BREAKDOWN
    // -------------------------------------------------------

    const groups = new Map();

    for (const it of inv.items || []) {
      const key =
        it.hsnSac || '';

      const g =
        groups.get(key) || {
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
        };

      g.taxable += val(
        it.taxableValue
      );

      g.cgst += val(
        it.cgst
      );

      g.sgst += val(
        it.sgst
      );

      g.igst += val(
        it.igst
      );

      groups.set(
        key,
        g
      );
    }

    const taxRows =
      [...groups].map(
        ([hsn, g]) => {
          const cgstRate =
            g.taxable
              ? (
                  (g.cgst * 100) /
                  g.taxable
                ).toFixed(2)
              : '0.00';

          const sgstRate =
            g.taxable
              ? (
                  (g.sgst * 100) /
                  g.taxable
                ).toFixed(2)
              : '0.00';

          const igstRate =
            g.taxable
              ? (
                  (g.igst * 100) /
                  g.taxable
                ).toFixed(2)
              : '0.00';

          return [
            hsn,
            money(g.taxable),
            `${cgstRate}%`,
            money(g.cgst),
            `${sgstRate}%`,
            money(g.sgst),
            `${igstRate}% / ${money(
              g.igst
            )}`,
            money(
              g.cgst +
                g.sgst +
                g.igst
            ),
          ];
        }
      );

    const taxCols = [
      {
        label: 'HSN/SAC',
        w: 70,
      },
      {
        label: 'Taxable Value',
        w: 80,
        align: 'right',
      },
      {
        label: 'CGST Rate',
        w: 48,
        align: 'center',
      },
      {
        label: 'CGST',
        w: 65,
        align: 'right',
      },
      {
        label: 'SGST Rate',
        w: 48,
        align: 'center',
      },
      {
        label: 'SGST',
        w: 65,
        align: 'right',
      },
      {
        label:
          'IGST Rate / Amount',
        w: 82,
        align: 'right',
      },
      {
        label: 'Total Tax',
        w: 75,
        align: 'right',
      },
    ];

    y = drawTable(
      doc,
      taxCols,
      taxRows,
      y,
      22
    );

    // -------------------------------------------------------
    // AMOUNT IN WORDS + DECLARATION
    // -------------------------------------------------------

    y += 6;

    doc
      .rect(
        x,
        y,
        W,
        82
      )
      .stroke('#333');

    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .text(
        'Amount Chargeable (in words):',
        x + 7,
        y + 7
      );

    doc
      .font(FONT_REGULAR)
      .text(
        inrWords(
          val(inv.grandTotal)
        ),
        x + 7,
        y + 21,
        {
          width: W - 14,
        }
      );

    doc
      .font(FONT_BOLD)
      .text(
        'Declaration',
        x + 7,
        y + 45
      );

    doc
      .font(FONT_REGULAR)
      .text(
        seller.declaration,
        x + 7,
        y + 58,
        {
          width: 300,
          fontSize: 7,
        }
      );

    doc
      .font(FONT_BOLD)
      .text(
        `For: ${
          seller.businessName ||
          'Authorised Business'
        }`,
        x + 330,
        y + 45,
        {
          width: 175,
          align: 'right',
        }
      );

    doc
      .font(FONT_REGULAR)
      .text(
        'Authorised Signatory',
        x + 330,
        y + 67,
        {
          width: 175,
          align: 'right',
        }
      );

    doc
      .font(FONT_REGULAR)
      .fontSize(6)
      .fillColor('#555')
      .text(
        'Computer generated tax invoice',
        x,
        y + 95,
        {
          width: W,
          align: 'center',
        }
      );

    doc.end();
  } catch (e) {
    console.error(
      'Invoice PDF generation error:',
      e
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          'Failed to generate invoice PDF',
      });
    }
    res.end();
  }
}

// ---------------------------------------------------------
// XLSX HELPER
// ---------------------------------------------------------

function sendXlsx(
  res,
  data,
  sheetName,
  filename
) {
  const wb =
    XLSX.utils.book_new();

  const ws =
    XLSX.utils.json_to_sheet(data);

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    sheetName
  );

  const buf = XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  res.send(buf);
}

// ---------------------------------------------------------
// CLIENTS EXCEL
// ---------------------------------------------------------

export async function clientsExcel(
  req,
  res
) {
  try {
    const rows = await Client.find()
      .sort({ createdAt: -1 })
      .lean();

    const data = rows.map((x) => ({
      Code: x.clientCode,
      Name: x.name,
      Business: x.businessName,
      Phone: x.phone,
      Email: x.email,

      Address: [
        x.address,
        x.city,
        x.district,
        x.state,
        x.pincode,
      ]
        .filter(Boolean)
        .join(', '),

      PAN: x.panNumber,
      GSTIN: x.gstin,
      Services: (
        x.services || []
      ).join(', '),

      Status: x.status,
    }));

    sendXlsx(
      res,
      data,
      'Clients',
      'clients.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export clients',
    });
  }
}

// ---------------------------------------------------------
// PRODUCTS EXCEL
// ---------------------------------------------------------

export async function productsExcel(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await Product.find({ clientId })
        .populate(
          'taxRateId',
          'name'
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    const data = rows.map((x) => ({
      Description: x.description,
      HSN_SAC: x.hsnSac,
      Rate: val(x.rate),
      Unit: x.unit,
      GST:
        x.taxRateId?.name || '',
      Active: x.isActive
        ? 'Yes'
        : 'No',
    }));

    sendXlsx(
      res,
      data,
      'Products',
      'products.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export products',
    });
  }
}

// ---------------------------------------------------------
// INVENTORY EXCEL
// ---------------------------------------------------------

export async function inventoryExcel(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await Inventory.find({ clientId })
        .populate(
          'productId',
          'description hsnSac unit rate'
        )
        .sort({
          updatedAt: -1,
        })
        .lean();

    const data = rows.map((x) => ({
      Product:
        x.productId?.description ||
        '',

      HSN:
        x.productId?.hsnSac || '',

      Quantity: x.quantity,

      Unit:
        x.productId?.unit || '',

      Rate: val(
        x.productId?.rate
      ),

      StockValue: money(
        (x.quantity || 0) *
          val(
            x.productId?.rate
          )
      ),

      'Low Stock':
        x.quantity <=
        x.lowStockThreshold
          ? 'Yes'
          : 'No',
    }));

    sendXlsx(
      res,
      data,
      'Inventory',
      'inventory.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export inventory',
    });
  }
}

// ---------------------------------------------------------
// INVOICES EXCEL
// ---------------------------------------------------------

export async function invoicesExcel(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await Invoice.find({ clientId })
        .populate(
          'clientId',
          'name businessName gstin'
        )
        .sort({
          invoiceDate: -1,
          createdAt: -1,
        })
        .lean();

    const data = rows.map((x) => ({
      Invoice: x.invoiceNumber,

      Date: x.invoiceDate
        ? new Date(
            x.invoiceDate
          ).toLocaleDateString(
            'en-IN'
          )
        : '',

      Client:
        x.clientId?.name ||
        x.buyerSnapshot?.name ||
        '',

      Business:
        x.clientId?.businessName ||
        x.buyerSnapshot
          ?.businessName ||
        '',

      GSTIN:
        x.clientId?.gstin ||
        x.buyerSnapshot
          ?.gstin ||
        '',
          'Buyer Name':
        x.buyerSnapshot?.name || '',
      Taxable: val(
        x.taxableTotal
      ),

      CGST: val(
        x.cgstTotal
      ),

      SGST: val(
        x.sgstTotal
      ),

      IGST: val(
        x.igstTotal
      ),

      Total: val(
        x.grandTotal
      ),

      Status: x.status,
    }));

    sendXlsx(
      res,
      data,
      'Invoices',
      'invoices.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export invoices',
    });
  }
}

// ---------------------------------------------------------
// STOCK HISTORY EXCEL
// ---------------------------------------------------------

export async function stockHistoryExcel(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await StockMovement.find({ clientId })
        .populate(
          'productId',
          'description hsnSac unit'
        )
        .sort({
          createdAt: -1,
        })
        .limit(2000)
        .lean();

    const data = rows.map((x) => ({
      Date: x.createdAt
        ? new Date(
            x.createdAt
          ).toLocaleString(
            'en-IN'
          )
        : '',

      Product:
        x.productId?.description ||
        '',

      HSN:
        x.productId?.hsnSac || '',

      Type: x.type,
      Quantity: x.quantity,
      PreviousBalance:
        x.previousBalance,
      NewBalance: x.newBalance,
      Reference: x.reference,
      Notes: x.notes,
      CreatedBy: x.createdBy,
    }));

    sendXlsx(
      res,
      data,
      'Stock History',
      'stock-history.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export stock history',
    });
  }
}

// ---------------------------------------------------------
// SUMMARY PDF
// ---------------------------------------------------------

export async function summaryPdf(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    if (!mongoose.isValidObjectId(clientId)) return res.status(400).json({ message: 'Invalid client' });
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const dateFilter = {};

    if (req.query.from) {
      dateFilter.$gte = new Date(
        req.query.from
      );
    }

    if (req.query.to) {
      dateFilter.$lte = new Date(
        `${req.query.to}T23:59:59`
      );
    }

    const invoiceFilter =
      Object.keys(dateFilter).length
        ? {
            clientId: clientObjectId,
            status: 'ISSUED',
            invoiceDate: dateFilter,
          }
        : {
            clientId: clientObjectId,
            status: 'ISSUED',
          };

    const [
      clients,
      products,
      invoices,
    ] = await Promise.all([
      Client.countDocuments({ _id: clientId, status: 'ACTIVE' }),

      Product.countDocuments({
        clientId,
        isActive: true,
      }),

      Invoice.countDocuments(
        invoiceFilter
      ),
    ]);

    const totals =
      await Invoice.aggregate([
        {
          $match: invoiceFilter,
        },

        {
          $group: {
            _id: null,

            sales: {
              $sum: {
                $toDouble:
                  '$grandTotal',
              },
            },

            taxable: {
              $sum: {
                $toDouble:
                  '$taxableTotal',
              },
            },

            cgst: {
              $sum: {
                $toDouble:
                  '$cgstTotal',
              },
            },

            sgst: {
              $sum: {
                $toDouble:
                  '$sgstTotal',
              },
            },

            igst: {
              $sum: {
                $toDouble:
                  '$igstTotal',
              },
            },
          },
        },
      ]);

    const [stockRows, activeProducts] = await Promise.all([
      Inventory.find({ clientId }).populate('productId', 'rate').lean(),
      Product.find({ clientId, isActive: true }).select('_id').lean(),
    ]);

    const stockValue = stockRows.reduce(
      (a, x) => a + Number(x.quantity || 0) * val(x.productId?.rate),
      0
    );

    const stockByProduct = new Map(stockRows.map((x) => [String(x.productId?._id || x.productId), x]));
    const lowStock = activeProducts.filter((product) => {
      const row = stockByProduct.get(String(product._id));
      const quantity = Number(row?.quantity || 0);
      const threshold = Number(row?.lowStockThreshold || 0);
      return quantity <= threshold;
    }).length;

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      'inline; filename="summary.pdf"'
    );

    const doc =
      new PDFDocument({
        size: 'A4',
        margin: 50,
      });

    doc.pipe(res);

    doc
      .font(FONT_BOLD)
      .fontSize(18)
      .text(
        'BUSINESS SUMMARY',
        {
          align: 'center',
        }
      );

    doc.moveDown();

    const t =
      totals[0] || {};

    const rows = [
      [
        'Active Clients',
        clients,
      ],
      [
        'Active Products',
        products,
      ],
      [
        'Issued Invoices',
        invoices,
      ],
      [
        'Total Sales',
        money(t.sales),
      ],
      [
        'Taxable Amount',
        money(t.taxable),
      ],
      ['CGST', money(t.cgst)],
      ['SGST', money(t.sgst)],
      ['IGST', money(t.igst)],
      [
        'Stock Value',
        money(stockValue),
      ],
      [
        'Low Stock Products',
        lowStock,
      ],
    ];

    let y = 100;

    for (const [k, v] of rows) {
      doc
        .font(FONT_BOLD)
        .fontSize(11)
        .text(
          k,
          60,
          y,
          {
            width: 250,
          }
        );

      doc
        .font(FONT_REGULAR)
        .text(
          String(v),
          330,
          y,
          {
            width: 180,
            align: 'right',
          }
        );

      doc
        .moveTo(
          55,
          y + 18
        )
        .lineTo(
          545,
          y + 18
        )
        .stroke(
          '#dddddd'
        );

      y += 28;
    }

    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor('#555')
      .text(
        'Computer generated report',
        60,
        y + 20
      );

    doc.end();
  } catch (e) {
    console.error(e);

    if (!res.headersSent) {
      res.status(500).json({
        message:
          'Failed to generate summary PDF',
      });
    }
  }
}

// ---------------------------------------------------------
// SUMMARY EXCEL
// ---------------------------------------------------------

export async function summaryExcel(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    if (!mongoose.isValidObjectId(clientId)) return res.status(400).json({ message: 'Invalid client' });
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const f = {
      clientId: clientObjectId,
      status: 'ISSUED',
    };

    if (
      req.query.from ||
      req.query.to
    ) {
      f.invoiceDate = {
        ...(req.query.from
          ? {
              $gte: new Date(
                req.query.from
              ),
            }
          : {}),

        ...(req.query.to
          ? {
              $lte: new Date(
                `${req.query.to}T23:59:59`
              ),
            }
          : {}),
      };
    }

    const [
      counts,
      sales,
      stockRows,
    ] = await Promise.all([
      Promise.all([
        Client.countDocuments({ _id: clientId, status: 'ACTIVE' }),

        Product.countDocuments({
          clientId,
          isActive: true,
        }),

        Invoice.countDocuments(f),
      ]),

      Invoice.aggregate([
        {
          $match: f,
        },

        {
          $group: {
            _id: null,

            sales: {
              $sum: {
                $toDouble:
                  '$grandTotal',
              },
            },

            taxable: {
              $sum: {
                $toDouble:
                  '$taxableTotal',
              },
            },

            cgst: {
              $sum: {
                $toDouble:
                  '$cgstTotal',
              },
            },

            sgst: {
              $sum: {
                $toDouble:
                  '$sgstTotal',
              },
            },

            igst: {
              $sum: {
                $toDouble:
                  '$igstTotal',
              },
            },
          },
        },
      ]),

      Inventory.find({ clientId })
        .populate(
          'productId',
          'rate'
        )
        .lean(),
    ]);

    const t =
      sales[0] || {};

    const stockValue =
      stockRows.reduce(
        (sum, row) =>
          sum +
          Number(
            row.quantity || 0
          ) *
            val(
              row.productId?.rate
            ),
        0
      );

    const activeProducts = await Product.find({ clientId, isActive: true }).select('_id').lean();
    const stockByProduct = new Map(stockRows.map((row) => [String(row.productId?._id || row.productId), row]));
    const lowStock = activeProducts.filter((product) => {
      const row = stockByProduct.get(String(product._id));
      return Number(row?.quantity || 0) <= Number(row?.lowStockThreshold || 0);
    }).length;

    sendXlsx(
      res,
      [
        {
          Clients: counts[0],
          Products: counts[1],
          Invoices: counts[2],
          Sales: val(t.sales),
          Taxable: val(
            t.taxable
          ),
          CGST: val(t.cgst),
          SGST: val(t.sgst),
          IGST: val(t.igst),
          StockValue: stockValue,
          LowStockProducts:
            lowStock,
        },
      ],
      'Summary',
      'summary.xlsx'
    );
  } catch (e) {
    res.status(500).json({
      message:
        'Failed to export summary',
    });
  }
}

// ---------------------------------------------------------
// GENERIC REPORT PDF
// ---------------------------------------------------------

function reportPdf(
  res,
  title,
  columns,
  rows,
  filename
) {
  res.setHeader(
    'Content-Type',
    'application/pdf'
  );

  res.setHeader(
    'Content-Disposition',
    `inline; filename="${filename}"`
  );

  const doc =
    new PDFDocument({
      size: 'A4',
      margin: 32,
    });

  doc.pipe(res);

  const W = 531;
  let y = 36;

  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .text(
      title,
      32,
      y,
      {
        width: W,
        align: 'center',
      }
    );

  y += 28;

  const total =
    columns.reduce(
      (a, c) => a + c.w,
      0
    );

  const scaled =
    columns.map((c) => ({
      ...c,
      w: (c.w * W) / total,
    }));

  const rowH = 22;
  const pageBottom = 790;

  const drawHeader = () => {
    let x = 32;

    for (const c of scaled) {
      drawCell(
        doc,
        x,
        y,
        c.w,
        rowH,
        c.label,
        {
          bold: true,
          fill: true,
          fontSize: 7,
          align:
            c.align || 'left',
        }
      );

      x += c.w;
    }

    y += rowH;
  };

  drawHeader();

  for (const row of rows) {
    if (
      y + rowH >
      pageBottom
    ) {
      doc.addPage();
      y = 36;
      drawHeader();
    }

    let x = 32;

    scaled.forEach(
      (c, i) => {
        // rowH is intentionally
        // passed as the cell height.
        drawCell(
          doc,
          x,
          y,
          c.w,
          rowH,
          row[i],
          {
            align:
              c.align || 'left',
            fontSize: 7,
          }
        );

        x += c.w;
      }
    );

    y += rowH;
  }

  doc
    .font(FONT_REGULAR)
    .fontSize(6)
    .fillColor('#555')
    .text(
      'Computer generated report',
      32,
      Math.min(
        y + 12,
        820
      ),
      {
        width: W,
        align: 'center',
      }
    );

  doc.end();
}

// ---------------------------------------------------------
// CLIENTS PDF
// ---------------------------------------------------------

export async function clientsPdf(
  req,
  res
) {
  try {
    const rows = await Client.find()
      .sort({ createdAt: -1 })
      .lean();

    const data = rows.map(
      (x) => [
        x.clientCode || '',
        x.name || '',
        x.businessName || '',
        x.phone || '',
        x.gstin || '',
        (x.services || [])
          .join(', '),
        x.status || '',
      ]
    );

    reportPdf(
      res,
      'CLIENT REPORT',
      [
        {
          label: 'Code',
          w: 60,
        },
        {
          label: 'Name',
          w: 90,
        },
        {
          label: 'Business',
          w: 115,
        },
        {
          label: 'Phone',
          w: 70,
        },
        {
          label: 'GSTIN',
          w: 95,
        },
        {
          label: 'Services',
          w: 80,
        },
        {
          label: 'Status',
          w: 55,
        },
      ],
      data,
      'clients.pdf'
    );
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message:
        'Failed to generate client PDF',
    });
  }
}

// ---------------------------------------------------------
// PRODUCTS PDF
// ---------------------------------------------------------

export async function productsPdf(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await Product.find({ clientId })
        .populate(
          'taxRateId',
          'name'
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    const data = rows.map(
      (x) => [
        x.description || '',
        x.hsnSac || '',
        money(x.rate),
        x.unit || '',
        x.taxRateId?.name ||
          '',
        x.isActive
          ? 'Active'
          : 'Inactive',
      ]
    );

    reportPdf(
      res,
      'PRODUCT REPORT',
      [
        {
          label: 'Description',
          w: 180,
        },
        {
          label: 'HSN/SAC',
          w: 90,
        },
        {
          label: 'Rate',
          w: 75,
          align: 'right',
        },
        {
          label: 'Unit',
          w: 55,
        },
        {
          label: 'GST',
          w: 65,
        },
        {
          label: 'Status',
          w: 70,
        },
      ],
      data,
      'products.pdf'
    );
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message:
        'Failed to generate product PDF',
    });
  }
}

// ---------------------------------------------------------
// STOCK HISTORY PDF
// ---------------------------------------------------------

export async function stockHistoryPdf(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await StockMovement.find({ clientId })
        .populate(
          'productId',
          'description hsnSac unit'
        )
        .sort({
          createdAt: -1,
        })
        .limit(2000)
        .lean();

    const data = rows.map(
      (x) => [
        x.createdAt
          ? new Date(
              x.createdAt
            ).toLocaleString(
              'en-IN'
            )
          : '',

        x.productId
          ?.description || '',

        x.productId
          ?.hsnSac || '',

        x.type,
        x.quantity,
        x.previousBalance,
        x.newBalance,
        x.reference || '',
      ]
    );

    reportPdf(
      res,
      'STOCK HISTORY REPORT',
      [
        {
          label: 'Date',
          w: 110,
        },
        {
          label: 'Product',
          w: 120,
        },
        {
          label: 'HSN',
          w: 70,
        },
        {
          label: 'Type',
          w: 75,
        },
        {
          label: 'Qty',
          w: 55,
          align: 'right',
        },
        {
          label: 'Previous',
          w: 65,
          align: 'right',
        },
        {
          label: 'Balance',
          w: 65,
          align: 'right',
        },
        {
          label: 'Reference',
          w: 85,
        },
      ],
      data,
      'stock-history.pdf'
    );
  } catch (e) {
    console.error(e);

    if (!res.headersSent) {
      res.status(500).json({
        message:
          'Failed to generate stock history PDF',
      });
    }
  }
}

// ---------------------------------------------------------
// INVENTORY PDF
// ---------------------------------------------------------

export async function inventoryPdf(
  req,
  res
) {
  try {
    const clientId = String(req.query.clientId || '').trim();
    if (!clientId) return res.status(400).json({ message: 'Client is required' });
    const rows =
      await Inventory.find({ clientId })
        .populate(
          'productId',
          'description hsnSac unit rate'
        )
        .sort({
          updatedAt: -1,
        })
        .lean();

    const data = rows.map(
      (x) => [
        x.productId
          ?.description || '',

        x.productId
          ?.hsnSac || '',

        x.quantity || 0,

        x.productId
          ?.unit || '',

        money(
          x.productId?.rate
        ),

        money(
          (x.quantity || 0) *
            val(
              x.productId?.rate
            )
        ),

        x.quantity <=
        x.lowStockThreshold
          ? 'LOW'
          : 'OK',
      ]
    );

    reportPdf(
      res,
      'INVENTORY REPORT',
      [
        {
          label: 'Product',
          w: 155,
        },
        {
          label: 'HSN',
          w: 80,
        },
        {
          label: 'Qty',
          w: 55,
          align: 'right',
        },
        {
          label: 'Unit',
          w: 45,
        },
        {
          label: 'Rate',
          w: 75,
          align: 'right',
        },
        {
          label: 'Stock Value',
          w: 85,
          align: 'right',
        },
        {
          label: 'Status',
          w: 55,
        },
      ],
      data,
      'inventory.pdf'
    );
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message:
        'Failed to generate inventory PDF',
    });
  }
}
