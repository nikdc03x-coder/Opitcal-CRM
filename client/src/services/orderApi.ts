import type {
  OrderFilter,
  EligiblePurchases,
  OrderCounts,
  OrderListItem,
  OrderListResponse,
  OrderDetail,
  CreateOrderPayload,
  UpdateOrderPayload,
  UpdateStatusPayload,
} from "../models/order";

import { apiFetch } from "./http";

const API_PATH = "/api/orders";

// Send admin session cookies and show useful errors.
async function orderRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(`${API_PATH}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    message?: string;
  } | null;

  if (!response.ok || !result?.success || result.data === undefined) {
    throw new Error(result?.message || `Order request failed (${response.status}).`);
  }

  return result.data;
}

export function fetchOrderCounts(signal?: AbortSignal): Promise<OrderCounts> {
  return orderRequest<OrderCounts>("/summary", { signal });
}

export function fetchOrders(
  status: OrderFilter = "ALL",
  page = 1,
  signal?: AbortSignal,
  search = "",
): Promise<OrderListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
  });

  if (status !== "ALL") {
    params.set("status", status);
  }
  if (search.trim()) params.set("search", search.trim());

  return orderRequest<OrderListResponse>(`?${params.toString()}`, { signal });
}

export function fetchEligiblePurchases(
  customerId: string,
  signal?: AbortSignal,
): Promise<EligiblePurchases> {
  const params = new URLSearchParams({ customerId });
  return orderRequest<EligiblePurchases>(`/eligible-purchases?${params}`, { signal });
}

export function fetchOrderById(orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
  return orderRequest<OrderDetail>(`/${encodeURIComponent(orderId)}`, { signal });
}

export function createTrackingOrder(
  payload: CreateOrderPayload,
): Promise<Pick<OrderListItem, "id" | "orderNumber">> {
  return orderRequest<Pick<OrderListItem, "id" | "orderNumber">>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeTrackingOrder(orderId: string): Promise<{ id: string }> {
  return orderRequest<{ id: string }>(`/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
  });
}

export function updateTrackingOrder(
  orderId: string,
  payload: UpdateOrderPayload,
): Promise<OrderDetail> {
  return orderRequest<OrderDetail>(`/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateTrackingOrderStatus(
  orderId: string,
  payload: UpdateStatusPayload,
): Promise<OrderDetail> {
  return orderRequest<OrderDetail>(`/${encodeURIComponent(orderId)}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
