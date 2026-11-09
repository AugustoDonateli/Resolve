-- F3-T01 — Índice da chave estrangeira composta tentativa → item da sessão (lint 0001).
create index attempts_session_item_version on public.attempts (session_item_id, item_version_id);
