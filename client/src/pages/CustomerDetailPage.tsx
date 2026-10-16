
import { useEffect, useRef, useState } from "react";

import {
  Accordion, AccordionDetails, AccordionSummary, Alert,
  Avatar, Box, Button, Card, CardContent, Checkbox,
  Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControlLabel,
  Grid, IconButton, Paper, Skeleton, Stack, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from "@mui/material";

import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import { Link, useParams, useSearchParams } from "react-router";

import {
  getCustomer,
  type CustomerDetails,
  type CustomerRecord,
  type Prescription,
} from "../services/customerApi";

import {
  receiptHtml,
  prescriptionHtml,
  printDocument,
  shareOrDownloadPdf,
  openCustomerWhatsApp,
} from "../utils/customerDocuments";

// -----------------------------------------------------
// 1. CUSTOMER CACHE
// -----------------------------------------------------

// nik - Show recently viewed data while fetching a fresh copy.
const CACHE_TIME_MS = 30_000;
const MAX_CACHE_ITEMS = 20;

type CachedCustomer = {
  data: CustomerDetails;
  savedAt: number;
};

const customerCache = new Map<string, CachedCustomer>();

function readCachedCustomer(id: string): CustomerDetails | null {
  const saved = customerCache.get(id);

  if (!saved) return null;

  if (Date.now() - saved.savedAt > CACHE_TIME_MS) {
    customerCache.delete(id);
    return null;
  }

  return saved.data;
}

function saveCachedCustomer(
  id: string,
  data: CustomerDetails
): void {
  customerCache.delete(id);

  customerCache.set(id, {
    data,
    savedAt: Date.now(),
  });

  if (customerCache.size > MAX_CACHE_ITEMS) {
    const oldest = customerCache.keys().next().value;
    if (oldest) customerCache.delete(oldest);
  }
}

// -----------------------------------------------------
// 2. FORMAT HELPERS
// -----------------------------------------------------

function display(
  value: string | number | null | undefined
): string {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

function formatMoney(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

// nik - Keep calendar dates stable across timezones.
function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
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

function formatPower(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const safe = Object.is(number, -0) ? 0 : number;
  return `${safe > 0 ? "+" : ""}${safe.toFixed(2)}`;
}

// -----------------------------------------------------
// 3. PURCHASE TYPES
// -----------------------------------------------------

type PurchaseFlag =
  | "FRAME_ONLY"
  | "LENS_ONLY"
  | "FRAME_AND_LENS"
  | "NOT_SPECIFIED";

// nik - Determine product type from saved product names.
function getPurchaseFlag(record: CustomerRecord): PurchaseFlag {
  const frame = Boolean(record.specsType?.trim());
  const lens = Boolean(record.lensType?.trim());

  if (frame && lens) return "FRAME_AND_LENS";
  if (frame) return "FRAME_ONLY";
  if (lens) return "LENS_ONLY";

  return "NOT_SPECIFIED";
}

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

// -----------------------------------------------------
// 4. REUSABLE COMPONENTS
// -----------------------------------------------------

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>

      <Typography
        sx={{ mt: 0.5, fontWeight: 600, overflowWrap: "anywhere" }}
      >
        {display(value)}
      </Typography>
    </Box>
  );
}

function PrescriptionTable({
  prescription,
}: {
  prescription: Prescription;
}) {
  // nik - The required order is RE DIST, RE NEAR, LE DIST, LE NEAR.
  const rows = [
    {
      label: "RE DIST",
      description: "Right Eye Distance",
      sph: prescription.reDistSph,
      cyl: prescription.reDistCyl,
      axis: prescription.reDistAxis,
    },
    {
      label: "RE NEAR",
      description: "Right Eye Near",
      sph: prescription.reNearSph,
      cyl: prescription.reNearCyl,
      axis: prescription.reNearAxis,
    },
    {
      label: "LE DIST",
      description: "Left Eye Distance",
      sph: prescription.leDistSph,
      cyl: prescription.leDistCyl,
      axis: prescription.leDistAxis,
    },
    {
      label: "LE NEAR",
      description: "Left Eye Near",
      sph: prescription.leNearSph,
      cyl: prescription.leNearCyl,
      axis: prescription.leNearAxis,
    },
  ];

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, overflowX: "auto" }}
    >
      <Table
        size="small"
        sx={{
          minWidth: 460,
          "& th": {
            bgcolor: "action.hover",
            fontWeight: 700,
          },
          "& td, & th": {
            py: 1.5,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Eye / Vision</TableCell>
            <TableCell align="center">SPH</TableCell>
            <TableCell align="center">CYL</TableCell>
            <TableCell align="center">AXIS</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>
                  {row.label}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  {row.description}
                </Typography>
              </TableCell>

              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {formatPower(row.sph)}
              </TableCell>

              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {formatPower(row.cyl)}
              </TableCell>

              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {display(row.axis)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CustomerDetailsSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton width="40%" height={48} />

      {[1, 2, 3].map((item) => (
        <Card key={item} variant="outlined">
          <CardContent>
            <Skeleton height={36} />
            <Skeleton height={24} />
            <Skeleton height={24} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// -----------------------------------------------------
// 5. RECEIPT PREVIEW DIALOG
// -----------------------------------------------------

type PdfKind = "receipt" | "prescription";

type ReceiptDialogProps = {
  customer: CustomerDetails;
  record: CustomerRecord;
  busy: boolean;
  onClose: () => void;
  onPrint: (content: string, title: string) => void;
  onPdf: (
    content: string,
    filename: string,
    type: PdfKind
  ) => Promise<void>;
  onWhatsAppPdf: (
    content: string,
    filename: string
  ) => Promise<void>;
};

// nik - Staff review the PDF contents before sharing it.
function ReceiptPreviewDialog({
  customer,
  record,
  busy,
  onClose,
  onPrint,
  onPdf,
  onWhatsAppPdf,
}: ReceiptDialogProps) {
  const [includePrescription, setIncludePrescription] =
    useState(false);

  // nik - Only use the prescription linked to this purchase.
  const linkedPrescription =
    customer.prescriptions.find(
      (item) => item.id === record.prescriptionId
    ) ?? null;

  const selectedPrescription =
    includePrescription ? linkedPrescription : null;

  const documentContent = receiptHtml(
    customer,
    record,
    selectedPrescription
  );

  const filename = `receipt-${record.id}.pdf`;

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="receipt-preview-title"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle id="receipt-preview-title">
        <Typography
          component="div"
          variant="h5"
          sx={{ fontWeight: 800 }}
        >
          Prepare Customer Receipt
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          Review the selected purchase and choose how to share it.
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 2.5 }}>
        <Stack spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: "action.hover",
            }}
          >
            <Typography sx={{ fontWeight: 800, mb: 1 }}>
              Receipt Contents
            </Typography>

            <Stack spacing={0.75}>
              <Typography variant="body2">
                ✓ Customer information
              </Typography>
              <Typography variant="body2">
                ✓ Purchased products and prices
              </Typography>
              <Typography variant="body2">
                ✓ Purchase date and total MRP
              </Typography>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {linkedPrescription ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includePrescription}
                    onChange={(_, checked) =>
                      setIncludePrescription(checked)
                    }
                  />
                }
                label="Include linked optical prescription"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No prescription is linked to this purchase.
              </Typography>
            )}
          </Paper>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
              Customer Information
            </Typography>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, mb: 2 }}
              >
                {customer.name}
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem
                    label="Mobile Number"
                    value={customer.mobNumber}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Gender" value={customer.gender} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem
                    label="Reference"
                    value={customer.reference}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem
                    label="Registered"
                    value={formatDate(customer.createdAt)}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>
              Purchase Summary
            </Typography>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem
                    label="Purchase Date"
                    value={formatDate(record.purchaseDate)}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem
                    label="Frame / Spectacle"
                    value={record.specsType}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Lens" value={record.lensType} />
                </Grid>

                {record.pricingMode === "SPLIT" && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Frame Rate"
                        value={formatMoney(record.frameRate)}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Lens Rate"
                        value={formatMoney(record.lensRate)}
                      />
                    </Grid>
                  </>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack
                direction="row"
                sx={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  Total MRP
                </Typography>

                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatMoney(record.mrp)}
                </Typography>
              </Stack>
            </Paper>
          </Box>

          {selectedPrescription && (
            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  mb: 1.5,
                  alignItems: { sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  Optical Prescription
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {formatDate(selectedPrescription.createdAt)}
                </Typography>
              </Stack>

              <PrescriptionTable
                prescription={selectedPrescription}
              />
            </Box>
          )}

          <Alert severity="info">
            The document shows recorded MRP, not verified payment.
            Staff-only notes are not included.
          </Alert>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions
        sx={{
          p: 2,
          gap: 1,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <Button
          color="inherit"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          variant="outlined"
          disabled={busy}
          startIcon={<PrintOutlined />}
          onClick={() =>
            onPrint(documentContent, "Purchase Receipt")
          }
        >
          Print
        </Button>

        <Button
          variant="outlined"
          disabled={busy}
          startIcon={<PictureAsPdfOutlined />}
          onClick={() => {
            void onPdf(documentContent, filename, "receipt");
          }}
        >
          Share / Save PDF
        </Button>

        {/* nik - Send the actual PDF through device sharing.
            Desktop fallback downloads the PDF and opens WhatsApp. */}
        <Button
          variant="contained"
          color="success"
          disabled={busy || !customer.mobNumber}
          startIcon={
            busy
              ? <CircularProgress size={18} color="inherit" />
              : <WhatsAppIcon />
          }
          onClick={() => {
            void onWhatsAppPdf(documentContent, filename);
          }}
        >
          {busy ? "Preparing PDF..." : "Share PDF via WhatsApp"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------
// 6. CUSTOMER DETAILS PAGE
// -----------------------------------------------------

// nik - A customer is identified by database ID, not mobile number.
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
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);

  const [selectedRecord, setSelectedRecord] =
    useState<CustomerRecord | null>(null);

  const requestRef = useRef<AbortController | null>(null);

  const previousSearch = params.get("search") ?? "";

  const searchQuery = previousSearch
    ? `?search=${encodeURIComponent(previousSearch)}`
    : "";

  const backUrl = `/customers${searchQuery}`;

  // nik - Reload the customer whenever the ID changes.
  useEffect(() => {
    if (!id) {
      // nik - Schedule route-related updates after the effect starts.
      void Promise.resolve().then(() => {
        setCustomer(null);
        setLoading(false);
        setError("Customer ID is missing.");
      });
      return;
    }

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    const cached = readCachedCustomer(id);

    // nik - Reset the view asynchronously so React avoids cascading renders.
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setCustomer(cached);
      setLoading(!cached);
      setRefreshing(Boolean(cached));
      setError("");
      setSelectedRecord(null);
    });

    getCustomer(id, controller.signal)
      .then((result) => {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller ||
          result.id !== id
        ) {
          return;
        }

        saveCachedCustomer(id, result);
        setCustomer(result);
        setError("");
      })
      .catch((err) => {
        if (
          controller.signal.aborted ||
          requestRef.current !== controller
        ) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load customer details."
        );
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestRef.current === controller
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      controller.abort();

      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [id]);

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

      if (
        controller.signal.aborted ||
        requestRef.current !== controller ||
        result.id !== id
      ) {
        return;
      }

      saveCachedCustomer(id, result);
      setCustomer(result);
    } catch (err) {
      if (
        controller.signal.aborted ||
        requestRef.current !== controller
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh customer details."
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }

  async function copyCustomerId(customerId: string) {
    try {
      await navigator.clipboard.writeText(customerId);
      setCopyMessage("Customer ID copied");
    } catch {
      setCopyMessage("Could not copy Customer ID");
    }
  }

  function handlePrint(content: string, title: string) {
    setDocumentMessage("");

    try {
      printDocument(content, title);
    } catch (err) {
      setDocumentMessage(
        err instanceof Error ? err.message : "Unable to print."
      );
    }
  }

  // nik - Existing normal PDF action.
  async function handlePdf(
    content: string,
    filename: string,
    type: PdfKind
  ): Promise<void> {
    if (documentBusy) return;

    setDocumentBusy(true);
    setDocumentMessage("");

    try {
      const result = await shareOrDownloadPdf(
        content,
        filename,
        type
      );

      setDocumentMessage(
        result === "shared"
          ? "Device share menu completed. Check the recipient and confirm the PDF was sent."
          : "PDF downloaded successfully."
      );
    } catch (err) {
      setDocumentMessage(
        err instanceof Error
          ? err.message
          : "Unable to prepare the PDF."
      );
    } finally {
      setDocumentBusy(false);
    }
  }

  // nik - New WhatsApp PDF action.
  // It uses native file sharing wherever available.
  // Desktop fallback downloads the PDF, then opens chat.
  async function handleWhatsAppPdf(
    content: string,
    filename: string
  ): Promise<void> {
    if (!customer || documentBusy) return;

    setDocumentBusy(true);
    setDocumentMessage("");

    try {
      const result = await shareOrDownloadPdf(
        content,
        filename,
        "receipt"
      );

      if (result === "shared") {
        setDocumentMessage(
          "PDF handed to the device share menu. Choose WhatsApp, select the correct customer and press Send."
        );
        return;
      }

      // nik - PDF was downloaded because direct file sharing
      // is not supported. Open the saved customer's chat.
      try {
        openCustomerWhatsApp(customer.mobNumber, "");

        setDocumentMessage(
          "Receipt PDF downloaded. In the customer's WhatsApp chat, click Attach → Document, select the downloaded PDF and press Send. If the chat did not open, open WhatsApp Web manually."
        );
      } catch (chatError) {
        setDocumentMessage(
          chatError instanceof Error
            ? `PDF downloaded, but WhatsApp could not open: ${chatError.message}`
            : "PDF downloaded. Open WhatsApp manually and attach it."
        );
      }
    } catch (err) {
      setDocumentMessage(
        err instanceof Error
          ? err.message
          : "Could not prepare the WhatsApp PDF."
      );
    } finally {
      setDocumentBusy(false);
    }
  }

  if (loading && !customer) {
    return <CustomerDetailsSkeleton />;
  }

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
        >
          Back to Customers
        </Button>
      </Stack>
    );
  }

  const editUrl =
    `/customers/${customer.id}/edit${searchQuery}`;

  const latestRecord = customer.records[0];

  const initials = customer.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const totalPurchaseValue = customer.records.reduce(
    (sum, item) => sum + (Number(item.mrp) || 0),
    0
  );

  return (
    <Box sx={{ maxWidth: 1250, mx: "auto", pb: 6 }}>
      <Stack spacing={2.5}>
        <Box>
          <Button
            component={Link}
            to={backUrl}
            size="small"
            startIcon={<ArrowBackOutlined />}
          >
            Back to Customers
          </Button>
        </Box>

        {/* Customer header */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2.5}
              sx={{
                alignItems: { sm: "center" },
                justifyContent: "space-between",
              }}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", minWidth: 0 }}
              >
                <Avatar
                  sx={{
                    width: 62,
                    height: 62,
                    bgcolor: "primary.main",
                    fontWeight: 700,
                    fontSize: 23,
                  }}
                >
                  {initials || <PersonOutlined />}
                </Avatar>

                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      overflowWrap: "anywhere",
                      fontSize: { xs: "1.55rem", md: "2rem" },
                    }}
                  >
                    {customer.name}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      mt: 0.75,
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {customer.mobNumber || "No mobile number"}
                    </Typography>

                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${customer.records.length} purchases`}
                    />

                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${customer.prescriptions.length} prescriptions`}
                    />
                  </Stack>
                </Box>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", gap: 0.5 }}
              >
                {customer.mobNumber && (
                  <Button
                    component="a"
                    href={`tel:${customer.mobNumber}`}
                    variant="outlined"
                    startIcon={<PhoneOutlined />}
                  >
                    Call
                  </Button>
                )}

                <Button
                  variant="outlined"
                  disabled={refreshing}
                  onClick={() => {
                    void handleRefresh();
                  }}
                  startIcon={
                    refreshing
                      ? <CircularProgress size={17} />
                      : <RefreshOutlined />
                  }
                >
                  {refreshing ? "Refreshing" : "Refresh"}
                </Button>

                <Button
                  component={Link}
                  to={editUrl}
                  variant="contained"
                  startIcon={<EditOutlined />}
                >
                  Edit Customer
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error && (
          <Alert
            severity="warning"
            onClose={() => setError("")}
          >
            Unable to refresh: {error}. Showing the last
            available information.
          </Alert>
        )}

        {copyMessage && (
          <Alert
            severity="info"
            onClose={() => setCopyMessage("")}
          >
            {copyMessage}
          </Alert>
        )}

        {documentMessage && (
          <Alert
            severity="info"
            onClose={() => setDocumentMessage("")}
          >
            {documentMessage}
          </Alert>
        )}

        {/* Summary cards */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, height: "100%" }}
            >
              <CardContent>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Purchase Records
                </Typography>

                <Typography
                  variant="h4"
                  sx={{ fontWeight: 800, mt: 0.5 }}
                >
                  {customer.records.length}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  {latestRecord
                    ? `Latest: ${formatDate(latestRecord.purchaseDate)}`
                    : "No purchases recorded"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, height: "100%" }}
            >
              <CardContent>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Total Purchase Value
                </Typography>

                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, mt: 1 }}
                >
                  {formatMoney(totalPurchaseValue)}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Sum of saved purchase MRP amounts
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{ borderRadius: 3, height: "100%" }}
            >
              <CardContent>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Prescription Records
                </Typography>

                <Typography
                  variant="h4"
                  sx={{ fontWeight: 800, mt: 0.5 }}
                >
                  {customer.prescriptions.length}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Saved optical prescriptions
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Personal information */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 2 }}
            >
              <PersonOutlined color="primary" />

              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Personal Information
              </Typography>
            </Stack>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Customer Name"
                  value={customer.name}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Mobile Number"
                  value={customer.mobNumber}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Gender"
                  value={customer.gender}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Reference"
                  value={customer.reference}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Registered"
                  value={formatDate(customer.createdAt)}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <DetailItem
                  label="Updated"
                  value={formatDate(customer.updatedAt)}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: "anywhere" }}
              >
                ID: {customer.id}
              </Typography>

              <Tooltip title="Copy customer ID">
                <IconButton
                  size="small"
                  aria-label="Copy customer ID"
                  onClick={() => {
                    void copyCustomerId(customer.id);
                  }}
                >
                  <ContentCopyOutlined fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Stack>
          </CardContent>
        </Card>

        {/* Purchase and prescription history */}
        <Card
          variant="outlined"
          sx={{ borderRadius: 3, overflow: "hidden" }}
        >
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={activeTab}
              onChange={(_, next: number) => setActiveTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Customer detail sections"
            >
              <Tab
                icon={<ReceiptLongOutlined />}
                iconPosition="start"
                label={`Purchases (${customer.records.length})`}
              />
              <Tab
                icon={<VisibilityOutlined />}
                iconPosition="start"
                label={`Prescriptions (${customer.prescriptions.length})`}
              />
              <Tab
                icon={<LockOutlined />}
                iconPosition="start"
                label="Staff Notes"
              />
            </Tabs>
          </Box>

          <CardContent
            sx={{ p: { xs: 1.5, md: 3 }, minHeight: 240 }}
          >
            {activeTab === 0 && (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Open a purchase to review its details and
                  prepare a receipt PDF.
                </Typography>

                {customer.records.length === 0 ? (
                  <Alert severity="info">
                    No purchase records available.
                  </Alert>
                ) : (
                  customer.records.map((record, index) => {
                    const flag =
                      purchaseFlagInfo[getPurchaseFlag(record)];

                    return (
                      <Accordion
                        key={record.id}
                        disableGutters
                        defaultExpanded={index === 0}
                        variant="outlined"
                        sx={{
                          borderRadius: "12px !important",
                          overflow: "hidden",
                          "&:before": { display: "none" },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreOutlined />}
                          sx={{ px: 2, py: 0.5 }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.5}
                            sx={{
                              width: "100%",
                              pr: 1,
                              alignItems: { sm: "center" },
                              justifyContent: "space-between",
                            }}
                          >
                            <Box>
                              <Typography sx={{ fontWeight: 700 }}>
                                Purchase{" "}
                                {customer.records.length - index}
                                {index === 0 ? " · Latest" : ""}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {formatDate(record.purchaseDate)}
                              </Typography>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: "center", flexWrap: "wrap" }}
                            >
                              <Chip
                                label={flag.label}
                                color={flag.color}
                                size="small"
                              />
                              <Typography sx={{ fontWeight: 800 }}>
                                {formatMoney(record.mrp)}
                              </Typography>
                            </Stack>
                          </Stack>
                        </AccordionSummary>

                        <AccordionDetails
                          sx={{
                            borderTop: 1,
                            borderColor: "divider",
                            px: 2.5,
                            py: 2.5,
                          }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            label={
                              record.pricingMode === "SPLIT"
                                ? "Separate Frame / Lens Rates"
                                : "MRP Only"
                            }
                            sx={{ mb: 2 }}
                          />

                          <Grid container spacing={2.5}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <DetailItem
                                label="Frame / Spectacle"
                                value={record.specsType}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <DetailItem
                                label="Lens"
                                value={record.lensType}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <DetailItem
                                label="Date of Purchase"
                                value={formatDate(record.purchaseDate)}
                              />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <DetailItem
                                label="Record Created"
                                value={formatDate(record.createdAt)}
                              />
                            </Grid>

                            {record.pricingMode === "SPLIT" && (
                              <>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <DetailItem
                                    label="Frame Rate"
                                    value={formatMoney(record.frameRate)}
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <DetailItem
                                    label="Lens Rate"
                                    value={formatMoney(record.lensRate)}
                                  />
                                </Grid>
                              </>
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
                              direction="row"
                              sx={{
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography sx={{ fontWeight: 700 }}>
                                Total MRP
                              </Typography>
                              <Typography
                                variant="h6"
                                sx={{ fontWeight: 800 }}
                              >
                                {formatMoney(record.mrp)}
                              </Typography>
                            </Stack>
                          </Paper>

                          <Button
                            variant="contained"
                            startIcon={<ReceiptLongOutlined />}
                            sx={{ mt: 2 }}
                            onClick={() => setSelectedRecord(record)}
                          >
                            Prepare Receipt
                          </Button>
                        </AccordionDetails>
                      </Accordion>
                    );
                  })
                )}
              </Stack>
            )}

            {activeTab === 1 && (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Saved optical prescriptions, most recent first.
                </Typography>

                {customer.prescriptions.length === 0 ? (
                  <Alert severity="info">
                    No optical prescription recorded.
                  </Alert>
                ) : (
                  customer.prescriptions.map((prescription, index) => (
                    <Accordion
                      key={prescription.id}
                      disableGutters
                      defaultExpanded={index === 0}
                      variant="outlined"
                      sx={{
                        borderRadius: "12px !important",
                        overflow: "hidden",
                        "&:before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreOutlined />}
                      >
                        <Stack
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <Typography sx={{ fontWeight: 700 }}>
                            Prescription {index + 1}
                          </Typography>

                          <Chip
                            size="small"
                            variant="outlined"
                            label={formatDate(prescription.createdAt)}
                          />

                          {index === 0 && (
                            <Chip
                              size="small"
                              color="primary"
                              label="Latest"
                            />
                          )}
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails
                        sx={{
                          borderTop: 1,
                          borderColor: "divider",
                          p: { xs: 1, md: 2 },
                        }}
                      >
                        <PrescriptionTable
                          prescription={prescription}
                        />

                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}
                        >
                          <Button
                            variant="outlined"
                            startIcon={<PrintOutlined />}
                            onClick={() =>
                              handlePrint(
                                prescriptionHtml(customer, prescription),
                                "Optical Prescription"
                              )
                            }
                          >
                            Print Prescription
                          </Button>

                          <Button
                            variant="outlined"
                            disabled={documentBusy}
                            startIcon={<PictureAsPdfOutlined />}
                            onClick={() => {
                              void handlePdf(
                                prescriptionHtml(customer, prescription),
                                `prescription-${prescription.id}.pdf`,
                                "prescription"
                              );
                            }}
                          >
                            Share / Save PDF
                          </Button>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  ))
                )}
              </Stack>
            )}

            {activeTab === 2 && (
              <Stack spacing={2}>
                <Alert severity="info" icon={<LockOutlined />}>
                  Staff-only information. Never include these notes
                  in customer PDFs or WhatsApp messages.
                </Alert>

                <Paper
                  variant="outlined"
                  sx={{ p: 2.5, borderRadius: 2, minHeight: 100 }}
                >
                  <Typography
                    sx={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {customer.notes || "No internal notes added."}
                  </Typography>
                </Paper>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Button
            component={Link}
            to={backUrl}
            variant="outlined"
            startIcon={<ArrowBackOutlined />}
          >
            All Customers
          </Button>

          <Button
            component={Link}
            to={editUrl}
            variant="contained"
            startIcon={<EditOutlined />}
          >
            Edit Customer
          </Button>
        </Stack>
      </Stack>

      {/* nik - A separate dialog for the selected purchase. */}
      {selectedRecord && (
        <ReceiptPreviewDialog
          key={selectedRecord.id}
          customer={customer}
          record={selectedRecord}
          busy={documentBusy}
          onClose={() => setSelectedRecord(null)}
          onPrint={handlePrint}
          onPdf={handlePdf}
          onWhatsAppPdf={handleWhatsAppPdf}
        />
      )}
    </Box>
  );
}
