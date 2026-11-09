import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PrefsProvider, prefsBootScript } from "@/components/prefs/prefs";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Resolve", template: "%s · Resolve" },
  description: "Preparação para o ENEM",
  applicationName: "Resolve",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4ED" },
    { media: "(prefers-color-scheme: dark)", color: "#20242C" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-text-scale="18" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
      </head>
      <body>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
