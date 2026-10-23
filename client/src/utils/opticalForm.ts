import type { CustomerPayload, EyeValues } from "../models/customer";
import type { FrameProduct, LensProduct } from "../models/catalog";

// Shared with Add Customer: keep names, order, dropdowns and parsing identical.
export const eyes = [
  { prefix: "re_dist", label: "RE DIST", description: "Right Eye · Distance" },
  { prefix: "re_near", label: "RE NEAR", description: "Right Eye · Near" },
  { prefix: "le_dist", label: "LE DIST", description: "Left Eye · Distance" },
  { prefix: "le_near", label: "LE NEAR", description: "Left Eye · Near" },
] as const;
export type EyePrefix = (typeof eyes)[number]["prefix"];
export type EyeMeasure = "sph" | "cyl" | "axis";
export type EyeFieldName = `${EyePrefix}_${EyeMeasure}`;
export type PrescriptionDraft = Record<EyeFieldName, string>;

function createPowerOptions(min: number, max: number): string[] {
  return Array.from({ length: (max - min) * 4 + 1 }, (_, index) => {
    const value = min + index / 4;
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
  });
}
export const sphOptions = createPowerOptions(-30, 30);
export const cylOptions = createPowerOptions(-15, 15);

export function opticalValueError(text: string, measure: EyeMeasure): string | undefined {
  const value = text.trim();
  if (!value) return undefined;
  const number = Number(value);
  const limit = measure === "sph" ? 30 : 15;
  const valid =
    measure === "axis"
      ? /^\d+$/.test(value) && number <= 180
      : /^[+-]?\d+(\.\d+)?$/.test(value) && Number.isFinite(number) && Math.abs(number) <= limit;
  return valid
    ? undefined
    : measure === "axis"
      ? "AXIS must be between 0 and 180."
      : `${measure.toUpperCase()} must be between -${limit} and +${limit}.`;
}

export function emptyPrescriptionDraft(): PrescriptionDraft {
  return Object.fromEntries(
    eyes.flatMap(({ prefix }) =>
      (["sph", "cyl", "axis"] as const).map((measure) => [`${prefix}_${measure}`, ""]),
    ),
  ) as PrescriptionDraft;
}

export function readEye(values: PrescriptionDraft, prefix: EyePrefix): EyeValues | undefined {
  const eye: EyeValues = {};
  for (const measure of ["sph", "cyl", "axis"] as const) {
    const text = values[`${prefix}_${measure}`].trim();
    if (text) eye[measure] = Number(text);
  }
  return Object.keys(eye).length ? eye : undefined;
}

export function readPrescriptionDraft(values: PrescriptionDraft): CustomerPayload["prescription"] {
  const result: NonNullable<CustomerPayload["prescription"]> = {};
  for (const { prefix } of eyes) {
    const eye = readEye(values, prefix);
    if (eye) result[prefix] = eye;
  }
  return Object.keys(result).length ? result : undefined;
}

export function validDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99;
}

export function frameLabel(frame: FrameProduct): string {
  return `${frame.brand} - ${frame.model}`;
}
export function lensLabel(lens: LensProduct): string {
  return [lens.company, lens.lensName, lens.visionType, lens.coating].filter(Boolean).join(" - ");
}
export function frameSearchText(frame: FrameProduct): string {
  return [frame.brand, frame.model, frame.frameCode, frame.frameStyle].filter(Boolean).join(" ");
}
export function lensSearchText(lens: LensProduct): string {
  return [lens.company, lens.lensName, lens.visionType, lens.coating, lens.lensCode]
    .filter(Boolean)
    .join(" ");
}
export function productSelection<T extends { id: string }>(
  selected: T | string | null,
  label: (product: T) => string,
) {
  return typeof selected === "string"
    ? { text: selected, catalogId: "" }
    : { text: selected ? label(selected) : "", catalogId: selected?.id ?? "" };
}
