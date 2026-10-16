const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
// nik - Playwright is an optional test tool from npm exec's cache, never a production dependency.
const packagePath = process.env.PATH.split(path.delimiter)
  .map((entry) => path.resolve(entry, "..", "playwright"))
  .find((entry) => fs.existsSync(path.join(entry, "package.json")));
const { chromium } = require(packagePath || "playwright");
const base = process.env.ANALYTICS_TEST_URL || "http://127.0.0.1:5175";
const summary = {
  purchases: 39,
  value: "89150.00",
  customers: 21,
  average: "2285.90",
  highest: "10000.00",
  frames: 30,
  lenses: 25,
  frameOnly: 10,
  lensOnly: 5,
  both: 20,
  unclassified: 4,
  undated: 1,
};
const period = { from: "2026-10-01", to: "2026-10-17", label: "2026-10-01 to 2026-10-17" };
const report = { period, summary, calculatedAt: "2026-10-17T00:00:00Z" };
const mix = [
  { name: "Frame Only", purchases: 10, share: 25.64 },
  { name: "Lens Only", purchases: 5, share: 12.82 },
  { name: "Frame + Lens", purchases: 20, share: 51.28 },
  { name: "Unclassified", purchases: 4, share: 10.26 },
];
const trend = [
  {
    label: "2026-10-01",
    from: "2026-10-01",
    to: "2026-10-01",
    value: "2500.10",
    purchases: 3,
    customers: 2,
  },
  {
    label: "2026-10-02",
    from: "2026-10-02",
    to: "2026-10-02",
    value: "3500.20",
    purchases: 4,
    customers: 3,
  },
];
const rank = [{ name: "Sample saved product", purchases: 10, share: 25.64 }];
const historical = {
  currentYear: 2026,
  today: "2026-10-17",
  totalCustomers: 83,
  recent: [],
  years: Array.from({ length: 23 }, (_, i) => ({
    year: 2004 + i,
    purchases: 39,
    value: "89150.00",
    elapsedValue: "45000.00",
    yearOnYear: i === 0 ? null : 0,
    months: Array.from({ length: 12 }, (_, j) => ({
      month: j + 1,
      value: String(1000 + j * 100),
      purchases: j + 1,
    })),
    categories: [
      { name: "Frame Only", value: "2000.00" },
      { name: "Lens Only", value: "3000.00" },
      { name: "Frame + Lens", value: "4000.00" },
      { name: "Not Specified", value: "1000.00" },
    ],
  })),
};
const distribution = [
  { name: "Male", count: 1, share: 50 },
  { name: "Female", count: 1, share: 50 },
  { name: "Other", count: 0, share: 0 },
  { name: "Unknown", count: 0, share: 0 },
];
const requests = [];
let failNextOverview = false;

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // nik - Browser fixtures are isolated to this test. Production charts always call the authenticated database APIs.
    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url()),
        name = url.pathname.split("/").at(-1);
      if (url.pathname === "/api/auth/me")
        return route.fulfill({ json: { success: true, admin: { id: 1, username: "UI Test" } } });
      if (!url.pathname.startsWith("/api/analytics/"))
        return route.fulfill({ status: 404, json: { success: false } });
      requests.push({ name, params: Object.fromEntries(url.searchParams) });
      if (name === "overview" && failNextOverview) {
        failNextOverview = false;
        return route.fulfill({
          status: 503,
          json: { success: false, message: "Temporary analytics test error" },
        });
      }
      let data;
      if (name === "overview")
        data = {
          ...report,
          activeCustomers: 83,
          trend,
          mix,
          frames: rank,
          lenses: rank,
          previous: null,
        };
      if (name === "historical") data = historical;
      if (name === "purchases")
        data = {
          ...report,
          total: 39,
          page: Number(url.searchParams.get("page") || 1),
          pageSize: Number(url.searchParams.get("pageSize") || 25),
          rows: [
            {
              id: "purchase-1",
              customerId: "customer-1",
              customerName: "UI Sample Customer",
              mobile: "9876543210",
              purchaseDate: "2026-10-01",
              frame: "Sample Frame",
              lens: "Sample Lens",
              pricingMode: "SPLIT",
              frameRate: "1000.00",
              lensRate: "1500.10",
              mrp: "2500.10",
            },
          ],
        };
      if (name === "comparison")
        data = {
          ...report,
          comparison: { period, summary },
          change: { value: "0.00", percent: 0, purchases: 0, average: "0.00" },
        };
      if (name === "frames" || name === "lenses")
        data = {
          ...report,
          kind: name,
          containing: 25,
          splitValue: "4000.00",
          totalOnly: 5,
          trend,
          visionCounts: { Progressive: 5, "Single Vision": 10, Bifocal: 3 },
          rankings:
            name === "frames"
              ? { brand: rank, model: rank, style: rank, frame: rank }
              : { company: rank, name: rank, vision: rank, coating: rank, lens: rank },
          options:
            name === "frames"
              ? { brand: ["Test Brand"], style: ["Test Style"] }
              : { company: ["Test Company"], vision: ["Progressive", "Single Vision", "Bifocal"] },
        };
      if (name === "customers")
        data = {
          ...report,
          registered: 83,
          active: 80,
          newRegistrations: 2,
          repeat: 3,
          gender: { registered: distribution, purchasing: distribution, purchases: distribution },
          ages: [{ name: "Unknown", count: 83, share: 100 }],
          missingAge: 83,
          ageCoverage: 0,
          frequency: [{ name: "1", count: 2, share: 100 }],
          registrations: [{ label: "2026-10", count: 2 }],
          activity: [{ label: "2026-10", customers: 2, repeat: 1, purchases: 3 }],
        };
      if (name === "mix")
        data = {
          ...report,
          mix,
          combinations: [{ ...rank[0], frame: "Sample Frame", lens: "Sample Lens" }],
          trend: [{ label: "2026-10", frameOnly: 10, lensOnly: 5, both: 20, unclassified: 4 }],
        };
      if (name === "purchases.csv")
        return route.fulfill({
          contentType: "text/csv",
          body: '"Customer Name","MRP"\r\n"UI Sample Customer","2500.10"\r\n',
        });
      if (name === "purchases" && url.searchParams.get("search") === "NO_MATCH")
        data = {
          ...data,
          rows: [],
          total: 0,
          summary: {
            ...summary,
            purchases: 0,
            value: "0",
            customers: 0,
            average: "0",
            highest: "0",
            frames: 0,
            lenses: 0,
            frameOnly: 0,
            lensOnly: 0,
            both: 0,
            unclassified: 0,
          },
        };
      if (!data) throw new Error(`Unexpected test endpoint ${name}`);
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto(`${base}/analytics`);
    await page.getByRole("heading", { name: "OptiLens Intelligence" }).waitFor();
    await page
      .getByRole("heading", { name: "Recorded Purchase Value", exact: true })
      .waitFor()
      .catch(() => page.getByText("Recorded Purchase Value", { exact: true }).first().waitFor());
    assert.deepEqual(
      requests.map((row) => row.name),
      ["overview"],
    );
    fs.mkdirSync("artifacts/analytics", { recursive: true });
    await page.screenshot({ path: "artifacts/analytics/overview-desktop.png", fullPage: true });
    await page.getByRole("tab", { name: "Sales", exact: true }).click();
    await page.getByText("Analytics Explorer", { exact: true }).waitFor();
    await page.getByLabel("Compare with another year", { exact: true }).check();
    await page.getByRole("combobox", { name: "Comparison Year", exact: true }).waitFor();
    for (const label of ["Line Chart", "Pie Chart", "Bar Chart"]) {
      await page.getByRole("combobox", { name: "Chart Type", exact: true }).click();
      await page.getByRole("option", { name: label, exact: true }).click();
      assert.equal(
        await page.getByRole("combobox", { name: "Chart Type", exact: true }).innerText(),
        label,
      );
    }
    await page.getByRole("button", { name: "Yearly", exact: true }).click();
    await page.getByLabel("Compare with another year", { exact: true }).uncheck();
    await page.getByRole("combobox", { name: "Historical Date Range", exact: true }).click();
    await page.getByRole("option", { name: "Custom Range", exact: true }).click();
    await page.getByRole("combobox", { name: "From Year", exact: true }).click();
    await page.getByRole("option", { name: "2004", exact: true }).click();
    await page.getByRole("combobox", { name: "To Year", exact: true }).waitFor();
    await page.getByLabel("Compare with another year", { exact: true }).check();
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await page.getByRole("combobox", { name: "Select Year", exact: true }).click();
    await page.getByRole("option", { name: "2004", exact: true }).click();
    await page.getByText("Purchases in 2004", { exact: true }).waitFor();
    assert.equal(requests.filter((row) => row.name === "historical").length, 1);
    await page.locator(".recharts-bar-rectangle").first().hover();
    assert.match(await page.locator(".recharts-tooltip-wrapper").first().innerText(), /₹1,000\.00/);
    await page.screenshot({ path: "artifacts/analytics/explorer-desktop.png", fullPage: true });
    await page.locator(".recharts-bar-rectangle").first().click();
    await page.getByText("UI Sample Customer", { exact: true }).waitFor();
    assert.equal(
      requests.filter((row) => row.name === "purchases").at(-1).params.from,
      "2004-01-01",
    );
    await page.getByRole("tab", { name: "Daily Sales Report", exact: true }).click();
    await page.getByText("UI Sample Customer", { exact: true }).waitFor();
    await page.getByRole("combobox", { name: "Period", exact: true }).click();
    await page.getByRole("option", { name: "Specific Date", exact: true }).click();
    await page.getByLabel("Purchase Date", { exact: true }).fill("2004-01-02");
    await page.getByLabel("Search customer name or phone").fill("Sample");
    await page.waitForTimeout(400);
    await page.getByRole("combobox", { name: "Sort by", exact: true }).click();
    await page.getByRole("option", { name: "Purchase amount", exact: true }).click();
    await page.getByRole("button", { name: "Go to next page" }).click();
    await page.waitForTimeout(100);
    const daily = requests.filter((row) => row.name === "purchases").at(-1).params;
    assert.equal(daily.date, "2004-01-02");
    assert.equal(daily.search, "Sample");
    assert.equal(daily.sort, "amount");
    assert.equal(daily.page, "2");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export all matches" }).click();
    await download;
    await page.getByLabel("Search customer name or phone").fill("NO_MATCH");
    await page
      .getByText("No purchases match this date and search. Try another date or clear the search.", {
        exact: true,
      })
      .waitFor();
    await page.getByRole("tab", { name: "Period Comparison", exact: true }).click();
    await page.getByText("Purchase Value Difference", { exact: true }).waitFor();
    for (const section of ["Frames", "Lenses", "Customers", "Purchase Mix"]) {
      await page.getByRole("tab", { name: section, exact: true }).click();
      await page.waitForTimeout(150);
      assert.equal(await page.getByRole("alert").filter({ hasText: "Unable to" }).count(), 0);
    }
    await page.getByRole("tab", { name: "Frames", exact: true }).click();
    await page.getByRole("button", { name: "Sample saved product", exact: true }).first().click();
    await page.getByText("UI Sample Customer", { exact: true }).waitFor();
    assert.equal(
      requests.filter((row) => row.name === "purchases").at(-1).params.brand,
      "Sample saved product",
    );
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Reset Filters", exact: true }).click();
    failNextOverview = true;
    await page.getByRole("button", { name: "Refresh Reports", exact: true }).click();
    await page.getByText("Temporary analytics test error", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("heading", { name: "Recorded Purchase Value", exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      "Mobile layout must not overflow horizontally",
    );
    await page.screenshot({ path: "artifacts/analytics/overview-mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        browserUiVerified: true,
        checks: [
          "Overview-only initial fetch",
          "historical controls and three chart types",
          "historical year selection",
          "comparison control",
          "daily date/search/sort/pagination",
          "CSV download",
          "period comparison",
          "all six tabs",
          "mobile width",
          "no browser runtime errors",
        ],
      }),
    );
    await context.close();
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
