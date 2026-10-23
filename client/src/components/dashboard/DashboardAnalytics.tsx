/**
 * Optical CRM — Interactive Dashboard Analytics
 *
 * Display real purchase analytics from PostgreSQL.
 * Filter monthly/yearly data and compare the last three years.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getDashboardAnalytics } from "../../services/dashboardApi";
import { type DashboardAnalyticsData } from "../../models/dashboard";

// Format amounts using Indian rupees.
function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

// Recharts tooltips may provide numbers,
// strings, arrays or undefined values.
function tooltipMoney(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const amount = Number(raw ?? 0);

  return money(Number.isFinite(amount) ? amount : 0);
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const chartColors = ["#2563eb", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

type Period = "monthly" | "yearly";
type ChartKind = "bar" | "line" | "pie";

type YearRange = "last3" | "last5" | "all" | "custom";

// Both monthly and yearly charts use the same shape.
// This avoids Recharts TypeScript data errors.
type ChartRow = {
  label: string;
  value: number;
  purchases: number;
  comparison: number;
};

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>

        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            my: 1,
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function DashboardAnalytics() {
  const [data, setData] = useState<DashboardAnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Changing these filters does not call the API again.
  const [period, setPeriod] = useState<Period>("monthly");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [comparisonYear, setComparisonYear] = useState<number | null>(null);
  const [compare, setCompare] = useState(false);

  // Display the latest three years by default, or explore more.
  const [yearRange, setYearRange] = useState<YearRange>("last3");
  const [startYear, setStartYear] = useState<number | null>(null);
  const [endYear, setEndYear] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getDashboardAnalytics(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;

        setData(result);
        setError("");

        // Default to the current year.
        setSelectedYear((previous) =>
          previous !== null && result.years.some((item) => item.year === previous)
            ? previous
            : result.currentYear,
        );
      })
      .catch((err) => {
        if (controller.signal.aborted) return;

        setError(err instanceof Error ? err.message : "Unable to load analytics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);

  const years = data?.years ?? [];

  const activeYear = selectedYear ?? data?.currentYear ?? new Date().getFullYear();

  const current = years.find((item) => item.year === activeYear);

  const otherYears = years.filter((item) => item.year !== activeYear);

  // Prefer the previous year for comparison.
  const otherYear =
    otherYears.find((item) => item.year === comparisonYear) ??
    otherYears.find((item) => item.year === activeYear - 1) ??
    otherYears[0];

  // Use identical object properties for all charts.
  const yearlyChart: ChartRow[] = years.map((year) => ({
    label: String(year.year),
    value: year.value,
    purchases: year.purchases,
    comparison: 0,
  }));

  const monthlyChart: ChartRow[] = months.map((month, index) => ({
    label: month,
    value: current?.months[index]?.value ?? 0,
    purchases: current?.months[index]?.purchases ?? 0,
    comparison: otherYear?.months[index]?.value ?? 0,
  }));

  // Yearly chart range follows the calendar automatically.
  // All historical years remain selectable in the year dropdown.
  const availableYears = years.map((item) => item.year);
  const earliestYear = availableYears[0] ?? activeYear;
  const latestYear = data?.currentYear ?? activeYear;

  let rangeStart = earliestYear;
  let rangeEnd = latestYear;

  if (yearRange === "last3") {
    rangeStart = Math.max(earliestYear, latestYear - 2);
  } else if (yearRange === "last5") {
    rangeStart = Math.max(earliestYear, latestYear - 4);
  } else if (yearRange === "custom") {
    const from = startYear ?? earliestYear;
    const to = endYear ?? latestYear;
    rangeStart = Math.min(from, to);
    rangeEnd = Math.max(from, to);
  }

  const filteredYearlyChart = yearlyChart.filter((row) => {
    const year = Number(row.label);
    return year >= rangeStart && year <= rangeEnd;
  });

  const chartData: ChartRow[] = period === "yearly" ? filteredYearlyChart : monthlyChart;

  // Pie charts show purchase value by product type.
  const pieData = (current?.categories ?? []).filter((category) => category.value > 0);

  const previousYear = years.find((item) => item.year === activeYear - 1);

  // Compare the same elapsed months for the
  // current year, rather than a partial year against
  // the previous year's full total.
  const isCurrentYear = activeYear === data?.currentYear;

  const elapsedMonth = new Date().getUTCMonth();

  const comparableCurrentValue = isCurrentYear
    ? (current?.months.slice(0, elapsedMonth + 1).reduce((sum, month) => sum + month.value, 0) ?? 0)
    : (current?.value ?? 0);

  const comparablePreviousValue = isCurrentYear
    ? (previousYear?.months
        .slice(0, elapsedMonth + 1)
        .reduce((sum, month) => sum + month.value, 0) ?? 0)
    : (previousYear?.value ?? 0);

  const yearChange =
    previousYear && comparablePreviousValue > 0
      ? ((comparableCurrentValue - comparablePreviousValue) / comparablePreviousValue) * 100
      : null;

  if (loading && !data) {
    return (
      <Stack direction="row" spacing={2} sx={{ py: 5, alignItems: "center" }}>
        <CircularProgress size={24} />
        <Typography>Loading analytics...</Typography>
      </Stack>
    );
  }

  if (!data || !current) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            onClick={() => {
              setLoading(true);
              setRefreshKey((value) => value + 1);
            }}
          >
            Retry
          </Button>
        }
      >
        {error || "Analytics data is unavailable."}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Analytics heading and refresh button. */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Business Analytics
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Explore real purchase data across your recorded history.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRefreshKey((value) => value + 1);
          }}
        >
          {loading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </Stack>

      {error && <Alert severity="warning">{error}</Alert>}

      {/* -----------------------------------------------
          8. INTERACTIVE FILTERS
      ------------------------------------------------ */}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Analytics Explorer
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={period}
                  onChange={(_, next: Period | null) => {
                    if (next) setPeriod(next);
                  }}
                >
                  <ToggleButton value="monthly">Monthly</ToggleButton>

                  <ToggleButton value="yearly">Yearly</ToggleButton>
                </ToggleButtonGroup>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Select Year"
                  value={activeYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {years.map((year) => (
                    <MenuItem key={year.year} value={year.year}>
                      {year.year}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Chart Type"
                  value={chartKind}
                  onChange={(event) => setChartKind(event.target.value as ChartKind)}
                >
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="pie">Pie Chart</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            {/* Filter the years shown in the yearly bar/line chart. */}
            {period === "yearly" && chartKind !== "pie" && (
              <Stack spacing={2}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Historical Date Range"
                  value={yearRange}
                  onChange={(event) => setYearRange(event.target.value as YearRange)}
                >
                  <MenuItem value="last3">Last 3 Years</MenuItem>
                  <MenuItem value="last5">Last 5 Years</MenuItem>
                  <MenuItem value="all">All Years</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </TextField>

                {yearRange === "custom" && (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="From Year"
                        value={startYear ?? earliestYear}
                        onChange={(event) => setStartYear(Number(event.target.value))}
                      >
                        {availableYears.map((year) => (
                          <MenuItem key={year} value={year}>
                            {year}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="To Year"
                        value={endYear ?? latestYear}
                        onChange={(event) => setEndYear(Number(event.target.value))}
                      >
                        {availableYears.map((year) => (
                          <MenuItem key={year} value={year}>
                            {year}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                )}
              </Stack>
            )}

            {/* Compare months from two different years. */}
            {period === "monthly" && chartKind !== "pie" && (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ alignItems: { sm: "center" } }}
              >
                <FormControlLabel
                  control={
                    <Switch checked={compare} onChange={(_, checked) => setCompare(checked)} />
                  }
                  label="Compare with another year"
                />

                {compare && otherYear && (
                  <TextField
                    select
                    size="small"
                    label="Comparison Year"
                    value={otherYear.year}
                    onChange={(event) => setComparisonYear(Number(event.target.value))}
                    sx={{ minWidth: { xs: 0, sm: 160 }, width: { xs: "100%", sm: "auto" } }}
                  >
                    {otherYears.map((year) => (
                      <MenuItem key={year.year} value={year.year}>
                        {year.year}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* -----------------------------------------------
          9. SUMMARY CARDS
      ------------------------------------------------ */}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Active Customers"
            value={data.totalCustomers.toLocaleString("en-IN")}
            detail="Current active customer profiles"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label={`Purchases in ${activeYear}`}
            value={current.purchases.toLocaleString("en-IN")}
            detail="Purchases with a recorded date"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label={`Purchase Value in ${activeYear}`}
            value={money(current.value)}
            detail="Sum of recorded purchase MRP"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            label="Year-on-Year Change"
            value={
              yearChange === null ? "N/A" : `${yearChange >= 0 ? "+" : ""}${yearChange.toFixed(1)}%`
            }
            detail={
              previousYear
                ? isCurrentYear
                  ? `Year-to-date vs ${previousYear.year}`
                  : `Compared with ${previousYear.year}`
                : "Previous year unavailable"
            }
          />
        </Grid>
      </Grid>

      {/* -----------------------------------------------
          10. BAR, LINE AND PIE CHARTS
      ------------------------------------------------ */}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {chartKind === "pie"
              ? `${activeYear} Purchase Breakdown`
              : period === "yearly"
                ? `Purchase Value (${rangeStart}–${rangeEnd})`
                : `Monthly Purchase Value — ${activeYear}`}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {chartKind === "pie"
              ? "Purchase value grouped by product type."
              : "Purchase value based on saved purchase dates."}
          </Typography>

          <Box
            sx={{
              width: "100%",
              height: { xs: 290, md: 390 },
            }}
          >
            {chartKind === "pie" ? (
              pieData.length === 0 ? (
                <Alert severity="info">No dated purchases for this year.</Alert>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius="40%"
                      outerRadius="75%"
                      paddingAngle={2}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>

                    <Tooltip formatter={(value) => tooltipMoney(value)} />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )
            ) : chartKind === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 12,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="label" />

                  <YAxis
                    width={70}
                    tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`}
                  />

                  <Tooltip formatter={(value) => tooltipMoney(value)} />

                  <Legend />

                  <Bar
                    dataKey="value"
                    name={period === "yearly" ? "Purchase Value" : String(activeYear)}
                    fill={chartColors[0]}
                    radius={[5, 5, 0, 0]}
                  />

                  {period === "monthly" && compare && otherYear && (
                    <Bar
                      dataKey="comparison"
                      name={String(otherYear.year)}
                      fill={chartColors[1]}
                      radius={[5, 5, 0, 0]}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 12,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis dataKey="label" />

                  <YAxis
                    width={70}
                    tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`}
                  />

                  <Tooltip formatter={(value) => tooltipMoney(value)} />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="value"
                    name={period === "yearly" ? "Purchase Value" : String(activeYear)}
                    stroke={chartColors[0]}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />

                  {period === "monthly" && compare && otherYear && (
                    <Line
                      type="monotone"
                      dataKey="comparison"
                      name={String(otherYear.year)}
                      stroke={chartColors[1]}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            Purchase Value is saved MRP, not actual payment collection or profit. Purchases without
            dates are excluded from these charts.
          </Typography>
        </CardContent>
      </Card>

      {/* -----------------------------------------------
          11. RECENT PURCHASES
      ------------------------------------------------ */}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Recently Recorded Purchases
          </Typography>

          {data.recent.length === 0 ? (
            <Alert severity="info">No purchase records available.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {data.recent.map((record) => (
                <Stack
                  key={record.id}
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { sm: "center" },
                    borderBottom: 1,
                    borderColor: "divider",
                    py: 1,
                    gap: 1,
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
                      {[record.frame, record.lens].filter(Boolean).join(" + ") ||
                        "Products not specified"}
                    </Typography>
                  </Box>

                  <Typography sx={{ fontWeight: 700 }}>{money(record.value)}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
