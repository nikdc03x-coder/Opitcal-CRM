
import {
  createBrowserRouter,
  Navigate,
} from "react-router";

import AppLayout from "../components/layout/AppLayout";

import DashboardPage from "../pages/DashboardPage";
import CustomersPage from "../pages/CustomersPage";
import AddCustomerPage from "../pages/AddCustomerPage";
import CustomerDetailPage from "../pages/CustomerDetailPage";
import NotFoundPage from "../pages/NotFoundPage";

// Keep every application route defined in one place.
// This makes navigation predictable and easy to maintain.
export const router = createBrowserRouter([
  {
    path: "/",
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
        path: "customers/:id",
        element: <CustomerDetailPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
