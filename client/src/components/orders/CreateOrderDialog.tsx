import ResponsiveDialog from "../layout/ResponsiveDialog";
import { indiaDatePlusDays } from "../../utils/dates";

import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";

import { searchCustomers } from "../../services/customerApi";
import { type CustomerSummary } from "../../models/customer";

import { createTrackingOrder, fetchEligiblePurchases } from "../../services/orderApi";
import { type EligiblePurchases } from "../../models/order";

// Return the new order number and ID to OrdersPage.
type Props = {
  onClose: () => void;
  onCreated: (orderNumber: string, orderId: string) => void;
};

type SearchState = "idle" | "searching" | "done";

// Format purchase amounts in Indian rupees.
function money(value: string): string {
  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}

export default function CreateOrderDialog({ onClose, onCreated }: Props) {
  // Customer search.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");

  // Selected customer.
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  // Loaded customer details and purchases.
  const [customer, setCustomer] = useState<EligiblePurchases | null>(null);

  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Selected purchase.
  const [purchaseRecordId, setPurchaseRecordId] = useState("");

  // Delivery information.
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  const [internalNotes, setInternalNotes] = useState("");

  // Request states.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Prevent multiple requests from repeated clicks.
  const submitting = useRef(false);

  useEffect(() => {
    const text = query.trim();

    // Do not search without enough text.
    // Also stop searching once a customer is selected.
    if (selectedCustomer !== null || text.length < 2) {
      return;
    }

    const controller = new AbortController();

    // Wait briefly while staff type.
    const timer = window.setTimeout(() => {
      searchCustomers(text, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) {
            return;
          }

          setResults(found);
          setSearchState("done");
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) {
            return;
          }

          setResults([]);
          setSearchState("done");

          setError(err instanceof Error ? err.message : "Unable to search customers.");
        });
    }, 300);

    // Cancel outdated search requests.
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedCustomer]);

  function changeSearch(text: string) {
    setQuery(text);

    // Clear the previous customer and purchase.
    setSelectedCustomer(null);
    setCustomer(null);
    setPurchaseRecordId("");

    setResults([]);
    setSearchState(text.trim().length >= 2 ? "searching" : "idle");

    setLoadingCustomer(false);
    setError("");
  }

  function chooseCustomer(item: CustomerSummary) {
    // Use the selected customer's unique ID.
    setSelectedCustomer(item);
    setQuery(item.name);

    setCustomer(null);
    setPurchaseRecordId("");

    setResults([]);
    setSearchState("idle");

    setLoadingCustomer(true);
    setError("");
  }

  useEffect(() => {
    if (selectedCustomer === null) {
      return;
    }

    const controller = new AbortController();

    // Load purchases for the exact selected customer.
    fetchEligiblePurchases(selectedCustomer.id, controller.signal)
      .then((details) => {
        if (controller.signal.aborted) {
          return;
        }

        setCustomer(details);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load customer purchases.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingCustomer(false);
        }
      });

    // Ignore old customer responses when selection changes.
    return () => {
      controller.abort();
    };
  }, [selectedCustomer]);

  // Ignore purchases from a previous customer while the new selection loads.

  const selectedPurchase =
    customer !== null && selectedCustomer !== null && customer.id === selectedCustomer.id
      ? (customer.records.find((record) => record.id === purchaseRecordId) ?? null)
      : null;

  async function handleCreate() {
    // Prevent duplicate submissions.
    if (submitting.current || saving) {
      return;
    }

    setError("");

    // Step 1 - Customer must be selected.
    if (selectedCustomer === null) {
      setError("Please search for and select a customer first.");
      return;
    }

    // Step 2 - Wait for customer records.
    if (loadingCustomer) {
      setError("Please wait while customer purchases are loading.");
      return;
    }

    // Step 3 - Ensure the correct customer is loaded.
    if (customer === null || customer.id !== selectedCustomer.id) {
      setError("Customer purchases could not be loaded. Please select the customer again.");
      return;
    }

    // Step 4 - A purchase must be selected.
    if (selectedPurchase === null) {
      setError("Please select a saved purchase before creating an order.");
      return;
    }

    // Step 5 - Start creating the order.
    submitting.current = true;
    setSaving(true);

    try {
      // Only create the tracking order.
      // Existing customer data and billing remain unchanged.
      const order = await createTrackingOrder({
        customerId: customer.id,
        purchaseRecordId: selectedPurchase.id,
        expectedDeliveryDate: expectedDeliveryDate || null,
        internalNotes: internalNotes.trim() || null,
      });

      // Return order information to the Orders page.
      // The parent can now refresh and open the saved order.
      onCreated(order.orderNumber, order.id);
    } catch (err) {
      // Show backend errors, including duplicate orders.
      setError(err instanceof Error ? err.message : "Unable to create the tracking order.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      fullWidth
      maxWidth="md"
      onClose={saving ? undefined : onClose}
      aria-labelledby="create-order-title"
    >
      <DialogTitle id="create-order-title" sx={{ fontWeight: 800 }}>
        Create Tracking Order
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Select an existing customer and purchase to track preparation and delivery. Existing
            bills remain unchanged.
          </Typography>

          {/* ----------------------------------------
              STEP 1 - FIND CUSTOMER
          ---------------------------------------- */}

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip label="1" size="small" color="primary" />

              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Find Customer
              </Typography>
            </Stack>

            <TextField
              fullWidth
              label="Customer Name or Mobile Number"
              placeholder="Type at least 2 characters"
              autoComplete="off"
              value={query}
              disabled={saving}
              onChange={(event) => {
                changeSearch(event.target.value);
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Search progress */}
            {selectedCustomer === null && searchState === "searching" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} />

                <Typography variant="body2" color="text.secondary">
                  Searching customers...
                </Typography>
              </Stack>
            )}

            {/* Customer search results */}
            {selectedCustomer === null && results.length > 0 && (
              <Paper
                variant="outlined"
                sx={{
                  maxHeight: 240,
                  overflowY: "auto",
                  borderRadius: 2,
                }}
              >
                <List disablePadding>
                  {results.map((item) => (
                    <ListItemButton
                      key={item.id}
                      disabled={saving}
                      onClick={() => chooseCustomer(item)}
                    >
                      <ListItemText
                        primary={item.name}
                        secondary={item.mobNumber || "No mobile number"}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}

            {/* No results */}
            {selectedCustomer === null &&
              searchState === "done" &&
              results.length === 0 &&
              !error && (
                <Alert severity="info">
                  No customers found. Try another name or mobile number.
                </Alert>
              )}

            {/* Selected customer */}
            {selectedCustomer !== null && (
              <Alert
                severity="success"
                action={
                  <Button
                    type="button"
                    color="inherit"
                    size="small"
                    disabled={saving}
                    onClick={() => changeSearch("")}
                  >
                    Change
                  </Button>
                }
              >
                <strong>{selectedCustomer.name}</strong>

                {selectedCustomer.mobNumber ? ` · ${selectedCustomer.mobNumber}` : ""}
              </Alert>
            )}
          </Stack>

          <Divider />

          {/* ----------------------------------------
              STEP 2 - SELECT PURCHASE
          ---------------------------------------- */}

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip label="2" size="small" color="primary" />

              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Select Purchase
              </Typography>
            </Stack>

            {selectedCustomer === null && (
              <Typography variant="body2" color="text.secondary">
                Choose a customer to view their saved purchases.
              </Typography>
            )}

            {/* Purchase loading */}
            {loadingCustomer && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <CircularProgress size={18} />

                <Typography variant="body2">Loading purchases...</Typography>
              </Stack>
            )}

            {/* Empty purchase history */}
            {!loadingCustomer && customer !== null && customer.records.length === 0 && (
              <Alert severity="info">
                No untracked purchases are available. Existing purchases may already have a tracking
                order.
              </Alert>
            )}

            {/* Purchase selection cards */}
            {!loadingCustomer && customer !== null && customer.records.length > 0 && (
              <Stack
                spacing={1}
                sx={{
                  maxHeight: 280,
                  overflowY: "auto",
                  pr: 0.5,
                }}
              >
                {customer.records.map((record) => {
                  const isSelected = record.id === purchaseRecordId;

                  const productName =
                    [record.specsType, record.lensType].filter(Boolean).join(" + ") ||
                    "Unspecified items";

                  return (
                    <Card
                      key={record.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? "primary.main" : "divider",
                      }}
                    >
                      <CardActionArea
                        disabled={saving}
                        onClick={() => {
                          setPurchaseRecordId(record.id);
                          setError("");
                        }}
                      >
                        <CardContent
                          sx={{
                            "&:last-child": {
                              pb: 2,
                            },
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={2}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {productName}
                              </Typography>

                              <Typography variant="caption" color="text.secondary">
                                {record.purchaseDate
                                  ? `Purchased: ${record.purchaseDate.slice(0, 10)}`
                                  : "Purchase date not recorded"}
                              </Typography>
                            </Box>

                            <Stack
                              spacing={0.5}
                              sx={{
                                alignItems: "flex-end",
                                flexShrink: 0,
                              }}
                            >
                              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {money(record.mrp)}
                              </Typography>

                              {isSelected && (
                                <Chip
                                  size="small"
                                  color="primary"
                                  icon={<CheckCircleOutlineOutlined />}
                                  label="Selected"
                                />
                              )}
                            </Stack>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* ----------------------------------------
              STEP 3 - DELIVERY DETAILS
          ---------------------------------------- */}

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip label="3" size="small" color="primary" />

              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Delivery Details
              </Typography>
            </Stack>

            {/* Quick delivery date buttons */}
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {[
                { label: "Tomorrow", days: 1 },
                { label: "3 Days", days: 3 },
                { label: "7 Days", days: 7 },
              ].map((option) => (
                <Button
                  key={option.days}
                  type="button"
                  size="small"
                  variant="outlined"
                  disabled={saving}
                  onClick={() => {
                    setExpectedDeliveryDate(indiaDatePlusDays(option.days));
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </Stack>

            {/* Expected delivery date */}
            <TextField
              fullWidth
              type="date"
              label="Expected Delivery Date (Optional)"
              value={expectedDeliveryDate}
              disabled={saving}
              onChange={(event) => {
                setExpectedDeliveryDate(event.target.value);
              }}
              slotProps={{
                inputLabel: {
                  shrink: true,
                },
              }}
            />

            {/* Staff-only notes */}
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Internal Notes (Staff Only)"
              placeholder="Optional preparation instructions"
              value={internalNotes}
              disabled={saving}
              onChange={(event) => {
                setInternalNotes(event.target.value);
              }}
              slotProps={{
                htmlInput: {
                  maxLength: 2000,
                },
              }}
              helperText="Private staff notes. Not included in customer messages."
            />
          </Stack>

          {/* Selected order summary */}
          {selectedCustomer !== null && selectedPurchase !== null && (
            <Alert severity="info">
              Ready to track <strong>{selectedCustomer.name}</strong>'s purchase of{" "}
              <strong>{money(selectedPurchase.mrp)}</strong>. No new bill will be created.
            </Alert>
          )}
        </Stack>
      </DialogContent>

      {/* Keep errors visible near the Save button. */}
      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* ----------------------------------------
          DIALOG ACTIONS
      ---------------------------------------- */}

      <DialogActions sx={{ px: 2, pb: 2, pt: 1 }}>
        <Button autoFocus type="button" onClick={onClose} disabled={saving}>
          Cancel
        </Button>

        {/* Always allow a click for validation.
            Disable only while the request is running. */}
        <Button
          type="button"
          variant="contained"
          size="large"
          disabled={saving}
          startIcon={
            saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineOutlined />
          }
          onClick={() => void handleCreate()}
          sx={{
            fontWeight: 700,
            borderRadius: 2,
          }}
        >
          {saving ? "Creating Order..." : "Create Order"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}
