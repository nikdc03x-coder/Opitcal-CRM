import { expect, test as base, type Locator, type Page } from "@playwright/test";

const customer = {
  id: "customer-1",
  name: "Focus Test",
  mobNumber: "9999999999",
  gender: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  reference: null,
  notes: null,
  ageAtRecording: null,
  ageRecordedAt: null,
  prescriptions: [],
  records: [],
};
const order = {
  id: "order-1",
  orderNumber: "ORD-001",
  customerId: customer.id,
  purchaseRecordId: "purchase-1",
  status: "PLACED",
  expectedDeliveryDate: null,
  deliveredAt: null,
  cancelledAt: null,
  internalNotes: null,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
  customer,
  purchase: {
    id: "purchase-1",
    specsType: "Frame",
    lensType: null,
    mrp: "500",
    pricingMode: "MRP_ONLY",
    prescriptionId: null,
    purchaseDate: "2026-01-01",
  },
  history: [],
};

// No test requests reach the backend, including mutation requests.
const test = base.extend<{ focusDiagnostics: void }>({
  focusDiagnostics: [
    async ({ page }, use) => {
      const warnings: string[] = [];
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Log.enable");
      cdp.on("Log.entryAdded", ({ entry }) => {
        if (/Blocked aria-hidden|focus/i.test(entry.text) && entry.level === "warning") {
          warnings.push(entry.text);
        }
      });
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        let body: object = { success: true, data: [] };
        if (path === "/api/auth/me") body = { success: true, admin: { id: 1, username: "test" } };
        else if (path === "/api/customers/trash")
          body = {
            success: true,
            data: {
              customers: [{ ...customer, _count: { records: 0, prescriptions: 0 } }],
              purchases: [],
            },
          };
        else if (path === "/api/customers/customer-1") body = { success: true, data: customer };
        else if (path === "/api/orders")
          body = {
            success: true,
            data: {
              orders: [order],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            },
          };
        else if (path === "/api/orders/summary")
          body = {
            success: true,
            data: {
              placed: 1,
              processing: 0,
              ready: 0,
              delivered: 0,
              cancelled: 0,
              overdue: 0,
              active: 1,
            },
          };
        else if (path === "/api/orders/order-1") body = { success: true, data: order };
        else if (path === "/api/settings/me")
          body = {
            success: true,
            account: {
              id: 1,
              username: "test",
              name: "Test",
              email: "test@example.com",
              role: "ADMIN",
              isActive: true,
            },
          };
        else if (path === "/api/settings/users") body = { success: true, users: [] };
        else if (path === "/api/reminders/search-customers")
          body = {
            success: true,
            data: [
              {
                ...customer,
                isValidPhone: true,
                consentStatus: "OPTED_IN",
                latestPurchaseDate: null,
              },
            ],
          };
        else if (path === "/api/reminders/send-early")
          body = {
            success: true,
            data: {
              attemptId: "attempt-1",
              sequenceId: "sequence-1",
              stepNumber: 1,
              scheduledFor: customer.createdAt,
              customerId: customer.id,
              customerName: customer.name,
              mobNumber: customer.mobNumber,
              isValidPhone: true,
              consentStatus: "OPTED_IN",
              purchaseDate: null,
              renderedMessage: "Test reminder",
              clickToChatUrl: "https://wa.me/919999999999",
            },
          };
        else if (path === "/api/reminders/dashboard")
          body = {
            success: true,
            data: {
              mode: "DISABLED",
              optOutKeywords: "STOP",
              allowedTestRecipients: [],
              templates: [],
              stats: {
                totalEligible: 0,
                due: 0,
                upcoming: 0,
                confirmedSent: 0,
                paused: 0,
                cancelled: 0,
                completed: 0,
                failedOrUnresolved: 0,
              },
            },
          };
        await route.fulfill({ json: body });
      });
      await use();
      await cdp.send("Accessibility.getFullAXTree");
      expect(warnings, "Chrome accessibility warnings").toEqual([]);
    },
    { auto: true },
  ],
});

