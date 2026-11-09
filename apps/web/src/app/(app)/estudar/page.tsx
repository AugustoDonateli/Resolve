import type { Metadata } from "next";
import { QuestionRaioX } from "@/components/question/question-raiox";
import { ScreenHeader } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Estudar" };

export default function EstudarPage() {
  return (
    <>
      <ScreenHeader title="Resolver questão" kicker="Estudar · treino livre" />
      <QuestionRaioX />
    </>
  );
}
