
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
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

import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";

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

// -----------------------------------------------------
// 1. OPTICAL PRESCRIPTION CONFIGURATION
// -----------------------------------------------------

// nik - Keep eye measurements in the same order
// throughout Add, Edit and Customer Details pages.
const eyePrefixes = [
  "re_dist",
  "re_near",
  "le_dist",
  "le_near",
] as const;

type EyePrefix = (typeof eyePrefixes)[number];
type EyeMeasure = "sph" | "cyl" | "axis";
type EyeFieldName = `${EyePrefix}_${EyeMeasure}`;

const prescriptionGroups: {
  prefix: EyePrefix;
  label: string;
  description: string;
}[] = [
  {
    prefix: "re_dist",
    label: "RE DIST",
    description: "Right Eye Distance",
  },
  {
    prefix: "re_near",
    label: "RE NEAR",
    description: "Right Eye Near",
  },
  {
    prefix: "le_dist",
    label: "LE DIST",
    description: "Left Eye Distance",
  },
  {
    prefix: "le_near",
    label: "LE NEAR",
    description: "Left Eye Near",
  },
];

// Generate searchable eye powers in 0.25 steps.
function powerOptions(min: number, max: number): string[] {
  const options: string[] = [];

  for (
    let quarter = min * 4;
    quarter <= max * 4;
    quarter++
  ) {
    const power = quarter / 4;

    options.push(
      `${power > 0 ? "+" : ""}${power.toFixed(2)}`
    );
  }

  return options;
}

const sphOptions = powerOptions(-30, 30);
const cylOptions = powerOptions(-15, 15);

// -----------------------------------------------------
// 2. VALIDATION HELPERS
// -----------------------------------------------------

// Validate an actual calendar date, not only its format.
function validPurchaseDate(value: string): boolean {
  if (value === "") return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Prices must be nonnegative with at most two decimals.
const moneyField = z.string().refine(
  (value) =>
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) <= 9999999999.99,
  "Enter a valid amount with at most 2 decimal places."
);

// Keep eye measurements as strings while editing.
const optionalPower = z.string();

// -----------------------------------------------------
// 3. CUSTOMER FORM SCHEMA
// -----------------------------------------------------

const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Customer name is required.")
      .max(150, "Maximum 150 characters."),

    mobNumber: z.string().refine(
      (value) =>
        value === "" || /^[6-9]\d{9}$/.test(value),
      "Enter a valid 10-digit Indian mobile number."
    ),

    gender: z.enum(["", "Male", "Female", "Other"]),

    reference: z
      .string()
      .max(255, "Maximum 255 characters."),

    notes: z
      .string()
      .max(5000, "Maximum 5000 characters."),

    // Actual date of purchase.
    // A blank value means the date is not recorded.
    purchaseDate: z
      .string()
      .refine(
        validPurchaseDate,
        "Enter a valid purchase date."
      ),

    specsType: z
      .string()
      .max(100, "Maximum 100 characters."),

    lensType: z
      .string()
      .max(100, "Maximum 100 characters."),

    pricingMode: z.enum(["SPLIT", "MRP_ONLY"]),

    frameRate: z.string(),
    lensRate: z.string(),
    mrp: z.string(),

    re_dist_sph: optionalPower,
    re_dist_cyl: optionalPower,
    re_dist_axis: optionalPower,

    re_near_sph: optionalPower,
    re_near_cyl: optionalPower,
    re_near_axis: optionalPower,

    le_dist_sph: optionalPower,
    le_dist_cyl: optionalPower,
    le_dist_axis: optionalPower,

    le_near_sph: optionalPower,
    le_near_cyl: optionalPower,
    le_near_axis: optionalPower,
  })
  .superRefine((data, context) => {
    // Validate prices based on the selected mode.
    const priceFields =
      data.pricingMode === "SPLIT"
        ? (["frameRate", "lensRate"] as const)
        : (["mrp"] as const);

    for (const field of priceFields) {
      if (!moneyField.safeParse(data[field]).success) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Enter a valid price (max 2 decimals).",
        });
      }
    }

    // Validate each of the 12 eye measurements.
    for (const prefix of eyePrefixes) {
      for (const measure of [
        "sph",
        "cyl",
        "axis",
      ] as const) {
        const key: EyeFieldName =
          `${prefix}_${measure}`;

        const value = data[key].trim();

        if (value === "") continue;

        if (measure === "axis") {
          // AXIS is a whole number from 0 to 180.
          if (
            !/^\d+$/.test(value) ||
            Number(value) > 180
          ) {
            context.addIssue({
              code: "custom",
              path: [key],
              message:
                "AXIS must be a whole number from 0 to 180.",
            });
          }
        } else {
          const limit = measure === "sph" ? 30 : 15;

          if (
            !/^[+-]?\d+(\.\d+)?$/.test(value) ||
            !Number.isFinite(Number(value)) ||
            Number(value) < -limit ||
            Number(value) > limit
          ) {
            context.addIssue({
              code: "custom",
              path: [key],
              message:
                `${measure.toUpperCase()} must be between -${limit} and +${limit}.`,
            });
          }
        }
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

// -----------------------------------------------------
// 4. DEFAULT FORM VALUES
// -----------------------------------------------------

const initialValues: FormValues = {
  name: "",
  mobNumber: "",
  gender: "",
  reference: "",
  notes: "",

  // Do not assume the purchase was made today.
  purchaseDate: "",

  specsType: "",
  lensType: "",

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
// 5. PRESCRIPTION PAYLOAD HELPER
// -----------------------------------------------------

// Convert nonempty measurements to numbers.
// Missing measurements remain undefined.
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
    const field: EyeFieldName =
      `${prefix}_${measure}`;

    const value = values[field].trim();

    if (value !== "") {
      eye[measure] = Number(value);
    }
  }

  return Object.keys(eye).length > 0
    ? eye
    : undefined;
}

// -----------------------------------------------------
// 6. REUSABLE FORM INPUT COMPONENTS
// -----------------------------------------------------

type SharedFormProps = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  disabled: boolean;
};

