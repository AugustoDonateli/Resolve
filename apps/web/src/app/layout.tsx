import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PrefsProvider, prefsBootScript } from "@/components/prefs/prefs";
import { loadPreferences, savePreferences } from "@/lib/prefs/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Resolve", template: "%s · Resolve" },
  description: "Preparação para o ENEM",
  applicationName: "Resolve",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iPhone: ocupa a tela inteira e respeita entalhe/barra via env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F4ED" },
    { media: "(prefers-color-scheme: dark)", color: "#20242C" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const account = await loadPreferences();
  return (
    <html
      lang="pt-BR"
      data-text-scale={account?.textScale ?? "18"}
      data-theme={account && account.theme !== "system" ? account.theme : undefined}
      data-motion={account?.reduceMotion ? "reduced" : undefined}
      data-account={account ? "" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsBootScript }} />
      </head>
      <body>
        <PrefsProvider account={account} persist={account ? savePreferences : undefined}>
          {children}
        </PrefsProvider>
      </body>
    </html>
  );
}
