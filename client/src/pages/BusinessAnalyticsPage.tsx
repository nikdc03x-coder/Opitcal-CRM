import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import LensOutlined from "@mui/icons-material/LensOutlined";
import PeopleOutline from "@mui/icons-material/PeopleOutlineOutlined";
import DonutSmallOutlined from "@mui/icons-material/DonutSmallOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import CalendarMonthOutlined from "@mui/icons-material/CalendarMonthOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import TableRowsOutlined from "@mui/icons-material/TableRowsOutlined";
import type { AnalyticsFilters as Filters, AnalyticsSection } from "../models/analytics";
import { defaultAnalyticsFilters, defaultExplorer, defaultSalesTable } from "../utils/analytics";
import { AnalyticsDataProvider } from "../components/analytics/AnalyticsData";
import AnalyticsFilters from "../components/analytics/AnalyticsFilters";
import {
  AnalyticsOverview,
  CustomerAnalytics,
  ProductAnalytics,
  PurchaseMixAnalytics,
} from "../components/analytics/AnalyticsSections";
import HistoricalSalesExplorer from "../components/analytics/HistoricalSalesExplorer";
import { DailySalesReport, PeriodComparison } from "../components/analytics/SalesReports";
import type { SalesTableSettings } from "../components/analytics/SalesReports";
import { useAnalyticsRefresh } from "../components/analytics/reportStore";

// nik - Keep report navigation simple: one horizontal menu instead of multiple dashboards.
const sections = [
  { key: "overview", label: "Overview", icon: <InsightsOutlined fontSize="small" /> },
  { key: "sales", label: "Sales", icon: <ShowChartOutlined fontSize="small" /> },
  { key: "frames", label: "Frames", icon: <VisibilityOutlined fontSize="small" /> },
  { key: "lenses", label: "Lenses", icon: <LensOutlined fontSize="small" /> },
  { key: "customers", label: "Customers", icon: <PeopleOutline fontSize="small" /> },
  { key: "mix", label: "Purchase Mix", icon: <DonutSmallOutlined fontSize="small" /> },
] as const;

type SalesView = "explorer" | "daily" | "comparison";

const salesViews = [
  { key: "explorer", label: "History", icon: <CalendarMonthOutlined fontSize="small" /> },
  { key: "daily", label: "Transactions", icon: <TableRowsOutlined fontSize="small" /> },
  { key: "comparison", label: "Compare periods", icon: <CompareArrowsOutlined fontSize="small" /> },
] as const;

