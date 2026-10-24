import React, { useState } from "react";
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import {
  eyes,
  sphOptions,
  cylOptions,
  type EyeFieldName,
  type EyeMeasure,
} from "../../utils/opticalForm";

export function PrescriptionMeasurementInput({
  value,
  onChange,
  onBlur,
  inputRef,
  measure,
  options = [],
  disabled,
  error,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  measure: EyeMeasure;
  options?: string[];
  disabled?: boolean;
  error?: string;
  label: string;
}) {
  if (measure === "axis") {
    return (
      <TextField
        fullWidth
        size="small"
        label="AXIS"
        placeholder="0–180"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={onBlur}
        inputRef={inputRef}
        disabled={disabled}
        error={Boolean(error)}
        helperText={error}
        slotProps={{
          htmlInput: {
            inputMode: "numeric",
            pattern: "[0-9]*",
            "aria-label": label,
            style: { textAlign: "center" },
          },
        }}
        sx={{
          "& .MuiInputBase-root": {
            fontSize: { xs: "0.85rem", sm: "0.9rem" },
            px: { xs: 0.5, sm: 1 },
          },
          "& .MuiInputLabel-root": {
            fontSize: { xs: "0.75rem", sm: "0.85rem" },
          },
        }}
      />
    );
  }

  return (
    <Autocomplete<string, false, false, true>
      freeSolo
      fullWidth
      size="small"
      openOnFocus
      forcePopupIcon
      selectOnFocus
      clearOnBlur={false}
      options={options}
      value={value}
      inputValue={value}
      disabled={disabled}
      onInputChange={(_, next, reason) => {
        if (reason === "input" || reason === "clear") onChange(next);
      }}
      onChange={(_, next) => onChange(next ?? "")}
      onBlur={onBlur}
      sx={{
        "& .MuiInputBase-root": {
          fontSize: { xs: "0.85rem", sm: "0.9rem" },
          px: { xs: 0.5, sm: 1 },
          pr: { xs: "24px !important", sm: "28px !important" },
        },
        "& .MuiInputLabel-root": {
          fontSize: { xs: "0.75rem", sm: "0.85rem" },
        },
        "& .MuiAutocomplete-endAdornment": {
          right: { xs: 0, sm: 4 },
        },
        "& .MuiIconButton-root": {
          p: { xs: 0.25, sm: 0.5 },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={measure.toUpperCase()}
          placeholder="±0.00"
          error={Boolean(error)}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              inputMode: "decimal",
              "aria-label": label,
              style: { textAlign: "center" },
            },
          }}
        />
      )}
    />
  );
}

export default function OpticalPrescriptionFields({
  renderField,
}: {
  renderField: (
    name: EyeFieldName,
    measure: EyeMeasure,
    options: string[],
    label: string,
  ) => React.ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileFilter, setMobileFilter] = useState<"all" | "re" | "le">("all");

  const displayedMobileEyes = eyes.filter((eye) => {
    if (mobileFilter === "re") return eye.prefix.startsWith("re");
    if (mobileFilter === "le") return eye.prefix.startsWith("le");
    return true;
  });

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}
        >
          <VisibilityOutlined color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Optical Prescription
          </Typography>
          <Chip label="Optional" size="small" variant="outlined" />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select SPH and CYL from searchable dropdowns, or type the required power directly.
        </Typography>

        {isMobile ? (
          /* ----------------------------------------------------
              MOBILE VIEW (100% Responsive, NO Horizontal Scrolling)
          ---------------------------------------------------- */
          <Box>
            {/* Quick Eye Filter Tabs */}
            <Box sx={{ mb: 1.5 }}>
              <ToggleButtonGroup
                value={mobileFilter}
                exclusive
                onChange={(_e, val) => {
                  if (val) setMobileFilter(val as "all" | "re" | "le");
                }}
                size="small"
                fullWidth
                sx={{ bgcolor: "background.paper" }}
              >
                <ToggleButton value="all" sx={{ fontWeight: 600, py: 0.75, fontSize: "0.8rem" }}>
                  All Eyes (4)
                </ToggleButton>
                <ToggleButton value="re" sx={{ fontWeight: 600, py: 0.75, fontSize: "0.8rem" }}>
                  Right (OD)
                </ToggleButton>
                <ToggleButton value="le" sx={{ fontWeight: 600, py: 0.75, fontSize: "0.8rem" }}>
                  Left (OS)
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Responsive Eye Cards */}
            <Stack spacing={1.5}>
              {displayedMobileEyes.map((eye) => (
                <Box
                  key={eye.prefix}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: 1,
                    borderColor: "divider",
                    bgcolor: (th) =>
                      th.palette.mode === "dark" ? "action.hover" : "background.default",
                  }}
                >
                  {/* Eye Badge Header */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 1.25,
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip
                        label={eye.label}
                        size="small"
                        color={eye.prefix.startsWith("re") ? "primary" : "secondary"}
                        sx={{ fontWeight: 700, fontSize: "0.725rem", height: 22 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
                        {eye.description}
                      </Typography>
                    </Stack>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                    >
                      {eye.prefix.startsWith("re") ? "OD" : "OS"}
                    </Typography>
                  </Stack>

                  {/* 3 Fields: SPH, CYL, AXIS in a 3-column row fitting 100% screen width */}
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 4 }}>
                      {renderField(
                        `${eye.prefix}_sph`,
                        "sph",
                        sphOptions,
                        `${eye.description} SPH`,
                      )}
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      {renderField(
                        `${eye.prefix}_cyl`,
                        "cyl",
                        cylOptions,
                        `${eye.description} CYL`,
                      )}
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      {renderField(`${eye.prefix}_axis`, "axis", [], `${eye.description} AXIS`)}
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : (
          /* ----------------------------------------------------
              DESKTOP / TABLET VIEW (Clean Table)
          ---------------------------------------------------- */
          <Box>
            <TableContainer
              component={Paper}
              tabIndex={0}
              role="region"
              aria-label="Optical prescription fields table"
              variant="outlined"
              sx={{ borderRadius: 2, overflowX: "auto" }}
            >
              <Table
                size="small"
                sx={{
                  minWidth: 640,
                  "& .MuiTableCell-root": { px: 1.5, py: 1.5, verticalAlign: "middle" },
                }}
              >
                <TableHead>
                  <TableRow sx={{ bgcolor: "background.default" }}>
                    {["Eye / Vision", "SPH", "CYL", "AXIS"].map((label) => (
                      <TableCell key={label} sx={{ fontWeight: 700 }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {eyes.map((eye) => (
                    <TableRow key={eye.prefix} hover>
                      <TableCell sx={{ minWidth: 150 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {eye.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {eye.description}
                        </Typography>
                      </TableCell>
                      {(["sph", "cyl", "axis"] as const).map((measure) => (
                        <TableCell
                          key={measure}
                          sx={{ minWidth: measure === "axis" ? 125 : 170 }}
                        >
                          {renderField(
                            `${eye.prefix}_${measure}`,
                            measure,
                            measure === "sph" ? sphOptions : measure === "cyl" ? cylOptions : [],
                            `${eye.description} (${eye.prefix.startsWith("re") ? "OD" : "OS"}) ${measure.toUpperCase()}`,
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          SPH: −30 to +30 · CYL: −15 to +15 · AXIS: 0–180
        </Typography>
      </CardContent>
    </Card>
  );
}
