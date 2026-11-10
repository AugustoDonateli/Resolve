-- F5-T06 — Folha de 30 linhas: perfil fixo da plataforma (não do Inep). A quebra é calculada pelo app com
-- uma regra única (apps/web/src/lib/essay/sheet.ts), independente de fonte e largura de tela; por isso
-- font_asset_hash identifica a especificação da quebra, não um arquivo de fonte:
-- sha256("folha-v1|64 colunas|recuo 2|quebra-por-palavra-v1|30 linhas").
insert into public.essay_layout_profiles (version, font_asset_hash, font_size, line_height, canonical_width, line_limit, wrapping_version)
values ('folha-v1', 'd441d3cb5402081ee0d5e4df3e889b4ea7268cec8087a28f04675a6fc417134c', 18, 32, 64, 30, 'quebra-por-palavra-v1')
on conflict (version) do nothing;
