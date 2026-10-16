import { OrderStatus } from "../generated/prisma/client";

import { OrderInputError } from "../utils/errors";
export { OrderInputError } from "../utils/errors";

export type CreateOrderInput = {
  customerId: string;
  purchaseRecordId: string;
  expectedDeliveryDate: Date | null;
  internalNotes: string | null;
};

export type UpdateOrderInput = {
  expectedDeliveryDate?: Date | null;
  internalNotes?: string | null;
};

export type UpdateOrderStatusInput = {
  status: OrderStatus;
  note: string | null;
  expectedStatus?: OrderStatus;
};

export type OrderFilter = OrderStatus | "ACTIVE" | "OVERDUE";

export function validateOrderQuery(query: Record<string, unknown>) {
  const status = query.status;
  if (
    status !== undefined &&
    (typeof status !== "string" ||
      (!statuses.has(status) && status !== "ACTIVE" && status !== "OVERDUE"))
  ) {
    throw new OrderInputError("Invalid order status filter.");
  }
  function positiveInteger(value: unknown, fallback: number, max: number, label: string) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
      throw new OrderInputError(`Invalid ${label}.`);
    }
    return Number(value);
  }
  if (
    query.search !== undefined &&
    (typeof query.search !== "string" || query.search.length > 200)
  ) {
    throw new OrderInputError("Search must be text with at most 200 characters.");
  }
  return {
    status: status as OrderFilter | undefined,
    page: positiveInteger(query.page, 1, 100000, "page number"),
    pageSize: positiveInteger(query.pageSize, 20, 100, "page size"),
    search: typeof query.search === "string" ? query.search.trim() : "",
  };
}

export function validateOrderCustomerId(value: unknown) {
  return requiredId(value, "Customer ID");
}

const statuses = new Set<string>(Object.values(OrderStatus));

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderInputError("A valid JSON object is required.");
  }

  return value as Record<string, unknown>;
}

function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OrderInputError(`${label} is required.`);
  }

  if (value.length > 100) {
    throw new OrderInputError(`${label} is too long.`);
  }

  return value.trim();
}

function deliveryDate(value: unknown): Date | null {
  if (value === null || value === "") return null;

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new OrderInputError("Use YYYY-MM-DD for the delivery date.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new OrderInputError("Enter a valid delivery date.");
  }

  return date;
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value !== "string") {
    throw new OrderInputError("Notes must be text.");
  }

  const text = value.trim();

  if (text.length > maxLength) {
    throw new OrderInputError(`Text cannot exceed ${maxLength} characters.`);
  }

  return text || null;
}

// Order creation is always an explicit staff action.
export function validateCreateOrder(body: unknown): CreateOrderInput {
  const data = asObject(body);

  return {
    customerId: requiredId(data.customerId, "Customer ID"),
    purchaseRecordId: requiredId(data.purchaseRecordId, "Purchase record ID"),
    expectedDeliveryDate:
      data.expectedDeliveryDate === undefined ? null : deliveryDate(data.expectedDeliveryDate),
    internalNotes: optionalText(data.internalNotes, 2000),
  };
}

export function validateUpdateOrder(body: unknown): UpdateOrderInput {
  const data = asObject(body);
  const result: UpdateOrderInput = {};

  if (Object.hasOwn(data, "expectedDeliveryDate")) {
    result.expectedDeliveryDate = deliveryDate(data.expectedDeliveryDate);
  }

  if (Object.hasOwn(data, "internalNotes")) {
    result.internalNotes = optionalText(data.internalNotes, 2000);
  }

  if (Object.keys(result).length === 0) {
    throw new OrderInputError("No order changes were supplied.");
  }

  return result;
}

export function validateOrderStatus(body: unknown): UpdateOrderStatusInput {
  const data = asObject(body);

  if (typeof data.status !== "string" || !statuses.has(data.status)) {
    throw new OrderInputError("Select a valid order status.");
  }

  if (
    data.expectedStatus !== undefined &&
    (typeof data.expectedStatus !== "string" || !statuses.has(data.expectedStatus))
  ) {
    throw new OrderInputError("Invalid expected order status.");
  }

  return {
    status: data.status as OrderStatus,
    note: optionalText(data.note, 1000),
    ...(data.expectedStatus === undefined
      ? {}
      : { expectedStatus: data.expectedStatus as OrderStatus }),
  };
}
