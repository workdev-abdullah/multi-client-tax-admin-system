import { money } from '../utils/number.js';

/**
 * Calculate an invoice from already-normalized line items.
 * Tax rates on each line are authoritative; the total GST rate is only a
 * convenience value for display and is not used to derive CGST/SGST/IGST.
 */
export function calculateInvoice(items, sameState = true, applyRoundOff = false) {
  let taxableTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const out = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const rate = money(item.rate);
    const taxableValue = money(quantity * rate);

    const totalRate = Number(item.taxRate) || 0;
    const cgstRate = sameState ? (Number.isFinite(Number(item.cgstRate)) && Number(item.cgstRate) >= 0 ? Number(item.cgstRate) : totalRate / 2) : 0;
    const sgstRate = sameState ? (Number.isFinite(Number(item.sgstRate)) && Number(item.sgstRate) >= 0 ? Number(item.sgstRate) : totalRate / 2) : 0;
    const igstRate = !sameState ? (Number.isFinite(Number(item.igstRate)) && Number(item.igstRate) >= 0 ? Number(item.igstRate) : totalRate) : 0;

    const cgst = sameState ? money((taxableValue * cgstRate) / 100) : 0;
    const sgst = sameState ? money((taxableValue * sgstRate) / 100) : 0;
    const igst = sameState ? 0 : money((taxableValue * igstRate) / 100);
    const lineTotal = money(taxableValue + cgst + sgst + igst);

    taxableTotal += taxableValue;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;

    return {
      ...item,
      quantity,
      rate,
      taxRate: totalRate,
      cgstRate: sameState ? cgstRate : 0,
      sgstRate: sameState ? sgstRate : 0,
      igstRate: sameState ? 0 : igstRate,
      taxableValue,
      cgst,
      sgst,
      igst,
      lineTotal
    };
  });

  const roundedTaxable = money(taxableTotal);
  const roundedCgst = money(cgstTotal);
  const roundedSgst = money(sgstTotal);
  const roundedIgst = money(igstTotal);

  const totalBeforeRoundOff = money(roundedTaxable + roundedCgst + roundedSgst + roundedIgst);
  const roundedGrandTotal = applyRoundOff ? Math.round(totalBeforeRoundOff) : totalBeforeRoundOff;
  const roundOff = money(roundedGrandTotal - totalBeforeRoundOff);

  return {
    items: out,
    taxableTotal: roundedTaxable,
    cgstTotal: roundedCgst,
    sgstTotal: roundedSgst,
    igstTotal: roundedIgst,
    totalTax: money(roundedCgst + roundedSgst + roundedIgst),
    roundOff,
    grandTotal: money(roundedGrandTotal)
  };
}
