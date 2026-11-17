import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonView } from "@/components/lessons/lesson-view";
import { ScreenHeader } from "@/components/shell/app-shell";
import { lessonBySlug } from "@/lib/lessons";
import { loadLessonPage } from "@/lib/lessons/data";
import { AREA_LABEL } from "@/lib/study/question-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = lessonBySlug((await params).slug);
  return { title: l ? `Lição: ${l.title}` : "Lição" };
}

export default async function LicaoPage({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = lessonBySlug((await params).slug);
  if (!lesson) notFound();
  const page = await loadLessonPage(lesson);
  return (
    <>
      <Link href="/estudar/licoes" className="mb-3 inline-flex min-h-11 items-center gap-1 t-ui text-ink-2 hover:text-ink">
        <ChevronLeft aria-hidden="true" className="size-4" /> Lições
      </Link>
      <ScreenHeader title={lesson.title} kicker={`Lição · ${AREA_LABEL[lesson.area]} · cerca de ${lesson.minutes} min · em teste`} />
      <LessonView lesson={lesson} page={page} />
    </>
  );
}
