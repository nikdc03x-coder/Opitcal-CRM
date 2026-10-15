
import { useState } from "react";

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
// 1. PRESCRIPTION SETTINGS
// -----------------------------------------------------

// nik - Use one consistent prescription order across
// Add Customer, Edit Customer and Customer Details.

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

// Generate standard eye powers in 0.25 steps.
// The searchable dropdown also supports typed values.
function powerOptions(min: number, max: number) {
  const options: string[] = [];

  for (let quarter = min * 4; quarter <= max * 4; quarter++) {
    const value = quarter / 4;

    options.push(
      `${value > 0 ? "+" : ""}${value.toFixed(2)}`
    );
  }

  return options;
}

const sphOptions = powerOptions(-30, 30);
const cylOptions = powerOptions(-15, 15);

// -----------------------------------------------------
// 2. VALIDATION
// -----------------------------------------------------

// Inputs are strings in the form.
// Convert them to numbers only when building the API payload.

const optionalNumber = z.string();

const moneyField = z.string().refine(
  (value) =>
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) <= 9999999999.99,
  "Enter a valid amount with at most 2 decimal places."
);

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

    reference: z.string().max(
      255,
      "Maximum 255 characters."
    ),

    notes: z.string().max(
      5000,
      "Maximum 5000 characters."
    ),

    specsType: z.string().max(
      100,
      "Maximum 100 characters."
    ),

    lensType: z.string().max(
      100,
      "Maximum 100 characters."
    ),

    pricingMode: z.enum(["SPLIT", "MRP_ONLY"]),

    frameRate: z.string(),
    lensRate: z.string(),
    mrp: z.string(),

    re_dist_sph: optionalNumber,
    re_dist_cyl: optionalNumber,
    re_dist_axis: optionalNumber,

    re_near_sph: optionalNumber,
    re_near_cyl: optionalNumber,
    re_near_axis: optionalNumber,

    le_dist_sph: optionalNumber,
    le_dist_cyl: optionalNumber,
    le_dist_axis: optionalNumber,

    le_near_sph: optionalNumber,
    le_near_cyl: optionalNumber,
    le_near_axis: optionalNumber,
  })
  .superRefine((data, context) => {
    // Validate only the fields relevant to pricing mode.
    const priceFields =
      data.pricingMode === "SPLIT"
        ? (["frameRate", "lensRate"] as const)
        : (["mrp"] as const);

    for (const name of priceFields) {
      if (!moneyField.safeParse(data[name]).success) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: "Enter a valid price (max 2 decimals).",
        });
      }
    }

    // Validate each of the four eye groups.
    for (const prefix of eyePrefixes) {
      for (const measure of [
        "sph",
        "cyl",
        "axis",
      ] as const) {
        const key: EyeFieldName = `${prefix}_${measure}`;
        const value = data[key].trim();

        // A blank prescription field is allowed.
        if (value === "") continue;

        if (measure === "axis") {
          if (
            !/^\d+$/.test(value) ||
            Number(value) > 180
          ) {
            context.addIssue({
              code: "custom",
              path: [key],
              message: "AXIS must be a whole number from 0 to 180.",
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
// 3. INITIAL VALUES
// -----------------------------------------------------

const initialValues: FormValues = {
  name: "",
  mobNumber: "",
  gender: "",
  reference: "",
  notes: "",

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
// 4. PAYLOAD HELPERS
// -----------------------------------------------------

// Read one eye group.
// Blank values are omitted instead of stored as zero.
function readEye(
  values: FormValues,
  prefix: EyePrefix
): EyeValues | undefined {
  const result: EyeValues = {};

  for (const measure of [
    "sph",
    "cyl",
    "axis",
  ] as const) {
    const key: EyeFieldName = `${prefix}_${measure}`;
    const raw = values[key].trim();

    if (raw !== "") {
      result[measure] = Number(raw);
    }
  }

  return Object.keys(result).length > 0
    ? result
    : undefined;
}

// -----------------------------------------------------
// 5. ADD CUSTOMER PAGE
// -----------------------------------------------------

export default function AddCustomerPage() {
  const navigate = useNavigate();

  const [saveError, setSaveError] = useState("");

  const {
    control,
    handleSubmit,
    setValue,
    formState: {
      errors,
      isSubmitting,
      isDirty,
    },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  // Watch prices and update the displayed MRP automatically.
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

  // -----------------------------------------------------
  // 6. SAVE NEW CUSTOMER
  // -----------------------------------------------------

  async function onSubmit(values: FormValues) {
    setSaveError("");

    // Build all four prescription groups.
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

    // Pricing is calculated again by the backend.
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

      mobNumber: values.mobNumber || null,

      gender: values.gender || null,

      reference: values.reference.trim() || null,

      // Internal notes stay in the CRM only.
      notes: values.notes.trim() || null,

      prescription: hasPrescription
        ? prescription
        : undefined,

      record,
    };

    try {
      // React Hook Form automatically prevents
      // a second submit while this request is pending.
      const customer = await createCustomer(payload);

      // Navigate only after the database confirms creation.
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
          : "Unable to save customer."
      );
    }
  }

  // -----------------------------------------------------
  // 7. REUSABLE TEXT INPUT
  // -----------------------------------------------------

  function formInput(
    name: keyof FormValues,
    label: string,
    options: {
      required?: boolean;
      multiline?: boolean;
      rows?: number;
      inputMode?: "decimal" | "numeric";
      maxLength?: number;
    } = {}
  ) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={label}
            required={options.required}
            multiline={options.multiline}
            rows={options.rows}
            disabled={isSubmitting}
            error={Boolean(errors[name])}
            helperText={errors[name]?.message}
            slotProps={{
              htmlInput: {
                ...(options.inputMode
                  ? { inputMode: options.inputMode }
                  : {}),
                ...(options.maxLength
                  ? { maxLength: options.maxLength }
                  : {}),
              },
            }}
          />
        )}
      />
    );
  }

  // -----------------------------------------------------
  // 8. PRESCRIPTION POWER DROPDOWN
  // -----------------------------------------------------

  function prescriptionPowerInput(
    name: EyeFieldName,
    label: string,
    options: string[]
  ) {
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
            disabled={isSubmitting}
            onInputChange={(_, nextValue, reason) => {
              if (
                reason === "input" ||
                reason === "clear"
              ) {
                field.onChange(nextValue);
              }
            }}
            onChange={(_, nextValue) => {
              field.onChange(nextValue ?? "");
            }}
            onBlur={field.onBlur}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={field.ref}
                placeholder="Power"
                aria-label={label}
                error={Boolean(errors[name])}
                helperText={errors[name]?.message}
              />
            )}
          />
        )}
      />
    );
  }

  // -----------------------------------------------------
  // 9. AXIS MANUAL INPUT
  // -----------------------------------------------------

  function axisInput(
    name: EyeFieldName,
    label: string
  ) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            size="small"
            placeholder="0–180"
            disabled={isSubmitting}
            onChange={(event) => {
              // Only digits are allowed for AXIS.
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
                "aria-label": label,
              },
            }}
          />
        )}
      />
    );
  }

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
            disabled={isSubmitting}
            onClick={() => {
              if (
                !isDirty ||
                window.confirm(
                  "Discard the unsaved customer information?"
                )
              ) {
                navigate("/customers");
              }
            }}
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
            Register personal information, eye
            prescription and purchase details.
          </Typography>
        </Box>

        {/* API ERRORS */}
        {saveError && (
          <Alert
            severity="error"
            onClose={() => setSaveError("")}
          >
            {saveError}
          </Alert>
        )}

        {/* SAVE PROGRESS */}
        {isSubmitting && (
          <Alert severity="info">
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center" }}
            >
              <CircularProgress size={18} />

              <Typography variant="body2">
                Saving the customer and related records...
              </Typography>
            </Stack>
          </Alert>
        )}

        {/* PERSONAL INFORMATION */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Personal Information
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                {formInput(
                  "name",
                  "Customer Name",
                  { required: true }
                )}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                {formInput(
                  "mobNumber",
                  "Mobile Number",
                  {
                    inputMode: "numeric",
                    maxLength: 10,
                  }
                )}
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
                {formInput(
                  "reference",
                  "Reference / Referred By"
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* OPTICAL PRESCRIPTION */}
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
              Enter eye powers using the searchable
              SPH/CYL dropdowns. Type AXIS manually.
              Blank measurements are allowed.
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
                  minWidth: 580,
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
                  {prescriptionGroups.map((group) => {
                    const sphKey: EyeFieldName =
                      `${group.prefix}_sph`;

                    const cylKey: EyeFieldName =
                      `${group.prefix}_cyl`;

                    const axisKey: EyeFieldName =
                      `${group.prefix}_axis`;

                    return (
                      <TableRow key={group.prefix} hover>
                        <TableCell
                          sx={{ minWidth: 150 }}
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
                          sx={{ minWidth: 145 }}
                        >
                          {prescriptionPowerInput(
                            sphKey,
                            `${group.label} SPH`,
                            sphOptions
                          )}
                        </TableCell>

                        {/* CYL DROPDOWN */}
                        <TableCell
                          sx={{ minWidth: 145 }}
                        >
                          {prescriptionPowerInput(
                            cylKey,
                            `${group.label} CYL`,
                            cylOptions
                          )}
                        </TableCell>

                        {/* MANUAL AXIS */}
                        <TableCell
                          sx={{ minWidth: 115 }}
                        >
                          {axisInput(
                            axisKey,
                            `${group.label} AXIS`
                          )}
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
              SPH range: -30 to +30. CYL range:
              -15 to +15. AXIS range: 0 to 180.
            </Alert>
          </CardContent>
        </Card>

        {/* FRAME AND LENS DETAILS */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 3 }}
            >
              Frame & Lens Details
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                {formInput(
                  "specsType",
                  "Spectacle / Frame Type"
                )}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                {formInput(
                  "lensType",
                  "Lens Type"
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* PRICING DETAILS */}
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
                  sx={{
                    my: 2,
                    flexWrap: "wrap",
                  }}
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
                  {formInput(
                    "frameRate",
                    "Frame Rate (₹)",
                    {
                      required: true,
                      inputMode: "decimal",
                    }
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  {formInput(
                    "lensRate",
                    "Lens Rate (₹)",
                    {
                      required: true,
                      inputMode: "decimal",
                    }
                  )}
                </Grid>
              </Grid>
            ) : (
              formInput(
                "mrp",
                "Total MRP (₹)",
                {
                  required: true,
                  inputMode: "decimal",
                }
              )
            )}

            {/* LIVE TOTAL */}
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

        {/* STAFF-ONLY NOTES */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              sx={{ mb: 2 }}
            >
              Private Customer Notes
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              Notes are for internal CRM use only.
              Never include them in customer PDFs
              or WhatsApp messages.
            </Alert>

            {formInput(
              "notes",
              "Internal Notes",
              {
                multiline: true,
                rows: 3,
              }
            )}
          </CardContent>
        </Card>

        <Divider />

        {/* SAVE ACTIONS */}
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
            onClick={() => {
              if (
                !isDirty ||
                window.confirm(
                  "Discard unsaved customer details?"
                )
              ) {
                navigate("/customers");
              }
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
