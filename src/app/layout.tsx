import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider, themeInitScript } from "@/components/theme-provider";

const aspekta = localFont({
  src: [
    { path: "./fonts/Aspekta-250.woff2", weight: "250", style: "normal" },
    { path: "./fonts/Aspekta-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Aspekta-400.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-aspekta",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Madrid Party Calendar",
  description:
    "Aggregated calendar of Madrid nightlife — club nights, pubcrawls and pool parties from multiple ticket sources in one place.",
  applicationName: "Madrid Party Calendar",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Madrid Parties",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${aspekta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
