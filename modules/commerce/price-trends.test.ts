import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOfferPriceTrends,
  calculatePriceTrends,
  compactPriceMovementLabel,
  describePriceMovement,
  preferredPriceMovement,
  selectCurrentPriceObservations,
  selectRetailerPriceMovement,
  type CurrentPriceObservation,
  type PriceObservation,
  type PriceTrendOfferSnapshot,
} from "./price-trends";

const asOf = new Date("2026-07-22T12:00:00Z");
let historySequence = 0;

function observation(
  offerId: string,
  priceMinor: number,
  observedAt: string,
  overrides: Partial<PriceObservation> = {},
): PriceObservation {
  historySequence += 1;
  return {
    historyId: `history-${historySequence}`,
    offerId,
    retailer: offerId,
    priceMinor,
    observedAt,
    recordedAt: observedAt,
    ...overrides,
  };
}

test("compares the same exact offers across a seven-day window", () => {
  const result = calculatePriceTrends(
    [
      observation("one", 15_000, "2026-07-14T12:00:00Z"),
      observation("one", 14_000, "2026-07-22T10:00:00Z"),
      observation("two", 17_000, "2026-07-15T12:00:00Z"),
      observation("two", 16_000, "2026-07-22T09:00:00Z"),
    ],
    asOf,
  );

  assert.deepEqual(result.sevenDay, {
    days: 7,
    direction: "down",
    amountMinor: -1_000,
    percent: -6.3,
    comparableOfferCount: 2,
    comparableRetailerCount: 2,
    fromAt: "2026-07-15T12:00:00Z",
    toAt: "2026-07-22T10:00:00Z",
  });
});

