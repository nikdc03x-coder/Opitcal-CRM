
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Avatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";

import {
  Link,
  useParams,
  useSearchParams,
} from "react-router";

import {
  getCustomer,
  type CustomerDetails,
  type CustomerRecord,
  type Prescription,
} from "../services/customerApi";

// -----------------------------------------------------
// 1. LIGHTWEIGHT CUSTOMER CACHE
// -----------------------------------------------------

// nik - Keep recently viewed customer records in memory.
// This avoids showing a blank page every time staff go
// from Customer Details to Edit and back again.
//
// Data is always refreshed from the backend when
// the customer details page opens.
//
// Cache lives only in this browser tab's JavaScript memory.
const CACHE_TIME_MS = 30_000;
const MAX_CACHE_ITEMS = 20;

type CachedCustomer = {
  data: CustomerDetails;
  savedAt: number;
};

const customerCache = new Map<string, CachedCustomer>();

function readCachedCustomer(
  id: string
): CustomerDetails | null {
  const cached = customerCache.get(id);

  if (!cached) return null;

  if (Date.now() - cached.savedAt > CACHE_TIME_MS) {
    customerCache.delete(id);
    return null;
  }

  return cached.data;
}

function saveCachedCustomer(
  id: string,
  data: CustomerDetails
) {
  // Keep the cache small.
  if (customerCache.has(id)) {
    customerCache.delete(id);
  }

  customerCache.set(id, {
    data,
    savedAt: Date.now(),
  });

  if (customerCache.size > MAX_CACHE_ITEMS) {
    const oldestKey = customerCache.keys().next().value;

    if (oldestKey) {
      customerCache.delete(oldestKey);
    }
  }
}

// -----------------------------------------------------
// 2. DISPLAY HELPERS
// -----------------------------------------------------

function display(
  value: string | number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

// Format prices in Indian rupees.
function formatMoney(
  value: string | number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Format a saved date without a timezone-related day shift.
function formatDate(
  value: string | null | undefined
): string {
  if (!value) return "Not recorded";

  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);

  if (!match) return "Unknown date";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Format optical power with signs and two decimal places.
function formatPower(
  value: string | number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  const safeNumber = Object.is(number, -0) ? 0 : number;

  return `${safeNumber > 0 ? "+" : ""}${safeNumber.toFixed(2)}`;
}

// -----------------------------------------------------
// 3. AUTOMATIC PURCHASE FLAGS
// -----------------------------------------------------

// nik - Determine what was actually purchased from the
// saved product names. Pricing mode is NOT purchase type.
// Works for both catalog selections and custom typed names.
type PurchaseFlag =
  | "FRAME_ONLY"
  | "LENS_ONLY"
  | "FRAME_AND_LENS"
  | "NOT_SPECIFIED";

function getPurchaseFlag(record: CustomerRecord): PurchaseFlag {
  const hasFrame = Boolean(record.specsType?.trim());
  const hasLens = Boolean(record.lensType?.trim());

  if (hasFrame && hasLens) return "FRAME_AND_LENS";
  if (hasFrame) return "FRAME_ONLY";
  if (hasLens) return "LENS_ONLY";
  return "NOT_SPECIFIED";
}

// Use one consistent label and color across the page.
const purchaseFlagInfo: Record<
  PurchaseFlag,
  {
    label: string;
    color: "primary" | "success" | "info" | "default";
  }
> = {
  FRAME_ONLY: { label: "Frame Only", color: "info" },
  LENS_ONLY: { label: "Lens Only", color: "success" },
  FRAME_AND_LENS: { label: "Frame + Lens", color: "primary" },
  NOT_SPECIFIED: { label: "Not Specified", color: "default" },
};

// Display the product flag independently from the payment mode.
function PurchaseFlagChip({ record }: { record: CustomerRecord }) {
  const flag = purchaseFlagInfo[getPurchaseFlag(record)];
  return <Chip label={flag.label} color={flag.color} size="small" />;
}

// -----------------------------------------------------
// 4. REUSABLE DETAIL COMPONENTS
// -----------------------------------------------------

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.5,
          fontWeight: 500,
          overflowWrap: "anywhere",
        }}
      >
        {display(value)}
      </Typography>
    </Box>
  );
}

