import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  List, ListItemButton, ListItemText, Stack, TextField,
  Typography, Chip,
} from "@mui/material";
import { Link, useSearchParams } from "react-router";
import {
  searchCustomers,
  type CustomerSummary,
} from "../services/customerApi";

// nik - Search customers and select one unique record.
export default function CustomersPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Request customers whenever the search term changes.
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const data = await searchCustomers(search, controller.signal);

        if (!controller.signal.aborted) {
          setCustomers(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setCustomers([]);
          setError(
            err instanceof Error ? err.message : "Search failed"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  function handleSearch(value: string) {
    const next = /^[0-9]+$/.test(value)
      ? value.slice(0, 10)
      : value.slice(0, 150);

    setParams(next ? { search: next } : {}, {
      replace: true,
    });
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Customers
          </Typography>
          <Typography color="text.secondary">
            Search by name or mobile number.
          </Typography>
        </Box>

        <Button
          component={Link}
          to="/customers/new"
          variant="contained"
        >
          Add Customer
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <TextField
            fullWidth
            label="Search Customer"
            placeholder="Enter name or mobile number"
            value={search}
            onChange={(event) => handleSearch(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack
            direction="row"
            sx={{
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6">
              Matching Customers
            </Typography>

            {!loading && !error && (
              <Chip label={`${customers.length} shown`} size="small" />
            )}
          </Stack>

          {loading ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CircularProgress size={28} />
              <Typography sx={{ mt: 2 }}>
                Searching...
              </Typography>
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : customers.length === 0 ? (
            <Typography color="text.secondary">
              No customers found.
            </Typography>
          ) : (
            <List>
              {customers.map((customer) => (
                <ListItemButton
                  key={customer.id}
                  component={Link}
                  to={`/customers/${customer.id}${
                    search
                      ? `?search=${encodeURIComponent(search)}`
                      : ""
                  }`}
                  divider
                >
                  <ListItemText
                    primary={customer.name}
                    secondary={customer.mobNumber || "No mobile number"}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
