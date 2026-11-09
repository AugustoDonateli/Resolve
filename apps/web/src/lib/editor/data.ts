import "server-only";
import { notFound } from "next/navigation";
import { authEnabled } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ProposalPayload } from "./payload";

/**
 * Área editorial: tudo passa pela sessão do editor (as políticas do banco valem; nenhuma chave
 * de serviço). Quem não é editor recebe 404, sem revelar que a área existe.
 */
export async function requireEditor() {
  if (!authEnabled) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: isEditor } = await supabase.rpc("is_editor");
  if (isEditor !== true) notFound();
  return { supabase, user };
}

/** Só informa se a conta atual é editora (para mostrar o atalho em "Mais"). */
export async function currentUserIsEditor(): Promise<boolean> {
  if (!authEnabled) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("is_editor");
  return data === true;
}

export type ProposalStatus = "valida" | "duvida" | "rejeitada" | "promovida";

export interface ProposalRow {
  id: string;
  batch_id: string;
  question_number: number;
  foreign_language: "ingles" | "espanhol" | null;
  status: ProposalStatus;
  current_revision: number;
  updated_at: string;
}

export interface BatchSummary {
  id: string;
  notes: string | null;
  created_at: string;
  proposals: ProposalRow[];
  openDoubts: Record<string, number>;
}

export async function listBatches(): Promise<BatchSummary[]> {
  const { supabase } = await requireEditor();
  const [{ data: batches }, { data: proposals }, { data: doubts }] = await Promise.all([
    supabase.from("ingest_batches").select("id, notes, created_at").order("created_at"),
    supabase
      .from("item_proposals")
      .select("id, batch_id, question_number, foreign_language, status, current_revision, updated_at")
      .order("question_number")
      .order("foreign_language", { nullsFirst: true }),
    supabase.from("doubt_queue").select("proposal_id").eq("status", "aberta"),
  ]);
  const open: Record<string, number> = {};
  for (const d of doubts ?? []) open[d.proposal_id] = (open[d.proposal_id] ?? 0) + 1;
  return (batches ?? []).map((b) => ({
    ...b,
    proposals: ((proposals ?? []) as ProposalRow[]).filter((p) => p.batch_id === b.id),
    openDoubts: open,
  }));
}

export interface Revision {
  revision: number;
  payload: ProposalPayload;
  note: string;
  changed: string[];
  edited_by: string | null;
  created_at: string;
}

export interface Doubt {
  id: string;
  kind: string;
  status: "aberta" | "resolvida" | "descartada";
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface PageImage {
  page: number;
  url: string;
  widthPx: number;
  heightPx: number;
  dxPt: number;
  dyPt: number;
  cropWidthPt: number;
  cropHeightPt: number;
}

interface Manifest {
  pages: Record<string, { width_px: number; height_px: number; dx_pt: number; dy_pt: number; crop_width_pt: number; crop_height_pt: number }>;
}

export interface ProposalDetail {
  proposal: ProposalRow & { payload: ProposalPayload; validation: unknown };
  batchNotes: string | null;
  revisions: Revision[];
  doubts: Doubt[];
  pages: PageImage[];
  figureUrls: Record<string, string>;
  userId: string;
}

export async function getProposal(id: string): Promise<ProposalDetail> {
  const { supabase, user } = await requireEditor();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: proposal } = await supabase
    .from("item_proposals")
    .select("id, batch_id, question_number, foreign_language, status, current_revision, updated_at, payload, validation")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) notFound();
  const payload = proposal.payload as ProposalPayload;
  const [{ data: batch }, { data: revisions }, { data: doubts }] = await Promise.all([
    supabase.from("ingest_batches").select("notes").eq("id", proposal.batch_id).maybeSingle(),
    supabase.from("item_proposal_revisions").select("revision, payload, note, changed, edited_by, created_at").eq("proposal_id", id).order("revision", { ascending: false }),
    supabase.from("doubt_queue").select("id, kind, status, resolution, resolved_by, resolved_at, created_at").eq("proposal_id", id).order("created_at"),
  ]);

  // Páginas do PDF (bucket privado "editorial"): links assinados de curta duração.
  const sha = payload.source.booklet_sha256;
  const pages: PageImage[] = [];
  const storage = supabase.storage.from("editorial");
  const manifestFile = await storage.download(`paginas/${sha}/manifesto.json`);
  const manifest: Manifest | null = manifestFile.data ? JSON.parse(await manifestFile.data.text()) : null;
  for (const p of payload.source.pages) {
    const geo = manifest?.pages[String(p)];
    const signed = await storage.createSignedUrl(`paginas/${sha}/${p}.webp`, 60 * 30);
    if (geo && signed.data) {
      pages.push({ page: p, url: signed.data.signedUrl, widthPx: geo.width_px, heightPx: geo.height_px, dxPt: geo.dx_pt, dyPt: geo.dy_pt, cropWidthPt: geo.crop_width_pt, cropHeightPt: geo.crop_height_pt });
    }
  }
  const figureUrls: Record<string, string> = {};
  for (const f of payload.figures) {
    const s = await storage.createSignedUrl(`figuras/${f.png_sha256}.png`, 60 * 30);
    if (s.data) figureUrls[f.id] = s.data.signedUrl;
  }
  return {
    proposal: { ...(proposal as ProposalRow), payload, validation: proposal.validation },
    batchNotes: batch?.notes ?? null,
    revisions: (revisions ?? []) as Revision[],
    doubts: (doubts ?? []) as Doubt[],
    pages,
    figureUrls,
    userId: user.id,
  };
}

