/**
 * Optical CRM — Dashboard
 *
 * Clean, fast, professional starting page for Harshu Chasma Ghar.
 * Provides quick customer lookup and 3 core operational actions:
 * 1. Add Customer
 * 2. Customer Records
 * 3. Business Analytics
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";

import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";

// ------------------------------------------------------------------
// ACTION CARD COMPONENT
// ------------------------------------------------------------------

interface ActionCardProps {
  title: string;
  description: string;
  buttonText: string;
  destination: string;
  icon: ReactNode;
  accentColor: string;
}

function ActionCard({
  title,
  description,
  buttonText,
  destination,
  icon,
  accentColor,
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
          p: 3,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          "&:last-child": { pb: 3 },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            bgcolor: `${accentColor}12`,
            color: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          {icon}
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.1rem", mb: 1 }}>
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.65,
            mb: 3,
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
            px: 2,
            py: 0.75,
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = search.trim();
    if (!value) {
      navigate("/customers");
      return;
    }
    navigate(`/customers?search=${encodeURIComponent(value)}`);
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", pb: 6, minWidth: 0 }}>
      <Stack spacing={3.5}>
        {/* ------------------------------------------
            PAGE HEADER BANNER
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
          }}
        >
          {/* Top primary accent line */}
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
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                alignItems: { xs: "flex-start", sm: "center" },
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
                  Optical CRM & Practice Management. Search customer records, add new clients, and
                  review business analytics.
                </Typography>
              </Box>

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
                  py: 1,
                  boxShadow: "0 4px 14px 0 rgba(37, 99, 235, 0.3)",
                }}
              >
                Add Customer
              </Button>
            </Stack>
          </CardContent>
        </Card>

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
            THE 3 CORE ACTIONS (Add Customer, Customer Records, Business Analytics)
        ------------------------------------------ */}
        <Box>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Direct access to essential optical CRM workflows.
            </Typography>
          </Stack>

          <Grid container spacing={2.5}>
            {/* 1. Add Customer */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ActionCard
                title="Add Customer"
                description="Register personal information, optical refraction prescriptions, and spectacle purchase records."
                buttonText="Add Customer"
                destination="/customers/new"
                icon={<PersonAddAltOutlined fontSize="medium" />}
                accentColor="#2563EB"
              />
            </Grid>

            {/* 2. Customer Records */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ActionCard
                title="Customer Records"
                description="Browse patient database, search by name or phone, view previous prescriptions, and update details."
                buttonText="View Records"
                destination="/customers"
                icon={<PeopleOutlined fontSize="medium" />}
                accentColor="#0284C7"
              />
            </Grid>

            {/* 3. Business Analytics */}
            <Grid size={{ xs: 12, md: 4 }}>
              <ActionCard
                title="Business Analytics"
                description="Track revenue trends, monthly sales performance, frame and lens category distribution, and growth charts."
                buttonText="View Analytics"
                destination="/analytics"
                icon={<AssessmentOutlined fontSize="medium" />}
                accentColor="#0D9488"
              />
            </Grid>
          </Grid>
        </Box>
      </Stack>
    </Box>
  );
}
