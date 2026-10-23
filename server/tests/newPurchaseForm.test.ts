import assert from "node:assert/strict";
import test from "node:test";
import {
  frameLabel,
  lensLabel,
  frameSearchText,
  lensSearchText,
  productSelection,
  sphOptions,
  cylOptions,
  eyes,
  opticalValueError,
  readPrescriptionDraft,
  emptyPrescriptionDraft,
} from "../../client/src/utils/opticalForm";
import {
  initialNewPurchaseForm,
  prepareNewPurchase,
  purchaseTotal,
  type NewPurchaseForm,
} from "../../client/src/utils/newPurchaseForm";
import { addPurchase } from "../../client/src/services/customerApi";
import { createPurchaseRecordSchema } from "../src/validators/historyValidator";
import { createCustomerSchema } from "../src/validators/customerWriteValidator";
import type { FrameProduct, LensProduct } from "../../client/src/models/catalog";

const frame = {
  id: "10000000-0000-4000-8000-000000000001",
  brand: "Ray-Ban",
  model: "RB5228",
  frameCode: "F10",
  frameStyle: "Round",
} as FrameProduct;
const lens = {
  id: "20000000-0000-4000-8000-000000000001",
  company: "Essilor",
  lensName: "Crizal",
  visionType: "Single Vision",
  coating: "Blue Cut",
  lensCode: "L20",
} as LensProduct;
const rxId = "30000000-0000-4000-8000-000000000001";
const valid = (): NewPurchaseForm => ({
  ...initialNewPurchaseForm(),
  specsType: "Manual Frame",
  frameRate: "500.10",
  lensRate: "0",
});

test("product selection uses Add Customer naming and preserves custom descriptions without catalog links", () => {
  assert.deepEqual(productSelection(frame, frameLabel), {
    text: "Ray-Ban - RB5228",
    catalogId: frame.id,
  });
  assert.deepEqual(productSelection(lens, lensLabel), {
    text: "Essilor - Crizal - Single Vision - Blue Cut",
    catalogId: lens.id,
  });
  assert.deepEqual(productSelection("Custom lens / AR design", lensLabel), {
    text: "Custom lens / AR design",
    catalogId: "",
  });
  assert.deepEqual(productSelection("Custom Frame", frameLabel), {
    text: "Custom Frame",
    catalogId: "",
  });
  assert.deepEqual(productSelection(null, frameLabel), { text: "", catalogId: "" });
  assert.match(frameSearchText(frame), /F10 Round/);
  assert.match(lensSearchText(lens), /Single Vision Blue Cut L20/);
  const frameValue = productSelection(frame, frameLabel);
  const lensValue = productSelection(lens, lensLabel);
  const result = prepareNewPurchase(
    {
      ...valid(),
      specsType: frameValue.text,
      frameCatalogId: frameValue.catalogId,
      lensType: lensValue.text,
      lensCatalogId: lensValue.catalogId,
      lensRate: "199.90",
    },
    [],
  );
  assert.equal(result.payload?.record.frameCatalogId, frame.id);
  assert.equal(result.payload?.record.lensCatalogId, lens.id);
  assert.equal(result.payload?.record.specsType, frameValue.text);
  assert.equal(result.payload?.record.lensType, lensValue.text);
});

test("frame-only, lens-only and combined purchases map prices and descriptions without rewriting form state", () => {
  for (const values of [
    valid(),
    { ...valid(), specsType: "", frameRate: "0", lensType: "Custom Lens", lensRate: "250.25" },
    { ...valid(), lensType: "Custom Lens", lensRate: "250.25" },
  ]) {
    const before = structuredClone(values);
    const result = prepareNewPurchase(values, []);
    assert.deepEqual(result.errors, {});
    assert.equal(createPurchaseRecordSchema.safeParse(result.payload).success, true);
    assert.equal(result.payload?.record.specsType, values.specsType || null);
    assert.equal(result.payload?.record.lensType, values.lensType || null);
    assert.deepEqual(values, before);
  }
  const prices = {
    ...valid(),
    lensType: "Lens",
    lensRate: "0.20",
    frameRate: "0.10",
    mrp: "99.99",
  };
  assert.equal(purchaseTotal(prices), 0.3);
  assert.equal(purchaseTotal({ ...prices, pricingMode: "MRP_ONLY" }), 99.99);
  assert.equal(prices.frameRate, "0.10");
  assert.equal(prices.mrp, "99.99");
  const mrpPayload = prepareNewPurchase({ ...prices, pricingMode: "MRP_ONLY" }, []).payload;
  assert.equal(mrpPayload?.record.pricingMode, "MRP_ONLY");
  assert.equal(mrpPayload?.record.pricingMode === "MRP_ONLY" && mrpPayload.record.mrp, 99.99);
  assert.equal(createPurchaseRecordSchema.safeParse(mrpPayload).success, true);
});

test("the shared prescription section renders all twelve fields and power controls retain dropdown affordances", async () => {
  const { createElement } = await import("../../client/node_modules/react/index.js");
  const { renderToStaticMarkup } =
    await import("../../client/node_modules/react-dom/server.node.js");
  const { default: Fields, PrescriptionMeasurementInput } =
    await import("../../client/src/components/customers/OpticalPrescriptionFields");
  const fields: string[] = [];
  const html = renderToStaticMarkup(
    createElement(Fields, {
      renderField: (name, measure, options, label) => {
        fields.push(name);
        return createElement(PrescriptionMeasurementInput, {
          value: "0.00",
          onChange: () => {},
          measure,
          options,
          label,
        });
      },
    }),
  );
  assert.equal(fields.length, 12);
  assert.equal(new Set(fields).size, 12);
  assert.ok(html.includes("Right Eye") && html.includes("Left Eye"));
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 8);
  assert.equal((html.match(/inputmode="numeric"/gi) ?? []).length, 4);
  assert.ok(html.includes("MuiAutocomplete-popupIndicator"));
});