export interface SkillOption {
  code: string;
  description: string;
}
export interface DistractorType {
  code: string;
  label: string;
  definition: string;
  limits: string | null;
}
export interface TagReviewRow {
  id: string;
  proposal_revision: number;
  decision: "aprovar" | "devolver" | "rejeitar";
  tags: Record<string, unknown>;
  checklist: Record<string, boolean>;
  notes: string | null;
  reviewer_id: string;
  created_at: string;
}

export interface TagReviewContext {
  proposal: ProposalRow & { payload: ProposalPayload };
  answer: string | null;
  skills: SkillOption[];
  distractorTypes: DistractorType[];
  reviews: TagReviewRow[];
  suggestion: { id: string; status: string; suggestion: Record<string, unknown>; model_served: string | null; prompt_version: string } | null;
  openDoubts: number;
  userId: string;
}

export async function getTagReviewContext(id: string): Promise<TagReviewContext> {
  const { supabase, user } = await requireEditor();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: proposal } = await supabase
    .from("item_proposals")
    .select("id, batch_id, question_number, foreign_language, status, current_revision, updated_at, payload")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) notFound();
  const payload = proposal.payload as ProposalPayload;
  const [{ data: answer }, { data: skills }, { data: types }, { data: reviews }, { data: suggestions }, { count }] = await Promise.all([
    supabase.rpc("official_answer", { p_proposal: id }),
    supabase
      .from("skills")
      .select("code, number, description, areas!inner(code, matrix_versions!inner(status))")
      .eq("areas.code", payload.area)
      .eq("areas.matrix_versions.status", "published")
      .order("number"),
    supabase.from("distractor_types").select("code, label, definition, limits").eq("taxonomy_version", "v0-proposta").order("label"),
    supabase.from("proposal_tag_reviews").select("id, proposal_revision, decision, tags, checklist, notes, reviewer_id, created_at").eq("proposal_id", id).order("created_at", { ascending: false }),
    supabase.from("tag_suggestions").select("id, status, suggestion, model_served, prompt_version").eq("proposal_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.from("doubt_queue").select("id", { count: "exact", head: true }).eq("proposal_id", id).eq("status", "aberta"),
  ]);
  return {
    proposal: { ...(proposal as ProposalRow), payload },
    answer: (answer as string | null) ?? null,
    skills: (skills ?? []).map((s) => ({ code: s.code as string, description: s.description as string })),
    distractorTypes: (types ?? []) as DistractorType[],
    reviews: (reviews ?? []) as TagReviewRow[],
    suggestion: suggestions?.[0] ?? null,
    openDoubts: count ?? 0,
    userId: user.id,
  };
}

export interface QueueRow {
  proposal_id: string;
  batch_id: string;
  batch_notes: string | null;
  publishable: boolean;
  question_number: number;
  foreign_language: "ingles" | "espanhol" | null;
  status: ProposalStatus;
  blockers: string[];
}

/** Fila de publicação com os impedimentos calculados pelo banco (mesma regra da publicação). */
export async function getPublicationQueue(): Promise<QueueRow[]> {
  const { supabase } = await requireEditor();
  const { data } = await supabase.rpc("publication_queue");
  return (data ?? []) as QueueRow[];
}
