import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voicing - Professional Audio Processing Platform",
  description: "Transform your audio with AI-powered speech enhancement, rendering, and embedding generation. Professional-grade tools for content creators.",
  keywords: "audio processing, speech enhancement, AI audio, voice editing, audio rendering",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-0 text-neutral-900`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
