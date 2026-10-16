
/**
 * Optical CRM — Customer Documents
 *
 * nik - Create professional purchase receipts and prescriptions.
 * nik - Keep printing, PDF and WhatsApp sharing in one place.
 * nik - Never include private staff notes in customer documents.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import type {
  CustomerDetails,
  CustomerRecord,
  Prescription,
} from "../services/customerApi";

// -----------------------------------------------------
// 1. SHOP SETTINGS
// -----------------------------------------------------

const SHOP_NAME = "हर्षु चश्मा घर";
const SHOP_NAME_ENGLISH = "Harshu Chashma Ghar";

type DocumentType = "receipt" | "prescription";

// -----------------------------------------------------
// 2. FORMATTING HELPERS
// -----------------------------------------------------

// nik - Escape values before inserting them into HTML.
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  return String(value);
}

// nik - Format prices in Indian rupees.
function money(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "Not recorded";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Not recorded";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// nik - Display dates without timezone-related day changes.
function dateText(
  value: string | null | undefined
): string {
  if (!value) return "Not recorded";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) return "Not recorded";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// nik - Show eye power with + or - signs.
function power(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  const safeAmount = Object.is(amount, -0) ? 0 : amount;

  return `${safeAmount > 0 ? "+" : ""}${safeAmount.toFixed(2)}`;
}

// nik - Keep optical axis values simple.
function axis(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

// -----------------------------------------------------
// 3. REUSABLE DOCUMENT ELEMENTS
// -----------------------------------------------------

function detailRow(
  label: string,
  value: unknown
): string {
  return `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <strong class="detail-value">${escapeHtml(display(value))}</strong>
    </div>
  `;
}

function sectionHeading(
  number: string,
  title: string
): string {
  return `
    <div class="section-heading">
      <span class="section-number">${escapeHtml(number)}</span>
      <h2>${escapeHtml(title)}</h2>
    </div>
  `;
}

// nik - Keep personal information compact and readable.
function personalInfoHtml(
  customer: CustomerDetails
): string {
  return `
    <section class="document-section">
      ${sectionHeading("01", "Customer Information")}

      <div class="customer-panel">
        <div class="customer-name">
          ${escapeHtml(customer.name)}
        </div>

        <div class="customer-meta">
          ${detailRow("Mobile Number", customer.mobNumber)}
          ${detailRow("Gender", customer.gender)}
          ${detailRow("Reference", customer.reference)}
          ${detailRow("Registered On", dateText(customer.createdAt))}
        </div>
      </div>
    </section>
  `;
}

// -----------------------------------------------------
// 4. PURCHASE INFORMATION
// -----------------------------------------------------

function purchaseDetailsHtml(
  record: CustomerRecord
): string {
  const splitPricing = record.pricingMode === "SPLIT";

  const frameName =
    record.specsType?.trim() || "Not specified";

  const lensName =
    record.lensType?.trim() || "Not specified";

  return `
    <section class="document-section">
      ${sectionHeading("02", "Purchase Summary")}

      <div class="section-meta">
        Purchase Date:
        <strong>${escapeHtml(dateText(record.purchaseDate))}</strong>
      </div>

      <table class="purchase-table">
        <thead>
          <tr>
            <th>Purchased Item</th>
            <th>Description</th>
            ${splitPricing ? '<th class="amount-cell">Rate</th>' : ""}
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Frame / Spectacle</td>
            <td>${escapeHtml(frameName)}</td>
            ${
              splitPricing
                ? `<td class="amount-cell">${escapeHtml(money(record.frameRate))}</td>`
                : ""
            }
          </tr>

          <tr>
            <td>Lens</td>
            <td>${escapeHtml(lensName)}</td>
            ${
              splitPricing
                ? `<td class="amount-cell">${escapeHtml(money(record.lensRate))}</td>`
                : ""
            }
          </tr>
        </tbody>
      </table>

      <div class="total-bar">
        <div>
          <span class="total-label">TOTAL PURCHASE VALUE</span>
          <small>Recorded MRP</small>
        </div>

        <strong>${escapeHtml(money(record.mrp))}</strong>
      </div>
    </section>
  `;
}

// -----------------------------------------------------
// 5. OPTICAL PRESCRIPTION
// -----------------------------------------------------

/**
 * nik - Display measurements in this exact shop order:
 *
 * RE DIST
 * RE NEAR
 * LE DIST
 * LE NEAR
 *
 * Each row includes SPH, CYL and AXIS.
 */
