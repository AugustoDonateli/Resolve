import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PrefsProvider, prefsBootScript } from "@/components/prefs/prefs";
import { loadPreferences, savePreferences } from "@/lib/prefs/actions";
import "./globals.css";

/** O banco fica em São Paulo: as funções rodam lá também, para cada consulta não cruzar o continente. */
export const preferredRegion = "gru1";

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
    { media: "(prefers-color-scheme: light)", color: "#17191A" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0D0F" },
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
        {/* Tinta de carimbo: borda irregular e falhas de impressão (usado por .stamp). */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <filter id="rs-tinta" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="d" />
              <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" result="g" />
              <feColorMatrix in="g" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.72" result="m" />
              <feComposite in="d" in2="m" operator="in" />
            </filter>
          </defs>
        </svg>
        <PrefsProvider account={account} persist={account ? savePreferences : undefined}>
          {children}
        </PrefsProvider>
      </body>
    </html>
  );
}
