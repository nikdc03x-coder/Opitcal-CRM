import { Box, Button, Stack } from "@mui/material";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";

import { Link } from "react-router";

import DashboardAnalytics from "../components/dashboard/DashboardAnalytics";

// Display Business Analytics on its own page.
// Reuse the existing charts, filters, and backend API.
export default function BusinessAnalyticsPage() {
  return (
    <Box
      sx={{
        maxWidth: 1500,
        mx: "auto",
        pb: 5,
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Button
            component={Link}
            to="/dashboard"
            startIcon={<ArrowBackOutlined />}
            sx={{
              textTransform: "none",
            }}
          >
            Back to Dashboard
          </Button>
        </Box>

        {/* Existing analytics functionality stays unchanged. */}
        <DashboardAnalytics />
      </Stack>
    </Box>
  );
}
