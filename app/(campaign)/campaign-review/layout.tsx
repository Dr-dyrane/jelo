import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Campaign review · JeloCare" },
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
  openGraph: null,
  twitter: null,
};

export default function CampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
