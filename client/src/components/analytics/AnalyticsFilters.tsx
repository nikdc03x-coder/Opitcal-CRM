import {
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RestartAltOutlined from "@mui/icons-material/RestartAltOutlined";
import type { AnalyticsFilters as Filters } from "../../models/analytics";
import { defaultAnalyticsFilters } from "../../utils/analytics";

const periodOptions = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 Days"],
  ["month", "This Month"],
  ["lastMonth", "Last Month"],
  ["year", "This Year"],
  ["all", "All Time"],
  ["date", "Specific Date"],
  ["custom", "Custom Date Range"],
  ["selectedMonth", "Selected Month"],
  ["selectedYear", "Selected Year"],
];
export default function AnalyticsFilters({
  value,
  onChange,
  title = "Reporting period",
  reset = true,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
  title?: string;
  reset?: boolean;
}) {
  const set = (key: keyof Filters, next: string) => onChange({ ...value, [key]: next });
  const input = (key: "date" | "from" | "to" | "month" | "year", label: string, type = "date") => (
    <TextField
      key={key}
      label={label}
      type={type}
      size="small"
      value={value[key]}
      onChange={(event) => set(key, event.target.value)}
      slotProps={{
        inputLabel: { shrink: true },
        htmlInput: type === "number" ? { min: 1, max: 9999, step: 1 } : {},
      }}
      sx={{ minWidth: 160, flexGrow: { xs: 1, sm: 0 } }}
    />
  );
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {title}
            </Typography>
            <Chip size="small" variant="outlined" label="India calendar · inclusive dates" />
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ flexWrap: "wrap", gap: 1 }}
          >
            <TextField
              select
              size="small"
              label="Period"
              value={value.period}
              onChange={(event) => set("period", event.target.value)}
              sx={{ minWidth: 210 }}
            >
              {periodOptions.map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            {value.period === "date" && input("date", "Purchase Date")}
            {value.period === "custom" && (
              <>
                {input("from", "From")}
                {input("to", "Through")}
              </>
            )}
            {value.period === "selectedMonth" && input("month", "Month", "month")}
            {value.period === "selectedYear" && input("year", "Year", "number")}
            {reset && (
              <Button
                startIcon={<RestartAltOutlined />}
                onClick={() => onChange(defaultAnalyticsFilters())}
              >
                Reset Filters
              </Button>
            )}
          </Stack>
          {[
            value.brand,
            value.style,
            value.model,
            value.company,
            value.vision,
            value.lensName,
            value.coating,
            value.frame,
            value.lens,
            value.mix,
          ].some(Boolean) && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {(
                [
                  "brand",
                  "style",
                  "model",
                  "company",
                  "vision",
                  "lensName",
                  "coating",
                  "frame",
                  "lens",
                  "mix",
                ] as const
              )
                .filter((key) => value[key])
                .map((key) => (
                  <Chip
                    key={key}
                    label={`${key}: ${value[key]}`}
                    onDelete={() => onChange({ ...value, [key]: undefined })}
                  />
                ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
