import assert from "node:assert/strict";
import test from "node:test";
import {
  bindCatalogueDiscoverySources,
  catalogueDiscoverySources,
} from "@/data/catalogue-discovery-sources";
import { retailerByName } from "@/data/retailers";

const noRetention = {
  capability: "none" as const,
  rationale: "no-reviewed-private-response-retention-grant" as const,
  retentionBoundary: "none" as const,
  publicContentReuse: "none" as const,
  publicImageReuse: "none" as const,
};

test("the static retailer registry owns matched discovery trust and review status", () => {
  for (const source of catalogueDiscoverySources) {
    const retailer = retailerByName(source.retailer);
    if (!retailer) {
      assert.equal(source.retailerAuthority, "unmatched-private-only");
      assert.equal(source.reviewStatus, "provisional");
      continue;
    }
    assert.equal(source.retailerAuthority, "reviewed-static-registry");
    assert.equal(source.retailer, retailer.name);
    assert.equal(source.reviewStatus, retailer.reviewStatus);
    assert.equal(source.trust, retailer.trust);
    assert.equal(source.contentUse, retailer.contentUse);
  }

  const declaration = {
    key: "buybetter-declaration",
    retailer: "buybetter",
    platform: "custom" as const,
    endpoint: "https://buybetter.ng/catalogue",
    host: "buybetter.ng",
    reviewStatus: "directory-listed" as const,
    trust: 97,
    contentUse: "link-only" as const,
    privateSourceByteRetention: noRetention,
  };
  const [bound] = bindCatalogueDiscoverySources([declaration]);
  assert.equal(bound?.retailer, "BuyBetter");
  assert.equal(bound?.reviewStatus, "directory-listed");
  assert.equal(bound?.trust, 97);
  assert.equal(bound?.retailerAuthority, "reviewed-static-registry");
  assert.throws(
    () =>
      bindCatalogueDiscoverySources([
        {
          ...declaration,
          key: "stale-buybetter-declaration",
          reviewStatus: "provisional",
          trust: 1,
        },
      ]),
    /trust\/status drifted from the reviewed retailer registry/,
  );
});

test("an unmatched discovery source cannot claim public retailer eligibility", () => {
  const declaration = {
    key: "unregistered-store",
    retailer: "Unregistered Store",
    platform: "custom" as const,
    endpoint: "https://unregistered.example/catalogue",
    host: "unregistered.example",
    reviewStatus: "directory-listed" as const,
    trust: 90,
    contentUse: "link-only" as const,
    privateSourceByteRetention: noRetention,
  };
  assert.throws(
    () => bindCatalogueDiscoverySources([declaration]),
    /cannot receive public discovery eligibility outside the reviewed retailer registry/,
  );

  const [privateOnly] = bindCatalogueDiscoverySources([
    {
      ...declaration,
      reviewStatus: "provisional",
    },
  ]);
  assert.equal(privateOnly?.retailerAuthority, "unmatched-private-only");
  assert.equal(privateOnly?.reviewStatus, "provisional");
});
