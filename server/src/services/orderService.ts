import { randomUUID } from "node:crypto";

import { prisma } from "../config/database";
import { OrderStatus, type Prisma } from "../generated/prisma/client";
import { getShopId } from "./shopService";
import { shopToday } from "../utils/date";

import {
  OrderInputError,
  type CreateOrderInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
  type OrderFilter,
} from "../validators/orderValidator";

// Staff cannot accidentally reopen completed orders.
const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["PROCESSING", "DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Create a unique reference without adding another table.
// Example: ORD-A12B34CD56EF (not a sequential number).
function createOrderNumber(): string {
  return `ORD-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export async function createOrder(input: CreateOrderInput) {
  const shopId = await getShopId();

  // Only active customers belonging to this shop are eligible.
  const customer = await prisma.customer.findFirst({
    where: {
      id: input.customerId,
      shopId,
      isActive: true,
    },
    select: { id: true },
  });

  if (!customer) {
    throw new OrderInputError("Customer not found.", 404);
  }

  // Verify that the purchase belongs to this customer.
  const purchase = await prisma.customerRecord.findFirst({
    where: {
      id: input.purchaseRecordId,
      customerId: input.customerId,
    },
    select: { id: true },
  });

  if (!purchase) {
    throw new OrderInputError("The selected purchase does not belong to this customer.", 400);
  }

  // A transaction saves the order and its first history entry.
  // The database's unique purchase constraint prevents duplicate orders.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { purchaseRecordId: purchase.id },
      select: { id: true },
    });

    if (existing) {
      throw new OrderInputError("An order already exists for this purchase.", 409);
    }

    const order = await tx.order.create({
      data: {
        orderNumber: createOrderNumber(),
        shopId,
        customerId: customer.id,
        purchaseRecordId: purchase.id,
        status: OrderStatus.PLACED,
        expectedDeliveryDate: input.expectedDeliveryDate,
        internalNotes: input.internalNotes,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.PLACED,
        note: "Order created manually.",
      },
    });

    return order;
  });
}

export async function listOrders(status?: OrderFilter, page = 1, pageSize = 20, search = "") {
  const shopId = await getShopId();
  const where: Prisma.OrderWhereInput = {
    shopId,
    ...(status === "ACTIVE" || status === "OVERDUE"
      ? { status: { in: ["PLACED", "PROCESSING", "READY"] } }
      : status
        ? { status }
        : {}),
    ...(status === "OVERDUE" ? { expectedDeliveryDate: { lt: shopToday() } } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
            { customer: { mobNumber: { contains: search } } },
            { purchase: { specsType: { contains: search, mode: "insensitive" } } },
            { purchase: { lensType: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobNumber: true,
          },
        },
        purchase: {
          select: {
            id: true,
            specsType: true,
            lensType: true,
            mrp: true,
            purchaseDate: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Return only the fields needed to select an untracked purchase, without prescriptions.
export async function getEligiblePurchases(customerId: string) {
  const shopId = await getShopId();
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId, isActive: true },
    select: {
      id: true,
      records: {
        where: { order: { is: null } },
        select: { id: true, specsType: true, lensType: true, mrp: true, purchaseDate: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
    },
  });
  if (!customer) throw new OrderInputError("Customer not found.", 404);
  return customer;
}

export async function getOrderById(id: string, resolvedShopId?: string) {
  const shopId = resolvedShopId ?? (await getShopId());

  const order = await prisma.order.findFirst({
    where: { id, shopId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          mobNumber: true,
          reference: true,
        },
      },
      purchase: {
        select: {
          id: true,
          specsType: true,
          lensType: true,
          mrp: true,
          pricingMode: true,
          purchaseDate: true,
          prescriptionId: true,
        },
      },
      history: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    throw new OrderInputError("Order not found.", 404);
  }

  return order;
}

// Remove dependent history first because its foreign key restricts order deletion.
// Both deletes commit together; customer and purchase records are never deleted.
export async function deleteOrder(id: string) {
  const shopId = await getShopId();

  return prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, shopId },
        select: { id: true },
      });
      if (!order) throw new OrderInputError("Order not found.", 404);

      await tx.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
      const deleted = await tx.order.deleteMany({ where: { id: order.id, shopId } });
      if (deleted.count !== 1) {
        throw new OrderInputError("The order changed recently. Refresh and try again.", 409);
      }
      return { id: order.id };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function updateOrderDetails(id: string, input: UpdateOrderInput) {
  const shopId = await getShopId();

  const result = await prisma.order.updateMany({
    where: {
      id,
      shopId,
      status: {
        notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      },
    },
    data: input,
  });

  if (result.count === 0) {
    throw new OrderInputError("Order not found or already closed.", 409);
  }

  return getOrderById(id, shopId);
}

export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput) {
  const shopId = await getShopId();

  // Update the order and its history together.
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, shopId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new OrderInputError("Order not found.", 404);
    }

    if (input.expectedStatus !== undefined && order.status !== input.expectedStatus) {
      throw new OrderInputError("The order changed recently. Refresh and try again.", 409);
    }

    if (!allowedTransitions[order.status].includes(input.status)) {
      throw new OrderInputError(
        `Cannot move an order from ${order.status} to ${input.status}.`,
        400,
      );
    }

    // Conditional update prevents conflicting status changes.
    const updated = await tx.order.updateMany({
      where: {
        id,
        shopId,
        status: order.status,
      },
      data: {
        status: input.status,
        deliveredAt: input.status === OrderStatus.DELIVERED ? new Date() : null,
        cancelledAt: input.status === OrderStatus.CANCELLED ? new Date() : null,
      },
    });

    if (updated.count !== 1) {
      throw new OrderInputError("The order changed recently. Refresh and try again.", 409);
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: input.status,
        note: input.note,
      },
    });
  });

  return getOrderById(id, shopId);
}

export async function getOrderSummary() {
  const shopId = await getShopId();
  const [groups, overdue] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { shopId }, _count: { _all: true } }),
    prisma.order.count({
      where: {
        shopId,
        status: {
          in: ["PLACED", "PROCESSING", "READY"],
        },
        expectedDeliveryDate: { lt: shopToday() },
      },
    }),
  ]);

  const count = (status: OrderStatus) =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  const placed = count("PLACED");
  const processing = count("PROCESSING");
  const ready = count("READY");

  return {
    placed,
    processing,
    ready,
    delivered: count("DELIVERED"),
    cancelled: count("CANCELLED"),
    overdue,
    active: placed + processing + ready,
  };
}
