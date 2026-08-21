export type LagosJourneyIcon =
  "browse" | "retailer" | "quote" | "payment" | "delivery" | "products";

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
        title: "Open an exact product",
        description:
          "Start on the real product page and see its listed stores.",
      },
      {
        icon: "retailer",
        title: "Choose one retailer",
        description: "Every item in the order stays with the same store.",
      },
      {
        icon: "products",
        title: "Keep shopping that store",
        description: "Add other exact items without splitting the basket.",
      },
      {
        icon: "quote",
        title: "Review and request quote",
        description: "Products, delivery and service fee are shown together.",
      },
      {
        icon: "payment",
        title: "Approve, pay and track",
        description: "Approve first, then follow the order through delivery.",
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
        title: "Choose 2–4 products",
        description: "Add two to four exact catalogue products.",
      },
      {
        icon: "retailer",
        title: "See common retailers",
        description: "Only stores listing every selected item appear.",
      },
      {
        icon: "retailer",
        title: "Choose one exact basket",
        description:
          "Compare the real products and listed total store by store.",
      },
      {
        icon: "quote",
        title: "Request a verified quote",
        description:
          "Review delivery and service fee before anything proceeds.",
      },
      {
        icon: "payment",
        title: "Approve, pay and track",
        description: "Approve first, then follow the order through delivery.",
      },
    ],
  },
] as const satisfies readonly LagosJourney[];
