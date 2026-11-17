import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { ClubAdmin } from "@/components/club/club-admin";
import { ScreenHeader } from "@/components/shell/app-shell";
import { loadClub } from "@/lib/club/data";

export const metadata: Metadata = { title: "Clube" };
export const dynamic = "force-dynamic";

export default async function ClubePage() {
  const club = await loadClub();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost"}`;
  return (
    <>
      <Link href="/mais" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Mais
      </Link>
      <ScreenHeader title="Clube" kicker="Só o dono vê esta página" />
      <ClubAdmin club={club} origin={origin} />
    </>
  );
}
