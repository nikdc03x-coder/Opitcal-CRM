import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";

import { AppThemeProvider } from "./theme/ThemeContext";
import { router } from "./app/router";

// Start React with shared dynamic ThemeProvider (light & dark mode support) and router.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <RouterProvider router={router} />
    </AppThemeProvider>
  </React.StrictMode>,
);
