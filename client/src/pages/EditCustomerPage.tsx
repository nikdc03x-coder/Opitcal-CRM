
import { useEffect, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
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
  Typography,
} from "@mui/material";

import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";

import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

import {
  getCustomer,
  updateCustomer,
  updatePurchase,
  updatePrescription,
  type CustomerDetails,
  type CustomerPersonalUpdate,
  type CustomerRecord,
  type Prescription,
  type EditablePrescription,
} from "../services/customerApi";

// -----------------------------------------------------
// 1. TYPES AND CONSTANTS
// -----------------------------------------------------

type PersonalForm = {
  name: string;
  mobNumber: string;
  gender: "" | "Male" | "Female" | "Other";
  reference: string;
  notes: string;
};

type PurchaseForm = {
  specsType: string;
  lensType: string;
  pricingMode: "SPLIT" | "MRP_ONLY";
  frameRate: string;
  lensRate: string;
  mrp: string;
  purchaseDate: string;
};

const eyePrefixes = [
  "re_dist",
  "re_near",
  "le_dist",
  "le_near",
] as const;

type EyePrefix = (typeof eyePrefixes)[number];
type EyeMeasure = "sph" | "cyl" | "axis";
type EyeKey = `${EyePrefix}_${EyeMeasure}`;
type PrescriptionForm = Record<EyeKey, string>;

const eyeGroups: {
  key: EyePrefix;
  label: string;
  description: string;
}[] = [
  {
    key: "re_dist",
    label: "RE DIST",
    description: "Right Eye Distance",
  },
  {
    key: "re_near",
    label: "RE NEAR",
    description: "Right Eye Near",
  },
  {
    key: "le_dist",
    label: "LE DIST",
    description: "Left Eye Distance",
  },
  {
    key: "le_near",
    label: "LE NEAR",
    description: "Left Eye Near",
  },
];

// nik - Generate standard eye powers in 0.25 steps.
// SPH and CYL support both typing and dropdown selection.
function makePowerOptions(min: number, max: number) {
  const options: string[] = [];

  for (let quarter = min * 4; quarter <= max * 4; quarter++) {
    const number = quarter / 4;
    options.push(`${number > 0 ? "+" : ""}${number.toFixed(2)}`);
  }

  return options;
}

const sphOptions = makePowerOptions(-30, 30);
const cylOptions = makePowerOptions(-15, 15);

// -----------------------------------------------------
// 2. DATA HELPERS
// -----------------------------------------------------

function toText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function dateValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function personalFrom(customer: CustomerDetails): PersonalForm {
  const gender = customer.gender;

  return {
    name: customer.name,
    mobNumber: customer.mobNumber ?? "",
    gender:
      gender === "Male" ||
      gender === "Female" ||
      gender === "Other"
        ? gender
        : "",
    reference: customer.reference ?? "",
    notes: customer.notes ?? "",
  };
}

function purchaseFrom(record: CustomerRecord): PurchaseForm {
  return {
    specsType: record.specsType ?? "",
    lensType: record.lensType ?? "",
    pricingMode: record.pricingMode,
    frameRate: toText(record.frameRate),
    lensRate: toText(record.lensRate),
    mrp: toText(record.mrp),
    purchaseDate: dateValue(record.purchaseDate),
  };
}

function prescriptionFrom(p: Prescription): PrescriptionForm {
  return {
    re_dist_sph: toText(p.reDistSph),
    re_dist_cyl: toText(p.reDistCyl),
    re_dist_axis: toText(p.reDistAxis),

    re_near_sph: toText(p.reNearSph),
    re_near_cyl: toText(p.reNearCyl),
    re_near_axis: toText(p.reNearAxis),

    le_dist_sph: toText(p.leDistSph),
    le_dist_cyl: toText(p.leDistCyl),
    le_dist_axis: toText(p.leDistAxis),

    le_near_sph: toText(p.leNearSph),
    le_near_cyl: toText(p.leNearCyl),
    le_near_axis: toText(p.leNearAxis),
  };
}