test("settings form and nested role menu restore focus", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("tab", { name: "User Management" }).click();
  const trigger = page.getByRole("button", { name: "Create user", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Full name" }).fill("Test");
  await dialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Administrator" }).click();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("purchase dialog nested prescription select restores focus", async ({ page }) => {
  await page.goto("/customers/customer-1");
  const trigger = page.getByRole("button", { name: /new purchase/i }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox").first();
  await select.click();
  await page.getByRole("option", { name: "Enter New Prescription" }).click();
  await expect(select).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("early reminder search dialog restores trigger after outlined input focus", async ({
  page,
}) => {
  await page.goto("/reminders");
  const trigger = page.getByRole("button", { name: "Send Reminder Early", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await dialog.getByRole("textbox").fill("Test");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("early reminder closes before preview opens and restores the original page trigger", async ({
  page,
}) => {
  await page.goto("/reminders");
  const trigger = page.getByRole("button", { name: "Send Reminder Early", exact: true });
  await trigger.click();
  const search = page.getByRole("dialog");
  await search.getByRole("textbox").fill("Test");
  await page.keyboard.press("Enter");
  await search.getByRole("button", { name: "Send", exact: true }).click();
  const preview = page.getByRole("dialog");
  await expect(preview).toHaveCount(1);
  await expect(preview).toContainText("Test reminder");
  await cycleFocus(page, preview);
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(trigger).toBeFocused();
});

async function cycleFocus(page: Page, overlay: Locator) {
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(key);
      await expect
        .poll(() => overlay.evaluate((node) => node.contains(document.activeElement)))
        .toBe(true);
    }
  }
}

test("drawer mouse/keyboard opening, focus trap and all close paths restore trigger", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/customers");
  await expect(page.getByRole("textbox")).toBeFocused();
  const trigger = page.getByRole("button", { name: "Open navigation" });
  for (const close of ["escape", "button", "backdrop"]) {
    if (close === "button") {
      await trigger.focus();
      await page.keyboard.press("Enter");
    } else await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await cycleFocus(page, drawer);
    if (close === "escape") await page.keyboard.press("Escape");
    else if (close === "button")
      await drawer.getByRole("button", { name: "Close navigation" }).click();
    else await page.locator(".MuiBackdrop-root").click({ position: { x: 350, y: 400 } });
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator("#root")).not.toHaveAttribute("aria-hidden", "true");
  }
});

test("mobile navigation to customer search and desktop resize release modal focus", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/admin/catalog");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await expect(page.getByRole("textbox")).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("#root")).not.toHaveAttribute("aria-hidden", "true");
  await page.getByRole("textbox").focus();
  await expect(page.getByRole("textbox")).toBeFocused();
});

test("catalog form preserves focus on Escape, Cancel, and repeated openings", async ({ page }) => {
  await page.goto("/admin/catalog");
  const trigger = page.getByRole("button", { name: "Add Frame", exact: true });
  for (const close of ["escape", "cancel"]) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Frame Brand" }).fill("Focus test");
    await cycleFocus(page, dialog);
    if (close === "escape") await page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test("raw dialog with outlined input restores focus after Escape", async ({ page }) => {
  await page.goto("/trash");
  const trigger = page.getByRole("button", { name: "Permanently Delete", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Enter Administrator PIN")).toBeFocused();
  await cycleFocus(page, dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("order dialog nested Select/Menu and confirmation restore each trigger", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("button", { name: "Manage Details" }).first().click();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog).toBeVisible();
  const select = dialog.getByRole("combobox");
  await select.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(select).toBeFocused();
  const remove = dialog.getByRole("button", { name: "Remove Order", exact: true });
  await remove.click();
  const nested = page.getByRole("dialog", { name: "Remove Order?" });
  await expect(nested).toBeVisible();
  await cycleFocus(page, nested);
  await page.keyboard.press("Escape");
  await expect(nested).toBeHidden();
  await expect(remove).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Manage Details" }).first()).toBeFocused();
});
