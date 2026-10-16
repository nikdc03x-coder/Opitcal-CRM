import { useAnalyticsRefresh } from "../components/analytics/reportStore";
import { useState } from "react";
import { Box, Button, Card, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import InsightsOutlined from "@mui/icons-material/InsightsOutlined";
import ShowChartOutlined from "@mui/icons-material/ShowChartOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import LensOutlined from "@mui/icons-material/LensOutlined";
import PeopleOutline from "@mui/icons-material/PeopleOutlineOutlined";
import DonutSmallOutlined from "@mui/icons-material/DonutSmallOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
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

const sections = [
  {
    key: "overview",
    label: "Overview",
    icon: <InsightsOutlined />,
    detail: "A focused view of recorded business performance.",
  },
  {
    key: "sales",
    label: "Sales",
    icon: <ShowChartOutlined />,
    detail: "Explore historical years, inspect calendar-date sales, and compare periods.",
  },
  {
    key: "frames",
    label: "Frames",
    icon: <VisibilityOutlined />,
    detail: "Frame purchase patterns, saved products, brands and styles.",
  },
  {
    key: "lenses",
    label: "Lenses",
    icon: <LensOutlined />,
    detail: "Lens companies, vision types, coatings and purchase trends.",
  },
  {
    key: "customers",
    label: "Customers",
    icon: <PeopleOutline />,
    detail: "Customer profiles, purchasing behavior, gender and recorded-age coverage.",
  },
  {
    key: "mix",
    label: "Purchase Mix",
    icon: <DonutSmallOutlined />,
    detail: "Frame-only, lens-only, combined and unclassified purchases.",
  },
] as const;

function AnalyticsWorkspace() {
  const [section, setSection] = useState<AnalyticsSection>("overview");
  const [salesView, setSalesView] = useState("explorer");
  const [filters, setFilters] = useState(defaultAnalyticsFilters);
  const [comparison, setComparison] = useState<Filters>(() => ({
    ...defaultAnalyticsFilters(),
    period: "lastMonth",
  }));
  const [explorer, setExplorer] = useState(defaultExplorer);
  const [table, setTable] = useState<SalesTableSettings>(defaultSalesTable);
  const refresh = useAnalyticsRefresh();
  const active = sections.find((item) => item.key === section)!;
  const filter = (next: Filters) => {
    setFilters(next);
    setTable((previous) => ({ ...previous, page: 0 }));
  };
  const navigate = (next: AnalyticsSection, view?: string) => {
    setSection(next);
    if (view) setSalesView(view);
  };
  const drill = (changes: Partial<Filters>) => {
    filter({ ...filters, ...changes });
    setSection("sales");
    setSalesView("daily");
    setTable((previous) => ({ ...previous, page: 0, search: "" }));
  };
  // nik - Mount only the active report; filters and explorer selections live above tab unmounts.
  return (
    <Box sx={{ maxWidth: 1500, mx: "auto", pb: 5, minWidth: 0 }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
              <InsightsOutlined color="primary" />
              <Chip size="small" label="Optical Retail Business Intelligence" variant="outlined" />
            </Stack>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.03em",
                fontSize: { xs: "1.75rem", md: "2.125rem" },
              }}
            >
              OptiLens Intelligence
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Business performance, product insights, and customer analytics.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={refresh}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, whiteSpace: "nowrap" }}
          >
            Refresh Reports
          </Button>
        </Stack>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Tabs
            value={section}
            onChange={(_, value) => setSection(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Business analytics sections"
          >
            {sections.map((item) => (
              <Tab
                key={item.key}
                id={`analytics-tab-${item.key}`}
                aria-controls={`analytics-panel-${item.key}`}
                icon={item.icon}
                iconPosition="start"
                value={item.key}
                label={item.label}
                sx={{ minHeight: 64, textTransform: "none", fontWeight: 700 }}
              />
            ))}
          </Tabs>
        </Card>
        <Box
          role="tabpanel"
          id={`analytics-panel-${section}`}
          aria-labelledby={`analytics-tab-${section}`}
        >
          <Stack spacing={3}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 750 }}>
                {active.label}
              </Typography>
              <Typography color="text.secondary">{active.detail}</Typography>
            </Box>
            {section === "sales" && (
              <Tabs
                value={salesView}
                onChange={(_, value) => setSalesView(value)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Sales report views"
              >
                <Tab value="explorer" label="Historical Explorer" sx={{ textTransform: "none" }} />
                <Tab value="daily" label="Daily Sales Report" sx={{ textTransform: "none" }} />
                <Tab value="comparison" label="Period Comparison" sx={{ textTransform: "none" }} />
              </Tabs>
            )}
            {!(section === "sales" && salesView === "explorer") && (
              <AnalyticsFilters value={filters} onChange={filter} />
            )}
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
              <PeriodComparison
                filters={filters}
                comparison={comparison}
                onChange={setComparison}
              />
            )}
            {(section === "frames" || section === "lenses") && (
              <ProductAnalytics
                key={section}
                kind={section}
                filters={filters}
                onChange={filter}
                drill={drill}
              />
            )}
            {section === "customers" && <CustomerAnalytics filters={filters} />}
            {section === "mix" && <PurchaseMixAnalytics filters={filters} drill={drill} />}
          </Stack>
        </Box>
      </Stack>
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
