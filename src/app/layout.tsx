import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Policy Extractor - Student Accommodation Policy Analysis",
  description: "Extract cancellation and payment policies from student accommodation websites using AI-powered analysis with Gemini.",
  keywords: ["Policy Extraction", "Student Accommodation", "Cancellation Policies", "Payment Policies", "Gemini AI", "Playwright"],
  authors: [{ name: "Z.ai" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Policy Extractor Dashboard",
    description: "AI-powered policy extraction for student accommodation websites",
    siteName: "Policy Extractor",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Policy Extractor Dashboard",
    description: "AI-powered policy extraction for student accommodation websites",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
