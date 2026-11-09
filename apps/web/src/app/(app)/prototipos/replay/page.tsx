import type { Metadata } from "next";
import { Replay } from "@/components/motion/replay";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Replay" };

export default function ReplayPage() {
  return (
    <>
      <ScreenHeader title="Replay da sessão" kicker="Protótipo F1-T12 · M06 · cartão-resposta vira linha do tempo" />
      <div className="max-w-4xl">
        <Replay />
      </div>
    </>
  );
}
