
import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import {
  getDashboardAnalytics,
  type DashboardAnalyticsData,
} from "../../services/dashboardApi";

// nik - Display all money values in Indian rupees.
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

// nik - Convert YYYY-MM into a readable month.
function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
}

// nik - Avoid timezone shifts in stored purchase dates.
function dateLabel(value: string | null) {
  if (!value) return "Date not recorded";

  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// nik - Reusable summary card.
function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>

        <Typography
          variant="h5"
          sx={{
            mt: 1,
            fontWeight: 800,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardAnalytics() {
  const [data, setData] =
    useState<DashboardAnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // nik - Fetch fresh statistics whenever the dashboard opens.
  useEffect(() => {
    const controller = new AbortController();

    getDashboardAnalytics(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard analytics."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [retry]);

  if (loading && !data) {
    return (
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", py: 5 }}>
        <CircularProgress size={24} />
        <Typography>Loading business analytics...</Typography>
      </Stack>
    );
  }

  if (error && !data) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (!data) return null;

  const maximum = Math.max(
    1,
    ...data.monthly.map((item) => item.value)
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Business Analytics
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Live statistics from your CRM database
          </Typography>
        </Box>

        <Button
          variant="outlined"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        >
          {loading ? "Refreshing..." : "Refresh Analytics"}
        </Button>
      </Stack>

      {error && <Alert severity="warning">{error}</Alert>}

      {/* nik - Four key business statistics. */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Total Customers"
            value={data.summary.totalCustomers.toLocaleString("en-IN")}
            description="Active customer profiles"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Recorded Purchases"
            value={data.summary.totalPurchases.toLocaleString("en-IN")}
            description="All saved purchase records"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Total Purchase Value"
            value={money(data.summary.totalPurchaseValue)}
            description="Sum of saved purchase MRP"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <SummaryCard
            label="Last 30 Days"
            value={data.summary.last30DaysPurchases.toLocaleString("en-IN")}
            description="Purchases with a date in the last 30 days"
          />
        </Grid>
      </Grid>

      {/* nik - Draw a simple chart without adding a chart library. */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Monthly Purchase Value
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Last six calendar months, based on recorded purchase dates
          </Typography>

          <Box
            sx={{
              display: "flex",
              alignItems: "end",
              gap: { xs: 1, sm: 2 },
              height: 260,
              mt: 3,
              pb: 1,
            }}
          >
            {data.monthly.map((item) => (
              <Stack
                key={item.month}
                spacing={1}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: { xs: 10, sm: 12 } }}
                >
                  {item.value > 0
                    ? `₹${Math.round(item.value).toLocaleString("en-IN")}`
                    : "₹0"}
                </Typography>

                <Box
                  title={`${item.purchases} purchases — ${money(item.value)}`}
                  sx={{
                    width: "75%",
                    maxWidth: 72,
                    minHeight: item.value > 0 ? 5 : 0,
                    height: `${(item.value / maximum) * 175}px`,
                    bgcolor: "primary.main",
                    borderRadius: "7px 7px 0 0",
                  }}
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: { xs: 10, sm: 12 } }}
                >
                  {monthLabel(item.month)}
                </Typography>
              </Stack>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* nik - Show recently recorded purchases with customer links. */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Recently Recorded Purchases
          </Typography>

          {data.recent.length === 0 ? (
            <Alert severity="info">No purchases recorded yet.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {data.recent.map((record) => (
                <Paper
                  key={record.id}
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2 }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                    }}
                  >
                    <Box>
                      <Button
                        component={Link}
                        to={`/customers/${record.customerId}`}
                        sx={{ px: 0, fontWeight: 700 }}
                      >
                        {record.customerName}
                      </Button>

                      <Typography variant="body2" color="text.secondary">
                        {[record.frame, record.lens]
                          .filter(Boolean)
                          .join(" + ") || "Products not specified"}
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        Purchased: {dateLabel(record.purchaseDate)}
                      </Typography>
                    </Box>

                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {money(record.value)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
