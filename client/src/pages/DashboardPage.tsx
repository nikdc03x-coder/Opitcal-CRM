/**
 * Optical CRM — Dashboard
 *
 * Professional, modern operational dashboard for Harshu Chasma Ghar.
 *
 * Provides real-time metrics, quick customer lookup, streamlined
 * daily navigation, order fulfillment tracking, and eye checkup recall status.
 */

import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import WhatsApp from "@mui/icons-material/WhatsApp";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";

import OrderTrackingDashboardCard from "../components/dashboard/OrderTrackingDashboardCard";
import { getDashboardAnalytics } from "../services/dashboardApi";
import { fetchReminderDashboard, type ReminderDashboardData } from "../services/reminderApi";
import { fetchOrderCounts } from "../services/orderApi";
import type { DashboardAnalyticsData } from "../models/dashboard";
import type { OrderCounts } from "../models/order";

// Indian currency formatter
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ------------------------------------------------------------------
// KPI METRIC CARD COMPONENT
// ------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  accentColor: string;
  destination: string;
  badge?: ReactNode;
  loading?: boolean;
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  accentColor,
  destination,
  badge,
  loading = false,
}: KpiCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        transition:
          "transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out, border-color 0.15s ease-in-out",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 24px -4px rgba(0, 0, 0, 0.08)",
          borderColor: accentColor,
        },
      }}
    >
      <CardActionArea
        component={Link}
        to={destination}
        sx={{
          height: "100%",
          p: 2.25,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: `${accentColor}12`,
                color: accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {icon}
            </Box>
            {badge}
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600, fontSize: "0.825rem", mb: 0.5 }}
          >
            {label}
          </Typography>

          {loading ? (
            <Skeleton width="60%" height={40} />
          ) : (
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}
            >
              {value}
            </Typography>
          )}
        </Box>

        <Stack
          direction="row"
          sx={{ mt: 1.5, alignItems: "center", justifyContent: "space-between" }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            {subtitle}
          </Typography>
          <ArrowForwardOutlined sx={{ fontSize: 16, color: "text.secondary" }} />
        </Stack>
      </CardActionArea>
    </Card>
  );
}

// ------------------------------------------------------------------
// QUICK ACTION CARD COMPONENT
// ------------------------------------------------------------------

interface ActionCardProps {
  title: string;
  description: string;
  buttonText: string;
  destination: string;
  icon: ReactNode;
  accentColor: string;
  badgeText?: string;
}

