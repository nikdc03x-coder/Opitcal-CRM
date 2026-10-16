import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link } from "react-router";
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
import type { AnalyticsHistorical, ExplorerSettings } from "../../models/analytics";
import { analyticsUrl } from "../../services/analyticsApi";
import {
  categoryColor,
  analyticsCount,
  analyticsMoney,
  historicalChange,
  yearColor,
} from "../../utils/analytics";
import { useAnalyticsQuery } from "./reportStore";
import { ChartCard, Kpi, ReportState } from "./AnalyticsUi";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export default function HistoricalSalesExplorer({
  settings,
  onChange,
  onDrill,
}: {
  settings: ExplorerSettings;
  onChange: (settings: ExplorerSettings) => void;
  onDrill: (from: string, to: string) => void;
}) {
  const report = useAnalyticsQuery<AnalyticsHistorical>(analyticsUrl("historical"));
  const data = report.data;
  const set = <K extends keyof ExplorerSettings>(key: K, value: ExplorerSettings[K]) =>
    onChange({ ...settings, [key]: value });
  if (!data) return <ReportState {...report} />;
  const current =
    data.years.find((row) => row.year === settings.year) ??
    data.years.find((row) => row.year === data.currentYear)!;
  const others = data.years.filter((row) => row.year !== current.year);
  const other =
    others.find((row) => row.year === settings.comparison) ??
    others.find((row) => row.year === current.year - 1) ??
    others[0];
  const compare = settings.compare && Boolean(other);
  const first = data.years[0]?.year ?? current.year;
  const rangeFirst =
    settings.range === "last3"
      ? data.currentYear - 2
      : settings.range === "last5"
        ? data.currentYear - 4
        : settings.range === "custom"
          ? Math.min(settings.first ?? first, settings.last ?? data.currentYear)
          : first;
  const rangeLast =
    settings.range === "custom"
      ? Math.max(settings.first ?? first, settings.last ?? data.currentYear)
      : data.currentYear;
  const selectedYears = data.years.filter((row) => row.year >= rangeFirst && row.year <= rangeLast);
  const change = historicalChange(data, current.year);
  const monthly = months.map((label, index) => ({
    label,
    value: Number(current.months[index].value),
    exact: current.months[index].value,
    comparison: Number(other?.months[index]?.value ?? 0),
    comparisonExact: other?.months[index]?.value ?? "0",
    index,
  }));
  const yearly = (compare ? [current, other] : selectedYears).map((row) => ({
    label: String(row.year),
    value: row.year === other?.year && compare ? null : Number(row.value),
    exact: row.value,
    comparison: row.year === other?.year && compare ? Number(row.value) : null,
    comparisonExact: row.value,
    index: row.year,
  }));
  const rows = settings.mode === "monthly" ? monthly : yearly;
  const drill = (index: number) => {
    if (!rows[index]) return;
    if (settings.mode === "monthly") {
      const month = `${current.year}-${String(index + 1).padStart(2, "0")}`;
      const end = new Date(`${month}-01T00:00:00Z`);
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      onDrill(`${month}-01`, end.toISOString().slice(0, 10));
    } else onDrill(`${rows[index].label}-01-01`, `${rows[index].label}-12-31`);
  };
  // nik - Keep every original control, chart type, yearly range and KPI; the shared report period is independent.
  const yearSelect = (
    label: string,
    value: number,
    changeYear: (year: number) => void,
    values = data.years,
  ) => (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value}
      onChange={(event) => changeYear(Number(event.target.value))}
    >
      {values.map((row) => (
        <MenuItem key={row.year} value={row.year}>
          {row.year}
        </MenuItem>
      ))}
    </TextField>
  );
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 750 }}>
          Historical Sales Explorer
        </Typography>
        <Typography color="text.secondary">
          Explore recorded years independently of the other reports’ date filters.
        </Typography>
      </Box>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Analytics Explorer
            </Typography>
            <Grid container spacing={2} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <ToggleButtonGroup
                  fullWidth
                  exclusive
                  size="small"
                  value={settings.mode}
                  aria-label="Analysis interval"
                  onChange={(_, value) => {
                    if (value) set("mode", value);
                  }}
                >
                  <ToggleButton value="monthly">Monthly</ToggleButton>
                  <ToggleButton value="yearly">Yearly</ToggleButton>
                </ToggleButtonGroup>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                {yearSelect("Select Year", current.year, (value) => set("year", value))}
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Chart Type"
                  value={settings.chart}
                  onChange={(event) =>
                    set("chart", event.target.value as ExplorerSettings["chart"])
                  }
                >
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="pie">Pie Chart</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ alignItems: { sm: "center" } }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.compare}
                    onChange={(_, value) => set("compare", value)}
                    disabled={!other}
                  />
                }
                label="Compare with another year"
              />
              {compare && (
                <Box sx={{ minWidth: 180 }}>
                  {yearSelect(
                    "Comparison Year",
                    other.year,
                    (value) => set("comparison", value),
                    others,
                  )}
                </Box>
              )}
            </Stack>
            {settings.mode === "yearly" && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Historical Date Range"
                    value={settings.range}
                    disabled={compare}
                    onChange={(event) =>
                      set("range", event.target.value as ExplorerSettings["range"])
                    }
                  >
                    {[
                      ["last3", "Last 3 Years"],
                      ["last5", "Last 5 Years"],
                      ["all", "All Years"],
                      ["custom", "Custom Range"],
                    ].map(([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                {settings.range === "custom" && !compare && (
                  <>
                    <Grid size={{ xs: 6, md: 4 }}>
                      {yearSelect("From Year", settings.first ?? first, (value) =>
                        set("first", value),
                      )}
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      {yearSelect("To Year", settings.last ?? data.currentYear, (value) =>
                        set("last", value),
                      )}
                    </Grid>
                  </>
                )}
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Grid container spacing={2}>
        {[
          [
            "Active Customers",
            analyticsCount(data.totalCustomers),
            "Current active customer profiles",
          ],
          [
            `Purchases in ${current.year}`,
            analyticsCount(current.purchases),
            "Purchases with a recorded date",
          ],
          [
            `Purchase Value in ${current.year}`,
            analyticsMoney(current.value),
            "Sum of recorded purchase MRP",
          ],
          [
            "Year-on-Year Change",
            change === null ? "N/A" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`,
            current.year === data.currentYear
              ? `Through ${data.today.slice(5)} vs the same calendar day in ${current.year - 1}`
              : `Full year vs ${current.year - 1}`,
          ],
        ].map(([label, value, detail]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Kpi label={label} value={value} detail={detail} />
          </Grid>
        ))}
      </Grid>
      <ChartCard
        title={
          settings.chart === "pie"
            ? "Purchase value by product type"
            : settings.mode === "monthly"
              ? `Monthly Purchase Value — ${current.year}${compare ? ` vs ${other.year}` : ""}`
              : "Yearly Purchase Value"
        }
        detail="Saved purchase dates and MRP. Hover for exact values; click a bar or point to open its purchase report."
      >
        {settings.chart === "pie" ? (
          <Grid container spacing={2}>
            {(compare ? [current, other] : [current]).map((year) => (
              <Grid key={year.year} size={{ xs: 12, md: compare ? 6 : 12 }}>
                <Typography variant="subtitle1" sx={{ textAlign: "center" }}>
                  {year.year}
                </Typography>
                {year.purchases ? (
                  <Box sx={{ height: 330 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          data={year.categories.map((row) => ({
                            ...row,
                            amount: Number(row.value),
                          }))}
                          dataKey="amount"
                          nameKey="name"
                          innerRadius="45%"
                          outerRadius="70%"
                        >
                          {year.categories.map((row) => (
                            <Cell key={row.name} fill={categoryColor(row.name)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(_, __, item) => analyticsMoney(item.payload?.value)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Alert severity="info">No dated purchases for this year.</Alert>
                )}
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ height: { xs: 310, md: 400 }, minWidth: 0 }}>
            <ResponsiveContainer>
              {settings.chart === "bar" ? (
                <BarChart
                  data={rows}
                  onClick={(state) => {
                    const index = Number(state?.activeTooltipIndex);
                    if (Number.isInteger(index)) drill(index);
                  }}
                  margin={{ top: 15, right: 15, left: 5, bottom: 15 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis
                    width={80}
                    tickFormatter={(value) =>
                      `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value)}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#2563eb0d" }}
                    formatter={(_, name, item) =>
                      analyticsMoney(
                        name === String(other?.year) && compare
                          ? item.payload?.comparisonExact
                          : item.payload?.exact,
                      )
                    }
                  />
                  <Legend />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    name={
                      settings.mode === "monthly" || compare
                        ? String(current.year)
                        : "Recorded Purchase Value"
                    }
                    fill={yearColor(current.year)}
                    radius={[5, 5, 0, 0]}
                  />
                  {compare && (
                    <Bar
                      isAnimationActive={false}
                      dataKey="comparison"
                      name={String(other.year)}
                      fill={yearColor(other.year)}
                      radius={[5, 5, 0, 0]}
                    />
                  )}
                </BarChart>
              ) : (
                <LineChart
                  data={rows}
                  onClick={(state) => {
                    const index = Number(state?.activeTooltipIndex);
                    if (Number.isInteger(index)) drill(index);
                  }}
                  margin={{ top: 15, right: 15, left: 5, bottom: 15 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={20} />
                  <YAxis
                    width={80}
                    tickFormatter={(value) =>
                      `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value)}`
                    }
                  />
                  <Tooltip
                    formatter={(_, name, item) =>
                      analyticsMoney(
                        name === String(other?.year) && compare
                          ? item.payload?.comparisonExact
                          : item.payload?.exact,
                      )
                    }
                  />
                  <Legend />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="value"
                    name={
                      settings.mode === "monthly" || compare
                        ? String(current.year)
                        : "Recorded Purchase Value"
                    }
                    stroke={yearColor(current.year)}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 7 }}
                  />
                  {compare && (
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="comparison"
                      name={String(other.year)}
                      stroke={yearColor(other.year)}
                      strokeDasharray="6 3"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          Purchase value is not payment collection or profit. Undated records are excluded.
          Historical charts stop at {data.today}.
        </Typography>
      </ChartCard>
      <ChartCard
        title="Exact comparison values"
        detail="The accessible table contains the same values as the chart."
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{settings.mode === "monthly" ? "Month" : "Year"}</TableCell>
                <TableCell align="right">
                  {settings.mode === "monthly" || compare ? current.year : "Purchase Value"}
                </TableCell>
                {compare && <TableCell align="right">{other.year}</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.label} hover>
                  <TableCell>
                    <Button size="small" onClick={() => drill(index)}>
                      {row.label}
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    {row.value === null ? "—" : analyticsMoney(row.exact)}
                  </TableCell>
                  {compare && (
                    <TableCell align="right">
                      {row.comparison === null ? "—" : analyticsMoney(row.comparisonExact)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ChartCard>
      <ChartCard
        title="Recently Recorded Purchases"
        detail="Latest entries, independent of the selected reporting year."
      >
        {data.recent.length ? (
          <Stack divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />} spacing={1}>
            {data.recent.map((row) => (
              <Stack
                key={row.id}
                direction="row"
                sx={{ justifyContent: "space-between", gap: 2, alignItems: "center", py: 1 }}
              >
                <Box>
                  <Button
                    component={Link}
                    to={`/customers/${row.customerId}?record=${row.id}`}
                    sx={{ px: 0, textTransform: "none" }}
                  >
                    {row.customerName}
                  </Button>
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {[row.frame, row.lens].filter(Boolean).join(" + ") || "Products not specified"}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{analyticsMoney(row.value)}</Typography>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No purchase records available.</Alert>
        )}
      </ChartCard>
    </Stack>
  );
}
