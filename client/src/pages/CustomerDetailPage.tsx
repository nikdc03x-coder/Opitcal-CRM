import { useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Checkbox,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";

import AddOutlined from "@mui/icons-material/AddOutlined";
import CompareArrowsOutlined from "@mui/icons-material/CompareArrowsOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import CheckCircleOutlineOutlined from "@mui/icons-material/CheckCircleOutlineOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonOutlined from "@mui/icons-material/PersonOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import RemoveRedEyeOutlined from "@mui/icons-material/RemoveRedEyeOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import UnfoldMoreOutlined from "@mui/icons-material/UnfoldMoreOutlined";
import UnfoldLessOutlined from "@mui/icons-material/UnfoldLessOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { getCustomer, deleteCustomer, deletePurchase } from "../services/customerApi";
import AddPurchaseDialog from "../components/customers/AddPurchaseDialog";
import ResponsiveDialog from "../components/layout/ResponsiveDialog";
import { type CustomerDetails, type CustomerRecord, type Prescription } from "../models/customer";
import {
  getPurchaseFlag,
  sortPurchases,
  sortPrescriptions,
  measurementDifference,
  type PurchaseFlag,
} from "../utils/customerHistory";

import {
  receiptHtml,
  prescriptionHtml,
  printDocument,
  shareOrDownloadPdf,
  openCustomerWhatsApp,
} from "../utils/customerDocuments";

function display(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

// Keep calendar dates stable across timezones.
function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "Unknown date";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPower(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  const safe = Object.is(number, -0) ? 0 : number;
  return `${safe > 0 ? "+" : ""}${safe.toFixed(2)}`;
}

// Compute reading addition (Add = Near Sph - Dist Sph)
function calculateAdd(
  nearSph: string | number | null | undefined,
  distSph: string | number | null | undefined,
): string | null {
  if (
    nearSph === null ||
    nearSph === undefined ||
    nearSph === "" ||
    distSph === null ||
    distSph === undefined ||
    distSph === ""
  ) {
    return null;
  }

  const near = Number(nearSph);
  const dist = Number(distSph);

  if (!Number.isFinite(near) || !Number.isFinite(dist)) return null;

  const add = measurementDifference(near, dist)!;
  const safe = Object.is(add, -0) ? 0 : add;
  return `${safe > 0 ? "+" : ""}${safe.toFixed(2)} D`;
}

// Classify prescription based on Distance and Near powers
function classifyRx(prescription: Prescription): {
  label: string;
  color: "primary" | "info" | "secondary" | "default";
} {
  const hasDist = Boolean(
    prescription.reDistSph ||
    prescription.reDistCyl ||
    prescription.leDistSph ||
    prescription.leDistCyl,
  );
  const hasNear = Boolean(
    prescription.reNearSph ||
    prescription.reNearCyl ||
    prescription.leNearSph ||
    prescription.leNearCyl,
  );

  if (hasDist && hasNear) {
    return { label: "Distance + Near Recorded", color: "primary" };
  }
  if (hasDist) {
    return { label: "Distance Recorded", color: "info" };
  }
  if (hasNear) {
    return { label: "Near Recorded", color: "secondary" };
  }
  return { label: "Standard Rx", color: "default" };
}

const purchaseFlagInfo: Record<
  PurchaseFlag,
  {
    label: string;
    color: "primary" | "success" | "info" | "default";
  }
> = {
  FRAME_ONLY: { label: "Frame Only", color: "info" },
  LENS_ONLY: { label: "Lens Only", color: "success" },
  FRAME_AND_LENS: { label: "Frame + Lens", color: "primary" },
  NOT_SPECIFIED: { label: "Not Specified", color: "default" },
};

const purchaseSummarySx = {
  p: { xs: 1.5, sm: 1.75 },
  height: "100%",
  minWidth: 0,
  borderRadius: 2,
  display: "flex",
  flexDirection: { xs: "column", sm: "row", lg: "column", xl: "row" },
  alignItems: "flex-start",
  gap: 1.5,
  "& .MuiTypography-root": { whiteSpace: "normal", overflowWrap: "anywhere" },
  "& .MuiTypography-h6": { fontSize: { xs: "1rem", sm: "1.25rem" } },
  "& .MuiTypography-subtitle1": { fontSize: { xs: "0.875rem", sm: "1rem" } },
} as const;

const customerActionSx = {
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  flexWrap: "wrap",
  gap: 1,
  "& > .MuiButton-root": {
    width: { xs: "100%", sm: "auto" },
    minHeight: { xs: 44, sm: 36 },
  },
} as const;

function DetailItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 600, display: "block" }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          mt: 0.25,
          fontWeight: highlight ? 700 : 600,
          color: (theme) =>
            highlight
              ? theme.palette.mode === "dark"
                ? "primary.light"
                : "primary.main"
              : "text.primary",
          fontSize: "0.95rem",
          overflowWrap: "anywhere",
        }}
      >
        {display(value)}
      </Typography>
    </Box>
  );
}

