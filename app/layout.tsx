import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider }      from "next-auth/react";
import PWAInit                  from "@/components/PWAInit";
import { ThemeProvider }        from "@/components/ThemeProvider";
import NavigationProgress       from "@/components/NavigationProgress";


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
    /*
     * suppressHydrationWarning: the inline script below mutates className
     * before React hydrates, so the server-rendered attribute ("") and the
     * client attribute ("dark") can differ. This suppresses the mismatch
     * warning without disabling hydration checks on child nodes.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/*
       * Anti-flash script: runs synchronously in <head> before the browser
       * paints a single pixel.  It reads localStorage + system preference and
       * applies .dark to <html> immediately, so dark-mode users never see a
       * white flash on page load or hard-refresh.
       */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kwenik-theme')||(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PWAInit />
        <NavigationProgress />
        <ThemeProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}