test("does not claim movement without a fresh current and timely anchor", () => {
  const result = calculatePriceTrends(
    [
      observation("current-only", 15_000, "2026-07-22T10:00:00Z"),
      observation("stale-anchor", 18_000, "2026-06-01T10:00:00Z"),
      observation("stale-anchor", 17_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );

  assert.equal(result.sevenDay, null);
  assert.equal(result.thirtyDay, null);
});

test("treats sub-half-percent movement as steady", () => {
  const result = calculatePriceTrends(
    [
      observation("one", 10_000, "2026-06-21T12:00:00Z"),
      observation("one", 10_040, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );

  assert.equal(result.thirtyDay?.direction, "flat");
  assert.equal(result.thirtyDay?.percent, 0.4);
});

test("falls back to the last trustworthy check while seven-day history is still growing", () => {
  const result = calculatePriceTrends(
    [
      observation("one", 15_000, "2026-07-19T12:00:00Z"),
      observation("one", 14_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );

  assert.equal(result.sevenDay, null);
  assert.equal(result.recent?.direction, "down");
  assert.equal(result.recent?.percent, -6.7);
  assert.equal(result.recent?.days, 3);
});

test("does not treat rapid duplicate refreshes as a meaningful trend window", () => {
  const result = calculatePriceTrends(
    [
      observation("one", 15_000, "2026-07-22T06:00:00Z"),
      observation("one", 14_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );

  assert.equal(result.recent, null);
});

test("keeps each store movement separate from the market movement", () => {
  const result = calculateOfferPriceTrends(
    [
      observation("store-a", 15_000, "2026-07-14T12:00:00Z"),
      observation("store-a", 14_000, "2026-07-22T10:00:00Z"),
      observation("store-b", 17_000, "2026-07-15T12:00:00Z"),
      observation("store-b", 18_000, "2026-07-22T09:00:00Z"),
    ],
    asOf,
  );

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => ({
      offerId: item.offerId,
      retailer: item.retailer,
      direction: item.sevenDay?.direction,
      percent: item.sevenDay?.percent,
    })),
    [
      {
        offerId: "store-a",
        retailer: "store-a",
        direction: "down",
        percent: -6.7,
      },
      {
        offerId: "store-b",
        retailer: "store-b",
        direction: "up",
        percent: 5.9,
      },
    ],
  );
});

test("omits a store direction until that exact offer has a valid comparison window", () => {
  const result = calculateOfferPriceTrends(
    [
      observation("current-only", 14_000, "2026-07-22T10:00:00Z"),
      observation("with-history", 17_000, "2026-07-15T12:00:00Z"),
      observation("with-history", 16_000, "2026-07-22T09:00:00Z"),
    ],
    asOf,
  );

  assert.deepEqual(
    result.map((item) => item.offerId),
    ["with-history"],
  );
});

test("hides retailer movement when multiple exact offers share the same store card", () => {
  const byOffer = calculateOfferPriceTrends(
    [
      observation("first-offer", 15_000, "2026-07-14T12:00:00Z"),
      observation("first-offer", 14_000, "2026-07-22T10:00:00Z"),
      observation("second-offer", 17_000, "2026-07-15T12:00:00Z"),
      observation("second-offer", 18_000, "2026-07-22T09:00:00Z"),
    ],
    asOf,
  ).map((item) => ({ ...item, retailer: "Same store" }));

  assert.equal(
    selectRetailerPriceMovement(
      { byOffer: { NG: byOffer } },
      "NG",
      "Same store",
    ),
    null,
  );
});

test("selects movement only for one unambiguous exact retailer offer", () => {
  const [offer] = calculateOfferPriceTrends(
    [
      observation("only-offer", 15_000, "2026-07-14T12:00:00Z"),
      observation("only-offer", 14_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );
  const movement = selectRetailerPriceMovement(
    {
      byOffer: { NG: [{ ...offer, retailer: "Exact store" }] },
    },
    "NG",
    " exact STORE ",
  );

  assert.equal(movement?.direction, "down");
  assert.equal(movement?.percent, -6.7);
});

test("preferred movement falls through a weak long window to valid shorter evidence", () => {
  const thirtyDay = calculatePriceTrends(
    [
      observation("one", 15_000, "2026-06-21T12:00:00Z"),
      observation("one", 14_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  ).thirtyDay!;
  const sevenDay = calculatePriceTrends(
    [
      observation("one", 15_000, "2026-07-14T12:00:00Z"),
      observation("one", 14_000, "2026-07-22T10:00:00Z"),
      observation("two", 17_000, "2026-07-15T12:00:00Z"),
      observation("two", 16_000, "2026-07-22T09:00:00Z"),
    ],
    asOf,
  ).sevenDay!;

  const selected = preferredPriceMovement(
    { thirtyDay, sevenDay },
    (movement) => (movement.comparableRetailerCount ?? 0) >= 2,
  );

  assert.equal(selected?.days, 7);
  assert.equal(selected?.comparableRetailerCount, 2);
});

test("describes one-day evidence without broken plural copy", () => {
  const result = calculatePriceTrends(
    [
      observation("one", 10_000, "2026-07-21T10:00:00Z"),
      observation("one", 10_000, "2026-07-22T10:00:00Z"),
    ],
    asOf,
  );
  assert.equal(
    describePriceMovement(result.recent!, "Store price"),
    "Store price steady over 1 day. Based on 1 matching store.",
  );
});

function currentObservation(
  offerId: string,
  retailer: string,
  url: string,
  priceMinor: number,
  observedAt: string,
  overrides: Partial<CurrentPriceObservation> = {},
): CurrentPriceObservation {
  historySequence += 1;
  return {
    historyId: `history-${historySequence}`,
    offerId,
    retailer,
    url,
    market: "NG",
    available: true,
    inventoryStatus: "in_stock",
    verificationMethod: "manual",
    lastVerifiedAt: "2026-07-22T10:00:00Z",
    verificationExpiresAt: "2026-07-23T10:00:00Z",
    observedTitle: "Exact product",
    observedSize: "30 ml",
    currentPriceMinor: 14_000,
    currentCurrencyCode: "NGN",
    priceMinor,
    observedAt,
    recordedAt: observedAt,
    ...overrides,
  };
}

const exactSnapshot: PriceTrendOfferSnapshot[] = [
  {
    market: "NG",
    retailer: "Exact store",
    url: "https://example.com/exact-product",
    priceMinor: 14_000,
    currencyCode: "NGN",
    observedAt: "2026-07-22T10:00:00Z",
    observedTitle: "Exact product",
    observedSize: "30 ml",
  },
];

test("fails closed when no exact current offer snapshot is supplied", () => {
  const row = currentObservation(
    "exact",
    "Exact store",
    "https://example.com/exact-product",
    14_000,
    "2026-07-22T10:00:00Z",
  );

  assert.deepEqual(selectCurrentPriceObservations([row], undefined, asOf), []);
  assert.deepEqual(selectCurrentPriceObservations([row], [], asOf), []);
});

test("keeps history only for the exact current market, retailer and URL snapshot", () => {
  const selected = selectCurrentPriceObservations(
    [
      currentObservation(
        "exact",
        "Exact store",
        "https://example.com/exact-product",
        15_000,
        "2026-07-15T12:00:00Z",
      ),
      currentObservation(
        "exact",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
      ),
      currentObservation(
        "wrong-url",
        "Exact store",
        "https://example.com/different-listing",
        13_000,
        "2026-07-22T10:00:00Z",
      ),
      currentObservation(
        "wrong-market",
        "Exact store",
        "https://example.com/exact-product",
        13_000,
        "2026-07-22T10:00:00Z",
        { market: "US", currentCurrencyCode: "USD" },
      ),
    ],
    exactSnapshot,
    asOf,
  );

  assert.deepEqual(
    selected.map((item) => item.offerId),
    ["exact", "exact"],
  );
});

test("uses recording time to order equal observation timestamps independent of input order", () => {
  const observedAt = "2026-07-22T10:00:00Z";
  const earlier = currentObservation(
    "exact",
    "Exact store",
    "https://example.com/exact-product",
    14_500,
    observedAt,
    {
      historyId: "history-earlier",
      recordedAt: "2026-07-22T10:01:00Z",
    },
  );
  const later = currentObservation(
    "exact",
    "Exact store",
    "https://example.com/exact-product",
    14_000,
    observedAt,
    {
      historyId: "history-later",
      recordedAt: "2026-07-22T10:02:00Z",
    },
  );

  const selected = selectCurrentPriceObservations(
    [later, earlier],
    exactSnapshot,
    asOf,
  );

  assert.deepEqual(
    selected.map((item) => item.priceMinor),
    [14_500, 14_000],
  );
});

test("fails closed on conflicting prices at one irreducible causal position", () => {
  const observedAt = "2026-07-22T10:00:00Z";
  const recordedAt = "2026-07-22T10:01:00Z";
  const rows = [
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      14_500,
      observedAt,
      { historyId: "history-a", recordedAt },
    ),
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      14_000,
      observedAt,
      { historyId: "history-b", recordedAt },
    ),
  ];

  assert.deepEqual(
    selectCurrentPriceObservations(rows, exactSnapshot, asOf),
    [],
  );
  assert.deepEqual(calculatePriceTrends(rows, asOf), {
    recent: null,
    sevenDay: null,
    thirtyDay: null,
  });
});

test("fails closed when a history identity is duplicated", () => {
  const rows = [
    observation("exact", 14_500, "2026-07-15T10:00:00Z", {
      historyId: "duplicate",
    }),
    observation("exact", 14_000, "2026-07-22T10:00:00Z", {
      historyId: "duplicate",
    }),
  ];

  assert.deepEqual(calculatePriceTrends(rows, asOf), {
    recent: null,
    sevenDay: null,
    thirtyDay: null,
  });
});

test("appends synthetic observation when DB price does not match snapshot", () => {
  const rows = [
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      15_000,
      "2026-07-15T12:00:00Z",
    ),
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      14_000,
      "2026-07-22T10:00:00Z",
    ),
  ];

  // The snapshot has a different price than the DB. Instead of rejecting,
  // the function should append a synthetic observation with the snapshot price.
  const snapshotWithDifferentPrice: PriceTrendOfferSnapshot[] = [
    { ...exactSnapshot[0], priceMinor: 13_500 },
  ];

  const selected = selectCurrentPriceObservations(
    rows,
    snapshotWithDifferentPrice,
    asOf,
  );
  const prices = selected.map((item) => item.priceMinor);
  assert.ok(
    prices.includes(13_500),
    "synthetic observation with snapshot price should be included",
  );
  assert.ok(
    prices.includes(15_000),
    "historical DB observation should be preserved",
  );
});

test("rejects snapshot with wrong currency code", () => {
  const rows = [
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      14_000,
      "2026-07-22T10:00:00Z",
    ),
  ];

  // Currency mismatch in the snapshot itself makes it invalid.
  const wrongCurrency: PriceTrendOfferSnapshot[] = [
    { ...exactSnapshot[0], currencyCode: "USD" as "NGN" },
  ];

  assert.deepEqual(
    selectCurrentPriceObservations(rows, wrongCurrency, asOf),
    [],
  );
});

test("appends synthetic observation when history does not end at the rendered observation", () => {
  const rows = [
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      15_000,
      "2026-07-15T12:00:00Z",
    ),
    currentObservation(
      "exact",
      "Exact store",
      "https://example.com/exact-product",
      13_000,
      "2026-07-22T09:00:00Z",
    ),
  ];

  // The snapshot says 14_000 at 2026-07-22T10:00:00Z but the latest DB row
  // says 13_000 at 2026-07-22T09:00:00Z. Instead of rejecting, the function
  // should append a synthetic observation with the snapshot price.
  const selected = selectCurrentPriceObservations(rows, exactSnapshot, asOf);
  const prices = selected.map((item) => item.priceMinor);
  assert.ok(
    prices.includes(14_000),
    "synthetic observation with snapshot price should be included",
  );
  assert.ok(
    prices.includes(15_000),
    "historical DB observation should be preserved",
  );
});

test("rejects ambiguous rendered snapshots for the same exact listing", () => {
  const row = currentObservation(
    "exact",
    "Exact store",
    "https://example.com/exact-product",
    14_000,
    "2026-07-22T10:00:00Z",
  );

  assert.deepEqual(
    selectCurrentPriceObservations(
      [row],
      [exactSnapshot[0], { ...exactSnapshot[0], priceMinor: 13_500 }],
      asOf,
    ),
    [],
  );
});

test("uses static catalogue as source of truth regardless of DB listing state", () => {
  // The static catalogue (snapshot) is the source of truth for whether an
  // offer is current. DB listing state (available, stock, freshness) no
  // longer gates trend inclusion because the static catalogue already
  // enforces freshness via isShareableNgOffer before building the snapshot.
  const unavailable = selectCurrentPriceObservations(
    [
      currentObservation(
        "unavailable",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
        { available: false },
      ),
    ],
    exactSnapshot,
    asOf,
  );
  const outOfStock = selectCurrentPriceObservations(
    [
      currentObservation(
        "out-of-stock",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
        { inventoryStatus: "out_of_stock" },
      ),
    ],
    exactSnapshot,
    asOf,
  );
  const stale = selectCurrentPriceObservations(
    [
      currentObservation(
        "stale",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
        {
          lastVerifiedAt: "2026-07-10T10:00:00Z",
          verificationExpiresAt: "2026-07-17T10:00:00Z",
        },
      ),
    ],
    exactSnapshot,
    asOf,
  );

  // All three should return observations (the DB history row matches the
  // snapshot exactly, so no synthetic is needed).
  assert.equal(unavailable.length > 0, true);
  assert.equal(outOfStock.length > 0, true);
  assert.equal(stale.length > 0, true);
});

test("uses static catalogue regardless of DB verification method or completeness", () => {
  // DB verification method and observed title/size completeness no longer
  // gate trend inclusion. The static catalogue snapshot is the source of
  // truth for the current offer identity.
  const imported = selectCurrentPriceObservations(
    [
      currentObservation(
        "imported",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
        { verificationMethod: "import" },
      ),
    ],
    exactSnapshot,
    asOf,
  );
  const incomplete = selectCurrentPriceObservations(
    [
      currentObservation(
        "incomplete",
        "Exact store",
        "https://example.com/exact-product",
        14_000,
        "2026-07-22T10:00:00Z",
        { observedSize: null },
      ),
    ],
    exactSnapshot,
    asOf,
  );

  assert.equal(imported.length > 0, true);
  assert.equal(incomplete.length > 0, true);
});

test("creates synthetic observation for snapshot offers with no DB history", () => {
  // When a new offer is added to the static catalogue but hasn't been seeded
  // into Neon yet, there are no DB rows for it. The function should create
  // a synthetic observation from the snapshot so the offer appears in the
  // trend chart and is counted in market calculations.
  const selected = selectCurrentPriceObservations([], exactSnapshot, asOf);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].priceMinor, 14_000);
  assert.equal(selected[0].retailer, "Exact store");
  assert.equal(selected[0].observedAt, "2026-07-22T10:00:00.000Z");
});

test("market movement excludes a retailer with duplicate exact offer series", () => {
  const result = calculatePriceTrends(
    [
      {
        ...observation("duplicate-a", 10_000, "2026-07-21T10:00:00Z"),
        retailer: "Same store",
      },
      {
        ...observation("duplicate-a", 8_000, "2026-07-22T10:00:00Z"),
        retailer: "Same store",
      },
      {
        ...observation("duplicate-b", 20_000, "2026-07-21T10:00:00Z"),
        retailer: " same STORE ",
      },
      {
        ...observation("duplicate-b", 30_000, "2026-07-22T10:00:00Z"),
        retailer: " same STORE ",
      },
      {
        ...observation("unambiguous", 15_000, "2026-07-21T10:00:00Z"),
        retailer: "Other store",
      },
      {
        ...observation("unambiguous", 14_000, "2026-07-22T10:00:00Z"),
        retailer: "Other store",
      },
    ],
    asOf,
  );

  assert.equal(result.recent?.direction, "down");
  assert.equal(result.recent?.percent, -6.7);
  assert.equal(result.recent?.comparableOfferCount, 1);
  assert.equal(result.recent?.comparableRetailerCount, 1);
  assert.equal(
    describePriceMovement(result.recent!, "Market price"),
    "Market price down over 1 day by 6.7 percent. Based on 1 matching store.",
  );
});

test("formats only meaningful movement as a compact arrow, percent and duration", () => {
  assert.equal(
    compactPriceMovementLabel({
      days: 7,
      direction: "down",
      amountMinor: -1_000,
      percent: -6.3,
      comparableOfferCount: 2,
      fromAt: "2026-07-15T12:00:00Z",
      toAt: "2026-07-22T10:00:00Z",
    }),
    "↓ 6.3% · 7d",
  );
  assert.equal(
    compactPriceMovementLabel({
      days: 30,
      direction: "up",
      amountMinor: 800,
      percent: 4,
      comparableOfferCount: 1,
      fromAt: "2026-06-22T12:00:00Z",
      toAt: "2026-07-22T10:00:00Z",
    }),
    "↑ 4% · 30d",
  );
  assert.equal(
    compactPriceMovementLabel({
      days: 3,
      direction: "flat",
      amountMinor: 0,
      percent: 0.2,
      comparableOfferCount: 1,
      fromAt: "2026-07-19T12:00:00Z",
      toAt: "2026-07-22T10:00:00Z",
    }),
    null,
  );
});
