/**
 * Optical CRM — Customer Documents
 *
 * Create professional purchase receipts and prescriptions.
 * Keep printing, PDF and WhatsApp sharing in one place.
 * Never include private staff notes in customer documents.
 */

import { type CustomerDetails, type CustomerRecord, type Prescription } from "../models/customer";

const SHOP_NAME = "हर्षु चश्मा घर";
const SHOP_NAME_ENGLISH = "Harshu Chashma Ghar";

type DocumentType = "receipt" | "prescription";

// Escape values before inserting them into HTML.
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

// Format prices in Indian rupees.
function money(value: string | number | null | undefined): string {
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

// Display dates without timezone-related day changes.
function dateText(value: string | null | undefined): string {
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

// Show eye power with + or - signs.
function power(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  const safeAmount = Object.is(amount, -0) ? 0 : amount;

  return `${safeAmount > 0 ? "+" : ""}${safeAmount.toFixed(2)}`;
}

// Keep optical axis values simple.
function axis(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function detailRow(label: string, value: unknown): string {
  return `
    <div class="detail-row">
      <span class="detail-label">${escapeHtml(label)}</span>
      <strong class="detail-value">${escapeHtml(display(value))}</strong>
    </div>
  `;
}

function sectionHeading(number: string, title: string): string {
  return `
    <div class="section-heading">
      <span class="section-number">${escapeHtml(number)}</span>
      <h2>${escapeHtml(title)}</h2>
    </div>
  `;
}

// Keep personal information compact and readable.
function personalInfoHtml(customer: CustomerDetails): string {
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

function purchaseDetailsHtml(record: CustomerRecord): string {
  const splitPricing = record.pricingMode === "SPLIT";

  const frameName = record.specsType?.trim() || "Not specified";

  const lensName = record.lensType?.trim() || "Not specified";

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

/**
 * Display measurements in this exact shop order:
 *
 * RE DIST
 * RE NEAR
 * LE DIST
 * LE NEAR
 *
 * Each row includes SPH, CYL and AXIS.
 */
function prescriptionTableHtml(prescription: Prescription, sectionNumber = "03"): string {
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
      `,
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

function documentHtml(title: string, customer: CustomerDetails, content: string): string {
  // Staff-only notes are intentionally excluded.
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

/**
 * Minimal and readable document design.
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

// Include an associated prescription only if selected.
export function receiptHtml(
  customer: CustomerDetails,
  record: CustomerRecord,
  prescription?: Prescription | null,
): string {
  const purchase = purchaseDetailsHtml(record);

  const prescriptionSection =
    prescription &&
    prescription.id === record.prescriptionId &&
    customer.prescriptions.some((rx) => rx.id === prescription.id)
      ? prescriptionTableHtml(prescription, "03")
      : "";

  return documentHtml("Purchase Receipt", customer, purchase + prescriptionSection);
}

// Print a prescription independently from purchases.
export function prescriptionHtml(customer: CustomerDetails, prescription: Prescription): string {
  return documentHtml("Optical Prescription", customer, prescriptionTableHtml(prescription, "02"));
}

export function printDocument(content: string, title: string): void {
  const popup = window.open("", "_blank");

  if (!popup) {
    throw new Error("Print window blocked. Please allow pop-ups.");
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

  // Allow font loading before opening print settings.
  void popup.document.fonts.ready
    .then(() => {
      if (!popup.closed) popup.print();
    })
    .catch(() => {
      if (!popup.closed) popup.print();
    });
}

/**
 * Generate a clean multipage A4 PDF.
 *
 * This version:
 * - Keeps 12 mm margins on every page.
 * - Tries to keep document sections together.
 * - Prevents long documents from overflowing A4.
 * - Preserves the existing receipt and prescription design.
 * - Runs entirely in the browser.
 */
export async function createPdf(content: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  // Build the document off-screen without changing the CRM page.
  const wrapper = document.createElement("div");

  Object.assign(wrapper.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "794px",
    background: "#ffffff",
    pointerEvents: "none",
  });

  const style = document.createElement("style");
  style.textContent = documentCss;

  const sheet = document.createElement("div");
  sheet.innerHTML = content;

  wrapper.appendChild(style);
  wrapper.appendChild(sheet);
  document.body.appendChild(wrapper);

  try {
    // Wait until available fonts finish loading.
    await document.fonts.ready;

    const documentElement = sheet.querySelector<HTMLElement>(".customer-document");

    if (!documentElement) {
      throw new Error("Customer document could not be prepared.");
    }

    // Capture the full document once.
    const canvas = await html2canvas(documentElement, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: false,
      logging: false,
      scrollX: 0,
      scrollY: 0,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("PDF rendering produced an empty document.");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Reserve equal margins on all A4 pages.
    const margin = 12;

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;

    // Convert A4 page height to captured canvas pixels.
    const pixelsPerMm = canvas.width / contentWidth;
    const maxPagePixels = Math.floor(contentHeight * pixelsPerMm);

    // Find document section boundaries to avoid cutting them.
    const documentRect = documentElement.getBoundingClientRect();

    const scale = canvas.width / documentRect.width;

    const sections = Array.from(
      documentElement.querySelectorAll<HTMLElement>(
        ".document-header, .document-section, .document-footer",
      ),
    );

    const boundaries = sections
      .map((section) => {
        const rect = section.getBoundingClientRect();

        return {
          start: Math.max(0, Math.round((rect.top - documentRect.top) * scale)),
          end: Math.min(canvas.height, Math.round((rect.bottom - documentRect.top) * scale)),
        };
      })
      .filter((section) => section.end > section.start);

    let currentY = 0;
    let pageNumber = 0;

    while (currentY < canvas.height) {
      let nextY = Math.min(currentY + maxPagePixels, canvas.height);

      // Move a page break before a section when possible.
      if (nextY < canvas.height) {
        const crossingSection = boundaries.find(
          (section) => section.start < nextY && section.end > nextY,
        );

        if (crossingSection) {
          const sectionHeight = crossingSection.end - crossingSection.start;

          const heightBeforeSection = crossingSection.start - currentY;

          // Move the entire section to the next page only
          // when the section fits and enough space was used.
          if (sectionHeight <= maxPagePixels && heightBeforeSection > maxPagePixels * 0.3) {
            nextY = crossingSection.start;
          }
        }
      }

      // Always make progress, including for oversized sections.
      if (nextY <= currentY) {
        nextY = Math.min(currentY + maxPagePixels, canvas.height);
      }

      const sliceHeight = nextY - currentY;

      // Crop only the content belonging to this A4 page.
      const pageCanvas = document.createElement("canvas");

      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const context = pageCanvas.getContext("2d");

      if (!context) {
        throw new Error("Could not prepare the PDF page.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      context.drawImage(
        canvas,
        0,
        currentY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const imageData = pageCanvas.toDataURL("image/png");

      const imageHeightMm = sliceHeight / pixelsPerMm;

      if (pageNumber > 0) {
        pdf.addPage();
      }

      pdf.addImage(imageData, "PNG", margin, margin, contentWidth, imageHeightMm);

      currentY = nextY;
      pageNumber += 1;
    }

    return pdf.output("blob");
  } catch (error) {
    // Make PDF failures understandable to staff.
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Unable to generate the PDF. Please try again.", { cause: error });
  } finally {
    // Always remove the temporary document.
    wrapper.remove();
  }
}

export function savePdf(blob: Blob, filename: string): void {
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

// Use native sharing when supported.
// Otherwise download PDF for manual sharing.
export async function shareOrDownloadPdf(
  content: string,
  filename: string,
  type: DocumentType,
): Promise<"shared" | "downloaded"> {
  const blob = await createPdf(content);

  const file = new File([blob], filename, {
    type: "application/pdf",
  });

  const shareData: ShareData = {
    title: type === "receipt" ? "Purchase Receipt" : "Optical Prescription",
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
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Sharing cancelled.", { cause: error });
      }
    }
  }

  savePdf(blob, filename);
  return "downloaded";
}

// Check whether the browser natively supports sharing PDF files (e.g. mobile share sheet).
export function canShareFilesDirectly(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  ) {
    return false;
  }
  try {
    const dummyFile = new File([""], "test.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}

// Normalize phone numbers for Indian WhatsApp:
// - Strips spaces, dashes, parentheses, non-digits
// - Strips international prefix '00' or trunk prefix '0'
// - Prepends 91 to 10-digit Indian numbers starting with 6-9
// - Preserves valid 12-digit Indian numbers starting with 91[6-9]
// - Returns null if missing or invalid
export function normalizeWhatsAppNumber(mobile: string | null | undefined): string | null {
  if (!mobile) return null;
  let digits = mobile.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (/^0[6-9]\d{9}$/.test(digits)) {
    digits = digits.slice(1);
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;
}

export function whatsappNumber(mobile: string | null | undefined): string {
  const normalized = normalizeWhatsAppNumber(mobile);
  if (normalized) {
    return normalized;
  }
  throw new Error("Please enter a valid Indian customer mobile number.");
}

// Standard WhatsApp bill delivery message with customer name and shop branding.
export function buildWhatsAppBillMessage(customerName: string): string {
  const name = customerName.trim() || "Customer";
  return `Hello ${name},

Greetings from Harshu Chasma Ghar.

Please find your purchase bill attached.

Thank you for choosing Harshu Chasma Ghar.`;
}

// Standard WhatsApp click-to-chat API URL format.
export function buildWhatsAppBillUrl(phone: string, customerName: string): string {
  const message = buildWhatsAppBillMessage(customerName);
  return `https://api.whatsapp.com/send/?phone=${phone}&text=${encodeURIComponent(message)}`;
}

// Show prescription measurements in correct order.
function whatsappPrescriptionText(prescription: Prescription): string[] {
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

export function whatsappReceiptMessage(
  customer: CustomerDetails,
  record: CustomerRecord,
  prescription?: Prescription | null,
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
    message.push(`Frame Rate: ${money(record.frameRate)}`, `Lens Rate: ${money(record.lensRate)}`);
  }

  message.push(`*Total Purchase MRP: ${money(record.mrp)}*`);

  if (
    prescription &&
    prescription.id === record.prescriptionId &&
    customer.prescriptions.some((rx) => rx.id === prescription.id)
  ) {
    message.push(...whatsappPrescriptionText(prescription));
  }

  message.push(
    "",
    "Thank you for choosing us!",
    SHOP_NAME_ENGLISH,
    "",
    "Note: Purchase MRP is not proof of payment.",
  );

  return message.join("\n");
}

export function openCustomerWhatsApp(
  mobile: string | null | undefined,
  message: string,
  targetWindow?: Window | null,
): void {
  const number = normalizeWhatsAppNumber(mobile);
  if (!number) {
    throw new Error("Please enter a valid Indian customer mobile number.");
  }

  const url = `https://api.whatsapp.com/send/?phone=${number}&text=${encodeURIComponent(message)}`;

  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.href = url;
    return;
  }

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
