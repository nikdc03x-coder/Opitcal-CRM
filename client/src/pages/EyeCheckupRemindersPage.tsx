import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
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
  LinearProgress,
  TablePagination,
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
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import RestartAltOutlined from "@mui/icons-material/RestartAltOutlined";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import SkipNextOutlined from "@mui/icons-material/SkipNextOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import AccessTimeOutlined from "@mui/icons-material/AccessTimeOutlined";
import DoneAllOutlined from "@mui/icons-material/DoneAllOutlined";
import ErrorOutlineOutlined from "@mui/icons-material/ErrorOutlineOutlined";
import MessageOutlined from "@mui/icons-material/MessageOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";

import {
  fetchReminderDashboard,
  fetchDueReminders,
  fetchUpcomingReminders,
  fetchReminderHistory,
  fetchReminderSequences,
  syncReminders,
  confirmManualSend,
  sendMetaTestApi,
  pauseReminderSequence,
  resumeReminderSequence,
  cancelReminderSequence,
  bulkCancelReminderSequences,
  rescheduleReminderAttempt,
  updateReminderSettings,
  updateReminderTemplate,
  restoreDefaultTemplate,
  updateCustomerConsent,
  searchCustomersForReminder,
  sendEarlyReminder,
  type DueReminderItem,
  type ReminderHistoryItem,
  type ReminderSequenceItem,
  type ReminderDashboardData,
} from "../services/reminderApi";

