
import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";

import { Link, useNavigate } from "react-router";

// nik - The dashboard is the starting point for finding customers.
export default function DashboardPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Send the entered name or phone number to the customer list.
  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = search.trim();

    if (!value) {
      navigate("/customers");
      return;
    }

    navigate(`/customers?search=${encodeURIComponent(value)}`);
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Optical CRM Dashboard
        </Typography>

        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Search customers and manage their optical records.
        </Typography>
      </Box>

      {/* Main customer search */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Find a Customer
          </Typography>

          <Box component="form" onSubmit={handleSearch}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
            >
              <TextField
                fullWidth
                label="Name or Mobile Number"
                placeholder="e.g. Rahul or 9876543210"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />

              <Button
                type="submit"
                variant="contained"
                startIcon={<SearchOutlined />}
                sx={{ minWidth: 170 }}
              >
                Search Customers
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {/* Main actions */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <PersonAddAltOutlined color="primary" />

              <Typography variant="h6" sx={{ mt: 1 }}>
                Add New Customer
              </Typography>

              <Typography color="text.secondary" sx={{ my: 1 }}>
                Register a customer and optical prescription.
              </Typography>

              <Button
                component={Link}
                to="/customers/new"
              >
                Add Customer
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <PeopleOutlined color="primary" />

              <Typography variant="h6" sx={{ mt: 1 }}>
                Customer Records
              </Typography>

              <Typography color="text.secondary" sx={{ my: 1 }}>
                Browse or search existing customers.
              </Typography>

              <Button
                component={Link}
                to="/customers"
              >
                View Customers
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
