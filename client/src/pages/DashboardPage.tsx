/**
 * Optical CRM — Dashboard
 *
 * Main starting page for optical shop staff.
 *
 * Make the most common tasks easy to find:
 * search customers, register customers, view records,
 * and manage frame/lens catalog products.
 */

import { useState, type FormEvent } from "react";

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
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";

// Quick access to order preparation and delivery.
import OrderTrackingDashboardCard from "../components/dashboard/OrderTrackingDashboardCard";

import { Link, useNavigate } from "react-router";

// Keep all quick-action cards consistent.
// Every card provides one clear navigation action.

type ActionCardProps = {
  title: string;
  description: string;
  buttonText: string;
  destination: string;
  icon: React.ReactNode;
};

function ActionCard({ title, description, buttonText, destination, icon }: ActionCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        transition: "border-color 0.2s, box-shadow 0.2s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: 2,
        },
      }}
    >
      <CardContent
        sx={{
          p: 2.5,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          "&:last-child": {
            pb: 2.5,
          },
        }}
      >
        {/* Action icon */}
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            bgcolor: "action.hover",
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          {icon}
        </Box>

        {/* Action description */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: "1.05rem",
            mb: 0.75,
          }}
        >
          {title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.7,
            mb: 2.5,
            flexGrow: 1,
          }}
        >
          {description}
        </Typography>

        {/* Open the selected CRM page */}
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
          }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  // Send the search text to the existing customer
  // search page. The URL preserves the search value
  // when staff open a customer and return to the list.

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
    <Box
      sx={{
        maxWidth: 1280,
        mx: "auto",
        pb: 5,
      }}
    >
      <Stack spacing={3}>
        {/* ------------------------------------------
            PAGE HEADER
        ------------------------------------------ */}

        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.5px",
            }}
          >
            Optical CRM
          </Typography>

          <Typography
            color="text.secondary"
            sx={{
              mt: 0.75,
              fontSize: "0.95rem",
            }}
          >
            Manage customer records, prescriptions, purchases and optical products in one place.
          </Typography>
        </Box>

        {/* ------------------------------------------
            MAIN CUSTOMER SEARCH
        ------------------------------------------ */}

        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2.5, md: 3 },
              "&:last-child": {
                pb: { xs: 2.5, md: 3 },
              },
            }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Find a Customer
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Search by customer name or mobile number to open their records.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSearch}>
                <Stack
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  spacing={1.5}
                >
                  <TextField
                    fullWidth
                    autoComplete="off"
                    size="medium"
                    label="Customer Name or Mobile Number"
                    placeholder="Search customers..."
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
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<SearchOutlined />}
                    sx={{
                      minWidth: {
                        xs: "100%",
                        sm: 165,
                      },
                      borderRadius: 2,
                      textTransform: "none",
                      fontWeight: 700,
                    }}
                  >
                    Search
                  </Button>
                </Stack>
              </Box>

              <Typography variant="caption" color="text.secondary">
                Customers with the same mobile number will appear as separate records.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* ------------------------------------------
            QUICK ACTIONS
        ------------------------------------------ */}

        <Box>
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Quick Actions
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Choose what you want to do next.
            </Typography>
          </Stack>

          <Grid container spacing={2}>
            {/* Add customer */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Add New Customer"
                description={
                  "Register personal information, " + "eye prescription and purchase details."
                }
                buttonText="Add Customer"
                destination="/customers/new"
                icon={<PersonAddAltOutlined fontSize="medium" />}
              />
            </Grid>

            {/* View customer records */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Customer Records"
                description={
                  "Find customers, review their purchase " + "history and edit prescriptions."
                }
                buttonText="View Customers"
                destination="/customers"
                icon={<PeopleOutlined fontSize="medium" />}
              />
            </Grid>

            {/* Manage catalog */}
            <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
              <ActionCard
                title="Product Catalog"
                description={
                  "Add or update frame brands, lens " + "models, coatings and product details."
                }
                buttonText="Manage Catalog"
                destination="/admin/catalog"
                icon={<Inventory2Outlined fontSize="medium" />}
              />
            </Grid>
          </Grid>
        </Box>
        {/* Give staff fast access to Order Tracking. */}
        <OrderTrackingDashboardCard />

        {/* Keep the existing sales reports unchanged. */}

        {/* ------------------------------------------
            WORKFLOW GUIDANCE
        ------------------------------------------ */}

        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            bgcolor: "background.paper",
          }}
        >
          <CardContent
            sx={{
              p: 2.5,
              "&:last-child": { pb: 2.5 },
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Daily Workflow
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              Search for an existing customer before registering a new one. If the customer is
              already registered, open their details to review previous purchases and prescriptions.
              Use the Product Catalog to manage frame and lens options.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
