
import { useEffect, useState } from "react";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";

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

// --------------------------------------------------
// FORM TYPES
// --------------------------------------------------

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

type Section = "personal" | "prescription" | "purchase";
type SaveStatus = Record<Section, boolean>;

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

// nik - Generate powers in steps of 0.25.
function makePowerOptions(min: number, max: number) {
  const options: string[] = [];

  for (let q = min * 4; q <= max * 4; q++) {
    const value = q / 4;

    options.push(
      `${value > 0 ? "+" : ""}${value.toFixed(2)}`
    );
  }

  return options;
}

const sphOptions = makePowerOptions(-30, 30);
const cylOptions = makePowerOptions(-15, 15);

// --------------------------------------------------
// DATA HELPERS
// --------------------------------------------------

function toText(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value);
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

// Make it easier to compare saved values with edited values.
// Ignore harmless formatting differences such as +1.00 vs 1.
function normalizedPower(value: string): string {
  if (!value.trim()) return "";

  const number = Number(value);

  return Number.isFinite(number)
    ? String(number)
    : value.trim();
}

function samePersonal(
  current: PersonalForm | null,
  original: PersonalForm | null
): boolean {
  if (!current || !original) return true;

  return (
    current.name.trim() === original.name.trim() &&
    current.mobNumber === original.mobNumber &&
    current.gender === original.gender &&
    current.reference.trim() === original.reference.trim() &&
    current.notes.trim() === original.notes.trim()
  );
}

function samePrescription(
  current: PrescriptionForm | null,
  original: PrescriptionForm | null
): boolean {
  if (!current || !original) return true;

  for (const prefix of eyePrefixes) {
    for (const measure of [
      "sph",
      "cyl",
      "axis",
    ] as const) {
      const key: EyeKey = `${prefix}_${measure}`;

      if (
        normalizedPower(current[key]) !==
        normalizedPower(original[key])
      ) {
        return false;
      }
    }
  }

  return true;
}

function samePurchase(
  current: PurchaseForm | null,
  original: PurchaseForm | null
): boolean {
  if (!current || !original) return true;

  const commonEqual =
    current.specsType.trim() === original.specsType.trim() &&
    current.lensType.trim() === original.lensType.trim() &&
    current.pricingMode === original.pricingMode &&
    current.purchaseDate === original.purchaseDate;

  if (!commonEqual) return false;

  if (current.pricingMode === "SPLIT") {
    return (
      normalizedPower(current.frameRate) ===
        normalizedPower(original.frameRate) &&
      normalizedPower(current.lensRate) ===
        normalizedPower(original.lensRate)
    );
  }

  return (
    normalizedPower(current.mrp) ===
    normalizedPower(original.mrp)
  );
}

// Convert editable prescription fields to the API shape.
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

    for (const measure of [
      "sph",
      "cyl",
      "axis",
    ] as const) {
      const key: EyeKey = `${prefix}_${measure}`;
      const value = form[key].trim();

      if (!value) {
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
        throw new Error("Enter valid eye measurements.");
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

// --------------------------------------------------
// STATUS COMPONENTS
// --------------------------------------------------

function SectionStatus({
  dirty,
  saved,
  saving,
}: {
  dirty: boolean;
  saved: boolean;
  saving: boolean;
}) {
  if (saving) {
    return (
      <Chip
        size="small"
        color="info"
        icon={<CircularProgress size={13} />}
        label="Saving..."
        variant="outlined"
      />
    );
  }

  if (dirty) {
    return (
      <Chip
        size="small"
        color="warning"
        icon={<EditOutlined />}
        label="Unsaved changes"
      />
    );
  }

  if (saved) {
    return (
      <Chip
        size="small"
        color="success"
        icon={<CheckCircleOutlined />}
        label="Saved successfully"
      />
    );
  }

  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<InfoOutlined />}
      label="No changes"
    />
  );
}

function SectionFeedback({
  section,
  dirty,
  saved,
  saving,
}: {
  section: string;
  dirty: boolean;
  saved: boolean;
  saving: boolean;
}) {
  if (saving) {
    return (
      <Alert severity="info">
        Saving {section.toLowerCase()}...
      </Alert>
    );
  }

  if (dirty) {
    return (
      <Alert severity="warning" icon={<WarningAmberOutlined />}>
        You have unsaved changes in {section}.
        Click Save to store them in the database.
      </Alert>
    );
  }

  if (saved) {
    return (
      <Alert severity="success" icon={<CheckCircleOutlined />}>
        {section} saved successfully.
        Your latest changes have been stored.
      </Alert>
    );
  }

  return null;
}

