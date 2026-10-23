import assert from "node:assert/strict";
import test from "node:test";
import {
  customerDetailsUrl,
  getPurchaseFlag,
  measurementDifference,
  sortPrescriptions,
  sortPurchases,
} from "../../client/src/utils/customerHistory";
import {
  emptyPrescriptionDraft,
  readPrescriptionDraft,
  opticalValueError,
} from "../../client/src/utils/opticalForm";
import { todayInIndia } from "../../client/src/utils/dates";
import {
  receiptHtml,
  prescriptionHtml,
  whatsappReceiptMessage,
} from "../../client/src/utils/customerDocuments";
import type {
  CustomerRecord,
  CustomerDetails,
  Prescription,
} from "../../client/src/models/customer";
import { addPurchase, getCustomer, updateCustomer } from "../../client/src/services/customerApi";

function rx(id: string, createdAt = "2026-10-20T10:00:00Z"): Prescription {
  return {
    id,
    createdAt,
    reDistSph: "-1.25",
    reDistCyl: null,
    reDistAxis: 0,
    reNearSph: "1.00",
    reNearCyl: null,
    reNearAxis: null,
    leDistSph: "0.00",
    leDistCyl: "-0.50",
    leDistAxis: 90,
    leNearSph: null,
    leNearCyl: null,
    leNearAxis: null,
  };
}
function purchase(
  id: string,
  purchaseDate: string | null,
  createdAt = "2026-10-22T10:00:00Z",
): CustomerRecord {
  return {
    id,
    purchaseDate,
    createdAt,
    prescriptionId: "historical-rx",
    specsType: "Historic frame",
    lensType: null,
    frameCatalogId: null,
    lensCatalogId: null,
    pricingMode: "SPLIT",
    frameRate: "500.00",
    lensRate: "0.00",
    mrp: "500.00",
  };
}
const customer: CustomerDetails = {
  id: "customer-1",
  name: "Test <Customer>",
  mobNumber: "9876543210",
  gender: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-10-22T00:00:00Z",
  ageAtRecording: null,
  ageRecordedAt: null,
  reference: null,
  notes: "CONFIDENTIAL_STAFF_NOTE",
  prescriptions: [rx("latest-rx", "2026-10-22T00:00:00Z"), rx("historical-rx")],
  records: [purchase("purchase-1", "2026-10-22")],
};

test("customer purchase links preserve search and always identify the selected customer", () => {
  const link = new URL(customerDetailsUrl("customer-1", "A & 987+", true), "http://localhost");
  assert.equal(link.pathname, "/customers/customer-1");
  assert.equal(link.searchParams.get("search"), "A & 987+");
  assert.equal(link.searchParams.get("purchase"), "new");
  assert.equal(customerDetailsUrl("customer-1"), "/customers/customer-1");
});

test("purchase history sorts by purchase date, then creation time and ID without mutating API data", () => {
  const records = [
    purchase("unknown", null),
    purchase("backdated", "2020-01-01"),
    purchase("recent", "2026-10-22", "2026-10-22T09:00:00Z"),
    purchase("tie-a", "2026-10-22"),
    purchase("tie-b", "2026-10-22"),
  ];
  const original = structuredClone(records);
  assert.deepEqual(
    sortPurchases(records).map((r) => r.id),
    ["tie-b", "tie-a", "recent", "backdated", "unknown"],
  );
  assert.deepEqual(records, original);
  assert.deepEqual(
    sortPrescriptions([rx("a"), rx("b")]).map((r) => r.id),
    ["b", "a"],
  );
});

test("frame/lens classification uses recorded descriptions rather than prices or latest prescription", () => {
  assert.equal(getPurchaseFlag({ specsType: "Frame", lensType: "Lens" }), "FRAME_AND_LENS");
  assert.equal(getPurchaseFlag({ specsType: "Frame", lensType: " " }), "FRAME_ONLY");
  assert.equal(getPurchaseFlag({ specsType: null, lensType: "Lens" }), "LENS_ONLY");
  assert.equal(getPurchaseFlag({ specsType: " ", lensType: null }), "NOT_SPECIFIED");
});

