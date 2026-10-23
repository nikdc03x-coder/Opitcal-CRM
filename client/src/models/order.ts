/** Client data contracts for manual order tracking. */

export type OrderStatus = "PLACED" | "PROCESSING" | "READY" | "DELIVERED" | "CANCELLED";

export type OrderFilter = OrderStatus | "ALL" | "ACTIVE" | "OVERDUE";

export type EligiblePurchases = {
  id: string;
  records: OrderListItem["purchase"][];
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  PLACED: "Placed",
  PROCESSING: "Processing",
  READY: "Ready for Pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export type OrderCounts = {
  placed: number;
  processing: number;
  ready: number;
  delivered: number;
  cancelled: number;
  overdue: number;
  active: number;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  customerId: string;
  purchaseRecordId: string;
  status: OrderStatus;
  expectedDeliveryDate: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;

  customer: {
    id: string;
    name: string;
    mobNumber: string | null;
  };

  purchase: {
    id: string;
    specsType: string | null;
    lensType: string | null;
    mrp: string;
    purchaseDate: string | null;
  };
};

export type OrderListResponse = {
  orders: OrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type OrderHistoryEntry = {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type OrderDetail = Omit<OrderListItem, "customer" | "purchase"> & {
  customer: OrderListItem["customer"] & {
    reference: string | null;
  };

  purchase: OrderListItem["purchase"] & {
    pricingMode: "SPLIT" | "MRP_ONLY";
    prescriptionId: string | null;
  };

  history: OrderHistoryEntry[];
};

export type CreateOrderPayload = {
  customerId: string;
  purchaseRecordId: string;
  expectedDeliveryDate: string | null;
  internalNotes: string | null;
};

export type UpdateOrderPayload = {
  expectedDeliveryDate?: string | null;
  internalNotes?: string | null;
};

export type UpdateStatusPayload = {
  status: OrderStatus;
  note: string | null;
  expectedStatus?: OrderStatus;
};
