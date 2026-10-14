
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

// Individual icon imports avoid the earlier Vite icon issue.
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
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

// --------------------------------------------------
// 1. HELPER FUNCTIONS
// --------------------------------------------------

// Show a dash when a value is missing.
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

// Format currency in Indian rupees.
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

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Display registration and purchase dates.
function formatDate(date: string): string {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// --------------------------------------------------
// 2. REUSABLE DISPLAY COMPONENTS
// --------------------------------------------------

// A small label and value used across customer details.
function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <Box>
      <Typography
        variant="body2"
        color="text.secondary"
      >
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

// One row in the prescription table.
function PrescriptionRow({
  label,
  sph,
  cyl,
  axis,
}: {
  label: string;
  sph: string | number | null;
  cyl: string | number | null;
  axis: string | number | null;
}) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell>{display(sph)}</TableCell>
      <TableCell>{display(cyl)}</TableCell>
      <TableCell>{display(axis)}</TableCell>
    </TableRow>
  );
}

// Display all four prescription groups.
// nik - Keep the prescription table simple for shop staff.
function PrescriptionTable({
  prescription,
}: {
  prescription: Prescription;
}) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2 }}
    >
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{
              bgcolor: "background.default",
            }}
          >
            <TableCell sx={{ fontWeight: 600 }}>
              Eye / Vision
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }}>
              SPH
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }}>
              CYL
            </TableCell>
            <TableCell sx={{ fontWeight: 600 }}>
              AXIS
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          <PrescriptionRow
            label="Right Eye — Distance"
            sph={prescription.reDistSph}
            cyl={prescription.reDistCyl}
            axis={prescription.reDistAxis}
          />

          <PrescriptionRow
            label="Left Eye — Distance"
            sph={prescription.leDistSph}
            cyl={prescription.leDistCyl}
            axis={prescription.leDistAxis}
          />

          <PrescriptionRow
            label="Right Eye — Near"
            sph={prescription.reNearSph}
            cyl={prescription.reNearCyl}
            axis={prescription.reNearAxis}
          />

          <PrescriptionRow
            label="Left Eye — Near"
            sph={prescription.leNearSph}
            cyl={prescription.leNearCyl}
            axis={prescription.leNearAxis}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// --------------------------------------------------
// 3. CUSTOMER DETAILS PAGE
// --------------------------------------------------

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();

  const [customer, setCustomer] =
    useState<CustomerDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Keep the original search when returning to the list.
  const previousSearch = params.get("search") ?? "";

  const backUrl = previousSearch
    ? `/customers?search=${encodeURIComponent(previousSearch)}`
    : "/customers";

  // Fetch only the selected customer's record.
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
              : "Unable to load customer details."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    // Cancel the request if the page changes.
    return () => {
      controller.abort();
    };
  }, [id]);

  // --------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------

  if (loading) {
    return (
      <Box
        sx={{
          py: 8,
          textAlign: "center",
        }}
      >
        <CircularProgress />

        <Typography sx={{ mt: 2 }}>
          Loading customer details...
        </Typography>
      </Box>
    );
  }

  // --------------------------------------------------
  // ERROR STATE
  // --------------------------------------------------

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
          sx={{
            alignSelf: "flex-start",
          }}
        >
          Back to Customers
        </Button>
      </Stack>
    );
  }

  // The backend returns newest records first.
  const latestRecord = customer.records[0];

  // --------------------------------------------------
  // CUSTOMER DETAILS UI
  // --------------------------------------------------

  return (
    <Stack spacing={3}>
      {/* Navigation and customer heading */}
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
            alignItems: {
              sm: "center",
            },
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 700 }}
            >
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

          <Chip
            label="Customer Record"
            color="primary"
            variant="outlined"
          />
        </Stack>
      </Box>

      {/* Personal information */}
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

      {/* All saved prescriptions */}
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
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                      >
                        Recorded{" "}
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

      {/* Frame, lens and purchase history */}
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
                  {/* Purchase date and pricing mode */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2">
                        {formatDate(record.createdAt)}
                      </Typography>

                      {index === 0 && (
                        <Typography
                          variant="caption"
                          color="primary"
                        >
                          Latest Purchase
                        </Typography>
                      )}
                    </Box>

                    <Chip
                      size="small"
                      label={
                        record.pricingMode === "SPLIT"
                          ? "Frame + Lens"
                          : "MRP Only"
                      }
                    />
                  </Stack>

                  {/* Frame and lens information */}
                  <Grid container spacing={2}>
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

                    {/* Only show individual rates when applicable */}
                    {record.pricingMode === "SPLIT" && (
                      <>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <DetailItem
                            label="Frame Rate"
                            value={formatMoney(
                              record.frameRate
                            )}
                          />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6 }}>
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

                  {/* Total MRP */}
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
                    <Typography
                      sx={{ fontWeight: 600 }}
                    >
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

      {/* Staff-only notes */}
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
            These notes are for internal CRM use only.
            They must never be included in customer PDFs
            or WhatsApp messages.
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

      {/* Display latest purchase date for quick reference */}
      {latestRecord && (
        <Typography
          variant="caption"
          color="text.secondary"
        >
          Latest purchase recorded on{" "}
          {formatDate(latestRecord.createdAt)}.
        </Typography>
      )}
    </Stack>
  );
}
