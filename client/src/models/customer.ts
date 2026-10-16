/** Customer, prescription and purchase data exchanged with the CRM API. */

// Optical prescription measurements.
// Each value is optional because some prescriptions
// may not contain every measurement.
export type EyeValues = {
  sph?: number;
  cyl?: number;
  axis?: number;
};

// Reusable product information stored with a purchase.
// Catalog IDs are null when products are entered manually.
export type PurchaseProducts = {
  specsType: string | null;
  lensType: string | null;

  // Link products to the Admin Catalog.
  // The backend validates these IDs before saving.
  frameCatalogId?: string | null;
  lensCatalogId?: string | null;
};

// Data sent when registering a new customer.
export type CustomerPayload = {
  name: string;
  mobNumber: string | null;
  gender: "Male" | "Female" | "Other" | null;
  ageAtRecording?: number | null;
  reference: string | null;

  // Private information for shop staff only.
  notes: string | null;

  // Actual purchase date in YYYY-MM-DD format.
  // Null means the date has not been recorded.
  purchaseDate?: string | null;

  // Optical prescription is optional.
  prescription?: {
    re_dist?: EyeValues;
    re_near?: EyeValues;
    le_dist?: EyeValues;
    le_near?: EyeValues;
  };

  // Support two pricing methods.
  // The backend calculates and validates final pricing.
  record:
    | (PurchaseProducts & {
        pricingMode: "SPLIT";
        frameRate: number;
        lensRate: number;
      })
    | (PurchaseProducts & {
        pricingMode: "MRP_ONLY";
        mrp: number;
      });
};

// Minimal response after successful customer creation.
export type CreatedCustomer = {
  id: string;
  name: string;
};

// Prisma Decimal measurements are normally
// serialized as strings in JSON.
export type Prescription = {
  id: string;
  createdAt: string;

  // Right Eye Distance
  reDistSph: string | null;
  reDistCyl: string | null;
  reDistAxis: number | null;

  // Right Eye Near
  reNearSph: string | null;
  reNearCyl: string | null;
  reNearAxis: number | null;

  // Left Eye Distance
  leDistSph: string | null;
  leDistCyl: string | null;
  leDistAxis: number | null;

  // Left Eye Near
  leNearSph: string | null;
  leNearCyl: string | null;
  leNearAxis: number | null;
};

// Every purchase has its own unique record ID.
// Product names are saved as historical snapshots.
// Later catalog edits should not rename past purchases.
export type CustomerRecord = {
  id: string;

  // Prescription linked to this purchase.
  prescriptionId: string | null;

  // Original frame and lens names saved at purchase time.
  specsType: string | null;
  lensType: string | null;

  // Optional links to the Admin Product Catalog.
  // These may be null for older or manually entered data.
  frameCatalogId: string | null;
  lensCatalogId: string | null;

  // Supported pricing methods.
  pricingMode: "SPLIT" | "MRP_ONLY";

  // Amounts returned by Prisma as strings.
  frameRate: string | null;
  lensRate: string | null;
  mrp: string;

  // Actual purchase date returned by the backend.
  // This is separate from createdAt.
  purchaseDate: string | null;

  // Database record creation time.
  createdAt: string;
};

// Small customer summary shown in search results.
// Multiple customers may share the same mobile number.
export type CustomerSummary = {
  id: string;
  name: string;
  mobNumber: string | null;
  gender: string | null;
  createdAt: string;
};

// Complete customer information and history.
export type CustomerDetails = CustomerSummary & {
  // nik - Keep the observation date so recorded age is never presented as today's age.
  ageAtRecording: number | null;
  ageRecordedAt: string | null;
  reference: string | null;

  // Staff-only notes.
  // Never expose these in customer PDFs or WhatsApp.
  notes: string | null;

  updatedAt: string;

  prescriptions: Prescription[];
  records: CustomerRecord[];
};

export type CustomerPersonalUpdate = {
  name: string;
  mobNumber: string | null;
  gender: "Male" | "Female" | "Other" | null;
  ageAtRecording?: number | null;
  reference: string | null;

  // Internal notes are editable by shop staff.
  notes: string | null;
};

// Nullable measurements allow staff to clear
// an existing prescription value.
export type EditableEye = {
  sph?: number | null;
  cyl?: number | null;
  axis?: number | null;
};

export type EditablePrescription = {
  re_dist?: EditableEye;
  re_near?: EditableEye;
  le_dist?: EditableEye;
  le_near?: EditableEye;
};

// Reuse the same pricing and catalog structure
// when editing an existing purchase.
export type EditablePurchase = {
  purchaseDate: string | null;

  record: CustomerPayload["record"];
};
