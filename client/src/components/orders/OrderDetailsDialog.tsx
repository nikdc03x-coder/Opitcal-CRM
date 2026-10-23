import ResponsiveDialog from "../layout/ResponsiveDialog";
import { dateOnly, formatDateTime } from "../../utils/dates";

import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  fetchOrderById,
  updateTrackingOrder,
  updateTrackingOrderStatus,
} from "../../services/orderApi";
import { orderStatusLabels, type OrderDetail, type OrderStatus } from "../../models/order";

// Refresh the Orders page after successful updates.
type Props = {
  orderId: string;
  onClose: () => void;
  onUpdated: () => void;
  onRemove: (order: OrderDetail) => void;
};

// Only allow the status changes supported by the backend.
const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["PROCESSING", "DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Show one order and its complete status history.
export default function OrderDetailsDialog({ orderId, onClose, onUpdated, onRemove }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [statusNote, setStatusNote] = useState("");

  // Fetch order details when the dialog opens.
  useEffect(() => {
    const controller = new AbortController();

    fetchOrderById(orderId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;

        setOrder(result);
        setExpectedDeliveryDate(dateOnly(result.expectedDeliveryDate));
        setInternalNotes(result.internalNotes || "");
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setError(err instanceof Error ? err.message : "Unable to load order details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [orderId, reloadKey]);

  function reloadOrder() {
    if (submitting.current) return;
    setOrder(null);
    setLoading(true);
    setError("");
    setMessage("");
    setSelectedStatus("");
    setStatusNote("");
    setReloadKey((value) => value + 1);
  }

  // Save delivery date and private staff notes.
  async function saveDetails() {
    if (!order || submitting.current) return;

    submitting.current = true;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await updateTrackingOrder(order.id, {
        expectedDeliveryDate: expectedDeliveryDate || null,
        internalNotes: internalNotes.trim() || null,
      });

      setOrder(updated);
      setMessage("Order details updated.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order details.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  // The backend also checks the allowed status transitions.
  async function saveStatus() {
    if (!order || !selectedStatus || submitting.current) return;

    submitting.current = true;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await updateTrackingOrderStatus(order.id, {
        status: selectedStatus,
        note: statusNote.trim() || null,
        expectedStatus: order.status,
      });

      setOrder(updated);
      setSelectedStatus("");
      setStatusNote("");
      setMessage("Order status updated.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const isClosed = order?.status === "DELIVERED" || order?.status === "CANCELLED";

  const allowedStatuses = order ? nextStatuses[order.status] : [];

  return (
    <ResponsiveDialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 700 }}>Order Details</DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : !order ? (
          <Alert severity="error">{error || "Unable to find this order."}</Alert>
        ) : (
          <Stack spacing={3}>
            {error && <Alert severity="error">{error}</Alert>}

            {message && <Alert severity="success">{message}</Alert>}

            {/* Order number and current status */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {order.orderNumber}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Created: {formatDateTime(order.createdAt)}
                </Typography>
              </Box>

              <Chip
                label={orderStatusLabels[order.status]}
                color={
                  order.status === "DELIVERED" || order.status === "READY"
                    ? "success"
                    : order.status === "CANCELLED"
                      ? "error"
                      : "default"
                }
              />
            </Stack>

            <Divider />

            {/* Linked customer and purchase */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Customer & Purchase
              </Typography>

              <Typography>
                <strong>Customer:</strong> {order.customer.name}
              </Typography>

              <Typography>
                <strong>Mobile:</strong> {order.customer.mobNumber || "Not available"}
              </Typography>

              <Typography>
                <strong>Frame:</strong> {order.purchase.specsType || "Not specified"}
              </Typography>

              <Typography>
                <strong>Lens:</strong> {order.purchase.lensType || "Not specified"}
              </Typography>

              <Typography>
                <strong>Purchase Amount:</strong> ₹
                {Number(order.purchase.mrp).toLocaleString("en-IN")}
              </Typography>
            </Box>

            <Divider />

            {/* Editable order information */}
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Delivery Information
              </Typography>

              <TextField
                fullWidth
                type="date"
                label="Expected Delivery Date"
                value={expectedDeliveryDate}
                disabled={saving || isClosed}
                onChange={(event) => setExpectedDeliveryDate(event.target.value)}
                slotProps={{
                  inputLabel: { shrink: true },
                }}
              />

              {order.deliveredAt && (
                <Typography variant="body2">
                  Delivered: {formatDateTime(order.deliveredAt)}
                </Typography>
              )}

              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Internal Notes (Staff Only)"
                value={internalNotes}
                disabled={saving || isClosed}
                onChange={(event) => setInternalNotes(event.target.value)}
                slotProps={{
                  htmlInput: { maxLength: 2000 },
                }}
                helperText="These notes are private and are not shared with customers."
              />

              <Button
                variant="outlined"
                disabled={saving || isClosed}
                onClick={() => void saveDetails()}
                sx={{ alignSelf: "flex-start" }}
              >
                Save Delivery Details
              </Button>
            </Stack>

            <Divider />

            {/* Status management */}
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Change Order Status
              </Typography>

              {isClosed ? (
                <Alert severity="info">This order is closed. Its status cannot be changed.</Alert>
              ) : (
                <>
                  <TextField
                    select
                    fullWidth
                    label="Next Status"
                    value={selectedStatus}
                    disabled={saving}
                    onChange={(event) => setSelectedStatus(event.target.value as OrderStatus | "")}
                  >
                    <MenuItem value="">Select status</MenuItem>

                    {allowedStatuses.map((status) => (
                      <MenuItem key={status} value={status}>
                        {orderStatusLabels[status]}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Status Note (Optional)"
                    value={statusNote}
                    disabled={saving}
                    onChange={(event) => setStatusNote(event.target.value)}
                    slotProps={{
                      htmlInput: { maxLength: 1000 },
                    }}
                  />

                  <Button
                    variant="contained"
                    disabled={saving || !selectedStatus}
                    onClick={() => void saveStatus()}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Update Status
                  </Button>
                </>
              )}
            </Stack>

            <Divider />

            {/* History of previous status changes */}
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Order Status History
              </Typography>

              {order.history.length === 0 ? (
                <Typography color="text.secondary">No status changes recorded yet.</Typography>
              ) : (
                order.history.map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      borderLeft: 3,
                      borderColor: "primary.main",
                      pl: 2,
                      py: 0.5,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600 }}>
                      {entry.fromStatus ? `${orderStatusLabels[entry.fromStatus]} → ` : ""}
                      {orderStatusLabels[entry.toStatus]}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(entry.createdAt)}
                    </Typography>

                    {entry.note && (
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                        {entry.note}
                      </Typography>
                    )}
                  </Box>
                ))
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          color="error"
          onClick={() => {
            if (order) onRemove(order);
          }}
          disabled={saving || loading || !order}
          sx={{ mr: "auto" }}
        >
          Remove Order
        </Button>
        <Button onClick={reloadOrder} disabled={saving || loading}>
          Reload Order
        </Button>
        <Button autoFocus onClick={onClose} disabled={saving}>
          Close
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
