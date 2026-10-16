/**
 * Optical CRM — 404 Not Found Page
 *
 * Display a friendly error when a user opens
 * a route that does not exist.
 *
 * Help shop staff quickly return to their work.
 */

import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";

import HomeOutlined from "@mui/icons-material/HomeOutlined";
import PeopleOutlineOutlined from "@mui/icons-material/PeopleOutlineOutlined";
import SearchOffOutlined from "@mui/icons-material/SearchOffOutlined";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";

import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: "65vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 5,
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 4,
          textAlign: "center",
        }}
      >
        <CardContent
          sx={{
            p: { xs: 3, sm: 5 },
            "&:last-child": {
              pb: { xs: 3, sm: 5 },
            },
          }}
        >
          <Stack spacing={2} sx={{ alignItems: "center" }}>
            {/* Error icon */}
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: 3,
                bgcolor: "action.hover",
                color: "primary.main",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <SearchOffOutlined sx={{ fontSize: 42 }} />
            </Box>

            {/* Error heading */}
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                letterSpacing: "-2px",
              }}
            >
              404
            </Typography>

            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Page Not Found
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 390,
                lineHeight: 1.7,
              }}
            >
              The page you're looking for doesn't exist, or its address may have changed. You can
              return to your dashboard or continue managing customers.
            </Typography>

            {/* Navigation actions */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{
                width: "100%",
                justifyContent: "center",
                pt: 2,
              }}
            >
              <Button
                component={Link}
                to="/dashboard"
                variant="contained"
                startIcon={<HomeOutlined />}
                sx={{
                  borderRadius: 2,
                  minHeight: 44,
                }}
              >
                Dashboard
              </Button>

              <Button
                component={Link}
                to="/customers"
                variant="outlined"
                startIcon={<PeopleOutlineOutlined />}
                sx={{
                  borderRadius: 2,
                  minHeight: 44,
                }}
              >
                View Customers
              </Button>
            </Stack>

            {/* Browser back navigation */}
            <Button
              variant="text"
              startIcon={<ArrowBackOutlined />}
              onClick={() => window.history.back()}
              sx={{ mt: 1 }}
            >
              Go Back
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
