import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { Link } from "react-router";
import type {
  AnalyticsComparison,
  AnalyticsFilters as Filters,
  AnalyticsPurchases,
} from "../../models/analytics";
import {
  analyticsCount,
  analyticsMoney,
  defaultAnalyticsFilters,
  reportParams,
} from "../../utils/analytics";
import { analyticsUrl, downloadAnalyticsCsv } from "../../services/analyticsApi";
import { useAnalyticsQuery } from "./reportStore";
import AnalyticsFilters from "./AnalyticsFilters";
import { ChartCard, Kpi, ReportNote, ReportState, SummaryCards } from "./AnalyticsUi";

export type SalesTableSettings = {
  search: string;
  sort: "date" | "customer" | "amount";
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
};
export function DailySalesReport({
  filters,
  settings,
  onChange,
}: {
  filters: Filters;
  settings: SalesTableSettings;
  onChange: (settings: SalesTableSettings) => void;
}) {
  const [search, setSearch] = useState(settings.search),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(settings.search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [settings.search]);
  useEffect(() => () => exportController.current?.abort(), []);
  const params = reportParams(filters, {
    search,
    sort: settings.sort,
    direction: settings.direction,
    page: settings.page + 1,
    pageSize: settings.pageSize,
  });
  const report = useAnalyticsQuery<AnalyticsPurchases>(
    analyticsUrl("purchases", params),
    settings.search.trim() === search,
  );
  const data = report.data;
  const update = (changes: Partial<SalesTableSettings>) =>
    onChange({ ...settings, page: 0, ...changes });
  async function exportCsv() {
    setExporting(true);
    setExportError("");
    const controller = new AbortController();
    exportController.current = controller;
    try {
      await downloadAnalyticsCsv(
        { ...params, page: undefined, pageSize: undefined },
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Daily Sales & Purchase Report
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Every matching purchase is available through pagination. Totals cover the complete
          filtered result.
        </Typography>
      </Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          size="small"
          label="Search customer name or phone"
          value={settings.search}
          onChange={(event) => update({ search: event.target.value })}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          size="small"
          label="Sort by"
          value={settings.sort}
          onChange={(event) => update({ sort: event.target.value as SalesTableSettings["sort"] })}
          sx={{ minWidth: { xs: 0, sm: 180 }, width: { xs: "100%", sm: "auto" } }}
        >
          <MenuItem value="date">Purchase date</MenuItem>
          <MenuItem value="customer">Customer name</MenuItem>
          <MenuItem value="amount">Purchase amount</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Order"
          value={settings.direction}
          onChange={(event) => update({ direction: event.target.value as "asc" | "desc" })}
          sx={{ minWidth: { xs: 0, sm: 150 }, width: { xs: "100%", sm: "auto" } }}
        >
          <MenuItem value="asc">Ascending</MenuItem>
          <MenuItem value="desc">Descending</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          startIcon={<DownloadOutlined />}
          onClick={exportCsv}
          disabled={exporting || !data || settings.search.trim() !== search}
        >
          {exporting ? "Exporting…" : "Export all matches"}
        </Button>
      </Stack>
      {exportError && (
        <Alert severity="error" onClose={() => setExportError("")}>
          {exportError}
        </Alert>
      )}
      <ReportState {...report} />
      {data && (
        <>
          <ReportNote {...data} />
          <SummaryCards summary={data.summary} />
          <Grid container spacing={2}>
            {[
              ["Highest Purchase Value", analyticsMoney(data.summary.highest)],
              ["Frame-Containing Purchases", analyticsCount(data.summary.frames)],
              ["Lens-Containing Purchases", analyticsCount(data.summary.lenses)],
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 12, md: 4 }}>
                <Kpi label={label} value={value} />
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
            <Typography variant="body2">
              Frame Only: <strong>{data.summary.frameOnly}</strong>
            </Typography>
            <Typography variant="body2">
              Lens Only: <strong>{data.summary.lensOnly}</strong>
            </Typography>
            <Typography variant="body2">
              Frame + Lens: <strong>{data.summary.both}</strong>
            </Typography>
            <Typography variant="body2">
              Unclassified: <strong>{data.summary.unclassified}</strong>
            </Typography>
          </Stack>
          <ChartCard
            title="Matching purchases"
            detail={`${analyticsCount(data.total)} matches · ${data.period.label}`}
          >
            {!data.total ? (
              <Alert severity="info">
                No purchases match this date and search. Try another date or clear the search.
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Filtered purchase details">
                  <TableHead>
                    <TableRow>
                      {[
                        "Purchase Date",
                        "Customer",
                        "Mobile",
                        "Frame Details",
                        "Lens Details",
                        "Pricing Mode",
                        "Frame Rate",
                        "Lens Rate",
                        "Total MRP",
                        "Details",
                      ].map((label) => (
                        <TableCell key={label} sx={{ whiteSpace: "nowrap" }}>
                          {label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {row.purchaseDate ?? "Not recorded"}
                        </TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{row.mobile || "—"}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{row.frame || "Not recorded"}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>{row.lens || "Not recorded"}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {row.pricingMode === "SPLIT" ? "Split prices" : "Total MRP only"}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {row.frameRate === null ? "—" : analyticsMoney(row.frameRate)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {row.lensRate === null ? "—" : analyticsMoney(row.lensRate)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                          {analyticsMoney(row.mrp)}
                        </TableCell>
                        <TableCell>
                          <Button
                            component={Link}
                            to={`/customers/${row.customerId}?record=${row.id}`}
                            size="small"
                            startIcon={<OpenInNewOutlined />}
                            sx={{ whiteSpace: "nowrap" }}
                          >
                            View Customer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <TablePagination
              component="div"
              count={data.total}
              page={settings.page}
              rowsPerPage={settings.pageSize}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={(_, page) => update({ page })}
              onRowsPerPageChange={(event) => update({ pageSize: Number(event.target.value) })}
              sx={{
                ".MuiTablePagination-toolbar": { flexWrap: "wrap", justifyContent: "flex-end" },
              }}
            />
          </ChartCard>
        </>
      )}
    </Stack>
  );
}

export function PeriodComparison({
  filters,
  comparison,
  onChange,
}: {
  filters: Filters;
  comparison: Filters;
  onChange: (value: Filters) => void;
}) {
  const other = reportParams(comparison);
  const params = reportParams(filters, {
    comparePeriod: comparison.period,
    compareDate: other.date,
    compareFrom: other.from,
    compareTo: other.to,
    compareMonth: other.month,
    compareYear: other.year,
  });
  const report = useAnalyticsQuery<AnalyticsComparison>(analyticsUrl("comparison", params));
  const data = report.data;
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Period Comparison
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Compare the reporting period above with another month, year, date or custom range. Both
          inclusive ranges are shown explicitly.
        </Typography>
      </Box>
      <AnalyticsFilters
        title="Comparison period"
        value={comparison}
        onChange={onChange}
        reset={false}
      />
      <Button
        sx={{ alignSelf: "flex-start" }}
        onClick={() => onChange({ ...defaultAnalyticsFilters(), period: "lastMonth" })}
      >
        Compare with last month
      </Button>
      <ReportState {...report} />
      {data && (
        <>
          <ReportNote {...data} />
          <Grid container spacing={2}>
            {[
              [
                "Purchase Value Difference",
                analyticsMoney(data.change.value),
                "Selected period minus comparison period",
              ],
              [
                "Percentage Change",
                data.change.percent === null
                  ? "N/A"
                  : `${data.change.percent >= 0 ? "+" : ""}${data.change.percent.toFixed(1)}%`,
                data.change.percent === null
                  ? "Comparison value is zero; percentage is undefined"
                  : "Relative to the comparison period",
              ],
              [
                "Purchase Count Difference",
                `${data.change.purchases >= 0 ? "+" : ""}${data.change.purchases}`,
                "Difference across all matching purchases",
              ],
              [
                "Average Value Difference",
                analyticsMoney(data.change.average),
                "Average purchase value, not average payment",
              ],
            ].map(([label, value, detail]) => (
              <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Kpi label={label} value={value} detail={detail} />
              </Grid>
            ))}
          </Grid>
          <ChartCard
            title="Period totals"
            detail="Different-length ranges are allowed; compare their displayed dates before interpreting growth."
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Purchases</TableCell>
                    <TableCell align="right">Recorded Value</TableCell>
                    <TableCell align="right">Average Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    [data.period, data.summary],
                    [data.comparison.period, data.comparison.summary],
                  ].map(([period, summary], index) => {
                    const p = period as AnalyticsComparison["period"],
                      s = summary as AnalyticsComparison["summary"];
                    return (
                      <TableRow key={index}>
                        <TableCell>
                          {index === 0 ? "Selected" : "Comparison"}: {p.label}
                        </TableCell>
                        <TableCell align="right">{analyticsCount(s.purchases)}</TableCell>
                        <TableCell align="right">{analyticsMoney(s.value)}</TableCell>
                        <TableCell align="right">{analyticsMoney(s.average)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </ChartCard>
        </>
      )}
    </Stack>
  );
}