function prescriptionTableHtml(
  prescription: Prescription,
  sectionNumber = "03"
): string {
  const measurements = [
    {
      label: "RE DIST",
      description: "Right Eye Distance",
      sph: prescription.reDistSph,
      cyl: prescription.reDistCyl,
      axis: prescription.reDistAxis,
    },
    {
      label: "RE NEAR",
      description: "Right Eye Near",
      sph: prescription.reNearSph,
      cyl: prescription.reNearCyl,
      axis: prescription.reNearAxis,
    },
    {
      label: "LE DIST",
      description: "Left Eye Distance",
      sph: prescription.leDistSph,
      cyl: prescription.leDistCyl,
      axis: prescription.leDistAxis,
    },
    {
      label: "LE NEAR",
      description: "Left Eye Near",
      sph: prescription.leNearSph,
      cyl: prescription.leNearCyl,
      axis: prescription.leNearAxis,
    },
  ];

  const rows = measurements
    .map(
      (item) => `
        <tr>
          <td class="eye-label">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.description)}</small>
          </td>

          <td class="power-cell">
            ${escapeHtml(power(item.sph))}
          </td>

          <td class="power-cell">
            ${escapeHtml(power(item.cyl))}
          </td>

          <td class="power-cell">
            ${escapeHtml(axis(item.axis))}
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <section class="document-section prescription-section">
      ${sectionHeading(sectionNumber, "Optical Prescription")}

      <div class="section-meta">
        Prescription Date:
        <strong>${escapeHtml(dateText(prescription.createdAt))}</strong>
      </div>

      <div class="prescription-table-wrapper">
        <table class="optical-prescription-table">
          <thead>
            <tr>
              <th>Eye / Vision</th>
              <th>SPH</th>
              <th>CYL</th>
              <th>AXIS</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <p class="rx-footnote">
        RE = Right Eye &nbsp; · &nbsp;
        LE = Left Eye &nbsp; · &nbsp;
        DIST = Distance &nbsp; · &nbsp;
        NEAR = Near
      </p>
    </section>
  `;
}

// -----------------------------------------------------
// 6. COMPLETE DOCUMENT LAYOUT
// -----------------------------------------------------

function documentHtml(
  title: string,
  customer: CustomerDetails,
  content: string
): string {
  // nik - Staff-only notes are intentionally excluded.
  return `
    <div class="customer-document">
      <header class="document-header">
        <div class="brand">
          <div class="brand-hindi">
            ${escapeHtml(SHOP_NAME)}
          </div>

          <div class="brand-english">
            ${escapeHtml(SHOP_NAME_ENGLISH)}
          </div>
        </div>

        <div class="document-identity">
          <span class="document-kicker">
            CUSTOMER DOCUMENT
          </span>

          <h1>${escapeHtml(title)}</h1>
        </div>
      </header>

      ${personalInfoHtml(customer)}

      ${content}

      <footer class="document-footer">
        <p>Thank you for choosing ${escapeHtml(SHOP_NAME_ENGLISH)}.</p>
        <p class="legal-note">
          Customer record summary.
          Not a tax invoice or proof of payment.
        </p>
      </footer>
    </div>
  `;
}

// -----------------------------------------------------
// 7. MODERN PRINT AND PDF STYLING
// -----------------------------------------------------

/**
 * nik - Minimal and readable document design.
 *
 * Uses white, charcoal and soft gray.
 * Styles are scoped to customer-document only.
 * The normal CRM application UI is unaffected.
 */
const documentCss = `
  .customer-document,
  .customer-document * {
    box-sizing: border-box;
  }

  .customer-document {
    width: 100%;
    max-width: 794px;
    margin: 0 auto;
    padding: 36px 42px;
    background: #ffffff;
    color: #111827;
    font-family:
      Arial,
      "Noto Sans Devanagari",
      "Mangal",
      sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }

  /* Header */

  .customer-document .document-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    border-bottom: 2px solid #111827;
    padding-bottom: 20px;
    margin-bottom: 26px;
  }

  .customer-document .brand {
    min-width: 0;
  }

  .customer-document .brand-hindi {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.35;
  }

  .customer-document .brand-english {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
  }

  .customer-document .document-identity {
    text-align: right;
  }

  .customer-document .document-kicker {
    color: #6b7280;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
  }

  .customer-document h1 {
    margin: 6px 0 0;
    font-size: 20px;
    font-weight: 800;
    line-height: 1.3;
  }

  /* Sections */

  .customer-document .document-section {
    margin-bottom: 26px;
  }

  .customer-document .section-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .customer-document .section-number {
    display: inline-block;
    padding: 4px 8px;
    border: 1px solid #d1d5db;
    border-radius: 5px;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
  }

  .customer-document h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
  }

  /* Personal information */

  .customer-document .customer-panel {
    padding: 16px 18px;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
  }

  .customer-document .customer-name {
    padding-bottom: 12px;
    margin-bottom: 8px;
    border-bottom: 1px solid #e5e7eb;
    font-size: 18px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .customer-document .customer-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 22px;
  }

  .customer-document .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    min-width: 0;
  }

  .customer-document .detail-label {
    color: #6b7280;
  }

  .customer-document .detail-value {
    text-align: right;
    overflow-wrap: anywhere;
  }

  /* Purchase information */

  .customer-document .section-meta {
    margin: 0 0 12px;
    font-size: 12px;
    color: #6b7280;
  }

  .customer-document .section-meta strong {
    color: #111827;
  }

  .customer-document table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .customer-document th,
  .customer-document td {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .customer-document thead th {
    background: #f3f4f6;
    color: #374151;
    font-size: 11px;
    font-weight: 800;
  }

  .customer-document .purchase-table {
    border: 1px solid #e5e7eb;
  }

  .customer-document .purchase-table td:first-child,
  .customer-document .purchase-table th:first-child {
    width: 29%;
  }

  .customer-document .amount-cell {
    text-align: right;
    width: 24%;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .customer-document .total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
    padding: 16px 18px;
    border: 1px solid #e5e7eb;
    border-radius: 9px;
    background: #f3f4f6;
  }

  .customer-document .total-label {
    display: block;
    color: #4b5563;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .customer-document .total-bar small {
    display: block;
    margin-top: 3px;
    color: #6b7280;
  }

  .customer-document .total-bar > strong {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Optical prescription */

  .customer-document .prescription-table-wrapper {
    width: 100%;
    margin-top: 14px;
  }

  .customer-document .optical-prescription-table {
    border: 1px solid #e5e7eb;
    font-variant-numeric: tabular-nums;
  }

  .customer-document .optical-prescription-table th {
    text-align: center;
  }

  .customer-document .optical-prescription-table th:first-child {
    text-align: left;
    width: 34%;
  }

  .customer-document .optical-prescription-table td {
    text-align: center;
    vertical-align: middle;
  }

  .customer-document .optical-prescription-table td:first-child {
    text-align: left;
  }

  .customer-document .eye-label strong {
    display: block;
    font-size: 12px;
    font-weight: 800;
  }

  .customer-document .eye-label small {
    display: block;
    margin-top: 4px;
    color: #6b7280;
    font-size: 10px;
  }

  .customer-document .power-cell {
    font-family: Arial, monospace;
    font-size: 14px;
    font-weight: 700;
    text-align: center;
  }

  .customer-document .optical-prescription-table tr:nth-child(even) {
    background: #fafafa;
  }

  .customer-document .optical-prescription-table tr:nth-child(3) td {
    border-top: 2px solid #d1d5db;
  }

  .customer-document .rx-footnote {
    margin: 10px 0 0;
    color: #6b7280;
    font-size: 11px;
  }

  /* Footer */

  .customer-document .document-footer {
    margin-top: 32px;
    padding-top: 15px;
    border-top: 1px solid #d1d5db;
    text-align: center;
    font-size: 11px;
    color: #4b5563;
  }

  .customer-document .document-footer p {
    margin: 4px 0;
  }

  .customer-document .legal-note {
    color: #9ca3af;
    font-size: 10px;
  }

  /* Printing */

  @media print {
    @page {
      size: A4;
      margin: 12mm;
    }

    .customer-document {
      max-width: none;
      padding: 0;
      print-color-adjust: exact;
    }

    .customer-document .document-section,
    .customer-document .optical-prescription-table,
    .customer-document .optical-prescription-table tr {
      break-inside: avoid;
    }
  }
`;

// -----------------------------------------------------
// 8. RECEIPT AND PRESCRIPTION DOCUMENTS
// -----------------------------------------------------

// nik - Include an associated prescription only if selected.
export function receiptHtml(
  customer: CustomerDetails,
  record: CustomerRecord,
  prescription?: Prescription | null
): string {
  const purchase = purchaseDetailsHtml(record);

  const prescriptionSection = prescription
    ? prescriptionTableHtml(prescription, "03")
    : "";

  return documentHtml(
    "Purchase Receipt",
    customer,
    purchase + prescriptionSection
  );
}

// nik - Print a prescription independently from purchases.
export function prescriptionHtml(
  customer: CustomerDetails,
  prescription: Prescription
): string {
  return documentHtml(
    "Optical Prescription",
    customer,
    prescriptionTableHtml(prescription, "02")
  );
}

// -----------------------------------------------------
// 9. PRINT DOCUMENT
// -----------------------------------------------------

export function printDocument(
  content: string,
  title: string
): void {
  const popup = window.open("", "_blank");

  if (!popup) {
    throw new Error(
      "Print window blocked. Please allow pop-ups."
    );
  }

  popup.document.open();

  popup.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            margin: 0;
            background: white;
          }
          ${documentCss}
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `);

  popup.document.close();
  popup.focus();

  // nik - Allow font loading before opening print settings.
  void popup.document.fonts.ready
    .then(() => {
      if (!popup.closed) popup.print();
    })
    .catch(() => {
      if (!popup.closed) popup.print();
    });
}

// -----------------------------------------------------
// 10. GENERATE PDF
// -----------------------------------------------------

export async function createPdf(
  content: string
): Promise<Blob> {
  const wrapper = document.createElement("div");

  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "794px";
  wrapper.style.background = "#ffffff";
  wrapper.style.pointerEvents = "none";

  const style = document.createElement("style");
  style.textContent = documentCss;

  const sheet = document.createElement("div");
  sheet.innerHTML = content;

  wrapper.appendChild(style);
  wrapper.appendChild(sheet);
  document.body.appendChild(wrapper);

  try {
    await document.fonts.ready;

    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: false,
      logging: false,
    });

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Unable to render the document.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imageWidth = pageWidth;
    const imageHeight =
      (canvas.height * imageWidth) / canvas.width;

    const image = canvas.toDataURL("image/png");

    let remainingHeight = imageHeight;
    let imagePosition = 0;

    // nik - First A4 page.
    pdf.addImage(
      image,
      "PNG",
      0,
      imagePosition,
      imageWidth,
      imageHeight
    );

    remainingHeight -= pageHeight;

    // nik - Add extra pages for longer documents.
    while (remainingHeight > 0) {
      imagePosition -= pageHeight;
      pdf.addPage();

      pdf.addImage(
        image,
        "PNG",
        0,
        imagePosition,
        imageWidth,
        imageHeight
      );

      remainingHeight -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    wrapper.remove();
  }
}

// -----------------------------------------------------
// 11. SAVE AND SHARE PDF
// -----------------------------------------------------

export function savePdf(
  blob: Blob,
  filename: string
): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30_000);
}

// nik - Use native sharing when supported.
// Otherwise download PDF for manual sharing.
export async function shareOrDownloadPdf(
  content: string,
  filename: string,
  type: DocumentType
): Promise<"shared" | "downloaded"> {
  const blob = await createPdf(content);

  const file = new File([blob], filename, {
    type: "application/pdf",
  });

  const shareData: ShareData = {
    title:
      type === "receipt"
        ? "Purchase Receipt"
        : "Optical Prescription",
    files: [file],
  };

  if (
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(shareData)
  ) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        throw new Error("Sharing cancelled.");
      }
    }
  }

  savePdf(blob, filename);
  return "downloaded";
}

// -----------------------------------------------------
// 12. WHATSAPP HELPERS
// -----------------------------------------------------

function whatsappNumber(
  mobile: string | null | undefined
): string {
  const digits = (mobile ?? "").replace(/\D/g, "");

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  throw new Error(
    "Please enter a valid Indian customer mobile number."
  );
}

// nik - Show prescription measurements in correct order.
function whatsappPrescriptionText(
  prescription: Prescription
): string[] {
  return [
    "",
    "*OPTICAL PRESCRIPTION*",
    `Prescription Date: ${dateText(prescription.createdAt)}`,
    "",
    "Eye | SPH | CYL | AXIS",
    `RE DIST | ${power(prescription.reDistSph)} | ${power(prescription.reDistCyl)} | ${axis(prescription.reDistAxis)}`,
    `RE NEAR | ${power(prescription.reNearSph)} | ${power(prescription.reNearCyl)} | ${axis(prescription.reNearAxis)}`,
    `LE DIST | ${power(prescription.leDistSph)} | ${power(prescription.leDistCyl)} | ${axis(prescription.leDistAxis)}`,
    `LE NEAR | ${power(prescription.leNearSph)} | ${power(prescription.leNearCyl)} | ${axis(prescription.leNearAxis)}`,
  ];
}

// -----------------------------------------------------
// 13. WHATSAPP RECEIPT MESSAGE
// -----------------------------------------------------

export function whatsappReceiptMessage(
  customer: CustomerDetails,
  record: CustomerRecord,
  prescription?: Prescription | null
): string {
  const message: string[] = [
    `Hello ${customer.name},`,
    "",
    `Thank you for shopping with ${SHOP_NAME}!`,
    "",
    "*CUSTOMER INFORMATION*",
    `Name: ${display(customer.name)}`,
    `Mobile: ${display(customer.mobNumber)}`,
    `Gender: ${display(customer.gender)}`,
    `Reference: ${display(customer.reference)}`,
    `Registered: ${dateText(customer.createdAt)}`,
    "",
    "*PURCHASE DETAILS*",
    `Purchase Date: ${dateText(record.purchaseDate)}`,
    `Frame: ${display(record.specsType)}`,
    `Lens: ${display(record.lensType)}`,
  ];

  if (record.pricingMode === "SPLIT") {
    message.push(
      `Frame Rate: ${money(record.frameRate)}`,
      `Lens Rate: ${money(record.lensRate)}`
    );
  }

  message.push(
    `*Total Purchase MRP: ${money(record.mrp)}*`
  );

  if (prescription) {
    message.push(
      ...whatsappPrescriptionText(prescription)
    );
  }

  message.push(
    "",
    "Thank you for choosing us!",
    SHOP_NAME_ENGLISH,
    "",
    "Note: Purchase MRP is not proof of payment."
  );

  return message.join("\n");
}

// -----------------------------------------------------
// 14. OPEN WHATSAPP CHAT
// -----------------------------------------------------

export function openCustomerWhatsApp(
  mobile: string | null,
  message: string
): void {
  const number = whatsappNumber(mobile);

  const url =
    `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
