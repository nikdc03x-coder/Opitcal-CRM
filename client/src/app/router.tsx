import { createBrowserRouter, Navigate } from "react-router";

import AppLayout from "../components/layout/AppLayout";
import RequireAdmin from "./RequireAdmin";

// Load pages only when they are visited.
// This keeps the initial application loading faster.
export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => ({
      Component: (await import("../pages/LoginPage")).default,
    }),
  },

  {
    path: "/",
    element: <RequireAdmin />,

    children: [
      {
        element: <AppLayout />,

        children: [
          // Open the dashboard by default.
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },

          // Dashboard page.
          {
            path: "dashboard",
            lazy: async () => ({
              Component: (await import("../pages/DashboardPage")).default,
            }),
          },

          // Manual order tracking and management.
          {
            path: "orders",
            lazy: async () => ({
              Component: (await import("../pages/OrdersPage")).default,
            }),
          },

          // Open Business Analytics in its own protected page.
          {
            path: "analytics",
            lazy: async () => ({
              Component: (await import("../pages/BusinessAnalyticsPage")).default,
            }),
          },

          // Customer list.
          {
            path: "customers",
            lazy: async () => ({
              Component: (await import("../pages/CustomersPage")).default,
            }),
          },

          // Register a new customer.
          {
            path: "customers/new",
            lazy: async () => ({
              Component: (await import("../pages/AddCustomerPage")).default,
            }),
          },

          // Edit customer details.
          {
            path: "customers/:id/edit",
            lazy: async () => ({
              Component: (await import("../pages/EditCustomerPage")).default,
            }),
          },

          // View customer purchase history.
          {
            path: "customers/:id",
            lazy: async () => ({
              Component: (await import("../pages/CustomerDetailPage")).default,
            }),
          },

          // Frame and lens catalog management.
          {
            path: "admin/catalog",
            lazy: async () => ({
              Component: (await import("../pages/AdminCatalogPage")).default,
            }),
          },

          // Handle unknown routes.
          {
            path: "*",
            lazy: async () => ({
              Component: (await import("../pages/NotFoundPage")).default,
            }),
          },
        ],
      },
    ],
  },
]);
