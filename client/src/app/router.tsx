import { createBrowserRouter, Navigate } from "react-router";

import AppLayout from "../components/layout/AppLayout";
import DashboardPage from "../pages/DashboardPage";
import CustomersPage from "../pages/CustomersPage";
import AddCustomerPage from "../pages/AddCustomerPage";
import CustomerDetailPage from "../pages/CustomerDetailPage";
import EditCustomerPage from "../pages/EditCustomerPage";
import AdminCatalogPage from "../pages/AdminCatalogPage";
import NotFoundPage from "../pages/NotFoundPage";
import LoginPage from "../pages/LoginPage";
import RequireAdmin from "./RequireAdmin";

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
