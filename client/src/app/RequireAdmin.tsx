import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { getCurrentAdmin } from "../services/authApi";
import { SESSION_EXPIRED_EVENT } from "../services/http";

// Check the Admin session before showing private CRM pages.
export default function RequireAdmin({ guestOnly = false }: { guestOnly?: boolean }) {
  const location = useLocation();

  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "error">("loading");

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let expired = false;
    const sessionExpired = () => {
      expired = true;
      setStatus("denied");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);

    getCurrentAdmin()
      .then((admin) => {
        if (active && !expired) setStatus(admin ? "allowed" : "denied");
      })
      .catch(() => {
        if (!active || expired) return;
        setStatus("error");
      });

    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
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

  if (status === "denied" && !guestOnly) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (status === "allowed" && guestOnly) return <Navigate to="/dashboard" replace />;

  if (status === "error") {
    return (
      <Box sx={{ maxWidth: 450, mx: "auto", mt: 8, px: 2 }}>
        <Stack spacing={2}>
          <Alert severity="error">
            Unable to verify your Admin session. Check the backend connection.
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
