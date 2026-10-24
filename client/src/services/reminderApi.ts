import { apiFetch, ApiError } from "./http";

export interface ReminderDashboardData {
  mode: "DISABLED" | "MANUAL_FREE" | "META_TEST";
  optOutKeywords: string;
  allowedTestRecipients: string[];
  stats: {
    totalEligible: number;
    due: number;
    upcoming: number;
    confirmedSent: number;
    paused: number;
    cancelled: number;
    completed: number;
    failedOrUnresolved: number;
  };
  templates: Array<{
    id: string;
    stepNumber: number;
    title: string;
    bodyText: string;
    metaTemplateName: string | null;
    isActive: boolean;
  }>;
}

export interface DueReminderItem {
  attemptId: string;
  sequenceId: string;
  stepNumber: number;
  scheduledFor: string;
  customerId: string;
  customerName: string;
  mobNumber: string | null;
  normalizedPhone?: string;
  isValidPhone: boolean;
  phoneError?: string;
  consentStatus: "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED";
  purchaseDate: string | null;
  renderedMessage: string;
  clickToChatUrl: string;
}

export interface ReminderHistoryItem {
  id: string;
  sequenceId: string;
  stepNumber: number;
  status: "PENDING" | "ACCEPTED" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED";
  channel: string | null;
  scheduledFor: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  recipientPhone: string;
  messageContent: string;
  manualConfirmedBy: string | null;
  customer: {
    id: string;
    name: string;
    mobNumber: string | null;
  };
  purchaseDate: string | null;
  specsType: string | null;
}

export interface ReminderSequenceItem {
  id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "PAUSED";
  currentStep: number;
  eligibilityDate: string;
  cancellationReason: string | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    mobNumber: string | null;
    consent?: {
      status: "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED";
    } | null;
  };
  purchaseRecord: {
    id: string;
    purchaseDate: string | null;
    specsType: string | null;
  };
  attempts: Array<{
    id: string;
    stepNumber: number;
    status: "PENDING" | "ACCEPTED" | "SENT" | "DELIVERED" | "FAILED" | "CANCELLED";
    channel: string | null;
    scheduledFor: string;
    sentAt: string | null;
    deliveredAt: string | null;
    failureReason: string | null;
    messageContent: string;
    manualConfirmedBy: string | null;
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function fetchReminderDashboard(): Promise<ReminderDashboardData> {
  const res = await apiFetch("/api/reminders/dashboard");
  if (!res.ok) throw new ApiError("Failed to load reminder dashboard", res.status);
  const data = (await res.json()) as ApiResponse<ReminderDashboardData>;
  return data.data;
}

export async function fetchDueReminders(search?: string): Promise<DueReminderItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set("search", search.trim());
  const res = await apiFetch(`/api/reminders/due?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to load due reminders", res.status);
  const data = (await res.json()) as ApiResponse<DueReminderItem[]>;
  return data.data;
}

export async function fetchReminderSequences(
  status?: string,
  search?: string,
): Promise<ReminderSequenceItem[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const res = await apiFetch(`/api/reminders/sequences?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to load reminder sequences", res.status);
  const data = (await res.json()) as ApiResponse<ReminderSequenceItem[]>;
  return data.data;
}

export async function syncReminders(): Promise<{
  data: { sequencesCreated: number; dueRemindersCount: number };
}> {
  const res = await apiFetch("/api/reminders/sync", { method: "POST" });
  if (!res.ok) throw new ApiError("Failed to sync reminder eligibility", res.status);
  return (await res.json()) as { data: { sequencesCreated: number; dueRemindersCount: number } };
}

export async function confirmManualSend(
  attemptId: string,
  customMessage?: string,
): Promise<{ success: boolean }> {
  const res = await apiFetch("/api/reminders/confirm-manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, customMessage }),
  });
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(errData.message || "Failed to confirm manual send", res.status);
  }
  return (await res.json()) as { success: boolean };
}

export async function sendMetaTestApi(
  attemptId: string,
  customMessage?: string,
): Promise<{
  success: boolean;
  data?: { recipientPhone: string; messageId?: string; error?: string };
}> {
  const res = await apiFetch("/api/reminders/send-test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, customMessage }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success: boolean;
    data?: { recipientPhone: string; messageId?: string; error?: string };
    message?: string;
  };
  if (!res.ok) {
    throw new ApiError(data.message || "Failed to send Meta Cloud API test message", res.status);
  }
  return data;
}

