import assert from "node:assert/strict";
import test from "node:test";
import { shopToday } from "../src/utils/date";

test("client delivery shortcuts and server overdue checks share the India calendar at day/year boundaries", async () => {
  const { todayInIndia, indiaDatePlusDays, formatDate } =
    await import("../../client/src/utils/dates");
  for (const [instant, day, tomorrow] of [
    ["2026-12-31T18:29:59Z", "2026-12-31", "2027-01-01"],
    ["2026-12-31T18:30:00Z", "2027-01-01", "2027-01-02"],
    ["2024-02-28T12:00:00Z", "2024-02-28", "2024-02-29"],
  ]) {
    const now = new Date(instant);
    assert.equal(todayInIndia(now), day);
    assert.equal(shopToday(now).toISOString().slice(0, 10), day);
    assert.equal(indiaDatePlusDays(1, now), tomorrow);
  }
  assert.equal(formatDate("2027-01-02T00:00:00.000Z"), "02/01/2027");
});
