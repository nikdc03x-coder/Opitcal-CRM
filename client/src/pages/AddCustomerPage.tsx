
/**
 * Optical CRM — Add Customer
 *
 * nik - Register a customer, optical prescription,
 * frame/lens products and the first purchase together.
 *
 * Staff can use catalog dropdowns or enter custom names.
 * Pricing mode is separate from the products purchased.
 */

import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import PersonOutlineOutlined from "@mui/icons-material/PersonOutlineOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";

import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
} from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";

import {
  createCustomer,
  type CustomerPayload,
  type EyeValues,
} from "../services/customerApi";

import {
  getFrames,
  getLenses,
  type FrameProduct,
  type LensProduct,
} from "../services/catalogApi";

// -----------------------------------------------------
// 1. OPTICAL PRESCRIPTION CONFIGURATION
// -----------------------------------------------------

const eyes = [
  {
    prefix: "re_dist",
    label: "RE DIST",
    description: "Right Eye · Distance",
  },
  {
    prefix: "re_near",
    label: "RE NEAR",
    description: "Right Eye · Near",
  },
  {
    prefix: "le_dist",
    label: "LE DIST",
    description: "Left Eye · Distance",
  },
  {
    prefix: "le_near",
    label: "LE NEAR",
    description: "Left Eye · Near",
  },
] as const;

type EyePrefix = (typeof eyes)[number]["prefix"];
type EyeMeasure = "sph" | "cyl" | "axis";
type EyeFieldName = `${EyePrefix}_${EyeMeasure}`;

// nik - Common optical powers are offered in 0.25 steps.
// Manual values are also accepted and validated.

function createPowerOptions(min: number, max: number) {
  return Array.from(
    { length: (max - min) * 4 + 1 },
    (_, index) => {
      const value = min + index / 4;

      return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
    }
  );
}

const sphOptions = createPowerOptions(-30, 30);
const cylOptions = createPowerOptions(-15, 15);

// -----------------------------------------------------
// 2. DATE, PRICE AND PRODUCT HELPERS
// -----------------------------------------------------

