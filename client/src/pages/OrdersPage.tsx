import { todayInIndia, formatDate } from "../utils/dates";

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AddOutlined from "@mui/icons-material/AddOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";

import CreateOrderDialog from "../components/orders/CreateOrderDialog";
import OrderDetailsDialog from "../components/orders/OrderDetailsDialog";

import {
  fetchOrders,
  fetchOrderCounts,
  updateTrackingOrderStatus,
  removeTrackingOrder,
} from "../services/orderApi";
import {
  orderStatusLabels,
  type OrderCounts,
  type OrderListItem,
  type OrderListResponse,
  type OrderStatus,
  type OrderFilter,
} from "../models/order";

type StatusFilter = OrderFilter;

const statusFilters: StatusFilter[] = [
  "ALL",
  "ACTIVE",
  "OVERDUE",
  "PLACED",
  "PROCESSING",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

function readStatus(value: string | null): StatusFilter {
  if (value && statusFilters.includes(value as StatusFilter)) {
    return value as StatusFilter;
  }

  return "ALL";
}

function isOverdue(order: OrderListItem, today: string): boolean {
  return (
    order.status !== "DELIVERED" &&
    order.status !== "CANCELLED" &&
    !!order.expectedDeliveryDate &&
    order.expectedDeliveryDate.slice(0, 10) < today
  );
}

function statusColor(status: OrderStatus): "default" | "info" | "warning" | "success" | "error" {
  switch (status) {
    case "PLACED":
      return "default";
    case "PROCESSING":
      return "info";
    case "READY":
      return "warning";
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "error";
  }
}

// Show the next normal workflow action on an order card.
function nextAction(status: OrderStatus): { status: OrderStatus; label: string } | null {
  switch (status) {
    case "PLACED":
      return {
        status: "PROCESSING",
        label: "Start Processing",
      };
    case "PROCESSING":
      return {
        status: "READY",
        label: "Mark Ready",
      };
    case "READY":
      return {
        status: "DELIVERED",
        label: "Mark Delivered",
      };
    default:
      return null;
  }
}

function pickupWhatsAppLink(order: OrderListItem): string | null {
  // Clean the number before creating a WhatsApp link.
  const digits = (order.customer.mobNumber || "").replace(/\D/g, "");

  const phone =
    digits.length === 10
      ? `91${digits}`
      : digits.length === 12 && digits.startsWith("91")
        ? digits
        : null;

  if (!phone) {
    return null;
  }

  // Only customer-safe information is shared.
  // Staff-only notes are never included.
  const message =
    `Hello ${order.customer.name}, your spectacles order ` +
    `${order.orderNumber} is ready for pickup at ` +
    `Harshu Chashma Ghar. Thank you!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();

  // Dashboard links can open a status filter directly.
  const filter = readStatus(params.get("status"));

  const rawPage = Number(params.get("page") || 1);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 100000 ? rawPage : 1;
  const [search, setSearch] = useState("");

  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [result, setResult] = useState<(OrderListResponse & { requestKey: string }) | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const requestKey = JSON.stringify([filter, page, search.trim(), refreshKey]);
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const [countsError, setCountsError] = useState("");
  const currentLoadError = loadError?.key === requestKey ? loadError.message : "";
  const loading = result?.requestKey !== requestKey && !currentLoadError;

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  const showCreateDialog = createOpen || params.get("create") === "1";

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [confirmDelivery, setConfirmDelivery] = useState<OrderListItem | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState<OrderListItem | null>(null);
  const [removeError, setRemoveError] = useState("");

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const updating = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      () => {
        fetchOrders(filter, page, controller.signal, search)
          .then((orders) => {
            if (controller.signal.aborted) return;
            if (page > Math.max(1, orders.totalPages)) {
              setParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("page", String(Math.max(1, orders.totalPages)));
                  return next;
                },
                { replace: true },
              );
              return;
            }
            setResult({ ...orders, requestKey });
            setLoadError(null);
          })
          .catch((err: unknown) => {
            if (controller.signal.aborted) return;

            setLoadError({
              key: requestKey,
              message: err instanceof Error ? err.message : "Could not load orders.",
            });
          });
      },
      search.trim() ? 300 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filter, page, search, refreshKey, requestKey, setParams]);

  // Counts do not need to be reloaded for each page or search keystroke.
  useEffect(() => {
    const controller = new AbortController();
    fetchOrderCounts(controller.signal)
      .then((summary) => {
        if (controller.signal.aborted) return;
        setCounts(summary);
        setCountsError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCountsError("Order counts are temporarily unavailable. You can still manage orders.");
        }
      });
    return () => controller.abort();
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  function changeFilter(value: StatusFilter) {
    const next = new URLSearchParams(params);

    next.delete("create");
    next.delete("page");

    if (value === "ALL") {
      next.delete("status");
    } else {
      next.set("status", value);
    }

    setParams(next);
  }

  function closeCreate() {
    setCreateOpen(false);

    if (params.has("create")) {
      const next = new URLSearchParams(params);
      next.delete("create");
      setParams(next, { replace: true });
    }
  }

  async function advanceOrder(order: OrderListItem, status: OrderStatus) {
    if (updating.current) return;

    // Delivery is confirmed in a separate dialog.
    if (status === "DELIVERED") {
      setConfirmDelivery(order);
      return;
    }

    updating.current = true;
    setBusyOrderId(order.id);
    setError("");
    setMessage("");

    try {
      await updateTrackingOrderStatus(order.id, {
        status,
        note: null,
        expectedStatus: order.status,
      });

      setMessage(`${order.orderNumber} is now ${orderStatusLabels[status]}.`);

      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update order status.");
    } finally {
      updating.current = false;
      setBusyOrderId(null);
    }
  }

  async function markDelivered() {
    const order = confirmDelivery;
    if (!order || updating.current) return;

    updating.current = true;
    setBusyOrderId(order.id);
    setError("");
    setMessage("");

    try {
      await updateTrackingOrderStatus(order.id, {
        status: "DELIVERED",
        note: null,
        expectedStatus: order.status,
      });

      setConfirmDelivery(null);
      setMessage(`${order.orderNumber} marked as delivered.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark the order as delivered.");
      setConfirmDelivery(null);
    } finally {
      updating.current = false;
      setBusyOrderId(null);
    }
  }

  function requestRemoval(order: OrderListItem) {
    if (updating.current) return;
    setRemoveError("");
    setConfirmRemoval(order);
  }

  async function removeOrder() {
    const order = confirmRemoval;
    if (!order || updating.current) return;

    updating.current = true;
    setBusyOrderId(order.id);
    setRemoveError("");
    setMessage("");
    try {
      await removeTrackingOrder(order.id);
      setConfirmRemoval(null);
      setSelectedOrderId((current) => (current === order.id ? null : current));
      setError("");
      setMessage(`${order.orderNumber} removed. The customer and purchase have been kept.`);
      refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Could not remove this order.");
    } finally {
      updating.current = false;
      setBusyOrderId(null);
    }
  }

  const visibleOrders = result?.requestKey === requestKey ? result.orders : [];
  const today = todayInIndia();

  const totalActive = counts?.active ?? 0;

  return (
    <Box sx={{ maxWidth: 1320, mx: "auto", pb: 5 }}>
      <Stack spacing={3}>
        {/* Main heading */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Order Tracking
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              From order placement to customer pickup — all in one place.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<AddOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              New Order
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {message && (
          <Alert severity="success" onClose={() => setMessage("")}>
            {message}
          </Alert>
        )}
        {currentLoadError && <Alert severity="error">{currentLoadError}</Alert>}
        {countsError && <Alert severity="warning">{countsError}</Alert>}

        {/* Clickable status overview */}
        <Grid container spacing={1.5}>
          {[
            {
              label: "Active",
              value: totalActive,
              status: "ACTIVE" as StatusFilter,
            },
            {
              label: "Placed",
              value: counts?.placed ?? 0,
              status: "PLACED" as StatusFilter,
            },
            {
              label: "Processing",
              value: counts?.processing ?? 0,
              status: "PROCESSING" as StatusFilter,
            },
            {
              label: "Ready for Pickup",
              value: counts?.ready ?? 0,
              status: "READY" as StatusFilter,
            },
          ].map((item) => (
            <Grid key={item.label} size={{ xs: 6, lg: 3 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  borderColor: filter === item.status ? "primary.main" : "divider",
                }}
              >
                <Button
                  fullWidth
                  onClick={() => changeFilter(item.status)}
                  sx={{
                    p: 2,
                    height: "100%",
                    display: "block",
                    textAlign: "left",
                    textTransform: "none",
                    color: "text.primary",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {item.label}
                  </Typography>

                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>
                    {counts ? item.value : "—"}
                  </Typography>
                </Button>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Attention indicator */}
        {(counts?.overdue ?? 0) > 0 && (
          <Alert severity="warning">
            {counts?.overdue} order(s) have passed their expected delivery date. Review the due
            dates below.
          </Alert>
        )}

        {/* Filters and search */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { md: "center" },
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Orders
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    {loading
                      ? "Loading matches..."
                      : `${result?.requestKey === requestKey ? result.total : 0} matching orders`}
                  </Typography>
                </Box>

                <TextField
                  size="small"
                  label="Search all orders"
                  placeholder="Name, phone or order number"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setParams(
                      (previous) => {
                        const next = new URLSearchParams(previous);
                        next.delete("page");
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                  slotProps={{ htmlInput: { maxLength: 200 } }}
                  sx={{ minWidth: { md: 300 } }}
                />
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {statusFilters.map((status) => (
                  <Button
                    key={status}
                    size="small"
                    variant={filter === status ? "contained" : "outlined"}
                    onClick={() => changeFilter(status)}
                    sx={{
                      borderRadius: 5,
                      textTransform: "none",
                    }}
                  >
                    {status === "ALL"
                      ? "All Orders"
                      : status === "ACTIVE"
                        ? "Active"
                        : status === "OVERDUE"
                          ? "Overdue"
                          : orderStatusLabels[status]}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary" variant="body2">
              Loading orders...
            </Typography>
          </Stack>
        )}

        {/* Order cards */}
        {!loading && !currentLoadError && visibleOrders.length === 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ textAlign: "center", py: 6 }}>
              <Typography variant="h6">No matching orders</Typography>

              <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                Try a different status or create a tracking order.
              </Typography>

              <Button
                variant="contained"
                startIcon={<AddOutlined />}
                onClick={() => setCreateOpen(true)}
                sx={{ mt: 1 }}
              >
                Create Order
              </Button>
            </CardContent>
          </Card>
        )}

        <Grid container spacing={2}>
          {!loading &&
            visibleOrders.map((order) => {
              const action = nextAction(order.status);
              const overdue = isOverdue(order, today);
              const whatsapp = order.status === "READY" ? pickupWhatsAppLink(order) : null;

              return (
                <Grid key={order.id} size={{ xs: 12, md: 6, xl: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderRadius: 3,
                      borderColor: overdue ? "warning.main" : "divider",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                            {order.orderNumber}
                          </Typography>

                          <Chip
                            size="small"
                            label={orderStatusLabels[order.status]}
                            color={statusColor(order.status)}
                          />
                        </Stack>

                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {order.customer.name}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            {order.customer.mobNumber || "No mobile number"}
                          </Typography>
                        </Box>

                        <Box>
                          <Typography variant="body2">
                            <strong>Frame:</strong> {order.purchase.specsType || "Not specified"}
                          </Typography>

                          <Typography variant="body2">
                            <strong>Lens:</strong> {order.purchase.lensType || "Not specified"}
                          </Typography>
                        </Box>

                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Due: ${formatDate(order.expectedDeliveryDate)}`}
                          />

                          {overdue && <Chip size="small" color="warning" label="Overdue" />}
                        </Stack>
                      </Stack>
                    </CardContent>

                    <Divider />

                    {/* Quick actions without opening another dialog */}
                    <Stack spacing={1} sx={{ p: 2 }}>
                      {action && (
                        <Button
                          fullWidth
                          variant="contained"
                          endIcon={<ArrowForwardOutlined />}
                          disabled={busyOrderId !== null}
                          onClick={() => void advanceOrder(order, action.status)}
                        >
                          {busyOrderId === order.id ? "Updating..." : action.label}
                        </Button>
                      )}

                      {whatsapp && (
                        <Button
                          component="a"
                          href={whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="success"
                          variant="outlined"
                          startIcon={<WhatsAppIcon />}
                        >
                          Send Pickup Message
                        </Button>
                      )}

                      <Stack direction="row" spacing={1}>
                        <Button
                          fullWidth
                          variant="outlined"
                          onClick={() => setSelectedOrderId(order.id)}
                          disabled={busyOrderId !== null}
                        >
                          Manage Details
                        </Button>

                        <Button
                          component={Link}
                          to={`/customers/${order.customer.id}`}
                          variant="text"
                          size="small"
                        >
                          Customer
                        </Button>
                      </Stack>
                      <Button
                        color="error"
                        startIcon={<DeleteOutlineOutlined />}
                        disabled={busyOrderId !== null}
                        onClick={() => requestRemoval(order)}
                      >
                        Remove Order
                      </Button>
                    </Stack>
                  </Card>
                </Grid>
              );
            })}
        </Grid>

        {/* Backend pagination */}
        {!loading && !currentLoadError && (result?.totalPages ?? 0) > 1 && (
          <Stack sx={{ alignItems: "center", py: 1 }}>
            <Pagination
              page={page}
              count={result?.totalPages ?? 1}
              onChange={(_, value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              }}
            />
          </Stack>
        )}
      </Stack>

      {/* Create an order, refresh the list, and open its details. */}
      {showCreateDialog && (
        <CreateOrderDialog
          onClose={closeCreate}
          onCreated={(number: string, orderId: string) => {
            // Close the creation dialog.
            setCreateOpen(false);

            // Clear filters so the new order is visible.
            setParams(new URLSearchParams(), {
              replace: true,
            });

            setSearch("");

            // Refresh orders and summary counts.
            setRefreshKey((value) => value + 1);

            // Display confirmation.
            setError("");
            setMessage(`Order ${number} created successfully.`);

            // Immediately show the saved order.
            setSelectedOrderId(orderId);
          }}
        />
      )}

      {/* Detailed editing and history */}
      {selectedOrderId && (
        <OrderDetailsDialog
          key={selectedOrderId}
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={refresh}
          onRemove={requestRemoval}
        />
      )}

      <Dialog
        open={confirmRemoval !== null}
        closeAfterTransition={false}
        onClose={() => {
          if (!updating.current) setConfirmRemoval(null);
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="remove-order-title"
        aria-describedby="remove-order-description"
      >
        <DialogTitle id="remove-order-title">Remove Order?</DialogTitle>
        <DialogContent>
          <Typography id="remove-order-description">
            Permanently remove <strong>{confirmRemoval?.orderNumber}</strong> and its status
            history? The customer and saved purchase will be kept. You can create a new tracking
            order for this purchase later.
          </Typography>
          {removeError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {removeError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button autoFocus disabled={busyOrderId !== null} onClick={() => setConfirmRemoval(null)}>
            Keep Order
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busyOrderId !== null}
            onClick={() => void removeOrder()}
          >
            {busyOrderId !== null ? "Removing..." : "Remove Order"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delivery confirmation prevents accidental completion */}
      <Dialog
        open={confirmDelivery !== null}
        closeAfterTransition={false}
        onClose={() => {
          if (!busyOrderId) setConfirmDelivery(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Confirm Delivery</DialogTitle>

        <DialogContent>
          <Typography>
            Mark order <strong>{confirmDelivery?.orderNumber}</strong> as delivered to the customer?
          </Typography>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            autoFocus
            disabled={busyOrderId !== null}
            onClick={() => setConfirmDelivery(null)}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            disabled={busyOrderId !== null}
            onClick={() => void markDelivered()}
          >
            Confirm Delivered
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
