
/**
 * Customer API Service
 *
 * Handles communication between the React frontend
 * and the Express backend.
 *
 * nik - Keep API types and requests in one place.
 */

// -----------------------------------------------------
// 1. CUSTOMER CREATION TYPES
// -----------------------------------------------------

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

  // nik - Link products to the Admin Catalog.
  // The backend validates these IDs before saving.
  frameCatalogId?: string | null;
  lensCatalogId?: string | null;
};

// Data sent when registering a new customer.
export type CustomerPayload = {
  name: string;
  mobNumber: string | null;
  gender: "Male" | "Female" | "Other" | null;
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

  // nik - Support two pricing methods.
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

// -----------------------------------------------------
// 2. SHARED API RESPONSE HANDLER
// -----------------------------------------------------

// Read JSON safely and display useful error messages.
async function readResponse<T>(
  response: Response
): Promise<T> {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message ||
        `Request failed (${response.status}). Please try again.`
    );
  }

  return result.data as T;
}

// nik - Send the Admin session cookie with every customer request.
// Keep this in one place instead of repeating it in each API function.
function apiFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, credentials: "include" });
}

// -----------------------------------------------------
// 3. CREATE CUSTOMER
// -----------------------------------------------------

// Vite forwards /api requests to the Express server.
// No hardcoded backend address is required.
export async function createCustomer(
  payload: CustomerPayload
): Promise<CreatedCustomer> {
  const response = await apiFetch("/api/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const customer =
    await readResponse<CreatedCustomer>(response);

  // Confirm the backend returned a unique customer ID.
  if (!customer?.id) {
    throw new Error(
      "Customer was saved, but the server did not return a customer ID."
    );
  }

  return customer;
}

// -----------------------------------------------------
// 4. CUSTOMER DETAILS TYPES
// -----------------------------------------------------

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

// -----------------------------------------------------
// 5. HISTORICAL PURCHASE RECORD
// -----------------------------------------------------

// nik - Every purchase has its own unique record ID.
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

// -----------------------------------------------------
// 6. CUSTOMER SEARCH AND DETAILS
// -----------------------------------------------------

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
  reference: string | null;

  // Staff-only notes.
  // Never expose these in customer PDFs or WhatsApp.
  notes: string | null;

  updatedAt: string;

  prescriptions: Prescription[];
  records: CustomerRecord[];
};

// -----------------------------------------------------
// 7. SEARCH CUSTOMERS
// -----------------------------------------------------

// Search using a name or partial mobile number.
// Customer records are always identified by UUID.
export async function searchCustomers(
  search: string,
  signal?: AbortSignal
): Promise<CustomerSummary[]> {
  const value = search.trim();

  const params = new URLSearchParams();

  if (value) {
    if (/^\d+$/.test(value)) {
      params.set("phone", value);
    } else {
      params.set("name", value);
    }
  }

  const query = params.toString();

  const response = await apiFetch(
    `/api/customers${query ? `?${query}` : ""}`,
    {
      signal,
    }
  );

  return readResponse<CustomerSummary[]>(response);
}

// -----------------------------------------------------
// 8. GET CUSTOMER DETAILS
// -----------------------------------------------------

// Retrieve the selected customer by unique ID,
// never by their mobile number.
export async function getCustomer(
  id: string,
  signal?: AbortSignal
): Promise<CustomerDetails> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(id)}`,
    {
      signal,
    }
  );

  return readResponse<CustomerDetails>(response);
}

// -----------------------------------------------------
// 9. UPDATE CUSTOMER PERSONAL INFORMATION
// -----------------------------------------------------

export type CustomerPersonalUpdate = {
  name: string;
  mobNumber: string | null;
  gender: "Male" | "Female" | "Other" | null;
  reference: string | null;

  // Internal notes are editable by shop staff.
  notes: string | null;
};

// Update only the selected customer's personal details.
// Purchase history is edited through separate endpoints.
export async function updateCustomer(
  id: string,
  changes: CustomerPersonalUpdate
): Promise<CustomerDetails> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    }
  );

  return readResponse<CustomerDetails>(response);
}

// -----------------------------------------------------
// 10. HISTORICAL PRESCRIPTION EDITING TYPES
// -----------------------------------------------------

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

// -----------------------------------------------------
// 11. HISTORICAL PURCHASE EDITING TYPES
// -----------------------------------------------------

// Reuse the same pricing and catalog structure
// when editing an existing purchase.
export type EditablePurchase = {
  purchaseDate: string | null;

  record: CustomerPayload["record"];
};

// -----------------------------------------------------
// 12. UPDATE ONE HISTORICAL PURCHASE
// -----------------------------------------------------

// Update exactly one purchase using the customer ID
// and the selected purchase record ID.
// Other historical purchases remain unchanged.
export async function updatePurchase(
  customerId: string,
  recordId: string,
  changes: EditablePurchase
): Promise<CustomerRecord> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/records/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    }
  );

  return readResponse<CustomerRecord>(response);
}

// -----------------------------------------------------
// 13. UPDATE ONE HISTORICAL PRESCRIPTION
// -----------------------------------------------------

// Update exactly one prescription by its ID.
// Other saved prescriptions are not modified.
export async function updatePrescription(
  customerId: string,
  prescriptionId: string,
  changes: EditablePrescription
): Promise<Prescription> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/prescriptions/${encodeURIComponent(prescriptionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    }
  );

  return readResponse<Prescription>(response);
}
