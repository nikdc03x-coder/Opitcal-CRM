import type {
  CustomerPayload,
  CreatedCustomer,
  CreatedPurchase,
  Prescription,
  CustomerRecord,
  CustomerSummary,
  CustomerDetails,
  CustomerPersonalUpdate,
  EditablePrescription,
  EditablePurchase,
} from "../models/customer";

import { apiFetch } from "./http";

export function deleteCustomer(id: string) {
  return changeDeletion(`/api/customers/${encodeURIComponent(id)}`, "DELETE");
}
export function deletePurchase(customerId: string, recordId: string) {
  return changeDeletion<{ customerId: string; purchaseId: string; prescriptionId: string | null }>(
    `/api/customers/${encodeURIComponent(customerId)}/records/${encodeURIComponent(recordId)}`,
    "DELETE",
  );
}
const pendingDeletes = new Map<string, Promise<unknown>>();
function changeDeletion<T = unknown>(path: string, method: string): Promise<T> {
  const key = `${method}:${path}`;
  const pending = pendingDeletes.get(key);
  if (pending) return pending as Promise<T>;
  const request = apiFetch(path, { method })
    .then(readResponse<T>)
    .finally(() => pendingDeletes.delete(key));
  pendingDeletes.set(key, request);
  return request;
}
export type TrashContents = {
  customers: {
    id: string;
    name: string;
    mobNumber: string | null;
    _count: { records: number; prescriptions: number };
  }[];
  purchases: (CustomerRecord & { customerId: string; customer: { name: string } })[];
};
export async function getTrash(): Promise<TrashContents> {
  return readResponse<TrashContents>(await apiFetch("/api/customers/trash"));
}
export function restoreDeleted(customerId: string, recordId?: string) {
  const base = `/api/customers/${encodeURIComponent(customerId)}`;
  return changeDeletion(
    `${base}${recordId ? `/records/${encodeURIComponent(recordId)}` : ""}/restore`,
    "POST",
  );
}

// The PIN is sent only in the authenticated request body and is never cached.
export async function permanentlyDelete(customerId: string, pin: string, recordId?: string) {
  const base = `/api/customers/${encodeURIComponent(customerId)}`;
  return readResponse<{ customerId: string; purchaseId: string | null }>(
    await apiFetch(
      `${base}${recordId ? `/records/${encodeURIComponent(recordId)}` : ""}/permanent`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      },
    ),
  );
}

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

// Append a purchase to the selected customer without changing their history.
export type NewPurchasePayload = {
  record: CustomerPayload["record"];
  purchaseDate?: string | null;
  prescriptionId?: string | null;
  prescription?: CustomerPayload["prescription"];
};

// Add a new purchase record to an existing customer.
// Share only identical in-flight saves; release both successful and failed requests.
const pendingPurchases = new Map<string, Promise<CreatedPurchase>>();

export function addPurchase(
  customerId: string,
  payload: NewPurchasePayload,
): Promise<CreatedPurchase> {
  const body = JSON.stringify(payload);
  const key = JSON.stringify([customerId, body]);
  const pending = pendingPurchases.get(key);
  if (pending) return pending;
  const request = (async () => {
    const response = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return readResponse<CreatedPurchase>(response);
  })().finally(() => pendingPurchases.delete(key));
  pendingPurchases.set(key, request);
  return request;
}

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
