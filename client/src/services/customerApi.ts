
export type EyeValues = {
  sph?: number;
  cyl?: number;
  axis?: number;
};

export type CustomerPayload = {
  name: string;
  mobNumber: string | null;
  gender: "Male" | "Female" | "Other" | null;
  reference: string | null;
  notes: string | null;
  prescription?: {
    re_dist?: EyeValues;
    re_near?: EyeValues;
    le_dist?: EyeValues;
    le_near?: EyeValues;
  };
  record:
    | {
        pricingMode: "SPLIT";
        specsType: string | null;
        lensType: string | null;
        frameRate: number;
        lensRate: number;
      }
    | {
        pricingMode: "MRP_ONLY";
        specsType: string | null;
        lensType: string | null;
        mrp: number;
      };
};

type CreatedCustomer = {
  id: string;
  name: string;
};

// The Vite development proxy forwards /api to Express.
// We don't need to hardcode localhost:5000 here.
export async function createCustomer(
  payload: CustomerPayload
): Promise<CreatedCustomer> {
  const response = await fetch("/api/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  // Read the response safely, including error responses.
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success || !result?.data?.id) {
    throw new Error(
      result?.message || "Unable to save customer. Please try again."
    );
  }

  return result.data as CreatedCustomer;
}

// -----------------------------------------------------
// CUSTOMER SEARCH AND DETAILS
// -----------------------------------------------------

// Prisma decimal values are usually returned as strings.
export type Prescription = {
  id: string;
  createdAt: string;
  reDistSph: string | null;
  reDistCyl: string | null;
  reDistAxis: number | null;
  reNearSph: string | null;
  reNearCyl: string | null;
  reNearAxis: number | null;
  leDistSph: string | null;
  leDistCyl: string | null;
  leDistAxis: number | null;
  leNearSph: string | null;
  leNearCyl: string | null;
  leNearAxis: number | null;
};

export type CustomerRecord = {
  id: string;
  prescriptionId: string | null;
  specsType: string | null;
  lensType: string | null;
  pricingMode: "SPLIT" | "MRP_ONLY";
  frameRate: string | null;
  lensRate: string | null;
  mrp: string;
  createdAt: string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  mobNumber: string | null;
  gender: string | null;
  createdAt: string;
};

export type CustomerDetails = CustomerSummary & {
  reference: string | null;
  notes: string | null;
  updatedAt: string;
  prescriptions: Prescription[];
  records: CustomerRecord[];
};

// Shared function for reading the API response.
// It provides a useful error when the backend is unavailable.
async function readResponse<T>(
  response: Response
): Promise<T> {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(
      result?.message || "Unable to load customer information."
    );
  }

  return result.data as T;
}

// Search by partial name or mobile number.
// Numeric input is treated as a phone search.
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

  const response = await fetch(
    `/api/customers${query ? `?${query}` : ""}`,
    { signal }
  );

  return readResponse<CustomerSummary[]>(response);
}

// Retrieve a complete customer record using its UUID.
export async function getCustomer(
  id: string,
  signal?: AbortSignal
): Promise<CustomerDetails> {
  const response = await fetch(
    `/api/customers/${encodeURIComponent(id)}`,
    { signal }
  );

  return readResponse<CustomerDetails>(response);
}
