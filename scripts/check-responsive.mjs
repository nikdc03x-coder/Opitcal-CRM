// Isolated UI checks: synthetic fixtures, no CRM backend or database connection.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "artifacts/responsive");
await fs.mkdir(out, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/api")) {
      res.writeHead(503);
      res.end("No backend available in UI harness");
      return;
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    let filename = path.resolve(root, "client/dist", relative);
    if (!filename.startsWith(path.join(root, "client/dist"))) throw new Error("Invalid path");
    let bytes;
    try {
      bytes = await fs.readFile(filename);
    } catch {
      filename = "index.html";
      bytes = await fs.readFile(path.join(root, "client/dist/index.html"));
    }
    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    res.setHeader("Content-Type", mime[path.extname(filename)] || "application/octet-stream");
    res.end(bytes);
  } catch {
    res.writeHead(500);
    res.end();
  }
});
await new Promise((resolve) => server.listen(5178, "127.0.0.1", resolve));
const browserPath =
  process.env.RESPONSIVE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--remote-debugging-port=9238",
    `--user-data-dir=${path.join(out, "browser-profile")}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let targets;
  for (let n = 0; n < 60; n++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9238/json")).json();
      break;
    } catch {
      await delay(200);
    }
  }
  assert(targets, "Browser debugging endpoint did not start");
  ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      if (entry) msg.error ? entry.reject(msg.error) : entry.resolve(msg.result);
    }
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text,
      );
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `(${installFixtures.toString()})();`,
  });
  const results = [];
  async function check(name, screenshot = false) {
    await delay(160);
    const state = await evaluate(
      `(() => ({ width: document.documentElement.clientWidth, screenWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.title, text: document.body.innerText.slice(0,100), tables: [...document.querySelectorAll('.MuiTableContainer-root')].map(e => ({width:e.clientWidth,scroll:e.scrollWidth})), overflow: [...document.querySelectorAll('main *')].filter(e => { const r=e.getBoundingClientRect(); return r.width && r.right>document.documentElement.clientWidth+2 && !e.closest('.MuiTableContainer-root, .MuiTabs-scroller'); }).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70),right:e.getBoundingClientRect().right})) }))()`,
    );
    results.push({ name, ...state });
    await fs.writeFile(
      path.join(out, "results.json"),
      JSON.stringify({ results, errors }, null, 2),
    );
    if (screenshot) {
      const shot = await cdp("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await fs.writeFile(path.join(out, `${name}.png`), Buffer.from(shot.data, "base64"));
    }
    console.log(`${name}: ${state.width}/${state.scrollWidth}`);
  }
  async function go(route) {
    await cdp("Page.navigate", { url: `http://127.0.0.1:5178${route}` });
    for (let retry = 0; retry < 50; retry++) {
      await delay(100);
      if (
        await evaluate(
          `location.pathname===${JSON.stringify(route.split("?")[0])} && Boolean(document.querySelector('main, form')) && !document.querySelector('[role="progressbar"]')`,
        )
      )
        break;
    }
    await delay(200);
    await evaluate(`document.fonts.ready`);
    assert(await evaluate(`Boolean(document.querySelector('main, form'))`), `No page at ${route}`);
  }
  async function click(text, selector = "button") {
    const found = await evaluate(
      `(() => {const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label')===${JSON.stringify(text)}); if(!el)return false; el.click(); return true;})()`,
    );
    assert(found, `Control missing: ${text}`);
    await delay(180);
  }
  async function input(label, value) {
    await evaluate(
      `(() => {const el=[...document.querySelectorAll('input')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(label)} || document.querySelector('label[for="'+e.id+'"]')?.textContent.includes(${JSON.stringify(label)})); if(!el)throw Error('Input missing: '+${JSON.stringify(label)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
    );
    await delay(100);
  }
  for (const width of process.env.RESPONSIVE_WIDTHS?.split(",").map(Number) || [
    320, 375, 425, 768, 1024, 1280, 1920,
  ]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp("Emulation.setTouchEmulationEnabled", { enabled: width < 900 });
    for (const [name, route] of Object.entries({
      dashboard: "/dashboard",
      customers: "/customers",
      add: "/customers/new",
      detail: "/customers/customer-1",
      edit: "/customers/customer-1/edit",
      catalog: "/admin/catalog",
      orders: "/orders",
      trash: "/trash",
      analytics: "/analytics",
      login: "/login",
      notfound: "/missing-page",
    })) {
      await go(route);
      await check(`${width}-${name}`, [320, 768, 1920].includes(width));
      if (name === "customers") {
        await input("Customer Name or Mobile Number", "Alexandra");
        await delay(450);
        assert(
          await evaluate(`new URLSearchParams(location.search).get('search')==='Alexandra'`),
          "Customer search was not preserved in URL",
        );
        await check(`${width}-customer-search`);
      }
      if (name === "add") {
        await click("Continue");
        assert(
          await evaluate(`Boolean(document.querySelector('.Mui-error'))`),
          "Registration validation did not display",
        );
        await input("Customer Name", "Responsive Test Customer");
        await click("Continue");
        await check(`${width}-prescription`, width === 320);
        await click("Continue");
        await check(`${width}-pricing`, width === 320);
        await evaluate(`document.querySelector('main .MuiAutocomplete-popupIndicator').click()`);
        await check(`${width}-catalog-dropdown`, width === 320);
        assert(
          await evaluate(
            `(() => {const r=document.querySelector('.MuiAutocomplete-popper').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})()`,
          ),
          "Catalog dropdown outside viewport",
        );
        await evaluate(`document.querySelector('[role="option"]').click()`);
        await input("Frame MRP", "1500");
        await click("Continue");
        await check(`${width}-review`, width === 320);
      }
      if (name === "detail") {
        await click("Prepare Receipt & WhatsApp PDF");
        await check(`${width}-receipt-dialog`, width === 320);
        await click("Cancel");
        for (const index of [1, 2, 3, 4, 0]) {
          await evaluate(
            `document.querySelectorAll('[aria-label="Customer detail views"] [role="tab"]')[${index}].click()`,
          );
          await check(`${width}-detail-tab-${index}`, width === 320 && index === 1);
        }
        await click("New Purchase");
        await check(`${width}-purchase-dialog`, width === 320);
        await evaluate(
          `document.querySelector('[role="dialog"] [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))`,
        );
        await click("Enter New Prescription", '[role="option"]');
        await check(`${width}-purchase-prescription`, width === 320);
        await input("Right Eye · Distance (OD) AXIS", "181");
        await click("Save Purchase Record");
        assert(
          await evaluate(
            `document.querySelector('.MuiDialog-paper').textContent.includes('AXIS must be between')`,
          ),
          "Optical validation not visible",
        );
      }
      if (name === "edit") {
        for (const index of [1, 2]) {
          await evaluate(
            `document.querySelectorAll('[aria-label="Customer edit sections"] [role="tab"]')[${index}].click()`,
          );
          await check(`${width}-edit-tab-${index}`, width === 320);
        }
      }
      if (name === "catalog") {
        await click("Add Frame");
        await check(`${width}-catalog-dialog`, width === 320);
        await click("Cancel");
        await click("Lenses (1)", '[role="tab"]');
        await check(`${width}-lens-catalog`);
        await click("Add Lens");
        await check(`${width}-lens-dialog`, width === 320);
      }
      if (name === "orders") {
        await click("Manage Details");
        await check(`${width}-order-details`, width === 320);
        await click("Close");
        await click("Remove Order");
        await check(`${width}-order-confirmation`, width === 320);
        await click("Keep Order");
        await click("New Order");
        await check(`${width}-order-dialog`, width === 320);
      }
      if (name === "trash") {
        await click("Permanently Delete");
        await check(`${width}-delete-confirmation`, width === 320);
        assert(
          await evaluate(`document.querySelector('button[type=submit]').disabled`),
          "PIN gate disabled state missing",
        );
      }
      if (name === "analytics") {
        await evaluate(
          `document.querySelector('.recharts-wrapper')?.scrollIntoView({block:'center'})`,
        );
        await check(`${width}-analytics-chart`, [320, 768, 1920].includes(width));
        for (const section of ["sales", "frames", "lenses", "customers", "mix"]) {
          await evaluate(`document.getElementById('report-tab-${section}').click()`);
          await check(`${width}-analytics-${section}`, width === 320);
          if (section === "sales") {
            await click("Transactions");
            await check(`${width}-transactions`);
            await click("Compare periods");
            await check(`${width}-comparison`);
          }
          if (section === "customers") {
            await click("Buying behavior", '[role="tab"]');
            await check(`${width}-customer-behavior`);
          }
        }
      }
    }
    await go("/customers");
    if (width < 900) {
      await click("Open navigation");
      await check(`${width}-navigation`, width === 320);
      await cdp("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
      });
      await delay(350);
      assert(
        await evaluate(
          `document.querySelector('[aria-label="Open navigation"]').getAttribute('aria-expanded')==='false'`,
        ),
      );
      await click("Open navigation");
      await evaluate(`document.querySelector('.MuiBackdrop-root').click()`);
      await delay(350);
      assert(
        await evaluate(
          `document.querySelector('[aria-label="Open navigation"]').getAttribute('aria-expanded')==='false'`,
        ),
      );
      await click("Open navigation");
      await click("Dashboard", ".MuiDrawer-paper a");
      assert(await evaluate(`location.pathname==='/dashboard'`));
    } else {
      const label = await evaluate(
        `document.querySelector('header button').getAttribute('aria-label')`,
      );
      await click(label);
      await check(`${width}-navigation-toggled`, width === 1920);
      await click(label === "Collapse navigation" ? "Expand navigation" : "Collapse navigation");
    }
  }
  // A 1280px desktop at 200% browser zoom has a 640 CSS pixel layout viewport.
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 450,
    deviceScaleFactor: 2,
    mobile: false,
  });
  for (const route of ["/customers/new", "/customers/customer-1", "/analytics"]) {
    await go(route);
    await check(`zoom200-${route.split("/").pop()}`, true);
  }
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 450,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await go("/customers/customer-1");
  await click("New Purchase");
  await check("320-short-purchase-dialog", true);
  assert(
    await evaluate(
      `(() => { const actions=document.querySelector('.MuiDialogActions-root').getBoundingClientRect(); return actions.top>=0 && actions.bottom<=innerHeight; })()`,
    ),
    "Purchase actions outside reduced-height viewport",
  );
  await fs.writeFile(path.join(out, "results.json"), JSON.stringify({ results, errors }, null, 2));
  assert.equal(errors.length, 0, errors.join("\n"));
  const overflowing = results.filter((r) => r.scrollWidth > r.width + 1);
  assert.equal(
    overflowing.length,
    0,
    `Page overflow: ${overflowing.map((r) => r.name).join(", ")}`,
  );
  const clipped = results.filter((r) => r.overflow.length);
  assert.equal(
    clipped.length,
    0,
    `Content outside viewport: ${clipped.map((r) => r.name).join(", ")}`,
  );
  console.log(`PASS: ${results.length} responsive states; no page overflow or runtime exceptions.`);
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  browser.kill();
  server.close();
}

