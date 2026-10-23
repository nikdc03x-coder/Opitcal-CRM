/**
 * Optical CRM — Add Customer
 *
 * Register a customer, optical prescription,
 * frame/lens products and the first purchase together.
 *
 * Staff can use catalog dropdowns or enter custom names.
 * Pricing mode is separate from the products purchased.
 */

import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import ArrowBackIosNewOutlined from "@mui/icons-material/ArrowBackIosNewOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";

import { Controller, useForm, useWatch, type Control, type FieldErrors } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";

import { createCustomer } from "../services/customerApi";
import { type CustomerPayload } from "../models/customer";
import { CUSTOMER_AGE_ERROR, parseCustomerAge } from "../utils/customerAge";

import { getFrames, getLenses } from "../services/catalogApi";
import { type FrameProduct, type LensProduct } from "../models/catalog";
import ProductAutocomplete from "../components/customers/ProductAutocomplete";
import OpticalPrescriptionFields, {
  PrescriptionMeasurementInput,
} from "../components/customers/OpticalPrescriptionFields";
import {
  eyes,
  opticalValueError,
  readEye,
  validDate,
  validMoney,
  frameLabel,
  lensLabel,
  frameSearchText,
  lensSearchText,
  type EyeFieldName,
} from "../utils/opticalForm";

// 2. DATE, PRICE AND PRODUCT HELPERS

// Use the shop computer's local calendar date.
function todayLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Customer name is required.").max(150),

    mobNumber: z
      .string()
      .refine(
        (value) => value === "" || /^[6-9]\d{9}$/.test(value),
        "Enter a valid 10-digit Indian mobile number.",
      ),

    gender: z.enum(["", "Male", "Female", "Other"]),

    ageAtRecording: z
      .string()
      .refine((value) => parseCustomerAge(value) !== undefined, CUSTOMER_AGE_ERROR),

    reference: z.string().max(255),

    notes: z.string().max(5000),

    purchaseDate: z.string().refine(validDate, "Enter a valid purchase date."),

    specsType: z.string().max(100, "Frame name cannot exceed 100 characters."),

    lensType: z.string().max(100, "Lens name cannot exceed 100 characters."),

    frameCatalogId: z.string(),
    lensCatalogId: z.string(),

    pricingMode: z.enum(["SPLIT", "MRP_ONLY"]),

    frameRate: z.string(),
    lensRate: z.string(),
    mrp: z.string(),

    re_dist_sph: z.string(),
    re_dist_cyl: z.string(),
    re_dist_axis: z.string(),

    re_near_sph: z.string(),
    re_near_cyl: z.string(),
    re_near_axis: z.string(),

    le_dist_sph: z.string(),
    le_dist_cyl: z.string(),
    le_dist_axis: z.string(),

    le_near_sph: z.string(),
    le_near_cyl: z.string(),
    le_near_axis: z.string(),
  })
  .superRefine((values, context) => {
    // Validate only prices for products actually selected. Hidden rates are ignored.
    const hasFrame = Boolean(values.specsType.trim() || values.frameCatalogId);
    const hasLens = Boolean(values.lensType.trim() || values.lensCatalogId);
    const priceFields: Array<"frameRate" | "lensRate" | "mrp"> =
      values.pricingMode === "MRP_ONLY"
        ? ["mrp"]
        : [
            ...(hasFrame ? (["frameRate"] as const) : []),
            ...(hasLens ? (["lensRate"] as const) : []),
          ];

    for (const field of priceFields) {
      if (!validMoney(values[field]) || values[field].trim() === "") {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a valid price (maximum 2 decimals).",
        });
      }
    }

    // Both customer creation and New Purchase use these optical rules.
    for (const eye of eyes) {
      for (const measure of ["sph", "cyl", "axis"] as const) {
        const key: EyeFieldName = `${eye.prefix}_${measure}`;
        const message = opticalValueError(values[key], measure);
        if (message) context.addIssue({ code: "custom", path: [key], message });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const initialValues: FormValues = {
  name: "",
  mobNumber: "",
  gender: "",
  ageAtRecording: "",
  reference: "",
  notes: "",

  purchaseDate: todayLocalDate(),

  specsType: "",
  lensType: "",

  frameCatalogId: "",
  lensCatalogId: "",

  pricingMode: "SPLIT",

  frameRate: "",
  lensRate: "",
  mrp: "",

  re_dist_sph: "",
  re_dist_cyl: "",
  re_dist_axis: "",

  re_near_sph: "",
  re_near_cyl: "",
  re_near_axis: "",

  le_dist_sph: "",
  le_dist_cyl: "",
  le_dist_axis: "",

  le_near_sph: "",
  le_near_cyl: "",
  le_near_axis: "",
};

type SharedProps = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  disabled: boolean;
};

type FormTextInputProps = SharedProps & {
  name: keyof FormValues;
  label: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?: "numeric" | "decimal";
  maxLength?: number;
};

function FormTextInput({
  control,
  errors,
  disabled,
  name,
  label,
  required,
  multiline,
  rows,
  inputMode,
  maxLength,
}: FormTextInputProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          fullWidth
          label={label}
          required={required}
          multiline={multiline}
          rows={rows}
          disabled={disabled}
          error={Boolean(errors[name])}
          helperText={errors[name]?.message}
          slotProps={{
            htmlInput: {
              ...(inputMode ? { inputMode } : {}),
              ...(maxLength ? { maxLength } : {}),
            },
          }}
        />
      )}
    />
  );
}