function PrescriptionRow({
  label,
  description,
  sph,
  cyl,
  axis,
}: {
  label: string;
  description: string;
  sph: string | number | null;
  cyl: string | number | null;
  axis: string | number | null;
}) {
  return (
    <TableRow hover>
      <TableCell sx={{ minWidth: 155 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {label}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatPower(sph)}
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatPower(cyl)}
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display(axis)}
      </TableCell>
    </TableRow>
  );
}

// Show prescriptions in the exact order requested by the shop.
function PrescriptionTable({
  prescription,
}: {
  prescription: Prescription;
}) {
  return (
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
          minWidth: 520,
          "& .MuiTableCell-root": {
            px: 2,
            py: 1.5,
          },
        }}
      >
        <TableHead>
          <TableRow sx={{ bgcolor: "background.default" }}>
            <TableCell sx={{ fontWeight: 700 }}>
              Eye / Vision
            </TableCell>

            <TableCell align="center" sx={{ fontWeight: 700 }}>
              SPH
            </TableCell>

            <TableCell align="center" sx={{ fontWeight: 700 }}>
              CYL
            </TableCell>

            <TableCell align="center" sx={{ fontWeight: 700 }}>
              AXIS
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          <PrescriptionRow
            label="RE DIST"
            description="Right Eye Distance"
            sph={prescription.reDistSph}
            cyl={prescription.reDistCyl}
            axis={prescription.reDistAxis}
          />

          <PrescriptionRow
            label="RE NEAR"
            description="Right Eye Near"
            sph={prescription.reNearSph}
            cyl={prescription.reNearCyl}
            axis={prescription.reNearAxis}
          />

          <PrescriptionRow
            label="LE DIST"
            description="Left Eye Distance"
            sph={prescription.leDistSph}
            cyl={prescription.leDistCyl}
            axis={prescription.leDistAxis}
          />

          <PrescriptionRow
            label="LE NEAR"
            description="Left Eye Near"
            sph={prescription.leNearSph}
            cyl={prescription.leNearCyl}
            axis={prescription.leNearAxis}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// -----------------------------------------------------
// 5. LOADING SKELETON
// -----------------------------------------------------

