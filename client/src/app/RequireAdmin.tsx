import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Alert, Box, Button, CircularProgress, Stack } from "@mui/material";
import { getCurrentAdmin } from "../services/authApi";
import { SESSION_EXPIRED_EVENT } from "../services/http";

// Check the Admin session before showing private CRM pages.
export default function RequireAdmin() {
  const location = useLocation();

  const [status, setStatus] = useState<"loading" | "allowed" | "denied" | "error">("loading");

  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    getCurrentAdmin()
      .then((admin) => {
        if (active) setStatus(admin ? "allowed" : "denied");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    const expired = () => setStatus("denied");
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

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
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

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
