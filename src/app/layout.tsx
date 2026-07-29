import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/system/ServiceWorkerRegister";

// Self-hosted (not next/font/google) so a flaky network at build time can
// never fail the deploy -- it did once, in loop 4.
const inter = localFont({ src: "./fonts/InterVariable.woff2", display: "swap", variable: "--font-inter" });

// Terminal design system (Phase 9, §9a): every number/stat/time/score
// routes through this, Inter stays for prose. Self-hosted for the same
// build-reliability reason as Inter above -- latin subset (covers digits).
const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
});

// Miles OS accent face: greetings, name accents, weekday words -- everything
// else stays JetBrains Mono. Self-hosted for the same build-reliability
// reason as the other two faces above.
const instrumentSerif = localFont({
  src: "./fonts/InstrumentSerif-Italic.woff2",
  display: "swap",
  variable: "--font-instrument-serif",
  style: "italic",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Road to December",
  description: "Personal athlete command center — training, fuel and rules for the road to NCAA Dec 4.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Road to December",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-full flex flex-col rtd-app-bg">
        <div className="rtd-wallpaper" aria-hidden="true" />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
