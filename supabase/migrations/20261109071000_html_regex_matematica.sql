-- Corrige falso positivo do filtro de HTML: "2 < x e x > 1" é notação matemática, não tag.
-- Em HTML, uma tag exige o nome colado ao "<" (ex.: <img, </p, <!--, <?xml).
create or replace function private.text_is_safe(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t is null or (
    t !~ '(<[a-zA-Z][a-zA-Z0-9-]*([[:space:]/][^<>]*)?>|</[a-zA-Z][^<>]*>|<[!?])'
    and t !~* '(javascript\s*:|vbscript\s*:|data\s*:\s*text/html|\mon[a-z]{3,}\s*=|&#x?0*3c;?|&lt;\s*script)'
    and t !~ '[‪-‮⁦-⁩‎‏]'
    and t !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
  );
$$;
revoke all on function private.text_is_safe(text) from public, anon, authenticated;