function AnalyticsWorkspace() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const refresh = useAnalyticsRefresh();

  const [section, setSection] = useState<AnalyticsSection>("overview");
  const [salesView, setSalesView] = useState<SalesView>("explorer");
  const [filters, setFilters] = useState<Filters>(defaultAnalyticsFilters);
  const [comparison, setComparison] = useState<Filters>(() => ({
    ...defaultAnalyticsFilters(),
    period: "lastMonth",
  }));
  const [explorer, setExplorer] = useState(defaultExplorer);
  const [table, setTable] = useState<SalesTableSettings>(defaultSalesTable);

  const filtersAvailable = !(section === "sales" && salesView === "explorer");
  const heading = useMemo(
    () => sections.find((item) => item.key === section)?.label ?? "Analytics",
    [section],
  );

  // nik - Reset only the table page when the date or customer filters change.
  const updateFilters = (next: Filters) => {
    setFilters(next);
    setTable((previous) => ({ ...previous, page: 0 }));
  };

  const navigate = (next: AnalyticsSection, view?: string) => {
    setSection(next);
    if (view === "explorer" || view === "daily" || view === "comparison") {
      setSalesView(view);
    }
  };

  // nik - Keep the old drill-down behavior so clicking a report leads to its transactions.
  const drill = (changes: Partial<Filters>) => {
    updateFilters({ ...filters, ...changes });
    setSection("sales");
    setSalesView("daily");
    setTable((previous) => ({ ...previous, page: 0, search: "" }));
  };

  return (
    <Box
      sx={{ width: "100%", maxWidth: 1440, mx: "auto", px: { xs: 0, sm: 0.5 }, pb: 5, minWidth: 0 }}
    >
      {/* A compact page header, without a giant title card. */}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          pt: { xs: 2, md: 3 },
          pb: 2.5,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "1.75rem" },
              fontWeight: 780,
              letterSpacing: "-0.035em",
            }}
          >
            Business analytics
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Understand performance. Explore your customers and products.
          </Typography>
        </Box>
        <Tooltip title="Refresh report data">
          <IconButton
            onClick={refresh}
            aria-label="Refresh analytics"
            sx={{ border: 1, borderColor: "divider" }}
          >
            <RefreshOutlined />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* The only primary navigation bar. Horizontal scrolling works on mobile. */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: { xs: 2.5, md: 3 } }}>
        <Tabs
          value={section}
          onChange={(_, next: AnalyticsSection) => setSection(next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Analytics reports"
          sx={{ minHeight: 44, "& .MuiTabs-indicator": { height: 3, borderRadius: 3 } }}
        >
          {sections.map((item) => (
            <Tab
              key={item.key}
              id={`report-tab-${item.key}`}
              aria-controls={`report-panel-${item.key}`}
              value={item.key}
              label={item.label}
              icon={isMobile ? undefined : item.icon}
              iconPosition="start"
              sx={{
                minHeight: 44,
                minWidth: "auto",
                px: { xs: 1.75, md: 2.3 },
                mr: 0.75,
                textTransform: "none",
                fontWeight: 650,
                fontSize: "0.88rem",
              }}
            />
          ))}
        </Tabs>
      </Box>

      <Box
        role="tabpanel"
        id={`report-panel-${section}`}
        aria-labelledby={`report-tab-${section}`}
        sx={{ minWidth: 0 }}
      >
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          {/* Secondary views appear only inside Sales, never on every report. */}
          {section === "sales" && (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              aria-label="Sales views"
              sx={{ flexWrap: "wrap" }}
            >
              {salesViews.map((item) => (
                <Button
                  key={item.key}
                  variant={salesView === item.key ? "contained" : "outlined"}
                  color={salesView === item.key ? "primary" : "inherit"}
                  size="small"
                  startIcon={item.icon}
                  onClick={() => setSalesView(item.key)}
                  aria-pressed={salesView === item.key}
                  sx={{ borderRadius: 2, textTransform: "none", boxShadow: "none", py: 0.85 }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          )}

          {filtersAvailable && (
            <AnalyticsFilters
              value={filters}
              onChange={updateFilters}
              title={`${heading} · reporting period`}
            />
          )}

          {/* Reports remain unchanged internally, keeping the real data and drill actions. */}
          {section === "overview" && (
            <AnalyticsOverview filters={filters} navigate={navigate} drill={drill} />
          )}
          {section === "sales" && salesView === "explorer" && (
            <HistoricalSalesExplorer
              settings={explorer}
              onChange={setExplorer}
              onDrill={(from, to) =>
                drill({ ...defaultAnalyticsFilters(), period: "custom", from, to })
              }
            />
          )}
          {section === "sales" && salesView === "daily" && (
            <DailySalesReport filters={filters} settings={table} onChange={setTable} />
          )}
          {section === "sales" && salesView === "comparison" && (
            <PeriodComparison filters={filters} comparison={comparison} onChange={setComparison} />
          )}
          {(section === "frames" || section === "lenses") && (
            <ProductAnalytics
              key={section}
              kind={section}
              filters={filters}
              onChange={updateFilters}
              drill={drill}
            />
          )}
          {section === "customers" && <CustomerAnalytics filters={filters} />}
          {section === "mix" && <PurchaseMixAnalytics filters={filters} drill={drill} />}
        </Stack>
      </Box>
    </Box>
  );
}

export default function BusinessAnalyticsPage() {
  return (
    <AnalyticsDataProvider>
      <AnalyticsWorkspace />
    </AnalyticsDataProvider>
  );
}
