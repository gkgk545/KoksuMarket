import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "곡수마켓",
  description: "2026 곡수초 영어 마켓",
};

// Korean fonts are loaded from Google's stylesheet at runtime rather than next/font:
// next/font has to download every Hangul subset at build time, which is slow and flaky.
// Black Han Sans is the display face (brand, prices, stamps); Gothic A1 is everything else.
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;800&display=swap";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
