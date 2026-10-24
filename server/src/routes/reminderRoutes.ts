import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import {
  getReminderDashboardHandler,
  getDueRemindersHandler,
  getUpcomingRemindersHandler,
  getReminderHistoryHandler,
  getReminderSequencesHandler,
  syncRemindersHandler,
  confirmManualSendHandler,
  sendTestMetaApiHandler,
  pauseSequenceHandler,
  resumeSequenceHandler,
  cancelSequenceHandler,
  bulkCancelSequencesHandler,
  rescheduleAttemptHandler,
  updateReminderSettingsHandler,
  updateReminderTemplateHandler,
  restoreDefaultTemplateHandler,
  updateCustomerConsentHandler,
  sendEarlyReminderHandler,
  searchCustomersForReminderHandler,
  getMetaWebhookHandler,
  postMetaWebhookHandler,
  scheduledCronHandler,
} from "../controllers/reminderController";

const router = Router();

// Public webhook endpoints for Meta WhatsApp Cloud API
router.get("/webhook", getMetaWebhookHandler);
router.post("/webhook", postMetaWebhookHandler);

// Protected cron endpoint for GitHub Actions / external cron
router.post("/cron", scheduledCronHandler);

// Authenticated staff/admin endpoints
router.use(requireAdmin);

router.get("/dashboard", getReminderDashboardHandler);
router.get("/due", getDueRemindersHandler);
router.get("/upcoming", getUpcomingRemindersHandler);
router.get("/history", getReminderHistoryHandler);
router.get("/sequences", getReminderSequencesHandler);
router.get("/search-customers", searchCustomersForReminderHandler);
router.post("/send-early", sendEarlyReminderHandler);
router.post("/sync", syncRemindersHandler);
router.post("/confirm-manual", confirmManualSendHandler);
router.post("/send-test", sendTestMetaApiHandler);
router.post("/attempts/:id/reschedule", rescheduleAttemptHandler);
router.post("/sequences/bulk-cancel", bulkCancelSequencesHandler);
router.post("/sequences/:id/pause", pauseSequenceHandler);
router.post("/sequences/:id/resume", resumeSequenceHandler);
router.post("/sequences/:id/cancel", cancelSequenceHandler);
router.put("/settings", updateReminderSettingsHandler);
router.put("/templates/:id", updateReminderTemplateHandler);
router.post("/templates/:id/restore-default", restoreDefaultTemplateHandler);
router.post("/consent", updateCustomerConsentHandler);

export default router;
