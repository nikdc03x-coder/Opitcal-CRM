import { useState } from "react";
import { Alert, Box, Button, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
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
  if (!data) return <ReportState {...report} />;
  return (
    <Stack spacing={3}>
      <ReportNote {...data} />
      <SummaryCards summary={data.summary} activeCustomers={data.activeCustomers} />
      <Grid container spacing={2}>
        {[
          [
            "Purchases Containing Frames",
            analyticsCount(data.summary.frames),
            "Purchase records, not physical units",
          ],
          [
            "Purchases Containing Lenses",
            analyticsCount(data.summary.lenses),
            "Purchase records, not physical units",
          ],
          [
            "Previous Period Change",
            data.previous?.change.percent == null
              ? "N/A"
              : `${data.previous.change.percent >= 0 ? "+" : ""}${data.previous.change.percent.toFixed(1)}%`,
            data.previous
              ? `Equal-length prior period: ${data.previous.period.label}`
              : "Choose a dated period to compare",
          ],
        ].map(([label, value, detail]) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Kpi label={label} value={value} detail={detail} />
          </Grid>
        ))}
      </Grid>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {[
          ["sales", "Historical Sales Explorer", "explorer"],
          ["sales", "View Daily Sales", "daily"],
          ["frames", "View Frame Analytics"],
          ["lenses", "View Lens Analytics"],
        ].map(([tab, label, view]) => (
          <Button
            key={label}
            variant="outlined"
            endIcon={<ArrowForwardOutlined />}
            onClick={() => navigate(tab as AnalyticsSection, view)}
          >
            {label}
          </Button>
        ))}
      </Stack>
      <ChartCard
        title="Recorded Purchase Value"
        detail="Click a point to inspect the matching day or month."
      >
        <TrendChart
          points={data.trend}
          onDrill={(from, to) => drill({ period: "custom", from, to })}
        />
      </ChartCard>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Purchases over time">
            <TrendChart
              points={data.trend}
              metric="purchases"
              onDrill={(from, to) => drill({ period: "custom", from, to })}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard
            title="Purchase mix"
            detail="Reliable saved descriptions and same-shop catalog links."
          >
            <DistributionChart rows={data.mix} onDrill={(row) => drill({ mix: row.name })} />
          </ChartCard>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Frequent Frames"
            detail="Saved purchase descriptions · select to inspect purchases."
          >
            <Ranking rows={data.frames} onDrill={(row) => drill({ frame: row.name })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Frequent Lenses"
            detail="Saved purchase descriptions · select to inspect purchases."
          >
            <Ranking rows={data.lenses} onDrill={(row) => drill({ lens: row.name })} />
          </ChartCard>
        </Grid>
      </Grid>
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
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 750 }}>
          {kind === "frames" ? "Frame Analytics" : "Lens Analytics"}
        </Typography>
        <Typography color="text.secondary">
          Purchase frequency, verified catalog attributes and saved descriptions. Unknown means no
          reliable attribute is recorded.
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
            sx={{ minWidth: 190 }}
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
          sx={{ minWidth: 130 }}
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
              sx={{ minWidth: 230, my: 2 }}
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
          <Grid container spacing={2}>
            {Object.entries(data.rankings)
              .filter(([key]) => key !== dimension)
              .map(([key, rows]) => (
                <Grid key={key} size={{ xs: 12, md: 6 }}>
                  <ChartCard title={dimensionLabels[key]}>
                    <Ranking
                      rows={rows}
                      onDrill={(row) => drill({ [dimensionFilters[key]]: row.name })}
                    />
                  </ChartCard>
                </Grid>
              ))}
          </Grid>
        </>
      )}
    </Stack>
  );
}

export function CustomerAnalytics({ filters }: { filters: AnalyticsFilters }) {
  const report = useAnalyticsQuery<Customers>(analyticsUrl("customers", reportParams(filters)));
  const [denominator, setDenominator] = useState<"registered" | "purchasing" | "purchases">(
    "registered",
  );
  const data = report.data;
  if (!data) return <ReportState {...report} />;
  const asRanks = (rows: Customers["ages"]): AnalyticsRank[] =>
    rows.map((row) => ({ name: row.name, purchases: row.count, share: row.share }));
  return (
    <Stack spacing={3}>
      <ReportNote {...data} />
      <Grid container spacing={2}>
        {[
          ["Total Registered Customers", data.registered, "All profiles, including inactive"],
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
        ].map(([label, value, detail]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, lg: 2.4 }}>
            <Kpi
              label={String(label)}
              value={analyticsCount(Number(value))}
              detail={String(detail)}
            />
          </Grid>
        ))}
      </Grid>
      <Kpi
        label="Average Recorded Purchase Value"
        value={analyticsMoney(data.summary.average)}
        detail="Selected purchase value divided by matching purchases"
      />
      <Grid container spacing={2}>
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
            <DistributionChart rows={asRanks(data.gender[denominator])} />
            <Ranking
              rows={asRanks(data.gender[denominator])}
              countLabel={denominator === "purchases" ? "Purchases" : "Customers"}
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
            <DistributionChart rows={asRanks(data.ages)} />
            <Ranking rows={asRanks(data.ages)} countLabel="Profiles" />
          </ChartCard>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Customer Registrations" detail="Registration month in Asia/Kolkata.">
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
    <Stack spacing={3}>
      <ReportNote {...data} />
      <SummaryCards summary={data.summary} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard
            title="Purchase Mix Distribution"
            detail="Select a category to open its purchase report."
          >
            <DistributionChart rows={data.mix} onDrill={(row) => drill({ mix: row.name })} />
            <Ranking rows={data.mix} onDrill={(row) => drill({ mix: row.name })} />
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
