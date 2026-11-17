import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AccountData } from "@/components/club/account-data";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadMyAccount } from "@/lib/club/data";

export const metadata: Metadata = { title: "Conta e dados" };
export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const account = await loadMyAccount();
  return (
    <>
      <Link href="/mais" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Mais
      </Link>
      <ScreenHeader title="Conta e dados" kicker={account?.email ?? "Sua conta"} />
      {account ? <AccountData account={account} /> : <p className="t-reading text-ink-2">Entre para ver a sua conta.</p>}
    </>
  );
}
