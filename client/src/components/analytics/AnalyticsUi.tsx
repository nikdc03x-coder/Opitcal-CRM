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

import { chartTooltipStyle } from "./chartStyles";
function chartDate(value: string) {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return value;
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    month: "short",
    ...(value.length === 10 ? { day: "numeric" as const } : { year: "2-digit" as const }),
    timeZone: "UTC",
  });
}

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
  featured = false,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  featured?: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        height: "100%",
        bgcolor: featured ? "#EFF5FF" : "background.paper",
        borderColor: featured ? "#C9DAFA" : "divider",
      }}
    >
      <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: "0.78rem", fontWeight: 600 }}
          >
            {label}
          </Typography>
          {icon}
        </Stack>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 750,
            color: featured ? "primary.dark" : "text.primary",
            fontSize: { xs: "1.45rem", md: "1.7rem" },
            letterSpacing: "-0.035em",
            mt: 1,
            mb: 0.5,
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
    ["Purchase value", analyticsMoney(summary.value), "Recorded MRP · selected period"],
    ["Purchases", analyticsCount(summary.purchases), "Purchase records · selected period"],
    [
      "Purchasing customers",
      analyticsCount(summary.customers),
      "Unique customers · selected period",
    ],
    ["Average purchase", analyticsMoney(summary.average), "Per matching purchase"],
  ];
  if (activeCustomers !== undefined)
    cards.push([
      "Active Customers",
      analyticsCount(activeCustomers),
      "Current active profiles · all periods",
    ]);
  return (
    <Grid container spacing={2}>
      {cards.map(([label, value, detail], index) => (
        <Grid key={label} size={{ xs: 12, sm: 6, lg: activeCustomers === undefined ? 3 : 2.4 }}>
          <Kpi label={label} value={value} detail={detail} featured={index === 0} />
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
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1.5,
        rowGap: 0.25,
        color: "text.secondary",
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 650 }}>
        {period.label}
      </Typography>
      <Typography variant="caption">
        Purchase value uses recorded MRP, not payments or profit.{" "}
        {period.from
          ? "Undated purchases are excluded."
          : `${analyticsCount(summary.undated)} undated purchases are included in totals and excluded from time charts.`}
      </Typography>
    </Box>
  );
}
export function ChartCard({
  title,
  detail,
  children,
  action,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2.5, minWidth: 0, height: "100%" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: detail ? 0 : 2 }}
        >
          <Typography
            component="h3"
            variant="subtitle1"
            sx={{ fontWeight: 700, letterSpacing: "-0.015em" }}
          >
            {title}
          </Typography>
          {action}
        </Stack>
        {detail && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: "0.78rem", mt: 0.5, mb: 2 }}
          >
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
    <Box sx={{ height: { xs: 245, md: 285 }, width: "100%", minWidth: 0 }}>
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
          <CartesianGrid vertical={false} stroke="#E7EDF5" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748B" }}
            minTickGap={35}
            axisLine={false}
            tickLine={false}
            tickFormatter={chartDate}
          />
          <YAxis
            width={75}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748B" }}
            allowDecimals={metric === "value"}
            tickFormatter={(value) =>
              metric === "value"
                ? `₹${new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value)}`
                : String(value)
            }
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelFormatter={(label) => chartDate(String(label))}
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
            dot={points.length < 20 ? { r: 3, strokeWidth: 2, fill: "white" } : false}
            activeDot={{ r: 5 }}
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
            <TableRow
              key={row.name}
              hover
              sx={{
                "&:last-child td": { borderBottom: 0 },
                "& td": { py: 1.1, fontVariantNumeric: "tabular-nums" },
              }}
            >
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
  countLabel = "purchases",
}: {
  rows: AnalyticsRank[];
  onDrill?: (row: AnalyticsRank) => void;
  countLabel?: string;
}) {
  if (!rows.some((row) => row.purchases))
    return <Alert severity="info">No matching {countLabel}.</Alert>;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ height: 195 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={rows}
              dataKey="purchases"
              nameKey="name"
              innerRadius="60%"
              outerRadius="88%"
              paddingAngle={2}
              onClick={(_, index) => onDrill?.(rows[index])}
            >
              {rows.map((row) => (
                <Cell key={row.name} fill={categoryColor(row.name)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(value, name) => [
                `${analyticsCount(Number(value))} ${countLabel} (${rows.find((row) => row.name === name)?.share.toFixed(1) ?? "0"}%)`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {rows.map((row) => (
          <Box
            key={row.name}
            component={onDrill ? "button" : "div"}
            aria-label={`${row.name}: ${analyticsCount(row.purchases)} ${countLabel}, ${row.share.toFixed(1)}%`}
            onClick={onDrill ? () => onDrill(row) : undefined}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
              p: 0.75,
              border: 0,
              borderRadius: 1,
              bgcolor: "transparent",
              textAlign: "left",
              color: "text.primary",
              font: "inherit",
              cursor: onDrill ? "pointer" : "default",
              "&:hover": { bgcolor: onDrill ? "action.hover" : "transparent" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: categoryColor(row.name),
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ flex: 1 }}>
              {row.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            >
              {analyticsCount(row.purchases)}{" "}
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                · {row.share.toFixed(1)}%
              </Box>
            </Typography>
          </Box>
        ))}
      </Stack>
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
          <CartesianGrid vertical={false} stroke="#E7EDF5" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            minTickGap={30}
            axisLine={false}
            tickLine={false}
            tickFormatter={chartDate}
          />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            labelFormatter={(label) => chartDate(String(label))}
            formatter={(value) => analyticsCount(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((item, index) => (
            <Bar
              isAnimationActive={false}
              key={item.key}
              name={item.label}
              dataKey={item.key}
              fill={
                ["Frame Only", "Lens Only", "Frame + Lens", "Unclassified"].includes(item.label)
                  ? categoryColor(item.label)
                  : analyticsColors[index % analyticsColors.length]
              }
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
