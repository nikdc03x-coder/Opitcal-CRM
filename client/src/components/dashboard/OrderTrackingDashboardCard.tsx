import { useEffect, useState } from "react";
import { Link } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";

import { fetchOrderCounts } from "../../services/orderApi";
import { type OrderCounts } from "../../models/order";

// A small live overview with direct access to order actions.
export default function OrderTrackingDashboardCard() {
  const [counts, setCounts] = useState<OrderCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // This is separate from Sales Analytics.
  // An order API failure must not block the dashboard.
  useEffect(() => {
    const controller = new AbortController();

    fetchOrderCounts(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setCounts(data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Order counts are temporarily unavailable.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          {/* Heading */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { md: "center" },
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  color: "primary.main",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Inventory2Outlined />
              </Box>

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Order Tracking
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Manage orders from preparation to pickup.
                </Typography>
              </Box>
            </Stack>

            <Chip label="Order Management" color="primary" variant="outlined" size="small" />
          </Stack>

          {/* Live order statistics */}
          {loading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading orders...
              </Typography>
            </Stack>
          ) : counts ? (
            <Grid container spacing={1.5}>
              {[
                {
                  label: "Active",
                  value: counts?.active ?? 0,
                  link: "/orders?status=ACTIVE",
                },
                {
                  label: "Ready",
                  value: counts?.ready ?? 0,
                  link: "/orders?status=READY",
                },
                {
                  label: "Overdue",
                  value: counts?.overdue ?? 0,
                  link: "/orders?status=OVERDUE",
                },
              ].map((stat) => (
                <Grid key={stat.label} size={{ xs: 4 }}>
                  <Button
                    component={Link}
                    to={stat.link}
                    fullWidth
                    sx={{
                      height: "100%",
                      p: { xs: 1, sm: 2 },
                      borderRadius: 2,
                      bgcolor: "action.hover",
                      display: "flex",
                      flexDirection: "column",
                      textTransform: "none",
                      color: "text.primary",
                    }}
                  >
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {stat.value}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Button>
                </Grid>
              ))}
            </Grid>
          ) : null}

          {error && <Alert severity="info">{error}</Alert>}

          {/* Fast navigation */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              component={Link}
              to="/orders"
              variant="outlined"
              endIcon={<ArrowForwardOutlined />}
              sx={{ textTransform: "none" }}
            >
              View All Orders
            </Button>

            <Button
              component={Link}
              to="/orders?create=1"
              variant="contained"
              startIcon={<AddOutlined />}
              sx={{ textTransform: "none" }}
            >
              Create New Order
            </Button>

            {(counts?.ready ?? 0) > 0 && (
              <Button
                component={Link}
                to="/orders?status=READY"
                color="success"
                variant="text"
                sx={{ textTransform: "none" }}
              >
                View Ready Orders
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