export default function EyeCheckupRemindersPage() {
  const [searchParams] = useSearchParams();
  const urlSearchParam = searchParams.get("search") || "";

  // Tabs: 0: Overview, 1: Due, 2: Upcoming, 3: History, 4: Cancelled/Paused, 5: Templates, 6: Settings
  const [tabIndex, setTabIndex] = useState<number>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "due") return 1;
    if (tabParam === "upcoming") return 2;
    if (tabParam === "history") return 3;
    if (tabParam === "paused") return 4;
    if (tabParam === "templates") return 5;
    if (tabParam === "settings") return 6;
    return urlSearchParam ? 1 : 0;
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dashboard Data
  const [dashboard, setDashboard] = useState<ReminderDashboardData | null>(null);
  const [dueList, setDueList] = useState<DueReminderItem[]>([]);
  const [upcomingList, setUpcomingList] = useState<DueReminderItem[]>([]);
  const [historyList, setHistoryList] = useState<ReminderHistoryItem[]>([]);
  const [sequences, setSequences] = useState<ReminderSequenceItem[]>([]);

  // Search & Filters per section
  const [dueSearchQuery, setDueSearchQuery] = useState(urlSearchParam);
  const [upcomingSearchQuery, setUpcomingSearchQuery] = useState("");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");
  const [sequenceStatusFilter, setSequenceStatusFilter] = useState("PAUSED");
  const [sequenceSearchQuery, setSequenceSearchQuery] = useState("");

  // Pagination
  const [duePage, setDuePage] = useState(0);
  const [dueRowsPerPage, setDueRowsPerPage] = useState(10);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(10);

  // Multi-selection for bulk manual sending / removal
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([]);
  const [bulkQueue, setBulkQueue] = useState<DueReminderItem[]>([]);
  const [bulkQueueIndex, setBulkQueueIndex] = useState<number | null>(null);
  const [bulkStats, setBulkStats] = useState<{ confirmed: number; skipped: number } | null>(null);

  // Preview & Custom Edit Dialog
  const [previewItem, setPreviewItem] = useState<DueReminderItem | null>(null);
  const [customMessageOverride, setCustomMessageOverride] = useState<string | null>(null);

  // Reschedule Dialog
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    attemptId: string;
    customerName: string;
    currentDate: string;
    newDate: string;
  } | null>(null);

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

  // Settings State
  const [selectedMode, setSelectedMode] = useState<string>("DISABLED");
  const [optOutKeywords, setOptOutKeywords] = useState<string>("STOP,UNSUBSCRIBE,CANCEL");

  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<{
    id: string;
    stepNumber: number;
    title: string;
    bodyText: string;
  } | null>(null);

  // Consent Management Dialog
  const [consentDialog, setConsentDialog] = useState<{
    customerId: string;
    customerName: string;
    currentStatus: string;
  } | null>(null);
  const [newConsentStatus, setNewConsentStatus] = useState<
    "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED"
  >("UNSPECIFIED");

  // Fetch all dashboard & tab data
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashData, dueData, upcomingData, histData, seqData] = await Promise.all([
        fetchReminderDashboard(),
        fetchDueReminders(dueSearchQuery),
        fetchUpcomingReminders(upcomingSearchQuery),
        fetchReminderHistory(historySearchQuery, historyStatusFilter),
        fetchReminderSequences(sequenceStatusFilter, sequenceSearchQuery),
      ]);

      setDashboard(dashData);
      setDueList(dueData);
      setUpcomingList(upcomingData);
      setHistoryList(histData);
      setSequences(seqData);

      setSelectedMode(dashData.mode);
      setOptOutKeywords(dashData.optOutKeywords);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reminder dashboard data");
    } finally {
      setLoading(false);
    }
  }, [
    dueSearchQuery,
    upcomingSearchQuery,
    historySearchQuery,
    historyStatusFilter,
    sequenceStatusFilter,
    sequenceSearchQuery,
  ]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadAll();
    });
  }, [loadAll]);

  // Derived active message and dynamic wa.me URL
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

  // Sync Reminders Handler
  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await syncReminders();
      setSuccessMsg(
        `Sync completed successfully: ${res.data.sequencesCreated} new sequences evaluated, ${res.data.dueRemindersCount} due reminders ready to send.`,
      );
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Manual Click-To-Chat Confirm
  const handleConfirmSent = async (attemptId: string, customMessage?: string) => {
    try {
      await confirmManualSend(attemptId, customMessage);
      setSuccessMsg("Confirmed reminder sent! Next step scheduled 3 days later.");
      closePreview();
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to confirm manual send");
    }
  };

  // Meta Test API Send
  const handleSendMetaTest = async (attemptId: string, customMessage?: string) => {
    try {
      const res = await sendMetaTestApi(attemptId, customMessage);
      if (res.success) {
        setSuccessMsg(
          `Meta Cloud API test message delivered successfully to ${res.data?.recipientPhone}! Next step scheduled 3 days later.`,
        );
      } else {
        setError(`Meta Cloud API test failed: ${res.data?.error || "Unknown error"}`);
      }
      closePreview();
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Meta API test call failed");
    }
  };

  // Sequence Controls
  const handlePause = async (seqId: string) => {
    try {
      await pauseReminderSequence(seqId);
      setSuccessMsg("Reminder sequence paused. No further steps will be scheduled while paused.");
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to pause sequence");
    }
  };

  const handleResume = async (seqId: string) => {
    try {
      await resumeReminderSequence(seqId);
      setSuccessMsg("Reminder sequence resumed successfully.");
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
          ? `Cancelled sequence for ${customerName}.`
          : "Reminder sequence cancelled successfully.",
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
      const sequenceIds = Array.from(new Set(itemsToCancel.map((item) => item.sequenceId)));
      await bulkCancelReminderSequences(sequenceIds, "MANUALLY_CANCELLED");
      setSelectedDueIds([]);
      setSuccessMsg(`Cancelled reminders for ${itemsToCancel.length} selected customer(s).`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove selected reminders");
    } finally {
      setLoading(false);
    }
  };

  // Reschedule Handler
  const handleSaveReschedule = async () => {
    if (!rescheduleTarget) return;
    try {
      await rescheduleReminderAttempt(rescheduleTarget.attemptId, rescheduleTarget.newDate);
      setSuccessMsg(
        `Rescheduled reminder for ${rescheduleTarget.customerName} to ${new Date(rescheduleTarget.newDate).toLocaleDateString("en-GB")}.`,
      );
      setRescheduleTarget(null);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reschedule reminder");
    }
  };

  // Bulk Sequential Workflow
  const handleStartBulkSequential = () => {
    const selectedItems = dueList.filter((item) => selectedDueIds.includes(item.attemptId));
    if (selectedItems.length === 0) return;
    setBulkQueue(selectedItems);
    setBulkQueueIndex(0);
    setBulkStats({ confirmed: 0, skipped: 0 });
    openPreview(selectedItems[0]);
  };

  const handleBulkConfirmSentCurrent = async () => {
    if (bulkQueueIndex === null || !bulkQueue[bulkQueueIndex]) return;
    const currentItem = bulkQueue[bulkQueueIndex];
    try {
      await confirmManualSend(currentItem.attemptId, activeMessage);
      setBulkStats((prev) => ({
        confirmed: (prev?.confirmed || 0) + 1,
        skipped: prev?.skipped || 0,
      }));
      advanceBulkQueue();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to confirm send in sequential mode");
    }
  };

  const handleBulkSkipCurrent = () => {
    setBulkStats((prev) => ({
      confirmed: prev?.confirmed || 0,
      skipped: (prev?.skipped || 0) + 1,
    }));
    advanceBulkQueue();
  };

  const advanceBulkQueue = () => {
    if (bulkQueueIndex === null) return;
    const nextIndex = bulkQueueIndex + 1;
    if (nextIndex < bulkQueue.length) {
      setBulkQueueIndex(nextIndex);
      openPreview(bulkQueue[nextIndex]);
    } else {
      // Completed queue
      const finalConfirmed = (bulkStats?.confirmed || 0) + (bulkStats ? 1 : 0);
      const finalSkipped = bulkStats?.skipped || 0;
      setBulkQueueIndex(null);
      setBulkQueue([]);
      closePreview();
      setSelectedDueIds([]);
      setSuccessMsg(
        `Sequential Sending Completed: ${finalConfirmed} confirmed sent, ${finalSkipped} skipped.`,
      );
      void loadAll();
    }
  };

  const handleCancelBulkWorkflow = () => {
    setBulkQueueIndex(null);
    setBulkQueue([]);
    closePreview();
  };

  // Template Management
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await updateReminderTemplate(editingTemplate.id, {
        title: editingTemplate.title,
        bodyText: editingTemplate.bodyText,
      });
      setEditingTemplate(null);
      setSuccessMsg(`Template for Step ${editingTemplate.stepNumber} updated successfully.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update template");
    }
  };

  const handleRestoreTemplate = async (templateId: string, stepNumber: number) => {
    try {
      await restoreDefaultTemplate(templateId);
      setSuccessMsg(`Restored default template text for Step ${stepNumber}.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to restore default template");
    }
  };

  // Settings Management
  const handleSaveSettings = async () => {
    setError(null);
    try {
      await updateReminderSettings(selectedMode, optOutKeywords);
      setSuccessMsg(`Settings saved successfully! Active WhatsApp mode: ${selectedMode}`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    }
  };

  // Consent Management
  const handleSaveConsent = async () => {
    if (!consentDialog) return;
    try {
      await updateCustomerConsent(consentDialog.customerId, newConsentStatus);
      setConsentDialog(null);
      setSuccessMsg(
        `Updated WhatsApp consent for ${consentDialog.customerName} to ${newConsentStatus}.`,
      );
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save consent");
    }
  };

  // Early Reminder Search & Selection
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
      setSuccessMsg(`Prepared reminder for ${reminderItem.customerName}! You can review and send.`);
      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to prepare early reminder");
    } finally {
      setLoading(false);
    }
  };

  // Selection helpers
  const handleToggleSelectDue = (id: string) => {
    setSelectedDueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllDue = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDueIds(dueList.map((item) => item.attemptId));
    } else {
      setSelectedDueIds([]);
    }
  };

  // Navigating tabs directly via KPI cards
  const handleKpiCardClick = (targetTab: number, filter?: { type: string; value: string }) => {
    setTabIndex(targetTab);
    if (filter) {
      if (filter.type === "historyStatus") setHistoryStatusFilter(filter.value);
      if (filter.type === "seqStatus") setSequenceStatusFilter(filter.value);
    }
  };

  const getModeBadge = (mode: string) => {
    if (mode === "MANUAL_FREE") {
      return (
        <Tooltip title="Guaranteed ₹0 WhatsApp click-to-chat links. Zero API or message fees.">
          <Chip label="MANUAL FREE (₹0 Click-to-Chat)" color="success" size="small" />
        </Tooltip>
      );
    }
    if (mode === "META_TEST") {
      return (
        <Tooltip title="Meta Cloud API developer test allowlist recipients only.">
          <Chip label="META CLOUD API (Sandbox Test Only)" color="warning" size="small" />
        </Tooltip>
      );
    }
    return (
      <Tooltip title="Messaging is disabled. Reminders are tracked in the database only.">
        <Chip label="DISABLED (No Messages Sent)" color="default" size="small" />
      </Tooltip>
    );
  };

  const paginatedDueList = useMemo(() => {
    const start = duePage * dueRowsPerPage;
    return dueList.slice(start, start + dueRowsPerPage);
  }, [dueList, duePage, dueRowsPerPage]);

  const paginatedHistoryList = useMemo(() => {
    const start = historyPage * historyRowsPerPage;
    return historyList.slice(start, start + historyRowsPerPage);
  }, [historyList, historyPage, historyRowsPerPage]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Modern Header Banner */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 3,
          bgcolor: "background.paper",
          borderColor: "divider",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", md: "center" },
            }}
          >
            <Box>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
              >
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                  Eye Checkup Reminders
                </Typography>
                <Chip
                  label="Harshu Chasma Ghar"
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                {dashboard && getModeBadge(dashboard.mode)}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                6-Month Post-Purchase Vision Checkup Detection & 3-Step WhatsApp Care Reminders
                (Zero Messaging Costs Policy)
              </Typography>
            </Box>

            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
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
                {syncing ? "Evaluating..." : "Sync Due Eligibility"}
              </Button>

              <Button
                variant="outlined"
                startIcon={<SettingsOutlined />}
                onClick={() => setTabIndex(6)}
              >
                Settings
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert
          severity="success"
          onClose={() => setSuccessMsg(null)}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          {successMsg}
        </Alert>
      )}

      {/* 8 Real Database KPI Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            title: "Total Eligible",
            subtitle: "Qualifying 6-mo+ customers",
            count: dashboard?.stats.totalEligible ?? 0,
            color: "text.primary",
            bgColor: "#F8FAFC",
            borderColor: "#CBD5E1",
            icon: <EventAvailableOutlined sx={{ fontSize: 28, color: "primary.main" }} />,
            onClick: () => handleKpiCardClick(1),
          },
          {
            title: "Due Today",
            subtitle: "Ready for sending",
            count: dashboard?.stats.due ?? 0,
            color: "error.main",
            bgColor: "#FEF2F2",
            borderColor: "#FECACA",
            icon: <AccessTimeOutlined sx={{ fontSize: 28, color: "error.main" }} />,
            onClick: () => handleKpiCardClick(1),
          },
          {
            title: "Upcoming",
            subtitle: "Future scheduled follow-ups",
            count: dashboard?.stats.upcoming ?? 0,
            color: "primary.main",
            bgColor: "#EFF6FF",
            borderColor: "#BFDBFE",
            icon: <CalendarTodayOutlined sx={{ fontSize: 28, color: "primary.main" }} />,
            onClick: () => handleKpiCardClick(2),
          },
          {
            title: "Confirmed Sent",
            subtitle: "Sent via WhatsApp",
            count: dashboard?.stats.confirmedSent ?? 0,
            color: "success.main",
            bgColor: "#F0FDF4",
            borderColor: "#BBF7D0",
            icon: <DoneAllOutlined sx={{ fontSize: 28, color: "success.main" }} />,
            onClick: () => handleKpiCardClick(3, { type: "historyStatus", value: "SENT" }),
          },
          {
            title: "Paused",
            subtitle: "Temporarily held",
            count: dashboard?.stats.paused ?? 0,
            color: "warning.main",
            bgColor: "#FFFBEB",
            borderColor: "#FDE68A",
            icon: <PauseOutlined sx={{ fontSize: 28, color: "warning.main" }} />,
            onClick: () => handleKpiCardClick(4, { type: "seqStatus", value: "PAUSED" }),
          },
          {
            title: "Cancelled",
            subtitle: "Opt-outs & removed",
            count: dashboard?.stats.cancelled ?? 0,
            color: "text.secondary",
            bgColor: "#F1F5F9",
            borderColor: "#E2E8F0",
            icon: <BlockOutlined sx={{ fontSize: 28, color: "text.secondary" }} />,
            onClick: () => handleKpiCardClick(4, { type: "seqStatus", value: "CANCELLED" }),
          },
          {
            title: "Completed",
            subtitle: "Finished all 3 steps",
            count: dashboard?.stats.completed ?? 0,
            color: "info.main",
            bgColor: "#F0F9FF",
            borderColor: "#BAE6FD",
            icon: <CheckCircleOutlined sx={{ fontSize: 28, color: "info.main" }} />,
            onClick: () => handleKpiCardClick(4, { type: "seqStatus", value: "COMPLETED" }),
          },
          {
            title: "Failed / Unresolved",
            subtitle: "Messaging errors",
            count: dashboard?.stats.failedOrUnresolved ?? 0,
            color: "error.main",
            bgColor: "#FFF1F2",
            borderColor: "#FECDD3",
            icon: <ErrorOutlineOutlined sx={{ fontSize: 28, color: "error.main" }} />,
            onClick: () => handleKpiCardClick(3, { type: "historyStatus", value: "FAILED" }),
          },
        ].map((stat, idx) => (
          <Grid key={idx} size={{ xs: 6, sm: 3, md: 1.5 }}>
            <Card
              variant="outlined"
              onClick={stat.onClick}
              sx={{
                borderRadius: 2.5,
                bgcolor: stat.bgColor,
                borderColor: stat.borderColor,
                cursor: "pointer",
                transition: "all 0.15s ease",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                },
              }}
            >
              <CardContent sx={{ p: 1.75, textAlign: "center" }}>
                <Box sx={{ mb: 0.5, display: "flex", justifyContent: "center" }}>{stat.icon}</Box>
                <Typography
                  variant="h5"
                  sx={{ fontWeight: 800, color: stat.color, lineHeight: 1.2 }}
                >
                  {stat.count}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, display: "block", color: "text.primary", mt: 0.5 }}
                >
                  {stat.title}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
                  {stat.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, val) => setTabIndex(val)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": {
              fontWeight: 700,
              textTransform: "none",
              fontSize: "0.92rem",
              minHeight: 48,
            },
          }}
        >
          <Tab
            icon={<DashboardOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Overview"
          />
          <Tab
            icon={<AccessTimeOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Due Reminders (${dueList.length})`}
          />
          <Tab
            icon={<CalendarTodayOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Upcoming (${upcomingList.length})`}
          />
          <Tab
            icon={<HistoryOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Reminder History (${historyList.length})`}
          />
          <Tab
            icon={<BlockOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Cancelled / Paused (${sequences.length})`}
          />
          <Tab
            icon={<MessageOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Message Templates"
          />
          <Tab
            icon={<SettingsOutlined sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Settings"
          />
        </Tabs>
      </Box>

      {/* TAB 0: OVERVIEW */}
      {tabIndex === 0 && (
        <Stack spacing={3}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                  How Harshu Chasma Ghar Reminders Work
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Our automated 3-step reminder system guarantees high customer retention while
                  adhering strictly to zero-cost messaging policies.
                </Typography>

                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Chip
                      label="1"
                      color="primary"
                      size="small"
                      sx={{ fontWeight: 800, height: 24, width: 24 }}
                    />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Automatic 6-Month Detection
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Identifies customers whose last purchase was exactly 6 calendar months ago.
                        Mid-month and month-end dates are accurately clamped.
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Chip
                      label="2"
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 800, height: 24, width: 24 }}
                    />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        3-Day Step Sequence
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Step 1 is the 6-month checkup reminder. After staff confirms sending, Step 2
                        is scheduled for 3 days later, followed by Step 3 (final follow-up).
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <Chip
                      label="3"
                      color="success"
                      size="small"
                      sx={{ fontWeight: 800, height: 24, width: 24 }}
                    />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Zero Cost Guaranteed (MANUAL_FREE)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Opens official WhatsApp click-to-chat links prefilled with personalized
                        customer messages. Never incurs API fees or per-conversation charges.
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card variant="outlined" sx={{ borderRadius: 3, p: 3, height: "100%" }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Quick Staff Actions
                </Typography>
                <Stack spacing={1.5}>
                  <Button
                    variant="contained"
                    fullWidth
                    color="primary"
                    startIcon={<PersonSearchOutlined />}
                    onClick={() => {
                      setEarlySendOpen(true);
                      setEarlyQuery("");
                      setEarlySearchResults([]);
                    }}
                  >
                    Send Early Reminder to Any Customer
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    color="success"
                    startIcon={<SendOutlined />}
                    onClick={() => setTabIndex(1)}
                  >
                    View Due Reminders Ready to Send ({dueList.length})
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<RefreshOutlined />}
                    onClick={handleSync}
                    disabled={syncing || loading}
                  >
                    {syncing ? "Evaluating..." : "Run Eligibility Sync"}
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<MessageOutlined />}
                    onClick={() => setTabIndex(5)}
                  >
                    Customize Message Templates
                  </Button>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </Stack>
      )}

      {/* TAB 1: DUE REMINDERS */}
      {tabIndex === 1 && (
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
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Due Reminders Ready to Send ({dueList.length})
              </Typography>
              <TextField
                size="small"
                placeholder="Search by customer name or phone..."
                value={dueSearchQuery}
                onChange={(e) => setDueSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadAll()}
                sx={{ width: 260 }}
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
                    Cancel Selected ({selectedDueIds.length})
                  </Button>
                </>
              )}
            </Stack>
          </Box>

          {dueList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                No reminders are due today. Click "Sync Due Eligibility" to check for newly eligible
                customers or "Send Reminder Early" to trigger one immediately.
              </Typography>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          selectedDueIds.length > 0 && selectedDueIds.length < dueList.length
                        }
                        checked={dueList.length > 0 && selectedDueIds.length === dueList.length}
                        onChange={handleSelectAllDue}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mobile Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last Purchase</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>WhatsApp Consent</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDueList.map((item) => {
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
                          <Typography
                            component={Link}
                            to={`/customers/${item.customerId}`}
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: "primary.main",
                              textDecoration: "none",
                              "&:hover": { textDecoration: "underline" },
                            }}
                          >
                            {item.customerName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                            {item.mobNumber || "—"}
                          </Typography>
                          {!item.isValidPhone && (
                            <Typography variant="caption" color="error" sx={{ display: "block" }}>
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
                          <Stack direction="row" spacing={0.75} sx={{ justifyContent: "flex-end" }}>
                            <Tooltip title="Preview & Customize Message">
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
                              onClick={() => openPreview(item)}
                              disabled={dashboard?.mode === "DISABLED" || !item.isValidPhone}
                              sx={{ fontWeight: 600 }}
                            >
                              Send
                            </Button>

                            <Tooltip title="Reschedule Date">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() =>
                                  setRescheduleTarget({
                                    attemptId: item.attemptId,
                                    customerName: item.customerName,
                                    currentDate: item.scheduledFor,
                                    newDate: new Date().toISOString().slice(0, 10),
                                  })
                                }
                              >
                                <CalendarTodayOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Cancel from Reminder List">
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

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={dueList.length}
                rowsPerPage={dueRowsPerPage}
                page={duePage}
                onPageChange={(_, p) => setDuePage(p)}
                onRowsPerPageChange={(e) => {
                  setDueRowsPerPage(parseInt(e.target.value, 10));
                  setDuePage(0);
                }}
              />
            </Card>
          )}
        </Box>
      )}

      {/* TAB 2: UPCOMING REMINDERS */}
      {tabIndex === 2 && (
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
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Upcoming Scheduled Reminders ({upcomingList.length})
              </Typography>
              <TextField
                size="small"
                placeholder="Search upcoming customer name or phone..."
                value={upcomingSearchQuery}
                onChange={(e) => setUpcomingSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadAll()}
                sx={{ width: 280 }}
              />
              <Button variant="outlined" size="small" onClick={() => void loadAll()}>
                Search
              </Button>
            </Stack>
          </Box>

          {upcomingList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                No upcoming future reminders found matching filter.
              </Typography>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Mobile Number</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Scheduled For</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Last Purchase</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upcomingList.map((item) => (
                    <TableRow key={item.attemptId} hover>
                      <TableCell>
                        <Typography
                          component={Link}
                          to={`/customers/${item.customerId}`}
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: "primary.main",
                            textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                          }}
                        >
                          {item.customerName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                          {item.mobNumber || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`Step ${item.stepNumber} of 3`}
                          size="small"
                          color={item.stepNumber === 2 ? "warning" : "error"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {new Date(item.scheduledFor).toLocaleDateString("en-GB")}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {item.purchaseDate
                          ? new Date(item.purchaseDate).toLocaleDateString("en-GB")
                          : "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<CalendarTodayOutlined />}
                            onClick={() =>
                              setRescheduleTarget({
                                attemptId: item.attemptId,
                                customerName: item.customerName,
                                currentDate: item.scheduledFor,
                                newDate: new Date().toISOString().slice(0, 10),
                              })
                            }
                          >
                            Reschedule
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<SendOutlined />}
                            onClick={() => openPreview(item)}
                          >
                            Send Early
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Box>
      )}

      {/* TAB 3: REMINDER HISTORY */}
      {tabIndex === 3 && (
        <Box>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Search history by name or phone..."
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadAll()}
              sx={{ width: 260 }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              sx={{ width: 160 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="SENT">Sent</MenuItem>
              <MenuItem value="DELIVERED">Delivered</MenuItem>
              <MenuItem value="FAILED">Failed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </TextField>
            <Button variant="outlined" size="small" onClick={() => void loadAll()}>
              Filter
            </Button>
          </Box>

          {historyList.length === 0 ? (
            <Card variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 3 }}>
              <Typography variant="body1" color="text.secondary">
                No reminder attempts recorded yet.
              </Typography>
            </Card>
          ) : (
            <Card variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Channel</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Confirmed By</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedHistoryList.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography
                          component={Link}
                          to={`/customers/${item.customer.id}`}
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: "primary.main",
                            textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                          }}
                        >
                          {item.customer.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ fontFamily: "monospace", display: "block" }}
                        >
                          {item.recipientPhone}
                        </Typography>
                      </TableCell>
                      <TableCell>Step {item.stepNumber} of 3</TableCell>
                      <TableCell>
                        <Chip
                          label={item.status}
                          size="small"
                          color={
                            item.status === "SENT" || item.status === "DELIVERED"
                              ? "success"
                              : item.status === "FAILED"
                                ? "error"
                                : "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {item.channel || "MANUAL_CLICK_TO_CHAT"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {item.manualConfirmedBy || "staff"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {item.sentAt
                            ? new Date(item.sentAt).toLocaleDateString("en-GB")
                            : new Date(item.scheduledFor).toLocaleDateString("en-GB")}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 260 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {item.messageContent}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={historyList.length}
                rowsPerPage={historyRowsPerPage}
                page={historyPage}
                onPageChange={(_, p) => setHistoryPage(p)}
                onRowsPerPageChange={(e) => {
                  setHistoryRowsPerPage(parseInt(e.target.value, 10));
                  setHistoryPage(0);
                }}
              />
            </Card>
          )}
        </Box>
      )}

      {/* TAB 4: CANCELLED / PAUSED */}
      {tabIndex === 4 && (
        <Box>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Search customer name or phone..."
              value={sequenceSearchQuery}
              onChange={(e) => setSequenceSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadAll()}
              sx={{ width: 260 }}
            />
            <TextField
              select
              size="small"
              label="Status"
              value={sequenceStatusFilter}
              onChange={(e) => setSequenceStatusFilter(e.target.value)}
              sx={{ width: 160 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="PAUSED">Paused</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
            </TextField>
            <Button variant="outlined" size="small" onClick={() => void loadAll()}>
              Filter
            </Button>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 3, overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700 }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Current Step</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Eligibility Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reason / Note</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sequences.map((seq) => (
                  <TableRow key={seq.id} hover>
                    <TableCell>
                      <Typography
                        component={Link}
                        to={`/customers/${seq.customer.id}`}
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: "primary.main",
                          textDecoration: "none",
                          "&:hover": { textDecoration: "underline" },
                        }}
                      >
                        {seq.customer.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: "monospace", display: "block" }}
                      >
                        {seq.customer.mobNumber || "No phone"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={seq.status}
                        size="small"
                        color={
                          seq.status === "PAUSED"
                            ? "warning"
                            : seq.status === "COMPLETED"
                              ? "success"
                              : seq.status === "CANCELLED"
                                ? "error"
                                : "default"
                        }
                      />
                    </TableCell>
                    <TableCell>Step {seq.currentStep} of 3</TableCell>
                    <TableCell>
                      {new Date(seq.eligibilityDate).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {seq.cancellationReason || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                        {seq.status === "PAUSED" && (
                          <Tooltip title="Resume Sequence">
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<PlayArrowOutlined />}
                              onClick={() => void handleResume(seq.id)}
                            >
                              Resume
                            </Button>
                          </Tooltip>
                        )}

                        {seq.status === "SCHEDULED" || seq.status === "IN_PROGRESS" ? (
                          <Tooltip title="Pause Sequence">
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<PauseOutlined />}
                              onClick={() => void handlePause(seq.id)}
                            >
                              Pause
                            </Button>
                          </Tooltip>
                        ) : null}

                        {seq.status !== "CANCELLED" && (
                          <Tooltip title="Cancel Sequence">
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<BlockOutlined />}
                              onClick={() => void handleCancel(seq.id, seq.customer.name)}
                            >
                              Cancel
                            </Button>
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

      {/* TAB 5: MESSAGE TEMPLATES */}
      {tabIndex === 5 && (
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Eye Checkup Reminder Templates (Harshu Chasma Ghar)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Personalized variables available: <code>{"{{customerName}}"}</code>,{" "}
              <code>{"{{shopName}}"}</code>, <code>{"{{purchaseDate}}"}</code>,{" "}
              <code>{"{{specsType}}"}</code>. Messages resolve shop name to{" "}
              <strong>Harshu Chasma Ghar</strong>.
            </Typography>
          </Box>

          <Grid container spacing={2.5}>
            {dashboard?.templates.map((tpl) => (
              <Grid key={tpl.id} size={{ xs: 12, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    p: 2.5,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1.5,
                    }}
                  >
                    <Chip
                      label={`Step ${tpl.stepNumber}`}
                      color={
                        tpl.stepNumber === 1
                          ? "primary"
                          : tpl.stepNumber === 2
                            ? "warning"
                            : "error"
                      }
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Restore Factory Default">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => void handleRestoreTemplate(tpl.id, tpl.stepNumber)}
                        >
                          <RestartAltOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        variant="outlined"
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
                    </Stack>
                  </Box>

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {tpl.title}
                  </Typography>

                  <Box
                    sx={{
                      bgcolor: "grey.50",
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      whiteSpace: "pre-wrap",
                      flex: 1,
                      mb: 2,
                    }}
                  >
                    {tpl.bodyText}
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Personalized Live Preview (Sample Customer):
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: "#F0FDF4",
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid #BBF7D0",
                      fontSize: "0.82rem",
                      mt: 0.5,
                    }}
                  >
                    {tpl.bodyText
                      .replace(/\{\{customerName\}\}/g, "Ramesh Kumar")
                      .replace(/\{\{shopName\}\}/g, "Harshu Chasma Ghar")
                      .replace(/\{\{purchaseDate\}\}/g, "2026-04-15")
                      .replace(/\{\{specsType\}\}/g, "Spectacles")}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Stack>
      )}

      {/* TAB 6: SETTINGS */}
      {tabIndex === 6 && (
        <Card variant="outlined" sx={{ borderRadius: 3, p: 3, maxWidth: 800 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                WhatsApp Reminder Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage sending mode, opt-out keywords, and test sandbox allowlists.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Operation Mode (Zero Messaging Cost Policy)
              </Typography>
              <TextField
                select
                fullWidth
                value={selectedMode}
                onChange={(e) => setSelectedMode(e.target.value)}
                helperText="MANUAL_FREE is 100% permanently ₹0 with zero API charges. META_TEST uses official developer sandbox test recipients only."
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
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Opt-Out Keywords
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="Keywords (comma-separated)"
                value={optOutKeywords}
                onChange={(e) => setOptOutKeywords(e.target.value)}
                helperText="If an inbound WhatsApp message contains any of these words, the customer is immediately opted out."
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Registered Meta Cloud API Test Recipients
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: "monospace", bgcolor: "grey.100", p: 1.5, borderRadius: 2 }}
              >
                {dashboard?.allowedTestRecipients.join(", ") ||
                  "None configured (set META_WHATSAPP_TEST_RECIPIENTS in server/.env)"}
              </Typography>
            </Box>

            <Divider />

            <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
              <Button variant="contained" color="primary" onClick={() => void handleSaveSettings()}>
                Save Settings
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}

      {/* PREVIEW & EDIT DIALOG (SINGLE & SEQUENTIAL BULK SENDING) */}
      <Dialog open={!!previewItem} onClose={closePreview} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {bulkQueueIndex !== null
                ? `Sequential Send: Customer ${bulkQueueIndex + 1} of ${bulkQueue.length}`
                : `Reminder Preview — Step ${previewItem?.stepNumber} of 3`}
            </Typography>
            {bulkQueueIndex !== null && (
              <LinearProgress
                variant="determinate"
                value={((bulkQueueIndex + 1) / bulkQueue.length) * 100}
                sx={{ mt: 1, borderRadius: 1 }}
              />
            )}
          </Box>
          <Chip label={dashboard?.mode || "DISABLED"} size="small" />
        </DialogTitle>
        <DialogContent dividers>
          {previewItem && (
            <Stack spacing={2.5}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Customer
                  </Typography>
                  <Typography
                    component={Link}
                    to={`/customers/${previewItem.customerId}`}
                    variant="body1"
                    sx={{
                      fontWeight: 700,
                      color: "primary.main",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    {previewItem.customerName}
                    <OpenInNewOutlined sx={{ fontSize: 16 }} />
                  </Typography>
                  {previewItem.normalizedPhone && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: "monospace" }}
                    >
                      WhatsApp: +{previewItem.normalizedPhone}
                    </Typography>
                  )}
                </Box>

                <Chip
                  label={`Consent: ${previewItem.consentStatus}`}
                  size="small"
                  color={previewItem.consentStatus === "OPTED_IN" ? "success" : "default"}
                />
              </Box>

              <Box>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.75 }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                    Personalized Message (Editable Before Sending)
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
                  helperText={`${activeMessage.length} characters — personalized for Harshu Chasma Ghar`}
                  sx={{
                    bgcolor: "#F0FDF4",
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "#86EFAC" },
                      "&:hover fieldset": { borderColor: "#4ADE80" },
                      "&.Mui-focused fieldset": { borderColor: "#22C55E" },
                    },
                  }}
                />
              </Box>

              <Alert severity="info" icon={<InfoOutlined fontSize="inherit" />}>
                {dashboard?.mode === "MANUAL_FREE" &&
                  "Click 'Open WhatsApp' to chat directly in WhatsApp Web/App. After sending, click 'Confirm Sent' to advance sequence by 3 days."}
                {dashboard?.mode === "META_TEST" &&
                  "Test via Meta Cloud API sandbox strictly for registered test recipient numbers."}
                {dashboard?.mode === "DISABLED" &&
                  "Messaging is currently DISABLED. Change mode to MANUAL_FREE in Settings to send."}
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2.5 }}>
          <Box>
            {bulkQueueIndex !== null ? (
              <Button
                color="inherit"
                onClick={handleCancelBulkWorkflow}
                startIcon={<CloseOutlined />}
              >
                Cancel Remaining
              </Button>
            ) : (
              previewItem && (
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  startIcon={<DeleteOutlined />}
                  onClick={() => {
                    void handleCancel(previewItem.sequenceId, previewItem.customerName);
                    closePreview();
                  }}
                >
                  Cancel Reminder
                </Button>
              )
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            {bulkQueueIndex !== null && (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<SkipNextOutlined />}
                onClick={handleBulkSkipCurrent}
              >
                Skip Customer
              </Button>
            )}

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
                    if (bulkQueueIndex !== null) {
                      void handleBulkConfirmSentCurrent();
                    } else {
                      void handleConfirmSent(previewItem.attemptId, activeMessage);
                    }
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

            {bulkQueueIndex === null && <Button onClick={closePreview}>Close</Button>}
          </Stack>
        </DialogActions>
      </Dialog>

      {/* RESCHEDULE DIALOG */}
      <Dialog
        open={!!rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Reschedule Reminder</DialogTitle>
        <DialogContent dividers>
          {rescheduleTarget && (
            <Stack spacing={2}>
              <Typography variant="body2">
                Reschedule next checkup reminder for{" "}
                <strong>{rescheduleTarget.customerName}</strong>.
              </Typography>
              <TextField
                fullWidth
                label="New Reminder Date"
                type="date"
                value={rescheduleTarget.newDate}
                onChange={(e) =>
                  setRescheduleTarget({ ...rescheduleTarget, newDate: e.target.value })
                }
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Selecting today makes it due immediately. Future dates will be scheduled accordingly."
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescheduleTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveReschedule()}>
            Confirm Reschedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* TEMPLATE EDIT DIALOG */}
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
                helperText="Variables: {{customerName}}, {{shopName}}, {{purchaseDate}}, {{specsType}}"
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

      {/* CUSTOMER CONSENT DIALOG */}
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

      {/* EARLY SEND SEARCH CUSTOMER DIALOG */}
      <Dialog open={earlySendOpen} onClose={() => setEarlySendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Reminder Early (Search Any Customer)</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Search any active customer by name or mobile number to send an immediate eye checkup
              reminder for Harshu Chasma Ghar, even if 6 months hasn't elapsed.
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
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Last Purchase</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {earlySearchResults.map((cust) => (
                      <TableRow key={cust.id} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
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
                            variant="contained"
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