// Display a lightweight layout immediately,
// instead of an empty screen with only a spinner.
function CustomerDetailsSkeleton() {
  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <Box>
        <Skeleton width={160} height={35} />
        <Skeleton width="45%" height={50} />
        <Skeleton width="65%" height={25} />
      </Box>

      {[1, 2, 3].map((item) => (
        <Card key={item}>
          <CardContent sx={{ p: 3 }}>
            <Skeleton width="35%" height={35} />
            <Skeleton sx={{ mt: 2 }} height={28} />
            <Skeleton height={28} />
            <Skeleton height={28} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// -----------------------------------------------------
// 6. CUSTOMER DETAIL PAGE
// -----------------------------------------------------

// nik - Each customer is identified by its unique ID.
// Different customers may share the same mobile number.
export default function CustomerDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();

  const [customer, setCustomer] =
    useState<CustomerDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");

  // nik - Abort outdated customer requests when refreshing or switching customers.
  const requestRef = useRef<AbortController | null>(null);

  const previousSearch = params.get("search") ?? "";

  const searchQuery = previousSearch
    ? `?search=${encodeURIComponent(previousSearch)}`
    : "";

  const backUrl = `/customers${searchQuery}`;

  // Restore recent data immediately, then fetch fresh data.
  useEffect(() => {
    if (!id) {
      setCustomer(null);
      setLoading(false);
      setError("Customer ID is missing.");
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const cached = readCachedCustomer(id);

    setCustomer(cached);
    setLoading(!cached);
    setRefreshing(Boolean(cached));
    setError("");

    getCustomer(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || requestRef.current !== controller || result.id !== id) return;

        saveCachedCustomer(id, result);
        setCustomer(result);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted || requestRef.current !== controller) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load customer details."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      controller.abort();
      if (requestRef.current === controller) requestRef.current = null;
    };
  }, [id]);

  // nik - A new refresh cancels older requests, preventing stale UI updates.
  async function handleRefresh() {
    if (!id || refreshing) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setRefreshing(true);
    setLoading(false);
    setError("");

    try {
      const result = await getCustomer(id, controller.signal);
      if (controller.signal.aborted || requestRef.current !== controller || result.id !== id) return;

      saveCachedCustomer(id, result);
      setCustomer(result);
    } catch (err) {
      if (controller.signal.aborted || requestRef.current !== controller) return;
      setError(err instanceof Error ? err.message : "Unable to refresh customer details.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }

  // Show skeleton only for the initial uncached load.
  if (loading && !customer) {
    return <CustomerDetailsSkeleton />;
  }

  // No record is available.
  if (!customer) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">
          {error || "Customer not found."}
        </Alert>

        <Button
          component={Link}
          to={backUrl}
          startIcon={<ArrowBackOutlined />}
          sx={{ alignSelf: "flex-start" }}
        >
          Back to Customers
        </Button>
      </Stack>
    );
  }

  const editUrl = `/customers/${customer.id}/edit${searchQuery}`;
  // nik - Product names determine purchase type, not the pricing method.
  const latestRecord = customer.records[0];
  const initials = customer.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const totalSpent = customer.records.reduce((sum, item) => sum + (Number(item.mrp) || 0), 0);

  async function copyCustomerId() {
    try {
     if (!customer) return;
await navigator.clipboard.writeText(customer.id);
      setCopyMessage("Customer ID copied");
    } catch {
      setCopyMessage("Could not copy Customer ID");
    }
  }

  return (
    <Box sx={{ maxWidth: 1250, mx: "auto", pb: 6 }}>
      <Stack spacing={2.5}>
        {/* nik - Return to the previous customer search without losing the query. */}
        <Box>
          <Button component={Link} to={backUrl} startIcon={<ArrowBackOutlined />} size="small">
            Back to Customers
          </Button>
        </Box>

        {/* Customer identity and frequently used actions. */}
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          <CardContent sx={{ p: { xs: 2, md: 3 }, "&:last-child": { pb: { xs: 2, md: 3 } } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
                <Avatar sx={{ width: 62, height: 62, bgcolor: "primary.main", fontSize: 23, fontWeight: 700 }}>
                  {initials || <PersonOutlined />}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, overflowWrap: "anywhere", fontSize: { xs: "1.55rem", md: "2rem" } }}>
                    {customer.name}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.6, flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
                    <Typography color="text.secondary" variant="body2">{customer.mobNumber || "No mobile number"}</Typography>
                    <Chip size="small" variant="outlined" label={`${customer.records.length} purchases`} />
                    <Chip size="small" variant="outlined" label={`${customer.prescriptions.length} prescriptions`} />
                  </Stack>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {customer.mobNumber && (
                  <Button component="a" href={`tel:${customer.mobNumber}`} variant="outlined" startIcon={<PhoneOutlined />}>
                    Call
                  </Button>
                )}
                <Button variant="outlined" onClick={handleRefresh} disabled={refreshing} startIcon={refreshing ? <CircularProgress size={17} /> : <RefreshOutlined />}>
                  {refreshing ? "Refreshing" : "Refresh"}
                </Button>
                <Button component={Link} to={editUrl} variant="contained" startIcon={<EditOutlined />}>
                  Edit Customer
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="warning" onClose={() => setError("")}>Unable to refresh: {error}. Showing the last available information.</Alert>}
        {copyMessage && <Alert severity="info" onClose={() => setCopyMessage("")}>{copyMessage}</Alert>}

        {/* Small, useful facts are easier to scan than repeated full-size cards. */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Purchase Records</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>{customer.records.length}</Typography>
                <Typography variant="caption" color="text.secondary">{latestRecord ? `Latest: ${formatDate(latestRecord.purchaseDate)}` : "No purchases recorded"}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Purchase Value</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>{formatMoney(totalSpent)}</Typography>
                <Typography variant="caption" color="text.secondary">Sum of saved purchase MRP amounts</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Prescription Records</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>{customer.prescriptions.length}</Typography>
                <Typography variant="caption" color="text.secondary">Saved optical prescriptions</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Personal information remains immediately visible. */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
              <PersonOutlined color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Personal Information</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Customer Name" value={customer.name} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Mobile Number" value={customer.mobNumber} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Gender" value={customer.gender} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Reference" value={customer.reference} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Registered" value={formatDate(customer.createdAt)} /></Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}><DetailItem label="Updated" value={formatDate(customer.updatedAt)} /></Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>ID: {customer.id}</Typography>
              <Tooltip title="Copy customer ID">
                <IconButton size="small" onClick={() => { void copyCustomerId(); }} aria-label="Copy customer ID"><ContentCopyOutlined fontSize="inherit" /></IconButton>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>

        {/* nik - Tabs keep long purchase and prescription histories manageable. */}
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs value={activeTab} onChange={(_, next: number) => setActiveTab(next)} variant="scrollable" scrollButtons="auto" aria-label="Customer details sections">
              <Tab icon={<ReceiptLongOutlined />} iconPosition="start" label={`Purchases (${customer.records.length})`} />
              <Tab icon={<VisibilityOutlined />} iconPosition="start" label={`Prescriptions (${customer.prescriptions.length})`} />
              <Tab icon={<LockOutlined />} iconPosition="start" label="Staff Notes" />
            </Tabs>
          </Box>
          <CardContent sx={{ p: { xs: 1.5, md: 3 }, minHeight: 240 }}>
            {activeTab === 0 && (
              <Stack spacing={1.5}>
                <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>
                  Open a purchase to see its products, prices and purchase date.
                </Typography>
                {customer.records.length === 0 ? <Alert severity="info">No purchase records available.</Alert> : customer.records.map((record, index) => (
                  <Accordion key={record.id} disableGutters defaultExpanded={index === 0} variant="outlined" sx={{ borderRadius: "12px !important", overflow: "hidden", "&:before": { display: "none" } }}>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: 2, py: 0.5 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ width: "100%", alignItems: { sm: "center" }, pr: 1, justifyContent: "space-between" }}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>Purchase {customer.records.length - index} {index === 0 ? "· Latest" : ""}</Typography>
                          <Typography variant="body2" color="text.secondary">{formatDate(record.purchaseDate)}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                          <PurchaseFlagChip record={record} />
                          <Typography sx={{ fontWeight: 800, ml: 1 }}>{formatMoney(record.mrp)}</Typography>
                        </Stack>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ borderTop: 1, borderColor: "divider", px: 2.5, py: 2.5 }}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 2 }}>
                        <Chip size="small" variant="outlined" label={record.pricingMode === "SPLIT" ? "Separate Frame / Lens Rates" : "MRP Only"} />
                      </Stack>
                      <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Frame / Spectacle" value={record.specsType} /></Grid>
                        <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Lens" value={record.lensType} /></Grid>
                        <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Date of Purchase" value={formatDate(record.purchaseDate)} /></Grid>
                        <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Record Created" value={formatDate(record.createdAt)} /></Grid>
                        {record.pricingMode === "SPLIT" && <>
                          <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Frame Rate" value={formatMoney(record.frameRate)} /></Grid>
                          <Grid size={{ xs: 12, sm: 6 }}><DetailItem label="Lens Rate" value={formatMoney(record.lensRate)} /></Grid>
                        </>}
                      </Grid>
                      <Paper variant="outlined" sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                          <Typography sx={{ fontWeight: 700 }}>Total MRP</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>{formatMoney(record.mrp)}</Typography>
                        </Stack>
                      </Paper>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
            {activeTab === 1 && (
              <Stack spacing={2}>
                <Typography color="text.secondary" variant="body2">Saved prescriptions, most recent first. Values are read-only on this page.</Typography>
                {customer.prescriptions.length === 0 ? <Alert severity="info">No optical prescription recorded.</Alert> : customer.prescriptions.map((prescription, index) => (
                  <Accordion key={prescription.id} disableGutters defaultExpanded={index === 0} variant="outlined" sx={{ borderRadius: "12px !important", overflow: "hidden", "&:before": { display: "none" } }}>
                    <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Typography sx={{ fontWeight: 700 }}>Prescription {index + 1}</Typography>
                        <Chip size="small" label={formatDate(prescription.createdAt)} variant="outlined" />
                        {index === 0 && <Chip size="small" label="Latest" color="primary" />}
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails sx={{ borderTop: 1, borderColor: "divider", p: { xs: 1, md: 2 } }}>
                      <PrescriptionTable prescription={prescription} />
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Stack>
            )}
            {activeTab === 2 && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<LockOutlined />}>Staff-only information. Never include these notes in customer PDFs or WhatsApp messages.</Alert>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, minHeight: 100 }}>
                  <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{customer.notes || "No internal notes added."}</Typography>
                </Paper>
              </Stack>
            )}
          </CardContent>
        </Card>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Button component={Link} to={backUrl} variant="outlined" startIcon={<ArrowBackOutlined />}>All Customers</Button>
          <Button component={Link} to={editUrl} variant="contained" startIcon={<EditOutlined />}>Edit Customer</Button>
        </Stack>
      </Stack>
    </Box>
  );
}