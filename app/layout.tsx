import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase:new URL("https://invest.michailkhasaev.com"),
  title:"Payday Index | My risky paper experiment",
  description:"I give three fast-moving ETFs GBP 491.25 every month and compare them with the S&P 500, Nasdaq-100 and world stocks.",
  openGraph:{
    title:"Payday Index",
    description:"My risky little paper experiment. Three ETF picks every payday, racing three sensible benchmarks.",
    images:["/og.png"],
  },
  twitter:{
    card:"summary_large_image",
    title:"Payday Index",
    description:"My risky little paper experiment. Three ETF picks every payday, racing three sensible benchmarks.",
    images:["/og.png"],
  },
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
