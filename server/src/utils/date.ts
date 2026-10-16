const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// PostgreSQL DATE values use the shop's calendar day, represented at UTC midnight.
export function shopToday(now = new Date()): Date {
  const parts = calendar.formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00.000Z`);
}
