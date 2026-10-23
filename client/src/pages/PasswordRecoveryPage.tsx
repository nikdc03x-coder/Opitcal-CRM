import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import { accountRequest } from "../services/accountApi";

export default function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  // Capture only in memory and remove the secret from browser history immediately.
  const [token] = useState(() => (reset ? window.location.hash.slice(1) : ""));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [checking, setChecking] = useState(reset);
  const [valid, setValid] = useState(!reset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!reset) return;
    window.history.replaceState(null, "", window.location.pathname);
    let active = true;
    accountRequest("/api/auth/reset-password/verify", "POST", { token })
      .then(() => {
        if (active) setValid(true);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(caught instanceof Error ? caught.message : "Unable to verify this link.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [reset, token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (reset && (password.length < 12 || password.length > 1024 || password !== confirmation)) {
      setError("Use 12–1024 characters and make sure both passwords match.");
      return;
    }
    setBusy(true);
    try {
      const result = await accountRequest(
        reset ? "/api/auth/reset-password" : "/api/auth/forgot-password",
        "POST",
        reset ? { token, newPassword: password, confirmation } : { email },
      );
      setMessage(result.message);
      setPassword("");
      setConfirmation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card variant="outlined" sx={{ width: "100%", maxWidth: 460, borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <LockResetOutlined color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {reset ? "Set a new password" : "Forgot your password?"}
            </Typography>
            <Typography color="text.secondary">
              {reset
                ? "Choose a password with at least 12 characters. Reset links expire after 30 minutes."
                : "Enter your account email and we’ll send instructions to reset your password."}
            </Typography>
            {checking && <CircularProgress size={24} aria-label="Verifying reset link" />}
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            {valid && !message && (
              <Box component="form" onSubmit={submit}>
                <Stack spacing={2}>
                  {reset ? (
                    <>
                      <TextField
                        label="New password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                        slotProps={{ htmlInput: { minLength: 12, maxLength: 1024 } }}
                      />
                      <TextField
                        label="Confirm new password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        disabled={busy}
                      />
                    </>
                  ) : (
                    <TextField
                      label="Email address"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  )}
                  <Button variant="contained" type="submit" disabled={busy}>
                    {busy ? "Please wait…" : reset ? "Reset password" : "Send reset link"}
                  </Button>
                </Stack>
              </Box>
            )}
            {reset && !valid && !checking && (
              <Link component={RouterLink} to="/forgot-password">
                Request a new reset link
              </Link>
            )}
            <Link component={RouterLink} to="/login">
              Back to sign in
            </Link>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
