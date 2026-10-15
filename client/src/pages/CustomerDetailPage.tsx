
import { useEffect, useState } from "react";

import {
  Alert,
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

import {
  Link,
  useParams,
  useSearchParams,
} from "react-router";

import {
  getCustomer,
  type CustomerDetails,
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
// 3. REUSABLE DETAIL COMPONENTS
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
// 4. LOADING SKELETON
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
// 5. CUSTOMER DETAIL PAGE
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

    const controller = new AbortController();
    const cached = readCachedCustomer(id);

    setCustomer(cached);
    setLoading(!cached);
    setRefreshing(Boolean(cached));
    setError("");

    getCustomer(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;

        saveCachedCustomer(id, result);
        setCustomer(result);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load customer details."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  // Allow staff to refresh when a record changes.
  async function handleRefresh() {
    if (!id || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const result = await getCustomer(id);

      saveCachedCustomer(id, result);
      setCustomer(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh customer details."
      );
    } finally {
      setRefreshing(false);
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

  // The backend currently returns newest records first.
  const latestRecord = customer.records[0];

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {/* CUSTOMER HEADER */}
      <Box>
        <Button
          component={Link}
          to={backUrl}
          startIcon={<ArrowBackOutlined />}
          sx={{ mb: 2 }}
        >
          Back to Customers
        </Button>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            justifyContent: "space-between",
            alignItems: { sm: "center" },
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {customer.name}
            </Typography>

            <Typography
              color="text.secondary"
              sx={{
                mt: 1,
                overflowWrap: "anywhere",
              }}
            >
              Customer ID: {customer.id}
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="outlined"
              onClick={handleRefresh}
              disabled={refreshing}
              startIcon={
                refreshing
                  ? <CircularProgress size={16} />
                  : <RefreshOutlined />
              }
            >
              {refreshing ? "Refreshing..." : "Refresh"}
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
      </Box>

      {/* If refresh fails, keep previously loaded data visible. */}
      {error && (
        <Alert
          severity="warning"
          onClose={() => setError("")}
        >
          Unable to refresh: {error}
          The information below may be out of date.
        </Alert>
      )}

      {/* PERSONAL INFORMATION */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <PersonOutlined color="primary" />
            <Typography variant="h6">
              Personal Information
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailItem
                label="Customer Name"
                value={customer.name}
              />
            </Grid>

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
                label="Registration Date"
                value={formatDate(customer.createdAt)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <DetailItem
                label="Last Updated"
                value={formatDate(customer.updatedAt)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* OPTICAL PRESCRIPTION HISTORY */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <VisibilityOutlined color="primary" />

            <Typography variant="h6">
              Optical Prescriptions
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            RE DIST, RE NEAR, LE DIST and LE NEAR
          </Typography>

          <Divider sx={{ my: 2 }} />

          {customer.prescriptions.length === 0 ? (
            <Alert severity="info">
              No prescription has been recorded.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {customer.prescriptions.map(
                (prescription, index) => (
                  <Box key={prescription.id}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{
                        justifyContent: "space-between",
                        alignItems: { sm: "center" },
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                      >
                        Prescription {index + 1} —{" "}
                        {formatDate(prescription.createdAt)}
                      </Typography>

                      {index === 0 && (
                        <Chip
                          label="Latest"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <PrescriptionTable
                      prescription={prescription}
                    />
                  </Box>
                )
              )}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* PURCHASE HISTORY */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <ReceiptLongOutlined color="primary" />

            <Typography variant="h6">
              Purchase Records
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {customer.records.length === 0 ? (
            <Alert severity="info">
              No purchase records are available.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {customer.records.map((record, index) => (
                <Paper
                  key={record.id}
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600 }}
                      >
                        Purchase {customer.records.length - index}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        Date of Purchase:{" "}
                        {formatDate(record.purchaseDate)}
                      </Typography>

                      {index === 0 && (
                        <Chip
                          label="Latest Record"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>

                    <Chip
                      label={
                        record.pricingMode === "SPLIT"
                          ? "Frame + Lens"
                          : "MRP Only"
                      }
                      size="small"
                    />
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Purchase Date"
                        value={formatDate(record.purchaseDate)}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Record Created"
                        value={formatDate(record.createdAt)}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Frame / Spectacle Type"
                        value={record.specsType}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem
                        label="Lens Type"
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

                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "background.default",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600 }}>
                      Total MRP
                    </Typography>

                    <Typography
                      variant="h6"
                      color="primary"
                      sx={{ fontWeight: 700 }}
                    >
                      {formatMoney(record.mrp)}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* INTERNAL INFORMATION — NEVER EXPORTED */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center" }}
          >
            <LockOutlined color="primary" />

            <Typography variant="h6">
              Internal Customer Notes
            </Typography>
          </Stack>

          <Alert severity="info" sx={{ my: 2 }}>
            Internal notes are only for shop staff.
            Do not include them in customer PDFs or
            WhatsApp messages.
          </Alert>

          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {customer.notes || "No internal notes added."}
          </Typography>
        </CardContent>
      </Card>

      {latestRecord && (
        <Typography
          variant="caption"
          color="text.secondary"
        >
          Latest purchase date:{" "}
          {formatDate(latestRecord.purchaseDate)}.
          {" "}Record created:{" "}
          {formatDate(latestRecord.createdAt)}.
        </Typography>
      )}
    </Stack>
  );
}
