"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildTasks, freeWindows, planDay, type Window } from "./planner";
import { dateInZone } from "./schedule-types";

export type PlanResult = { ok: true } | { ok: false; message: string };

function minuteInZone(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** "2026-11-16T19:30:00" → minuto do dia `day` (recortado a 0–1440 quando atravessa a meia-noite). */
function toMinute(local: string, day: string, edge: "start" | "end"): number {
  const d = local.slice(0, 10);
  if (d < day) return 0;
  if (d > day) return edge === "end" ? 1440 : 1440;
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

/**
 * Monta (ou refaz) o plano de hoje (F4-T15): horários livres menos compromissos, a partir de agora;
 * revisão vencida, metas por área e o restante da meta diária. Refazer troca só blocos ainda planejados
 * pela agenda; blocos em curso, concluídos ou manuais ficam e ocupam o espaço deles.
 */
export async function generateDayPlan(): Promise<PlanResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Entre para planejar o dia." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  let tz = profile?.timezone ?? "America/Sao_Paulo";
  let today: string;
  try {
    today = dateInZone(new Date(), tz);
  } catch {
    tz = "America/Sao_Paulo";
    today = dateInZone(new Date(), tz);
  }
  const now = minuteInZone(new Date(), tz);
  const [occ, queue, goals, kept] = await Promise.all([
    supabase.rpc("schedule_occurrences", { p_from: today, p_to: today }),
    supabase.rpc("review_queue", { p_available_minutes: 30 }),
    supabase
      .from("goals")
      .select("level, area_code, target_minutes")
      .is("archived_at", null),
    supabase
      .from("study_blocks")
      .select("start_minute, planned_minutes")
      .eq("local_date", today)
      .neq("status", "planejado"),
  ]);
  if (occ.error || queue.error || goals.error)
    return {
      ok: false,
      message: "Não foi possível ler a agenda agora. Tente de novo.",
    };
  const available: Window[] = [];
  const busy: Window[] = [];
  for (const o of (occ.data ?? []) as {
    kind: string;
    local_start: string;
    local_end: string;
  }[]) {
    const w = {
      start: toMinute(o.local_start, today, "start"),
      end: toMinute(o.local_end, today, "end"),
    };
    (o.kind === "compromisso" ? busy : available).push(w);
  }
  for (const b of kept.data ?? [])
    busy.push({
      start: b.start_minute,
      end: b.start_minute + b.planned_minutes,
    });
  const batch = (
    (queue.data ?? []) as { in_batch: boolean; minutes_per_item: number }[]
  ).filter((r) => r.in_batch);
  const g = goals.data ?? [];
  const { tasks, notes } = buildTasks({
    reviewMinutes: batch.reduce((a, r) => a + r.minutes_per_item, 0),
    reviewCount: batch.length,
    dailyGoal: g.find((x) => x.level === "diaria")?.target_minutes ?? null,
    weeklyGoal: g.find((x) => x.level === "semanal")?.target_minutes ?? null,
    areaGoals: g
      .filter((x) => x.level === "area" && x.target_minutes)
      .map((x) => ({ area: x.area_code!, weeklyMinutes: x.target_minutes! })),
  });
  const windows = freeWindows(available, busy, now);
  const { blocks, leftOut } = planDay(windows, tasks, {
    gap: 5,
    notBefore: now,
    step: 5,
  });
  const del = await supabase
    .from("study_blocks")
    .delete()
    .eq("local_date", today)
    .eq("status", "planejado")
    .eq("source", "agenda-v1");
  if (del.error)
    return {
      ok: false,
      message: "Não foi possível refazer o plano. Tente de novo.",
    };
  if (blocks.length) {
    const ins = await supabase.from("study_blocks").insert(
      blocks.map((b) => ({
        local_date: today,
        timezone: tz,
        start_minute: b.start,
        planned_minutes: b.minutes,
        kind: b.kind,
        area_code: b.taskId.startsWith("area-") ? b.taskId.slice(5) : null,
        title: b.title,
        reason: b.reason,
      })),
    );
    if (ins.error)
      return {
        ok: false,
        message: "Não foi possível gravar o plano. Tente de novo.",
      };
  }
  const left = [
    ...leftOut.map((l) => ({ title: l.title, minutes: l.minutes, why: l.why })),
    ...notes.map((n) => ({ note: n })),
  ];
  if (!windows.length && !left.some((l) => "why" in l))
    left.push({
      note: "Não há horário livre a partir de agora. Cadastre horários livres em “Toda semana”.",
    });
  const up = await supabase
    .from("study_plan_days")
    .upsert({
      user_id: auth.user.id,
      local_date: today,
      left_out: left,
      generated_at: new Date().toISOString(),
    });
  if (up.error)
    return {
      ok: false,
      message: "Plano gravado, mas a explicação não foi salva.",
    };
  revalidatePath("/rotina");
  return { ok: true };
}
