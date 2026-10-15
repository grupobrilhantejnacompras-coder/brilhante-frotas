-- v6.18 — grava a situação da O.S. (Aberta / Em andamento / Concluída / Cancelada) na nuvem.
-- Rode UMA vez no Supabase: SQL Editor > New query > cole > Run.
-- É seguro rodar de novo (if not exists) e não altera nenhuma O.S. existente.
-- Antes disso o sistema continua funcionando normalmente; a situação só não é compartilhada entre computadores.

alter table public.ordens add column if not exists status text;

-- (Opcional) só aceita as 4 situações do sistema:
-- alter table public.ordens add constraint ordens_status_chk
--   check (status is null or status in ('Aberta','Em andamento','Concluída','Cancelada'));
