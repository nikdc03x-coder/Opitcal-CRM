// Built-client smoke checks with synthetic API responses; no live credentials.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "artifacts/settings");
await fs.mkdir(out, { recursive: true });
const account = {
  id: 1,
  username: "admin",
  name: "Store Administrator",
  email: "admin@example.test",
  role: "ADMIN",
  isActive: true,
  createdAt: "2026-10-01T00:00:00Z",
};
let signedIn = false;
let sessionFailure = false;
let recoveryFailure = "";
let invalidReset = false;
let consumedReset = false;
let profileFailure = false;
let profile = { ...account };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/auth/forgot-password") {
      if (recoveryFailure === "network") {
        res.destroy();
        return;
      }
      if (recoveryFailure === "configuration") {
        res.writeHead(503);
        res.end(
          JSON.stringify({
            success: false,
            message: "Password reset email is unavailable. Contact your administrator.",
          }),
        );
        return;
      }
    }
    if (url.pathname.startsWith("/api/auth/reset-password")) {
      if (invalidReset || consumedReset) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            success: false,
            message: "This reset link is invalid or expired. Request a new link.",
          }),
        );
        return;
      }
      if (url.pathname === "/api/auth/reset-password") consumedReset = true;
    }
    if (url.pathname === "/api/auth/login") signedIn = true;
    if (url.pathname === "/api/auth/logout") signedIn = false;
    if (url.pathname === "/api/auth/me") {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (sessionFailure || !signedIn) {
        res.writeHead(sessionFailure ? 503 : 401);
        res.end(
          JSON.stringify({
            success: false,
            message: sessionFailure ? "Database unavailable." : "Not logged in.",
          }),
        );
        return;
      }
    }
    const role = req.headers.cookie?.includes("test-role=USER") ? "USER" : "ADMIN";
    const own = { ...profile, role };
    if (url.pathname === "/api/settings/me" && req.method === "PATCH") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw);
      if (profileFailure || input.currentPassword !== "fixture-password") {
        res.writeHead(profileFailure ? 503 : 403);
        res.end(
          JSON.stringify({
            success: false,
            message: profileFailure
              ? "The database transaction could not finish. Please try again."
              : "Current password is incorrect.",
          }),
        );
        return;
      }
      profile = { ...profile, name: input.name, email: input.email };
      res.end(
        JSON.stringify({
          success: true,
          account: { ...profile, role },
          message: "Account details saved.",
        }),
      );
      return;
    }
    const body =
      url.pathname === "/api/auth/me"
        ? { admin: own }
        : url.pathname === "/api/settings/me"
          ? { account: own }
          : url.pathname === "/api/orders/summary"
            ? {
                data: {
                  placed: 0,
                  processing: 0,
                  ready: 0,
                  delivered: 0,
                  cancelled: 0,
                  overdue: 0,
                  active: 0,
                },
              }
            : url.pathname === "/api/settings/users" && req.method === "GET"
              ? {
                  users: [
                    account,
                    { ...account, id: 2, username: "staff", name: "Store User", role: "USER" },
                  ],
                }
              : { message: "Request completed successfully." };
    res.end(JSON.stringify({ success: true, ...body }));
    return;
  }
  const base = path.join(root, "client/dist");
  let filename = path.resolve(base, `.${url.pathname}`);
  if (!filename.startsWith(`${base}${path.sep}`)) filename = path.join(base, "index.html");
  let bytes;
  try {
    bytes = await fs.readFile(filename);
  } catch {
    filename = path.join(base, "index.html");
    bytes = await fs.readFile(filename);
  }
  res.setHeader(
    "Content-Type",
    { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml" }[
      path.extname(filename)
    ] || "application/octet-stream",
  );
  res.end(bytes);
});
await new Promise((resolve) => server.listen(5179, "127.0.0.1", resolve));
const browser = spawn(
  process.env.RESPONSIVE_BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--remote-debugging-port=9239",
    `--user-data-dir=${path.join(out, "browser-profile")}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9239/json")).json();
      break;
    } catch {
      await delay(200);
    }
  }
  assert(targets, "Browser did not start");
  ws = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (item) message.error ? item.reject(message.error) : item.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(message.params.exceptionDetails.text);
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  async function go(route, text) {
    // Opening an email link creates a document navigation, even when testing the
    // same fragment URL repeatedly after the app has removed its token fragment.
    if (route.startsWith("/reset-password#")) await cdp("Page.navigate", { url: "about:blank" });
    await cdp("Page.navigate", { url: `http://127.0.0.1:5179${route}` });
    let found = false;
    for (let i = 0; i < 60; i++) {
      await delay(100);
      found = await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`);
      if (found) break;
    }
    assert(found, `Missing page content: ${text}`);
    await delay(250);
  }
  async function click(text) {
    assert(
      await evaluate(
        `(() => { const button=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!button)return false;button.click();return true;})()`,
      ),
      `Missing control: ${text}`,
    );
    await delay(250);
  }
  async function check(name) {
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      `Horizontal overflow: ${name}`,
    );
    const shot = await cdp("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await fs.writeFile(path.join(out, `${name}.png`), Buffer.from(shot.data, "base64"));
  }
  async function waitPath(pathname) {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`location.pathname === ${JSON.stringify(pathname)}`)) return;
      await delay(100);
    }
    assert.fail(`Expected redirect to ${pathname}`);
  }
  async function submitLogin() {
    for (const [label, value] of [
      ["Username", "fixture-user"],
      ["Password", "fixture-password"],
    ]) {
      await evaluate(
        `(() => { const input=[...document.querySelectorAll('input')].find(e=>document.querySelector('label[for="'+e.id+'"]')?.textContent.includes(${JSON.stringify(label)})); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
      );
      await delay(80);
    }
    await click("Sign In");
  }
  async function fill(label, value) {
    await evaluate(
      `(() => { const input=[...document.querySelectorAll('input')].find(e=>document.querySelector('label[for="'+e.id+'"]')?.textContent.includes(${JSON.stringify(label)})); if(!input)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true})); })()`,
    );
    await delay(80);
  }
  async function waitText(text) {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`)) return;
      await delay(100);
    }
    assert.fail(`Missing recovery feedback: ${text}`);
  }
  await go("/forgot-password", "Email address");
  await fill("Email address", "user@example.test");
  recoveryFailure = "network";
  await click("Send reset link");
  await waitText("Cannot connect to the CRM server");
  assert(
    await evaluate("!document.querySelector('button[type=submit]').disabled"),
    "Failed recovery cannot be retried",
  );
  recoveryFailure = "configuration";
  await click("Send reset link");
  await waitText("Password reset email is unavailable");
  recoveryFailure = "";
  await click("Send reset link");
  await waitText("Request completed successfully");
  const recoveryRoute = `/reset-password#${"a".repeat(64)}`;
  await go(recoveryRoute, "Confirm new password");
  await fill("New password", "fixture-new-password");
  await fill("Confirm new password", "fixture-new-password");
  await click("Reset password");
  await waitText("Request completed successfully");
  await go(recoveryRoute, "This reset link is invalid or expired");
  consumedReset = false;
  invalidReset = true;
  await go(recoveryRoute, "This reset link is invalid or expired");
  invalidReset = false;
  console.log(
    "PASS: recovery submission, network failure and retry, SMTP configuration feedback, new password submission, consumed and expired links.",
  );
  await go("/", "Forgot Password?");
  await waitPath("/login");
  assert(await evaluate("!document.querySelector('main')"), "Private layout flashed for a guest");
  for (const route of [
    "/settings",
    "/customers",
    "/orders",
    "/analytics",
    "/trash",
    "/admin/catalog",
  ]) {
    await go(`${route}?test=destination#section`, "Forgot Password?");
    await waitPath("/login");
    assert.equal(await evaluate("history.state.usr.from"), `${route}?test=destination#section`);
  }
  await go("/settings?test=destination#section", "Forgot Password?");
  await submitLogin();
  await waitPath("/settings");
  assert.equal(await evaluate("location.search + location.hash"), "?test=destination#section");
  await go("/", "Sign out");
  await waitPath("/dashboard");
  await go("/login", "Sign out");
  await waitPath("/dashboard");
  assert(
    await evaluate("!document.querySelector('input[autocomplete=username]')"),
    "Authenticated login form flashed",
  );
  await click("Sign out");
  await waitPath("/login");
  await go("/login", "Forgot Password?");
  await submitLogin();
  await waitPath("/dashboard");
  signedIn = false;
  await evaluate(`window.dispatchEvent(new Event('crm:session-expired'))`);
  await waitPath("/login");
  sessionFailure = true;
  await go("/", "Unable to verify your Admin session");
  assert.equal(await evaluate("location.pathname"), "/");
  sessionFailure = false;
  await click("Try Again");
  await waitPath("/login");
  console.log(
    "PASS: guest/authenticated root, login destination, authenticated login, logout, session expiry, protected routes and retryable session checks.",
  );
  signedIn = true;
  await go("/settings", "Account details");
  await fill("Full name", "Updated Administrator");
  await fill("Current password to save details", "wrong-password");
  await click("Save account details");
  await waitText("Current password is incorrect.");
  await fill("Current password to save details", "fixture-password");
  profileFailure = true;
  await click("Save account details");
  await waitText("The database transaction could not finish");
  profileFailure = false;
  await click("Save account details");
  await waitText("Account details saved.");
  assert.equal(
    await evaluate("document.querySelector('input[autocomplete=current-password]').value"),
    "",
  );
  await go("/settings", "Account details");
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('input')].find(e=>document.querySelector('label[for=\"'+e.id+'\"]')?.textContent.includes('Full name')).value",
    ),
    "Updated Administrator",
  );
  console.log(
    "PASS: Settings profile password validation, transaction error recovery, successful save, cleared password and persisted reload.",
  );
  for (const width of [375, 1280]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    signedIn = false;
    await go("/login", "Forgot Password?");
    await check(`${width}-login`);
    await go("/forgot-password", "Email address");
    await check(`${width}-forgot`);
    await go(`/reset-password#${"a".repeat(64)}`, "Confirm new password");
    assert(await evaluate("location.hash === ''"), "Reset secret remains in browser history");
    await check(`${width}-reset`);
    signedIn = true;
    await go("/settings", "Account details");
    await check(`${width}-account`);
    await click("User Management");
    await check(`${width}-users`);
    await click("Create user");
    await check(`${width}-create`);
    await click("Cancel");
    await evaluate("document.cookie='test-role=USER; path=/'");
    await go("/settings", "Account details");
    assert(
      await evaluate(
        "![...document.querySelectorAll('[role=tab]')].some(e=>e.textContent==='User Management')",
      ),
      "Non-admin sees management tab",
    );
    await evaluate("document.cookie='test-role=ADMIN; path=/'");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login/recovery, reset-secret removal, Settings, user dialog, role visibility and responsive layouts at 375px/1280px.",
  );
} finally {
  ws?.close();
  browser.kill();
  await new Promise((resolve) => server.close(resolve));
}
