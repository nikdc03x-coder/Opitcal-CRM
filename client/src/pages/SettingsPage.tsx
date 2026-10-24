import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltOutlined from "@mui/icons-material/PersonAddAltOutlined";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import ResponsiveDialog from "../components/layout/ResponsiveDialog";
import { useColorMode } from "../theme/colorMode";
import {
  accountRequest,
  loadAccount,
  loadUsers,
  saveUser,
  type Account,
  type UserInput,
} from "../services/accountApi";

const emptyUser: UserInput = { username: "", name: "", email: "", role: "USER", isActive: true };
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to complete the request.";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark, toggleColorMode } = useColorMode();
  const [account, setAccount] = useState<Account | null>(null);
  const [users, setUsers] = useState<Account[]>([]);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [input, setInput] = useState<UserInput>(emptyUser);
  const [dialogError, setDialogError] = useState("");
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  useEffect(() => {
    let active = true;
    loadAccount()
      .then(async ({ account: own }) => {
        if (!active) return;
        setAccount(own);
        setName(own.name);
        setEmail(own.email || "");
        if (own.role === "ADMIN") {
          const result = await loadUsers();
          if (active) setUsers(result.users);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(errorText(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setDialogError("");
    try {
      const result = await saveUser(input, editing === "new" ? undefined : editing.id);
      const selfChanged =
        editing !== "new" &&
        editing.id === account?.id &&
        (input.role !== account.role ||
          input.isActive !== account.isActive ||
          input.email !== account.email ||
          input.username !== account.username);
      setEditing(null);
      setMessage(result.message);
      if (selfChanged) {
        navigate("/login", { replace: true });
        return;
      }
      setUsers((await loadUsers()).users);
    } catch (caught) {
      setDialogError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  function edit(user?: Account) {
    setDialogError("");
    setEditing(user || "new");
    setInput(
      user
        ? {
            username: user.username,
            name: user.name,
            email: user.email || "",
            role: user.role,
            isActive: user.isActive,
          }
        : { ...emptyUser },
    );
  }
  if (loading) return <CircularProgress aria-label="Loading settings" />;
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Settings
        </Typography>
        <Typography color="text.secondary">
          Manage your account, security, and team access.
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success" onClose={() => setMessage("")}>
          {message}
        </Alert>
      )}
      {!account && <Button onClick={() => window.location.reload()}>Retry loading settings</Button>}
      {account && (
        <>
          <Tabs
            value={tab}
            onChange={(_e, value: number) => setTab(value)}
            aria-label="Settings sections"
          >
            <Tab label="My Account" />
            {account.role === "ADMIN" && <Tab label="User Management" />}
          </Tabs>
          {tab === 0 && (
            <Stack spacing={3}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={3}
                sx={{ alignItems: "flex-start" }}
              >
                <Card variant="outlined" sx={{ flex: 1, width: "100%" }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6">Account details</Typography>
                      <Typography color="text.secondary">
                        {account.username} ·{" "}
                        {account.role === "ADMIN" ? "Administrator" : "CRM User"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Joined {new Date(account.createdAt).toLocaleDateString()}
                      </Typography>
                      {!account.email && (
                        <Alert severity="warning">
                          Add an email address to enable password recovery.
                        </Alert>
                      )}
                      <Box
                        component="form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void perform(async () => {
                            const result = await accountRequest<{
                              account: Account;
                              message: string;
                            }>("/api/settings/me", "PATCH", {
                              name,
                              email,
                              currentPassword: profilePassword,
                            });
                            setAccount(result.account);
                            setProfilePassword("");
                            setMessage(result.message);
                          });
                        }}
                      >
                        <Stack spacing={2}>
                          <TextField
                            label="Full name"
                            required
                            value={name}
                            disabled={busy}
                            onChange={(e) => setName(e.target.value)}
                          />
                          <TextField
                            label="Email address"
                            type="email"
                            required
                            value={email}
                            disabled={busy}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                          <TextField
                            label="Current password to save details"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={profilePassword}
                            disabled={busy}
                            onChange={(e) => setProfilePassword(e.target.value)}
                          />
                          <Button type="submit" variant="contained" disabled={busy}>
                            Save account details
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
                <Card variant="outlined" sx={{ flex: 1, width: "100%" }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6">Change password</Typography>
                      <Typography color="text.secondary">
                        Use at least 12 characters. Changing your password signs you out on all
                        devices.
                      </Typography>
                      <Box
                        component="form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void perform(async () => {
                            if (newPassword !== confirmation)
                              throw new Error("Passwords do not match.");
                            await accountRequest("/api/settings/me/password", "POST", {
                              currentPassword,
                              newPassword,
                              confirmation,
                            });
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmation("");
                            navigate("/login", {
                              replace: true,
                              state: {
                                message:
                                  "Password changed successfully. Sign in with your new password.",
                              },
                            });
                          });
                        }}
                      >
                        <Stack spacing={2}>
                          <TextField
                            label="Current password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={currentPassword}
                            disabled={busy}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                          />
                          <TextField
                            label="New password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={newPassword}
                            disabled={busy}
                            onChange={(e) => setNewPassword(e.target.value)}
                            slotProps={{ htmlInput: { minLength: 12, maxLength: 1024 } }}
                          />
                          <TextField
                            label="Confirm new password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmation}
                            disabled={busy}
                            onChange={(e) => setConfirmation(e.target.value)}
                          />
                          <Button type="submit" variant="contained" disabled={busy}>
                            Change password
                          </Button>
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>

              <Card variant="outlined" sx={{ width: "100%", mt: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      {isDark ? (
                        <DarkModeOutlined sx={{ color: "primary.main" }} />
                      ) : (
                        <LightModeOutlined sx={{ color: "#F59E0B" }} />
                      )}
                      <Box>
                        <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 700 }}>
                          Appearance & Dark Mode
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Customize visual theme preference. You can also toggle anytime using the
                          top bar icon or keyboard shortcut (Ctrl+Shift+D).
                        </Typography>
                      </Box>
                    </Stack>

                    <FormControlLabel
                      control={
                        <Switch checked={isDark} onChange={toggleColorMode} color="primary" />
                      }
                      label={
                        isDark ? "Dark Mode (Currently Active)" : "Light Mode (Currently Active)"
                      }
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
          {tab === 1 && account.role === "ADMIN" && (
            <Stack spacing={2}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{ justifyContent: "space-between" }}
                spacing={2}
              >
                <Box>
                  <Typography variant="h6">User Management</Typography>
                  <Typography color="text.secondary">
                    Administrators manage accounts. Users have access to everyday CRM work.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<PersonAddAltOutlined />}
                  onClick={() => edit()}
                  disabled={busy}
                >
                  Create user
                </Button>
              </Stack>
              {users.map((user) => (
                <Card key={user.id} variant="outlined">
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ alignItems: { md: "center" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {user.name || user.username}
                          {user.id === account.id ? " (you)" : ""}
                        </Typography>
                        <Typography color="text.secondary">
                          {user.username} · {user.email || "No email configured"}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" label={user.role === "ADMIN" ? "Admin" : "User"} />
                        <Chip
                          size="small"
                          color={user.isActive ? "success" : "default"}
                          label={user.isActive ? "Active" : "Inactive"}
                        />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button disabled={busy} onClick={() => edit(user)}>
                          Edit
                        </Button>
                        <Button
                          disabled={busy || !user.isActive || !user.email}
                          onClick={() => setResetTarget(user)}
                        >
                          Send reset link
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
      <ResponsiveDialog
        open={editing !== null}
        onClose={() => {
          if (!busy) setEditing(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <Box component="form" onSubmit={submitUser}>
          <DialogTitle>{editing === "new" ? "Create user" : "Edit user"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {dialogError && <Alert severity="error">{dialogError}</Alert>}
              {editing === "new" && (
                <Alert severity="info">
                  Active users receive a secure email link to choose their password.
                </Alert>
              )}
              <TextField
                label="Full name"
                required
                value={input.name}
                disabled={busy}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
              <TextField
                label="Username"
                required
                value={input.username}
                disabled={busy}
                onChange={(e) => setInput({ ...input, username: e.target.value })}
              />
              <TextField
                label="Email address"
                type="email"
                required
                value={input.email}
                disabled={busy}
                onChange={(e) => setInput({ ...input, email: e.target.value })}
              />
              <TextField
                label="Role"
                select
                value={input.role}
                disabled={busy}
                onChange={(e) => setInput({ ...input, role: e.target.value as UserInput["role"] })}
              >
                <MenuItem value="USER">User</MenuItem>
                <MenuItem value="ADMIN">Administrator</MenuItem>
              </TextField>
              <FormControlLabel
                label="Account active"
                control={
                  <Switch
                    checked={input.isActive}
                    disabled={busy}
                    onChange={(_e, checked) => setInput({ ...input, isActive: checked })}
                  />
                }
              />
              <Typography variant="body2" color="text.secondary">
                Changing access, username, or email signs the user out. At least one active
                administrator must remain.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving…" : "Save user"}
            </Button>
          </DialogActions>
        </Box>
      </ResponsiveDialog>
      <ResponsiveDialog
        open={resetTarget !== null}
        onClose={() => {
          if (!busy) setResetTarget(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Send password reset?</DialogTitle>
        <DialogContent>
          <Typography>
            Send a single-use password reset link to {resetTarget?.email}? The link expires after 30
            minutes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setResetTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => {
              void perform(async () => {
                const result = await accountRequest(
                  `/api/settings/users/${resetTarget!.id}/reset-password`,
                  "POST",
                );
                setResetTarget(null);
                setMessage(result.message);
              });
            }}
          >
            Send reset link
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Stack>
  );
}
