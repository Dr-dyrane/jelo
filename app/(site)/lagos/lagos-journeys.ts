export type LagosJourneyIcon =
  | "browse"
  | "retailer"
  | "quote"
  | "payment"
  | "delivery"
  | "products"
  | "listings";

export type LagosJourney = {
  id: "order" | "bundle";
  eyebrow: string;
  heading: string;
  intro: string;
  cta: string;
  href: "/products" | "/bundle";
  previewLabel: string;
  steps: readonly {
    icon: LagosJourneyIcon;
    title: string;
    description: string;
  }[];
};

export const lagosCommerceJourneys = [
  {
    id: "order",
    eyebrow: "How to order",
    heading: "One clear path.",
    intro:
      "Add exact products from one retailer. Review the complete quote before you pay, then follow the order through delivery.",
    cta: "Browse products",
    href: "/products",
    previewLabel: "Assisted order",
    steps: [
      {
        icon: "browse",
        title: "Browse exact products",
        description: "Start with a product and its current Nigerian listings.",
      },
      {
        icon: "retailer",
        title: "Choose one retailer",
        description: "Every item in the order stays with the same store.",
      },
      {
        icon: "quote",
        title: "Request a verified quote",
        description: "Products, fees and delivery are checked together.",
      },
      {
        icon: "payment",
        title: "Approve, then pay",
        description: "Nothing proceeds until you approve the complete quote.",
      },
      {
        icon: "delivery",
        title: "Track delivery",
        description: "Follow procurement, dispatch and delivery in one order.",
      },
    ],
  },
  {
    id: "bundle",
    eyebrow: "Bundle Finder",
    heading: "One basket. One retailer.",
    intro:
      "Choose 2–4 products. Compare retailers with an exact Nigerian listing for every item.",
    cta: "Build a bundle",
    href: "/bundle",
    previewLabel: "Bundle Finder",
    steps: [
      {
        icon: "products",
        title: "Choose products",
        description: "Add two to four exact catalogue products.",
      },
      {
        icon: "retailer",
        title: "Compare one retailer",
        description: "See stores that list every selected item.",
      },
      {
        icon: "listings",
        title: "Open exact listings",
        description: "Check the current product pages before you continue.",
      },
    ],
  },
] as const satisfies readonly LagosJourney[];
