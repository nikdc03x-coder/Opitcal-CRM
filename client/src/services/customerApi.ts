
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
