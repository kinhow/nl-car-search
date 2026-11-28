import type { Metadata } from "next";
import { Overpass, Overpass_Mono } from "next/font/google";
import "./globals.css";

// Overpass comes from Highway Gothic, the road-sign typeface.
const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
});

const overpassMono = Overpass_Mono({
  variable: "--font-overpass-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NL Car Search",
  description: "Natural-language used-car search with LLM filter extraction, hybrid RAG and evals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${overpass.variable} ${overpassMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
