import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHAINCHECK — Onchain claims. Verified by evidence.",
  description:
    "Verify claims about blockchain activity against real Nansen Smart Money data.",
  metadataBase: new URL("https://chaincheck-eta.vercel.app"),
  openGraph: {
    title: "CHAINCHECK — Onchain claims. Verified by evidence.",
    description:
      "Verify claims about blockchain activity against real Nansen Smart Money data.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CHAINCHECK — Onchain claims. Verified by evidence.",
    description:
      "Verify claims about blockchain activity against real Nansen Smart Money data.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-white antialiased">
        {children}
      </body>
    </html>
  );
}
