import ResponsiveDialog from "../layout/ResponsiveDialog";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import AddOutlined from "@mui/icons-material/AddOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";

import type { CreatedPurchase, CustomerDetails, Prescription } from "../../models/customer";
import type { FrameProduct, LensProduct } from "../../models/catalog";

import { addPurchase } from "../../services/customerApi";
import { getFrames, getLenses } from "../../services/catalogApi";
import { formatDate } from "../../utils/dates";
import { getPurchaseFlag, sortPrescriptions } from "../../utils/customerHistory";
import {
  frameLabel,
  lensLabel,
  frameSearchText,
  lensSearchText,
  type EyeFieldName,
} from "../../utils/opticalForm";
import {
  initialNewPurchaseForm,
  prepareNewPurchase,
  type NewPurchaseForm,
  type PurchaseFormErrors,
} from "../../utils/newPurchaseForm";

import ProductAutocomplete from "./ProductAutocomplete";
import OpticalPrescriptionFields, {
  PrescriptionMeasurementInput,
} from "./OpticalPrescriptionFields";

type Props = {
  customer: CustomerDetails;
  onClose: () => void;
  onSuccess: (record: CreatedPurchase) => void;
  renderPrescriptionPreview: (prescription: Prescription) => ReactNode;
};

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Blank prices are unknown, not zero.
function parsePrice(value: string): number | null {
  const text = value.trim();
  if (!text) return null;

  const amount = Number(text);

  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

// Calculate a total only when all selected product prices are known.
function calculateTotal(values: NewPurchaseForm): number | null {
  if (values.pricingMode === "MRP_ONLY") {
    return parsePrice(values.mrp);
  }

  const hasFrame = Boolean(values.specsType.trim() || values.frameCatalogId);
  const hasLens = Boolean(values.lensType.trim() || values.lensCatalogId);

  if (!hasFrame && !hasLens) return null;

  const frameRate = hasFrame ? parsePrice(values.frameRate) : 0;
  const lensRate = hasLens ? parsePrice(values.lensRate) : 0;

  if (frameRate === null || lensRate === null) return null;

  return Math.round((frameRate + lensRate) * 100) / 100;
}

export default function AddPurchaseDialog({
  customer,
  onClose,
  onSuccess,
  renderPrescriptionPreview,
}: Props) {
  const [values, setValues] = useState(initialNewPurchaseForm);
  const [errors, setErrors] = useState<PurchaseFormErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  // Load product choices; custom text remains available if loading fails.
  useEffect(() => {
    let active = true;

    Promise.all([getFrames(false), getLenses(false)])
      .then(([frameData, lensData]) => {
        if (!active) return;
        setFrames(frameData);
        setLenses(lensData);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalogError(
          error instanceof Error
            ? error.message
            : "Catalog unavailable. You can type custom product names.",
        );
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Update a field and clear its previous error.
  function edit<K extends keyof NewPurchaseForm>(key: K, value: NewPurchaseForm[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({
      ...previous,
      [key]: undefined,
      total: undefined,
    }));
    setFormError("");
  }

  // Clear a product's price if that product is removed.
  function editProduct(kind: "frame" | "lens", text: string, id: string) {
    const selected = Boolean(text.trim() || id);

    setValues((previous) =>
      kind === "frame"
        ? {
            ...previous,
            specsType: text,
            frameCatalogId: id,
            frameRate: selected ? previous.frameRate : "",
          }
        : {
            ...previous,
            lensType: text,
            lensCatalogId: id,
            lensRate: selected ? previous.lensRate : "",
          },
    );

    setErrors((previous) => ({
      ...previous,
      specsType: undefined,
      lensType: undefined,
      frameRate: undefined,
      lensRate: undefined,
      total: undefined,
    }));
    setFormError("");
  }

  // Keep optical measurements in the existing form structure.
  function editEye(name: EyeFieldName, value: string) {
    setValues((previous) => ({
      ...previous,
      prescription: {
        ...previous.prescription,
        [name]: value,
      },
    }));
    setErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));
  }

  const hasFrame = Boolean(values.specsType.trim() || values.frameCatalogId);
  const hasLens = Boolean(values.lensType.trim() || values.lensCatalogId);

  const total = calculateTotal(values);

  const purchaseType = {
    FRAME_ONLY: "Frame Only",
    LENS_ONLY: "Lens Only",
    FRAME_AND_LENS: "Frame + Lens",
    NOT_SPECIFIED: "Not Specified",
  }[getPurchaseFlag(values)];

  const selectedRx =
    values.prescriptionMode === "EXISTING"
      ? customer.prescriptions.find((rx) => rx.id === values.prescriptionId)
      : undefined;

  // Validate optional prices before passing the form to the shared validator.
  function validatePrices(): boolean {
    const nextErrors: PurchaseFormErrors = {};

    const priceFields: Array<{
      name: "frameRate" | "lensRate" | "mrp";
      enabled: boolean;
    }> = [
      {
        name: "frameRate",
        enabled: values.pricingMode === "SPLIT" && hasFrame,
      },
      {
        name: "lensRate",
        enabled: values.pricingMode === "SPLIT" && hasLens,
      },
      {
        name: "mrp",
        enabled: values.pricingMode === "MRP_ONLY",
      },
    ];

    for (const field of priceFields) {
      if (!field.enabled) continue;

      const raw = values[field.name].trim();
      if (!raw) continue;

      if (parsePrice(raw) === null) {
        nextErrors[field.name] = "Enter a valid non-negative amount.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setFormError("Please correct the invalid price fields.");
      return false;
    }

    return true;
  }

  // Submit through the existing customer API.
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (submittingRef.current) return;
    if (!validatePrices()) return;

    // Normalize hidden product rates before shared validation.
    const normalizedValues: NewPurchaseForm = {
      ...values,
      specsType: values.specsType.trim(),
      lensType: values.lensType.trim(),
      frameRate: hasFrame ? values.frameRate.trim() : "",
      lensRate: hasLens ? values.lensRate.trim() : "",
      mrp: values.mrp.trim(),
    };

    const prepared = prepareNewPurchase(normalizedValues, customer.prescriptions);

    setErrors(prepared.errors);
    setFormError("");

    if (!prepared.payload) {
      setFormError(
        "The purchase could not be validated. Check the highlighted fields. If optional prices are being rejected, newPurchaseForm.ts also needs updating.",
      );
      return;
    }

    submittingRef.current = true;
    setSaving(true);

    try {
      const record = await addPurchase(customer.id, prepared.payload);

      onSuccess(record);
      onClose();
    } catch (error: unknown) {
      console.error("New purchase save failed:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save the purchase. Check the backend response.",
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      fullWidth
      maxWidth="md"
      aria-labelledby="new-purchase-title"
      onClose={() => {
        if (!submittingRef.current) onClose();
      }}
    >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit}
        sx={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <DialogTitle id="new-purchase-title">Record New Purchase</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            {/* Customer details are read-only. */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700 }}>{customer.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {customer.mobNumber || "No mobile number"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Customer ID: {customer.id}
              </Typography>
            </Paper>

            {formError && <Alert severity="error">{formError}</Alert>}

            {catalogError && <Alert severity="warning">{catalogError}</Alert>}

            {/* Prescription choice and linking. */}
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                  Optical Prescription Choice
                </Typography>

                <TextField
                  select
                  fullWidth
                  label="Prescription option"
                  value={values.prescriptionMode}
                  disabled={saving}
                  onChange={(event) => {
                    const mode = event.target.value;
                    if (mode === "NONE" || mode === "EXISTING" || mode === "NEW") {
                      edit("prescriptionMode", mode);
                    }
                  }}
                >
                  <MenuItem value="NONE">No Prescription</MenuItem>
                  <MenuItem value="EXISTING">Link Existing Prescription</MenuItem>
                  <MenuItem value="NEW">Enter New Prescription</MenuItem>
                </TextField>

                {values.prescriptionMode === "EXISTING" && (
                  <TextField
                    select
                    fullWidth
                    sx={{ mt: 2 }}
                    label="Existing prescription"
                    value={values.prescriptionId}
                    disabled={saving}
                    onChange={(event) => edit("prescriptionId", event.target.value)}
                    error={Boolean(errors.prescriptionId)}
                    helperText={
                      errors.prescriptionId ??
                      (customer.prescriptions.length
                        ? "Choose a saved prescription."
                        : "No saved prescriptions available.")
                    }
                  >
                    <MenuItem value="">Select a prescription</MenuItem>

                    {sortPrescriptions(customer.prescriptions).map((rx) => (
                      <MenuItem key={rx.id} value={rx.id}>
                        Recorded {formatDate(rx.createdAt)} · {rx.id}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </CardContent>
            </Card>

            {selectedRx && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Linked Prescription · {formatDate(selectedRx.createdAt)}
                </Typography>
                {renderPrescriptionPreview(selectedRx)}
              </Paper>
            )}

            {values.prescriptionMode === "NEW" && (
              <>
                <OpticalPrescriptionFields
                  renderField={(name, measure, options, label) => (
                    <PrescriptionMeasurementInput
                      key={name}
                      value={values.prescription[name]}
                      onChange={(value) => editEye(name, value)}
                      measure={measure}
                      options={options}
                      label={label}
                      disabled={saving}
                      error={errors[name]}
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary">
                  Leave all measurements blank if no new prescription needs to be recorded.
                </Typography>
              </>
            )}

            {/* Optional product selection. */}
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
                    <ShoppingBagOutlined color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Purchase Information
                    </Typography>
                  </Stack>

                  <Chip
                    size="small"
                    variant="outlined"
                    label={purchaseType}
                    color={purchaseType === "Not Specified" ? "default" : "primary"}
                  />
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Date of Purchase"
                      value={values.purchaseDate}
                      disabled={saving}
                      onChange={(event) => edit("purchaseDate", event.target.value)}
                      error={Boolean(errors.purchaseDate)}
                      helperText={errors.purchaseDate ?? "Defaults to today."}
                      slotProps={{
                        inputLabel: { shrink: true },
                      }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <ProductAutocomplete
                      options={frames}
                      text={values.specsType}
                      catalogId={values.frameCatalogId}
                      label="Frame / Spectacle (Optional)"
                      placeholder="Search, type, or leave blank"
                      productLabel={frameLabel}
                      searchText={frameSearchText}
                      disabled={saving}
                      loading={catalogLoading}
                      error={errors.specsType}
                      onChange={(text, id) => editProduct("frame", text, id)}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <ProductAutocomplete
                      options={lenses}
                      text={values.lensType}
                      catalogId={values.lensCatalogId}
                      label="Lens Type (Optional)"
                      placeholder="Search, type, or leave blank"
                      productLabel={lensLabel}
                      searchText={lensSearchText}
                      disabled={saving}
                      loading={catalogLoading}
                      error={errors.lensType}
                      onChange={(text, id) => editProduct("lens", text, id)}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Conditional prices and automatic total. */}
            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Pricing Details
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prices are optional. A blank price means it was not recorded.
                </Typography>

                <ToggleButtonGroup
                  exclusive
                  color="primary"
                  size="small"
                  value={values.pricingMode}
                  disabled={saving}
                  onChange={(_, next: unknown) => {
                    if (next === "SPLIT" || next === "MRP_ONLY") {
                      edit("pricingMode", next);
                    }
                  }}
                  sx={{ mt: 2, mb: 2.5, flexWrap: "wrap" }}
                >
                  <ToggleButton value="SPLIT">Separate Rates</ToggleButton>
                  <ToggleButton value="MRP_ONLY">Total MRP Only</ToggleButton>
                </ToggleButtonGroup>

                <Grid container spacing={2}>
                  {values.pricingMode === "SPLIT" ? (
                    <>
                      {hasFrame && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Frame Rate (₹) — Optional"
                            placeholder="Leave blank if unknown"
                            value={values.frameRate}
                            disabled={saving}
                            onChange={(event) => edit("frameRate", event.target.value)}
                            error={Boolean(errors.frameRate)}
                            helperText={errors.frameRate ?? "Enter the frame price if known."}
                            slotProps={{
                              htmlInput: { inputMode: "decimal" },
                            }}
                          />
                        </Grid>
                      )}

                      {hasLens && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Lens Rate (₹) — Optional"
                            placeholder="Leave blank if unknown"
                            value={values.lensRate}
                            disabled={saving}
                            onChange={(event) => edit("lensRate", event.target.value)}
                            error={Boolean(errors.lensRate)}
                            helperText={errors.lensRate ?? "Enter the lens price if known."}
                            slotProps={{
                              htmlInput: { inputMode: "decimal" },
                            }}
                          />
                        </Grid>
                      )}

                      {!hasFrame && !hasLens && (
                        <Grid size={{ xs: 12 }}>
                          <Alert severity="info">Select a frame or lens to enter its rate.</Alert>
                        </Grid>
                      )}
                    </>
                  ) : (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label="Total MRP (₹) — Optional"
                        placeholder="Leave blank if unknown"
                        value={values.mrp}
                        disabled={saving}
                        onChange={(event) => edit("mrp", event.target.value)}
                        error={Boolean(errors.mrp)}
                        helperText={errors.mrp ?? "Enter the total amount if known."}
                        slotProps={{
                          htmlInput: { inputMode: "decimal" },
                        }}
                      />
                    </Grid>
                  )}
                </Grid>

                <Paper
                  variant="outlined"
                  sx={{
                    mt: 2.5,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "action.hover",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                    spacing={1}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {values.pricingMode === "SPLIT"
                          ? "Calculated Total MRP"
                          : "Purchase Total MRP"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {total === null
                          ? "Total is unknown or incomplete."
                          : "Calculated from entered pricing information."}
                      </Typography>
                    </Box>

                    <Typography variant="h5" color="primary" sx={{ fontWeight: 800 }}>
                      {total === null ? "Not recorded" : moneyFormatter.format(total)}
                    </Typography>
                  </Stack>
                </Paper>

                {errors.total && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {errors.total}
                  </Alert>
                )}

                <Alert severity="info" icon={<InfoOutlined />} sx={{ mt: 2 }}>
                  Missing prices should be stored as null. An explicitly entered ₹0 is a valid
                  price.
                </Alert>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, gap: 1, flexWrap: "wrap" }}>
          <Button
            autoFocus
            color="inherit"
            disabled={saving}
            onClick={() => {
              if (!submittingRef.current) onClose();
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            disabled={
              saving || Object.values(errors).some((e) => e !== undefined && e !== null && e !== "")
            }
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <AddOutlined />}
          >
            {saving ? "Saving Purchase..." : "Save Purchase Record"}
          </Button>
        </DialogActions>
      </Box>
    </ResponsiveDialog>
  );
}
