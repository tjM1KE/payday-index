import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase:new URL("https://invest.michailkhasaev.com"),
  title:"Payday Index | My risky paper experiment",
  description:"My live forward paper account, plus a historical ETF replay. GBP 491.25 goes into three high-beta picks after each completed month.",
  openGraph:{
    title:"Payday Index | Live paper account",
    description:"GBP 491.25 a month. Three high-beta ETF picks. One record I cannot quietly rewrite.",
    images:["/og.png"],
  },
  twitter:{
    card:"summary_large_image",
    title:"Payday Index | Live paper account",
    description:"GBP 491.25 a month. Three high-beta ETF picks. One record I cannot quietly rewrite.",
    images:["/og.png"],
  },
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
