
import { useEffect, useRef, useState } from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
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
  whatsappReceiptMessage,
  openCustomerWhatsApp,
} from "../utils/customerDocuments";

// -----------------------------------------------------
// 1. CUSTOMER CACHE
// -----------------------------------------------------

// nik - Store recently opened customers for quick navigation.
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

// nik - Format Indian currency.
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

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// nik - Avoid timezone-related changes to saved dates.
function formatDate(
  value: string | null | undefined
): string {
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

// nik - Show optical power with positive and negative signs.
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

  if (!Number.isFinite(number)) return "—";

  const safe = Object.is(number, -0) ? 0 : number;

  return `${safe > 0 ? "+" : ""}${safe.toFixed(2)}`;
}

// -----------------------------------------------------
// 3. PURCHASE TYPE HELPERS
// -----------------------------------------------------

// nik - These declarations fix both TS2304 build errors.
type PurchaseFlag =
  | "FRAME_ONLY"
  | "LENS_ONLY"
  | "FRAME_AND_LENS"
  | "NOT_SPECIFIED";

// nik - Purchase type depends on saved product names,
// not whether prices are recorded separately.
function getPurchaseFlag(
  record: CustomerRecord
): PurchaseFlag {
  const hasFrame = Boolean(record.specsType?.trim());
  const hasLens = Boolean(record.lensType?.trim());

  if (hasFrame && hasLens) {
    return "FRAME_AND_LENS";
  }

  if (hasFrame) {
    return "FRAME_ONLY";
  }

  if (hasLens) {
    return "LENS_ONLY";
  }

  return "NOT_SPECIFIED";
}

const purchaseFlagInfo: Record<
  PurchaseFlag,
  {
    label: string;
    color: "primary" | "success" | "info" | "default";
  }
> = {
  FRAME_ONLY: {
    label: "Frame Only",
    color: "info",
  },
  LENS_ONLY: {
    label: "Lens Only",
    color: "success",
  },
  FRAME_AND_LENS: {
    label: "Frame + Lens",
    color: "primary",
  },
  NOT_SPECIFIED: {
    label: "Not Specified",
    color: "default",
  },
};

// -----------------------------------------------------
// 4. REUSABLE CUSTOMER DETAIL ITEM
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
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.5,
          fontWeight: 600,
          overflowWrap: "anywhere",
        }}
      >
        {display(value)}
      </Typography>
    </Box>
  );
}

// -----------------------------------------------------
// 5. OPTICAL PRESCRIPTION TABLE
// -----------------------------------------------------

type PrescriptionRowProps = {
  label: string;
  description: string;
  sph: string | number | null;
  cyl: string | number | null;
  axis: string | number | null;
};

function PrescriptionRow({
  label,
  description,
  sph,
  cyl,
  axis,
}: PrescriptionRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {label}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
        >
          {description}
        </Typography>
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatPower(sph)}
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatPower(cyl)}
      </TableCell>

      <TableCell
        align="center"
        sx={{
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display(axis)}
      </TableCell>
    </TableRow>
  );
}

