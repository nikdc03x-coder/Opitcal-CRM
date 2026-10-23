export const CUSTOMER_AGE_ERROR = "Enter a whole-number age from 0 to 120, or leave it blank.";

// nik - Keep blank, zero, and invalid input distinct in both customer forms.
export function parseCustomerAge(value: string): number | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return undefined;
  const age = Number(text);
  return Number.isInteger(age) && age <= 120 ? age : undefined;
}
