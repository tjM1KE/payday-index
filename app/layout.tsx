import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
export const metadata: Metadata = { metadataBase:new URL("https://invest.michailkhasaev.com"), title:"Payday Index | Paper portfolio", description:"A long-horizon paper portfolio that invests 15% of a typical London take-home pay every month.", openGraph:{title:"Payday Index",description:"£491.25 a month. Paper trading, patiently.",images:["/og.png"]}, twitter:{card:"summary_large_image",title:"Payday Index",description:"£491.25 a month. Paper trading, patiently.",images:["/og.png"]} };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>}
