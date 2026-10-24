import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import {
  getReminderDashboardHandler,
  getDueRemindersHandler,
  getReminderSequencesHandler,
  syncRemindersHandler,
  confirmManualSendHandler,
  sendTestMetaApiHandler,
  pauseSequenceHandler,
  resumeSequenceHandler,
  cancelSequenceHandler,
  updateReminderSettingsHandler,
  updateReminderTemplateHandler,
  updateCustomerConsentHandler,
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
router.get("/sequences", getReminderSequencesHandler);
router.post("/sync", syncRemindersHandler);
router.post("/confirm-manual", confirmManualSendHandler);
router.post("/send-test", sendTestMetaApiHandler);
router.post("/sequences/:id/pause", pauseSequenceHandler);
router.post("/sequences/:id/resume", resumeSequenceHandler);
router.post("/sequences/:id/cancel", cancelSequenceHandler);
router.put("/settings", updateReminderSettingsHandler);
router.put("/templates/:id", updateReminderTemplateHandler);
router.post("/consent", updateCustomerConsentHandler);

export default router;