type TextInputProps = SharedFormProps & {
  name: keyof FormValues;
  label: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  inputMode?: "decimal" | "numeric";
  maxLength?: number;
};

// A normal text field connected to React Hook Form.
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
}: TextInputProps) {
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

type PowerInputProps = SharedFormProps & {
  name: EyeFieldName;
  label: string;
  options: string[];
};

// SPH and CYL use searchable MUI dropdowns.
function PrescriptionPowerInput({
  control,
  errors,
  disabled,
  name,
  label,
  options,
}: PowerInputProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Autocomplete
          freeSolo
          fullWidth
          size="small"
          options={options}
          value={field.value}
          inputValue={field.value}
          disabled={disabled}
          onInputChange={(_, value, reason) => {
            if (
              reason === "input" ||
              reason === "clear"
            ) {
              field.onChange(value);
            }
          }}
          onChange={(_, value) => {
            field.onChange(value ?? "");
          }}
          onBlur={field.onBlur}
          renderInput={(params) => (
            <TextField
              {...params}
              inputRef={field.ref}
              label={label}
              placeholder="Power"
              error={Boolean(errors[name])}
              helperText={errors[name]?.message}
            />
          )}
        />
      )}
    />
  );
}

type AxisInputProps = SharedFormProps & {
  name: EyeFieldName;
  label: string;
};

