import type { NextConfig } from "next";

/**
 * Em deploy (Vercel, produção ou prévia) a conta é obrigatória: sem as
 * variáveis do Supabase o app entraria em "modo local", aberto sem login
 * num endereço público. O build falha com instrução clara.
 */
if (process.env.VERCEL) {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[Resolve] Faltam variáveis de ambiente na Vercel: ${missing.join(", ")}. ` +
        "Configure em Project Settings → Environment Variables (Production e Preview) e faça um novo deploy.",
    );
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@resolve/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  // Foto da redação: o aparelho reduz a imagem antes de enviar; 4 MB cobre a folha inteira legível.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