export async function pauseReminderSequence(sequenceId: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/sequences/${sequenceId}/pause`, { method: "POST" });
  if (!res.ok) throw new ApiError("Failed to pause reminder sequence", res.status);
  return (await res.json()) as { success: boolean };
}

export async function resumeReminderSequence(sequenceId: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/sequences/${sequenceId}/resume`, { method: "POST" });
  if (!res.ok) throw new ApiError("Failed to resume reminder sequence", res.status);
  return (await res.json()) as { success: boolean };
}

export async function cancelReminderSequence(sequenceId: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/sequences/${sequenceId}/cancel`, { method: "POST" });
  if (!res.ok) throw new ApiError("Failed to cancel reminder sequence", res.status);
  return (await res.json()) as { success: boolean };
}

export async function updateReminderSettings(
  mode: string,
  optOutKeywords?: string,
): Promise<{ success: boolean }> {
  const res = await apiFetch("/api/reminders/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, optOutKeywords }),
  });
  if (!res.ok) throw new ApiError("Failed to update reminder settings", res.status);
  return (await res.json()) as { success: boolean };
}

export async function updateReminderTemplate(
  id: string,
  updates: Partial<{
    title: string;
    bodyText: string;
    metaTemplateName: string | null;
    isActive: boolean;
  }>,
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new ApiError("Failed to update template", res.status);
  return (await res.json()) as { success: boolean };
}

export async function updateCustomerConsent(
  customerId: string,
  status: "OPTED_IN" | "OPTED_OUT" | "UNSPECIFIED",
  notes?: string,
): Promise<{ success: boolean }> {
  const res = await apiFetch("/api/reminders/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId, status, notes }),
  });
  if (!res.ok) throw new ApiError("Failed to update customer consent", res.status);
  return (await res.json()) as { success: boolean };
}

export async function searchCustomersForReminder(query: string): Promise<
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
> {
  const params = new URLSearchParams({ q: query.trim() });
  const res = await apiFetch(`/api/reminders/search-customers?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to search customers", res.status);
  const data = (await res.json()) as ApiResponse<
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
  >;
  return data.data;
}

export async function sendEarlyReminder(customerId: string): Promise<DueReminderItem> {
  const res = await apiFetch("/api/reminders/send-early", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(errData.message || "Failed to trigger early reminder", res.status);
  }
  const data = (await res.json()) as ApiResponse<DueReminderItem>;
  return data.data;
}

export async function fetchUpcomingReminders(search?: string): Promise<DueReminderItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set("search", search.trim());
  const res = await apiFetch(`/api/reminders/upcoming?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to load upcoming reminders", res.status);
  const data = (await res.json()) as ApiResponse<DueReminderItem[]>;
  return data.data;
}

export async function fetchReminderHistory(
  search?: string,
  status?: string,
): Promise<ReminderHistoryItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set("search", search.trim());
  if (status && status.trim()) params.set("status", status.trim());
  const res = await apiFetch(`/api/reminders/history?${params.toString()}`);
  if (!res.ok) throw new ApiError("Failed to load reminder history", res.status);
  const data = (await res.json()) as ApiResponse<ReminderHistoryItem[]>;
  return data.data;
}

export async function rescheduleReminderAttempt(
  attemptId: string,
  newDate: string,
): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/attempts/${attemptId}/reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newDate }),
  });
  if (!res.ok) throw new ApiError("Failed to reschedule reminder", res.status);
  return (await res.json()) as { success: boolean };
}

export async function bulkCancelReminderSequences(
  sequenceIds: string[],
  reason?: string,
): Promise<{ success: boolean; data: { cancelled: number } }> {
  const res = await apiFetch("/api/reminders/sequences/bulk-cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequenceIds, reason }),
  });
  if (!res.ok) throw new ApiError("Failed to bulk cancel sequences", res.status);
  return (await res.json()) as { success: boolean; data: { cancelled: number } };
}

export async function restoreDefaultTemplate(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/reminders/templates/${id}/restore-default`, {
    method: "POST",
  });
  if (!res.ok) throw new ApiError("Failed to restore default template", res.status);
  return (await res.json()) as { success: boolean };
}