// Use the shop computer's local calendar date.
function todayLocalDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Validate real calendar dates, including leap years.
function validDate(value: string) {
  if (!value) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validMoney(value: string) {
  return (
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) <= 9999999999.99
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function frameLabel(frame: FrameProduct) {
  return `${frame.brand} - ${frame.model}`;
}

function lensLabel(lens: LensProduct) {
  return [
    lens.company,
    lens.lensName,
    lens.visionType,
    lens.coating,
  ]
    .filter(Boolean)
    .join(" - ");
}

// -----------------------------------------------------
// 3. CUSTOMER FORM VALIDATION
// -----------------------------------------------------

const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Customer name is required.")
      .max(150),

    mobNumber: z.string().refine(
      (value) =>
        value === "" || /^[6-9]\d{9}$/.test(value),
      "Enter a valid 10-digit Indian mobile number."
    ),

    gender: z.enum(["", "Male", "Female", "Other"]),

    reference: z.string().max(255),

    notes: z.string().max(5000),

    purchaseDate: z
      .string()
      .refine(validDate, "Enter a valid purchase date."),

    specsType: z.string().max(
      100,
      "Frame name cannot exceed 100 characters."
    ),

    lensType: z.string().max(
      100,
      "Lens name cannot exceed 100 characters."
    ),

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
    // Only validate the fields used by the pricing mode.
    const priceFields =
      values.pricingMode === "SPLIT"
        ? (["frameRate", "lensRate"] as const)
        : (["mrp"] as const);

    for (const field of priceFields) {
      if (!validMoney(values[field])) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a valid price (maximum 2 decimals).",
        });
      }
    }

    // Validate each optical measurement independently.
    for (const eye of eyes) {
      for (const measure of [
        "sph",
        "cyl",
        "axis",
      ] as const) {
        const key: EyeFieldName =
          `${eye.prefix}_${measure}`;

        const value = values[key].trim();

        if (!value) continue;

        const number = Number(value);

        const limit = measure === "sph" ? 30 : 15;

        const valid =
          measure === "axis"
            ? /^\d+$/.test(value) && number <= 180
            : /^[+-]?\d+(\.\d+)?$/.test(value) &&
              Number.isFinite(number) &&
              Math.abs(number) <= limit;

        if (!valid) {
          context.addIssue({
            code: "custom",
            path: [key],
            message:
              measure === "axis"
                ? "AXIS must be between 0 and 180."
                : `${measure.toUpperCase()} must be between -${limit} and +${limit}.`,
          });
        }
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

// -----------------------------------------------------
// 4. FORM DEFAULT VALUES
// -----------------------------------------------------

const initialValues: FormValues = {
  name: "",
  mobNumber: "",
  gender: "",
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

// -----------------------------------------------------
// 5. REUSABLE INPUT COMPONENTS
// -----------------------------------------------------

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

// nik - A visible searchable SPH/CYL dropdown.
// Do not override Autocomplete's internal input props:
// MUI provides those through the {...params} spread.

function PowerInput({
  control,
  errors,
  disabled,
  name,
  label,
  options,
}: SharedProps & {
  name: EyeFieldName;
  label: string;
  options: string[];
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete<string, false, false, true>
          freeSolo
          fullWidth
          size="small"
          openOnFocus
          forcePopupIcon
          selectOnFocus
          clearOnBlur={false}
          options={options}
          value={field.value}
          inputValue={field.value}
          disabled={disabled}
          onInputChange={(_, next, reason) => {
            if (
              reason === "input" ||
              reason === "clear"
            ) {
              field.onChange(next);
            }
          }}
          onChange={(_, next) => {
            field.onChange(next ?? "");
          }}
          onBlur={field.onBlur}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={field.ref}
              label={label}
              placeholder="Select or type"
              error={Boolean(errors[name])}
              helperText={errors[name]?.message}
            />
          )}
        />
      )}
    />
  );
}

function AxisInput({
  control,
  errors,
  disabled,
  name,
  label,
}: SharedProps & {
  name: EyeFieldName;
  label: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          fullWidth
          size="small"
          label={label}
          placeholder="0–180"
          disabled={disabled}
          error={Boolean(errors[name])}
          helperText={errors[name]?.message}
          onChange={(event) => {
            const next = event.target.value
              .replace(/\D/g, "")
              .slice(0, 3);

            field.onChange(next);
          }}
          slotProps={{
            htmlInput: {
              inputMode: "numeric",
            },
          }}
        />
      )}
    />
  );
}

// -----------------------------------------------------
// 6. PRESCRIPTION PAYLOAD HELPER
// -----------------------------------------------------

function readEye(
  values: FormValues,
  prefix: EyePrefix
): EyeValues | undefined {
  const eye: EyeValues = {};

  for (const measure of [
    "sph",
    "cyl",
    "axis",
  ] as const) {
    const text =
      values[`${prefix}_${measure}`].trim();

    if (text) {
      eye[measure] = Number(text);
    }
  }

  return Object.keys(eye).length ? eye : undefined;
}

// -----------------------------------------------------
// 7. PAGE COMPONENT
// -----------------------------------------------------