function validMoney(value: string): boolean {
  return (
    /^\d+(\.\d{1,2})?$/.test(value) &&
    Number(value) <= 9999999999.99
  );
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Convert prescription inputs to backend fields.
// Blank values become null, allowing staff to clear a field.
function buildPrescription(
  form: PrescriptionForm
): EditablePrescription {
  const result: EditablePrescription = {};

  for (const prefix of eyePrefixes) {
    const eye: {
      sph: number | null;
      cyl: number | null;
      axis: number | null;
    } = {
      sph: null,
      cyl: null,
      axis: null,
    };

    for (const measure of ["sph", "cyl", "axis"] as const) {
      const key: EyeKey = `${prefix}_${measure}`;
      const value = form[key].trim();

      if (value === "") {
        eye[measure] = null;
        continue;
      }

      if (!/^[+-]?\d+(\.\d+)?$/.test(value)) {
        throw new Error(
          `${prefix.toUpperCase()} ${measure.toUpperCase()} must be numeric.`
        );
      }

      const number = Number(value);

      if (!Number.isFinite(number)) {
        throw new Error("Enter valid prescription measurements.");
      }

      if (measure === "axis") {
        if (
          !Number.isInteger(number) ||
          number < 0 ||
          number > 180
        ) {
          throw new Error(
            "AXIS must be a whole number between 0 and 180."
          );
        }
      } else {
        const limit = measure === "sph" ? 30 : 15;

        if (number < -limit || number > limit) {
          throw new Error(
            `${measure.toUpperCase()} must be between -${limit} and +${limit}.`
          );
        }
      }

      eye[measure] = number;
    }

    result[prefix] = eye;
  }

  return result;
}

// -----------------------------------------------------
// 3. REUSABLE PRESCRIPTION POWER INPUT
// -----------------------------------------------------

type PowerFieldProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

// Reuse one searchable field for SPH and CYL.
// Do not override MUI's internal inputProps.
function PowerField({
  label,
  value,
  options,
  onChange,
}: PowerFieldProps) {
  return (
    <Autocomplete
      freeSolo
      fullWidth
      size="small"
      options={options}
      value={value}
      inputValue={value}
      onInputChange={(_, newValue, reason) => {
        if (reason === "input" || reason === "clear") {
          onChange(newValue);
        }
      }}
      onChange={(_, newValue) => {
        onChange(newValue ?? "");
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Power"
          aria-label={label}
        />
      )}
    />
  );
}

// -----------------------------------------------------
// 4. EDIT CUSTOMER PAGE
// -----------------------------------------------------

// nik - All edits target one customer and the selected
// prescription or purchase record by its unique ID.
export default function EditCustomerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [customer, setCustomer] =
    useState<CustomerDetails | null>(null);

  const [personal, setPersonal] =
    useState<PersonalForm | null>(null);

  const [purchase, setPurchase] =
    useState<PurchaseForm | null>(null);

  const [prescription, setPrescription] =
    useState<PrescriptionForm | null>(null);

  const [recordId, setRecordId] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const search = params.get("search") ?? "";

  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";

  const detailsUrl = id
    ? `/customers/${id}${query}`
    : "/customers";

  // Fill all sections using the saved customer.
  function loadIntoForms(data: CustomerDetails) {
    setCustomer(data);
    setPersonal(personalFrom(data));

    const firstRecord = data.records[0];
    const firstPrescription = data.prescriptions[0];

    setRecordId(firstRecord?.id ?? "");
    setPurchase(
      firstRecord ? purchaseFrom(firstRecord) : null
    );

    setPrescriptionId(firstPrescription?.id ?? "");
    setPrescription(
      firstPrescription
        ? prescriptionFrom(firstPrescription)
        : null
    );
  }

  // Fetch exactly one customer.
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Customer ID is missing.");
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");
    setCustomer(null);

    getCustomer(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          loadIntoForms(data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load customer."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  // -----------------------------------------------------
  // 5. FORM STATE
  // -----------------------------------------------------

  function editPersonal(
    key: keyof PersonalForm,
    value: string
  ) {
    setPersonal((previous) =>
      previous
        ? { ...previous, [key]: value }
        : previous
    );
  }

  function editPurchase(
    key: keyof PurchaseForm,
    value: string
  ) {
    setPurchase((previous) =>
      previous
        ? { ...previous, [key]: value }
        : previous
    );
  }

  function editEye(key: EyeKey, value: string) {
    setPrescription((previous) =>
      previous
        ? { ...previous, [key]: value }
        : previous
    );
  }

  // Choose one historical purchase.
  function choosePurchase(nextId: string) {
    const selected = customer?.records.find(
      (record) => record.id === nextId
    );

    setRecordId(nextId);
    setPurchase(selected ? purchaseFrom(selected) : null);
    setError("");
    setMessage("");
  }

  // Choose one historical prescription.
  function choosePrescription(nextId: string) {
    const selected = customer?.prescriptions.find(
      (item) => item.id === nextId
    );

    setPrescriptionId(nextId);
    setPrescription(
      selected ? prescriptionFrom(selected) : null
    );

    setError("");
    setMessage("");
  }

  // Reload only the saved section while preserving
  // unsaved changes in the other sections.
  async function refreshSavedSection(
    section: "personal" | "prescription" | "purchase"
  ) {
    if (!id) return;

    const data = await getCustomer(id);
    setCustomer(data);

    if (section === "personal") {
      setPersonal(personalFrom(data));
    }

    if (section === "prescription") {
      const selected = data.prescriptions.find(
        (item) => item.id === prescriptionId
      );

      setPrescription(
        selected ? prescriptionFrom(selected) : null
      );
    }

    if (section === "purchase") {
      const selected = data.records.find(
        (item) => item.id === recordId
      );

      setPurchase(selected ? purchaseFrom(selected) : null);
    }
  }

  // -----------------------------------------------------
  // 6. SAVE PERSONAL INFORMATION
  // -----------------------------------------------------

  async function savePersonal() {
    if (!id || !personal) return;

    const name = personal.name.trim();
    const phone = personal.mobNumber.trim();

    if (!name || name.length > 150) {
      setError("Enter a valid customer name.");
      return;
    }

    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (personal.reference.trim().length > 255) {
      setError("Reference cannot exceed 255 characters.");
      return;
    }

    if (personal.notes.trim().length > 5000) {
      setError("Internal notes cannot exceed 5000 characters.");
      return;
    }

    const changes: CustomerPersonalUpdate = {
      name,
      mobNumber: phone || null,
      gender: personal.gender || null,
      reference: personal.reference.trim() || null,
      notes: personal.notes.trim() || null,
    };

    try {
      setSaving("personal");
      setError("");
      setMessage("");

      await updateCustomer(id, changes);
      await refreshSavedSection("personal");

      setMessage("Personal information saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving("");
    }
  }

  // -----------------------------------------------------
  // 7. SAVE PRESCRIPTION
  // -----------------------------------------------------

  async function savePrescription() {
    if (!id || !prescriptionId || !prescription) return;

    try {
      const changes = buildPrescription(prescription);

      setSaving("prescription");
      setError("");
      setMessage("");

      await updatePrescription(id, prescriptionId, changes);
      await refreshSavedSection("prescription");

      setMessage("Selected prescription saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving("");
    }
  }

  // -----------------------------------------------------
  // 8. SAVE PURCHASE
  // -----------------------------------------------------

  async function savePurchase() {
    if (!id || !recordId || !purchase) return;

    const date = purchase.purchaseDate.trim();

    if (date && !validDate(date)) {
      setError("Enter a valid purchase date.");
      return;
    }

    if (
      purchase.specsType.trim().length > 100 ||
      purchase.lensType.trim().length > 100
    ) {
      setError("Frame or lens type is too long.");
      return;
    }

    const common = {
      specsType: purchase.specsType.trim() || null,
      lensType: purchase.lensType.trim() || null,
    };

    const isSplit = purchase.pricingMode === "SPLIT";

    if (
      isSplit
        ? !validMoney(purchase.frameRate) ||
          !validMoney(purchase.lensRate)
        : !validMoney(purchase.mrp)
    ) {
      setError(
        "Enter a valid amount with up to two decimal places."
      );
      return;
    }

    const record = isSplit
      ? {
          ...common,
          pricingMode: "SPLIT" as const,
          frameRate: Number(purchase.frameRate),
          lensRate: Number(purchase.lensRate),
        }
      : {
          ...common,
          pricingMode: "MRP_ONLY" as const,
          mrp: Number(purchase.mrp),
        };

    try {
      setSaving("purchase");
      setError("");
      setMessage("");

      await updatePurchase(id, recordId, {
        record,
        purchaseDate: date || null,
      });

      await refreshSavedSection("purchase");

      setMessage("Selected purchase saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving("");
    }
  }

  // -----------------------------------------------------
  // 9. LOADING / ERROR
  // -----------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          Loading customer information...
        </Typography>
      </Box>
    );
  }

  if (!customer || !personal) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          {error || "Customer not found."}
        </Alert>

        <Button component={Link} to="/customers">
          Back to Customers
        </Button>
      </Stack>
    );
  }

  // -----------------------------------------------------
  // 10. PAGE CONTENT
  // -----------------------------------------------------

  return (
    <Stack spacing={3} sx={{ pb: 5 }}>
      {/* HEADER */}
      <Box>
        <Button
          component={Link}
          to={detailsUrl}
          startIcon={<ArrowBackOutlined />}
        >
          Back to Customer Details
        </Button>

        <Typography
          variant="h4"
          sx={{ fontWeight: 700, mt: 2 }}
        >
          Edit Customer
        </Typography>

        <Typography color="text.secondary" sx={{ mt: 1 }}>
          {customer.name}
        </Typography>
      </Box>

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

      {/* PERSONAL INFORMATION */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Personal Information
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Customer Name"
                value={personal.name}
                onChange={(event) =>
                  editPersonal("name", event.target.value)
                }
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Mobile Number"
                value={personal.mobNumber}
                onChange={(event) =>
                  editPersonal(
                    "mobNumber",
                    event.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                slotProps={{
                  htmlInput: {
                    inputMode: "numeric",
                    maxLength: 10,
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Gender"
                value={personal.gender}
                onChange={(event) =>
                  editPersonal("gender", event.target.value)
                }
              >
                <MenuItem value="">Not specified</MenuItem>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Reference"
                value={personal.reference}
                onChange={(event) =>
                  editPersonal("reference", event.target.value)
                }
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Internal Notes"
                value={personal.notes}
                onChange={(event) =>
                  editPersonal("notes", event.target.value)
                }
                helperText="Staff only. Never include notes in customer PDFs."
              />
            </Grid>
          </Grid>

          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={savePersonal}
            disabled={Boolean(saving)}
            sx={{ mt: 3 }}
          >
            {saving === "personal"
              ? "Saving..."
              : "Save Personal Information"}
          </Button>
        </CardContent>
      </Card>

      {/* OPTICAL PRESCRIPTIONS */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Optical Prescriptions
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Select a prescription and enter eye powers.
            SPH and CYL have searchable dropdowns.
            AXIS uses manual entry.
          </Typography>

          {customer.prescriptions.length === 0 ? (
            <Alert severity="info">
              No saved prescription is available.
            </Alert>
          ) : (
            <Stack spacing={3}>
              <TextField
                select
                fullWidth
                label="Select Prescription"
                value={prescriptionId}
                onChange={(event) =>
                  choosePrescription(event.target.value)
                }
                disabled={Boolean(saving)}
              >
                {customer.prescriptions.map((item, index) => (
                  <MenuItem key={item.id} value={item.id}>
                    Prescription {index + 1} —{" "}
                    {new Date(item.createdAt).toLocaleDateString("en-IN")}
                  </MenuItem>
                ))}
              </TextField>

              {prescription && (
                <>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ borderRadius: 2, overflowX: "auto" }}
                  >
                    <Table
                      size="small"
                      sx={{
                        minWidth: 560,
                        "& .MuiTableCell-root": {
                          px: 1.5,
                          py: 1.5,
                          verticalAlign: "middle",
                        },
                      }}
                    >
                      <TableHead>
                        <TableRow sx={{ bgcolor: "background.default" }}>
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
                        {eyeGroups.map((group) => {
                          const sphKey: EyeKey = `${group.key}_sph`;
                          const cylKey: EyeKey = `${group.key}_cyl`;
                          const axisKey: EyeKey = `${group.key}_axis`;

                          return (
                            <TableRow key={group.key} hover>
                              <TableCell sx={{ minWidth: 140 }}>
                                <Typography sx={{ fontWeight: 700 }}>
                                  {group.label}
                                </Typography>

                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {group.description}
                                </Typography>
                              </TableCell>

                              {/* SPH: Searchable power dropdown */}
                              <TableCell sx={{ minWidth: 140 }}>
                                <PowerField
                                  label={`${group.label} SPH`}
                                  value={prescription[sphKey]}
                                  options={sphOptions}
                                  onChange={(value) =>
                                    editEye(sphKey, value)
                                  }
                                />
                              </TableCell>

                              {/* CYL: Searchable power dropdown */}
                              <TableCell sx={{ minWidth: 140 }}>
                                <PowerField
                                  label={`${group.label} CYL`}
                                  value={prescription[cylKey]}
                                  options={cylOptions}
                                  onChange={(value) =>
                                    editEye(cylKey, value)
                                  }
                                />
                              </TableCell>

                              {/* AXIS: Numeric typing, no dropdown */}
                              <TableCell sx={{ minWidth: 110 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  placeholder="0–180"
                                  value={prescription[axisKey]}
                                  onChange={(event) =>
                                    editEye(
                                      axisKey,
                                      event.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 3)
                                    )
                                  }
                                  slotProps={{
                                    htmlInput: {
                                      inputMode: "numeric",
                                      "aria-label": `${group.label} AXIS`,
                                    },
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Button
                    variant="contained"
                    startIcon={<SaveOutlined />}
                    onClick={savePrescription}
                    disabled={Boolean(saving)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {saving === "prescription"
                      ? "Saving..."
                      : "Save Selected Prescription"}
                  </Button>
                </>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* PURCHASE HISTORY */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Purchase History
          </Typography>

          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
            Select the exact purchase record to edit its date,
            frame, lens and pricing details.
          </Typography>

          {customer.records.length === 0 ? (
            <Alert severity="info">
              No saved purchase records are available.
            </Alert>
          ) : (
            <Stack spacing={3}>
              <TextField
                select
                fullWidth
                label="Select Purchase"
                value={recordId}
                onChange={(event) =>
                  choosePurchase(event.target.value)
                }
                disabled={Boolean(saving)}
              >
                {customer.records.map((record, index) => (
                  <MenuItem key={record.id} value={record.id}>
                    Purchase {index + 1} —{" "}
                    {record.purchaseDate
                      ? dateValue(record.purchaseDate)
                      : "Date not recorded"}{" "}
                    — ₹{toText(record.mrp)}
                  </MenuItem>
                ))}
              </TextField>

              {purchase && (
                <>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        type="date"
                        label="Date of Purchase"
                        value={purchase.purchaseDate}
                        onChange={(event) =>
                          editPurchase(
                            "purchaseDate",
                            event.target.value
                          )
                        }
                        slotProps={{
                          inputLabel: { shrink: true },
                        }}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Spectacle / Frame Type"
                        value={purchase.specsType}
                        onChange={(event) =>
                          editPurchase("specsType", event.target.value)
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Lens Type"
                        value={purchase.lensType}
                        onChange={(event) =>
                          editPurchase("lensType", event.target.value)
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        select
                        fullWidth
                        label="Pricing Mode"
                        value={purchase.pricingMode}
                        onChange={(event) =>
                          editPurchase(
                            "pricingMode",
                            event.target.value
                          )
                        }
                      >
                        <MenuItem value="SPLIT">
                          Frame + Lens
                        </MenuItem>
                        <MenuItem value="MRP_ONLY">
                          MRP Only
                        </MenuItem>
                      </TextField>
                    </Grid>

                    {purchase.pricingMode === "SPLIT" ? (
                      <>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Frame Rate (₹)"
                            value={purchase.frameRate}
                            onChange={(event) =>
                              editPurchase(
                                "frameRate",
                                event.target.value
                              )
                            }
                            slotProps={{
                              htmlInput: {
                                inputMode: "decimal",
                              },
                            }}
                          />
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Lens Rate (₹)"
                            value={purchase.lensRate}
                            onChange={(event) =>
                              editPurchase(
                                "lensRate",
                                event.target.value
                              )
                            }
                            slotProps={{
                              htmlInput: {
                                inputMode: "decimal",
                              },
                            }}
                          />
                        </Grid>

                        <Grid size={12}>
                          <Alert severity="info">
                            Calculated MRP: ₹
                            {validMoney(purchase.frameRate) &&
                            validMoney(purchase.lensRate)
                              ? (
                                  Number(purchase.frameRate) +
                                  Number(purchase.lensRate)
                                ).toFixed(2)
                              : "—"}
                          </Alert>
                        </Grid>
                      </>
                    ) : (
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Total MRP (₹)"
                          value={purchase.mrp}
                          onChange={(event) =>
                            editPurchase("mrp", event.target.value)
                          }
                          slotProps={{
                            htmlInput: {
                              inputMode: "decimal",
                            },
                          }}
                        />
                      </Grid>
                    )}
                  </Grid>

                  <Button
                    variant="contained"
                    startIcon={<SaveOutlined />}
                    onClick={savePurchase}
                    disabled={Boolean(saving)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {saving === "purchase"
                      ? "Saving..."
                      : "Save Selected Purchase"}
                  </Button>
                </>
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outlined"
        startIcon={<ArrowBackOutlined />}
        onClick={() => navigate(detailsUrl)}
        sx={{ alignSelf: "flex-start" }}
      >
        Return to Customer Details
      </Button>
    </Stack>
  );
}
