import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_JP, Noto_Serif_JP, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VisitCare シフト最適化",
  description: "訪問介護シフト最適化システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${dmSans.variable} ${notoSansJP.variable} ${notoSerifJP.variable} ${geistMono.variable} antialiased`}
      >
        {process.env.NEXT_PUBLIC_AUTH_MODE !== 'required' && (
          <div className="bg-amber-500 text-white text-center text-sm py-1 font-medium tracking-wide">
            デモ環境 — 本番データではありません
          </div>
        )}
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