function installFixtures() {
  const date = "2026-10-20T10:00:00.000Z";
  const frameName = "Responsive Collection Lightweight Titanium Rectangular Frame";
  const lensName = "Progressive Precision Anti Reflection Prescription Lens";
  const rx = { id: "rx-1", createdAt: date };
  for (const eye of ["reDist", "reNear", "leDist", "leNear"])
    Object.assign(rx, { [eye + "Sph"]: "-1.25", [eye + "Cyl"]: "-0.50", [eye + "Axis"]: 90 });
  const record = {
    id: "record-1",
    prescriptionId: "rx-1",
    specsType: frameName,
    lensType: lensName,
    frameCatalogId: "frame-1",
    lensCatalogId: "lens-1",
    pricingMode: "SPLIT",
    frameRate: "1500",
    lensRate: "2500",
    mrp: "4000",
    purchaseDate: date,
    createdAt: date,
  };
  const customer = {
    id: "customer-1",
    name: "Alexandra Verylongcustomername Responsive Example",
    mobNumber: "9876543210",
    gender: "Female",
    ageAtRecording: 35,
    ageRecordedAt: date,
    reference: "Walk in",
    notes: "Synthetic UI test notes",
    createdAt: date,
    updatedAt: date,
    prescriptions: [rx],
    records: [record],
  };
  const frame = {
    id: "frame-1",
    shopId: "test",
    brand: "Responsive Collection",
    model: "Lightweight Titanium Rectangular Frame",
    frameCode: "FRAME-LONG-123",
    frameStyle: "Rectangle",
    description: frameName,
    isActive: true,
    createdAt: date,
    updatedAt: date,
  };
  const lens = {
    id: "lens-1",
    shopId: "test",
    company: "Precision",
    lensName,
    visionType: "Progressive",
    coating: "Anti Reflection",
    lensCode: "LENS-123",
    description: lensName,
    isActive: true,
    createdAt: date,
    updatedAt: date,
  };
  const order = {
    id: "order-1",
    orderNumber: "ORD-2026-001",
    customerId: customer.id,
    purchaseRecordId: record.id,
    status: "READY",
    expectedDeliveryDate: date,
    deliveredAt: null,
    cancelledAt: null,
    internalNotes: "Synthetic order",
    createdAt: date,
    updatedAt: date,
    customer,
    purchase: record,
    history: [
      {
        id: "history-1",
        orderId: "order-1",
        fromStatus: "PLACED",
        toStatus: "READY",
        note: "Ready for collection",
        createdAt: date,
      },
    ],
  };
  const summary = {
    purchases: 12,
    value: "48000",
    customers: 8,
    average: "4000",
    highest: "7000",
    frames: 10,
    lenses: 11,
    frameOnly: 1,
    lensOnly: 2,
    both: 9,
    unclassified: 0,
    undated: 0,
  };
  const period = { from: "2026-01-01", to: "2026-12-31", label: "2026" };
  const trend = Array.from({ length: 6 }, (_, i) => ({
    label: `Month ${i + 1}`,
    value: String((i + 1) * 1000),
    purchases: i + 1,
    customers: i + 1,
    from: `2026-0${i + 1}-01`,
    to: `2026-0${i + 1}-28`,
  }));
  const ranks = [
    { name: frameName, purchases: 8, share: 66.7 },
    { name: "Other", purchases: 4, share: 33.3 },
  ];
  const mix = [
    { name: "Frame + Lens", purchases: 9, share: 75 },
    { name: "Frame Only", purchases: 1, share: 8.3 },
    { name: "Lens Only", purchases: 2, share: 16.7 },
  ];
  const base = { period, summary, calculatedAt: date };
  const change = { value: "1000", percent: 10, purchases: 1, average: "100" };
  const dist = [
    { name: "Female", count: 5, share: 62.5 },
    { name: "Male", count: 3, share: 37.5 },
  ];
  const reports = {
    overview: {
      ...base,
      activeCustomers: 8,
      trend,
      mix,
      frames: ranks,
      lenses: ranks,
      previous: { period, summary, change },
    },
    historical: {
      today: "2026-10-22",
      currentYear: 2026,
      totalCustomers: 8,
      years: [2024, 2025, 2026].map((year) => ({
        year,
        purchases: 12,
        value: "48000",
        elapsedValue: "40000",
        yearOnYear: 10,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          purchases: 1,
          value: "4000",
        })),
        categories: mix.map((r) => ({ name: r.name, value: "16000" })),
      })),
      recent: [
        {
          id: record.id,
          customerId: customer.id,
          customerName: customer.name,
          frame: frameName,
          lens: lensName,
          value: "4000",
          purchaseDate: date,
        },
      ],
    },
    purchases: {
      ...base,
      rows: [
        {
          id: record.id,
          customerId: customer.id,
          customerName: customer.name,
          mobile: customer.mobNumber,
          purchaseDate: date,
          frame: frameName,
          lens: lensName,
          pricingMode: "SPLIT",
          frameRate: "1500",
          lensRate: "2500",
          mrp: "4000",
        },
      ],
      page: 1,
      pageSize: 25,
      total: 51,
    },
    comparison: { ...base, comparison: { period, summary }, change },
    customers: {
      ...base,
      registered: 8,
      active: 8,
      newRegistrations: 4,
      repeat: 3,
      gender: { registered: dist, purchasing: dist, purchases: dist },
      ages: [{ name: "30-39", count: 8, share: 100 }],
      missingAge: 0,
      ageCoverage: 100,
      frequency: [{ name: "1", count: 8, share: 100 }],
      registrations: [{ label: "Oct", count: 4 }],
      activity: [{ label: "Oct", customers: 8, repeat: 3, purchases: 12 }],
    },
    mix: {
      ...base,
      mix,
      combinations: ranks,
      trend: trend.map((r) => ({
        label: r.label,
        frameOnly: 1,
        lensOnly: 2,
        both: 9,
        unclassified: 0,
      })),
    },
  };
  for (const kind of ["frames", "lenses"])
    reports[kind] = {
      ...base,
      kind,
      containing: 10,
      splitValue: "20000",
      totalOnly: 0,
      trend,
      rankings: {
        brand: ranks,
        style: ranks,
        model: ranks,
        company: ranks,
        vision: ranks,
        lensName: ranks,
        coating: ranks,
      },
      options: {},
      visionCounts: { Progressive: 10 },
    };
  window.__fixtureWrites = [];
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const p = url.pathname;
    let data;
    if ((options.method || "GET") !== "GET") {
      window.__fixtureWrites.push({ path: p, method: options.method });
      return new Response(
        JSON.stringify({ success: false, message: "UI harness: writes blocked" }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      );
    }
    if (p === "/api/auth/me")
      return new Response(
        JSON.stringify({
          success: true,
          admin: { id: "test", username: "UI test", shopId: "test" },
        }),
      );
    if (p === "/api/customers") data = [customer];
    else if (p === "/api/customers/trash")
      data = {
        customers: [{ ...customer, _count: { records: 1, prescriptions: 1 } }],
        purchases: [{ ...record, customerId: customer.id, customer }],
      };
    else if (p === "/api/customers/customer-1") data = customer;
    else if (p === "/api/catalog/frames") data = [frame];
    else if (p === "/api/catalog/lenses") data = [lens];
    else if (p === "/api/orders/summary")
      data = {
        placed: 1,
        processing: 2,
        ready: 1,
        delivered: 3,
        cancelled: 0,
        overdue: 1,
        active: 4,
      };
    else if (p === "/api/orders/eligible-purchases") data = { id: customer.id, records: [record] };
    else if (p === "/api/orders/order-1") data = order;
    else if (p === "/api/orders")
      data = { orders: [order], total: 21, page: 1, pageSize: 20, totalPages: 2 };
    else if (p.startsWith("/api/analytics/")) data = reports[p.split("/").pop()];
    if (data === undefined) throw new Error(`Unmocked request: ${url}`);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json" },
    });
  };
}