// AXIS is typed manually, without a dropdown.
function AxisInput({
  control,
  errors,
  disabled,
  name,
  label,
}: AxisInputProps) {
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
          onChange={(event) => {
            const value = event.target.value
              .replace(/\D/g, "")
              .slice(0, 3);

            field.onChange(value);
          }}
          error={Boolean(errors[name])}
          helperText={errors[name]?.message}
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
// 7. ADD CUSTOMER PAGE
// -----------------------------------------------------

// nik - Register customers with optional optical
// prescriptions and a purchase with an optional date.
export default function AddCustomerPage() {
  const navigate = useNavigate();

  const [saveError, setSaveError] = useState("");
  const submissionLock = useRef(false);

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

  // Watch pricing fields for live total calculation.
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

  const frameValid =
    moneyField.safeParse(frameRate).success;

  const lensValid =
    moneyField.safeParse(lensRate).success;

  const mrpValid =
    moneyField.safeParse(mrp).success;

  const total =
    pricingMode === "SPLIT"
      ? frameValid && lensValid
        ? (
            Math.round(Number(frameRate) * 100) +
            Math.round(Number(lensRate) * 100)
          ) / 100
        : null
      : mrpValid
        ? Number(mrp)
        : null;

  // Warn about an unfinished new customer on reload.
  useEffect(() => {
    if (!isDirty || isSubmitting) return;

    const warnBeforeUnload = (
      event: BeforeUnloadEvent
    ) => {
      event.preventDefault();
      event.returnValue = "";
    };

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

  // -----------------------------------------------------
  // 8. SAVE CUSTOMER
  // -----------------------------------------------------

  async function onSubmit(values: FormValues) {
    // Prevent accidental double-click submissions.
    if (submissionLock.current) return;

    submissionLock.current = true;
    setSaveError("");

    // Build the optional prescription.
    const prescription = {
      re_dist: readEye(values, "re_dist"),
      re_near: readEye(values, "re_near"),
      le_dist: readEye(values, "le_dist"),
      le_near: readEye(values, "le_near"),
    };

    const hasPrescription = Object.values(
      prescription
    ).some((value) => value !== undefined);

    const commonRecord = {
      specsType: values.specsType.trim() || null,
      lensType: values.lensType.trim() || null,
    };

    // The server calculates total MRP again.
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

      mobNumber: values.mobNumber.trim() || null,

      gender: values.gender || null,

      reference: values.reference.trim() || null,

      // Never send private notes to customer PDFs.
      notes: values.notes.trim() || null,

      prescription: hasPrescription
        ? prescription
        : undefined,

      record,

      // Date is separate from the record creation time.
      // Blank dates are explicitly stored as null.
      purchaseDate: values.purchaseDate || null,
    };

    try {
      const customer = await createCustomer(payload);

      // Only redirect when the API confirms creation.
      navigate(`/customers/${customer.id}`, {
        replace: true,
        state: {
          saved: true,
        },
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Unable to save the customer."
      );
    } finally {
      submissionLock.current = false;
    }
  }

  // -----------------------------------------------------
  // 9. CANCEL WITH UNSAVED CHANGE WARNING
  // -----------------------------------------------------

  function cancelCreation() {
    if (isSubmitting) return;

    if (
      !isDirty ||
      window.confirm(
        "Discard unsaved customer details?"
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

  // -----------------------------------------------------
  // 10. MAIN PAGE
  // -----------------------------------------------------

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      sx={{ maxWidth: 1150, mx: "auto" }}
    >
      <Stack spacing={3}>
        {/* PAGE HEADER */}
        <Box>
          <Button
            startIcon={<ArrowBackOutlined />}
            onClick={cancelCreation}
            disabled={isSubmitting}
            sx={{ mb: 2 }}
          >
            Back to Customers
          </Button>

          <Typography
            variant="h4"
            sx={{ fontWeight: 700 }}
          >
            Add New Customer
          </Typography>

          <Typography
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            Register personal details, optical
            prescription and purchase information.
          </Typography>
        </Box>

        {/* API ERROR */}
        {saveError && (
          <Alert
            severity="error"
            onClose={() => setSaveError("")}
          >
            {saveError}
          </Alert>
        )}

        {/* INVALID FORM ALERT */}
        {submitCount > 0 &&
          Object.keys(errors).length > 0 && (
            <Alert severity="warning">
              Please correct the highlighted fields
              before saving the customer.
            </Alert>
          )}

        {/* SAVE PROGRESS */}
        {isSubmitting && (
          <Alert severity="info">
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
            >
              <CircularProgress size={18} />

              <Typography variant="body2">
                Saving customer, prescription and
                purchase information...
              </Typography>
            </Stack>
          </Alert>
        )}

        {/* ------------------------------------------
            PERSONAL INFORMATION
        ------------------------------------------ */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 3 }}
            >
              Personal Information
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormTextInput
                  {...sharedProps}
                  name="name"
                  label="Customer Name"
                  required
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
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            OPTICAL PRESCRIPTION
        ------------------------------------------ */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, mb: 1 }}
            >
              Optical Prescription
            </Typography>

            <Typography
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              Select or search SPH and CYL powers.
              Type AXIS manually. Blank measurements
              are allowed.
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
                  minWidth: 620,
                  "& .MuiTableCell-root": {
                    px: 1.5,
                    py: 1.5,
                    verticalAlign: "middle",
                  },
                }}
              >
                <TableHead>
                  <TableRow
                    sx={{ bgcolor: "background.default" }}
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
                  {prescriptionGroups.map((group) => {
                    const sphKey: EyeFieldName =
                      `${group.prefix}_sph`;

                    const cylKey: EyeFieldName =
                      `${group.prefix}_cyl`;

                    const axisKey: EyeFieldName =
                      `${group.prefix}_axis`;

                    return (
                      <TableRow
                        key={group.prefix}
                        hover
                      >
                        <TableCell
                          sx={{ minWidth: 145 }}
                        >
                          <Typography
                            sx={{ fontWeight: 700 }}
                          >
                            {group.label}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {group.description}
                          </Typography>
                        </TableCell>

                        {/* SPH DROPDOWN */}
                        <TableCell
                          sx={{ minWidth: 150 }}
                        >
                          <PrescriptionPowerInput
                            {...sharedProps}
                            name={sphKey}
                            label={`${group.label} SPH`}
                            options={sphOptions}
                          />
                        </TableCell>

                        {/* CYL DROPDOWN */}
                        <TableCell
                          sx={{ minWidth: 150 }}
                        >
                          <PrescriptionPowerInput
                            {...sharedProps}
                            name={cylKey}
                            label={`${group.label} CYL`}
                            options={cylOptions}
                          />
                        </TableCell>

                        {/* AXIS: MANUAL INPUT */}
                        <TableCell
                          sx={{ minWidth: 130 }}
                        >
                          <AxisInput
                            {...sharedProps}
                            name={axisKey}
                            label={`${group.label} AXIS`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Alert
              severity="info"
              icon={<InfoOutlined />}
              sx={{ mt: 2 }}
            >
              SPH: -30 to +30. CYL: -15 to +15.
              AXIS: whole numbers from 0 to 180.
            </Alert>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            PURCHASE INFORMATION
        ------------------------------------------ */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 3 }}
            >
              Purchase Information
            </Typography>

            <Grid container spacing={2}>
              {/* DATE OF PURCHASE */}
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
                        "Optional — leave blank if the date is unknown."
                      }
                      slotProps={{
                        inputLabel: {
                          shrink: true,
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              {/* FRAME TYPE */}
              <Grid size={{ xs: 12, md: 6 }}>
                <FormTextInput
                  {...sharedProps}
                  name="specsType"
                  label="Spectacle / Frame Type"
                />
              </Grid>

              {/* LENS TYPE */}
              <Grid size={{ xs: 12, md: 6 }}>
                <FormTextInput
                  {...sharedProps}
                  name="lensType"
                  label="Lens Type"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            PRICING DETAILS
        ------------------------------------------ */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">
              Pricing Details
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
                  onChange={(_, value) => {
                    if (value !== null) {
                      setValue(
                        "pricingMode",
                        value as "SPLIT" | "MRP_ONLY",
                        {
                          shouldDirty: true,
                          shouldValidate: true,
                        }
                      );
                    }
                  }}
                  sx={{ my: 2, flexWrap: "wrap" }}
                >
                  <ToggleButton value="SPLIT">
                    Frame + Lens
                  </ToggleButton>

                  <ToggleButton value="MRP_ONLY">
                    MRP Only
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            />

            {pricingMode === "SPLIT" ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormTextInput
                    {...sharedProps}
                    name="frameRate"
                    label="Frame Rate (₹)"
                    required
                    inputMode="decimal"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormTextInput
                    {...sharedProps}
                    name="lensRate"
                    label="Lens Rate (₹)"
                    required
                    inputMode="decimal"
                  />
                </Grid>
              </Grid>
            ) : (
              <FormTextInput
                {...sharedProps}
                name="mrp"
                label="Total MRP (₹)"
                required
                inputMode="decimal"
              />
            )}

            {/* LIVE PRICE CALCULATION */}
            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <Typography
                variant="body2"
                sx={{ opacity: 0.85 }}
              >
                {pricingMode === "SPLIT"
                  ? "Automatically Calculated MRP"
                  : "Entered MRP"}
              </Typography>

              <Typography
                variant="h4"
                sx={{ fontWeight: 700 }}
              >
                {total === null
                  ? "₹ —"
                  : `₹${total.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            PRIVATE CUSTOMER NOTES
        ------------------------------------------ */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2 }}
            >
              Private Customer Notes
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Internal notes are for shop staff only.
              Never include them in customer PDFs
              or WhatsApp messages.
            </Alert>

            <FormTextInput
              {...sharedProps}
              name="notes"
              label="Internal Notes"
              multiline
              rows={3}
            />
          </CardContent>
        </Card>

        <Divider />

        {/* ------------------------------------------
            FORM ACTIONS
        ------------------------------------------ */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "flex-end",
            pb: 4,
          }}
        >
          <Button
            variant="outlined"
            disabled={isSubmitting}
            onClick={cancelCreation}
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
          >
            {isSubmitting
              ? "Saving Customer..."
              : "Save Customer"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
