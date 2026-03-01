import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://helios.run";

export const metadata: Metadata = {
  title: {
    default: "Helios",
    template: "%s | Helios",
  },
  description: "Your running journey, visualized",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "Helios",
    description: "Your running journey, visualized",
    siteName: "Helios",
    url: siteUrl,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/helios-og-img.png",
        width: 1200,
        height: 630,
        alt: "Helios — Your running journey, visualized",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Helios",
    description: "Your running journey, visualized",
    images: [
      {
        url: "/helios-og-img.png",
        width: 1200,
        height: 630,
        alt: "Helios — Your running journey, visualized",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${geistMono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
