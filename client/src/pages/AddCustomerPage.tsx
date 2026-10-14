
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router";

import {
  createCustomer,
  type CustomerPayload,
  type EyeValues,
} from "../services/customerApi";

// --------------------------------------------------
// 1. FORM VALIDATION
// --------------------------------------------------

// Form fields use strings because HTML inputs return text.
// We convert numerical values before sending to the API.
const optionalNumber = z.string().refine(
  value =>
    value === "" ||
    (Number.isFinite(Number(value)) &&
      Number(value) >= -30 &&
      Number(value) <= 180),
  "Enter a valid number"
);

const moneyField = z.string().refine(
  value =>
    value.trim() !== "" &&
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) <= 9999999999.99,
  "Enter a valid amount (maximum 2 decimal places)"
);

const formSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required"),
  mobNumber: z.string().refine(
    value => value === "" || /^[6-9]\d{9}$/.test(value),
    "Enter a valid 10-digit Indian mobile number"
  ),
  gender: z.enum(["", "Male", "Female", "Other"]),
  reference: z.string(),
  notes: z.string().max(5000, "Maximum 5000 characters"),

  specsType: z.string(),
  lensType: z.string(),

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
}).superRefine((data, ctx) => {
  // Only validate amounts used by the selected pricing mode.
  const fields = data.pricingMode === "SPLIT"
    ? (["frameRate", "lensRate"] as const)
    : (["mrp"] as const);

  for (const field of fields) {
    const result = moneyField.safeParse(data[field]);

    if (!result.success) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: "Enter a valid amount (maximum 2 decimals)",
      });
    }
  }

  // SPH and CYL accept signed decimal measurements.
  // AXIS must be a whole number between 0 and 180.
  const prefixes = ["re_dist", "re_near", "le_dist", "le_near"] as const;

  for (const prefix of prefixes) {
    const axisField = `${prefix}_axis` as keyof typeof data;
    const axisValue = data[axisField];

    if (
      axisValue !== "" &&
      (!/^\d+$/.test(axisValue) || Number(axisValue) > 180)
    ) {
      ctx.addIssue({
        code: "custom",
        path: [axisField],
        message: "Axis must be a whole number from 0 to 180",
      });
    }

    for (const kind of ["sph", "cyl"] as const) {
      const key = `${prefix}_${kind}` as keyof typeof data;
      const value = data[key];

      if (value !== "" && (
        !/^[+-]?\d+(\.\d+)?$/.test(value) ||
        Number(value) < (kind === "sph" ? -30 : -15) ||
        Number(value) > (kind === "sph" ? 30 : 15)
      )) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `Enter a valid ${kind.toUpperCase()} value`,
        });
      }
    }
  }
});

type FormValues = z.infer<typeof formSchema>;

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

// --------------------------------------------------
// 2. PRESCRIPTION FIELD CONFIGURATION
// --------------------------------------------------

type EyePrefix = "re_dist" | "re_near" | "le_dist" | "le_near";
type Measure = "sph" | "cyl" | "axis";
type EyeFieldName = `${EyePrefix}_${Measure}`;

const prescriptionGroups: {
  title: string;
  prefix: EyePrefix;
}[] = [
  { title: "Right Eye — Distance", prefix: "re_dist" },
  { title: "Left Eye — Distance", prefix: "le_dist" },
  { title: "Right Eye — Near", prefix: "re_near" },
  { title: "Left Eye — Near", prefix: "le_near" },
];

