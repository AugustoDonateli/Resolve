import type { Metadata } from "next";
import { EnvelopeOpening } from "@/components/motion/envelope-opening";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Envelope" };

export default function EnvelopePage() {
  return (
    <>
      <ScreenHeader title="Envelope e caderno" kicker="Protótipo F1-T10 · M03 · formas simples para testar enquadramento" />
      <div className="max-w-4xl">
        <EnvelopeOpening />
        <p className="mt-6 max-w-[65ch] t-meta text-ink-2">
          Produção final: modelo autoral pré-renderizado (F7-T08 a F7-T14). Este protótipo testa ritmo (Q0–Q5 do storyboard), pular e a regra do cronômetro.
        </p>
      </div>
    </>
  );
}
