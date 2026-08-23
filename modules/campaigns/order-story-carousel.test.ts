import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const campaignPath = path.join(
  "campaigns",
  "social",
  "2026-08-21-ordering-how-it-works-carousel-v1",
);
const frameNames = [
  "01-exact-product-story.jpg",
  "02-start-shopping-story.jpg",
  "03-keep-shopping-story.jpg",
  "04-review-basket-story.jpg",
  "05-contact-story.jpg",
  "06-delivery-story.jpg",
  "07-review-request-story.jpg",
  "08-request-received-story.jpg",
];

async function source(file: string) {
  return readFile(path.join(process.cwd(), file), "utf8");
}

test("Daily Desk order story uses all eight verified guest-flow frames in order", async () => {
  const component = await source(
    "components/campaigns/order-story-carousel.tsx",
  );
  let cursor = -1;

  assert.match(component, /2026-08-21-ordering-how-it-works-carousel-v1/);
  assert.doesNotMatch(component, /2026-08-13-aqua-rich-guest-shopping-flow-v1/);

  for (const frameName of frameNames) {
    const next = component.indexOf(frameName);
    assert.ok(next > cursor, `${frameName} should appear in sequence`);
    cursor = next;
  }

  await Promise.all(
    frameNames.map((frameName) =>
      access(path.join(process.cwd(), "public", campaignPath, frameName)),
    ),
  );
});

test("order story remains accessible, server-first and fully scrollable", async () => {
  const component = await source(
    "components/campaigns/order-story-carousel.tsx",
  );
  const css = await source(
    "components/campaigns/order-story-carousel.module.css",
  );
  const page = await source("app/(site)/lagos/page.tsx");

  assert.doesNotMatch(component, /["']use client["']/);
  assert.match(component, /<ol/);
  assert.match(component, /aria-label=/);
  assert.match(component, /tabIndex=\{0\}/);
  assert.match(component, /href=["']\/products["']/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /scroll-snap-align:\s*start/);
  assert.match(css, /padding-inline:\s*4vw/);
  assert.match(page, /journey\.id === ["']order["']/);
  assert.match(page, /<OrderStoryCarousel/);
  assert.match(
    page,
    /if \(desk\.status !== ["']ready["']\) \{[\s\S]*<OrderStoryCarousel \/>/,
  );
  assert.match(page, /<CommerceJourney/);
});
