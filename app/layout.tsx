import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase:new URL("https://invest.michailkhasaev.com"),
  title:"Payday Index | My risky paper experiment",
  description:"I give three fast-moving ETFs GBP 491.25 every month and see if they can outrun SPY.",
  openGraph:{
    title:"Payday Index",
    description:"My risky little paper experiment. Three ETF picks every payday, racing SPY.",
    images:["/og.png"],
  },
  twitter:{
    card:"summary_large_image",
    title:"Payday Index",
    description:"My risky little paper experiment. Three ETF picks every payday, racing SPY.",
    images:["/og.png"],
  },
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
