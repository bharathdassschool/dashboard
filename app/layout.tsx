import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bharath Dass School – Portal",
  description: "One place for the school's office, leave and question-paper systems",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
