import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Tooltip,
  Stack,
  Divider,
} from "@mui/material";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import PlayArrowOutlined from "@mui/icons-material/PlayArrowOutlined";
import PauseOutlined from "@mui/icons-material/PauseOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import SendOutlined from "@mui/icons-material/SendOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import SettingsOutlined from "@mui/icons-material/SettingsOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";

import {
  fetchReminderDashboard,
  fetchDueReminders,
  fetchReminderSequences,
  syncReminders,
  confirmManualSend,
  sendMetaTestApi,
  pauseReminderSequence,
  resumeReminderSequence,
  cancelReminderSequence,
  updateReminderSettings,
  updateReminderTemplate,
  updateCustomerConsent,
  searchCustomersForReminder,
  sendEarlyReminder,
  type DueReminderItem,
  type ReminderSequenceItem,
  type ReminderDashboardData,
} from "../services/reminderApi";

export default function EyeCheckupRemindersPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dashboard Data
  const [dashboard, setDashboard] = useState<ReminderDashboardData | null>(null);
  const [dueList, setDueList] = useState<DueReminderItem[]>([]);
  const [sequences, setSequences] = useState<ReminderSequenceItem[]>([]);

  // Multi-selection for bulk manual sending
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
  const [bulkQueueIndex, setBulkQueueIndex] = useState<number | null>(null);

  // Search & Filter
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dueSearchQuery, setDueSearchQuery] = useState<string>("");

  // Preview & Edit Dialog
  const [previewItem, setPreviewItem] = useState<DueReminderItem | null>(null);
  const [customMessageOverride, setCustomMessageOverride] = useState<string | null>(null);

  const activeMessage =
    customMessageOverride !== null ? customMessageOverride : previewItem?.renderedMessage || "";

  const dynamicClickToChatUrl = useMemo(() => {
    if (!previewItem) return "";
    const phone =
      previewItem.normalizedPhone ||
      (previewItem.mobNumber ? previewItem.mobNumber.replace(/\D/g, "") : "");
    const encoded = encodeURIComponent(activeMessage);
    return `https://wa.me/${phone}?text=${encoded}`;
  }, [previewItem, activeMessage]);

  const openPreview = (item: DueReminderItem) => {
    setCustomMessageOverride(null);
    setPreviewItem(item);
  };

  const closePreview = () => {
    setPreviewItem(null);
    setCustomMessageOverride(null);
  };

  // Early Send Dialog
  const [earlySendOpen, setEarlySendOpen] = useState(false);
  const [earlyQuery, setEarlyQuery] = useState("");
  const [earlySearchResults, setEarlySearchResults] = useState<
    Array<{
      id: string;
      name: string;
      mobNumber: string | null;
      normalizedPhone?: string;
      isValidPhone: boolean;
      phoneError?: string;
      consentStatus: "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED";
      latestPurchaseDate: string | null;
      specsType: string | null;
    }>
  >([]);
  const [earlySearching, setEarlySearching] = useState(false);

  // Settings & Templates Dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>("DISABLED");
  const [optOutKeywords, setOptOutKeywords] = useState<string>("STOP,UNSUBSCRIBE,CANCEL");
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string;
    stepNumber: number;
    title: string;
    bodyText: string;
  } | null>(null);

  // Consent Dialog
  const [consentDialog, setConsentDialog] = useState<{
    customerId: string;
    customerName: string;
    currentStatus: string;
  } | null>(null);
  const [newConsentStatus, setNewConsentStatus] = useState<
    "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED"
  >("OPTED_IN");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, due, seqs] = await Promise.all([
        fetchReminderDashboard(),
        fetchDueReminders(dueSearchQuery || undefined),
        fetchReminderSequences(statusFilter || undefined, searchQuery || undefined),
      ]);
      setDashboard(dash);
      setSelectedMode(dash.mode);
      setOptOutKeywords(dash.optOutKeywords);
      setDueList(due);
      setSequences(seqs);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reminder data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, dueSearchQuery]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [dash, due, seqs] = await Promise.all([
          fetchReminderDashboard(),
          fetchDueReminders(),
          fetchReminderSequences(statusFilter || undefined, undefined),
        ]);
        if (!active) return;
        setDashboard(dash);
        setSelectedMode(dash.mode);
        setOptOutKeywords(dash.optOutKeywords);
        setDueList(due);
        setSequences(seqs);
        setLoading(false);
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load reminder data");
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [statusFilter]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await syncReminders();
      setSuccessMsg(
        `Eligibility synced! ${res.data.sequencesCreated} new sequences scheduled, ${res.data.dueRemindersCount} currently due.`,
      );
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectAllDue = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDueIds(dueList.map((d) => d.attemptId));
    } else {
      setSelectedDueIds([]);
    }
  };

  const handleToggleSelectDue = (id: string) => {
    setSelectedDueIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleManualSendClick = (item: DueReminderItem) => {
    openPreview(item);
  };

  const handleConfirmSent = async (attemptId: string, customMessage?: string) => {
    setError(null);
    try {
      await confirmManualSend(attemptId, customMessage);
      setSuccessMsg("Reminder marked as SENT! Follow-up (Day 3) scheduled automatically.");
      closePreview();
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to confirm manual send");
    }
  };

  const handleSendMetaTest = async (attemptId: string, customMessage?: string) => {
    setError(null);
    try {
      const res = await sendMetaTestApi(attemptId, customMessage);
      if (res.success) {
        setSuccessMsg(
          `Meta Cloud API Test sent successfully to ${res.data?.recipientPhone}! (Message ID: ${res.data?.messageId || "N/A"})`,
        );
      } else {
        setError(`Meta Cloud API Test failed: ${res.data?.error || "Unknown error"}`);
      }
      closePreview();
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Meta API test send failed");
    }
  };

  const handleStartBulkSequential = () => {
    if (selectedDueIds.length === 0) return;
    setBulkQueueIndex(0);
    const firstItem = dueList.find((d) => d.attemptId === selectedDueIds[0]);
    if (firstItem) {
      openPreview(firstItem);
    }
  };

  const handleNextInBulk = () => {
    if (bulkQueueIndex === null) return;
    const nextIdx = bulkQueueIndex + 1;
    if (nextIdx < selectedDueIds.length) {
      setBulkQueueIndex(nextIdx);
      const nextItem = dueList.find((d) => d.attemptId === selectedDueIds[nextIdx]);
      if (nextItem) {
        openPreview(nextItem);
      }
    } else {
      setBulkQueueIndex(null);
      setSuccessMsg(`Completed sequential sending for ${selectedDueIds.length} customer(s)!`);
      setSelectedDueIds([]);
    }
  };

  const handlePause = async (seqId: string) => {
    try {
      await pauseReminderSequence(seqId);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to pause sequence");
    }
  };

  const handleResume = async (seqId: string) => {
    try {
      await resumeReminderSequence(seqId);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resume sequence");
    }
  };

  const handleCancel = async (seqId: string, customerName?: string) => {
    try {
      await cancelReminderSequence(seqId);
      setSuccessMsg(
        customerName
          ? `Removed ${customerName} from reminder list.`
          : "Reminder removed from list.",
      );
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel sequence");
    }
  };

  const handleBulkRemoveSelected = async () => {
    if (selectedDueIds.length === 0) return;
    try {
      setLoading(true);
      const itemsToCancel = dueList.filter((d) => selectedDueIds.includes(d.attemptId));
      for (const item of itemsToCancel) {
        await cancelReminderSequence(item.sequenceId);
      }
      setSelectedDueIds([]);
      setSuccessMsg(`Removed ${itemsToCancel.length} customer(s) from reminder list.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove selected reminders");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setError(null);
    try {
      await updateReminderSettings(selectedMode, optOutKeywords);
      setSettingsOpen(false);
      setSuccessMsg(`Settings saved! Current WhatsApp mode: ${selectedMode}`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await updateReminderTemplate(editingTemplate.id, {
        title: editingTemplate.title,
        bodyText: editingTemplate.bodyText,
      });
      setEditingTemplate(null);
      setSuccessMsg(`Template for Step ${editingTemplate.stepNumber} updated.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  const handleSaveConsent = async () => {
    if (!consentDialog) return;
    try {
      await updateCustomerConsent(consentDialog.customerId, newConsentStatus);
      setConsentDialog(null);
      setSuccessMsg(`Updated consent for ${consentDialog.customerName} to ${newConsentStatus}.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save consent");
    }
  };

  const handleSearchEarly = async () => {
    if (!earlyQuery.trim()) return;
    setEarlySearching(true);
    try {
      const res = await searchCustomersForReminder(earlyQuery);
      setEarlySearchResults(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to search customers");
    } finally {
      setEarlySearching(false);
    }
  };

  const handleSelectCustomerForEarlySend = async (customerId: string) => {
    try {
      setLoading(true);
      const reminderItem = await sendEarlyReminder(customerId);
      setEarlySendOpen(false);
      openPreview(reminderItem);
      setSuccessMsg(`Prepared reminder message for ${reminderItem.customerName}!`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to prepare early reminder");
    } finally {
      setLoading(false);
    }
  };

  const getModeBadge = (mode: string) => {
    if (mode === "MANUAL_FREE") {
      return <Chip label="MANUAL FREE (₹0 Click-to-Chat)" color="success" size="small" />;
    }
    if (mode === "META_TEST") {
      return <Chip label="META CLOUD API (Sandbox Test Only)" color="warning" size="small" />;
    }
    return <Chip label="DISABLED (No Messages Sent)" color="default" size="small" />;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Eye Checkup Reminders
            </Typography>
            {dashboard && getModeBadge(dashboard.mode)}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Automated 6-month checkup detection & 3-step WhatsApp reminders for Harshu Chasma Ghar
            (Guaranteed ₹0 Cost)
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PersonSearchOutlined />}
            onClick={() => {
              setEarlySendOpen(true);
              setEarlyQuery("");
              setEarlySearchResults([]);
            }}
          >
            Send Reminder Early
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={handleSync}
            disabled={syncing || loading}
          >
            {syncing ? "Checking..." : "Sync Due Eligibility"}
          </Button>

          <Button
            variant="outlined"
            startIcon={<SettingsOutlined />}
            onClick={() => setSettingsOpen(true)}
          >
            Settings & Templates
          </Button>
        </Stack>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: "Due Today / Overdue", count: dashboard?.stats.due ?? 0, color: "error.main" },
          {
            label: "Upcoming (Step 2 & 3)",
            count: dashboard?.stats.upcoming ?? 0,
            color: "primary.main",
          },
          {
            label: "Completed Sequences",
            count: dashboard?.stats.completed ?? 0,
            color: "success.main",
          },
          { label: "Paused", count: dashboard?.stats.paused ?? 0, color: "warning.main" },
          {
            label: "Cancelled / Opt-Outs",
            count: dashboard?.stats.cancelled ?? 0,
            color: "text.secondary",
          },
        ].map((stat, idx) => (
          <Grid key={idx} size={{ xs: 6, sm: 2.4 }}>
            <Card variant="outlined" sx={{ bgcolor: "background.paper", borderRadius: 2 }}>
              <CardContent sx={{ p: 2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color }}>
                  {stat.count}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
          <Tab label={`Due For Sending (${dueList.length})`} />
          <Tab label="Reminder Sequences & History" />
        </Tabs>
      </Box>

      {/* TAB 0: Due For Sending */}
      {tabIndex === 0 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Pending Reminders Ready to Send
              </Typography>
              <TextField
                size="small"
                placeholder="Search due customer name or phone..."
                value={dueSearchQuery}
                onChange={(e) => setDueSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadAll()}
                sx={{ width: 280 }}
              />
              <Button variant="outlined" size="small" onClick={() => void loadAll()}>
                Search
              </Button>
            </Stack>

            <Stack direction="row" spacing={1}>
              {selectedDueIds.length > 0 && (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<SendOutlined />}
                    onClick={handleStartBulkSequential}
                    disabled={dashboard?.mode === "DISABLED"}
                  >
                    Sequential Send ({selectedDueIds.length})
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteOutlined />}
                    onClick={() => void handleBulkRemoveSelected()}
                  >
                    Remove Selected ({selectedDueIds.length})
                  </Button>
                </>
              )}
            </Stack>
          </Box>

          {dueList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No reminders due for sending today. Run "Sync Due Eligibility" or check upcoming
                reminders in the History tab.
              </Typography>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          selectedDueIds.length > 0 && selectedDueIds.length < dueList.length
                        }
                        checked={dueList.length > 0 && selectedDueIds.length === dueList.length}
                        onChange={handleSelectAllDue}
                      />
                    </TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Step</TableCell>
                    <TableCell>Last Purchase</TableCell>
                    <TableCell>Consent</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dueList.map((item) => {
                    const isSelected = selectedDueIds.includes(item.attemptId);
                    return (
                      <TableRow key={item.attemptId} hover selected={isSelected}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleSelectDue(item.attemptId)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {item.mobNumber || "—"}
                          </Typography>
                          {!item.isValidPhone && (
                            <Typography variant="caption" color="error">
                              {item.phoneError}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`Step ${item.stepNumber} of 3`}
                            size="small"
                            color={
                              item.stepNumber === 1
                                ? "primary"
                                : item.stepNumber === 2
                                  ? "warning"
                                  : "error"
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {item.purchaseDate
                            ? new Date(item.purchaseDate).toLocaleDateString("en-GB")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.consentStatus}
                            size="small"
                            color={
                              item.consentStatus === "OPTED_IN"
                                ? "success"
                                : item.consentStatus === "OPTED_OUT"
                                  ? "error"
                                  : "default"
                            }
                            onClick={() =>
                              setConsentDialog({
                                customerId: item.customerId,
                                customerName: item.customerName,
                                currentStatus: item.consentStatus,
                              })
                            }
                            sx={{ cursor: "pointer" }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                            <Tooltip title="Preview & Send">
                              <IconButton
                                color="primary"
                                size="small"
                                onClick={() => openPreview(item)}
                              >
                                <VisibilityOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              startIcon={<WhatsAppIcon />}
                              onClick={() => handleManualSendClick(item)}
                              disabled={dashboard?.mode === "DISABLED" || !item.isValidPhone}
                            >
                              Send WhatsApp
                            </Button>

                            <Tooltip title="Remove customer from reminder list">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() =>
                                  void handleCancel(item.sequenceId, item.customerName)
                                }
                              >
                                <DeleteOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}

      {/* TAB 1: Sequences & History */}
      {tabIndex === 1 && (
        <Box>
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Search customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadAll()}
              sx={{ width: 280 }}
            />
            <TextField
              select
              size="small"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ width: 180 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="SCHEDULED">Scheduled</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="PAUSED">Paused</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </TextField>
            <Button variant="outlined" size="small" onClick={() => void loadAll()}>
              Filter
            </Button>
          </Box>

          <Card variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Current Step</TableCell>
                  <TableCell>Eligible Since</TableCell>
                  <TableCell>Attempts Summary</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sequences.map((seq) => (
                  <TableRow key={seq.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {seq.customer.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {seq.customer.mobNumber || "No phone"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={seq.status}
                        size="small"
                        color={
                          seq.status === "COMPLETED"
                            ? "success"
                            : seq.status === "IN_PROGRESS"
                              ? "primary"
                              : seq.status === "PAUSED"
                                ? "warning"
                                : seq.status === "CANCELLED"
                                  ? "error"
                                  : "default"
                        }
                      />
                      {seq.cancellationReason && (
                        <Typography
                          variant="caption"
                          sx={{ display: "block", color: "text.secondary" }}
                        >
                          {seq.cancellationReason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>Step {seq.currentStep} of 3</TableCell>
                    <TableCell>
                      {new Date(seq.eligibilityDate).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {seq.attempts.map((att) => (
                          <Chip
                            key={att.id}
                            label={`#${att.stepNumber}: ${att.status}`}
                            size="small"
                            variant="outlined"
                            color={
                              att.status === "SENT" || att.status === "DELIVERED"
                                ? "success"
                                : att.status === "FAILED"
                                  ? "error"
                                  : "default"
                            }
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                        {seq.status === "PAUSED" ? (
                          <Tooltip title="Resume Sequence">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => void handleResume(seq.id)}
                            >
                              <PlayArrowOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          seq.status !== "COMPLETED" &&
                          seq.status !== "CANCELLED" && (
                            <Tooltip title="Pause Sequence">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => void handlePause(seq.id)}
                              >
                                <PauseOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )
                        )}

                        {seq.status !== "CANCELLED" && seq.status !== "COMPLETED" && (
                          <Tooltip title="Cancel Sequence">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => void handleCancel(seq.id)}
                            >
                              <BlockOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Box>
      )}

      {/* Preview & Action Dialog */}
      <Dialog open={!!previewItem} onClose={() => setPreviewItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Reminder Preview — Step {previewItem?.stepNumber} of 3</span>
          <Chip label={dashboard?.mode || "DISABLED"} size="small" />
        </DialogTitle>
        <DialogContent dividers>
          {previewItem && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Recipient
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {previewItem.customerName} ({previewItem.mobNumber})
                </Typography>
                {previewItem.normalizedPhone && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontFamily: "monospace" }}
                  >
                    Normalized WhatsApp: +{previewItem.normalizedPhone}
                  </Typography>
                )}
              </Box>

              <Box>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.75 }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Personalized Message (Editable)
                  </Typography>
                  {customMessageOverride !== null &&
                    customMessageOverride !== previewItem.renderedMessage && (
                      <Button
                        size="small"
                        variant="text"
                        color="primary"
                        sx={{ fontSize: "0.75rem", py: 0, textTransform: "none" }}
                        onClick={() => setCustomMessageOverride(null)}
                      >
                        Reset to Default
                      </Button>
                    )}
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  maxRows={8}
                  value={activeMessage}
                  onChange={(e) => setCustomMessageOverride(e.target.value)}
                  placeholder="Type WhatsApp reminder message..."
                  helperText={`${activeMessage.length} characters — you can freely customize this message before sending`}
                  sx={{
                    bgcolor: "#F0FDF4",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: "#86EFAC",
                      },
                      "&:hover fieldset": {
                        borderColor: "#4ADE80",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#22C55E",
                      },
                    },
                  }}
                />
              </Box>

              <Alert severity="info" icon={<InfoOutlined fontSize="inherit" />}>
                {dashboard?.mode === "MANUAL_FREE" &&
                  "You can edit the message above if needed. Click 'Open WhatsApp' to chat directly with no API charges. Click 'Confirm Sent' after sending to advance to Step 2 (3 days later)."}
                {dashboard?.mode === "META_TEST" &&
                  "You can edit the message above if needed, then test via official Meta Cloud API strictly for registered allowlisted test numbers."}
                {dashboard?.mode === "DISABLED" &&
                  "Messaging is currently DISABLED. Change mode in Settings to enable WhatsApp sending."}
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
          <Box>
            {previewItem && (
              <Button
                color="error"
                variant="outlined"
                size="small"
                startIcon={<DeleteOutlined />}
                onClick={() => {
                  void handleCancel(previewItem.sequenceId, previewItem.customerName);
                  closePreview();
                  if (bulkQueueIndex !== null) handleNextInBulk();
                }}
              >
                Remove from Reminders
              </Button>
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            <Button onClick={closePreview}>Close</Button>

            {previewItem && dashboard?.mode === "MANUAL_FREE" && (
              <>
                <Button
                  variant="outlined"
                  color="success"
                  startIcon={<WhatsAppIcon />}
                  onClick={() =>
                    window.open(dynamicClickToChatUrl, "_blank", "noopener,noreferrer")
                  }
                >
                  Open WhatsApp
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CheckCircleOutlined />}
                  onClick={() => {
                    void handleConfirmSent(previewItem.attemptId, activeMessage);
                    if (bulkQueueIndex !== null) handleNextInBulk();
                  }}
                >
                  Confirm Sent
                </Button>
              </>
            )}

            {previewItem && dashboard?.mode === "META_TEST" && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<SendOutlined />}
                onClick={() => void handleSendMetaTest(previewItem.attemptId, activeMessage)}
              >
                Send Meta Test API
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Settings & Templates Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>WhatsApp Reminder Settings & Templates</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Operation Mode (Zero Cost Policy)
              </Typography>
              <TextField
                select
                fullWidth
                label="WhatsApp Sending Mode"
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                helperText="MANUAL_FREE is permanently ₹0. META_TEST uses official developer sandbox test recipients only."
              >
                <MenuItem value="DISABLED">
                  DISABLED — No messages sent (Database & queue only)
                </MenuItem>
                <MenuItem value="MANUAL_FREE">
                  MANUAL_FREE — Click-to-chat links (₹0 Guaranteed, zero API fees)
                </MenuItem>
                <MenuItem value="META_TEST">
                  META_TEST — Meta Cloud API developer test allowlist
                </MenuItem>
              </TextField>
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Opt-Out Keywords
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Keywords (comma separated)"
                value={optOutKeywords}
                onChange={(e) => setOptOutKeywords(e.target.value)}
                helperText="If customer sends any of these via WhatsApp, CRM automatically cancels their sequences."
              />
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Registered Meta Test Recipients (Backend Configured)
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace", bgcolor: "grey.100", p: 1, borderRadius: 1 }}
              >
                {dashboard?.allowedTestRecipients.join(", ") ||
                  "None configured (META_WHATSAPP_TEST_RECIPIENTS)"}
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Reminder Templates (3-Step Sequence)
              </Typography>

              <Grid container spacing={2}>
                {dashboard?.templates.map((tpl) => (
                  <Grid key={tpl.id} size={{ xs: 12 }}>
                    <Card variant="outlined" sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1,
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Step {tpl.stepNumber}: {tpl.title}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() =>
                            setEditingTemplate({
                              id: tpl.id,
                              stepNumber: tpl.stepNumber,
                              title: tpl.title,
                              bodyText: tpl.bodyText,
                            })
                          }
                        >
                          Edit
                        </Button>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ whiteSpace: "pre-wrap" }}
                      >
                        {tpl.bodyText}
                      </Typography>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveSettings()}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Edit Dialog */}
      <Dialog
        open={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Template — Step {editingTemplate?.stepNumber}</DialogTitle>
        <DialogContent dividers>
          {editingTemplate && (
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Template Title"
                value={editingTemplate.title}
                onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
              />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Template Message"
                value={editingTemplate.bodyText}
                onChange={(e) =>
                  setEditingTemplate({ ...editingTemplate, bodyText: e.target.value })
                }
                helperText="Supported placeholders: {{customerName}}, {{shopName}}, {{purchaseDate}}, {{specsType}}"
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingTemplate(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveTemplate()}>
            Update Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Customer Consent Dialog */}
      <Dialog open={!!consentDialog} onClose={() => setConsentDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Customer WhatsApp Consent</DialogTitle>
        <DialogContent dividers>
          {consentDialog && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Update communication consent for <strong>{consentDialog.customerName}</strong>:
              </Typography>
              <TextField
                select
                fullWidth
                label="Consent Status"
                value={newConsentStatus}
                onChange={(e) =>
                  setNewConsentStatus(e.target.value as "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED")
                }
              >
                <MenuItem value="OPTED_IN">OPTED_IN (Allow Reminders)</MenuItem>
                <MenuItem value="OPTED_OUT">OPTED_OUT (Stop & Cancel Reminders)</MenuItem>
                <MenuItem value="UNSPECIFIED">UNSPECIFIED (Default)</MenuItem>
              </TextField>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConsentDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveConsent()}>
            Save Consent
          </Button>
        </DialogActions>
      </Dialog>

      {/* Early Send Search Customer Dialog */}
      <Dialog open={earlySendOpen} onClose={() => setEarlySendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Reminder Early (Search Any Customer)</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Search any active customer by name or mobile number to send an immediate eye checkup
              reminder, even if 6 months hasn't elapsed.
            </Typography>

            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                autoFocus
                placeholder="Type customer name or mobile number..."
                value={earlyQuery}
                onChange={(e) => setEarlyQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearchEarly()}
              />
              <Button
                variant="contained"
                onClick={() => void handleSearchEarly()}
                disabled={earlySearching || !earlyQuery.trim()}
              >
                {earlySearching ? "Searching..." : "Search"}
              </Button>
            </Stack>

            {earlySearchResults.length > 0 && (
              <Card variant="outlined" sx={{ mt: 1, maxHeight: 320, overflowY: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Last Purchase</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {earlySearchResults.map((cust) => (
                      <TableRow key={cust.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {cust.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {cust.mobNumber || "No Phone"}
                          </Typography>
                          {!cust.isValidPhone && (
                            <Typography
                              variant="caption"
                              sx={{ color: "error.main", display: "block" }}
                            >
                              {cust.phoneError}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {cust.latestPurchaseDate
                            ? new Date(cust.latestPurchaseDate).toLocaleDateString("en-GB")
                            : "No purchases"}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<WhatsAppIcon />}
                            disabled={!cust.isValidPhone || cust.consentStatus === "OPTED_OUT"}
                            onClick={() => void handleSelectCustomerForEarlySend(cust.id)}
                          >
                            Send
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}

            {earlySearchResults.length === 0 && earlyQuery.trim() && !earlySearching && (
              <Alert severity="info">No matching customers found for "{earlyQuery}".</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEarlySendOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
