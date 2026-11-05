import type { Metadata, Viewport } from "next";
import { Crimson_Pro, Inter } from "next/font/google";
import "./globals.css";

const serif = Crimson_Pro({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Bharath Dass School – Portal",
  description: "Bharath Dass Matriculation Higher Secondary School – staff portal",
  robots: { index: false, follow: false },
  // Installed on an iPhone/iPad home screen: opens full-screen, titled "Bharath Dass".
  appleWebApp: { capable: true, title: "Bharath Dass", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7a1d21",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
