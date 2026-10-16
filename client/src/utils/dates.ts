const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const timestamp = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export function todayInIndia(now = new Date()): string {
  const parts = calendar.formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function indiaDatePlusDays(days: number, now = new Date()): string {
  const [year, month, day] = todayInIndia(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function dateOnly(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

export function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  return dateOnly(value).split("-").reverse().join("/");
}

export function formatDateTime(value: string | null): string {
  return value ? timestamp.format(new Date(value)) : "Not recorded";
}
