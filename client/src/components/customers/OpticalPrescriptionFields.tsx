import React from "react";
import {
  Autocomplete,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
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
  if (measure === "axis")
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
        slotProps={{ htmlInput: { inputMode: "numeric", "aria-label": label } }}
      />
    );
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
      renderInput={(params) => (
        <TextField
          {...params}
          inputRef={inputRef}
          label={measure.toUpperCase()}
          placeholder="Select or type"
          error={Boolean(error)}
          helperText={error}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, "aria-label": label },
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
          Select SPH and CYL from searchable dropdowns, or type the required power. Scroll the table
          horizontally on smaller screens.
        </Typography>
        <TableContainer
          component={Paper}
          tabIndex={0}
          role="region"
          aria-label="Optical prescription fields, scroll horizontally to view all measurements"
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
                    <TableCell key={measure} sx={{ minWidth: measure === "axis" ? 125 : 170 }}>
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
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          SPH: −30 to +30 · CYL: −15 to +15 · AXIS: 0–180
        </Typography>
      </CardContent>
    </Card>
  );
}