function ActionCard({
  title,
  description,
  buttonText,
  destination,
  icon,
  accentColor,
  badgeText,
}: ActionCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        borderColor: "divider",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          borderColor: accentColor,
          boxShadow: "0 6px 20px -2px rgba(0, 0, 0, 0.06)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <CardContent
        sx={{
          p: 2.5,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          "&:last-child": { pb: 2.5 },
        }}
      >
        <Stack
          direction="row"
          sx={{ mb: 2, alignItems: "center", justifyContent: "space-between" }}
        >
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: 2.5,
              bgcolor: `${accentColor}12`,
              color: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>

          {badgeText && (
            <Chip
              label={badgeText}
              size="small"
              sx={{
                fontSize: "0.725rem",
                fontWeight: 600,
                bgcolor: `${accentColor}15`,
                color: accentColor,
                border: "none",
              }}
            />
          )}
        </Stack>

        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem", mb: 0.75 }}>
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.6,
            mb: 2.5,
            flexGrow: 1,
          }}
        >
          {description}
        </Typography>

        <Button
          component={Link}
          to={destination}
          variant="outlined"
          endIcon={<ArrowForwardOutlined />}
          sx={{
            alignSelf: "flex-start",
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            borderColor: "divider",
            color: "text.primary",
            "&:hover": {
              borderColor: accentColor,
              bgcolor: `${accentColor}08`,
              color: accentColor,
            },
          }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------
// MAIN DASHBOARD PAGE
// ------------------------------------------------------------------

export default function DashboardPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time backend data
  const [analytics, setAnalytics] = useState<DashboardAnalyticsData | null>(null);
  const [reminderData, setReminderData] = useState<ReminderDashboardData | null>(null);
  const [orderCounts, setOrderCounts] = useState<OrderCounts | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  // Format today's date
  const todayFormatted = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  // Load operational datasets
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadDashboardData() {
      setLoading(true);
      setDataError(null);

      const [analyticsRes, remindersRes, ordersRes] = await Promise.allSettled([
        getDashboardAnalytics(controller.signal),
        fetchReminderDashboard(),
        fetchOrderCounts(controller.signal),
      ]);

      if (!active) return;

      if (analyticsRes.status === "fulfilled") {
        setAnalytics(analyticsRes.value);
      }
      if (remindersRes.status === "fulfilled") {
        setReminderData(remindersRes.value);
      }
      if (ordersRes.status === "fulfilled") {
        setOrderCounts(ordersRes.value);
      }

      // If all three failed, report error
      if (
        analyticsRes.status === "rejected" &&
        remindersRes.status === "rejected" &&
        ordersRes.status === "rejected"
      ) {
        setDataError("Could not load dashboard metrics. Database may be warming up.");
      }

      setLoading(false);
    }

    void loadDashboardData();

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshKey]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    if (!value) {
      navigate("/customers");
      return;
    }
    navigate(`/customers?search=${encodeURIComponent(value)}`);
  }

  // Calculate annual revenue from analytics if available
  const annualRevenue = analytics?.years?.[0]?.value ?? 0;
  const currentYear = analytics?.currentYear ?? new Date().getFullYear();

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", pb: 6, minWidth: 0 }}>
      <Stack spacing={3.5}>
        {/* ------------------------------------------
            HERO GREETING BANNER
        ------------------------------------------ */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3.5,
            borderColor: "divider",
            background: (theme) =>
              theme.palette.mode === "dark"
                ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            boxShadow: "0 2px 12px -2px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Subtle top primary accent line */}
          <Box
            sx={{
              height: 4,
              width: "100%",
              background: "linear-gradient(90deg, #2563EB 0%, #06B6D4 100%)",
            }}
          />

          <CardContent
            sx={{ p: { xs: 2.5, sm: 3.5 }, "&:last-child": { pb: { xs: 2.5, sm: 3.5 } } }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2.5}
              sx={{
                alignItems: { xs: "flex-start", md: "center" },
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Stack direction="row" spacing={1.5} sx={{ mb: 0.75, alignItems: "center" }}>
                  <StorefrontOutlined sx={{ color: "primary.main", fontSize: 28 }} />
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: "-0.5px",
                      color: "text.primary",
                    }}
                  >
                    Harshu Chasma Ghar
                  </Typography>
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: "0.95rem",
                    maxWidth: 680,
                    lineHeight: 1.6,
                  }}
                >
                  Optical practice management, eye examination records, spectacle orders, and
                  6-month automated checkup recalls.
                </Typography>
              </Box>

              {/* Status and Action shortcuts */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{
                  width: { xs: "100%", md: "auto" },
                  alignItems: { xs: "stretch", sm: "center" },
                }}
              >
                <Chip
                  icon={<CalendarTodayOutlined fontSize="small" />}
                  label={todayFormatted}
                  variant="outlined"
                  sx={{
                    fontWeight: 600,
                    borderRadius: 2,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                    py: 2,
                    px: 0.5,
                  }}
                />

                <Tooltip title="Refresh dashboard data">
                  <IconButton
                    onClick={() => setRefreshKey((k) => k + 1)}
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "background.paper",
                    }}
                  >
                    <RefreshOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Button
                  component={Link}
                  to="/customers/new"
                  variant="contained"
                  startIcon={<PersonAddAltOutlined />}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: "none",
                    px: 2.5,
                    boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.3)",
                  }}
                >
                  New Customer
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {dataError && (
          <Alert severity="warning" onClose={() => setDataError(null)}>
            {dataError}
          </Alert>
        )}

        {/* ------------------------------------------
            TOP OPERATIONAL KPI METRICS
        ------------------------------------------ */}
        <Grid container spacing={2}>
          {/* 1. Total Customers */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label="TOTAL CUSTOMERS"
              value={analytics ? analytics.totalCustomers.toLocaleString("en-IN") : "—"}
              subtitle="Registered patient records"
              icon={<PeopleOutlined fontSize="medium" />}
              accentColor="#2563EB"
              destination="/customers"
              loading={loading}
            />
          </Grid>

          {/* 2. Reminders Due Today */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label="CHECKUP REMINDERS DUE"
              value={reminderData ? reminderData.stats.due : "—"}
              subtitle={
                reminderData?.stats.upcoming
                  ? `${reminderData.stats.upcoming} scheduled upcoming`
                  : "6-month checkup recalls"
              }
              icon={<WhatsApp fontSize="medium" />}
              accentColor="#059669"
              destination="/reminders"
              loading={loading}
              badge={
                (reminderData?.stats.due ?? 0) > 0 ? (
                  <Chip
                    label="Action Needed"
                    size="small"
                    sx={{
                      bgcolor: "#DCFCE7",
                      color: "#15803D",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      border: "none",
                    }}
                  />
                ) : (
                  <Chip
                    label="Up to date"
                    size="small"
                    sx={{
                      bgcolor: "action.hover",
                      color: "text.secondary",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                    }}
                  />
                )
              }
            />
          </Grid>

          {/* 3. Active Spectacle Orders */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label="ACTIVE ORDERS"
              value={orderCounts ? orderCounts.active : "—"}
              subtitle={
                orderCounts
                  ? `${orderCounts.ready} ready • ${orderCounts.processing} in workshop`
                  : "Spectacle dispensing tracking"
              }
              icon={<AssignmentOutlined fontSize="medium" />}
              accentColor="#7C3AED"
              destination="/orders"
              loading={loading}
              badge={
                (orderCounts?.ready ?? 0) > 0 ? (
                  <Chip
                    label={`${orderCounts?.ready} Ready`}
                    size="small"
                    sx={{
                      bgcolor: "#EDE9FE",
                      color: "#6D28D9",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                    }}
                  />
                ) : undefined
              }
            />
          </Grid>

          {/* 4. Sales / Analytics */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <KpiCard
              label={`${currentYear} SALES VOLUME`}
              value={analytics && annualRevenue > 0 ? formatCurrency(annualRevenue) : "—"}
              subtitle="View detailed business analytics"
              icon={<AssessmentOutlined fontSize="medium" />}
              accentColor="#0284C7"
              destination="/analytics"
              loading={loading}
            />
          </Grid>
        </Grid>

        {/* ------------------------------------------
            FIND A CUSTOMER (FAST SEARCH)
        ------------------------------------------ */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0 1px 4px 0 rgba(0, 0, 0, 0.02)",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2.5, md: 3 },
              "&:last-child": { pb: { xs: 2.5, md: 3 } },
            }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Find a Customer
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Search registered customers by name or 10-digit mobile number to open
                  prescriptions and purchase history.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSearch}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <TextField
                    fullWidth
                    autoComplete="off"
                    size="medium"
                    label="Customer Name or Mobile Number"
                    placeholder="e.g. Ramesh Kumar or 9826012345..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchOutlined color="action" />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<SearchOutlined />}
                    sx={{
                      minWidth: { xs: "100%", sm: 160 },
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 700,
                    }}
                  >
                    Search
                  </Button>
                </Stack>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Multiple family members registered with the same mobile number will appear cleanly
                  as separate profiles.
                </Typography>

                <Button
                  component={Link}
                  to="/customers"
                  size="small"
                  variant="text"
                  endIcon={<ArrowForwardOutlined sx={{ fontSize: 14 }} />}
                  sx={{ textTransform: "none", fontWeight: 600, p: 0 }}
                >
                  Browse all customers
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            QUICK ACTIONS (6 MODULE GRID)
        ------------------------------------------ */}
        <Box>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Direct access to optical shop workflows and tools.
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            {/* 1. Add Customer */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Add New Customer"
                description="Register personal information, optical refraction prescription, and initial purchase details."
                buttonText="Add Customer"
                destination="/customers/new"
                icon={<PersonAddAltOutlined fontSize="medium" />}
                accentColor="#2563EB"
              />
            </Grid>

            {/* 2. Customer Directory */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Customer Records"
                description="Browse patient database, review past eye prescriptions, order history, and update contact information."
                buttonText="View Customers"
                destination="/customers"
                icon={<PeopleOutlined fontSize="medium" />}
                accentColor="#0284C7"
              />
            </Grid>

            {/* 3. Eye Checkup Reminders */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Eye Checkup Reminders"
                description="WhatsApp follow-up sequences for customers whose last purchase or examination was 6 months ago."
                buttonText="Open Reminders"
                destination="/reminders"
                icon={<WhatsApp fontSize="medium" />}
                accentColor="#059669"
                badgeText="6-Month Recall"
              />
            </Grid>

            {/* 4. Spectacle Orders */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Spectacle Orders"
                description="Track lens fitting in workshop, manage ready for pickup status, and record customer deliveries."
                buttonText="Track Orders"
                destination="/orders"
                icon={<AssignmentOutlined fontSize="medium" />}
                accentColor="#7C3AED"
                badgeText="Workshop"
              />
            </Grid>

            {/* 5. Product Catalog */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Product Catalog"
                description="Maintain frame brands, lens designs, anti-reflective coatings, index types, and pricing configurations."
                buttonText="Manage Catalog"
                destination="/admin/catalog"
                icon={<Inventory2Outlined fontSize="medium" />}
                accentColor="#EA580C"
              />
            </Grid>

            {/* 6. Business Analytics */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Business Analytics"
                description="Interactive multi-year sales reports, revenue trends, monthly comparisons, and category insights."
                buttonText="View Analytics"
                destination="/analytics"
                icon={<AssessmentOutlined fontSize="medium" />}
                accentColor="#0D9488"
              />
            </Grid>
          </Grid>
        </Box>

        {/* ------------------------------------------
            OPERATIONAL PANELS: ORDERS & EYE RECALL
        ------------------------------------------ */}
        <Grid container spacing={2.5}>
          {/* Left: Live Order Tracking Card */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <OrderTrackingDashboardCard />
          </Grid>

          {/* Right: Eye Checkup Recall Quick Summary */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                borderRadius: 3,
                borderColor: "divider",
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <CardContent sx={{ p: 2.5, flexGrow: 1, "&:last-child": { pb: 2.5 } }}>
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          bgcolor: "#DCFCE7",
                          color: "#15803D",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <NotificationsActiveOutlined fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Eye Checkup Recall
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Mode:{" "}
                          {reminderData?.mode === "MANUAL_FREE"
                            ? "Free Manual WhatsApp"
                            : (reminderData?.mode ?? "Active")}
                        </Typography>
                      </Box>
                    </Stack>

                    <Chip
                      label="6-Month Cycle"
                      size="small"
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.72rem",
                        bgcolor: "action.hover",
                      }}
                    />
                  </Stack>

                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Keep patient vision healthy and retain loyal customers with automated WhatsApp
                    reminders 6 months after spectacles purchase.
                  </Typography>

                  <Divider />

                  {/* Summary metric rows */}
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Due Reminders (Today)
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: (reminderData?.stats.due ?? 0) > 0 ? "error.main" : "text.primary",
                        }}
                      >
                        {reminderData?.stats.due ?? 0}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Upcoming in Sequence
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {reminderData?.stats.upcoming ?? 0}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Total Eligible Customers
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {reminderData?.stats.totalEligible ?? 0}
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Confirmed Sent
                      </Typography>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, color: "success.main" }}
                      >
                        {reminderData?.stats.confirmedSent ?? 0}
                      </Typography>
                    </Stack>
                  </Stack>

                  <Box sx={{ pt: 1 }}>
                    <Button
                      component={Link}
                      to="/reminders"
                      fullWidth
                      variant="contained"
                      color="primary"
                      startIcon={<WhatsApp />}
                      endIcon={<ArrowForwardOutlined />}
                      sx={{
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 700,
                        py: 1,
                      }}
                    >
                      Open Eye Checkup Reminders
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ------------------------------------------
            PRACTICE WORKFLOW GUIDANCE
        ------------------------------------------ */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Harshu Chasma Ghar — Daily Optical Practice Workflow
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Standard operating procedure for patient intake, examination, spectacle dispensing,
              and follow-up care.
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: "action.hover",
                    height: "100%",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "primary.main" }}>
                      STEP 1
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Intake & Search
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem", lineHeight: 1.5 }}
                  >
                    Search customer by mobile number first to review previous prescription and frame
                    records. Register if new.
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: "action.hover",
                    height: "100%",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "primary.main" }}>
                      STEP 2
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Refraction & Rx
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem", lineHeight: 1.5 }}
                  >
                    Record Spherical, Cylindrical, Axis, and Addition powers for both Distance and
                    Near vision.
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: "action.hover",
                    height: "100%",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "primary.main" }}>
                      STEP 3
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Dispensing & Order
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem", lineHeight: 1.5 }}
                  >
                    Select frames and lens coatings. Create a spectacle workshop order and track
                    until customer pickup.
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: "action.hover",
                    height: "100%",
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "success.main" }}>
                      STEP 4
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      6-Month Recall
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem", lineHeight: 1.5 }}
                  >
                    System automatically enqueues customer for routine eye checkup 6 months
                    post-purchase via WhatsApp.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