// SPH/CYL input with MUI-compatible autocomplete props.
function PowerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Autocomplete
      freeSolo
      fullWidth
      size="small"
      options={options}
      value={value}
      inputValue={value}
      onInputChange={(_, nextValue, reason) => {
        if (reason === "input" || reason === "clear") {
          onChange(nextValue);
        }
      }}
      onChange={(_, nextValue) => {
        onChange(nextValue ?? "");
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

// --------------------------------------------------
// MAIN EDIT CUSTOMER PAGE
// --------------------------------------------------

// nik - Track unsaved changes independently for each
// editing section and confirm successful database saves.
export default function EditCustomerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [customer, setCustomer] =
    useState<CustomerDetails | null>(null);

  const [personal, setPersonal] =
    useState<PersonalForm | null>(null);

  const [originalPersonal, setOriginalPersonal] =
    useState<PersonalForm | null>(null);

  const [prescription, setPrescription] =
    useState<PrescriptionForm | null>(null);

  const [originalPrescription, setOriginalPrescription] =
    useState<PrescriptionForm | null>(null);

  const [purchase, setPurchase] =
    useState<PurchaseForm | null>(null);

  const [originalPurchase, setOriginalPurchase] =
    useState<PurchaseForm | null>(null);

  const [recordId, setRecordId] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Section | null>(null);

  const [saved, setSaved] = useState<SaveStatus>({
    personal: false,
    prescription: false,
    purchase: false,
  });

  const [error, setError] = useState("");

  const search = params.get("search") ?? "";

  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";

  const detailsUrl = id
    ? `/customers/${id}${query}`
    : "/customers";

  // Compare current values with their last saved versions.
  const personalDirty = !samePersonal(
    personal,
    originalPersonal
  );

  const prescriptionDirty = !samePrescription(
    prescription,
    originalPrescription
  );

  const purchaseDirty = !samePurchase(
    purchase,
    originalPurchase
  );

  const hasUnsavedChanges =
    personalDirty || prescriptionDirty || purchaseDirty;

  const unsavedCount = [
    personalDirty,
    prescriptionDirty,
    purchaseDirty,
  ].filter(Boolean).length;

  // --------------------------------------------------
  // LOAD AND RESET FORMS
  // --------------------------------------------------

  function loadIntoForms(data: CustomerDetails) {
    const personalValues = personalFrom(data);

    const firstPrescription = data.prescriptions[0];
    const firstRecord = data.records[0];

    const prescriptionValues = firstPrescription
      ? prescriptionFrom(firstPrescription)
      : null;

    const purchaseValues = firstRecord
      ? purchaseFrom(firstRecord)
      : null;

    setCustomer(data);

    setPersonal(personalValues);
    setOriginalPersonal(personalValues);

    setPrescriptionId(firstPrescription?.id ?? "");
    setPrescription(prescriptionValues);
    setOriginalPrescription(prescriptionValues);

    setRecordId(firstRecord?.id ?? "");
    setPurchase(purchaseValues);
    setOriginalPurchase(purchaseValues);

    setSaved({
      personal: false,
      prescription: false,
      purchase: false,
    });
  }

  useEffect(() => {
    if (!id) {
      setError("Customer ID is missing.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");

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

  // Warn when trying to close or reload with unsaved edits.
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener(
        "beforeunload",
        warnBeforeUnload
      );
    };
  }, [hasUnsavedChanges]);

  // --------------------------------------------------
  // UPDATE FORM VALUES
  // --------------------------------------------------

  function editPersonal(
    key: keyof PersonalForm,
    value: string
  ) {
    setPersonal((current) =>
      current ? { ...current, [key]: value } : current
    );

    setSaved((current) => ({
      ...current,
      personal: false,
    }));
  }

  function editEye(key: EyeKey, value: string) {
    setPrescription((current) =>
      current ? { ...current, [key]: value } : current
    );

    setSaved((current) => ({
      ...current,
      prescription: false,
    }));
  }

  function editPurchase(
    key: keyof PurchaseForm,
    value: string
  ) {
    setPurchase((current) =>
      current ? { ...current, [key]: value } : current
    );

    setSaved((current) => ({
      ...current,
      purchase: false,
    }));
  }

  // Ask before discarding a modified historical record.
  function choosePrescription(nextId: string) {
    if (prescriptionDirty) {
      const confirmed = window.confirm(
        "This prescription has unsaved changes. Discard them and select another prescription?"
      );

      if (!confirmed) return;
    }

    const selected = customer?.prescriptions.find(
      (item) => item.id === nextId
    );

    const values = selected
      ? prescriptionFrom(selected)
      : null;

    setPrescriptionId(nextId);
    setPrescription(values);
    setOriginalPrescription(values);

    setSaved((current) => ({
      ...current,
      prescription: false,
    }));

    setError("");
  }

  function choosePurchase(nextId: string) {
    if (purchaseDirty) {
      const confirmed = window.confirm(
        "This purchase has unsaved changes. Discard them and select another purchase?"
      );

      if (!confirmed) return;
    }

    const selected = customer?.records.find(
      (item) => item.id === nextId
    );

    const values = selected
      ? purchaseFrom(selected)
      : null;

    setRecordId(nextId);
    setPurchase(values);
    setOriginalPurchase(values);

    setSaved((current) => ({
      ...current,
      purchase: false,
    }));

    setError("");
  }

  // Refresh only the section that was saved.
  // Keep edits in the other sections untouched.
  async function refreshSavedSection(section: Section) {
    if (!id) return;

    const data = await getCustomer(id);

    setCustomer(data);

    if (section === "personal") {
      const values = personalFrom(data);
      setPersonal(values);
      setOriginalPersonal(values);
    }

    if (section === "prescription") {
      const selected = data.prescriptions.find(
        (item) => item.id === prescriptionId
      );

      const values = selected
        ? prescriptionFrom(selected)
        : null;

      setPrescription(values);
      setOriginalPrescription(values);
    }

    if (section === "purchase") {
      const selected = data.records.find(
        (item) => item.id === recordId
      );

      const values = selected
        ? purchaseFrom(selected)
        : null;

      setPurchase(values);
      setOriginalPurchase(values);
    }
  }

  // --------------------------------------------------
  // SAVE PERSONAL INFORMATION
  // --------------------------------------------------

  async function savePersonal() {
    if (!id || !personal || !personalDirty || saving) return;

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

      await updateCustomer(id, changes);

      // The PATCH succeeded. Confirm the saved values
      // by reading the customer again.
      await refreshSavedSection("personal");

      setSaved((current) => ({
        ...current,
        personal: true,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving(null);
    }
  }

  // --------------------------------------------------
  // SAVE PRESCRIPTION
  // --------------------------------------------------

  async function savePrescription() {
    if (
      !id ||
      !prescriptionId ||
      !prescription ||
      !prescriptionDirty ||
      saving
    ) {
      return;
    }

    try {
      const changes = buildPrescription(prescription);

      setSaving("prescription");
      setError("");

      await updatePrescription(
        id,
        prescriptionId,
        changes
      );

      await refreshSavedSection("prescription");

      setSaved((current) => ({
        ...current,
        prescription: true,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving(null);
    }
  }

  // --------------------------------------------------
  // SAVE PURCHASE
  // --------------------------------------------------

  async function savePurchase() {
    if (
      !id ||
      !recordId ||
      !purchase ||
      !purchaseDirty ||
      saving
    ) {
      return;
    }

    const date = purchase.purchaseDate.trim();

    if (date && !validDate(date)) {
      setError("Enter a valid purchase date.");
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
        "Enter valid prices with up to two decimal places."
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

      await updatePurchase(id, recordId, {
        record,
        purchaseDate: date || null,
      });

      await refreshSavedSection("purchase");

      setSaved((current) => ({
        ...current,
        purchase: true,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setSaving(null);
    }
  }

  // --------------------------------------------------
  // SAFE NAVIGATION
  // --------------------------------------------------

  function returnToDetails() {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave without saving them?"
      );

      if (!confirmed) return;
    }

    navigate(detailsUrl);
  }

  // --------------------------------------------------
  // PAGE CONTENT
  // --------------------------------------------------

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

  return (
    <Stack spacing={3} sx={{ pb: 5 }}>
      {/* PAGE HEADER */}
      <Box>
        <Button
          onClick={returnToDetails}
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

      {/* OVERALL UNSAVED CHANGE WARNING */}
      {hasUnsavedChanges && (
        <Alert
          severity="warning"
          icon={<WarningAmberOutlined />}
        >
          You have unsaved changes in {unsavedCount}{" "}
          {unsavedCount === 1 ? "section" : "sections"}.
          Save each modified section before leaving.
        </Alert>
      )}

      {/* GENERAL ERROR */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {/* -------------------------------------------
          PERSONAL INFORMATION
      ------------------------------------------- */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              mb: 2,
            }}
          >
            <Typography variant="h6">
              Personal Information
            </Typography>

            <SectionStatus
              dirty={personalDirty}
              saved={saved.personal}
              saving={saving === "personal"}
            />
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                required
                label="Customer Name"
                value={personal.name}
                disabled={Boolean(saving)}
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
                disabled={Boolean(saving)}
                onChange={(event) =>
                  editPersonal(
                    "mobNumber",
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10)
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
                fullWidth
                select
                label="Gender"
                value={personal.gender}
                disabled={Boolean(saving)}
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
                disabled={Boolean(saving)}
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
                disabled={Boolean(saving)}
                onChange={(event) =>
                  editPersonal("notes", event.target.value)
                }
                helperText="Staff only — do not include in customer PDFs."
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <SectionFeedback
              section="Personal information"
              dirty={personalDirty}
              saved={saved.personal}
              saving={saving === "personal"}
            />
          </Box>

          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={savePersonal}
            disabled={Boolean(saving) || !personalDirty}
            sx={{ mt: 2 }}
          >
            {saving === "personal"
              ? "Saving..."
              : "Save Personal Information"}
          </Button>
        </CardContent>
      </Card>

      {/* -------------------------------------------
          OPTICAL PRESCRIPTIONS
      ------------------------------------------- */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              mb: 2,
            }}
          >
            <Typography variant="h6">
              Optical Prescriptions
            </Typography>

            <SectionStatus
              dirty={prescriptionDirty}
              saved={saved.prescription}
              saving={saving === "prescription"}
            />
          </Stack>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            SPH and CYL have searchable dropdowns.
            AXIS is entered manually.
          </Typography>

          {customer.prescriptions.length === 0 ? (
            <Alert severity="info">
              No existing prescription is available to edit.
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
                    {new Date(
                      item.createdAt
                    ).toLocaleDateString("en-IN")}
                  </MenuItem>
                ))}
              </TextField>

              {prescription && (
                <>
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
                        minWidth: 560,
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
                        {eyeGroups.map((group) => {
                          const sphKey: EyeKey =
                            `${group.key}_sph`;

                          const cylKey: EyeKey =
                            `${group.key}_cyl`;

                          const axisKey: EyeKey =
                            `${group.key}_axis`;

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

                              {/* SPH DROPDOWN */}
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

                              {/* CYL DROPDOWN */}
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

                              {/* AXIS MANUAL ENTRY */}
                              <TableCell sx={{ minWidth: 115 }}>
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
                                      "aria-label":
                                        `${group.label} AXIS`,
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

                  <SectionFeedback
                    section="Optical prescription"
                    dirty={prescriptionDirty}
                    saved={saved.prescription}
                    saving={saving === "prescription"}
                  />

                  <Button
                    variant="contained"
                    startIcon={<SaveOutlined />}
                    onClick={savePrescription}
                    disabled={
                      Boolean(saving) || !prescriptionDirty
                    }
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

      {/* -------------------------------------------
          PURCHASE HISTORY
      ------------------------------------------- */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { sm: "center" },
              mb: 2,
            }}
          >
            <Typography variant="h6">
              Purchase History
            </Typography>

            <SectionStatus
              dirty={purchaseDirty}
              saved={saved.purchase}
              saving={saving === "purchase"}
            />
          </Stack>

          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Select a purchase and modify its date,
            frame, lens or pricing.
          </Typography>

          {customer.records.length === 0 ? (
            <Alert severity="info">
              No existing purchase records are available to edit.
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
                        disabled={Boolean(saving)}
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
                        disabled={Boolean(saving)}
                        onChange={(event) =>
                          editPurchase(
                            "specsType",
                            event.target.value
                          )
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Lens Type"
                        value={purchase.lensType}
                        disabled={Boolean(saving)}
                        onChange={(event) =>
                          editPurchase(
                            "lensType",
                            event.target.value
                          )
                        }
                      />
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        select
                        label="Pricing Mode"
                        value={purchase.pricingMode}
                        disabled={Boolean(saving)}
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
                            disabled={Boolean(saving)}
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
                            disabled={Boolean(saving)}
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
                          disabled={Boolean(saving)}
                          onChange={(event) =>
                            editPurchase(
                              "mrp",
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
                    )}
                  </Grid>

                  <SectionFeedback
                    section="Purchase history"
                    dirty={purchaseDirty}
                    saved={saved.purchase}
                    saving={saving === "purchase"}
                  />

                  <Button
                    variant="contained"
                    startIcon={<SaveOutlined />}
                    onClick={savePurchase}
                    disabled={Boolean(saving) || !purchaseDirty}
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
        onClick={returnToDetails}
        sx={{ alignSelf: "flex-start" }}
      >
        Return to Customer Details
      </Button>
    </Stack>
  );
}
