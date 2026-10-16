/**
 * Edit Customer — Optical CRM
 * nik - Edit existing customers and individual historical purchases.
 * Catalog options are searchable; custom text is supported.
 * Old linked products are retained if staff edit prices or dates only.
 */


import { useEffect, useState } from "react";
import {
  Alert,
  Tabs,
  Tab,
  Box,
  Chip,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import { Autocomplete, createFilterOptions } from "@mui/material";
import { getFrames, getLenses, type FrameProduct, type LensProduct } from "../services/catalogApi";
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
// 1. PRODUCT SEARCH AND HISTORICAL LABELS
// --------------------------------------------------
// nik - Catalog searching checks metadata, but the saved historical
// text is kept unchanged until the product selection itself changes.
const frameFilter = createFilterOptions<FrameProduct>({
  stringify: (frame) => [frame.brand, frame.model, frame.frameCode, frame.frameStyle]
    .filter(Boolean).join(" "),
});
const lensFilter = createFilterOptions<LensProduct>({
  stringify: (lens) => [lens.company, lens.lensName, lens.visionType, lens.coating, lens.lensCode]
    .filter(Boolean).join(" "),
});

// --------------------------------------------------
// 2. FORM TYPES
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
  frameCatalogId: string | null;
  lensCatalogId: string | null;
  pricingMode: "SPLIT" | "MRP_ONLY";
  frameRate: string;
  lensRate: string;
  mrp: string;
  purchaseDate: string;
};
const eyePrefixes = [
  "re_dist",
  "le_dist",
  "re_near",
  "le_near",
] as const;
const measures = ["sph", "cyl", "axis"] as const;
type EyePrefix = (typeof eyePrefixes)[number];
type Measure = (typeof measures)[number];
type EyeKey = `${EyePrefix}_${Measure}`;
type PrescriptionForm = Record<EyeKey, string>;
const eyeGroups: { key: EyePrefix; title: string }[] = [
  { key: "re_dist", title: "RE DIST" },
  { key: "re_near", title: "RE NEAR" },
  { key: "le_dist", title: "LE DIST" },
  { key: "le_near", title: "LE NEAR" },
];
// Display powers in steps of 0.25.
// Staff can search or pick a value from the dropdown.
function powerOptions(min: number, max: number): string[] {
  const values: string[] = [];
  for (let quarter = min * 4; quarter <= max * 4; quarter++) {
    const value = quarter / 4;
    values.push(
      `${value > 0 ? "+" : ""}${value.toFixed(2)}`
    );
  }
  return values;
}
const sphOptions = powerOptions(-30, 30);
const cylOptions = powerOptions(-15, 15);
function toText(value: unknown): string {
  return value === null || value === undefined
    ? ""
    : String(value);
}
// Prisma serializes dates as ISO strings.
// A date input needs only the YYYY-MM-DD part.
function dateValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}
function personalFrom(customer: CustomerDetails): PersonalForm {
  const gender = customer.gender;
  return {
    name: customer.name,
    mobNumber: customer.mobNumber ?? "",
    gender:
      gender === "Male" || gender === "Female" || gender === "Other"
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
    frameCatalogId: record.frameCatalogId ?? null,
    lensCatalogId: record.lensCatalogId ?? null,
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
    le_dist_sph: toText(p.leDistSph),
    le_dist_cyl: toText(p.leDistCyl),
    le_dist_axis: toText(p.leDistAxis),
    re_near_sph: toText(p.reNearSph),
    re_near_cyl: toText(p.reNearCyl),
    re_near_axis: toText(p.reNearAxis),
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
// Convert editable strings into the API prescription format.
// Empty fields become null so staff can clear old measurements.
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
    for (const measure of measures) {
      const value = form[`${prefix}_${measure}`].trim();
      if (value !== "") {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          throw new Error("Enter valid prescription numbers.");
        }
        if (measure === "axis") {
          if (!Number.isInteger(number) || number < 0 || number > 180) {
            throw new Error("AXIS must be a whole number from 0 to 180.");
          }
        } else {
          const limit = measure === "sph" ? 30 : 15;
          if (
            !/^[+-]?\d+(\.\d+)?$/.test(value) ||
            number < -limit ||
            number > limit
          ) {
            throw new Error(
              `${measure.toUpperCase()} must be between -${limit} and ${limit}.`
            );
          }
        }
        eye[measure] = number;
      }
    }
    result[prefix] = eye;
  }
  return result;
}
// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------
// nik - Edit personal data and exact historical records.
export default function EditCustomerPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [personal, setPersonal] = useState<PersonalForm | null>(null);
  const [purchase, setPurchase] = useState<PurchaseForm | null>(null);
  const [prescription, setPrescription] =
    useState<PrescriptionForm | null>(null);
  const [recordId, setRecordId] = useState("");
  const [prescriptionId, setPrescriptionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // nik - Keep one edit workspace open at a time. Purchase history comes first.
  const [activeTab, setActiveTab] = useState<"purchase" | "prescription" | "personal">("purchase");

  // nik - Load all catalog products to preserve inactive historical selections.
  // Only active products are offered for new selections.
  const [frames, setFrames] = useState<FrameProduct[]>([]);
  const [lenses, setLenses] = useState<LensProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      try {
        const [frameProducts, lensProducts] = await Promise.all([
          getFrames(true),
          getLenses(true),
        ]);
        if (!mounted) return;
        setFrames(frameProducts);
        setLenses(lensProducts);
      } catch (err) {
        if (mounted) {
          setCatalogError(err instanceof Error ? err.message : "Catalog unavailable");
        }
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    }
    void loadProducts();
    return () => { mounted = false; };
  }, []);
  const search = params.get("search") ?? "";
  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : "";
  const detailsUrl = id
    ? `/customers/${id}${query}`
    : "/customers";
  // Populate all form sections from one API response.
  function loadIntoForms(data: CustomerDetails) {
    setCustomer(data);
    setPersonal(personalFrom(data));
    const firstRecord = data.records[0];
    const firstPrescription = data.prescriptions[0];
    setRecordId(firstRecord?.id ?? "");
    setPurchase(firstRecord ? purchaseFrom(firstRecord) : null);
    setPrescriptionId(firstPrescription?.id ?? "");
    setPrescription(
      firstPrescription ? prescriptionFrom(firstPrescription) : null
    );
  }
  // Read the customer's existing data once on page load.
  useEffect(() => {
    if (!id) {
      void Promise.resolve().then(() => {
        setLoading(false);
        setError("Customer ID is missing.");
      });
      return;
    }
    const controller = new AbortController();
    // nik - Change loading state outside the synchronous effect body.
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoading(true);
    });
    getCustomer(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) loadIntoForms(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Failed to load customer."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);
  function editPersonal(key: keyof PersonalForm, value: string) {
    setPersonal((previous) =>
      previous ? { ...previous, [key]: value } : previous
    );
  }
  // nik - Changes to product text disconnect old catalog IDs.
  // Selecting a product below reconnects the correct ID.
  function editPurchase(key: keyof PurchaseForm, value: string) {
    setPurchase((previous) => {
      if (!previous) return previous;
      if (key === "specsType") {
        return { ...previous, specsType: value, frameCatalogId: null };
      }
      if (key === "lensType") {
        return { ...previous, lensType: value, lensCatalogId: null };
      }
      return { ...previous, [key]: value };
    });
  }

  function selectFrame(product: FrameProduct | string | null) {
    setPurchase((previous) => {
      if (!previous) return previous;
      if (!product || typeof product === "string") {
        return { ...previous, specsType: product ?? "", frameCatalogId: null };
      }
      return {
        ...previous,
        specsType: `${product.brand} - ${product.model}`,
        frameCatalogId: product.id,
      };
    });
  }

  function selectLens(product: LensProduct | string | null) {
    setPurchase((previous) => {
      if (!previous) return previous;
      if (!product || typeof product === "string") {
        return { ...previous, lensType: product ?? "", lensCatalogId: null };
      }
      return {
        ...previous,
        lensType: [product.company, product.lensName, product.visionType, product.coating]
          .filter(Boolean).join(" - "),
        lensCatalogId: product.id,
      };
    });
  }
  function editEye(key: EyeKey, value: string) {
    setPrescription((previous) =>
      previous ? { ...previous, [key]: value } : previous
    );
  }
  // Choose a specific purchase rather than always editing the latest.
  function choosePurchase(nextId: string) {
    // nik - Prevent accidental loss of unsaved changes when switching history.
    const original = customer?.records.find((r) => r.id === recordId);
    if (original && purchase &&
        JSON.stringify(purchaseFrom(original)) !== JSON.stringify(purchase) &&
        !window.confirm("Discard unsaved purchase changes and switch records?")) return;
    const selected = customer?.records.find((r) => r.id === nextId);
    setRecordId(nextId);
    setPurchase(selected ? purchaseFrom(selected) : null);
    setError("");
    setMessage("");
  }
  // Choose a specific prescription from the history.
  function choosePrescription(nextId: string) {
    const original = customer?.prescriptions.find((p) => p.id === prescriptionId);
    if (original && prescription &&
        JSON.stringify(prescriptionFrom(original)) !== JSON.stringify(prescription) &&
        !window.confirm("Discard unsaved prescription changes and switch records?")) return;
    const selected = customer?.prescriptions.find(
      (p) => p.id === nextId
    );
    setPrescriptionId(nextId);
    setPrescription(
      selected ? prescriptionFrom(selected) : null
    );
    setError("");
    setMessage("");
  }
  // Refresh saved values while keeping the selected records.
  async function refreshRecords() {
    if (!id) return;
    const data = await getCustomer(id);
    setCustomer(data);
    const selectedRecord = data.records.find((r) => r.id === recordId);
    const selectedPrescription = data.prescriptions.find(
      (p) => p.id === prescriptionId
    );
    setPurchase(selectedRecord ? purchaseFrom(selectedRecord) : null);
    setPrescription(
      selectedPrescription
        ? prescriptionFrom(selectedPrescription)
        : null
    );
  }
  async function savePersonal() {
    if (!id || !personal) return;
    const name = personal.name.trim();
    const phone = personal.mobNumber.trim();
    if (!name || name.length > 150) {
      setError("Enter a customer name up to 150 characters.");
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
      setMessage("");
      await updateCustomer(id, changes);
      await refreshRecords();
      setMessage("Customer information saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving("");
    }
  }
  async function savePrescription() {
    if (!id || !prescriptionId || !prescription) return;
    try {
      const changes = buildPrescription(prescription);
      setSaving("prescription");
      setError("");
      setMessage("");
      await updatePrescription(id, prescriptionId, changes);
      await refreshRecords();
      setMessage("Selected prescription saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving("");
    }
  }
  async function savePurchase() {
    if (!id || !recordId || !purchase) return;
    const date = purchase.purchaseDate.trim();
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    ) {
      setError("Enter a valid purchase date.");
      return;
    }
    if (purchase.specsType.trim().length > 100 || purchase.lensType.trim().length > 100) {
      setError("Frame and lens names must each be at most 100 characters.");
      return;
    }
    const oldRecord = customer?.records.find((r) => r.id === recordId);
    // nik - Omit IDs that have not changed. This keeps historical inactive
    // products linked without forcing the backend to revalidate their status.
    // Explicit null unlinks a product when the user types a custom name.
    const common = {
      specsType: purchase.specsType.trim() || null,
      lensType: purchase.lensType.trim() || null,
      ...(purchase.frameCatalogId !== (oldRecord?.frameCatalogId ?? null)
        ? { frameCatalogId: purchase.frameCatalogId }
        : {}),
      ...(purchase.lensCatalogId !== (oldRecord?.lensCatalogId ?? null)
        ? { lensCatalogId: purchase.lensCatalogId }
        : {}),
    };
    const isSplit = purchase.pricingMode === "SPLIT";
    if (
      isSplit
        ? !validMoney(purchase.frameRate) ||
          !validMoney(purchase.lensRate)
        : !validMoney(purchase.mrp)
    ) {
      setError("Enter valid prices with at most 2 decimal places.");
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
      await refreshRecords();
      setMessage("Selected purchase saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving("");
    }
  }
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
      <Box>
        <Button
          component={Link}
          to={detailsUrl}
          startIcon={<ArrowBackOutlined />}
        >
          Back to Customer Details
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700, mt: 2 }}>
          Edit Customer
        </Typography>
        <Typography color="text.secondary">
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
      {/* nik - One clear navigation bar replaces three long stacked editors.
          Switching tabs keeps your in-progress form values. */}
      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: "purchase" | "prescription" | "personal") => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Customer edit sections"
          sx={{ px: 1, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 58, fontWeight: 700 } }}
        >
          <Tab value="purchase" icon={<ReceiptLongOutlined fontSize="small" />} iconPosition="start" label={`Purchases (${customer.records.length})`} />
          <Tab value="prescription" icon={<VisibilityOutlined fontSize="small" />} iconPosition="start" label={`Prescriptions (${customer.prescriptions.length})`} />
          <Tab value="personal" icon={<PersonOutlined fontSize="small" />} iconPosition="start" label="Personal Details" />
        </Tabs>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.75, bgcolor: "action.hover" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {activeTab === "purchase" ? "Edit Purchase History" : activeTab === "prescription" ? "Edit Optical Prescription" : "Edit Personal Information"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {activeTab === "purchase" ? "Choose a past purchase, then update its date, products or pricing." : activeTab === "prescription" ? "Select a saved prescription, then edit its eye measurements." : "Update customer contact details and private staff notes."}
          </Typography>
        </Box>
      </Paper>
      {/* nik - Each panel saves independently; inactive panels stay mounted logically in React state. */}
      {activeTab === "personal" && (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
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
                onChange={(e) => editPersonal("name", e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Mobile Number"
                value={personal.mobNumber}
                onChange={(e) =>
                  editPersonal(
                    "mobNumber",
                    e.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                slotProps={{
                  htmlInput: { inputMode: "numeric" },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Gender"
                value={personal.gender}
                onChange={(e) => editPersonal("gender", e.target.value)}
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
                onChange={(e) => editPersonal("reference", e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Internal Notes"
                value={personal.notes}
                onChange={(e) => editPersonal("notes", e.target.value)}
                helperText="Staff only — never include in customer PDFs."
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
      )}
      {/* nik - The prescription editor is only shown on its own tab. */}
      {activeTab === "prescription" && (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Prescription History
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Select the prescription you want to edit.
          </Typography>
          {customer.prescriptions.length === 0 ? (
            <Alert severity="info">
              This customer has no saved prescription.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {/* nik - Searchable history selector instead of a long native dropdown. */}
              <Autocomplete
                fullWidth
                disableClearable
                options={customer.prescriptions}
                value={customer.prescriptions.find((item) => item.id === prescriptionId) ?? customer.prescriptions[0]}
                getOptionLabel={(item) => `Prescription ${customer.prescriptions.findIndex((p) => p.id === item.id) + 1} · ${new Date(item.createdAt).toLocaleDateString("en-IN")}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, selected) => { if (selected) choosePrescription(selected.id); }}
                disabled={Boolean(saving)}
                renderInput={(params) => <TextField {...params} label="Find a saved prescription" placeholder="Search by date or number" />}
              />
              <Alert severity="info" sx={{ py: 0.5 }}>Select or type SPH / CYL values; AXIS accepts whole numbers 0–180.</Alert>
              {prescription && (
                <>
                  {/* Editable optical prescription grid, in the shop's preferred order. */}
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table size="small" sx={{ minWidth: 540 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: "background.default" }}>
                          <TableCell sx={{ fontWeight: 700 }}>Eye / Vision</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>SPH</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>CYL</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>AXIS</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {eyeGroups.map((group) => {
                          const sphKey: EyeKey = `${group.key}_sph`;
                          const cylKey: EyeKey = `${group.key}_cyl`;
                          const axisKey: EyeKey = `${group.key}_axis`;
                          return (
                            <TableRow key={group.key} hover>
                              <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                                {group.title}
                              </TableCell>
                              <TableCell sx={{ minWidth: 145 }}>
                                <Autocomplete
                                  freeSolo
                                  size="small"
                                  options={sphOptions}
                                  openOnFocus
                                  forcePopupIcon
                                  clearOnBlur={false}
                                  value={prescription[sphKey]}
                                  inputValue={prescription[sphKey]}
                                  onInputChange={(_, value, reason) => {
                                    if (reason === "input" || reason === "clear") {
                                      editEye(sphKey, value);
                                    }
                                  }}
                                  onChange={(_, value) => editEye(sphKey, value ?? "")}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder="SPH"
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell sx={{ minWidth: 145 }}>
                                <Autocomplete
                                  freeSolo
                                  size="small"
                                  options={cylOptions}
                                  openOnFocus
                                  forcePopupIcon
                                  clearOnBlur={false}
                                  value={prescription[cylKey]}
                                  inputValue={prescription[cylKey]}
                                  onInputChange={(_, value, reason) => {
                                    if (reason === "input" || reason === "clear") {
                                      editEye(cylKey, value);
                                    }
                                  }}
                                  onChange={(_, value) => editEye(cylKey, value ?? "")}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      placeholder="CYL"
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell sx={{ minWidth: 115 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  placeholder="0–180"
                                  value={prescription[axisKey]}
                                  onChange={(event) =>
                                    editEye(
                                      axisKey,
                                      event.target.value.replace(/\D/g, "").slice(0, 3)
                                    )
                                  }
                                  slotProps={{
                                    htmlInput: {
                                      inputMode: "numeric",
                                      "aria-label": `${group.title} AXIS`,
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
                    onClick={savePrescription}
                    disabled={Boolean(saving)}
                    startIcon={<SaveOutlined />}
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
      )}
      {/* nik - Purchase editor is the default workspace, with catalog dropdowns inside. */}
      {activeTab === "purchase" && (
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Purchase History
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Select the exact purchase you want to edit.
          </Typography>
          {customer.records.length === 0 ? (
            <Alert severity="info">
              This customer has no saved purchase records.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {/* nik - A searchable purchase selector shows dates and actual products. */}
              <Autocomplete
                fullWidth
                disableClearable
                options={customer.records}
                value={customer.records.find((item) => item.id === recordId) ?? customer.records[0]}
                getOptionLabel={(item) => {
                  const index = customer.records.findIndex((r) => r.id === item.id);
                  const type = item.specsType?.trim() && item.lensType?.trim() ? "Frame + Lens" : item.specsType?.trim() ? "Frame Only" : item.lensType?.trim() ? "Lens Only" : "Not Specified";
                  return `Purchase ${customer.records.length - index} · ${item.purchaseDate ? dateValue(item.purchaseDate) : "No date"} · ${type} · ₹${toText(item.mrp)}`;
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, selected) => { if (selected) choosePurchase(selected.id); }}
                disabled={Boolean(saving)}
                

renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Find a saved purchase"
                    placeholder="Search purchase number, date or type"
                  />
                )}
              />
              {catalogLoading && <Alert severity="info">Loading frame and lens catalog...</Alert>}
              {catalogError && <Alert severity="warning">Catalog could not load: {catalogError}. Manual entries still work.</Alert>}
              {purchase && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Chip size="small" variant="outlined" color={purchase.specsType.trim() && purchase.lensType.trim() ? "primary" : "default"}
                  label={purchase.specsType.trim() && purchase.lensType.trim() ? "Frame + Lens" : purchase.specsType.trim() ? "Frame Only" : purchase.lensType.trim() ? "Lens Only" : "Not Specified"} />
                <Chip size="small" variant="outlined" label={purchase.pricingMode === "SPLIT" ? "Split Pricing" : "MRP Only"} />
              </Stack>}
              {purchase && (
                <>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Date of Purchase"
                        type="date"
                        value={purchase.purchaseDate}
                        onChange={(e) =>
                          editPurchase("purchaseDate", e.target.value)
                        }
                        slotProps={{
                          inputLabel: { shrink: true },
                        }}
                        helperText="Actual purchase date, not database creation date."
                      />
                    </Grid>
                    {/* nik - Search active frames or type a custom frame.
                        Previously selected inactive items remain visible. */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Autocomplete<FrameProduct, false, false, true>
                        freeSolo
                        fullWidth
                        openOnFocus
                        autoHighlight
                        clearOnBlur={false}
                        noOptionsText="No matching frames — type a custom name"
                        options={frames.filter((item) => item.isActive || item.id === purchase.frameCatalogId)}
                        loading={catalogLoading}
                        disabled={Boolean(saving)}
                        filterOptions={frameFilter}
                        getOptionLabel={(item) => typeof item === "string" ? item : `${item.brand} - ${item.model}`}
                        isOptionEqualToValue={(option, value) => typeof value !== "string" && option.id === value.id}
                        value={frames.find((item) => item.id === purchase.frameCatalogId) ?? purchase.specsType}
                        inputValue={purchase.specsType}
                        onInputChange={(_, value, reason) => {
                          if (reason === "input" || reason === "clear") editPurchase("specsType", value);
                        }}
                        onChange={(_, value) => selectFrame(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Spectacle / Frame Type"
                            placeholder="Choose from catalog or type a frame"
                            helperText={purchase.frameCatalogId ? "Linked to Frame Catalog (saved historical name stays unchanged)" : "Search catalog or enter a custom frame (max 100 characters)"}
                          />
                        )}
                      />
                    </Grid>
                    {/* nik - Search company, lens, vision type, and coating.
                        Custom text is saved without a catalog link. */}
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Autocomplete<LensProduct, false, false, true>
                        freeSolo
                        fullWidth
                        openOnFocus
                        autoHighlight
                        clearOnBlur={false}
                        noOptionsText="No matching lenses — type a custom name"
                        options={lenses.filter((item) => item.isActive || item.id === purchase.lensCatalogId)}
                        loading={catalogLoading}
                        disabled={Boolean(saving)}
                        filterOptions={lensFilter}
                        getOptionLabel={(item) => typeof item === "string" ? item : [item.company, item.lensName, item.visionType, item.coating].filter(Boolean).join(" - ")}
                        isOptionEqualToValue={(option, value) => typeof value !== "string" && option.id === value.id}
                        value={lenses.find((item) => item.id === purchase.lensCatalogId) ?? purchase.lensType}
                        inputValue={purchase.lensType}
                        onInputChange={(_, value, reason) => {
                          if (reason === "input" || reason === "clear") editPurchase("lensType", value);
                        }}
                        onChange={(_, value) => selectLens(value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Lens Type"
                            placeholder="Choose from catalog or type a lens"
                            helperText={purchase.lensCatalogId ? "Linked to Lens Catalog (saved historical name stays unchanged)" : "Search company, model, coating or type a lens (max 100 characters)"}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        select
                        fullWidth
                        label="Pricing Mode"
                        value={purchase.pricingMode}
                        onChange={(e) =>
                          editPurchase("pricingMode", e.target.value)
                        }
                      >
                        <MenuItem value="SPLIT">
                          Separate Frame / Lens Rates
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
                            onChange={(e) =>
                              editPurchase("frameRate", e.target.value)
                            }
                            slotProps={{
                              htmlInput: { inputMode: "decimal" },
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <TextField
                            fullWidth
                            label="Lens Rate (₹)"
                            value={purchase.lensRate}
                            onChange={(e) =>
                              editPurchase("lensRate", e.target.value)
                            }
                            slotProps={{
                              htmlInput: { inputMode: "decimal" },
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
                          onChange={(e) =>
                            editPurchase("mrp", e.target.value)
                          }
                          slotProps={{
                            htmlInput: { inputMode: "decimal" },
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
      )}
      <Button
        variant="outlined"
        onClick={() => navigate(detailsUrl)}
        startIcon={<ArrowBackOutlined />}
        sx={{ alignSelf: "flex-start" }}
      >
        Return to Customer Details
      </Button>
    </Stack>
  );
}
