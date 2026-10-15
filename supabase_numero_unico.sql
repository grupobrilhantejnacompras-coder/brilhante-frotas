-- v6.20 — RODE SÓ DEPOIS de corrigir os números repetidos no sistema
-- (Painel executivo > Qualidade dos dados > "Número de O.S. repetido" > "Corrigir números repetidos").
-- Com este índice o banco recusa duas O.S. com o mesmo número, e o sistema renumera sozinho
-- a O.S. nova quando isso acontecer.
-- Se der erro "could not create unique index", ainda existem números repetidos: corrija-os primeiro.
create unique index if not exists ordens_numero_unico on public.ordens (numero) where numero is not null;
