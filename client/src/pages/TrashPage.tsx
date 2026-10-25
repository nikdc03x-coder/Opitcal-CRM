import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  TablePagination,
} from "@mui/material";
import RestoreOutlined from "@mui/icons-material/RestoreOutlined";
import DeleteForeverOutlined from "@mui/icons-material/DeleteForeverOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import {
  getTrash,
  restoreDeleted,
  permanentlyDelete,
  type TrashContents,
} from "../services/customerApi";

type DeleteTarget = { customerId: string; recordId?: string; label: string; detail: string };

export default function TrashPage() {
  const [data, setData] = useState<TrashContents | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const restoring = useRef(false);
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  const [pin, setPin] = useState("");
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const openDelete = (next: DeleteTarget) => {
    deleteTriggerRef.current = document.activeElement as HTMLElement | null;
    setTarget(next);
    setPin("");
    setDeleteError("");
    setMessage("");
  };
  const closeDelete = () => {
    if (!restoring.current) {
      setTarget(null);
      setPin("");
      setDeleteError("");
    }
  };
  async function refresh() {
    if (restoring.current) return;
    restoring.current = true;
    setBusy(true);
    setError("");
    try {
      setData(await getTrash());
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh Trash.");
    } finally {
      restoring.current = false;
      setBusy(false);
    }
  }
  async function confirmPermanentDelete() {
    if (!target || !/^\d{4}$/.test(pin) || restoring.current) return;
    restoring.current = true;
    setBusy(true);
    setError("");
    setDeleteError("");
    setMessage("");
    try {
      await permanentlyDelete(target.customerId, pin, target.recordId);
      setData((current) =>
        current
          ? {
              customers: current.customers.filter(
                (row) => target.recordId || row.id !== target.customerId,
              ),
              purchases: current.purchases.filter((row) =>
                target.recordId ? row.id !== target.recordId : row.customerId !== target.customerId,
              ),
            }
          : current,
      );
      setTarget(null);
      setPin("");
      setPage(0);
      setMessage(`${target.recordId ? "Purchase" : "Customer"} permanently deleted.`);
      try {
        setData(await getTrash());
      } catch {
        setError(
          "The record was permanently deleted, but Trash could not be refreshed. Please retry loading the list.",
        );
      }
    } catch (err) {
      setPin("");
      setDeleteError(
        err instanceof Error ? err.message : "Permanent deletion failed. Please try again.",
      );
    } finally {
      restoring.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    getTrash()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load Trash.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function restore(customerId: string, recordId?: string) {
    if (restoring.current) return;
    restoring.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await restoreDeleted(customerId, recordId);
      setMessage(`${recordId ? "Purchase" : "Customer"} restored successfully.`);
      setData(await getTrash());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to restore. Please try again.");
    } finally {
      setBusy(false);
      restoring.current = false;
    }
  }
  const query = search.trim().toLowerCase();
  const entries = data
    ? [
        ...data.customers.map((customer) => ({ kind: "customer" as const, customer })),
        ...data.purchases.map((purchase) => ({ kind: "purchase" as const, purchase })),
      ].filter((entry) =>
        (entry.kind === "customer"
          ? `${entry.customer.name} ${entry.customer.mobNumber ?? ""}`
          : `${entry.purchase.customer.name} ${entry.purchase.specsType ?? ""} ${entry.purchase.lensType ?? ""} ${entry.purchase.purchaseDate ?? ""}`
        )
          .toLowerCase()
          .includes(query),
      )
    : [];
  const safePage = Math.min(page, Math.max(0, Math.ceil(entries.length / pageSize) - 1));
  const visible = entries.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return (
    <Box>
      <Stack spacing={2}>
        <Typography variant="h4">Trash</Typography>
        <Typography color="text.secondary">
          Restore customers with their associated data, or individual purchases. Purchases deleted
          earlier remain in Trash after customer restoration.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            label="Search Trash"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            sx={{ flex: 1 }}
          />
          <Button
            startIcon={<RefreshOutlined />}
            disabled={busy || !!target}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </Stack>
        {error && (
          <Alert
            severity="error"
            action={
              <Button disabled={busy || !!target} onClick={() => void refresh()}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {message && <Alert severity="success">{message}</Alert>}
        {!data && !error && <CircularProgress />}
        {data && data.customers.length + data.purchases.length === 0 && (
          <Alert severity="info">Trash is empty.</Alert>
        )}
        {data && !!query && !entries.length && (
          <Alert severity="info">No trashed records match your search.</Alert>
        )}
        {visible
          .filter((entry) => entry.kind === "customer")
          .map(({ customer }) => (
            <Paper key={customer.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{customer.name}</Typography>
                  <Typography>
                    {customer.mobNumber || "No mobile number"} · {customer._count.records} purchases
                    · {customer._count.prescriptions} prescriptions
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    disabled={busy || !!target}
                    startIcon={<RestoreOutlined />}
                    onClick={() => void restore(customer.id)}
                  >
                    Restore Customer
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteForeverOutlined />}
                    disabled={busy || !!target}
                    onClick={() =>
                      openDelete({
                        customerId: customer.id,
                        label: customer.name,
                        detail: `${customer.mobNumber || "No mobile number"} · ${customer._count.records} purchases · ${customer._count.prescriptions} prescriptions`,
                      })
                    }
                  >
                    Permanently Delete
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        {visible
          .filter((entry) => entry.kind === "purchase")
          .map(({ purchase }) => (
            <Paper key={purchase.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {purchase.customer.name} — Purchase
                  </Typography>
                  <Typography>
                    {purchase.purchaseDate?.slice(0, 10) || "Date not recorded"} ·{" "}
                    {purchase.specsType || "No frame"} · {purchase.lensType || "No lens"} · MRP{" "}
                    {purchase.mrp ?? "Not recorded"}
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    disabled={busy || !!target}
                    startIcon={<RestoreOutlined />}
                    onClick={() => void restore(purchase.customerId, purchase.id)}
                  >
                    Restore Purchase
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteForeverOutlined />}
                    disabled={busy || !!target}
                    onClick={() =>
                      openDelete({
                        customerId: purchase.customerId,
                        recordId: purchase.id,
                        label: purchase.customer.name,
                        detail: `${purchase.purchaseDate?.slice(0, 10) || "Date not recorded"} · ${purchase.specsType || "No frame"} · ${purchase.lensType || "No lens"} · MRP ${purchase.mrp ?? "Not recorded"}`,
                      })
                    }
                  >
                    Permanently Delete
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        {data && entries.length > 0 && (
          <TablePagination
            component="div"
            count={entries.length}
            page={safePage}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[10, 25, 50]}
            onPageChange={(_, next) => setPage(next)}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            sx={{ ".MuiTablePagination-toolbar": { flexWrap: "wrap" } }}
          />
        )}
      </Stack>
      <Dialog
        open={!!target}
        onClose={closeDelete}
        fullWidth
        maxWidth="sm"
        slotProps={{
          transition: {
            // Native input autoFocus can run before the transition forwards MUI's focus handler.
            // Restore only after the modal has released aria-hidden on the background.
            onExited: () => deleteTriggerRef.current?.focus(),
          },
          paper: {
            component: "form",
            onSubmit: (event: React.FormEvent) => {
              event.preventDefault();
              void confirmPermanentDelete();
            },
          },
        }}
      >
        <DialogTitle>Permanently Delete Record?</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography sx={{ fontWeight: 700 }}>
              {target?.recordId ? "Purchase" : "Customer"}: {target?.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {target?.detail}
            </Typography>
            <Alert severity="warning">
              This action will permanently erase the selected record and its exclusively owned
              linked data from the database. It cannot be undone.
            </Alert>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
            <TextField
              autoFocus
              fullWidth
              label="Enter Administrator PIN"
              type="password"
              value={pin}
              disabled={busy}
              autoComplete="off"
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              slotProps={{ htmlInput: { maxLength: 4, inputMode: "numeric", pattern: "[0-9]{4}" } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={closeDelete}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="error"
            variant="contained"
            disabled={busy || !/^\d{4}$/.test(pin)}
            startIcon={<DeleteForeverOutlined />}
          >
            {busy ? "Deleting…" : "Permanently Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