// Build one eye's measurements from form strings.
// Blank values are omitted rather than stored as zero.
function readEye(
  values: FormValues,
  prefix: EyePrefix
): EyeValues | undefined {
  const result: EyeValues = {};

  for (const kind of ["sph", "cyl", "axis"] as const) {
    const key: EyeFieldName = `${prefix}_${kind}`;
    const raw = values[key];

    if (raw.trim() !== "") {
      result[kind] = Number(raw);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// --------------------------------------------------
// 3. CUSTOMER REGISTRATION COMPONENT
// --------------------------------------------------

export default function AddCustomerPage() {
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState("");

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
    mode: "onBlur",
  });

  // Watch pricing fields to calculate MRP live.
  const [pricingMode, frameRate, lensRate, mrp] = useWatch({
    control,
    name: ["pricingMode", "frameRate", "lensRate", "mrp"],
  });

  const frameValid = moneyField.safeParse(frameRate).success;
  const lensValid = moneyField.safeParse(lensRate).success;
  const mrpValid = moneyField.safeParse(mrp).success;

  const total = pricingMode === "SPLIT"
    ? frameValid && lensValid
      ? (Math.round(Number(frameRate) * 100) +
          Math.round(Number(lensRate) * 100)) / 100
      : null
    : mrpValid ? Number(mrp) : null;

  // Convert the form into the backend's expected structure.
  async function onSubmit(values: FormValues) {
    setSaveError("");

    const prescription = {
      re_dist: readEye(values, "re_dist"),
      re_near: readEye(values, "re_near"),
      le_dist: readEye(values, "le_dist"),
      le_near: readEye(values, "le_near"),
    };

    const hasPrescription = Object.values(prescription)
      .some(value => value !== undefined);

    const commonRecord = {
      specsType: values.specsType.trim() || null,
      lensType: values.lensType.trim() || null,
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
      mobNumber: values.mobNumber || null,
      gender: values.gender || null,
      reference: values.reference.trim() || null,
      notes: values.notes.trim() || null,
      prescription: hasPrescription ? prescription : undefined,
      record,
    };

    try {
      const customer = await createCustomer(payload);

      // Only redirect after PostgreSQL confirms the save.
      navigate(`/customers/${customer.id}`, {
        replace: true,
        state: { saved: true },
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save customer."
      );
    }
  }

  // Reusable MUI input connected to React Hook Form.
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

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      sx={{ maxWidth: 1150, mx: "auto" }}
    >
      <Stack spacing={3}>
        {/* Page heading and navigation */}
        <Box>
          <Button
            onClick={() => navigate("/customers")}
            sx={{ mb: 2 }}
          >
            ← Back to Customers
          </Button>

          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Add New Customer
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Register customer details, prescription and pricing.
          </Typography>
        </Box>

        {saveError && (
          <Alert severity="error" onClose={() => setSaveError("")}>
            {saveError}
          </Alert>
        )}

        {/* Personal information */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                {formInput("name", "Customer Name", { required: true })}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                {formInput("mobNumber", "Mobile Number", {
                  inputMode: "numeric",
                  maxLength: 10,
                })}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Gender">
                      <MenuItem value="">Not specified</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                {formInput("reference", "Reference / Referred By")}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Prescription: four panels, three inputs each */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6">
              Optical Prescription
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Enter SPH, CYL and AXIS where applicable.
              Blank fields are allowed.
            </Typography>

            <Grid container spacing={2}>
              {prescriptionGroups.map(group => (
                <Grid key={group.prefix} size={{ xs: 12, md: 6 }}>
                  <Box
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600,  mb: 2 }}>
                      {group.title}
                    </Typography>

                    <Grid container spacing={1.5}>
                      {(["sph", "cyl", "axis"] as const).map(kind => (
                        <Grid size={4} key={kind}>
                          {formInput(
                            `${group.prefix}_${kind}`,
                            kind.toUpperCase(),
                            {
                              inputMode:
                                kind === "axis" ? "numeric" : "decimal",
                            }
                          )}
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Product selection */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Frame & Lens Details
            </Typography>

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                {formInput("specsType", "Spectacle / Frame Type")}
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                {formInput("lensType", "Lens Type")}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Two supported pricing modes */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Pricing Details
            </Typography>

            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={pricingMode}
              onChange={(_, value) => {
                if (value) {
                  setValue("pricingMode", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
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

            {pricingMode === "SPLIT" ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  {formInput("frameRate", "Frame Rate (₹)", {
                    required: true,
                    inputMode: "decimal",
                  })}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  {formInput("lensRate", "Lens Rate (₹)", {
                    required: true,
                    inputMode: "decimal",
                  })}
                </Grid>
              </Grid>
            ) : (
              formInput("mrp", "Total MRP (₹)", {
                required: true,
                inputMode: "decimal",
              })
            )}

            <Box
              sx={{
                mt: 3,
                p: 2.5,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {pricingMode === "SPLIT"
                  ? "Automatically Calculated MRP"
                  : "Entered MRP"}
              </Typography>

              <Typography variant="h4" sx={{ fontWeight: 700 }}>
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

        {/* Staff-only notes */}
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Private Customer Notes
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              These notes are for internal CRM use only and will not
              appear in customer PDFs.
            </Alert>

            {formInput("notes", "Internal Notes", {
              multiline: true,
              rows: 3,
            })}
          </CardContent>
        </Card>

        <Divider />

        {/* Save action */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
         
          spacing={2}
          sx={{ justifyContent: "flex-end",  pb: 4 }}
        >
          <Button
            variant="outlined"
            disabled={isSubmitting}
            onClick={() => {
              if (
                !isDirty ||
                window.confirm("Discard unsaved customer details?")
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
              isSubmitting
                ? <CircularProgress size={18} color="inherit" />
                : undefined
            }
          >
            {isSubmitting ? "Saving Customer..." : "Save Customer"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
