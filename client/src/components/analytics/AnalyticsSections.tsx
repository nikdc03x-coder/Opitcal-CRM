import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import type {
  AnalyticsCustomers as Customers,
  AnalyticsFilters,
  AnalyticsMix as Mix,
  AnalyticsOverview as Overview,
  AnalyticsProducts as Products,
  AnalyticsRank,
  AnalyticsSection,
} from "../../models/analytics";
import { analyticsUrl } from "../../services/analyticsApi";
import { analyticsCount, analyticsMoney, reportParams } from "../../utils/analytics";
import { useAnalyticsQuery } from "./reportStore";
import {
  ChartCard,
  CountBars,
  DistributionChart,
  Kpi,
  Ranking,
  ReportNote,
  ReportState,
  SummaryCards,
  TrendChart,
} from "./AnalyticsUi";

export type AnalyticsDrill = (changes: Partial<AnalyticsFilters>) => void;
export function AnalyticsOverview({
  filters,
  navigate,
  drill,
}: {
  filters: AnalyticsFilters;
  navigate: (section: AnalyticsSection, salesView?: string) => void;
  drill: AnalyticsDrill;
}) {
  const report = useAnalyticsQuery<Overview>(analyticsUrl("overview", reportParams(filters)));
  const data = report.data;
  const [metric, setMetric] = useState<"value" | "purchases">("value");
  const [product, setProduct] = useState<"frames" | "lenses">("frames");
  if (!data) return <ReportState {...report} />;
  const change = data.previous?.change.percent;
  return (
    <Stack spacing={2.5}>
      <SummaryCards summary={data.summary} />
      <ReportNote {...data} />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard
            title={metric === "value" ? "Purchase value over time" : "Purchases over time"}
            detail="Based on recorded purchase dates. Select a point to view the transactions."
            action={
              <ToggleButtonGroup
                exclusive
                size="small"
                value={metric}
                aria-label="Trend metric"
                onChange={(_, next) => {
                  if (next) setMetric(next);
                }}
              >
                <ToggleButton value="value">Value ₹</ToggleButton>
                <ToggleButton value="purchases">Purchases</ToggleButton>
              </ToggleButtonGroup>
            }
          >
            <TrendChart
              points={data.trend}
              metric={metric}
              onDrill={(from, to) => drill({ period: "custom", from, to })}
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                justifyContent: "space-between",
                alignItems: { sm: "center" },
                borderTop: 1,
                borderColor: "divider",
                pt: 1.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {change == null
                    ? "Comparison unavailable"
                    : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% purchase value`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.previous
                    ? `vs ${data.previous.period.label} · equal-length prior period`
                    : "Choose a dated period to compare performance"}
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardOutlined />}
                onClick={() => navigate("sales", "comparison")}
              >
                Compare periods
              </Button>
            </Stack>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard
            title="What customers are buying"
            detail="Share of purchases by product category."
          >
            <DistributionChart rows={data.mix} onDrill={(row) => drill({ mix: row.name })} />
          </ChartCard>
        </Grid>
      </Grid>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
            {analyticsCount(data.activeCustomers)}
          </Box>{" "}
          active customer profiles, all time
          {" · "}
          {analyticsCount(data.summary.frames)} purchases with frames ·{" "}
          {analyticsCount(data.summary.lenses)} with lenses in this period
        </Typography>
        <Button
          size="small"
          onClick={() => navigate("customers")}
          endIcon={<ArrowForwardOutlined />}
        >
          Customer insights
        </Button>
      </Stack>
      <ChartCard
        title="Product insights"
        detail="Most frequently purchased descriptions. Select a product to inspect its purchases."
        action={
          <ToggleButtonGroup
            exclusive
            size="small"
            value={product}
            aria-label="Product insights"
            onChange={(_, next) => {
              if (next) setProduct(next);
            }}
          >
            <ToggleButton value="frames">Frames</ToggleButton>
            <ToggleButton value="lenses">Lenses</ToggleButton>
          </ToggleButtonGroup>
        }
      >
        <Ranking
          rows={data[product]}
          onDrill={(row) => drill(product === "frames" ? { frame: row.name } : { lens: row.name })}
        />
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 1.5 }}
        >
          <Button size="small" onClick={() => navigate(product)} endIcon={<ArrowForwardOutlined />}>
            Explore {product}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => navigate("sales", "explorer")}>
              Sales history
            </Button>
            <Button size="small" onClick={() => navigate("sales", "daily")}>
              View transactions
            </Button>
          </Stack>
        </Stack>
      </ChartCard>
    </Stack>
  );
}

const dimensionFilters: Record<string, keyof AnalyticsFilters> = {
  brand: "brand",
  model: "model",
  style: "style",
  frame: "frame",
  company: "company",
  name: "lensName",
  vision: "vision",
  coating: "coating",
  lens: "lens",
};
const dimensionLabels: Record<string, string> = {
  brand: "Frame Brands",
  model: "Frame Models",
  style: "Frame Styles",
  frame: "Saved Frame Descriptions",
  company: "Lens Companies",
  name: "Lens Names",
  vision: "Vision Types",
  coating: "Coatings",
  lens: "Saved Lens Descriptions",
};
export function ProductAnalytics({
  kind,
  filters,
  onChange,
  drill,
}: {
  kind: "frames" | "lenses";
  filters: AnalyticsFilters;
  onChange: (value: AnalyticsFilters) => void;
  drill: AnalyticsDrill;
}) {
  const report = useAnalyticsQuery<Products>(analyticsUrl(kind, reportParams(filters)));
  const data = report.data;
  const [dimension, setDimension] = useState(kind === "frames" ? "brand" : "company");
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {kind === "frames" ? "Frame Analytics" : "Lens Analytics"}
        </Typography>
        <Typography color="text.secondary">
          Explore product trends and rankings. Unknown categories have no recorded catalog
          information.
        </Typography>
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap", gap: 1 }}>
        {(kind === "frames" ? ["brand", "style"] : ["company", "vision"]).map((key) => (
          <TextField
            key={key}
            select
            size="small"
            label={dimensionLabels[key]}
            value={filters[key as keyof AnalyticsFilters] ?? ""}
            onChange={(event) => onChange({ ...filters, [key]: event.target.value || undefined })}
            sx={{ minWidth: { xs: 0, sm: 190 }, width: { xs: "100%", sm: "auto" } }}
          >
            <MenuItem value="">All</MenuItem>
            {[
              ...new Set([
                ...(data?.options[key] ?? []),
                ...(filters[key as keyof AnalyticsFilters]
                  ? [filters[key as keyof AnalyticsFilters]!]
                  : []),
              ]),
            ].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        ))}
        <TextField
          select
          size="small"
          label="Rankings"
          value={filters.top ?? "5"}
          onChange={(event) => onChange({ ...filters, top: event.target.value })}
          sx={{ minWidth: { xs: 0, sm: 130 }, width: { xs: "100%", sm: "auto" } }}
        >
          <MenuItem value="5">Top 5</MenuItem>
          <MenuItem value="10">Top 10</MenuItem>
        </TextField>
      </Stack>
      <ReportState {...report} />
      {data && (
        <>
          <ReportNote {...data} />
          <Grid container spacing={2}>
            {[
              [
                `Purchases Containing ${kind === "frames" ? "Frames" : "Lenses"}`,
                analyticsCount(data.containing),
                "Purchase records, not exact units",
              ],
              [
                kind === "frames" ? "Frame Only" : "Lens Only",
                analyticsCount(kind === "frames" ? data.summary.frameOnly : data.summary.lensOnly),
                "Matching purchase classification",
              ],
              ["Frame + Lens", analyticsCount(data.summary.both), "Purchases containing both"],
              [
                "Recorded Split Price Value",
                analyticsMoney(data.splitValue),
                `${data.totalOnly} total-MRP purchases have no separate product value`,
              ],
            ].map(([label, value, detail]) => (
              <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Kpi label={label} value={value} detail={detail} />
              </Grid>
            ))}
          </Grid>
          {kind === "lenses" && (
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
              {["Progressive", "Single Vision", "Bifocal"].map((name) => (
                <Button
                  key={name}
                  variant={filters.vision === name ? "contained" : "outlined"}
                  onClick={() =>
                    onChange({ ...filters, vision: filters.vision === name ? undefined : name })
                  }
                >
                  {name}: {analyticsCount(data.visionCounts[name] ?? 0)} purchases
                </Button>
              ))}
            </Stack>
          )}
          <ChartCard
            title={`${kind === "frames" ? "Frame" : "Lens"} Purchase Trend`}
            detail="Counts of product-containing purchases; click a point to inspect the period."
          >
            <TrendChart
              points={data.trend}
              metric="purchases"
              onDrill={(from, to) => drill({ period: "custom", from, to })}
            />
          </ChartCard>
          <ChartCard
            title="Product Rankings"
            detail="Share uses all product-containing purchases in the filtered set, including categories outside the displayed top list."
          >
            <TextField
              select
              size="small"
              label="Group by"
              value={dimension}
              onChange={(event) => setDimension(event.target.value)}
              sx={{ minWidth: { xs: 0, sm: 230 }, width: { xs: "100%", sm: "auto" }, my: 2 }}
            >
              {Object.keys(data.rankings).map((key) => (
                <MenuItem key={key} value={key}>
                  {dimensionLabels[key]}
                </MenuItem>
              ))}
            </TextField>
            <Ranking
              rows={data.rankings[dimension] ?? []}
              onDrill={(row) => drill({ [dimensionFilters[dimension]]: row.name })}
            />
          </ChartCard>
        </>
      )}
    </Stack>
  );
}

export function CustomerAnalytics({ filters }: { filters: AnalyticsFilters }) {
  const [insight, setInsight] = useState<"demographics" | "behavior">("demographics");
  const report = useAnalyticsQuery<Customers>(analyticsUrl("customers", reportParams(filters)));
  const [denominator, setDenominator] = useState<"registered" | "purchasing" | "purchases">(
    "registered",
  );
  const data = report.data;
  if (!data) return <ReportState {...report} />;
  const asRanks = (rows: Customers["ages"]): AnalyticsRank[] =>
    rows.map((row) => ({ name: row.name, purchases: row.count, share: row.share }));
  return (
    <Stack spacing={2.5}>
      <ReportNote {...data} />
      <Grid container spacing={2}>
        {[
          ["Total Registered Customers", data.registered, "Active registered profiles · all time"],
          ["Active Customer Profiles", data.active, "Current active profiles, all periods"],
          [
            "New Registrations",
            data.newRegistrations,
            "Registered during selected calendar period",
          ],
          [
            "Distinct Purchasing Customers",
            data.summary.customers,
            "Matching purchases · unique customer IDs",
          ],
          ["Repeat Customers", data.repeat, "At least two purchases in selected period"],
          [
            "Average purchase",
            analyticsMoney(data.summary.average),
            "Recorded purchase value per matching purchase",
          ],
        ].map(([label, value, detail]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Kpi
              label={String(label)}
              value={typeof value === "string" ? value : analyticsCount(Number(value))}
              detail={String(detail)}
            />
          </Grid>
        ))}
      </Grid>
      <Tabs
        value={insight}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        onChange={(_, next) => setInsight(next)}
        aria-label="Customer insights"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab
          value="demographics"
          label="Customer demographics"
          id="customer-demographics-tab"
          aria-controls="customer-demographics-panel"
        />
        <Tab
          value="behavior"
          label="Buying behavior"
          id="customer-behavior-tab"
          aria-controls="customer-behavior-panel"
        />
      </Tabs>
      {insight === "demographics" && (
        <Grid
          container
          spacing={2}
          role="tabpanel"
          id="customer-demographics-panel"
          aria-labelledby="customer-demographics-tab"
        >
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard
              title="Gender Distribution"
              detail="Choose the denominator explicitly; profiles and purchase counts describe different populations."
            >
              <TextField
                select
                fullWidth
                size="small"
                label="Population"
                value={denominator}
                onChange={(event) => setDenominator(event.target.value as typeof denominator)}
                sx={{ my: 2 }}
              >
                <MenuItem value="registered">All registered customers · all time</MenuItem>
                <MenuItem value="purchasing">
                  Distinct purchasing customers · selected period
                </MenuItem>
                <MenuItem value="purchases">Purchases · selected period</MenuItem>
              </TextField>
              <DistributionChart
                rows={asRanks(data.gender[denominator])}
                countLabel={denominator === "purchases" ? "purchases" : "customers"}
              />
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard
              title="Recorded Age Distribution"
              detail="All registered profiles · age at recording, not age at historical purchase."
            >
              <Alert severity="info" sx={{ my: 2 }}>
                {data.ageCoverage.toFixed(1)}% age coverage · {analyticsCount(data.missingAge)}{" "}
                profiles have no recorded age.
                {data.ageCoverage === 0
                  ? " Age analysis will become available as staff record optional ages."
                  : " Recorded ages are not automatically advanced over time."}
              </Alert>
              <Ranking rows={asRanks(data.ages)} countLabel="Profiles" />
            </ChartCard>
          </Grid>
        </Grid>
      )}
      {insight === "behavior" && (
        <Stack
          spacing={2.5}
          role="tabpanel"
          id="customer-behavior-panel"
          aria-labelledby="customer-behavior-tab"
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard
                title="Customer Registrations"
                detail="Registration month in Asia/Kolkata."
              >
                <CountBars
                  rows={data.registrations.map((row) => ({ ...row }))}
                  series={[{ key: "count", label: "New registrations" }]}
                />
              </ChartCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <ChartCard
                title="Purchasing Customer Activity"
                detail="Repeat customers have at least two purchases within that calendar month."
              >
                <CountBars
                  rows={data.activity.map((row) => ({ ...row }))}
                  series={[
                    { key: "customers", label: "Purchasing customers" },
                    { key: "repeat", label: "Repeat customers" },
                  ]}
                />
              </ChartCard>
            </Grid>
          </Grid>
          <ChartCard
            title="Purchases per Customer"
            detail="Frequency in the selected reporting period; shared mobile numbers never merge customers."
          >
            <Ranking
              rows={asRanks(data.frequency).map((row) => ({
                ...row,
                name: `${row.name} purchase${row.name === "1" ? "" : "s"}`,
              }))}
              countLabel="Customers"
            />
          </ChartCard>
        </Stack>
      )}
    </Stack>
  );
}

export function PurchaseMixAnalytics({
  filters,
  drill,
}: {
  filters: AnalyticsFilters;
  drill: AnalyticsDrill;
}) {
  const report = useAnalyticsQuery<Mix>(analyticsUrl("mix", reportParams(filters)));
  const data = report.data;
  if (!data) return <ReportState {...report} />;
  return (
    <Stack spacing={2.5}>
      <ReportNote {...data} />
      <SummaryCards summary={data.summary} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard
            title="Purchase Mix Distribution"
            detail="Select a category to open its purchase report."
          >
            <DistributionChart rows={data.mix} onDrill={(row) => drill({ mix: row.name })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard
            title="Month-by-Month Purchase Mix"
            detail="Counts of saved purchases; no quantities are inferred."
          >
            <CountBars
              rows={data.trend.map((row) => ({ ...row }))}
              series={[
                { key: "frameOnly", label: "Frame Only" },
                { key: "lensOnly", label: "Lens Only" },
                { key: "both", label: "Frame + Lens" },
                { key: "unclassified", label: "Unclassified" },
              ]}
            />
          </ChartCard>
        </Grid>
      </Grid>
      <ChartCard
        title="Popular Frame + Lens Combinations"
        detail="Saved descriptions are used; a total MRP alone never implies a frame/lens combination."
      >
        <Ranking
          rows={data.combinations}
          onDrill={(row) => drill({ frame: row.frame, lens: row.lens, mix: "Frame + Lens" })}
        />
      </ChartCard>
    </Stack>
  );
}