// Clinical Optometry Prescription Matrix with OD / OS Distinction & Add power
function ClinicalPrescriptionTable({
  prescription,
  compact = false,
}: {
  prescription: Prescription;
  compact?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const reAdd = calculateAdd(prescription.reNearSph, prescription.reDistSph);
  const leAdd = calculateAdd(prescription.leNearSph, prescription.leDistSph);

  const eyes = [
    {
      code: "OD",
      name: "Right Eye",
      alt: "RE",
      color: isDark ? "primary.light" : "#1D4ED8",
      bgColor: isDark ? "rgba(59, 130, 246, 0.14)" : "#EFF6FF",
      borderColor: isDark ? "rgba(59, 130, 246, 0.35)" : "#BFDBFE",
      dist: {
        sph: prescription.reDistSph,
        cyl: prescription.reDistCyl,
        axis: prescription.reDistAxis,
      },
      near: {
        sph: prescription.reNearSph,
        cyl: prescription.reNearCyl,
        axis: prescription.reNearAxis,
        add: reAdd ?? "—",
      },
    },
    {
      code: "OS",
      name: "Left Eye",
      alt: "LE",
      color: isDark ? "#34D399" : "#047857",
      bgColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
      borderColor: isDark ? "rgba(16, 185, 129, 0.35)" : "#A7F3D0",
      dist: {
        sph: prescription.leDistSph,
        cyl: prescription.leDistCyl,
        axis: prescription.leDistAxis,
      },
      near: {
        sph: prescription.leNearSph,
        cyl: prescription.leNearCyl,
        axis: prescription.leNearAxis,
        add: leAdd ?? "—",
      },
    },
  ];

  const rows = [
    {
      eye: "OD",
      eyeName: "Right Eye",
      vision: "Distance (DV)",
      sph: prescription.reDistSph,
      cyl: prescription.reDistCyl,
      axis: prescription.reDistAxis,
      add: "—",
      color: isDark ? "primary.light" : "#1D4ED8",
      bgColor: isDark ? "rgba(59, 130, 246, 0.14)" : "#EFF6FF",
    },
    {
      eye: "OD",
      eyeName: "Right Eye",
      vision: "Near (NV)",
      sph: prescription.reNearSph,
      cyl: prescription.reNearCyl,
      axis: prescription.reNearAxis,
      add: reAdd ?? "—",
      color: isDark ? "primary.light" : "#1D4ED8",
      bgColor: isDark ? "rgba(59, 130, 246, 0.14)" : "#EFF6FF",
    },
    {
      eye: "OS",
      eyeName: "Left Eye",
      vision: "Distance (DV)",
      sph: prescription.leDistSph,
      cyl: prescription.leDistCyl,
      axis: prescription.leDistAxis,
      add: "—",
      color: isDark ? "#34D399" : "#047857",
      bgColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
    },
    {
      eye: "OS",
      eyeName: "Left Eye",
      vision: "Near (NV)",
      sph: prescription.leNearSph,
      cyl: prescription.leNearCyl,
      axis: prescription.leNearAxis,
      add: leAdd ?? "—",
      color: isDark ? "#34D399" : "#047857",
      bgColor: isDark ? "rgba(16, 185, 129, 0.14)" : "#ECFDF5",
    },
  ];

  return (
    <>
      {/* Stack eye measurements on phones, including landscape screens. */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <Stack spacing={compact ? 1.25 : 1.5}>
          {eyes.map((eye) => (
            <Paper
              key={eye.code}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid",
                borderColor: eye.borderColor,
                bgcolor: "background.paper",
              }}
            >
              {/* Eye Header Ribbon */}
              <Box
                sx={{
                  px: compact ? 1.25 : 1.5,
                  py: compact ? 0.75 : 1,
                  bgcolor: eye.bgColor,
                  borderBottom: "1px solid",
                  borderColor: eye.borderColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Chip
                    size="small"
                    label={eye.code}
                    sx={{
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      bgcolor: eye.bgColor,
                      color: eye.color,
                      border: `1px solid ${eye.color}`,
                      height: 22,
                    }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 750,
                      color: "text.primary",
                      fontSize: "0.85rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {eye.name} ({eye.alt})
                  </Typography>
                </Box>
              </Box>

              {/* Measurements Container */}
              <Box sx={{ p: compact ? 1.25 : 1.5 }}>
                {/* Distance Vision (DV) */}
                <Box sx={{ mb: compact ? 1.25 : 1.5 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 750,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "text.secondary",
                      fontSize: "0.7rem",
                      display: "block",
                      mb: 0.75,
                    }}
                  >
                    Distance Vision (DV)
                  </Typography>

                  <Grid container spacing={0.75}>
                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          SPH
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatPower(eye.dist.sph)}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          CYL
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatPower(eye.dist.cyl)}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          AXIS
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 650,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {eye.dist.axis !== null &&
                          eye.dist.axis !== undefined &&
                          eye.dist.axis !== 0
                            ? `${eye.dist.axis}°`
                            : display(eye.dist.axis)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>

                <Divider sx={{ my: compact ? 1 : 1.25, borderStyle: "dashed" }} />

                {/* Near Vision (NV) */}
                <Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      mb: 0.75,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 750,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "text.secondary",
                        fontSize: "0.7rem",
                      }}
                    >
                      Near Vision (NV)
                    </Typography>

                    {eye.near.add !== "—" ? (
                      <Chip
                        size="small"
                        label={`Add: ${eye.near.add}`}
                        sx={{
                          fontWeight: 750,
                          fontSize: "0.72rem",
                          height: 20,
                          bgcolor: isDark ? "rgba(59, 130, 246, 0.18)" : "primary.50",
                          color: isDark ? "#93C5FD" : "primary.main",
                          border: "1px solid",
                          borderColor: isDark ? "rgba(59, 130, 246, 0.35)" : "primary.200",
                        }}
                      />
                    ) : (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.7rem" }}
                      >
                        Add: —
                      </Typography>
                    )}
                  </Box>

                  <Grid container spacing={0.75}>
                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          SPH
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatPower(eye.near.sph)}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          CYL
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatPower(eye.near.cyl)}
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: compact ? 0.75 : 1,
                          borderRadius: 1.5,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            letterSpacing: "0.03em",
                            lineHeight: 1.2,
                            mb: 0.25,
                          }}
                        >
                          AXIS
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 650,
                            fontSize: compact ? "0.88rem" : "0.92rem",
                            color: "text.primary",
                            lineHeight: 1.2,
                          }}
                        >
                          {eye.near.axis !== null &&
                          eye.near.axis !== undefined &&
                          eye.near.axis !== 0
                            ? `${eye.near.axis}°`
                            : display(eye.near.axis)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* Desktop / Tablet Table Layout (Unchanged for sm and up) */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          display: { xs: "none", md: "block" },
          borderRadius: 2,
          overflowX: "auto",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Table
          size="small"
          sx={{
            minWidth: compact ? 420 : 540,
            "& th": {
              bgcolor: "action.hover",
              fontWeight: 700,
              fontSize: "0.78rem",
              color: "text.secondary",
              letterSpacing: "0.03em",
              py: compact ? 1 : 1.25,
            },
            "& td": {
              py: compact ? 1 : 1.25,
              fontSize: "0.88rem",
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 90 }}>Eye</TableCell>
              <TableCell sx={{ minWidth: 120 }}>Vision Type</TableCell>
              <TableCell align="center" sx={{ minWidth: 80 }}>
                SPH
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 80 }}>
                CYL
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 80 }}>
                AXIS
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 90 }}>
                ADD
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={`${row.eye}-${row.vision}`}
                sx={{
                  bgcolor:
                    idx === 0 || idx === 1
                      ? isDark
                        ? "rgba(59, 130, 246, 0.05)"
                        : "rgba(37, 99, 235, 0.02)"
                      : isDark
                        ? "rgba(16, 185, 129, 0.05)"
                        : "rgba(5, 150, 105, 0.02)",
                  "&:hover": { bgcolor: "action.hover" },
                  borderBottom: idx === 1 ? "2px solid" : undefined,
                  borderColor: idx === 1 ? "divider" : undefined,
                }}
              >
                <TableCell>
                  <Chip
                    size="small"
                    label={row.eye}
                    sx={{
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      bgcolor: row.bgColor,
                      color: row.color,
                      border: `1px solid ${row.color}`,
                      mr: 0.75,
                    }}
                  />
                  {!compact && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {row.eyeName}
                    </Typography>
                  )}
                </TableCell>

                <TableCell>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    {row.vision}
                  </Typography>
                </TableCell>

                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.92rem" }}
                >
                  {formatPower(row.sph)}
                </TableCell>

                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, fontFamily: "monospace", fontSize: "0.92rem" }}
                >
                  {formatPower(row.cyl)}
                </TableCell>

                <TableCell
                  align="center"
                  sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.92rem" }}
                >
                  {row.axis !== null && row.axis !== undefined && row.axis !== 0
                    ? `${row.axis}°`
                    : display(row.axis)}
                </TableCell>

                <TableCell align="center">
                  {row.add !== "—" ? (
                    <Chip
                      size="small"
                      label={row.add}
                      sx={{
                        fontWeight: 750,
                        fontSize: "0.75rem",
                        height: 22,
                        bgcolor: isDark ? "rgba(59, 130, 246, 0.18)" : "primary.50",
                        color: isDark ? "#93C5FD" : "primary.main",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(59, 130, 246, 0.35)" : "primary.200",
                      }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

// Paired Optical Rx summary card shown inside a Purchase Record
function PairedPrescriptionCard({
  prescription,
  onPrint,
  onCompare,
}: {
  prescription: Prescription;
  onPrint: () => void;
  onCompare?: () => void;
}) {
  const rxType = classifyRx(prescription);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1, sm: 2 },
        borderRadius: 2,
        bgcolor: "action.hover",
        borderColor: "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 1.5 }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <RemoveRedEyeOutlined sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
            Linked Eye Prescription
          </Typography>
          <Chip
            size="small"
            label={rxType.label}
            color={rxType.color}
            sx={{ fontSize: "0.7rem", height: 20 }}
          />
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Recorded: {formatDate(prescription.createdAt)}
        </Typography>
      </Stack>

      <ClinicalPrescriptionTable prescription={prescription} compact />

      <Stack sx={{ ...customerActionSx, mt: 1.5, justifyContent: "flex-end" }}>
        <Button
          size="small"
          variant="text"
          startIcon={<PrintOutlined />}
          onClick={onPrint}
          sx={{ fontSize: "0.8rem", textTransform: "none" }}
        >
          Print Rx
        </Button>
        {onCompare && (
          <Button
            size="small"
            variant="text"
            startIcon={<CompareArrowsOutlined />}
            onClick={onCompare}
            sx={{ fontSize: "0.8rem", textTransform: "none" }}
          >
            Compare Exam
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

// Compare two recorded exams without altering stored clinical data.
function PrescriptionComparison({
  prescriptions,
  records = [],
  firstIdProp,
  secondIdProp,
}: {
  prescriptions: Prescription[];
  records?: CustomerRecord[];
  firstIdProp?: string;
  secondIdProp?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const sorted = sortPrescriptions(prescriptions);
  const [userFirstId, setUserFirstId] = useState<string | null>(null);
  const [userSecondId, setUserSecondId] = useState<string | null>(null);

  const activeFirstId = userFirstId ?? firstIdProp ?? sorted[0]?.id ?? "";
  const firstId = sorted.some((rx) => rx.id === activeFirstId)
    ? activeFirstId
    : (sorted[0]?.id ?? "");

  const activeSecondId = userSecondId ?? secondIdProp ?? sorted[1]?.id ?? "";
  const secondId = sorted.some((rx) => rx.id === activeSecondId)
    ? activeSecondId
    : (sorted.find((rx) => rx.id !== firstId)?.id ?? "");
  const first = sorted.find((rx) => rx.id === firstId);
  const second = sorted.find((rx) => rx.id === secondId);
  const metrics = [
    ["Right eye · Distance SPH", "reDistSph"],
    ["Right eye · Distance CYL", "reDistCyl"],
    ["Right eye · Distance AXIS", "reDistAxis"],
    ["Right eye · Near SPH", "reNearSph"],
    ["Right eye · Near CYL", "reNearCyl"],
    ["Right eye · Near AXIS", "reNearAxis"],
    ["Left eye · Distance SPH", "leDistSph"],
    ["Left eye · Distance CYL", "leDistCyl"],
    ["Left eye · Distance AXIS", "leDistAxis"],
    ["Left eye · Near SPH", "leNearSph"],
    ["Left eye · Near CYL", "leNearCyl"],
    ["Left eye · Near AXIS", "leNearAxis"],
  ] as const;
  const read = (rx: Prescription | undefined, key: (typeof metrics)[number][1]) =>
    rx ? rx[key] : null;
  const shown = (value: string | number | null | undefined, axis: boolean) =>
    axis ? (value == null || value === "" ? "—" : `${value}°`) : formatPower(value);
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Compare prescription history
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose two different recorded prescriptions. Differences are Exam A minus Exam B,
          regardless of date. Dates are when each prescription was recorded; no separate examination
          date is stored. This is not a diagnosis.
        </Typography>
      </Box>
      {sorted.length < 2 ? (
        <Alert severity="info">At least two prescriptions are needed for comparison.</Alert>
      ) : (
        <>
          <Grid container spacing={2}>
            {([firstId, secondId] as const).map((value, index) => (
              <Grid key={index} size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id={`comparison-exam-${index}-label`}>
                    {index === 0 ? "Exam A" : "Exam B"}
                  </InputLabel>
                  <Select
                    labelId={`comparison-exam-${index}-label`}
                    label={index === 0 ? "Exam A" : "Exam B"}
                    value={value}
                    sx={{
                      "& .MuiSelect-select": { whiteSpace: "normal", overflowWrap: "anywhere" },
                    }}
                    onChange={(event) =>
                      index === 0
                        ? setUserFirstId(event.target.value)
                        : setUserSecondId(event.target.value)
                    }
                  >
                    {sorted.map((rx) => {
                      const linked = records.find((r) => r.prescriptionId === rx.id);
                      const label = `${formatDate(rx.createdAt)} ${
                        linked
                          ? `• Order: ${linked.specsType || "Frame"} (${formatDate(linked.purchaseDate)})`
                          : "• Independent Exam"
                      }`;
                      return (
                        <MenuItem
                          key={rx.id}
                          value={rx.id}
                          disabled={rx.id === (index === 0 ? secondId : firstId)}
                        >
                          {label}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
            ))}
          </Grid>
          {firstId === secondId ? (
            <Alert severity="warning">Select two different examinations.</Alert>
          ) : (
            <>
              {/* Stack comparison measurements on phones and smaller tablets. */}
              <Box sx={{ display: { xs: "block", md: "none" } }}>
                <Stack spacing={1.5}>
                  {metrics.map(([label, key]) => {
                    const a = read(first, key);
                    const b = read(second, key);
                    const axis = key.endsWith("Axis");
                    const delta = measurementDifference(a, b);
                    const isChanged = delta !== null && delta !== 0;

                    return (
                      <Paper
                        key={key}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isChanged
                            ? isDark
                              ? "rgba(59, 130, 246, 0.08)"
                              : "#F0F7FF"
                            : "background.paper",
                          borderColor: isChanged
                            ? isDark
                              ? "rgba(59, 130, 246, 0.35)"
                              : "#BFDBFE"
                            : "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 750,
                            color: "text.secondary",
                            display: "block",
                            mb: 0.75,
                          }}
                        >
                          {label}
                        </Typography>
                        <Grid
                          container
                          spacing={1}
                          sx={{ alignItems: "center", textAlign: "center" }}
                        >
                          <Grid size={{ xs: 4 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", fontSize: "0.68rem" }}
                            >
                              EXAM A
                            </Typography>
                            <Typography
                              sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" }}
                            >
                              {shown(a, axis)}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", fontSize: "0.68rem" }}
                            >
                              EXAM B
                            </Typography>
                            <Typography
                              sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9rem" }}
                            >
                              {shown(b, axis)}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block", fontSize: "0.68rem" }}
                            >
                              CHANGE (A−B)
                            </Typography>
                            {isChanged ? (
                              <Chip
                                size="small"
                                label={
                                  axis
                                    ? `${delta > 0 ? "+" : ""}${delta}°`
                                    : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`
                                }
                                sx={{
                                  fontWeight: 750,
                                  fontSize: "0.72rem",
                                  height: 20,
                                  bgcolor: isDark ? "rgba(59, 130, 246, 0.2)" : "#EFF6FF",
                                  color: isDark ? "#93C5FD" : "primary.main",
                                }}
                              />
                            ) : (
                              <Typography
                                sx={{
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                  fontSize: "0.85rem",
                                  color: "text.secondary",
                                }}
                              >
                                {delta === null ? "—" : "0.00"}
                              </Typography>
                            )}
                          </Grid>
                        </Grid>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              {/* Desktop comparison table */}
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ display: { xs: "none", md: "block" }, borderRadius: 2, overflowX: "auto" }}
              >
                <Table size="small" sx={{ minWidth: 530 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell>Measurement</TableCell>
                      <TableCell align="right">Exam A</TableCell>
                      <TableCell align="right">Exam B</TableCell>
                      <TableCell align="right">A − B Difference</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metrics.map(([label, key]) => {
                      const a = read(first, key);
                      const b = read(second, key);
                      const axis = key.endsWith("Axis");
                      const delta = measurementDifference(a, b);
                      const isChanged = delta !== null && delta !== 0;
                      return (
                        <TableRow key={key} hover>
                          <TableCell sx={{ fontWeight: 650 }}>{label}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                            {shown(a, axis)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: "monospace" }}>
                            {shown(b, axis)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontFamily: "monospace", fontWeight: 750 }}
                          >
                            {delta === null ? (
                              "—"
                            ) : !isChanged ? (
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ fontFamily: "monospace", color: "text.secondary" }}
                              >
                                0.00
                              </Typography>
                            ) : (
                              <Chip
                                size="small"
                                label={
                                  axis
                                    ? `${delta > 0 ? "+" : ""}${delta}°`
                                    : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`
                                }
                                sx={{
                                  fontWeight: 800,
                                  fontSize: "0.75rem",
                                  height: 22,
                                  bgcolor: isDark ? "rgba(59, 130, 246, 0.2)" : "#EFF6FF",
                                  color: isDark ? "#93C5FD" : "#1D4ED8",
                                  border: "1px solid",
                                  borderColor: isDark ? "rgba(59, 130, 246, 0.4)" : "#BFDBFE",
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info">
                Axis values are angular measurements; their simple numerical difference may not
                represent the shortest angular change. Review findings with an optometrist.
              </Alert>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ mb: 1, fontWeight: 750 }}>
                    Exam A · {formatDate(first?.createdAt)}
                  </Typography>
                  {first && <ClinicalPrescriptionTable prescription={first} compact />}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography sx={{ mb: 1, fontWeight: 750 }}>
                    Exam B · {formatDate(second?.createdAt)}
                  </Typography>
                  {second && <ClinicalPrescriptionTable prescription={second} compact />}
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}
    </Stack>
  );
}

function CustomerDetailsSkeleton() {
  return (
    <Stack spacing={3}>
      <Skeleton width="40%" height={48} />
      <Skeleton width="100%" height={160} sx={{ borderRadius: 3 }} />
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map((item) => (
          <Grid key={item} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton height={110} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
      <Skeleton height={320} sx={{ borderRadius: 3 }} />
    </Stack>
  );
}

type PdfKind = "receipt" | "prescription";

type ReceiptDialogProps = {
  customer: CustomerDetails;
  record: CustomerRecord;
  busy: boolean;
  onClose: () => void;
  onPrint: (content: string, title: string) => void;
  onPdf: (content: string, filename: string, type: PdfKind) => Promise<void>;
  onWhatsAppPdf: (content: string, filename: string) => Promise<void>;
};

// Staff review the PDF contents before sharing it.
function ReceiptPreviewDialog({
  customer,
  record,
  busy,
  onClose,
  onPrint,
  onPdf,
  onWhatsAppPdf,
}: ReceiptDialogProps) {
  const [includePrescription, setIncludePrescription] = useState(false);

  // Only use the prescription linked to this purchase.
  const linkedPrescription =
    customer.prescriptions.find((item) => item.id === record.prescriptionId) ?? null;

  const selectedPrescription = includePrescription ? linkedPrescription : null;

  const documentContent = receiptHtml(customer, record, selectedPrescription);

  const filename = `receipt-${record.id}.pdf`;

  return (
    <ResponsiveDialog
      open
      fullWidth
      maxWidth="md"
      scroll="paper"
      aria-labelledby="receipt-preview-title"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle id="receipt-preview-title">
        <Typography component="div" variant="h6" sx={{ fontWeight: 800 }}>
          Prepare Customer Receipt
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Review the selected purchase and choose how to share or print it.
        </Typography>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 2.5 }}>
        <Stack spacing={3}>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, sm: 2.5 },
              borderRadius: 2,
              bgcolor: "action.hover",
            }}
          >
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Receipt Contents</Typography>

            <Stack spacing={0.75}>
              <Typography variant="body2">✓ Customer information and contact details</Typography>
              <Typography variant="body2">
                ✓ Purchased frame, lens design, and itemized rates
              </Typography>
              <Typography variant="body2">✓ Purchase date and total MRP</Typography>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {linkedPrescription ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={includePrescription}
                    onChange={(_, checked) => setIncludePrescription(checked)}
                  />
                }
                label="Include linked optical prescription details on the receipt"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No optical prescription is linked to this specific purchase.
              </Typography>
            )}
          </Paper>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Customer Information</Typography>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                {customer.name}
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Mobile Number" value={customer.mobNumber} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Gender" value={customer.gender} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Reference" value={customer.reference} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Registered Date" value={formatDate(customer.createdAt)} />
                </Grid>
              </Grid>
            </Paper>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Purchase Summary</Typography>

            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Purchase Date" value={formatDate(record.purchaseDate)} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Frame / Spectacle" value={record.specsType} />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <DetailItem label="Lens Type / Coating" value={record.lensType} />
                </Grid>

                {record.pricingMode === "SPLIT" && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem label="Frame Rate" value={formatMoney(record.frameRate)} />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <DetailItem label="Lens Rate" value={formatMoney(record.lensRate)} />
                    </Grid>
                  </>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Typography sx={{ fontWeight: 700 }}>Total Purchase MRP</Typography>

                <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                  {formatMoney(record.mrp)}
                </Typography>
              </Stack>
            </Paper>
          </Box>

          {selectedPrescription && (
            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  mb: 1.5,
                  alignItems: { sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Typography sx={{ fontWeight: 800 }}>Optical Prescription</Typography>

                <Typography variant="body2" color="text.secondary">
                  Recorded: {formatDate(selectedPrescription.createdAt)}
                </Typography>
              </Stack>

              <ClinicalPrescriptionTable prescription={selectedPrescription} />
            </Box>
          )}

          <Alert severity="info">
            This document represents recorded MRP and order specifications. Internal staff-only
            notes are strictly omitted.
          </Alert>
        </Stack>
      </DialogContent>

      <Divider />

      <DialogActions
        sx={{
          ...customerActionSx,
          p: 2,
          justifyContent: "flex-end",
          pb: "max(16px, env(safe-area-inset-bottom))",
        }}
      >
        <Button color="inherit" disabled={busy} onClick={onClose}>
          Cancel
        </Button>

        <Button
          variant="outlined"
          disabled={busy}
          startIcon={<PrintOutlined />}
          onClick={() => onPrint(documentContent, "Purchase Receipt")}
        >
          Print
        </Button>

        <Button
          variant="outlined"
          disabled={busy}
          startIcon={<PictureAsPdfOutlined />}
          onClick={() => {
            void onPdf(documentContent, filename, "receipt");
          }}
        >
          Save PDF
        </Button>

        <Button
          variant="contained"
          color="success"
          disabled={busy || !customer.mobNumber}
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <WhatsAppIcon />}
          onClick={() => {
            void onWhatsAppPdf(documentContent, filename);
          }}
        >
          {busy ? "Preparing PDF..." : "Share PDF via WhatsApp"}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
}

export default function CustomerDetailPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | "customer" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deletePending = useRef(false);
  const { id } = useParams();
  const visibleCustomerId = useRef(id);
  const [params, setParams] = useSearchParams();

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  const [copyMessage, setCopyMessage] = useState("");
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentBusy, setDocumentBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState("");

  const [selectedRecord, setSelectedRecord] = useState<CustomerRecord | null>(null);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseFilter, setPurchaseFilter] = useState<
    "ALL" | "FRAME_ONLY" | "LENS_ONLY" | "FRAME_AND_LENS"
  >("ALL");
  const [purchaseSort, setPurchaseSort] = useState<"NEWEST" | "OLDEST">("NEWEST");
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<Set<string>>(new Set());
  const [compareFirstId, setCompareFirstId] = useState<string>("");
  const [compareSecondId, setCompareSecondId] = useState<string>("");

  const purchaseDialogOpen = params.get("purchase") === "new";
  function setPurchaseDialogOpen(open: boolean) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (open) next.set("purchase", "new");
        else next.delete("purchase");
        return next;
      },
      { replace: true },
    );
  }

  const requestRef = useRef<AbortController | null>(null);

  const previousSearch = params.get("search") ?? "";
  const searchQuery = previousSearch ? `?search=${encodeURIComponent(previousSearch)}` : "";
  const backUrl = `/customers${searchQuery}`;

  async function confirmDelete() {
    if (!customer || !deleteTarget || deletePending.current) return;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      if (deleteTarget === "customer") {
        await deleteCustomer(customer.id);
        if (visibleCustomerId.current !== customer.id) return;
        setDeleteTarget(null);
        navigate(backUrl, { state: { success: "Customer deleted successfully." } });
      } else {
        const deleted = await deletePurchase(customer.id, deleteTarget.id);
        if (visibleCustomerId.current !== customer.id) return;
        requestRef.current?.abort();
        setRefreshing(false);
        setCustomer((previous) =>
          previous?.id === customer.id
            ? {
                ...previous,
                records: previous.records.filter((record) => record.id !== deleted.purchaseId),
                prescriptions: previous.prescriptions.filter(
                  (rx) => rx.id !== deleted.prescriptionId,
                ),
              }
            : previous,
        );
        setDeleteTarget(null);
        setSelectedRecord(null);
        setPurchaseMessage("Purchase deleted successfully.");
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Unable to delete. Check your connection and try again.",
      );
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  }

  useEffect(() => {
    visibleCustomerId.current = id;
    if (!id) {
      void Promise.resolve().then(() => {
        setCustomer(null);
        setLoading(false);
        setError("Customer ID is missing.");
      });
      return;
    }

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setCustomer(null);
      setLoading(true);
      setRefreshing(false);
      setError("");
      setSelectedRecord(null);
      setDeleteTarget(null);
      setDeleteError("");
      setPurchaseMessage("");
      setActiveTab(0);
    });

    getCustomer(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || requestRef.current !== controller || result.id !== id) {
          return;
        }
        setCustomer(result);
        const sorted = sortPurchases(result.records);
        if (sorted[0]) {
          setExpandedPurchaseIds(new Set([sorted[0].id]));
        }
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted || requestRef.current !== controller) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load customer details.");
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      controller.abort();
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [id]);

  async function handleRefresh(force = false) {
    if (!id || (refreshing && !force)) return;

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setRefreshing(true);
    setLoading(false);
    setError("");

    try {
      const result = await getCustomer(id, controller.signal);

      if (controller.signal.aborted || requestRef.current !== controller || result.id !== id) {
        return;
      }
      setCustomer(result);
      const sorted = sortPurchases(result.records);
      if (sorted[0]) {
        setExpandedPurchaseIds((prev) => (prev.size === 0 ? new Set([sorted[0].id]) : prev));
      }
    } catch (err) {
      if (controller.signal.aborted || requestRef.current !== controller) {
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to refresh customer details.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setRefreshing(false);
      }
    }
  }

  async function copyCustomerId(customerId: string) {
    try {
      await navigator.clipboard.writeText(customerId);
      setCopyMessage("Customer ID copied to clipboard");
    } catch {
      setCopyMessage("Could not copy Customer ID");
    }
  }

  function handlePrint(content: string, title: string) {
    setDocumentMessage("");
    try {
      printDocument(content, title);
    } catch (err) {
      setDocumentMessage(err instanceof Error ? err.message : "Unable to print.");
    }
  }

  async function handlePdf(content: string, filename: string, type: PdfKind): Promise<void> {
    if (documentBusy) return;

    setDocumentBusy(true);
    setDocumentMessage("");

    try {
      const result = await shareOrDownloadPdf(content, filename, type);
      setDocumentMessage(
        result === "shared"
          ? "Device share completed. Check the recipient and confirm the PDF was sent."
          : "PDF downloaded successfully.",
      );
    } catch (err) {
      setDocumentMessage(err instanceof Error ? err.message : "Unable to prepare the PDF.");
    } finally {
      setDocumentBusy(false);
    }
  }

  async function handleWhatsAppPdf(content: string, filename: string): Promise<void> {
    if (!customer || documentBusy) return;

    setDocumentBusy(true);
    setDocumentMessage("");

    try {
      const result = await shareOrDownloadPdf(content, filename, "receipt");

      if (result === "shared") {
        setDocumentMessage("PDF handed to device share menu. Select WhatsApp and send.");
        return;
      }

      try {
        openCustomerWhatsApp(customer.mobNumber, "");
        setDocumentMessage(
          "Receipt PDF downloaded. In WhatsApp, attach the downloaded PDF and press Send.",
        );
      } catch (chatError) {
        setDocumentMessage(
          chatError instanceof Error
            ? `PDF downloaded, but WhatsApp could not open: ${chatError.message}`
            : "PDF downloaded. Open WhatsApp manually and attach it.",
        );
      }
    } catch (err) {
      setDocumentMessage(
        err instanceof Error ? err.message : "Could not prepare the WhatsApp PDF.",
      );
    } finally {
      setDocumentBusy(false);
    }
  }

  const customerRecords = customer?.records;
  const filteredPurchases = useMemo(() => {
    if (!customerRecords) return [];
    let list = sortPurchases(customerRecords);
    if (purchaseSort === "OLDEST") {
      list.reverse();
    }
    if (purchaseFilter !== "ALL") {
      list = list.filter((r) => getPurchaseFlag(r) === purchaseFilter);
    }
    if (purchaseSearch.trim()) {
      const q = purchaseSearch.toLowerCase().trim();
      list = list.filter((r) => {
        const specs = (r.specsType || "").toLowerCase();
        const lens = (r.lensType || "").toLowerCase();
        const mrp = (r.mrp || "").toString();
        const date = formatDate(r.purchaseDate).toLowerCase();
        return specs.includes(q) || lens.includes(q) || mrp.includes(q) || date.includes(q);
      });
    }
    return list;
  }, [customerRecords, purchaseSort, purchaseFilter, purchaseSearch]);

  const togglePurchaseExpand = (id: string) => {
    setExpandedPurchaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAllPurchases = () => {
    if (expandedPurchaseIds.size === filteredPurchases.length) {
      setExpandedPurchaseIds(new Set());
    } else {
      setExpandedPurchaseIds(new Set(filteredPurchases.map((r) => r.id)));
    }
  };

  const isAllExpanded =
    filteredPurchases.length > 0 && expandedPurchaseIds.size === filteredPurchases.length;

  if ((loading && !customer) || (customer && customer.id !== id)) {
    return <CustomerDetailsSkeleton />;
  }

  if (!customer) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Alert severity="error">{error || "Customer not found."}</Alert>
        <Button
          component={Link}
          to={backUrl}
          startIcon={<ArrowBackOutlined />}
          sx={{ width: "fit-content" }}
        >
          Back to Customers
        </Button>
      </Stack>
    );
  }

  const editUrl = `/customers/${customer.id}/edit${searchQuery}`;
  // Sort explicitly; API array order is not guaranteed to be newest first.
  const sortedRecords = sortPurchases(customer.records);
  const sortedPrescriptions = sortPrescriptions(customer.prescriptions);

  const initials = customer.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const totalPurchaseValue = customer.records.reduce(
    (sum, item) => sum + (Number(item.mrp) || 0),
    0,
  );

  const latestRecord = sortedRecords[0] ?? null;

  return (
    <Box
      sx={{ width: "100%", minWidth: 0, maxWidth: 1320, mx: "auto", pb: 8, px: { xs: 0, sm: 2 } }}
    >
      <Stack spacing={3}>
        {/* Navigation Breadcrumb */}
        <Box>
          <Button
            component={Link}
            to={backUrl}
            size="small"
            startIcon={<ArrowBackOutlined />}
            sx={{ fontWeight: 600, color: "text.secondary" }}
          >
            Back to Customers
          </Button>
        </Box>

        {/* Customer Header Hero Banner */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            bgcolor: "background.paper",
            borderColor: "divider",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <CardContent sx={{ p: { xs: 1.5, sm: 2.5, md: 3.5 } }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={3}
              sx={{
                justifyContent: "space-between",
                alignItems: { xs: "flex-start", md: "center" },
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2.5}
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  minWidth: 0,
                  flex: 1,
                  width: { xs: "100%", md: "auto" },
                }}
              >
                <Avatar
                  sx={{
                    width: 72,
                    height: 72,
                    bgcolor: "primary.main",
                    fontWeight: 800,
                    fontSize: "1.75rem",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                  }}
                >
                  {initials || <PersonOutlined sx={{ fontSize: 36 }} />}
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1, width: "100%" }}>
                  <Stack
                    direction="row"
                    spacing={1.5}
                    useFlexGap
                    sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.5 }}
                  >
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        letterSpacing: "-0.02em",
                        fontSize: { xs: "1.6rem", md: "2.1rem" },
                      }}
                    >
                      {customer.name}
                    </Typography>

                    {totalPurchaseValue >= 10000 && (
                      <Chip
                        size="small"
                        label="VIP Customer"
                        sx={{
                          bgcolor: isDark ? "rgba(245, 158, 11, 0.18)" : "#FEF3C7",
                          color: isDark ? "#FCD34D" : "#92400E",
                          border: isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "none",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                        }}
                      />
                    )}

                    {customer.records.length > 1 && (
                      <Chip
                        size="small"
                        label="Repeat Patron"
                        sx={{
                          bgcolor: isDark ? "rgba(59, 130, 246, 0.18)" : "#EFF6FF",
                          color: isDark ? "#93C5FD" : "#1D4ED8",
                          border: isDark ? "1px solid rgba(59, 130, 246, 0.35)" : "none",
                          fontWeight: 700,
                          fontSize: "0.75rem",
                        }}
                      />
                    )}
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1.5}
                    useFlexGap
                    sx={{
                      mt: 1,
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 0.75,
                      color: "text.secondary",
                      fontSize: "0.9rem",
                    }}
                  >
                    {customer.mobNumber ? (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <PhoneOutlined sx={{ fontSize: 16 }} />
                        <Typography
                          component="span"
                          sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                          {customer.mobNumber}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography component="span" variant="body2" color="text.secondary">
                        No phone number
                      </Typography>
                    )}

                    {customer.gender && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={customer.gender}
                        sx={{
                          height: "auto",
                          minHeight: 22,
                          maxWidth: "100%",
                          "& .MuiChip-label": {
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            textOverflow: "clip",
                            py: 0.25,
                          },
                        }}
                      />
                    )}

                    {customer.ageAtRecording != null && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Age - ${customer.ageAtRecording} yrs`}
                        sx={{
                          height: "auto",
                          minHeight: 22,
                          maxWidth: "100%",
                          "& .MuiChip-label": {
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            textOverflow: "clip",
                            py: 0.5,
                          },
                        }}
                      />
                    )}

                    {customer.reference && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Ref: ${customer.reference}`}
                        sx={{
                          height: "auto",
                          minHeight: 22,
                          maxWidth: "100%",
                          "& .MuiChip-label": {
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            textOverflow: "clip",
                            py: 0.25,
                          },
                        }}
                      />
                    )}
                  </Stack>
                </Box>
              </Stack>

              {/* Action Toolbar */}
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  width: { xs: "100%", md: "auto" },
                  flexShrink: 0,
                  "& > *": {
                    flex: { xs: "1 1 calc(50% - 8px)", sm: "0 0 auto" },
                  },
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<AddOutlined />}
                  disabled={refreshing}
                  onClick={() => setPurchaseDialogOpen(true)}
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    flex: { xs: "1 1 100%", sm: "0 0 auto" },
                  }}
                >
                  New Purchase
                </Button>

                {customer.mobNumber && (
                  <Button
                    component="a"
                    href={`tel:${customer.mobNumber}`}
                    variant="outlined"
                    color="inherit"
                    startIcon={<PhoneOutlined />}
                  >
                    Call
                  </Button>
                )}

                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={refreshing}
                  onClick={() => {
                    void handleRefresh();
                  }}
                  startIcon={refreshing ? <CircularProgress size={17} /> : <RefreshOutlined />}
                >
                  {refreshing ? "Refreshing" : "Refresh"}
                </Button>

                <Button
                  component={Link}
                  to={editUrl}
                  variant="contained"
                  startIcon={<EditOutlined />}
                >
                  Edit
                </Button>
              </Box>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            {/* Quick Identifier & Registration Metadata */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                justifyContent: "space-between",
                alignItems: { sm: "center" },
                fontSize: "0.85rem",
                color: "text.secondary",
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  ID:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace",
                    bgcolor: "action.hover",
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {customer.id}
                </Typography>
                <Tooltip title="Copy customer ID">
                  <IconButton
                    size="small"
                    aria-label="Copy customer ID"
                    onClick={() => {
                      void copyCustomerId(customer.id);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <ContentCopyOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
                <Typography variant="caption">
                  Registered: <strong>{formatDate(customer.createdAt)}</strong>
                </Typography>
                <Typography variant="caption">
                  Last Updated: <strong>{formatDate(customer.updatedAt)}</strong>
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Global Alert Messages */}
        {purchaseMessage && (
          <Alert severity="success" onClose={() => setPurchaseMessage("")}>
            {purchaseMessage}
          </Alert>
        )}
        {error && (
          <Alert severity="warning" onClose={() => setError("")}>
            Unable to refresh: {error}. Showing the last available information.
          </Alert>
        )}

        {copyMessage && (
          <Alert severity="info" onClose={() => setCopyMessage("")}>
            {copyMessage}
          </Alert>
        )}

        {documentMessage && (
          <Alert severity="info" onClose={() => setDocumentMessage("")}>
            {documentMessage}
          </Alert>
        )}

        {/* Tabbed Clinical & Commercial Dashboard */}
        <Card variant="outlined" sx={{ borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
            <Tabs
              value={activeTab}
              onChange={(_, next: number) => setActiveTab(next)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Customer detail views"
              sx={{
                px: { xs: 0, md: 2 },
                "& .MuiTab-root": {
                  px: { xs: 1.5, sm: 2 },
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
                },
              }}
            >
              <Tab
                icon={<ReceiptLongOutlined />}
                iconPosition="start"
                label={`Purchases & Eyewear (${customer.records.length})`}
                sx={{ fontWeight: 650, py: 2 }}
              />
              <Tab
                icon={<VisibilityOutlined />}
                iconPosition="start"
                label={`Clinical Prescriptions (${customer.prescriptions.length})`}
                sx={{ fontWeight: 650, py: 2 }}
              />
              <Tab
                icon={<TrendingUpOutlined />}
                iconPosition="start"
                label="Vision Progression"
                sx={{ fontWeight: 650, py: 2 }}
              />
              <Tab
                icon={<CompareArrowsOutlined />}
                iconPosition="start"
                label="Compare Exams"
                sx={{ fontWeight: 650, py: 2 }}
              />
              <Tab
                icon={<LockOutlined />}
                iconPosition="start"
                label="Staff & Clinical Notes"
                sx={{ fontWeight: 650, py: 2 }}
              />
            </Tabs>
          </Box>

          <CardContent sx={{ p: { xs: 1.5, sm: 2, md: 3.5 }, minHeight: 300 }}>
            {/* TAB 0: Purchases & Paired Eyewear */}
            {activeTab === 0 && (
              <Stack spacing={2.5}>
                {/* Header Title & Actions */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                >
                 
                </Stack>

                {/* Section A: Purchase History Overview KPI Cards */}
                <Grid container spacing={1.5}>
                  {/* KPI 1: Total Orders */}
                  <Grid size={{ xs: 6, lg: 3 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...purchaseSummarySx,
                        bgcolor: isDark ? "rgba(255, 255, 255, 0.02)" : "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isDark ? "rgba(59, 130, 246, 0.16)" : "primary.50",
                          color: "primary.main",
                          flexShrink: 0,
                        }}
                      >
                        <ShoppingBagOutlined sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 650, display: "block", fontSize: "0.7rem" }}
                        >
                          TOTAL ORDERS
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                          {customer.records.length}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.7rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                        >
                          {customer.records.length === 1
                            ? "1 order recorded"
                            : `${customer.records.length} lifetime orders`}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* KPI 2: Latest Purchase Date */}
                  <Grid size={{ xs: 6, lg: 3 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...purchaseSummarySx,
                        bgcolor: isDark ? "rgba(255, 255, 255, 0.02)" : "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isDark ? "rgba(16, 185, 129, 0.16)" : "success.50",
                          color: "success.main",
                          flexShrink: 0,
                        }}
                      >
                        <CalendarTodayOutlined sx={{ fontSize: 20 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 650, display: "block", fontSize: "0.7rem" }}
                        >
                          LATEST VISIT
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 800,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {latestRecord ? formatDate(latestRecord.purchaseDate) : "None"}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.7rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                        >
                          Last store purchase
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* KPI 3: Latest Purchase Category */}
                  <Grid size={{ xs: 6, lg: 3 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...purchaseSummarySx,
                        bgcolor: isDark ? "rgba(255, 255, 255, 0.02)" : "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isDark ? "rgba(245, 158, 11, 0.16)" : "warning.50",
                          color: "warning.main",
                          flexShrink: 0,
                        }}
                      >
                        <VisibilityOutlined sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 650, display: "block", fontSize: "0.7rem" }}
                        >
                          LATEST TYPE
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 800,
                            lineHeight: 1.2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {latestRecord
                            ? purchaseFlagInfo[getPurchaseFlag(latestRecord)].label
                            : "None"}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.7rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                        >
                          {latestRecord?.prescriptionId ? "Linked with Rx" : "OTC / No Rx"}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* KPI 4: Recent Amount & Lifetime Spend */}
                  <Grid size={{ xs: 6, lg: 3 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...purchaseSummarySx,
                        bgcolor: isDark ? "rgba(255, 255, 255, 0.02)" : "background.paper",
                      }}
                    >
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isDark ? "rgba(139, 92, 246, 0.16)" : "secondary.50",
                          color: "secondary.main",
                          flexShrink: 0,
                        }}
                      >
                        <ReceiptLongOutlined sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 650, display: "block", fontSize: "0.7rem" }}
                        >
                          RECENT ORDER
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 800,
                            lineHeight: 1.2,
                            color: (theme) =>
                              theme.palette.mode === "dark" ? "primary.light" : "primary.main",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {latestRecord ? formatMoney(latestRecord.mrp) : "—"}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.7rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "block",
                          }}
                        >
                          Total: {formatMoney(totalPurchaseValue)}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Section B & E: Search, Filter, Sort and Expand/Collapse Controls */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: isDark ? "rgba(255, 255, 255, 0.02)" : "action.hover",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { xs: "stretch", md: "center" },
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Search Field */}
                    <TextField
                      size="small"
                      placeholder="Search frame, lens, model, price..."
                      value={purchaseSearch}
                      onChange={(e) => setPurchaseSearch(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchOutlined sx={{ fontSize: 18, color: "text.secondary" }} />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ width: "100%", maxWidth: { xs: "100%", lg: 300 } }}
                    />

                    {/* Filter, Sort & Bulk Expand Controls */}
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      useFlexGap
                      sx={{
                        minWidth: 0,
                        alignItems: { xs: "stretch", sm: "center" },
                        flexWrap: "wrap",
                        gap: 1,
                        justifyContent: { xs: "flex-start", md: "flex-end" },
                      }}
                    >
                      <ToggleButtonGroup
                        size="small"
                        value={purchaseFilter}
                        exclusive
                        onChange={(_, val) => {
                          if (val) setPurchaseFilter(val);
                        }}
                        sx={{
                          display: { xs: "grid", sm: "flex" },
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: { xs: 0.75, sm: 0 },
                          width: { xs: "100%", sm: "auto" },
                          "& .MuiToggleButtonGroup-grouped": {
                            minWidth: 0,
                            m: 0,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: { xs: "8px !important", sm: 0 },
                          },
                          "& .MuiToggleButton-root": {
                            fontSize: "0.75rem",
                            px: 1.25,
                            py: 0.5,
                            fontWeight: 650,
                          },
                        }}
                      >
                        <ToggleButton value="ALL">All ({customer.records.length})</ToggleButton>
                        <ToggleButton value="FRAME_AND_LENS">Frame + Lens</ToggleButton>
                        <ToggleButton value="FRAME_ONLY">Frame Only</ToggleButton>
                        <ToggleButton value="LENS_ONLY">Lens Only</ToggleButton>
                      </ToggleButtonGroup>

                      {/* Sort Selector */}
                      <FormControl
                        size="small"
                        sx={{ minWidth: 0, width: { xs: "100%", sm: 140 } }}
                      >
                        <Select
                          value={purchaseSort}
                          inputProps={{ "aria-label": "Sort purchases" }}
                          onChange={(e) => setPurchaseSort(e.target.value as "NEWEST" | "OLDEST")}
                          sx={{ fontSize: "0.8rem", minHeight: { xs: 44, sm: 36 } }}
                        >
                          <MenuItem value="NEWEST">Newest First</MenuItem>
                          <MenuItem value="OLDEST">Oldest First</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Expand / Collapse All Toggle */}
                      {filteredPurchases.length > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          startIcon={
                            isAllExpanded ? <UnfoldLessOutlined /> : <UnfoldMoreOutlined />
                          }
                          onClick={handleToggleAllPurchases}
                          sx={{ fontSize: "0.78rem", minHeight: { xs: 44, sm: 36 } }}
                        >
                          {isAllExpanded ? "Collapse All" : "Expand All"}
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>

                {/* Section B, C & D: Responsive Expandable Purchase History List */}
                {filteredPurchases.length === 0 ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 4,
                      borderRadius: 2.5,
                      textAlign: "center",
                      bgcolor: "background.paper",
                    }}
                  >
                    <ShoppingBagOutlined
                      sx={{ fontSize: 44, color: "text.secondary", mb: 1, opacity: 0.6 }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 750, mb: 0.5 }}>
                      No Matching Purchase Records
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {purchaseSearch || purchaseFilter !== "ALL"
                        ? "No orders match your active search or category filter. Try clearing your search."
                        : "No purchase records recorded for this customer yet."}
                    </Typography>
                    {(purchaseSearch || purchaseFilter !== "ALL") && (
                      <Button
                        size="small"
                        variant="text"
                        sx={{ mt: 1.5 }}
                        onClick={() => {
                          setPurchaseSearch("");
                          setPurchaseFilter("ALL");
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </Paper>
                ) : (
                  filteredPurchases.map((record) => {
                    const isLatest = record.id === sortedRecords[0]?.id;
                    const isExpanded = expandedPurchaseIds.has(record.id);
                    const flag = purchaseFlagInfo[getPurchaseFlag(record)];
                    const linkedRx = customer.prescriptions.find(
                      (p) => p.id === record.prescriptionId,
                    );
                    const orderNumber =
                      sortedRecords.length - sortedRecords.findIndex((r) => r.id === record.id);

                    return (
                      <Card
                        id={`purchase-${record.id}`}
                        key={record.id}
                        variant="outlined"
                        sx={{
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: isLatest ? (isDark ? "primary.main" : "#2563EB") : "divider",
                          boxShadow: isLatest
                            ? isDark
                              ? "0 4px 16px rgba(59, 130, 246, 0.16)"
                              : "0 3px 12px rgba(37, 99, 235, 0.08)"
                            : "none",
                          transition: "border-color 0.2s, box-shadow 0.2s",
                          overflow: "hidden",
                        }}
                      >
                        {/* Interactive Clickable Header Ribbon */}
                        <Box
                          onClick={() => togglePurchaseExpand(record.id)}
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            cursor: "pointer",
                            bgcolor: isLatest
                              ? isDark
                                ? "rgba(59, 130, 246, 0.12)"
                                : "#EAF2FF"
                              : isDark
                                ? "action.hover"
                                : "#F8FAFC",
                            borderBottom: isExpanded ? "1px solid" : "none",
                            borderColor: "divider",
                            userSelect: "none",
                            "&:hover": {
                              bgcolor: isLatest
                                ? isDark
                                  ? "rgba(59, 130, 246, 0.18)"
                                  : "#E0ECFE"
                                : isDark
                                  ? "rgba(255, 255, 255, 0.06)"
                                  : "#F1F5F9",
                            },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.25}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: { xs: "flex-start", sm: "center" },
                            }}
                          >
                            {/* Left Side: Order Badge, Date, Flag, Summary */}
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              sx={{
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 0.75,
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              {isLatest ? (
                                <Chip
                                  size="small"
                                  color="primary"
                                  label="LATEST PURCHASE"
                                  icon={<CheckCircleOutlineOutlined sx={{ fontSize: 14 }} />}
                                  sx={{ fontWeight: 800, height: 24, fontSize: "0.72rem" }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label={`ORDER #${orderNumber}`}
                                  sx={{
                                    bgcolor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E8F0",
                                    color: isDark ? "text.primary" : "#334155",
                                    fontWeight: 750,
                                    height: 24,
                                    fontSize: "0.72rem",
                                  }}
                                />
                              )}

                              <Chip
                                size="small"
                                icon={<CalendarTodayOutlined sx={{ fontSize: 13 }} />}
                                label={formatDate(record.purchaseDate)}
                                variant="outlined"
                                sx={{ height: 24, fontSize: "0.75rem", fontWeight: 600 }}
                              />

                              <Chip
                                label={flag.label}
                                color={flag.color}
                                size="small"
                                sx={{ height: 24, fontWeight: 700, fontSize: "0.72rem" }}
                              />
                            </Stack>

                            {/* Right Side: Rx indicator, Price & Chevron */}
                            <Stack
                              direction="row"
                              spacing={1.25}
                              sx={{
                                alignItems: "center",
                                flexShrink: 0,
                                minWidth: 0,
                                flexWrap: "wrap",
                                gap: 1,
                                width: { xs: "100%", sm: "auto" },
                                justifyContent: { xs: "space-between", sm: "flex-end" },
                              }}
                            >
                              {linkedRx ? (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  icon={<VisibilityOutlined sx={{ fontSize: 13 }} />}
                                  label="Linked Rx"
                                  sx={{ height: 22, fontSize: "0.7rem", fontWeight: 650 }}
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label="No Rx"
                                  sx={{
                                    height: 22,
                                    fontSize: "0.7rem",
                                    color: "text.secondary",
                                  }}
                                />
                              )}

                              <Typography
                                variant="subtitle1"
                                sx={{
                                  fontWeight: 800,
                                  color: (theme) =>
                                    theme.palette.mode === "dark"
                                      ? "primary.light"
                                      : "primary.main",
                                  lineHeight: 1.1,
                                }}
                              >
                                {formatMoney(record.mrp)}
                              </Typography>

                              <IconButton
                                size="small"
                                sx={{
                                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                  transition: "transform 0.2s ease-in-out",
                                  p: 0.5,
                                }}
                                aria-label={
                                  isExpanded ? "Collapse order details" : "Expand order details"
                                }
                              >
                                <ExpandMoreOutlined fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Box>

                        {/* Collapsible Order Drawer */}
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                            <Grid container spacing={2.5}>
                              {/* Product Specifications */}
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      fontWeight: 750,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                    }}
                                  >
                                    Eyewear Specifications
                                  </Typography>
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={
                                      record.pricingMode === "SPLIT"
                                        ? "Itemized Split"
                                        : "Standard MRP"
                                    }
                                    sx={{ height: 20, fontSize: "0.68rem" }}
                                  />
                                </Box>

                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                  <Grid container spacing={1.75}>
                                    <Grid size={{ xs: 12 }}>
                                      <DetailItem
                                        label="Frame / Spectacle Model"
                                        value={record.specsType || "Not recorded"}
                                        highlight
                                      />
                                    </Grid>

                                    <Grid size={{ xs: 12 }}>
                                      <DetailItem
                                        label="Lens Type / Coating / Design"
                                        value={record.lensType || "Not recorded"}
                                        highlight
                                      />
                                    </Grid>

                                    {record.pricingMode === "SPLIT" && (
                                      <>
                                        <Grid size={{ xs: 6 }}>
                                          <DetailItem
                                            label="Frame Rate"
                                            value={formatMoney(record.frameRate)}
                                          />
                                        </Grid>

                                        <Grid size={{ xs: 6 }}>
                                          <DetailItem
                                            label="Lens Rate"
                                            value={formatMoney(record.lensRate)}
                                          />
                                        </Grid>
                                      </>
                                    )}

                                    <Grid size={{ xs: 6 }}>
                                      <DetailItem
                                        label="Purchase Date"
                                        value={formatDate(record.purchaseDate)}
                                      />
                                    </Grid>

                                    <Grid size={{ xs: 6 }}>
                                      <DetailItem
                                        label="System Log Date"
                                        value={formatDate(record.createdAt)}
                                      />
                                    </Grid>
                                  </Grid>
                                </Paper>
                              </Grid>

                              {/* Linked Optical Prescription */}
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    mb: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      fontWeight: 750,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                    }}
                                  >
                                    Paired Optical Prescription
                                  </Typography>
                                  {linkedRx && (
                                    <Typography variant="caption" color="text.secondary">
                                      Recorded: {formatDate(linkedRx.createdAt)}
                                    </Typography>
                                  )}
                                </Box>

                                {linkedRx ? (
                                  <PairedPrescriptionCard
                                    prescription={linkedRx}
                                    onPrint={() =>
                                      handlePrint(
                                        prescriptionHtml(customer, linkedRx),
                                        "Optical Prescription",
                                      )
                                    }
                                    onCompare={() => {
                                      setCompareFirstId(linkedRx.id);
                                      const otherRx = customer.prescriptions.find(
                                        (p) => p.id !== linkedRx.id,
                                      );
                                      if (otherRx) setCompareSecondId(otherRx.id);
                                      setActiveTab(3);
                                    }}
                                  />
                                ) : (
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 3,
                                      borderRadius: 2,
                                      bgcolor: "action.hover",
                                      textAlign: "center",
                                      minHeight: 140,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <RemoveRedEyeOutlined
                                      sx={{ color: "text.secondary", fontSize: 28 }}
                                    />
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 650, color: "text.primary" }}
                                    >
                                      No Prescription Linked to This Purchase
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      This purchase was registered as an over-the-counter sale or
                                      without eye test data.
                                    </Typography>
                                  </Paper>
                                )}
                              </Grid>
                            </Grid>

                            <Divider sx={{ my: 2 }} />

                            {/* Bottom Actions of Expanded Card */}
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1.5}
                              sx={{
                                justifyContent: "space-between",
                                alignItems: { sm: "center" },
                              }}
                            >
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                useFlexGap
                                sx={{ ...customerActionSx, width: "100%" }}
                              >
                                <Button
                                  color="error"
                                  variant="outlined"
                                  size="small"
                                  startIcon={<DeleteOutline />}
                                  disabled={deleting}
                                  onClick={() => {
                                    setDeleteError("");
                                    setDeleteTarget(record);
                                  }}
                                  sx={{ width: { xs: "100%", sm: "auto" } }}
                                >
                                  Delete Purchase
                                </Button>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => togglePurchaseExpand(record.id)}
                                  sx={{ width: { xs: "100%", sm: "auto" } }}
                                >
                                  Collapse Details
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  startIcon={<ReceiptLongOutlined />}
                                  onClick={() => setSelectedRecord(record)}
                                  sx={{ fontWeight: 700, width: { xs: "100%", sm: "auto" } }}
                                >
                                  Prepare Receipt & WhatsApp PDF
                                </Button>
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Collapse>
                      </Card>
                    );
                  })
                )}
              </Stack>
            )}

            {/* TAB 1: Clinical Optical Prescriptions (OD / OS) */}
            {activeTab === 1 && (
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Clinical Optical Prescriptions
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Standardized optometry charts formatted by OD (Right Eye) and OS (Left Eye),
                      with automatic Add calculations.
                    </Typography>
                  </Box>

                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${customer.prescriptions.length} Recorded Tests`}
                    sx={{ fontWeight: 600, width: "fit-content" }}
                  />
                </Stack>

                {customer.prescriptions.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No optical prescription recorded for this customer.
                  </Alert>
                ) : (
                  sortedPrescriptions.map((prescription, index) => {
                    const rxType = classifyRx(prescription);
                    const linkedPurchases = customer.records.filter(
                      (r) => r.prescriptionId === prescription.id,
                    );

                    return (
                      <Card
                        id={`prescription-${prescription.id}`}
                        key={prescription.id}
                        variant="outlined"
                        sx={{
                          borderRadius: 2.5,
                          borderColor:
                            index === 0 ? (isDark ? "primary.main" : "#2563EB") : "divider",
                          boxShadow:
                            index === 0
                              ? isDark
                                ? "0 2px 10px rgba(59,130,246,0.18)"
                                : "0 2px 8px rgba(37,99,235,0.06)"
                              : "none",
                          overflow: "hidden",
                        }}
                      >
                        {/* Prescription Header Ribbon */}
                        <Box
                          sx={{
                            p: 2,
                            bgcolor:
                              index === 0
                                ? isDark
                                  ? "rgba(59, 130, 246, 0.12)"
                                  : "#EAF2FF"
                                : isDark
                                  ? "action.hover"
                                  : "#F1F5F9",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1.5}
                            sx={{
                              justifyContent: "space-between",
                              alignItems: { sm: "center" },
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              useFlexGap
                              sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}
                            >
                              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                Prescription {customer.prescriptions.length - index}
                              </Typography>

                              {index === 0 && (
                                <Chip
                                  size="small"
                                  color="primary"
                                  label="Latest recorded exam"
                                  sx={{ fontWeight: 700, height: 22 }}
                                />
                              )}

                              <Chip
                                size="small"
                                icon={<CalendarTodayOutlined sx={{ fontSize: 14 }} />}
                                label={formatDate(prescription.createdAt)}
                                variant="outlined"
                                sx={{ height: 22 }}
                              />

                              <Chip
                                label={rxType.label}
                                color={rxType.color}
                                size="small"
                                sx={{ height: 22, fontWeight: 600 }}
                              />
                            </Stack>

                            <Stack sx={customerActionSx}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PrintOutlined />}
                                onClick={() =>
                                  handlePrint(
                                    prescriptionHtml(customer, prescription),
                                    "Optical Prescription",
                                  )
                                }
                              >
                                Print
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                disabled={documentBusy}
                                startIcon={<PictureAsPdfOutlined />}
                                onClick={() => {
                                  void handlePdf(
                                    prescriptionHtml(customer, prescription),
                                    `prescription-${prescription.id}.pdf`,
                                    "prescription",
                                  );
                                }}
                              >
                                PDF
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<CompareArrowsOutlined />}
                                onClick={() => {
                                  setCompareFirstId(prescription.id);
                                  setActiveTab(3);
                                }}
                              >
                                Compare
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>

                        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                          {/* Optometric Table */}
                          <ClinicalPrescriptionTable prescription={prescription} />

                          {/* Dispensed Eyewear Connection */}
                          <Box sx={{ mt: 2.5 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                fontWeight: 750,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                display: "block",
                                mb: 1,
                              }}
                            >
                              Dispensed Eyewear for this Prescription
                            </Typography>

                            {linkedPurchases.length > 0 ? (
                              <Stack spacing={1}>
                                {linkedPurchases.map((purchase) => (
                                  <Paper
                                    key={purchase.id}
                                    variant="outlined"
                                    sx={{
                                      p: 1.5,
                                      borderRadius: 2,
                                      bgcolor: "action.hover",
                                      borderColor: "divider",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      flexWrap: "wrap",
                                      gap: 1,
                                    }}
                                  >
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      useFlexGap
                                      sx={{ alignItems: "center", flexWrap: "wrap", minWidth: 0 }}
                                    >
                                      <CheckCircleOutlineOutlined
                                        sx={{ color: "success.main", fontSize: 18 }}
                                      />
                                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                                        {purchase.specsType || "Frame"} +{" "}
                                        {purchase.lensType || "Lens"}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        label={formatDate(purchase.purchaseDate)}
                                        sx={{ fontSize: "0.72rem", height: 20 }}
                                      />
                                    </Stack>

                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 750,
                                        color: (theme) =>
                                          theme.palette.mode === "dark"
                                            ? "primary.light"
                                            : "primary.main",
                                      }}
                                    >
                                      {formatMoney(purchase.mrp)}
                                    </Typography>
                                  </Paper>
                                ))}
                              </Stack>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No purchase has been linked to this prescription yet.
                              </Typography>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Stack>
            )}

            {/* TAB 2: Vision Progression Timeline */}
            {activeTab === 2 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Vision Refractive Progression
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    View recorded measurements and calculated reading addition over time.
                    Differences describe saved measurements and are not a clinical interpretation.
                  </Typography>
                </Box>

                {customer.prescriptions.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No optical examinations recorded to track progression.
                  </Alert>
                ) : (
                  <>
                    {/* Progression cards for phones and smaller tablets. */}
                    <Box sx={{ display: { xs: "block", md: "none" } }}>
                      <Stack spacing={2}>
                        {sortedPrescriptions.map((rx, idx) => {
                          const reAdd = calculateAdd(rx.reNearSph, rx.reDistSph);
                          const leAdd = calculateAdd(rx.leNearSph, rx.leDistSph);
                          const type = classifyRx(rx);

                          return (
                            <Paper
                              key={rx.id}
                              variant="outlined"
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: "background.paper",
                                border: "1px solid",
                                borderColor:
                                  idx === 0 ? (isDark ? "primary.main" : "#2563EB") : "divider",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  mb: 1.5,
                                  flexWrap: "wrap",
                                  gap: 0.75,
                                }}
                              >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                                    {formatDate(rx.createdAt)}
                                  </Typography>
                                  {idx === 0 && (
                                    <Chip
                                      size="small"
                                      color="primary"
                                      label="Latest"
                                      sx={{ height: 20, fontSize: "0.68rem" }}
                                    />
                                  )}
                                </Box>
                                <Chip
                                  size="small"
                                  label={type.label}
                                  color={type.color}
                                  sx={{ height: 22, fontSize: "0.72rem" }}
                                />
                              </Box>

                              <Grid container spacing={1.5}>
                                {/* OD Right Eye Card */}
                                <Grid size={{ xs: 12 }}>
                                  <Box
                                    sx={{
                                      p: 1.25,
                                      borderRadius: 1.5,
                                      bgcolor: isDark ? "rgba(59, 130, 246, 0.08)" : "#EFF6FF",
                                      border: "1px solid",
                                      borderColor: isDark ? "rgba(59, 130, 246, 0.25)" : "#BFDBFE",
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        mb: 0.75,
                                      }}
                                    >
                                      <Chip
                                        size="small"
                                        label="OD (Right Eye)"
                                        sx={{
                                          fontWeight: 800,
                                          fontSize: "0.72rem",
                                          bgcolor: isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE",
                                          color: isDark ? "#93C5FD" : "#1D4ED8",
                                          height: 20,
                                        }}
                                      />
                                      {reAdd ? (
                                        <Chip
                                          size="small"
                                          label={`Add: ${reAdd}`}
                                          sx={{
                                            height: 20,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            bgcolor: isDark ? "rgba(59, 130, 246, 0.2)" : "#DBEAFE",
                                            color: isDark ? "#93C5FD" : "#1D4ED8",
                                          }}
                                        />
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          Add: —
                                        </Typography>
                                      )}
                                    </Box>

                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        textAlign: "center",
                                        color: "text.primary",
                                      }}
                                    >
                                      {formatPower(rx.reDistSph)} / {formatPower(rx.reDistCyl)} /{" "}
                                      {rx.reDistAxis != null ? `${rx.reDistAxis}°` : "—"}
                                    </Typography>
                                  </Box>
                                </Grid>

                                {/* OS Left Eye Card */}
                                <Grid size={{ xs: 12 }}>
                                  <Box
                                    sx={{
                                      p: 1.25,
                                      borderRadius: 1.5,
                                      bgcolor: isDark ? "rgba(16, 185, 129, 0.08)" : "#ECFDF5",
                                      border: "1px solid",
                                      borderColor: isDark ? "rgba(16, 185, 129, 0.25)" : "#A7F3D0",
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        mb: 0.75,
                                      }}
                                    >
                                      <Chip
                                        size="small"
                                        label="OS (Left Eye)"
                                        sx={{
                                          fontWeight: 800,
                                          fontSize: "0.72rem",
                                          bgcolor: isDark ? "rgba(16, 185, 129, 0.2)" : "#D1FAE5",
                                          color: isDark ? "#6EE7B7" : "#047857",
                                          height: 20,
                                        }}
                                      />
                                      {leAdd ? (
                                        <Chip
                                          size="small"
                                          label={`Add: ${leAdd}`}
                                          sx={{
                                            height: 20,
                                            fontSize: "0.72rem",
                                            fontWeight: 700,
                                            bgcolor: isDark ? "rgba(16, 185, 129, 0.2)" : "#D1FAE5",
                                            color: isDark ? "#6EE7B7" : "#047857",
                                          }}
                                        />
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          Add: —
                                        </Typography>
                                      )}
                                    </Box>

                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        textAlign: "center",
                                        color: "text.primary",
                                      }}
                                    >
                                      {formatPower(rx.leDistSph)} / {formatPower(rx.leDistCyl)} /{" "}
                                      {rx.leDistAxis != null ? `${rx.leDistAxis}°` : "—"}
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Box>

                    {/* Desktop progression table */}
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ display: { xs: "none", md: "block" }, borderRadius: 2 }}
                    >
                      <Table size="small" sx={{ minWidth: 780 }}>
                        <TableHead sx={{ bgcolor: "action.hover" }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Recorded Date</TableCell>
                            <TableCell
                              align="center"
                              sx={{ fontWeight: 700, color: isDark ? "primary.light" : "#1D4ED8" }}
                            >
                              OD Dist (Sph / Cyl / Axis)
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{ fontWeight: 700, color: isDark ? "primary.light" : "#1D4ED8" }}
                            >
                              OD Add
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{ fontWeight: 700, color: isDark ? "#34D399" : "#047857" }}
                            >
                              OS Dist (Sph / Cyl / Axis)
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{ fontWeight: 700, color: isDark ? "#34D399" : "#047857" }}
                            >
                              OS Add
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>
                              Classification
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sortedPrescriptions.map((rx, idx) => {
                            const reAdd = calculateAdd(rx.reNearSph, rx.reDistSph);
                            const leAdd = calculateAdd(rx.leNearSph, rx.leDistSph);
                            const type = classifyRx(rx);

                            return (
                              <TableRow key={rx.id} hover>
                                <TableCell sx={{ fontWeight: 650 }}>
                                  {formatDate(rx.createdAt)}
                                  {idx === 0 && (
                                    <Chip
                                      size="small"
                                      color="primary"
                                      label="Latest"
                                      sx={{ ml: 1, height: 20, fontSize: "0.68rem" }}
                                    />
                                  )}
                                </TableCell>

                                <TableCell
                                  align="center"
                                  sx={{ fontFamily: "monospace", fontWeight: 650 }}
                                >
                                  {formatPower(rx.reDistSph)} / {formatPower(rx.reDistCyl)} /{" "}
                                  {rx.reDistAxis != null ? `${rx.reDistAxis}°` : "—"}
                                </TableCell>

                                <TableCell align="center">
                                  {reAdd ? (
                                    <Chip
                                      size="small"
                                      label={reAdd}
                                      sx={{
                                        height: 20,
                                        fontSize: "0.72rem",
                                        bgcolor: isDark ? "rgba(59, 130, 246, 0.18)" : "#EFF6FF",
                                        color: isDark ? "#93C5FD" : "#1D4ED8",
                                        border: isDark
                                          ? "1px solid rgba(59, 130, 246, 0.35)"
                                          : "none",
                                      }}
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>

                                <TableCell
                                  align="center"
                                  sx={{ fontFamily: "monospace", fontWeight: 650 }}
                                >
                                  {formatPower(rx.leDistSph)} / {formatPower(rx.leDistCyl)} /{" "}
                                  {rx.leDistAxis != null ? `${rx.leDistAxis}°` : "—"}
                                </TableCell>

                                <TableCell align="center">
                                  {leAdd ? (
                                    <Chip
                                      size="small"
                                      label={leAdd}
                                      sx={{
                                        height: 20,
                                        fontSize: "0.72rem",
                                        bgcolor: isDark ? "rgba(16, 185, 129, 0.18)" : "#ECFDF5",
                                        color: isDark ? "#6EE7B7" : "#047857",
                                        border: isDark
                                          ? "1px solid rgba(16, 185, 129, 0.35)"
                                          : "none",
                                      }}
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>

                                <TableCell align="center">
                                  <Chip
                                    size="small"
                                    label={type.label}
                                    color={type.color}
                                    sx={{ height: 22, fontSize: "0.72rem" }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Stack>
            )}

            {/* TAB 3: Side-by-side comparison of any two prescriptions. */}
            {activeTab === 3 && (
              <PrescriptionComparison
                prescriptions={customer.prescriptions}
                records={customer.records}
                firstIdProp={compareFirstId}
                secondIdProp={compareSecondId}
              />
            )}

            {/* TAB 4: Confidential Staff & Clinical Notes */}
            {activeTab === 4 && (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Internal Staff & Clinical Notes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Confidential optometry observations, lens adaptation history, and patient
                    preferences.
                  </Typography>
                </Box>

                <Alert severity="info" icon={<LockOutlined />} sx={{ borderRadius: 2 }}>
                  Private information for shop staff and optometrists only. These notes are strictly
                  excluded from customer receipts, PDFs, and WhatsApp messages.
                </Alert>

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.5, sm: 3 },
                    borderRadius: 2.5,
                    bgcolor: "background.paper",
                    minHeight: 140,
                  }}
                >
                  <Typography
                    sx={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      color: customer.notes ? "text.primary" : "text.secondary",
                    }}
                  >
                    {customer.notes || "No internal staff or clinical notes recorded."}
                  </Typography>
                </Paper>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    justifyContent: "space-between",
                    alignItems: { xs: "stretch", sm: "center" },
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Last modified: {formatDate(customer.updatedAt)}
                  </Typography>

                  <Button
                    component={Link}
                    to={editUrl}
                    variant="outlined"
                    startIcon={<EditOutlined />}
                  >
                    Edit Clinical Notes
                  </Button>
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Bottom Actions Bar */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
            pt: 1,
          }}
        >
          <Button
            component={Link}
            to={backUrl}
            variant="outlined"
            startIcon={<ArrowBackOutlined />}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            All Customers
          </Button>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.5,
              width: { xs: "100%", sm: "auto" },
              justifyContent: { xs: "stretch", sm: "flex-end" },
              "& > *": {
                flex: { xs: "1 1 100%", sm: "0 0 auto" },
                minHeight: 44,
              },
            }}
          >
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutline />}
              disabled={deleting}
              onClick={() => {
                setDeleteError("");
                setDeleteTarget("customer");
              }}
            >
              Delete Customer
            </Button>
            <Button component={Link} to={editUrl} variant="contained" startIcon={<EditOutlined />}>
              Edit Customer
            </Button>
          </Box>
        </Stack>
      </Stack>

      <ResponsiveDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {deleteTarget === "customer" ? "Delete Customer?" : "Delete Purchase?"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
            <Typography>
              {deleteTarget === "customer"
                ? "Are you sure you want to delete this customer? All purchase records, optical prescriptions, and other customer-owned records will also be deleted."
                : "Are you sure you want to delete this purchase? The selected purchase will be deleted. Its linked prescription will also be deleted only if it belongs exclusively to this purchase and is not used elsewhere."}
            </Typography>
            {deleteTarget === "customer" ? (
              <>
                <DetailItem label="Customer name" value={customer.name} />
                <DetailItem label="Mobile number" value={customer.mobNumber} />
                <DetailItem label="Linked purchases" value={customer.records.length} />
                <DetailItem label="Linked prescriptions" value={customer.prescriptions.length} />
              </>
            ) : (
              deleteTarget && (
                <>
                  <DetailItem label="Purchase date" value={formatDate(deleteTarget.purchaseDate)} />
                  <DetailItem label="Frame / Spectacle" value={deleteTarget.specsType} />
                  <DetailItem label="Lens Type" value={deleteTarget.lensType} />
                  <DetailItem label="Total MRP" value={formatMoney(deleteTarget.mrp)} />
                  <DetailItem
                    label="Linked prescription"
                    value={deleteTarget.prescriptionId || "None"}
                  />
                  {customer.prescriptions.find((rx) => rx.id === deleteTarget.prescriptionId) && (
                    <ClinicalPrescriptionTable
                      prescription={customer.prescriptions.find(
                        (rx) => rx.id === deleteTarget.prescriptionId,
                      )!}
                      compact
                    />
                  )}
                </>
              )
            )}
            <Typography variant="body2" color="text.secondary">
              Deleted records can be recovered from Trash.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={customerActionSx}>
          <Button autoFocus disabled={deleting} onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={() => void confirmDelete()}
          >
            {deleting
              ? "Deleting…"
              : deleteTarget === "customer"
                ? "Delete Customer"
                : "Delete Purchase"}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      {purchaseDialogOpen && (
        <AddPurchaseDialog
          key={customer.id}
          customer={customer}
          renderPrescriptionPreview={(rx) => (
            <ClinicalPrescriptionTable prescription={rx} compact />
          )}
          onClose={() => setPurchaseDialogOpen(false)}
          onSuccess={(record) => {
            requestRef.current?.abort();
            setRefreshing(false);
            setCustomer((previous) =>
              previous?.id === customer.id
                ? {
                    ...previous,
                    records: [...previous.records.filter((item) => item.id !== record.id), record],
                    prescriptions: record.prescription
                      ? [
                          ...previous.prescriptions.filter(
                            (rx) => rx.id !== record.prescription?.id,
                          ),
                          record.prescription,
                        ]
                      : previous.prescriptions,
                  }
                : previous,
            );
            setActiveTab(0);
            setPurchaseMessage("Purchase saved successfully.");
          }}
        />
      )}

      {/* Existing Receipt Preview Dialog with 100% Preserved Props & Logic */}
      {selectedRecord && (
        <ReceiptPreviewDialog
          key={selectedRecord.id}
          customer={customer}
          record={selectedRecord}
          busy={documentBusy}
          onClose={() => setSelectedRecord(null)}
          onPrint={handlePrint}
          onPdf={handlePdf}
          onWhatsAppPdf={handleWhatsAppPdf}
        />
      )}
    </Box>
  );
}
