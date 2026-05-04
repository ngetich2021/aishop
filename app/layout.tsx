import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import PWAInit from "@/components/PWAInit";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "Kwenik",
  description: "Business management platform",
  manifest: "/manifest.json",
  icons: { icon: "/branton_logo.png", apple: "/branton_logo.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kwenik" },
  formatDetection: { telephone: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PWAInit />
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}