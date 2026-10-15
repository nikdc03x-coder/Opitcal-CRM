
import {
  createBrowserRouter,
  Navigate,
} from "react-router";

import AppLayout from "../components/layout/AppLayout";

// Existing CRM pages.
import DashboardPage from "../pages/DashboardPage";
import CustomersPage from "../pages/CustomersPage";
import AddCustomerPage from "../pages/AddCustomerPage";
import CustomerDetailPage from "../pages/CustomerDetailPage";
import EditCustomerPage from "../pages/EditCustomerPage";
import NotFoundPage from "../pages/NotFoundPage";

// Admin product catalog page.
import AdminCatalogPage from "../pages/AdminCatalogPage";

// nik - Keep all CRM routes in one place.
// Only expose catalog management during local development.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,

    children: [
      {
        index: true,
        element: (
          <Navigate to="/dashboard" replace />
        ),
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

      // Catalog administration stays local-development-only
      // until secure admin authentication is implemented.
      ...(import.meta.env.DEV
        ? [
            {
              path: "admin/catalog",
              element: <AdminCatalogPage />,
            },
          ]
        : []),

      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