export default function AddCustomerPage() {
  const navigate = useNavigate();

  // Protect against duplicate customer submissions.
  const submissionLock = useRef(false);

  const [saveError, setSaveError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [stepChecking, setStepChecking] = useState(false);

  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    trigger,
    getValues,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
    mode: "onBlur",
    shouldFocusError: true,
  });

  // Watch fields needed for catalog and price previews.
  const [frameCatalogId, lensCatalogId, specsType, lensType] = useWatch({
    control,
    name: ["frameCatalogId", "lensCatalogId", "specsType", "lensType"],
  });

  const [pricingMode, frameRate, lensRate, mrp] = useWatch({
    control,
    name: ["pricingMode", "frameRate", "lensRate", "mrp"],
  });

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const [frameData, lensData] = await Promise.all([getFrames(false), getLenses(false)]);

        if (!active) return;

        setFrames(frameData);
        setLenses(lensData);
        setCatalogError("");
      } catch (err) {
        if (active) {
          setCatalogError(err instanceof Error ? err.message : "Unable to load product catalog.");
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  // Warn before browser refresh or closing a tab
  // while a customer registration is unfinished.

  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [isDirty, isSubmitting]);

  // Purchase type depends on actual product names,
  // not on whether prices are split.

  const hasFrame = Boolean(specsType.trim());
  const hasLens = Boolean(lensType.trim());

  const purchaseType =
    hasFrame && hasLens
      ? "Frame + Lens"
      : hasFrame
        ? "Frame Only"
        : hasLens
          ? "Lens Only"
          : "Not Specified";

  // Calculate from selected products only; never count a hidden stale rate.
  const splitRatesValid =
    (!hasFrame || (frameRate.trim() !== "" && validMoney(frameRate))) &&
    (!hasLens || (lensRate.trim() !== "" && validMoney(lensRate)));
  const total =
    pricingMode === "SPLIT"
      ? splitRatesValid && (hasFrame || hasLens)
        ? (Math.round((hasFrame ? Number(frameRate) : 0) * 100) +
            Math.round((hasLens ? Number(lensRate) : 0) * 100)) /
          100
        : null
      : mrp.trim() !== "" && validMoney(mrp)
        ? Number(mrp)
        : null;

  async function onSubmit(values: FormValues) {
    if (submissionLock.current) return;

    submissionLock.current = true;
    setSaveError("");

    try {
      const prescription = {
        re_dist: readEye(values, "re_dist"),
        re_near: readEye(values, "re_near"),
        le_dist: readEye(values, "le_dist"),
        le_near: readEye(values, "le_near"),
      };

      const hasPrescription = Object.values(prescription).some(Boolean);

      // Manual product names use null catalog IDs.
      const commonRecord = {
        specsType: values.specsType.trim() || null,
        lensType: values.lensType.trim() || null,

        frameCatalogId: values.frameCatalogId || null,

        lensCatalogId: values.lensCatalogId || null,
      };

      const record: CustomerPayload["record"] =
        values.pricingMode === "SPLIT"
          ? {
              ...commonRecord,
              pricingMode: "SPLIT",
              // Preserve the existing numeric API contract; unselected items cost zero.
              frameRate:
                values.specsType.trim() || values.frameCatalogId ? Number(values.frameRate) : 0,
              lensRate:
                values.lensType.trim() || values.lensCatalogId ? Number(values.lensRate) : 0,
            }
          : {
              ...commonRecord,
              pricingMode: "MRP_ONLY",
              mrp: Number(values.mrp),
            };

      const payload: CustomerPayload = {
        name: values.name.trim(),

        mobNumber: values.mobNumber.trim() || null,

        gender: values.gender || null,

        ageAtRecording: parseCustomerAge(values.ageAtRecording) ?? null,

        reference: values.reference.trim() || null,

        notes: values.notes.trim() || null,

        purchaseDate: values.purchaseDate || null,

        prescription: hasPrescription ? prescription : undefined,

        record,
      };

      const customer = await createCustomer(payload);

      navigate(`/customers/${customer.id}`, {
        replace: true,
        state: { saved: true },
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save customer.");
    } finally {
      submissionLock.current = false;
    }
  }

  function cancelCreation() {
    if (isSubmitting) return;

    if (!isDirty || window.confirm("Discard unsaved customer information?")) {
      navigate("/customers");
    }
  }

  const stepLabels = ["Customer", "Prescription", "Purchase & Pricing", "Review & Save"];

  // Validate the current section before moving forward; preserve all entered values.
  async function nextStep() {
    if (isSubmitting || stepChecking || activeStep >= 3) return;
    const fields: (keyof FormValues)[] =
      activeStep === 0
        ? ["name", "mobNumber", "gender", "ageAtRecording", "reference"]
        : activeStep === 1
          ? [
              "re_dist_sph",
              "re_dist_cyl",
              "re_dist_axis",
              "re_near_sph",
              "re_near_cyl",
              "re_near_axis",
              "le_dist_sph",
              "le_dist_cyl",
              "le_dist_axis",
              "le_near_sph",
              "le_near_cyl",
              "le_near_axis",
            ]
          : ["purchaseDate", "specsType", "lensType", "frameRate", "lensRate", "mrp", "notes"];
    setStepChecking(true);
    try {
      const valid = await trigger(fields, { shouldFocus: true });
      if (valid) {
        setActiveStep((current) => Math.min(3, current + 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setStepChecking(false);
    }
  }

  function previousStep() {
    setActiveStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onInvalid(errorsFound: FieldErrors<FormValues>) {
    const keys = Object.keys(errorsFound);
    const customerFields = ["name", "mobNumber", "gender", "ageAtRecording", "reference"];
    const rxFields = [
      "re_dist_sph",
      "re_dist_cyl",
      "re_dist_axis",
      "re_near_sph",
      "re_near_cyl",
      "re_near_axis",
      "le_dist_sph",
      "le_dist_cyl",
      "le_dist_axis",
      "le_near_sph",
      "le_near_cyl",
      "le_near_axis",
    ];
    if (keys.some((key) => customerFields.includes(key))) setActiveStep(0);
    else if (keys.some((key) => rxFields.includes(key))) setActiveStep(1);
    else setActiveStep(2);
    setSaveError("Please correct the highlighted fields before saving.");
  }

  const sharedProps = {
    control,
    errors,
    disabled: isSubmitting,
  };

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        // Read the form only when the user submits it.
        if (activeStep !== 3) {
          event.preventDefault();
          void nextStep();
          return;
        }
        void handleSubmit(onSubmit, onInvalid)(event);
      }}
      sx={{
        maxWidth: 1160,
        mx: "auto",
        pb: 5,
      }}
    >
      <Stack spacing={2.5}>
        {/* HEADER */}

        <Box>
          <Button
            startIcon={<ArrowBackOutlined />}
            onClick={cancelCreation}
            disabled={isSubmitting}
            size="small"
            sx={{ mb: 1.5 }}
          >
            Back to Customers
          </Button>

          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Add New Customer
          </Typography>

          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75 }}>
            A simple guided workflow to register customer details, prescription and purchase.
          </Typography>
        </Box>

        {/* STATUS MESSAGES */}

        {saveError && (
          <Alert severity="error" onClose={() => setSaveError("")}>
            {saveError}
          </Alert>
        )}

        {catalogError && (
          <Alert severity="warning">
            Product Catalog could not load: {catalogError}. Manual product names can still be
            entered.
          </Alert>
        )}

        {submitCount > 0 && Object.keys(errors).length > 0 && (
          <Alert severity="warning">Please correct the highlighted fields before saving.</Alert>
        )}

        {isSubmitting && (
          <Alert severity="info">
            <Stack
              direction="row"
              spacing={1.5}

              sx={{ alignItems: "center" }}
            >
              <CircularProgress size={18} />
              Saving customer and optical records...
            </Stack>
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3 }}>
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            sx={{ "& .MuiStepLabel-label": { fontSize: { xs: "0.68rem", sm: "0.85rem" } } }}
          >
            {stepLabels.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
            Step {activeStep + 1} of 4 · {stepLabels[activeStep]}
          </Typography>
        </Paper>
        {activeStep === 0 && (
          <>
            {/* -----------------------------------------
            PERSONAL INFORMATION
        ----------------------------------------- */}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack
                  direction="row"
                  spacing={1}

                  sx={{ alignItems: "center", mb: 2.5 }}
                >
                  <PersonOutlineOutlined color="primary" />

                  <Typography
                    variant="h6"

                    sx={{ fontWeight: 700 }}
                  >
                    Personal Information
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormTextInput
                      {...sharedProps}
                      name="name"
                      label="Customer Name"
                      required
                      maxLength={150}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormTextInput
                      {...sharedProps}
                      name="mobNumber"
                      label="Mobile Number"
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          select
                          label="Gender"
                          disabled={isSubmitting}
                        >
                          <MenuItem value="">Not specified</MenuItem>

                          <MenuItem value="Male">Male</MenuItem>

                          <MenuItem value="Female">Female</MenuItem>

                          <MenuItem value="Other">Other</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormTextInput
                      {...sharedProps}
                      name="reference"
                      label="Reference / Referred By"
                      maxLength={255}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormTextInput
                      {...sharedProps}
                      name="ageAtRecording"
                      label="Age at recording (optional)"
                      inputMode="numeric"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}
        {activeStep === 1 && (
          <>
            {/* -----------------------------------------
            OPTICAL PRESCRIPTION
        ----------------------------------------- */}

            <OpticalPrescriptionFields
              renderField={(name, measure, options, label) => (
                <Controller
                  key={name}
                  name={name}
                  control={control}
                  render={({ field }) => (
                    <PrescriptionMeasurementInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      measure={measure}
                      options={options}
                      label={label}
                      disabled={isSubmitting}
                      error={errors[name]?.message}
                    />
                  )}
                />
              )}
            />
          </>
        )}
        {activeStep === 2 && (
          <>
            {/* -----------------------------------------
            PURCHASE INFORMATION
        ----------------------------------------- */}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack
                  direction="row"

                  sx={{ justifyContent: "space-between", alignItems: "center", mb: 2.5 }}
                >
                  <Stack
                    direction="row"
                    spacing={1}

                    sx={{ alignItems: "center" }}
                  >
                    <ShoppingBagOutlined color="primary" />

                    <Typography
                      variant="h6"

                      sx={{ fontWeight: 700 }}
                    >
                      Purchase Information
                    </Typography>
                  </Stack>

                  <Chip
                    label={purchaseType}
                    color={hasFrame || hasLens ? "primary" : "default"}
                    variant="outlined"
                    size="small"
                  />
                </Stack>

                <Grid container spacing={2}>
                  {/* PURCHASE DATE */}

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="purchaseDate"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          type="date"
                          label="Date of Purchase"
                          disabled={isSubmitting}
                          error={Boolean(errors.purchaseDate)}
                          helperText={
                            errors.purchaseDate?.message ?? "Defaults to today; can be changed."
                          }
                          slotProps={{
                            inputLabel: { shrink: true },
                          }}
                        />
                      )}
                    />
                  </Grid>

                  {/* FRAME CATALOG DROPDOWN */}

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="specsType"
                      control={control}
                      render={({ field }) => (
                        <ProductAutocomplete
                          options={frames}
                          text={field.value}
                          catalogId={frameCatalogId}
                          label="Frame / Spectacle"
                          placeholder="Search or type frame"
                          productLabel={frameLabel}
                          searchText={frameSearchText}
                          disabled={isSubmitting}
                          loading={catalogLoading}
                          onBlur={field.onBlur}
                          inputRef={field.ref}
                          error={errors.specsType?.message}
                          onChange={(text, id) => {
                            field.onChange(text);
                            setValue("frameCatalogId", id, { shouldDirty: true });
                          }}
                        />
                      )}
                    />
                  </Grid>

                  {/* LENS CATALOG DROPDOWN */}

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="lensType"
                      control={control}
                      render={({ field }) => (
                        <ProductAutocomplete
                          options={lenses}
                          text={field.value}
                          catalogId={lensCatalogId}
                          label="Lens Type"
                          placeholder="Search or type lens"
                          productLabel={lensLabel}
                          searchText={lensSearchText}
                          disabled={isSubmitting}
                          loading={catalogLoading}
                          onBlur={field.onBlur}
                          inputRef={field.ref}
                          error={errors.lensType?.message}
                          onChange={(text, id) => {
                            field.onChange(text);
                            setValue("lensCatalogId", id, { shouldDirty: true });
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* -----------------------------------------
            PRICING INFORMATION
        ----------------------------------------- */}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography
                  variant="h6"

                  sx={{ fontWeight: 700, mb: 0.75 }}
                >
                  Pricing Details
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Choose how the purchase price is entered.
                </Typography>

                <Controller
                  name="pricingMode"
                  control={control}
                  render={({ field }) => (
                    <ToggleButtonGroup
                      exclusive
                      color="primary"
                      size="small"
                      value={field.value}
                      disabled={isSubmitting}
                      onChange={(_, next) => {
                        if (next !== null) {
                          setValue("pricingMode", next as "SPLIT" | "MRP_ONLY", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      sx={{
                        mt: 2,
                        mb: 2.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <ToggleButton value="SPLIT">Separate Rates</ToggleButton>

                      <ToggleButton value="MRP_ONLY">Total MRP Only</ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />

                {pricingMode === "SPLIT" ? (
                  <Stack spacing={1.5}>
                    {!hasFrame && !hasLens && (
                      <Alert severity="info">
                        Select a frame or lens above to enter its price.
                      </Alert>
                    )}
                    <Grid container spacing={2}>
                      {hasFrame && (
                        <Grid size={{ xs: 12, sm: hasLens ? 6 : 12 }}>
                          <FormTextInput
                            {...sharedProps}
                            name="frameRate"
                            label="Frame MRP (₹)"
                            inputMode="decimal"
                            required
                          />
                        </Grid>
                      )}
                      {hasLens && (
                        <Grid size={{ xs: 12, sm: hasFrame ? 6 : 12 }}>
                          <FormTextInput
                            {...sharedProps}
                            name="lensRate"
                            label="Lens MRP (₹)"
                            inputMode="decimal"
                            required
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Stack>
                ) : (
                  <FormTextInput
                    {...sharedProps}
                    name="mrp"
                    label="Total MRP (₹)"
                    inputMode="decimal"
                    required
                  />
                )}

                {/* LIVE TOTAL */}

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
                    direction={{
                      xs: "column",
                      sm: "row",
                    }}

                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: {
                        sm: "center",
                      },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {pricingMode === "SPLIT" ? "Calculated Total MRP" : "Purchase Total MRP"}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        {pricingMode === "SPLIT"
                          ? "Only selected products are included."
                          : "Total entered for this purchase."}
                      </Typography>
                    </Box>

                    <Typography
                      variant="h5"
                      color="primary"

                      sx={{ fontWeight: 800 }}
                    >
                      {total === null ? "₹ —" : money(total)}
                    </Typography>
                  </Stack>
                </Paper>

                <Alert severity="info" icon={<InfoOutlined />} sx={{ mt: 2 }}>
                  Pricing mode does not decide whether the customer bought a frame, lens, or both.
                </Alert>
              </CardContent>
            </Card>

            {/* -----------------------------------------
            INTERNAL STAFF NOTES
        ----------------------------------------- */}

            <Card variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack
                  direction="row"

                  spacing={1}
                  sx={{ alignItems: "center", mb: 1.5 }}
                >
                  <LockOutlined color="action" fontSize="small" />

                  <Typography
                    variant="subtitle1"

                    sx={{ fontWeight: 700 }}
                  >
                    Private Staff Notes
                  </Typography>

                  <Chip label="Internal" variant="outlined" size="small" />
                </Stack>

                <FormTextInput
                  {...sharedProps}
                  name="notes"
                  label="Internal Notes"
                  multiline
                  rows={3}
                  maxLength={5000}
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    mt: 1,
                  }}
                >
                  Staff only. Do not export these notes to customer PDFs or WhatsApp messages.
                </Typography>
              </CardContent>
            </Card>
          </>
        )}
        {activeStep === 3 &&
          (() => {
            const values = getValues();
            const hasRx = [
              "re_dist_sph",
              "re_dist_cyl",
              "re_dist_axis",
              "re_near_sph",
              "re_near_cyl",
              "re_near_axis",
              "le_dist_sph",
              "le_dist_cyl",
              "le_dist_axis",
              "le_near_sph",
              "le_near_cyl",
              "le_near_axis",
            ].some((key) => Boolean(values[key as keyof FormValues]?.trim()));
            return (
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 750 }}>
                  Review customer registration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Confirm the information below before saving to the database.
                </Typography>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>Customer information</Typography>
                      <Button size="small" onClick={() => setActiveStep(0)}>
                        Edit
                      </Button>
                    </Stack>
                    <Typography variant="body2">
                      <strong>Name:</strong> {values.name || "Not provided"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Mobile:</strong> {values.mobNumber || "Not provided"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Gender:</strong> {values.gender || "Not specified"} ·{" "}
                      <strong>Age:</strong> {values.ageAtRecording || "Not specified"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Reference:</strong> {values.reference || "Not specified"}
                    </Typography>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>Optical prescription</Typography>
                      <Button size="small" onClick={() => setActiveStep(1)}>
                        Edit
                      </Button>
                    </Stack>
                    {hasRx ? (
                      <Grid container spacing={1}>
                        {(["re_dist", "re_near", "le_dist", "le_near"] as const).map((eye) => (
                          <Grid size={{ xs: 12, sm: 6 }} key={eye}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {eye
                                .replace("re", "Right eye")
                                .replace("le", "Left eye")
                                .replace("_dist", " · Distance")
                                .replace("_near", " · Near")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              SPH: {values[`${eye}_sph`] || "—"} · CYL:{" "}
                              {values[`${eye}_cyl`] || "—"} · AXIS: {values[`${eye}_axis`] || "—"}
                            </Typography>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No prescription entered
                      </Typography>
                    )}
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
                    >
                      <Typography sx={{ fontWeight: 700 }}>Purchase & pricing</Typography>
                      <Button size="small" onClick={() => setActiveStep(2)}>
                        Edit
                      </Button>
                    </Stack>
                    <Typography variant="body2">
                      <strong>Date:</strong> {values.purchaseDate}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Frame:</strong> {values.specsType || "Not selected"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Lens:</strong> {values.lensType || "Not selected"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Purchase type:</strong> {purchaseType}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Pricing:</strong>{" "}
                      {values.pricingMode === "SPLIT" ? "Separate rates" : "Total MRP only"}
                    </Typography>
                    {values.pricingMode === "SPLIT" && values.specsType.trim() && (
                      <Typography variant="body2">
                        <strong>Frame MRP:</strong> {money(Number(values.frameRate))}
                      </Typography>
                    )}
                    {values.pricingMode === "SPLIT" && values.lensType.trim() && (
                      <Typography variant="body2">
                        <strong>Lens MRP:</strong> {money(Number(values.lensRate))}
                      </Typography>
                    )}
                    <Typography variant="h6" color="primary" sx={{ mt: 1, fontWeight: 800 }}>
                      Total: {total === null ? "₹ —" : money(total)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Private notes: {values.notes.trim() ? "Added (staff only)" : "None"}
                    </Typography>
                  </CardContent>
                </Card>
              </Stack>
            );
          })()}
        <Divider />
        <Stack
          direction={{ xs: "column-reverse", sm: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Button variant="text" onClick={cancelCreation} disabled={isSubmitting}>
            Cancel registration
          </Button>
          <Stack direction="row" spacing={1.5} sx={{ width: { xs: "100%", sm: "auto" } }}>
            {activeStep > 0 && (
              <Button
                variant="outlined"
                onClick={previousStep}
                disabled={isSubmitting || stepChecking}
                startIcon={<ArrowBackIosNewOutlined />}
                sx={{ flex: { xs: 1, sm: "none" } }}
              >
                Back
              </Button>
            )}
            {activeStep < 3 ? (
              <Button
                type="button"
                variant="contained"
                onClick={() => void nextStep()}
                disabled={isSubmitting || stepChecking}
                endIcon={<ArrowForwardOutlined />}
                sx={{ flex: { xs: 1, sm: "none" }, minWidth: { xs: 0, sm: 170 } }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting || stepChecking}
                startIcon={
                  isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SaveOutlined />
                }
                sx={{ flex: { xs: 1, sm: "none" }, minWidth: { xs: 0, sm: 185 }, fontWeight: 700 }}
              >
                {isSubmitting ? "Saving..." : "Save Customer"}
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
