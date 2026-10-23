import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

export async function runBrowser(c) {
  const { base, out, prisma, admin, password, pin, customer, request, customerPayload } = c;
  const browser = spawn(
    process.env.RESPONSIVE_BROWSER ??
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--remote-debugging-port=9240",
      "--user-data-dir=" + path.join(out, "browser-profile"),
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let ws;
  const network = [],
    errors = [];
  try {
    let targets;
    for (let i = 0; i < 60; i++) {
      try {
        targets = await (await fetch("http://127.0.0.1:9240/json")).json();
        break;
      } catch {
        await delay(200);
      }
    }
    assert(targets, "Headless browser did not start");
    ws = new WebSocket(targets.find((x) => x.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", ({ data }) => {
      const m = JSON.parse(data);
      if (m.id) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (p) m.error ? p.reject(m.error) : p.resolve(m.result);
      }
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
      if (m.method === "Network.responseReceived" && m.params.response.url.includes("/api/"))
        network.push({ url: m.params.response.url, status: m.params.response.status });
      // Record method and endpoint only. Bodies can contain PIN/password/session secrets.
      if (m.method === "Network.requestWillBeSent" && m.params.request.url.includes("/api/"))
        network.push({ method: m.params.request.method, url: m.params.request.url });
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
        throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    await cdp("Page.enable");
    await cdp("Runtime.enable");
    await cdp("Network.enable");
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    async function wait(predicate, message) {
      for (let i = 0; i < 160; i++) {
        if (await evaluate(predicate)) return;
        await delay(125);
      }
      throw Error(message);
    }
    async function waitText(text) {
      await wait(
        "document.body.innerText.includes(" + JSON.stringify(text) + ")",
        "Missing text: " + text,
      );
    }
    async function go(route, text) {
      await cdp("Page.navigate", { url: base + route });
      await wait(
        `location.pathname === ${JSON.stringify(route)} && document.readyState === 'complete'`,
        "Navigation incomplete: " + route,
      );
      await waitText(text);
      await delay(150);
    }
    async function click(text, scope = "document") {
      await wait(
        `[...${scope}.querySelectorAll('button,[role=tab],a')].some(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled&&e.getClientRects().length)`,
        "Missing enabled button: " + text,
      );
      const ok = await evaluate(
        `(()=>{const e=[...${scope}.querySelectorAll('button,[role=tab],a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&!e.disabled);if(!e)return false;e.click();return true;})()`,
      );
      assert(ok, "Missing enabled button: " + text);
      await delay(150);
    }
    async function fill(label, value) {
      const ok = await evaluate(
        `(()=>{const e=[...document.querySelectorAll('input,textarea')].filter(e=>e.getClientRects().length).find(e=>document.querySelector('label[for="'+e.id+'"]')?.textContent.includes(${JSON.stringify(label)}));if(!e)return false;const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
      );
      assert(ok, "Missing input: " + label);
      await delay(80);
    }
    async function value(label) {
      return evaluate(
        `(()=>{const e=[...document.querySelectorAll('input,textarea')].filter(e=>e.getClientRects().length).find(e=>document.querySelector('label[for="'+e.id+'"]')?.textContent.includes(${JSON.stringify(label)}));return e?.value;})()`,
      );
    }
    async function select(label, option) {
      assert(
        await evaluate(
          `(()=>{const e=[...document.querySelectorAll('[role=combobox]')].find(e=>(e.getAttribute('aria-labelledby')??'').split(' ').some(id=>document.getElementById(id)?.textContent.includes(${JSON.stringify(label)})));if(!e)return false;e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;})()`,
        ),
        "Missing select: " + label,
      );
      await wait('document.querySelectorAll("[role=option]").length>0', "No select options");
      assert(
        await evaluate(
          `(()=>{const e=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(option)}));if(!e)return false;e.click();return true;})()`,
        ),
        "Missing option: " + option,
      );
      await delay(100);
    }
    async function shot(name) {
      const r = await cdp("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await fs.writeFile(path.join(out, name + ".png"), Buffer.from(r.data, "base64"));
    }
    async function check(name, endpoint, run) {
      const selected = process.argv.find((arg) => arg.startsWith("--ui="))?.slice(5);
      if (
        selected &&
        !selected.split("|").some((part) => name.includes(part)) &&
        !name.startsWith("UI login") &&
        !name.startsWith("browser runtime")
      )
        return;
      await c.check(name, endpoint, async () => {
        try {
          await run();
        } catch (error) {
          await shot("failure-" + c.results.length);
          await fs.writeFile(
            path.join(out, "failure-" + c.results.length + ".txt"),
            await evaluate("document.body.innerText"),
          );
          throw error;
        }
      });
    }
    let createdId;
    await check(
      "UI login with isolated account reaches authenticated dashboard",
      "POST /auth/login",
      async () => {
        await go("/login", "Sign In");
        await fill("Username", admin.username);
        await fill("Password", password);
        await click("Sign In");
        await wait('location.pathname === "/dashboard"', "Login did not reach dashboard");
        await waitText("Dashboard");
        assert.equal(await prisma.adminSession.count({ where: { adminId: admin.id } }), 2);
      },
    );
    await check(
      "UI customer wizard: frame-only create, duplicate-click protection and page reload persistence",
      "POST /customers",
      async () => {
        await go("/customers/new", "Customer Name");
        await fill("Customer Name", "Synthetic Browser Customer");
        await fill("Mobile Number", "9876543210");
        await fill("Age at recording", "0");
        await click("Continue");
        await waitText("SPH");
        await click("Continue");
        await waitText("Frame / Spectacle");
        await fill("Frame / Spectacle", "Synthetic Browser Frame");
        await fill("Frame MRP", "120.25");
        await click("Continue");
        await waitText("Save Customer");
        await evaluate(
          `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Save Customer');e.click();e.click();})()`,
        );
        await wait(
          "location.pathname.startsWith('/customers/') && location.pathname.split('/').length === 3 && location.pathname.split('/')[2].length === 36",
          "Customer save did not navigate",
        );
        createdId = (await evaluate("location.pathname")).split("/").pop();
        const row = await prisma.customer.findUniqueOrThrow({
          where: { id: createdId },
          include: { records: true, prescriptions: true },
        });
        assert.equal(row.name, "Synthetic Browser Customer");
        assert.equal(row.ageAtRecording, 0);
        assert.equal(row.records[0].mrp.toString(), "120.25");
        assert.equal(row.prescriptions.length, 0);
        assert.equal(
          await prisma.customer.count({ where: { name: "Synthetic Browser Customer" } }),
          1,
        );
        await go("/customers/" + createdId, "Synthetic Browser Customer");
        await waitText("Synthetic Browser Frame");
        await shot("customer-created");
      },
    );
    await check(
      "UI personal edit persists name, phone, age clearing and private notes after reload",
      "PATCH /customers/:id",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        await click("Personal Details");
        await fill("Customer Name", "Synthetic Browser Updated");
        await fill("Mobile Number", "9988776655");
        await fill("Age at recording", "");
        await fill("Reference", "Browser reference");
        await fill("Internal Notes", "Browser private note");
        await click("Save Personal Information");
        await waitText("Customer information saved successfully.");
        const row = await prisma.customer.findUniqueOrThrow({ where: { id: createdId } });
        assert.equal(row.name, "Synthetic Browser Updated");
        assert.equal(row.mobNumber, "9988776655");
        assert.equal(row.ageRecordedAt, null);
        assert.equal(row.notes, "Browser private note");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        await click("Personal Details");
        assert.equal(await value("Customer Name"), row.name);
        assert.equal(await value("Internal Notes"), row.notes);
      },
    );
    await check(
      "UI historical purchase edit persists amount/date and targets selected purchase",
      "PATCH /customers/:id/records/:recordId",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        await fill("Frame Rate", "155.75");
        await fill("Date of Purchase", "2021-06-15");
        await click("Save Selected Purchase");
        await waitText("Selected purchase saved successfully.");
        const row = await prisma.customerRecord.findFirstOrThrow({
          where: { customerId: createdId },
        });
        assert.equal(row.mrp.toString(), "155.75");
        assert.equal(row.purchaseDate.toISOString().slice(0, 10), "2021-06-15");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        assert.equal(await value("Frame Rate"), "155.75");
        assert.equal(await value("Date of Purchase"), "2021-06-15");
        await shot("purchase-edited");
      },
    );
    await check(
      "UI new lens purchase with partial prescription persists linked rows and refreshes history",
      "POST /customers/:id/records",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/customers/" + createdId, "New Purchase");
        await click("New Purchase");
        await waitText("Prescription option");
        await select("Prescription option", "Enter New Prescription");
        await fill("SPH", "0");
        await fill("Lens Type", "Synthetic Browser Lens");
        await fill("Lens Rate", "80.50");
        await click("Save Purchase Record");
        await wait('!document.querySelector("[role=dialog]")', "New purchase did not close");
        const row = await prisma.customerRecord.findFirstOrThrow({
          where: { customerId: createdId, lensType: "Synthetic Browser Lens" },
          include: { prescription: true },
        });
        assert.equal(row.mrp.toString(), "80.5");
        assert.equal(row.prescription.reDistSph.toString(), "0");
        assert.equal(row.prescription.customerId, createdId);
        await go("/customers/" + createdId, "Synthetic Browser Lens");
      },
    );
    await check(
      "UI combined split and MRP purchases persist prices and existing prescription links",
      "POST /customers/:id/records",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        for (const mode of ["SPLIT", "MRP_ONLY"]) {
          await go("/customers/" + createdId, "New Purchase");
          await click("New Purchase");
          await waitText("Save Purchase Record");
          await fill("Frame / Spectacle", "Synthetic Browser " + mode);
          await fill("Lens Type", "Synthetic Combined Lens " + mode);
          if (mode === "SPLIT") {
            await fill("Frame Rate", "10.10");
            await fill("Lens Rate", "20.20");
          } else {
            await click("Total MRP Only");
            await fill("Total MRP", "88.88");
            await select("Prescription option", "Link Existing Prescription");
            await select("Existing prescription", "Recorded");
          }
          await click("Save Purchase Record");
          await wait('!document.querySelector("[role=dialog]")', "Combined purchase did not close");
          const row = await prisma.customerRecord.findFirstOrThrow({
            where: { customerId: createdId, specsType: "Synthetic Browser " + mode },
          });
          assert.equal(row.mrp.toString(), mode === "SPLIT" ? "30.3" : "88.88");
          if (mode === "MRP_ONLY") {
            assert.equal(row.frameRate, null);
            assert.equal(row.lensRate, null);
            assert(row.prescriptionId);
          }
          await go("/customers/" + createdId, "Synthetic Browser " + mode);
        }
      },
    );
    await check(
      "UI selected prescription edit preserves unrelated prescription values after reload",
      "PATCH /customers/:id/prescriptions/:prescriptionId",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        assert(
          await evaluate(
            `(()=>{const e=[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.startsWith('Prescriptions'));if(!e)return false;e.click();return true;})()`,
          ),
        );
        await waitText("Save Selected Prescription");
        assert(
          await evaluate(
            `(()=>{const e=document.querySelector('input[aria-label="RE DIST AXIS"]');if(!e)return false;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'90');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`,
          ),
        );
        await click("Save Selected Prescription");
        await waitText("Selected prescription saved successfully.");
        const row = await prisma.prescription.findFirstOrThrow({
          where: { customerId: createdId },
        });
        assert.equal(row.reDistAxis, 90);
        assert.equal(row.reDistSph.toString(), "0");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        await evaluate(`document.querySelectorAll('[role=tab]')[1].click()`);
        await waitText("Save Selected Prescription");
        assert.equal(
          await evaluate(`document.querySelector('input[aria-label="RE DIST AXIS"]').value`),
          "90",
        );
      },
    );
    await check(
      "UI order create, delivery edit, status transition and removal persist",
      "/orders",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/orders", "Orders");
        await click("New Order");
        await waitText("Customer Name or Mobile Number");
        await fill("Customer Name or Mobile Number", "Synthetic Browser Updated");
        await waitText("9988776655");
        assert(
          await evaluate(
            `(()=>{const e=[...document.querySelectorAll('[role=dialog] [role=button]')].find(e=>e.textContent.includes('Synthetic Browser Updated'));if(!e)return false;e.click();return true;})()`,
          ),
        );
        await waitText("Synthetic Browser Frame");
        assert(
          await evaluate(
            `(()=>{const e=[...document.querySelectorAll('[role=dialog] button')].find(e=>e.textContent.includes('Synthetic Browser Frame'));if(!e)return false;e.click();return true;})()`,
          ),
        );
        await fill("Expected Delivery Date", "2026-10-30");
        await click("Create Order", 'document.querySelector("[role=dialog]")');
        await waitText("Save Delivery Details");
        const row = await prisma.order.findFirstOrThrow({ where: { customerId: createdId } });
        assert.equal(row.status, "PLACED");
        assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: row.id } }), 1);
        await go("/orders", "Search all orders");
        await fill("Search all orders", "Synthetic Browser Updated");
        await waitText("Manage Details");
        await click("Manage Details");
        await waitText("Save Delivery Details");
        await fill("Internal Notes", "Browser internal delivery note");
        await click("Save Delivery Details");
        await wait(
          `[...document.querySelectorAll('[role=dialog] button')].some(e=>e.textContent.trim()==='Save Delivery Details'&&!e.disabled)`,
          "Order details save pending",
        );
        await select("Next Status", "Processing");
        await click("Update Status");
        await waitText("Placed → Processing");
        assert.equal(
          (await prisma.order.findUniqueOrThrow({ where: { id: row.id } })).internalNotes,
          "Browser internal delivery note",
        );
        assert.equal(
          (await prisma.order.findUniqueOrThrow({ where: { id: row.id } })).status,
          "PROCESSING",
        );
        await go("/orders", "Search all orders");
        await fill("Search all orders", "Synthetic Browser Updated");
        await waitText("Remove Order");
        await click("Remove Order");
        await click("Remove Order", 'document.querySelector("[role=dialog]")');
        await wait('!document.querySelector("[role=dialog]")', "Order removal did not close");
        assert.equal(await prisma.order.count({ where: { id: row.id } }), 0);
        assert(await prisma.customerRecord.findUnique({ where: { id: row.purchaseRecordId } }));
      },
    );
    await check(
      "UI offline save displays a recoverable error and leaves persisted data intact",
      "PATCH /customers/:id",
      async () => {
        assert(createdId, "Customer wizard prerequisite");
        await go("/customers/" + createdId + "/edit", "Save Selected Purchase");
        await click("Personal Details");
        await fill("Customer Name", "Synthetic Offline Save");
        const before = await prisma.customer.findUniqueOrThrow({ where: { id: createdId } });
        await cdp("Network.emulateNetworkConditions", {
          offline: true,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
        });
        try {
          await click("Save Personal Information");
          await waitText("Failed to fetch");
          assert.equal(
            (await prisma.customer.findUniqueOrThrow({ where: { id: createdId } })).name,
            before.name,
          );
        } finally {
          await cdp("Network.emulateNetworkConditions", {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          });
        }
        await click("Save Personal Information");
        await waitText("Customer information saved successfully.");
        assert.equal(
          (await prisma.customer.findUniqueOrThrow({ where: { id: createdId } })).name,
          "Synthetic Offline Save",
        );
      },
    );
    await check(
      "UI catalog create/edit/search/delete persist across page reloads",
      "/catalog/frames",
      async () => {
        await go("/admin/catalog", "Add Product");
        await click("Add Product");
        await waitText("Frame Brand");
        await fill("Frame Brand", "Synthetic Browser");
        await fill("Frame Model", "Catalog");
        await click("Save Product");
        await wait('!document.querySelector("[role=dialog]")', "Catalog save did not finish");
        let row = await prisma.frameCatalog.findFirstOrThrow({
          where: { brand: "Synthetic Browser", model: "Catalog" },
        });
        await go("/admin/catalog", "Search Frames");
        await fill("Search Frames", "Synthetic Browser");
        await waitText("Catalog");
        await click("Edit");
        await fill("Frame Model", "Edited Catalog");
        await click("Save Product");
        await wait('!document.querySelector("[role=dialog]")', "Catalog update did not finish");
        row = await prisma.frameCatalog.findUniqueOrThrow({ where: { id: row.id } });
        assert.equal(row.model, "Edited Catalog");
        await go("/admin/catalog", "Search Frames");
        await fill("Search Frames", "Synthetic Browser");
        await waitText("Edited Catalog");
        await cdp("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
        const dialogHandler = ({ data }) => {
          const m = JSON.parse(data);
          if (m.method === "Page.javascriptDialogOpening")
            void cdp("Page.handleJavaScriptDialog", { accept: true });
        };
        ws.addEventListener("message", dialogHandler);
        await click("Delete");
        await wait(
          '!document.body.innerText.includes("Edited Catalog")',
          "Catalog deletion did not refresh",
        );
        ws.removeEventListener("message", dialogHandler);
        assert.equal(await prisma.frameCatalog.count({ where: { id: row.id } }), 0);
      },
    );
    await check(
      "UI trash restore and PIN-confirmed permanent delete persist across reloads",
      "/customers/:id/{restore,permanent}",
      async () => {
        const row = (
          await request(
            "/customers",
            "POST",
            customerPayload("Synthetic Browser Trash"),
            "admin",
            201,
          )
        ).data;
        await request("/customers/" + row.id, "DELETE");
        await go("/trash", "Search Trash");
        await fill("Search Trash", "Synthetic Browser Trash");
        await waitText("Restore Customer");
        await click("Restore Customer");
        await waitText("Customer restored successfully.");
        assert.equal(
          (await prisma.customer.findUniqueOrThrow({ where: { id: row.id } })).deletedAt,
          null,
        );
        await go("/customers/" + row.id, "Synthetic Browser Trash");
        await request("/customers/" + row.id, "DELETE");
        await go("/trash", "Search Trash");
        await fill("Search Trash", "Synthetic Browser Trash");
        await waitText("Permanently Delete");
        await click("Permanently Delete");
        await fill("Enter Administrator PIN", pin);
        await click("Permanently Delete", 'document.querySelector("[role=dialog]")');
        await waitText("Customer permanently deleted.");
        assert.equal(await prisma.customer.count({ where: { id: row.id } }), 0);
        await go("/trash", "Search Trash");
        await fill("Search Trash", "Synthetic Browser Trash");
        await waitText("No trashed records match");
        await shot("trash-after-permanent-delete");
      },
    );
    await check(
      "UI analytics values refresh after writes and match independent database sums",
      "GET /analytics/overview",
      async () => {
        const amount = async () => {
          const rows = await prisma.customerRecord.findMany({
            where: {
              deletionGroupId: null,
              deletedAt: null,
              customer: { shopId: customer.shopId, isActive: true, deletedAt: null },
            },
            select: { mrp: true },
          });
          const paise = rows.reduce((sum, row) => sum + Math.round(Number(row.mrp ?? 0) * 100), 0);
          return (
            "₹" +
            new Intl.NumberFormat("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(paise / 100)
          );
        };
        await go("/analytics", "Period");
        await select("Period", "All Time");
        await waitText(await amount());
        await request(
          "/customers",
          "POST",
          customerPayload("Synthetic Browser Analytics"),
          "admin",
          201,
        );
        await go("/analytics", "Period");
        await select("Period", "All Time");
        await waitText(await amount());
        await shot("analytics-persisted");
        const n = await prisma.customer.count({
          where: { shopId: customer.shopId, isActive: true, deletedAt: null },
        });
        await waitText("active customer profiles, all time");
        await wait(
          `[...document.querySelectorAll('p')].some(e=>e.textContent.includes('active customer profiles, all time')&&e.textContent.trim().startsWith(${JSON.stringify(String(n) + " ")}))`,
          "Analytics customer count did not refresh",
        );
      },
    );
    await check(
      "UI customer and individual purchase soft-delete/restore persist with owned prescriptions",
      "DELETE /customers/:id; DELETE /customers/:id/records/:id",
      async () => {
        for (const entireCustomer of [true, false]) {
          const name = "Synthetic Browser Soft " + (entireCustomer ? "Customer" : "Purchase");
          const row = (
            await request(
              "/customers",
              "POST",
              { ...customerPayload(name), prescription: { re_dist: { sph: 0 } } },
              "admin",
              201,
            )
          ).data;
          await go("/customers/" + row.id, "New Purchase");
          if (entireCustomer) await click("Delete Customer");
          else
            assert(
              await evaluate(
                `(()=>{const e=document.querySelector('button[aria-label="Delete Purchase"]');if(!e)return false;e.click();return true;})()`,
              ),
            );
          await waitText(entireCustomer ? "Delete Customer?" : "Delete Purchase?");
          await click(
            entireCustomer ? "Delete Customer" : "Delete Purchase",
            'document.querySelector("[role=dialog]")',
          );
          await wait('!document.querySelector("[role=dialog]")', "Soft delete pending");
          assert(
            (await prisma.customerRecord.findUniqueOrThrow({ where: { id: row.records[0].id } }))
              .deletedAt,
          );
          assert(
            (
              await prisma.prescription.findUniqueOrThrow({
                where: { id: row.prescriptions[0].id },
              })
            ).deletedAt,
          );
          assert.equal(
            Boolean((await prisma.customer.findUniqueOrThrow({ where: { id: row.id } })).deletedAt),
            entireCustomer,
          );
          await go("/trash", "Search Trash");
          await fill("Search Trash", name);
          await click(entireCustomer ? "Restore Customer" : "Restore Purchase");
          await waitText(
            entireCustomer ? "Customer restored successfully." : "Purchase restored successfully.",
          );
          assert.equal(
            (
              await prisma.prescription.findUniqueOrThrow({
                where: { id: row.prescriptions[0].id },
              })
            ).deletedAt,
            null,
          );
          await go("/customers/" + row.id, name);
          await waitText("Synthetic Frame");
        }
      },
    );
    await check(
      "UI lens catalog create, edit and delete preserve database state on reload",
      "/catalog/lenses",
      async () => {
        await go("/admin/catalog", "Search Frames");
        assert(
          await evaluate(
            `(()=>{const e=[...document.querySelectorAll('[role=tab]')].find(e=>e.textContent.startsWith('Lenses'));e.click();return true;})()`,
          ),
        );
        await click("Add Product");
        await fill("Lens Company", "Synthetic Browser Lens Company");
        await fill("Lens Name", "Synthetic Lens Catalog");
        await fill("Vision Type", "Single Vision");
        await click("Save Product");
        await wait('!document.querySelector("[role=dialog]")', "Lens save pending");
        const row = await prisma.lensCatalog.findFirstOrThrow({
          where: { company: "Synthetic Browser Lens Company" },
        });
        await click("Edit");
        await fill("Lens Name", "Synthetic Edited Lens");
        await click("Save Product");
        await wait('!document.querySelector("[role=dialog]")', "Lens edit pending");
        assert.equal(
          (await prisma.lensCatalog.findUniqueOrThrow({ where: { id: row.id } })).lensName,
          "Synthetic Edited Lens",
        );
        await go("/admin/catalog", "Search Frames");
        await evaluate(`document.querySelectorAll('[role=tab]')[1].click()`);
        await waitText("Synthetic Edited Lens");
        const handler = ({ data }) => {
          if (JSON.parse(data).method === "Page.javascriptDialogOpening")
            void cdp("Page.handleJavaScriptDialog", { accept: true });
        };
        ws.addEventListener("message", handler);
        await click("Delete");
        await wait(
          '!document.body.innerText.includes("Synthetic Edited Lens")',
          "Lens delete pending",
        );
        ws.removeEventListener("message", handler);
        assert.equal(await prisma.lensCatalog.count({ where: { id: row.id } }), 0);
      },
    );
    await check(
      "UI Settings profile and user creation/deactivation persist after reload",
      "/settings/me; /settings/users",
      async () => {
        await go("/settings", "Account details");
        await fill("Full name", "Synthetic Browser Administrator");
        await fill("Email address", "browser-admin@example.test");
        await fill("Current password to save details", password);
        await click("Save account details");
        await waitText("Account details saved.");
        assert.equal(
          (await prisma.admin.findUniqueOrThrow({ where: { id: admin.id } })).name,
          "Synthetic Browser Administrator",
        );
        await go("/settings", "Account details");
        assert.equal(await value("Full name"), "Synthetic Browser Administrator");
        const require = createRequire(path.join(c.root, "server/package.json"));
        const mailer = require("nodemailer");
        const original = mailer.createTransport;
        const saved = {
          SMTP_HOST: process.env.SMTP_HOST,
          SMTP_USER: process.env.SMTP_USER,
          SMTP_PASS: process.env.SMTP_PASS,
        };
        process.env.SMTP_HOST = "smtp.example.test";
        process.env.SMTP_USER = "sender@example.test";
        process.env.SMTP_PASS = "synthetic-test-password";
        mailer.createTransport = () => ({
          sendMail: async (message) => ({ accepted: message.to, rejected: [] }),
          close() {},
        });
        try {
          await click("User Management");
          await click("Create user");
          await fill("Full name", "Synthetic Browser Staff");
          await fill("Username", "audit-created-ui-" + Date.now());
          await fill("Email address", "browser-staff@example.test");
          await click("Save user");
          await wait('!document.querySelector("[role=dialog]")', "User creation pending");
          const row = await prisma.admin.findUniqueOrThrow({
            where: { email: "browser-staff@example.test" },
          });
          assert.equal(row.role, "USER");
          assert.equal(row.isActive, true);
          await go("/settings", "Account details");
          await click("User Management");
          await waitText("Synthetic Browser Staff");
          assert(
            await evaluate(
              `(()=>{const card=[...document.querySelectorAll('.MuiCard-root')].find(e=>e.textContent.includes('browser-staff@example.test'));const b=[...card.querySelectorAll('button')].find(e=>e.textContent==='Edit');b.click();return true;})()`,
            ),
          );
          await waitText("Edit user");
          await evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click()`);
          await click("Save user");
          await wait('!document.querySelector("[role=dialog]")', "User deactivation pending");
          assert.equal(
            (await prisma.admin.findUniqueOrThrow({ where: { id: row.id } })).isActive,
            false,
          );
        } finally {
          mailer.createTransport = original;
          Object.assign(process.env, saved);
        }
      },
    );
    await check(
      "UI session expiry during edit produces no false success or database write",
      "PATCH /customers/:id",
      async () => {
        await go("/customers/" + customer.id + "/edit", "Save Selected Purchase");
        await click("Personal Details");
        await fill("Customer Name", "Synthetic Expired Save");
        const before = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
        await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });
        await click("Save Personal Information");
        await wait('location.pathname === "/login"', "Expired write did not return to login");
        assert.equal(
          (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).name,
          before.name,
        );
      },
    );
    await check(
      "browser runtime has no uncaught exceptions",
      "all exercised UI pages",
      async () => {
        assert.deepEqual(errors, []);
      },
    );
    await fs.writeFile(
      path.join(out, "browser-network.json"),
      JSON.stringify({ network, errors }, null, 2),
    );
  } finally {
    ws?.close();
    browser.kill();
  }
}