test("comparison handles zero, missing values, invalid measurements, near powers and reversed selections", () => {
  assert.equal(measurementDifference("0.00", "-1.25"), 1.25);
  assert.equal(measurementDifference("-1.25", "0.00"), -1.25);
  assert.equal(measurementDifference("0.30", "0.20"), 0.1);
  assert.equal(measurementDifference(0, 0), 0);
  assert.equal(measurementDifference(180, 10), 170);
  assert.equal(
    measurementDifference(customer.prescriptions[0].reNearSph, customer.prescriptions[0].reDistSph),
    2.25,
  );
  for (const missing of [null, undefined, "", " ", "invalid", Infinity]) {
    assert.equal(measurementDifference(missing, "1"), null);
    assert.equal(measurementDifference("1", missing), null);
  }
  const before = structuredClone(customer.prescriptions);
  measurementDifference(customer.prescriptions[0].reDistSph, customer.prescriptions[1].reDistSph);
  assert.deepEqual(customer.prescriptions, before);
});

test("new prescription parsing keeps zero, accepts partial near values and rejects invalid powers and axes", () => {
  const draft = {
    ...emptyPrescriptionDraft(),
    re_dist_sph: "0",
    le_near_cyl: "-0.75",
    le_near_axis: "180",
  };
  assert.deepEqual(readPrescriptionDraft(draft), {
    re_dist: { sph: 0 },
    le_near: { cyl: -0.75, axis: 180 },
  });
  assert.equal(readPrescriptionDraft(emptyPrescriptionDraft()), undefined);
  for (const bad of ["-1", "181", "1.5", "invalid"]) {
    assert.match(opticalValueError(bad, "axis")!, /0 and 180/);
  }
  assert.match(opticalValueError("31", "sph")!, /-30 and \+30/);
  assert.match(opticalValueError("-16", "cyl")!, /-15 and \+15/);
});

test("new purchase date uses the Indian calendar at the UTC day boundary", () => {
  assert.equal(todayInIndia(new Date("2026-10-21T19:00:00Z")), "2026-10-22");
  assert.equal(todayInIndia(new Date("2026-10-21T18:29:59Z")), "2026-10-21");
});

test("receipts and WhatsApp use only the purchase-linked prescription and exclude confidential staff notes", () => {
  const record = customer.records[0];
  const oldRx = customer.prescriptions[1];
  const oldDocument = receiptHtml(customer, record, oldRx);
  assert.match(oldDocument, /20 Oct 2026/);
  assert.match(oldDocument, /Test &lt;Customer&gt;/);
  assert.equal(
    receiptHtml(customer, record, customer.prescriptions[0]),
    receiptHtml(customer, record),
  );
  const linkedMessage = whatsappReceiptMessage(customer, record, oldRx);
  assert.match(linkedMessage, /Prescription Date: 20 Oct 2026/);
  assert.equal(
    whatsappReceiptMessage(customer, record, customer.prescriptions[0]),
    whatsappReceiptMessage(customer, record),
  );
  for (const content of [oldDocument, linkedMessage, prescriptionHtml(customer, oldRx)]) {
    assert.equal(content.includes(customer.notes!), false);
  }
});

test("client appends purchases to the selected customer, reloads their history and preserves personal editing endpoint", async (t) => {
  const record = customer.records[0];
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: record }),
  );
  const payload = {
    purchaseDate: "2026-10-22",
    prescriptionId: "historical-rx",
    record: { pricingMode: "MRP_ONLY" as const, specsType: "Frame", lensType: null, mrp: 500 },
  };
  assert.deepEqual(await addPurchase(customer.id, payload), record);
  assert.equal(request.mock.calls[0].arguments[0], "/api/customers/customer-1/records");
  const options = request.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(options.method, "POST");
  assert.equal(options.credentials, "include");
  assert.deepEqual(JSON.parse(options.body as string), payload);
  request.mock.mockImplementation(async () => Response.json({ success: true, data: customer }));
  assert.deepEqual(await getCustomer(customer.id), customer);
  assert.equal(request.mock.calls[1].arguments[0], "/api/customers/customer-1");
  const personal = {
    name: customer.name,
    mobNumber: customer.mobNumber,
    gender: null,
    reference: null,
    notes: customer.notes,
  };
  await updateCustomer(customer.id, personal);
  assert.equal((request.mock.calls[2].arguments[1] as RequestInit).method, "PATCH");
  request.mock.mockImplementation(async () =>
    Response.json(
      { success: false, message: "Prescription not found for this customer." },
      { status: 400 },
    ),
  );
  await assert.rejects(addPurchase(customer.id, payload), /this customer/);
});