test("power dropdowns, eye ordering and optional parsing match Add Customer including signed decimals and zero", () => {
  assert.equal(sphOptions.length, 241);
  assert.equal(cylOptions.length, 121);
  assert.ok(
    sphOptions.includes("-1.25") && sphOptions.includes("0.00") && sphOptions.includes("+1.25"),
  );
  assert.deepEqual(
    eyes.map((eye) => eye.prefix),
    ["re_dist", "re_near", "le_dist", "le_near"],
  );
  const prescription = {
    ...emptyPrescriptionDraft(),
    re_dist_sph: "+1.23",
    re_near_cyl: "-0.75",
    re_near_axis: "0",
    le_dist_sph: "0.00",
    le_near_sph: "2.25",
    le_near_axis: "180",
  };
  for (const [field, text] of Object.entries(prescription)) {
    assert.equal(
      opticalValueError(
        text,
        field.endsWith("axis") ? "axis" : field.endsWith("cyl") ? "cyl" : "sph",
      ),
      undefined,
    );
  }
  const result = prepareNewPurchase({ ...valid(), prescriptionMode: "NEW", prescription }, []);
  assert.deepEqual(result.payload?.prescription, {
    re_dist: { sph: 1.23 },
    re_near: { cyl: -0.75, axis: 0 },
    le_dist: { sph: 0 },
    le_near: { sph: 2.25, axis: 180 },
  });
  assert.equal(createPurchaseRecordSchema.safeParse(result.payload).success, true);
  assert.equal(
    createCustomerSchema.safeParse({
      name: "Existing Add Customer flow",
      record: result.payload?.record,
      prescription: readPrescriptionDraft(prescription),
    }).success,
    true,
  );
});

test("existing, new and no-prescription modes send only the active choice and never send an empty prescription", () => {
  const draft = {
    ...valid(),
    prescriptionId: rxId,
    prescription: { ...emptyPrescriptionDraft(), re_dist_sph: "-1.25" },
  };
  const existing = prepareNewPurchase({ ...draft, prescriptionMode: "EXISTING" }, [{ id: rxId }]);
  assert.equal(existing.payload?.prescriptionId, rxId);
  assert.equal(existing.payload?.prescription, undefined);
  const fresh = prepareNewPurchase({ ...draft, prescriptionMode: "NEW" }, [{ id: rxId }]);
  assert.equal(fresh.payload?.prescriptionId, null);
  assert.deepEqual(fresh.payload?.prescription, { re_dist: { sph: -1.25 } });
  for (const prescriptionMode of ["NONE", "NEW"] as const) {
    const result = prepareNewPurchase(
      { ...draft, prescriptionMode, prescription: emptyPrescriptionDraft() },
      [],
    );
    assert.equal(result.payload?.prescriptionId, null);
    assert.equal(result.payload?.prescription, undefined);
    assert.equal(createPurchaseRecordSchema.safeParse(result.payload).success, true);
  }
  assert.match(
    prepareNewPurchase({ ...draft, prescriptionMode: "EXISTING" }, []).errors.prescriptionId!,
    /this customer/,
  );
});

test("invalid dates, prices and measurements produce field errors without submitting malformed requests", () => {
  for (const value of ["181", "-1", "1.5", "1e2", "+90"]) {
    const result = prepareNewPurchase(
      {
        ...valid(),
        prescriptionMode: "NEW",
        prescription: { ...emptyPrescriptionDraft(), re_dist_axis: value },
      },
      [],
    );
    assert.match(result.errors.re_dist_axis!, /0 and 180/);
    assert.equal(result.payload, undefined);
  }
  for (const value of ["31", "NaN", "0x10", "1e1", "Infinity"]) {
    assert.ok(
      prepareNewPurchase(
        {
          ...valid(),
          prescriptionMode: "NEW",
          prescription: { ...emptyPrescriptionDraft(), le_near_sph: value },
        },
        [],
      ).errors.le_near_sph,
    );
  }
  for (const frameRate of ["", "-1", "1.234", "1e3", "10000000000"]) {
    assert.ok(prepareNewPurchase({ ...valid(), frameRate }, []).errors.frameRate);
  }
  assert.ok(prepareNewPurchase({ ...valid(), purchaseDate: "2026-02-29" }, []).errors.purchaseDate);
  assert.ok(prepareNewPurchase({ ...valid(), frameRate: "0" }, []).errors.total);
  assert.equal(purchaseTotal({ ...valid(), frameRate: "invalid" }), null);
});

test("simultaneous identical purchase saves share one request and expose failures without success data", async (t) => {
  const payload = prepareNewPurchase(valid(), []).payload!;
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetch = t.mock.method(globalThis, "fetch", async () => pending);
  const first = addPurchase("selected-customer", payload);
  const second = addPurchase("selected-customer", payload);
  assert.equal(first, second);
  assert.equal(fetch.mock.calls.length, 1);
  finish(Response.json({ success: true, data: { id: "purchase-1", prescriptionId: null } }));
  assert.deepEqual(await first, await second);
  fetch.mock.mockImplementation(async () =>
    Response.json({ success: false, message: "Save failed." }, { status: 503 }),
  );
  await assert.rejects(addPurchase("selected-customer", payload), /Save failed/);
  fetch.mock.mockImplementation(async () =>
    Response.json({ success: true, data: { id: "purchase-2" } }),
  );
  assert.equal((await addPurchase("selected-customer", payload)).id, "purchase-2");
  assert.equal(fetch.mock.calls.length, 3);
});
