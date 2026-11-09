-- F2-T11/F2-T12 — Editores escrevem na área editorial com a própria sessão (authenticated).
-- CHECKs e gatilhos chamam funções puras de private.* com os privilégios de quem escreve; sem isto,
-- a escrita do editor falha com "permission denied". O esquema private não é exposto pela API
-- (PostgREST serve só public), então as funções não viram RPC. Tabelas de private seguem fechadas.
grant usage on schema private to authenticated;
grant execute on function private.text_is_safe(text) to authenticated;
grant execute on function private.blocks_are_safe(jsonb) to authenticated;
grant execute on function private.json_strings_are_safe(jsonb) to authenticated;
grant execute on function private.proposal_is_complete(jsonb) to authenticated;
