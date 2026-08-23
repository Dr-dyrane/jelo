# Product north star

Updated: 2026-08-23

JeloCare should be the first place people in Nigeria check before buying skincare.

## Current gap (2026-08-23)

JeloCare is not yet meeting its own standard. The catalogue has 158 public
products, but only 60 (38%) have Nigerian offers. 98 products show no price,
no stores, and no comparison. The daily price story is unavailable because no
product has a fresh, shareable offer. The inventory cron that should keep
evidence current has not been running reliably. See the
[product roadmap](./ROADMAP.md#catalogue-and-evidence-debt-2026-08-23) for the
detailed recovery plan.

This is an evidence problem, not a code problem. The platform, publication
gate, share cards, and assisted-commerce flow all work. What is missing is the
fresh Nigerian retail evidence that makes them useful.

It is not an open marketplace, inventory-first retailer, diagnosis service, or
generic chatbot. It is an evidence-led care platform that may act as a
disclosed purchasing agent. It combines three systems:

```text
Clinical intelligence
+ Retail intelligence
+ Grounded guidance
```

## The three questions

Every product journey should answer:

1. Is this right for me?
2. Why might it fit—or not fit?
3. Where can I find this exact product today?

Guidance remains educational. A product page does not diagnose a condition or guarantee that a physical item is authentic.

## The product test

Before building a feature, ask:

> Does this make someone more likely to check JeloCare before buying skincare?

If not, defer it.

## What makes JeloCare useful

### Clinical intelligence

- evidence-backed ingredient and routine education;
- deterministic safety stops before products or AI;
- clear contraindication, pregnancy, layering, and escalation boundaries;
- observable concern patterns without diagnostic claims.

### Retail intelligence

- exact Nigerian listings;
- current observed prices and availability;
- price history and freshness;
- seller, retailer, regulator, and brand evidence kept separate;
- market summaries only when the compared set supports them.

### Grounded guidance

- structured product, ingredient, concern, and retail data first;
- models may choose only from a rule-filtered shortlist;
- safety, care action, and referral copy remain deterministic;
- missing evidence remains missing.

## The flywheel

```text
Search
  -> understand fit
  -> compare exact offers
  -> make a better decision
  -> save or share useful evidence
  -> improve community and retailer signals
  -> strengthen structured knowledge
  -> return
```

Growth follows usefulness. Share cards, price comparisons, ingredient explanations, and routines should be shareable because they solve a real problem—not because they imitate social media.

## Quality over volume

The catalogue may grow beyond 1,000 products, but count is not the release criterion. Each public product needs a traceable identity, bounded care position, current market evidence, and a display-worthy exact package image. Discovery leads and frozen bulk records are research, not inventory.

## Product voice

Calm. Direct. Human.

- Fewer words.
- No manufactured urgency.
- No technical prose when the interface can show the answer.
- No labels for what a user already expects.
- No claim stronger than its evidence.

See [the interface contract](../UI_PHILOSOPHY.md) and [the inventory direction](../INVENTORY_EXPERIENCE.md).
