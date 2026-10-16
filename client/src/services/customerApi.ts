import type {
  CustomerPayload,
  CreatedCustomer,
  Prescription,
  CustomerRecord,
  CustomerSummary,
  CustomerDetails,
  CustomerPersonalUpdate,
  EditablePrescription,
  EditablePurchase,
} from "../models/customer";

import { apiFetch } from "./http";

// Read JSON safely and display useful error messages.
async function readResponse<T>(response: Response): Promise<T> {
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Request failed (${response.status}). Please try again.`);
  }

  return result.data as T;
}

// Vite forwards /api requests to the Express server.
// No hardcoded backend address is required.
export async function createCustomer(payload: CustomerPayload): Promise<CreatedCustomer> {
  const response = await apiFetch("/api/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const customer = await readResponse<CreatedCustomer>(response);

  // Confirm the backend returned a unique customer ID.
  if (!customer?.id) {
    throw new Error("Customer was saved, but the server did not return a customer ID.");
  }

  return customer;
}

// Search using a name or partial mobile number.
// Customer records are always identified by UUID.
export async function searchCustomers(
  search: string,
  signal?: AbortSignal,
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

  const response = await apiFetch(`/api/customers${query ? `?${query}` : ""}`, {
    signal,
  });

  return readResponse<CustomerSummary[]>(response);
}

// Retrieve the selected customer by unique ID,
// never by their mobile number.
export async function getCustomer(id: string, signal?: AbortSignal): Promise<CustomerDetails> {
  const response = await apiFetch(`/api/customers/${encodeURIComponent(id)}`, {
    signal,
  });

  return readResponse<CustomerDetails>(response);
}

// Update only the selected customer's personal details.
// Purchase history is edited through separate endpoints.
export async function updateCustomer(
  id: string,
  changes: CustomerPersonalUpdate,
): Promise<CustomerDetails> {
  const response = await apiFetch(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(changes),
  });

  return readResponse<CustomerDetails>(response);
}

// Update exactly one purchase using the customer ID
// and the selected purchase record ID.
// Other historical purchases remain unchanged.
export async function updatePurchase(
  customerId: string,
  recordId: string,
  changes: EditablePurchase,
): Promise<CustomerRecord> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/records/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    },
  );

  return readResponse<CustomerRecord>(response);
}

// Update exactly one prescription by its ID.
// Other saved prescriptions are not modified.
export async function updatePrescription(
  customerId: string,
  prescriptionId: string,
  changes: EditablePrescription,
): Promise<Prescription> {
  const response = await apiFetch(
    `/api/customers/${encodeURIComponent(customerId)}/prescriptions/${encodeURIComponent(prescriptionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    },
  );

  return readResponse<Prescription>(response);
}
