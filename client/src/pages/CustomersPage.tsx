/**
 * Optical CRM — Customers Page
 *
 * Search customer records quickly and open
 * the correct customer, even when mobile numbers repeat.
 *
 * Improvements:
 * - Cleaner search and results layout
 * - Debounced API requests
 * - Clear search and retry actions
 * - Responsive customer list
 * - Preserved search when returning from details
 * - Loading skeletons and empty states
 */

import { useEffect, useState } from "react";

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonAddOutlined from "@mui/icons-material/PersonAddOutlined";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import PeopleOutlineOutlined from "@mui/icons-material/PeopleOutlineOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";

import { Link, useLocation, useSearchParams } from "react-router";

import { searchCustomers } from "../services/customerApi";
import { type CustomerSummary } from "../models/customer";
import { customerDetailsUrl } from "../utils/customerHistory";

// Display customer registration dates consistently.
function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Generate initials without depending on profile photos.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function CustomerListSkeleton() {
  return (
    <Stack spacing={0}>
      {[1, 2, 3, 4].map((item) => (
        <Stack
          key={item}
          direction="row"
          spacing={2}

          sx={{
            alignItems: "center",
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Skeleton variant="circular" width={44} height={44} />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton width="45%" height={24} />
            <Skeleton width="65%" height={20} />
          </Box>

          <Skeleton variant="rounded" width={24} height={24} />
        </Stack>
      ))}
    </Stack>
  );
}

export default function CustomersPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  // The URL remembers the last customer search.
  const search = params.get("search") ?? "";

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  // Wait briefly while staff are typing.
  // Cancel older requests so slow responses cannot
  // overwrite results for newer search terms.

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        setError("");

        try {
          const results = await searchCustomers(search, controller.signal);

          if (!controller.signal.aborted) {
            setCustomers(results);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : "Unable to load customers.");
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      search ? 300 : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, retryCount]);

  function handleSearch(value: string) {
    const cleaned = value.slice(0, 150);

    // Don't restrict searching to 10 digits.
    // Partial mobile numbers are useful at the counter.
    setParams(cleaned ? { search: cleaned } : {}, { replace: true });

    // Immediately show loading feedback for new searches.
    setLoading(true);
  }

  function clearSearch() {
    setParams({}, { replace: true });
    setLoading(true);
  }

  function retrySearch() {
    setRetryCount((previous) => previous + 1);
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: "auto", pb: 5 }}>
      <Stack spacing={2.5}>
        {location.state?.success && (
          <Alert severity="success">{String(location.state.success)}</Alert>
        )}
        {/* PAGE HEADER */}

        <Stack
          direction={{ xs: "column", sm: "row" }}

          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.5px",
              }}
            >
              Customers
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Find customers and manage their optical records.
            </Typography>
          </Box>

          <Button
            component={Link}
            to="/customers/new"
            variant="contained"
            startIcon={<PersonAddOutlined />}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: "none",
              alignSelf: {
                xs: "stretch",
                sm: "auto",
              },
            }}
          >
            Add Customer
          </Button>
        </Stack>

        {/* CUSTOMER SEARCH */}

        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "visible",
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2, sm: 2.5 },
              "&:last-child": {
                pb: { xs: 2, sm: 2.5 },
              },
            }}
          >
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Search Customer Records
              </Typography>

              <TextField
                fullWidth
                autoFocus
                autoComplete="off"
                label="Customer Name or Mobile Number"
                placeholder="Type a name or mobile number"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchOutlined color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: search ? (
                      <InputAdornment position="end">
                        <Tooltip title="Clear search">
                          <IconButton size="small" aria-label="Clear search" onClick={clearSearch}>
                            <CloseOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />

              <Stack
                direction={{ xs: "column", sm: "row" }}

                spacing={0.5}
                sx={{ justifyContent: "space-between" }}
              >
                <Typography variant="caption" color="text.secondary">
                  Search by full name, partial name or mobile.
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Each customer has a separate record.
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* RESULTS CARD */}

        <Card
          variant="outlined"
          sx={{
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              py: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack
              direction="row"

              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {search.trim() ? "Search Results" : "Customer Records"}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Select a customer to view their details.
                </Typography>
              </Box>

              <Stack
                direction="row"

                spacing={1}
                sx={{ alignItems: "center" }}
              >
                {!loading && !error && (
                  <Chip size="small" variant="outlined" label={`${customers.length} shown`} />
                )}

                <Tooltip title="Refresh customer list">
                  <span>
                    <IconButton
                      aria-label="Refresh customers"
                      size="small"
                      disabled={loading}
                      onClick={retrySearch}
                    >
                      {loading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <RefreshOutlined fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>

          {/* LOADING STATE */}

          {loading ? (
            <CustomerListSkeleton />
          ) : error ? (
            /* ERROR STATE */

            <Box sx={{ p: 3 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>

              <Button variant="outlined" startIcon={<RefreshOutlined />} onClick={retrySearch}>
                Try Again
              </Button>
            </Box>
          ) : customers.length === 0 ? (
            /* EMPTY STATE */

            <Box
              sx={{
                px: 3,
                py: 6,
                textAlign: "center",
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  bgcolor: "action.hover",
                  color: "text.secondary",
                  mx: "auto",
                  mb: 2,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <PeopleOutlineOutlined fontSize="large" />
              </Box>

              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {search.trim() ? "No Matching Customers" : "No Customers Available"}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 1,
                  mb: 2.5,
                  maxWidth: 380,
                  mx: "auto",
                }}
              >
                {search.trim()
                  ? "Try a different spelling, name or mobile number."
                  : "Add your first customer to start managing optical records."}
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}

                sx={{ justifyContent: "center" }}
              >
                {search.trim() && (
                  <Button variant="outlined" onClick={clearSearch}>
                    Clear Search
                  </Button>
                )}

                <Button
                  component={Link}
                  to="/customers/new"
                  variant="contained"
                  startIcon={<PersonAddOutlined />}
                >
                  Add Customer
                </Button>
              </Stack>
            </Box>
          ) : (
            /* CUSTOMER RESULTS */

            <List disablePadding>
              {customers.map((customer, index) => (
                <ListItem
                  key={customer.id}
                  disablePadding
                  divider={index !== customers.length - 1}
                  sx={{ flexWrap: { xs: "wrap", sm: "nowrap" } }}
                >
                  <ListItemButton
                    component={Link}
                    to={customerDetailsUrl(customer.id, search)}
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 1.75,
                      alignItems: "center",
                      gap: 1,
                      transition: "background-color 0.15s",
                      "&:hover": {
                        bgcolor: "action.hover",
                      },
                      "&:focus-visible": {
                        outline: "2px solid",
                        outlineColor: "primary.main",
                        outlineOffset: -2,
                      },
                    }}
                  >
                    {/* CUSTOMER INITIALS */}

                    <ListItemAvatar sx={{ minWidth: 54 }}>
                      <Avatar
                        sx={{
                          width: 42,
                          height: 42,
                          bgcolor: "action.selected",
                          color: "primary.main",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                        }}
                      >
                        {getInitials(customer.name)}
                      </Avatar>
                    </ListItemAvatar>

                    {/* CUSTOMER DETAILS */}

                    <ListItemText
                      disableTypography
                      sx={{ minWidth: 0 }}
                      primary={
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {customer.name}
                        </Typography>
                      }
                      secondary={
                        <Stack
                          direction="row"

                          sx={{
                            alignItems: "center",
                            flexWrap: "wrap",
                            columnGap: 1.5,
                            rowGap: 0.5,
                            mt: 0.5,
                          }}
                        >
                          <Stack
                            direction="row"

                            spacing={0.5}
                            sx={{ alignItems: "center" }}
                          >
                            <PhoneOutlined sx={{ fontSize: 15 }} />

                            <Typography variant="body2" color="text.secondary">
                              {customer.mobNumber || "No mobile number"}
                            </Typography>
                          </Stack>

                          <Typography variant="caption" color="text.secondary">
                            Added {formatDate(customer.createdAt)}
                          </Typography>
                        </Stack>
                      }
                    />

                    {/* OPEN CUSTOMER */}

                    <ArrowForwardOutlined color="action" fontSize="small" />
                  </ListItemButton>
                  <Button
                    component={Link}
                    to={customerDetailsUrl(customer.id, search, true)}
                    startIcon={<AddOutlined />}
                    aria-label={`New Purchase for ${customer.name}`}
                    sx={{ flexShrink: 0, mx: 2, mb: { xs: 1, sm: 0 } }}
                  >
                    New Purchase
                  </Button>
                </ListItem>
              ))}
            </List>
          )}
        </Card>

        {/* SMALL WORKFLOW TIP */}

        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          Tip: Search before adding a customer to check for existing records.
        </Typography>
      </Stack>
    </Box>
  );
}
