
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
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import GlassesOutlined from "@mui/icons-material/VisibilityOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";

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

// Display missing values clearly instead of showing null.
function display(value: string | number | null | undefined) {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

// Format MRP and rates consistently.
function formatMoney(value: string | null) {
  if (value === null) return "—";

  const amount = Number(value);

  return Number.isFinite(amount)
    ? `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "—";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Display one prescription group in a table row.
function prescriptionRow(
  label: string,
  sph: string | null,
  cyl: string | null,
  axis: number | null
) {
  return (
    <TableRow key={label}>
      <TableCell>{label}</TableCell>
      <TableCell>{display(sph)}</TableCell>
      <TableCell>{display(cyl)}</TableCell>
      <TableCell>{display(axis)}</TableCell>
    </TableRow>
  );
}

// Display all four measurements of a prescription.
function PrescriptionTable({
  prescription,
}: {
  prescription: Prescription;
}) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Eye / Vision</TableCell>
            <TableCell>SPH</TableCell>
            <TableCell>CYL</TableCell>
            <TableCell>AXIS</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {prescriptionRow(
            "Right — Distance",
            prescription.reDistSph,
            prescription.reDistCyl,
            prescription.reDistAxis
          )}

          {prescriptionRow(
            "Left — Distance",
            prescription.leDistSph,
            prescription.leDistCyl,
            prescription.leDistAxis
          )}

          {prescriptionRow(
            "Right — Near",
            prescription.reNearSph,
            prescription.reNearCyl,
            prescription.reNearAxis
          )}

          {prescriptionRow(
            "Left — Near",
            prescription.leNearSph,
            prescription.leNearCyl,
            prescription.leNearAxis
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();

  const [customer, setCustomer] =
    useState<CustomerDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Preserve the previous search when returning.
  const previousSearch = params.get("search") ?? "";
  const backUrl = previousSearch
    ? `/customers?search=${encodeURIComponent(previousSearch)}`
    : "/customers";

  // Fetch the exact customer selected from the list.
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid customer ID.");
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setCustomer(null);
    setError("");

    getCustomer(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setCustomer(result);
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

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          Loading customer details...
        </Typography>
      </Box>
    );
  }

  if (error || !customer) {
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

  // The latest record is shown first because the
  // backend returns records ordered by date.
  const latestRecord = customer.records[0];

  return (
    <Stack spacing={3}>
      {/* Page navigation */}
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
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={2}
        >
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {customer.name}
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Customer ID: {customer.id}
            </Typography>
          </Box>

          <Chip
            label="Customer Record"
            color="primary"
            variant="outlined"
          />
        </Stack>
      </Box>

      {/* Personal details */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PersonOutlined color="primary" />
            <Typography variant="h6">
              Personal Information
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            {[
              ["Name", customer.name],
              ["Mobile Number", customer.mobNumber],
              ["Gender", customer.gender],
              ["Reference", customer.reference],
              ["Registration Date", formatDate(customer.createdAt)],
              ["Last Updated", formatDate(customer.updatedAt)],
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 12, sm: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography fontWeight={500} sx={{ mt: 0.5 }}>
                  {display(value)}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Prescriptions */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <GlassesOutlined color="primary" />
            <Typography variant="h6">
              Optical Prescriptions
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {customer.prescriptions.length === 0 ? (
            <Alert severity="info">
              No prescription has been recorded.
            </Alert>
          ) : (
            <Stack spacing={3}>
              {customer.prescriptions.map((prescription) => (
                <Box key={prescription.id}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    Recorded {formatDate(prescription.createdAt)}
                  </Typography>

                  <PrescriptionTable prescription={prescription} />
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Frame, lens and pricing records */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ReceiptLongOutlined color="primary" />
            <Typography variant="h6">
              Purchase Records
            </Typography>
          </Stack>

          <Divider sx={{ my: 2 }} />

          {customer.records.length === 0 ? (
            <Alert severity="info">
              No purchase-related records available.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {customer.records.map((record) => (
                <Paper
                  key={record.id}
                  variant="outlined"
                  sx={{ p: 2.5, borderRadius: 2 }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 2 }}
                  >
                    <Typography variant="subtitle2">
                      {formatDate(record.createdAt)}
                    </Typography>

                    <Chip
                      size="small"
                      label={
                        record.pricingMode === "SPLIT"
                          ? "Frame + Lens"
                          : "MRP Only"
                      }
                    />
                  </Stack>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography color="text.secondary" variant="body2">
                        Frame Type
                      </Typography>
                      <Typography fontWeight={500}>
                        {display(record.specsType)}
                      </Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography color="text.secondary" variant="body2">
                        Lens Type
                      </Typography>
                      <Typography fontWeight={500}>
                        {display(record.lensType)}
                      </Typography>
                    </Grid>

                    {record.pricingMode === "SPLIT" && (
                      <>
                        <Grid size={{ xs: 6 }}>
                          <Typography color="text.secondary" variant="body2">
                            Frame Rate
                          </Typography>
                          <Typography fontWeight={500}>
                            {formatMoney(record.frameRate)}
                          </Typography>
                        </Grid>

                        <Grid size={{ xs: 6 }}>
                          <Typography color="text.secondary" variant="body2">
                            Lens Rate
                          </Typography>
                          <Typography fontWeight={500}>
                            {formatMoney(record.lensRate)}
                          </Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>

                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: "background.default",
                      borderRadius: 2,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography fontWeight={600}>
                      Total MRP
                    </Typography>

                    <Typography
                      variant="h6"
                      color="primary"
                      fontWeight={700}
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

      {/* Internal notes: never use this in PDF output. */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LockOutlined color="primary" />
            <Typography variant="h6">
              Internal Customer Notes
            </Typography>
          </Stack>

          <Alert severity="info" sx={{ my: 2 }}>
            Internal CRM information only. Do not include
            these notes in customer PDFs or WhatsApp messages.
          </Alert>

          <Typography sx={{ whiteSpace: "pre-wrap" }}>
            {customer.notes || "No internal notes added."}
          </Typography>
        </CardContent>
      </Card>

      {/* Additional actions will be enabled in later steps. */}
      {latestRecord && (
        <Typography variant="caption" color="text.secondary">
          Latest purchase recorded on {formatDate(latestRecord.createdAt)}.
        </Typography>
      )}
    </Stack>
  );
}
