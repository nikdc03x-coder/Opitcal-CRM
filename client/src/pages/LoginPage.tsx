/**
 * Optical CRM — Admin Login
 *
 * Simple login page for the single Admin account.
 * The backend verifies the password and manages sessions.
 */

import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";

import { loginAdmin } from "../services/authApi";
import { loginDestination } from "../utils/loginDestination";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Keep credentials only in the form while logging in.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Ask the backend to create a secure login session.
  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    if (!username.trim() || !password) {
      setError("Enter your Admin username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginAdmin(username.trim(), password);

      // Return to the CRM after successful login.
      navigate(loginDestination(location.state?.from), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 4,
        bgcolor: "background.default",
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: "100%",
          maxWidth: 430,
          borderRadius: 4,
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
        }}
      >
        <CardContent
          sx={{
            p: { xs: 3, sm: 4 },
            "&:last-child": {
              pb: { xs: 3, sm: 4 },
            },
          }}
        >
          <Stack spacing={3}>
            {/* CRM identity */}
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <LockOutlined sx={{ fontSize: 30 }} />
              </Box>

              <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
                Optical CRM
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                Sign in to manage your optical store
              </Typography>
            </Stack>

            {/* Login form */}
            <Box component="form" onSubmit={handleLogin}>
              <Stack spacing={2.5}>
                {typeof location.state?.message === "string" && (
                  <Alert severity="success">{location.state.message}</Alert>
                )}
                {error && (
                  <Alert severity="error" onClose={() => setError("")}>
                    {error}
                  </Alert>
                )}

                <TextField
                  fullWidth
                  required
                  label="Username"
                  autoComplete="username"
                  value={username}
                  disabled={loading}
                  onChange={(event) => setUsername(event.target.value)}
                />

                <TextField
                  fullWidth
                  required
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  disabled={loading}
                  onChange={(event) => setPassword(event.target.value)}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((value) => !value)}
                            disabled={loading}
                          >
                            {showPassword ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Link component={RouterLink} to="/forgot-password" sx={{ alignSelf: "flex-end" }}>
                  Forgot Password?
                </Link>

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    minHeight: 48,
                    borderRadius: 2,
                    fontWeight: 700,
                  }}
                  startIcon={
                    loading ? <CircularProgress size={18} color="inherit" /> : <LockOutlined />
                  }
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </Stack>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              Authorized CRM access only
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