export default function AddCustomerPage() {
  const navigate = useNavigate();

  // Protect against duplicate customer submissions.
  const submissionLock = useRef(false);

  const [saveError, setSaveError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  const [catalogLoading, setCatalogLoading] =
    useState(true);

  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: {
      errors,
      isSubmitting,
      isDirty,
      submitCount,
    },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
    mode: "onBlur",
    shouldFocusError: true,
  });

  // Watch fields needed for catalog and price previews.
  const [
    frameCatalogId,
    lensCatalogId,
    specsType,
    lensType,
  ] = useWatch({
    control,
    name: [
      "frameCatalogId",
      "lensCatalogId",
      "specsType",
      "lensType",
    ],
  });

  const [
    pricingMode,
    frameRate,
    lensRate,
    mrp,
  ] = useWatch({
    control,
    name: [
      "pricingMode",
      "frameRate",
      "lensRate",
      "mrp",
    ],
  });

  // ---------------------------------------------------
  // 8. LOAD THE PRODUCT CATALOG
  // ---------------------------------------------------

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        const [frameData, lensData] =
          await Promise.all([
            getFrames(false),
            getLenses(false),
          ]);

        if (!active) return;

        setFrames(frameData);
        setLenses(lensData);
        setCatalogError("");
      } catch (err) {
        if (active) {
          setCatalogError(
            err instanceof Error
              ? err.message
              : "Unable to load product catalog."
          );
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

  // ---------------------------------------------------
  // 9. UNSAVED-CHANGES PROTECTION
  // ---------------------------------------------------

  // nik - Warn before browser refresh or closing a tab
  // while a customer registration is unfinished.

  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      warnBeforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        warnBeforeUnload
      );
    };
  }, [isDirty, isSubmitting]);

  // ---------------------------------------------------
  // 10. PURCHASE PREVIEW
  // ---------------------------------------------------

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

  const total =
    pricingMode === "SPLIT"
      ? validMoney(frameRate) &&
        validMoney(lensRate)
        ? (
            Math.round(Number(frameRate) * 100) +
            Math.round(Number(lensRate) * 100)
          ) / 100
        : null
      : validMoney(mrp)
        ? Number(mrp)
        : null;

  // ---------------------------------------------------
  // 11. SUBMIT CUSTOMER
  // ---------------------------------------------------

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

      const hasPrescription =
        Object.values(prescription).some(Boolean);

      // Manual product names use null catalog IDs.
      const commonRecord = {
        specsType: values.specsType.trim() || null,
        lensType: values.lensType.trim() || null,

        frameCatalogId:
          values.frameCatalogId || null,

        lensCatalogId:
          values.lensCatalogId || null,
      };

      const record: CustomerPayload["record"] =
        values.pricingMode === "SPLIT"
          ? {
              ...commonRecord,
              pricingMode: "SPLIT",
              frameRate: Number(values.frameRate),
              lensRate: Number(values.lensRate),
            }
          : {
              ...commonRecord,
              pricingMode: "MRP_ONLY",
              mrp: Number(values.mrp),
            };

      const payload: CustomerPayload = {
        name: values.name.trim(),

        mobNumber:
          values.mobNumber.trim() || null,

        gender: values.gender || null,

        reference:
          values.reference.trim() || null,

        notes:
          values.notes.trim() || null,

        purchaseDate:
          values.purchaseDate || null,

        prescription:
          hasPrescription
            ? prescription
            : undefined,

        record,
      };

      const customer = await createCustomer(payload);

      navigate(`/customers/${customer.id}`, {
        replace: true,
        state: { saved: true },
      });
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Unable to save customer."
      );
    } finally {
      submissionLock.current = false;
    }
  }

  // ---------------------------------------------------
  // 12. CANCEL REGISTRATION
  // ---------------------------------------------------

  function cancelCreation() {
    if (isSubmitting) return;

    if (
      !isDirty ||
      window.confirm(
        "Discard unsaved customer information?"
      )
    ) {
      navigate("/customers");
    }
  }

  const sharedProps = {
    control,
    errors,
    disabled: isSubmitting,
  };

  // ---------------------------------------------------
  // 13. USER INTERFACE
  // ---------------------------------------------------

  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event) => {
        // nik - Read the form only when the user submits it.
        void handleSubmit(onSubmit)(event);
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

          <Typography
            variant="h4"
            sx={{ fontWeight: 800 }}
          >
            Add New Customer
          </Typography>

          <Typography
            color="text.secondary"
            variant="body2"
            sx={{ mt: 0.75 }}
          >
            Register customer details, prescription
            and purchase information.
          </Typography>
        </Box>

        {/* STATUS MESSAGES */}

        {saveError && (
          <Alert
            severity="error"
            onClose={() => setSaveError("")}
          >
            {saveError}
          </Alert>
        )}

        {catalogError && (
          <Alert severity="warning">
            Product Catalog could not load:{" "}
            {catalogError}. Manual product names
            can still be entered.
          </Alert>
        )}

        {submitCount > 0 &&
          Object.keys(errors).length > 0 && (
            <Alert severity="warning">
              Please correct the highlighted fields
              before saving.
            </Alert>
          )}

        {isSubmitting && (
          <Alert severity="info">
            <Stack
              direction="row"
              spacing={1.5}
              
             sx={{ alignItems: "center" }}>
              <CircularProgress size={18} />

              Saving customer and optical records...
            </Stack>
          </Alert>
        )}

        {/* -----------------------------------------
            PERSONAL INFORMATION
        ----------------------------------------- */}

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              spacing={1}
              
              sx={{ alignItems: "center",  mb: 2.5 }}
            >
              <PersonOutlineOutlined color="primary" />

              <Typography
                variant="h6"
                
               sx={{ fontWeight: 700 }}>
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
                      <MenuItem value="">
                        Not specified
                      </MenuItem>

                      <MenuItem value="Male">
                        Male
                      </MenuItem>

                      <MenuItem value="Female">
                        Female
                      </MenuItem>

                      <MenuItem value="Other">
                        Other
                      </MenuItem>
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
            </Grid>
          </CardContent>
        </Card>

        {/* -----------------------------------------
            OPTICAL PRESCRIPTION
        ----------------------------------------- */}

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              spacing={1}
              
              sx={{ alignItems: "center",  mb: 1 }}
            >
              <VisibilityOutlined color="primary" />

              <Typography
                variant="h6"
                
               sx={{ fontWeight: 700 }}>
                Optical Prescription
              </Typography>

              <Chip
                label="Optional"
                size="small"
                variant="outlined"
              />
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              Select SPH and CYL from searchable
              dropdowns, or type the required power.
            </Typography>

            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflowX: "auto",
              }}
            >
              <Table
                size="small"
                sx={{
                  minWidth: 640,

                  "& .MuiTableCell-root": {
                    px: 1.5,
                    py: 1.5,
                    verticalAlign: "middle",
                  },
                }}
              >
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: "background.default",
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>
                      Eye / Vision
                    </TableCell>

                    <TableCell sx={{ fontWeight: 700 }}>
                      SPH
                    </TableCell>

                    <TableCell sx={{ fontWeight: 700 }}>
                      CYL
                    </TableCell>

                    <TableCell sx={{ fontWeight: 700 }}>
                      AXIS
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {eyes.map((eye) => (
                    <TableRow key={eye.prefix} hover>
                      <TableCell sx={{ minWidth: 150 }}>
                        <Typography
                          variant="subtitle2"
                          
                         sx={{ fontWeight: 700 }}>
                          {eye.label}
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {eye.description}
                        </Typography>
                      </TableCell>

                      <TableCell sx={{ minWidth: 170 }}>
                        <PowerInput
                          {...sharedProps}
                          name={`${eye.prefix}_sph`}
                          label="SPH"
                          options={sphOptions}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 170 }}>
                        <PowerInput
                          {...sharedProps}
                          name={`${eye.prefix}_cyl`}
                          label="CYL"
                          options={cylOptions}
                        />
                      </TableCell>

                      <TableCell sx={{ minWidth: 125 }}>
                        <AxisInput
                          {...sharedProps}
                          name={`${eye.prefix}_axis`}
                          label="AXIS"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1.5 }}
            >
              SPH: −30 to +30 · CYL: −15 to +15 ·
              AXIS: 0–180
            </Typography>
          </CardContent>
        </Card>

        {/* -----------------------------------------
            PURCHASE INFORMATION
        ----------------------------------------- */}

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              
              
              sx={{ justifyContent: "space-between", alignItems: "center",  mb: 2.5 }}
            >
              <Stack
                direction="row"
                spacing={1}
                
               sx={{ alignItems: "center" }}>
                <ShoppingBagOutlined color="primary" />

                <Typography
                  variant="h6"
                  
                 sx={{ fontWeight: 700 }}>
                  Purchase Information
                </Typography>
              </Stack>

              <Chip
                label={purchaseType}
                color={
                  hasFrame || hasLens
                    ? "primary"
                    : "default"
                }
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
                      error={Boolean(
                        errors.purchaseDate
                      )}
                      helperText={
                        errors.purchaseDate?.message ??
                        "Defaults to today; can be changed."
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
                    <Autocomplete<
                      FrameProduct,
                      false,
                      false,
                      true
                    >
                      freeSolo
                      fullWidth
                      openOnFocus
                      forcePopupIcon
                      autoHighlight
                      clearOnBlur={false}
                      disabled={isSubmitting}
                      loading={catalogLoading}
                      options={frames}
                      filterOptions={(
                        options,
                        state
                      ) =>
                        options.filter((frame) =>
                          [
                            frame.brand,
                            frame.model,
                            frame.frameCode,
                            frame.frameStyle,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase()
                            .includes(
                              state.inputValue
                                .toLowerCase()
                                .trim()
                            )
                        )
                      }
                      getOptionLabel={(option) =>
                        typeof option === "string"
                          ? option
                          : frameLabel(option)
                      }
                      isOptionEqualToValue={(
                        option,
                        value
                      ) =>
                        typeof value !== "string" &&
                        option.id === value.id
                      }
                      value={
                        frames.find(
                          (frame) =>
                            frame.id === frameCatalogId
                        ) ?? field.value
                      }
                      inputValue={field.value}
                      onInputChange={(
                        _,
                        text,
                        reason
                      ) => {
                        if (
                          reason === "input" ||
                          reason === "clear"
                        ) {
                          field.onChange(text);

                          setValue(
                            "frameCatalogId",
                            "",
                            { shouldDirty: true }
                          );
                        }
                      }}
                      onChange={(_, selected) => {
                        const product =
                          typeof selected === "string"
                            ? null
                            : selected;

                        const text =
                          typeof selected === "string"
                            ? selected
                            : product
                              ? frameLabel(product)
                              : "";

                        field.onChange(text);

                        setValue(
                          "frameCatalogId",
                          product?.id ?? "",
                          { shouldDirty: true }
                        );
                      }}
                      onBlur={field.onBlur}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Frame / Spectacle"
                          placeholder="Search or type frame"
                          error={Boolean(
                            errors.specsType
                          )}
                          helperText={
                            errors.specsType?.message ??
                            (frameCatalogId
                              ? "Selected from catalog"
                              : "Catalog or custom name")
                          }
                        />
                      )}
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
                    <Autocomplete<
                      LensProduct,
                      false,
                      false,
                      true
                    >
                      freeSolo
                      fullWidth
                      openOnFocus
                      forcePopupIcon
                      autoHighlight
                      clearOnBlur={false}
                      disabled={isSubmitting}
                      loading={catalogLoading}
                      options={lenses}
                      filterOptions={(
                        options,
                        state
                      ) =>
                        options.filter((lens) =>
                          [
                            lens.company,
                            lens.lensName,
                            lens.visionType,
                            lens.coating,
                            lens.lensCode,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase()
                            .includes(
                              state.inputValue
                                .toLowerCase()
                                .trim()
                            )
                        )
                      }
                      getOptionLabel={(option) =>
                        typeof option === "string"
                          ? option
                          : lensLabel(option)
                      }
                      isOptionEqualToValue={(
                        option,
                        value
                      ) =>
                        typeof value !== "string" &&
                        option.id === value.id
                      }
                      value={
                        lenses.find(
                          (lens) =>
                            lens.id === lensCatalogId
                        ) ?? field.value
                      }
                      inputValue={field.value}
                      onInputChange={(
                        _,
                        text,
                        reason
                      ) => {
                        if (
                          reason === "input" ||
                          reason === "clear"
                        ) {
                          field.onChange(text);

                          setValue(
                            "lensCatalogId",
                            "",
                            { shouldDirty: true }
                          );
                        }
                      }}
                      onChange={(_, selected) => {
                        const product =
                          typeof selected === "string"
                            ? null
                            : selected;

                        const text =
                          typeof selected === "string"
                            ? selected
                            : product
                              ? lensLabel(product)
                              : "";

                        field.onChange(text);

                        setValue(
                          "lensCatalogId",
                          product?.id ?? "",
                          { shouldDirty: true }
                        );
                      }}
                      onBlur={field.onBlur}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Lens Type"
                          placeholder="Search or type lens"
                          error={Boolean(
                            errors.lensType
                          )}
                          helperText={
                            errors.lensType?.message ??
                            (lensCatalogId
                              ? "Selected from catalog"
                              : "Catalog or custom name")
                          }
                        />
                      )}
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

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography
              variant="h6"
              
              sx={{ fontWeight: 700,  mb: 0.75 }}
            >
              Pricing Details
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
            >
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
                      setValue(
                        "pricingMode",
                        next as "SPLIT" | "MRP_ONLY",
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        }
                      );
                    }
                  }}
                  sx={{
                    mt: 2,
                    mb: 2.5,
                    flexWrap: "wrap",
                  }}
                >
                  <ToggleButton value="SPLIT">
                    Separate Rates
                  </ToggleButton>

                  <ToggleButton value="MRP_ONLY">
                    Total MRP Only
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            />

            {pricingMode === "SPLIT" ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextInput
                    {...sharedProps}
                    name="frameRate"
                    label="Frame Rate (₹)"
                    inputMode="decimal"
                    required
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormTextInput
                    {...sharedProps}
                    name="lensRate"
                    label="Lens Rate (₹)"
                    inputMode="decimal"
                    required
                  />
                </Grid>
              </Grid>
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
               sx={{ justifyContent: "space-between", alignItems: {
                  sm: "center",
                } }}>
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {pricingMode === "SPLIT"
                      ? "Calculated Total MRP"
                      : "Purchase Total MRP"}
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Based on the currently entered rates.
                  </Typography>
                </Box>

                <Typography
                  variant="h5"
                  color="primary"
                  
                 sx={{ fontWeight: 800 }}>
                  {total === null
                    ? "₹ —"
                    : money(total)}
                </Typography>
              </Stack>
            </Paper>

            <Alert
              severity="info"
              icon={<InfoOutlined />}
              sx={{ mt: 2 }}
            >
              Pricing mode does not decide whether the
              customer bought a frame, lens, or both.
            </Alert>
          </CardContent>
        </Card>

        {/* -----------------------------------------
            INTERNAL STAFF NOTES
        ----------------------------------------- */}

        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Stack
              direction="row"
              
              spacing={1}
              sx={{ alignItems: "center",  mb: 1.5 }}
            >
              <LockOutlined
                color="action"
                fontSize="small"
              />

              <Typography
                variant="subtitle1"
                
               sx={{ fontWeight: 700 }}>
                Private Staff Notes
              </Typography>

              <Chip
                label="Internal"
                variant="outlined"
                size="small"
              />
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
              Staff only. Do not export these notes
              to customer PDFs or WhatsApp messages.
            </Typography>
          </CardContent>
        </Card>

        <Divider />

        {/* -----------------------------------------
            SAVE AND CANCEL
        ----------------------------------------- */}

        <Stack
          direction={{
            xs: "column-reverse",
            sm: "row",
          }}
          
          spacing={1.5}
         sx={{ justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={cancelCreation}
            disabled={isSubmitting}
            sx={{
              borderRadius: 2,
              minWidth: 115,
            }}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            startIcon={
              isSubmitting ? (
                <CircularProgress
                  size={18}
                  color="inherit"
                />
              ) : (
                <SaveOutlined />
              )
            }
            sx={{
              borderRadius: 2,
              minWidth: 175,
              fontWeight: 700,
            }}
          >
            {isSubmitting
              ? "Saving..."
              : "Save Customer"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
