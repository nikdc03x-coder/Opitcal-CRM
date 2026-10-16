
import { useEffect, useState } from "react";

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
} from "@mui/material";

import AppLayout from "../components/layout/AppLayout";

import DashboardPage from "../pages/DashboardPage";
import CustomersPage from "../pages/CustomersPage";
import AddCustomerPage from "../pages/AddCustomerPage";
import CustomerDetailPage from "../pages/CustomerDetailPage";
import EditCustomerPage from "../pages/EditCustomerPage";
import AdminCatalogPage from "../pages/AdminCatalogPage";
import NotFoundPage from "../pages/NotFoundPage";
import LoginPage from "../pages/LoginPage";

import { getCurrentAdmin } from "../services/authApi";

// nik - Check the Admin session before showing private CRM pages.
function RequireAdmin() {
  const location = useLocation();

  const [status, setStatus] = useState<
    "loading" | "allowed" | "denied" | "error"
  >(import.meta.env.DEV ? "allowed" : "loading");

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // nik - Skip login only in local frontend development.
    // The backend must enforce its own security rules.
    if (import.meta.env.DEV) return;

    let active = true;

    getCurrentAdmin()
      .then((admin) => {
        if (active) setStatus(admin ? "allowed" : "denied");
      })
      .catch((error) => {
        if (!active) return;

        // A missing or expired session requires login.
        if (
          error instanceof Error &&
          error.message === "Not logged in."
        ) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [retry]);

  if (status === "loading") {
    return (
      <Box
        sx={{
          minHeight: "80vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (status === "denied") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (status === "error") {
    return (
      <Box sx={{ maxWidth: 450, mx: "auto", mt: 8, px: 2 }}>
        <Stack spacing={2}>
          <Alert severity="error">
            Unable to verify your Admin session.
            Check the backend connection.
          </Alert>

          <Button
            variant="contained"
            onClick={() => {
              setStatus("loading");
              setRetry((value) => value + 1);
            }}
          >
            Try Again
          </Button>
        </Stack>
      </Box>
    );
  }

  return <Outlet />;
}

// nik - Keep all Optical CRM routes in one place.
export const router = createBrowserRouter([
 
{
  path: "/login",
  element: <LoginPage />,
},

  {
    path: "/",
    element: <RequireAdmin />,

    children: [
      {
        element: <AppLayout />,

        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "customers",
            element: <CustomersPage />,
          },
          {
            path: "customers/new",
            element: <AddCustomerPage />,
          },
          {
            path: "customers/:id/edit",
            element: <EditCustomerPage />,
          },
          {
            path: "customers/:id",
            element: <CustomerDetailPage />,
          },
          {
            path: "admin/catalog",
            element: <AdminCatalogPage />,
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