// nik - Preserve the optical shop's exact prescription order.
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
          minWidth: 460,
          "& th": {
            fontWeight: 700,
            bgcolor: "action.hover",
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
// 6. LOADING SKELETON
// -----------------------------------------------------

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
            <Skeleton height={28} />
            <Skeleton height={28} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

// -----------------------------------------------------
// 7. RECEIPT PREVIEW DIALOG
// -----------------------------------------------------

type ReceiptDialogProps = {
  customer: CustomerDetails;
  record: CustomerRecord;
  busy: boolean;
  onClose: () => void;
  onPrint: (content: string, title: string) => void;
  onPdf: (
    content: string,
    filename: string,
    type: "receipt" | "prescription"
  ) => Promise<void>;
  onWhatsApp: (
    record: CustomerRecord,
    prescription: Prescription | null
  ) => void;
};

// nik - Staff review exactly one purchase before sharing.
function ReceiptPreviewDialog({
  customer,
  record,
  busy,
  onClose,
  onPrint,
  onPdf,
  onWhatsApp,
}: ReceiptDialogProps) {
  // nik - Start with prescription sharing disabled.
  const [includePrescription, setIncludePrescription] =
    useState(false);

  // nik - Never select an unrelated historical prescription.
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

  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="receipt-preview-title"
    >
      <DialogTitle
        id="receipt-preview-title"
        sx={{
          px: { xs: 2, sm: 3 },
          pt: 3,
          pb: 2,
        }}
      >
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
          Review the selected purchase before printing or sharing.
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2.5,
        }}
      >
        <Stack spacing={3}>
          {/* Receipt contents */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              bgcolor: "action.hover",
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                mb: 1,
              }}
            >
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
                    checked={includePrescription}
                    onChange={(_, checked) =>
                      setIncludePrescription(checked)
                    }
                    size="small"
                  />
                }
                label="Include linked optical prescription"
              />
            ) : (
              <Typography
                variant="body2"
                color="text.secondary"
              >
                No prescription is linked to this purchase.
                The receipt will include customer and purchase
                details only.
              </Typography>
            )}
          </Paper>

          {/* Customer information */}
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                mb: 1.5,
              }}
            >
              Customer Information
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2.5,
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                }}
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
                  <DetailItem
                    label="Gender"
                    value={customer.gender}
                  />
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

          {/* Purchase information */}
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                mb: 1.5,
              }}
            >
              Purchase Summary
            </Typography>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2.5,
              }}
            >
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
                  <DetailItem
                    label="Lens"
                    value={record.lensType}
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

              <Divider sx={{ my: 2 }} />

              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>
                  Total MRP
                </Typography>

                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800 }}
                >
                  {formatMoney(record.mrp)}
                </Typography>
              </Stack>
            </Paper>
          </Box>

          {/* Optional prescription */}
          {selectedPrescription && (
            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  mb: 1.5,
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>
                  Optical Prescription
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  {formatDate(selectedPrescription.createdAt)}
                </Typography>
              </Stack>

              <PrescriptionTable
                prescription={selectedPrescription}
              />
            </Box>
          )}

          <Alert severity="info">
            This receipt displays recorded MRP, not verified
            payment. Staff-only notes are excluded.
          </Alert>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions
        sx={{
          p: { xs: 2, sm: 3 },
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
          startIcon={<PrintOutlined />}
          disabled={busy}
          onClick={() =>
            onPrint(documentContent, "Purchase Receipt")
          }
        >
          Print
        </Button>

        <Button
          variant="outlined"
          startIcon={<PictureAsPdfOutlined />}
          disabled={busy}
          onClick={() => {
            void onPdf(
              documentContent,
              `receipt-${record.id}.pdf`,
              "receipt"
            );
          }}
        >
          {busy ? "Preparing..." : "Share / Save PDF"}
        </Button>

        <Button
          variant="contained"
          color="success"
          startIcon={<WhatsAppIcon />}
          disabled={busy || !customer.mobNumber}
          onClick={() =>
            onWhatsApp(record, selectedPrescription)
          }
        >
          WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// -----------------------------------------------------
// 8. CUSTOMER DETAIL PAGE
// -----------------------------------------------------

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

  // nik - Open the preview for one selected purchase.
  const [selectedRecord, setSelectedRecord] =
    useState<CustomerRecord | null>(null);

  const requestRef = useRef<AbortController | null>(null);

  const previousSearch = params.get("search") ?? "";

  const searchQuery = previousSearch
    ? `?search=${encodeURIComponent(previousSearch)}`
    : "";

  const backUrl = `/customers${searchQuery}`;

  // nik - Refresh saved customer details from the backend.
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
    setSelectedRecord(null);

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

  // nik - Refresh without hiding current customer data.
  async function handleRefresh() {
    if (!id || refreshing) return;

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setRefreshing(true);
    setLoading(false);
    setError("");

    try {
      const result = await getCustomer(
        id,
        controller.signal
      );

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

  async function copyCustomerId(
    customerId: string
  ) {
    try {
      await navigator.clipboard.writeText(customerId);
      setCopyMessage("Customer ID copied");
    } catch {
      setCopyMessage("Could not copy Customer ID");
    }
  }

  // nik - Print the selected customer document.
  function handlePrint(
    content: string,
    title: string
  ) {
    setDocumentMessage("");

    try {
      printDocument(content, title);
    } catch (err) {
      setDocumentMessage(
        err instanceof Error
          ? err.message
          : "Unable to print."
      );
    }
  }

  // nik - Share a PDF where supported, otherwise download it.
  async function handlePdf(
    content: string,
    filename: string,
    type: "receipt" | "prescription"
  ) {
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
          ? "Share menu completed. Verify the recipient and delivery."
          : "PDF downloaded. Attach it manually in WhatsApp."
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

  // nik - Open the customer WhatsApp chat with prepared text.
  function handleWhatsApp(
    record: CustomerRecord,
    prescription: Prescription | null
  ) {
    if (!customer) return;

    setDocumentMessage("");

    try {
      openCustomerWhatsApp(
        customer.mobNumber,
        whatsappReceiptMessage(
          customer,
          record,
          prescription
        )
      );
    } catch (err) {
      setDocumentMessage(
        err instanceof Error
          ? err.message
          : "Unable to open WhatsApp."
      );
    }
  }

  // Initial loading screen.
  if (loading && !customer) {
    return <CustomerDetailsSkeleton />;
  }

  // Customer not found.
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

  // nik - This is total recorded MRP, not confirmed payment.
  const totalPurchaseValue = customer.records.reduce(
    (sum, item) => sum + (Number(item.mrp) || 0),
    0
  );

  return (
    <Box sx={{ maxWidth: 1250, mx: "auto", pb: 6 }}>
      <Stack spacing={2.5}>
        {/* Back navigation */}
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

        {/* Customer heading */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2, md: 3 },
              "&:last-child": {
                pb: { xs: 2, md: 3 },
              },
            }}
          >
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
                sx={{
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <Avatar
                  sx={{
                    width: 62,
                    height: 62,
                    bgcolor: "primary.main",
                    fontSize: 23,
                    fontWeight: 700,
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
                      fontSize: {
                        xs: "1.55rem",
                        md: "2rem",
                      },
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
                      {customer.mobNumber ||
                        "No mobile number"}
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
                sx={{
                  flexWrap: "wrap",
                  gap: 0.5,
                }}
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
                  onClick={handleRefresh}
                  disabled={refreshing}
                  startIcon={
                    refreshing
                      ? <CircularProgress size={17} />
                      : <RefreshOutlined />
                  }
                >
                  {refreshing
                    ? "Refreshing"
                    : "Refresh"}
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

        {/* Feedback messages */}
        {error && (
          <Alert
            severity="warning"
            onClose={() => setError("")}
          >
            Unable to refresh: {error}.
            Showing the last available information.
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

        {/* Customer overview */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 3,
                height: "100%",
              }}
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
                  sx={{
                    fontWeight: 800,
                    mt: 0.5,
                  }}
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
              sx={{
                borderRadius: 3,
                height: "100%",
              }}
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
                  sx={{
                    fontWeight: 800,
                    mt: 1,
                  }}
                >
                  {formatMoney(totalPurchaseValue)}
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Sum of recorded MRP amounts
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                borderRadius: 3,
                height: "100%",
              }}
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
                  sx={{
                    fontWeight: 800,
                    mt: 0.5,
                  }}
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
        <Card
          variant="outlined"
          sx={{ borderRadius: 3 }}
        >
          <CardContent
            sx={{ p: { xs: 2, md: 3 } }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
                mb: 2,
              }}
            >
              <PersonOutlined color="primary" />

              <Typography
                variant="h6"
                sx={{ fontWeight: 700 }}
              >
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
              sx={{
                alignItems: "center",
                flexWrap: "wrap",
              }}
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

        {/* Purchase, prescription and staff notes tabs */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, value: number) =>
                setActiveTab(value)
              }
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Customer details sections"
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
            sx={{
              p: { xs: 1.5, md: 3 },
              minHeight: 240,
            }}
          >
            {/* PURCHASE HISTORY */}
            {activeTab === 0 && (
              <Stack spacing={1.5}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Open a purchase to review its products
                  and prepare a customer receipt.
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
                          "&:before": {
                            display: "none",
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreOutlined />}
                          sx={{
                            px: 2,
                            py: 0.5,
                          }}
                        >
                          <Stack
                            direction={{
                              xs: "column",
                              sm: "row",
                            }}
                            spacing={1.5}
                            sx={{
                              width: "100%",
                              alignItems: {
                                sm: "center",
                              },
                              justifyContent:
                                "space-between",
                              pr: 1,
                            }}
                          >
                            <Box>
                              <Typography
                                sx={{ fontWeight: 700 }}
                              >
                                Purchase{" "}
                                {customer.records.length - index}

                                {index === 0
                                  ? " · Latest"
                                  : ""}
                              </Typography>

                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {formatDate(
                                  record.purchaseDate
                                )}
                              </Typography>
                            </Box>

                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 0.5,
                              }}
                            >
                              <Chip
                                label={flag.label}
                                color={flag.color}
                                size="small"
                              />

                              <Typography
                                sx={{
                                  fontWeight: 800,
                                }}
                              >
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
                                value={formatDate(
                                  record.purchaseDate
                                )}
                              />
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6 }}>
                              <DetailItem
                                label="Record Created"
                                value={formatDate(
                                  record.createdAt
                                )}
                              />
                            </Grid>

                            {record.pricingMode === "SPLIT" && (
                              <>
                                <Grid
                                  size={{
                                    xs: 12,
                                    sm: 6,
                                  }}
                                >
                                  <DetailItem
                                    label="Frame Rate"
                                    value={formatMoney(
                                      record.frameRate
                                    )}
                                  />
                                </Grid>

                                <Grid
                                  size={{
                                    xs: 12,
                                    sm: 6,
                                  }}
                                >
                                  <DetailItem
                                    label="Lens Rate"
                                    value={formatMoney(
                                      record.lensRate
                                    )}
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
                                justifyContent:
                                  "space-between",
                              }}
                            >
                              <Typography
                                sx={{ fontWeight: 700 }}
                              >
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
                            onClick={() =>
                              setSelectedRecord(record)
                            }
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

            {/* PRESCRIPTION HISTORY */}
            {activeTab === 1 && (
              <Stack spacing={2}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Saved optical prescriptions, most recent
                  first. Values are read-only on this page.
                </Typography>

                {customer.prescriptions.length === 0 ? (
                  <Alert severity="info">
                    No optical prescription recorded.
                  </Alert>
                ) : (
                  customer.prescriptions.map(
                    (prescription, index) => (
                      <Accordion
                        key={prescription.id}
                        disableGutters
                        defaultExpanded={index === 0}
                        variant="outlined"
                        sx={{
                          borderRadius: "12px !important",
                          overflow: "hidden",
                          "&:before": {
                            display: "none",
                          },
                        }}
                      >
                        <AccordionSummary
                          expandIcon={<ExpandMoreOutlined />}
                        >
                          <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <Typography
                              sx={{ fontWeight: 700 }}
                            >
                              Prescription {index + 1}
                            </Typography>

                            <Chip
                              size="small"
                              variant="outlined"
                              label={formatDate(
                                prescription.createdAt
                              )}
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
                            sx={{
                              mt: 2,
                              flexWrap: "wrap",
                              gap: 1,
                            }}
                          >
                            <Button
                              variant="outlined"
                              startIcon={<PrintOutlined />}
                              onClick={() =>
                                handlePrint(
                                  prescriptionHtml(
                                    customer,
                                    prescription
                                  ),
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
                                  prescriptionHtml(
                                    customer,
                                    prescription
                                  ),
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
                    )
                  )
                )}
              </Stack>
            )}

            {/* STAFF NOTES */}
            {activeTab === 2 && (
              <Stack spacing={2}>
                <Alert
                  severity="info"
                  icon={<LockOutlined />}
                >
                  Staff-only information. Never include
                  these notes in PDFs or WhatsApp messages.
                </Alert>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    minHeight: 100,
                  }}
                >
                  <Typography
                    sx={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {customer.notes ||
                      "No internal notes added."}
                  </Typography>
                </Paper>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Bottom navigation */}
        <Stack
          direction="row"
          sx={{
            justifyContent: "space-between",
            alignItems: "center",
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

      {/* Receipt preview for one selected purchase */}
      {selectedRecord && (
        <ReceiptPreviewDialog
          key={selectedRecord.id}
          customer={customer}
          record={selectedRecord}
          busy={documentBusy}
          onClose={() =>
            setSelectedRecord(null)
          }
          onPrint={handlePrint}
          onPdf={handlePdf}
          onWhatsApp={handleWhatsApp}
        />
      )}
    </Box>
  );
}
