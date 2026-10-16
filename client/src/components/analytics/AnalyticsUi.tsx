import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
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
import type { ReactNode } from "react";
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
import type {
  AnalyticsRank,
  AnalyticsSummary,
  AnalyticsPeriod,
  AnalyticsPoint,
} from "../../models/analytics";
import {
  analyticsColors,
  analyticsCount,
  analyticsMoney,
  categoryColor,
} from "../../utils/analytics";
import { useAnalyticsRefresh } from "./reportStore";

export function ReportState({ loading, error }: { loading: boolean; error?: string }) {
  const retry = useAnalyticsRefresh();
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={retry}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  if (loading)
    return (
      <Stack spacing={2} role="status" aria-label="Loading report">
        <LinearProgress />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((key) => (
            <Grid key={key} size={{ xs: 6, md: 3 }}>
              <Skeleton variant="rounded" height={110} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={270} />
      </Stack>
    );
  return null;
}
export function Kpi({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        height: "100%",
        borderTop: "3px solid",
        borderTopColor: "primary.main",
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {icon}
        </Stack>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            my: 1,
            overflowWrap: "anywhere",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
export function SummaryCards({
  summary,
  activeCustomers,
}: {
  summary: AnalyticsSummary;
  activeCustomers?: number;
}) {
  const cards = [
    ["Recorded Purchase Value", analyticsMoney(summary.value), "Sum of saved purchase MRP"],
    ["Total Purchases", analyticsCount(summary.purchases), "Matching purchase records"],
    ["Distinct Purchasing Customers", analyticsCount(summary.customers), "Unique customer IDs"],
    ["Average Purchase Value", analyticsMoney(summary.average), "Value divided by purchases"],
  ];
  if (activeCustomers !== undefined)
    cards.push([
      "Active Customers",
      analyticsCount(activeCustomers),
      "Current active profiles · all periods",
    ]);
  return (
    <Grid container spacing={2}>
      {cards.map(([label, value, detail]) => (
        <Grid key={label} size={{ xs: 12, sm: 6, lg: activeCustomers === undefined ? 3 : 2.4 }}>
          <Kpi label={label} value={value} detail={detail} />
        </Grid>
      ))}
    </Grid>
  );
}
export function ReportNote({
  period,
  summary,
}: {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
}) {
  return (
    <Alert severity="info" variant="outlined">
      {period.label}. Recorded MRP is purchase value, not payment collection or profit.{" "}
      {period.from
        ? "Undated purchases are excluded."
        : `${analyticsCount(summary.undated)} undated purchases are included in totals and excluded from time charts.`}
    </Alert>
  );
}
export function ChartCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, minWidth: 0 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
        {detail && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
            {detail}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
export function TrendChart({
  points,
  metric = "value",
  onDrill,
}: {
  points: AnalyticsPoint[];
  metric?: "value" | "purchases" | "customers";
  onDrill?: (from: string, to: string) => void;
}) {
  if (!points.length) return <Alert severity="info">No dated purchases match these filters.</Alert>;
  return (
    <Box sx={{ height: 300, width: "100%", minWidth: 0 }}>
      <ResponsiveContainer>
        <LineChart
          data={points.map((point) => ({ ...point, amount: Number(point[metric]) }))}
          margin={{ top: 15, right: 20, left: 5, bottom: 15 }}
          onClick={(state) => {
            const index = Number(state?.activeTooltipIndex);
            if (onDrill && Number.isInteger(index) && points[index])
              onDrill(points[index].from, points[index].to);
          }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={35} />
          <YAxis
            width={75}
            tickFormatter={(value) =>
              metric === "value"
                ? `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value)}`
                : String(value)
            }
          />
          <Tooltip
            formatter={(_, __, item) =>
              metric === "value"
                ? analyticsMoney(item.payload?.value)
                : analyticsCount(Number(item.payload?.[metric] ?? 0))
            }
          />
          <Line
            isAnimationActive={false}
            name={
              metric === "value"
                ? "Recorded Purchase Value"
                : metric === "customers"
                  ? "Purchasing Customers"
                  : "Purchases"
            }
            type="monotone"
            dataKey="amount"
            stroke={analyticsColors[0]}
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
export function Ranking({
  rows,
  onDrill,
  countLabel = "Purchases",
}: {
  rows: AnalyticsRank[];
  onDrill?: (row: AnalyticsRank) => void;
  countLabel?: string;
}) {
  if (!rows.length)
    return <Alert severity="info">No matching product information is recorded.</Alert>;
  return (
    <TableContainer>
      <Table size="small" aria-label="Purchase rankings">
        <TableHead>
          <TableRow>
            <TableCell>Category</TableCell>
            <TableCell align="right">{countLabel}</TableCell>
            <TableCell align="right">Share</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell sx={{ maxWidth: 300, overflowWrap: "anywhere" }}>
                {onDrill ? (
                  <Button
                    size="small"
                    sx={{ textAlign: "left", justifyContent: "flex-start", textTransform: "none" }}
                    onClick={() => onDrill(row)}
                  >
                    {row.name}
                  </Button>
                ) : (
                  row.name
                )}
              </TableCell>
              <TableCell align="right">{analyticsCount(row.purchases)}</TableCell>
              <TableCell align="right">{row.share.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
export function DistributionChart({
  rows,
  onDrill,
}: {
  rows: AnalyticsRank[];
  onDrill?: (row: AnalyticsRank) => void;
}) {
  if (!rows.some((row) => row.purchases))
    return <Alert severity="info">No matching purchases.</Alert>;
  return (
    <Box sx={{ height: 300, minWidth: 0 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            isAnimationActive={false}
            data={rows}
            dataKey="purchases"
            nameKey="name"
            innerRadius="45%"
            outerRadius="70%"
            paddingAngle={3}
            onClick={(_, index) => onDrill?.(rows[index])}
          >
            {rows.map((row) => (
              <Cell key={row.name} fill={categoryColor(row.name)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${analyticsCount(Number(value))} (${rows.find((row) => row.name === name)?.share.toFixed(1) ?? "0"}%)`,
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
}
export function CountBars({
  rows,
  series,
}: {
  rows: Record<string, string | number>[];
  series: { key: string; label: string }[];
}) {
  if (!rows.length) return <Alert severity="info">No activity in this period.</Alert>;
  return (
    <Box sx={{ height: 300, minWidth: 0 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={30} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((item, index) => (
            <Bar
              isAnimationActive={false}
              key={item.key}
              name={item.label}
              dataKey={item.key}
              fill={analyticsColors[index % analyticsColors.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
