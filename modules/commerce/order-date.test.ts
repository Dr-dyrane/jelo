import assert from "node:assert/strict";
import test from "node:test";
import { formatOrderDateTime } from "../../lib/commerce/order-date";

test("order timestamps are stable between server and customer browsers", () => {
  const observedAt = "2026-08-13T17:09:00.000Z";

  assert.equal(formatOrderDateTime(observedAt), "13 Aug 2026 at 18:09");
  assert.equal(
    formatOrderDateTime(new Date(observedAt)),
    "13 Aug 2026 at 18:09",
  );
  assert.equal(formatOrderDateTime("not-a-date"), "Unknown time");
});
