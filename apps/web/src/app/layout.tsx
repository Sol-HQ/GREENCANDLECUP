import type { Metadata } from "next";
import { WalletProviders } from "@/components/wallet-provider";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Green Candle Cup | Phoenix Perps",
  description: "GCC competition dashboard and trading bot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <WalletProviders>
          <AppProviders>{children}</AppProviders>
        </WalletProviders>
      </body>
    </html>
  );
}
